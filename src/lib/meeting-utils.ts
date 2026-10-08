/**
 * Meeting Link Utilities & Domain Logic for Krishna Flute Academy
 * Handles parsing, validation, platform identification, and canonical persistence
 * for both session-specific (live_meeting_link) and reusable classroom meeting links.
 */

export interface ParsedMeetingInfo {
    /** The active/effective meeting link (session-specific link takes precedence over reusable) */
    effectiveMeetingLink: string | null;
    /** The configured reusable meeting link saved in the classroom metadata */
    reusableMeetingLink: string | null;
    /** The active session-specific link (active while is_live or during ongoing session) */
    sessionMeetingLink: string | null;
    /** Whether the classroom delivery format is online */
    isOnline: boolean;
    /** The delivery format: 'online' | 'offline' */
    deliveryFormat: 'online' | 'offline';
    /** Cleaned description with all metadata tags stripped */
    cleanDescription: string;
    /** Platform name if identifiable (e.g., Google Meet, Zoom, Microsoft Teams) */
    platform: string;
}

/**
 * Validates a meeting URL format (must be valid http/https).
 */
export function isValidMeetingUrl(url: string | null | undefined): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Identifies the meeting platform from the URL.
 */
export function identifyMeetingPlatform(url: string | null | undefined): string {
    if (!url || typeof url !== 'string') return 'Online Meeting';
    const lower = url.toLowerCase();
    if (lower.includes('meet.google.com')) return 'Google Meet';
    if (lower.includes('zoom.us') || lower.includes('zoomgov.com')) return 'Zoom';
    if (lower.includes('teams.microsoft.com') || lower.includes('teams.live.com')) return 'Microsoft Teams';
    if (lower.includes('webex.com')) return 'Cisco Webex';
    if (lower.includes('skype.com')) return 'Skype';
    if (lower.includes('whereby.com')) return 'Whereby';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'YouTube Live';
    if (lower.includes('jitsi')) return 'Jitsi Meet';
    return 'Online Video Call';
}

/**
 * Extracts reusable meeting link, delivery format, and clean description from raw description.
 */
export function extractClassroomMetadata(rawDescription: string | null | undefined): {
    reusableMeetingLink: string | null;
    deliveryFormat: 'online' | 'offline';
    isOnline: boolean;
    cleanDescription: string;
} {
    const desc = rawDescription || '';
    
    // Extract meeting link tag: [meeting_link:https://...]
    const meetMatch = desc.match(/\[meeting_link:(https?:\/\/[^\s\]]+)\]/i);
    const reusableMeetingLink = meetMatch ? meetMatch[1].trim() : null;

    // Extract delivery format tag: [delivery_format:online|offline]
    const dfMatch = desc.match(/\[delivery_format:(online|offline)\]/i);
    const deliveryFormat: 'online' | 'offline' = dfMatch
        ? (dfMatch[1].toLowerCase() as 'online' | 'offline')
        : (desc.toLowerCase().includes('online') ? 'online' : 'offline');

    // Strip tags to get clean user-facing description
    const cleanDescription = desc
        .replace(/\[meeting_link:[^\]]+\]/gi, '')
        .replace(/\[delivery_format:(online|offline)\]/gi, '')
        .trim();

    return {
        reusableMeetingLink,
        deliveryFormat,
        isOnline: deliveryFormat === 'online',
        cleanDescription
    };
}

/**
 * Serializes description with delivery format and optional reusable meeting link tags.
 */
export function serializeClassroomDescription(
    cleanDescription: string,
    deliveryFormat: 'online' | 'offline',
    reusableMeetingLink?: string | null
): string {
    const trimmedDesc = (cleanDescription || '')
        .replace(/\[meeting_link:[^\]]+\]/gi, '')
        .replace(/\[delivery_format:(online|offline)\]/gi, '')
        .trim();

    const tags: string[] = [`[delivery_format:${deliveryFormat || 'offline'}]`];
    if (reusableMeetingLink && isValidMeetingUrl(reusableMeetingLink)) {
        tags.push(`[meeting_link:${reusableMeetingLink.trim()}]`);
    }

    return trimmedDesc ? `${trimmedDesc} ${tags.join(' ')}` : tags.join(' ');
}

/**
 * Resolves full meeting information for a classroom entity.
 * Session-specific link (`live_meeting_link`) takes precedence over reusable link.
 */
export function resolveClassroomMeetingInfo(classroom: {
    description?: string | null;
    live_meeting_link?: string | null;
    is_live?: boolean;
} | null | undefined): ParsedMeetingInfo {
    if (!classroom) {
        return {
            effectiveMeetingLink: null,
            reusableMeetingLink: null,
            sessionMeetingLink: null,
            isOnline: false,
            deliveryFormat: 'offline',
            cleanDescription: '',
            platform: 'Online Meeting'
        };
    }

    const meta = extractClassroomMetadata(classroom.description);
    const sessionMeetingLink = classroom.live_meeting_link || null;
    const effectiveMeetingLink = sessionMeetingLink || meta.reusableMeetingLink || null;
    const platform = identifyMeetingPlatform(effectiveMeetingLink);

    return {
        effectiveMeetingLink,
        reusableMeetingLink: meta.reusableMeetingLink,
        sessionMeetingLink,
        isOnline: meta.isOnline,
        deliveryFormat: meta.deliveryFormat,
        cleanDescription: meta.cleanDescription,
        platform
    };
}
