import { supabaseAuth } from './supabase-auth';
import { CommunityProfile, resolveUserBadge } from './community';

export const COMMUNITY_EVENT_TYPES = [
    ['hindustani_classical', 'Hindustani Classical'],
    ['carnatic_classical', 'Carnatic Classical'],
    ['flute_bansuri', 'Flute / Bansuri'],
    ['vocal', 'Vocal'],
    ['tabla_percussion', 'Tabla / Percussion'],
    ['instrumental', 'Instrumental'],
    ['workshop_masterclass', 'Workshop / Masterclass'],
    ['festival', 'Festival'],
    ['academy_event', 'Academy Event'],
    ['other_music_event', 'Other Music Event'],
] as const;

export type CommunityEventType = typeof COMMUNITY_EVENT_TYPES[number][0];
export const COMMUNITY_EVENT_POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const COMMUNITY_EVENT_POSTER_MAX_BYTES = 5 * 1024 * 1024;

// Kept deliberately compact for V1: these are valid IANA identifiers, with
// India first because it is the academy's default event timezone.
export const COMMUNITY_EVENT_TIMEZONES = [
    ['Asia/Kolkata', 'India Standard Time — Asia/Kolkata'],
    ['Asia/Colombo', 'Sri Lanka — Asia/Colombo'],
    ['Asia/Kathmandu', 'Nepal — Asia/Kathmandu'],
    ['Asia/Dhaka', 'Bangladesh — Asia/Dhaka'],
    ['Asia/Dubai', 'United Arab Emirates — Asia/Dubai'],
    ['Asia/Singapore', 'Singapore — Asia/Singapore'],
    ['Europe/London', 'United Kingdom — Europe/London'],
    ['Europe/Paris', 'Central Europe — Europe/Paris'],
    ['America/New_York', 'US Eastern — America/New_York'],
    ['America/Chicago', 'US Central — America/Chicago'],
    ['America/Los_Angeles', 'US Pacific — America/Los_Angeles'],
    ['Australia/Sydney', 'Australia Eastern — Australia/Sydney'],
] as const;

export interface CommunityEvent {
    id: string;
    author_id: string | null;
    title: string;
    event_type: CommunityEventType;
    event_date: string;
    start_time: string;
    end_time: string | null;
    ends_next_day: boolean;
    event_timezone: string;
    venue: string;
    city: string;
    short_description: string;
    details: string | null;
    performer_name: string | null;
    organizer_name: string | null;
    poster_url: string | null;
    external_url: string | null;
    is_deleted?: boolean;
    created_at: string;
    updated_at: string;
    author?: CommunityProfile;
}

export type CommunityEventPreview = Pick<CommunityEvent, 'id' | 'title' | 'event_type' | 'event_date' | 'start_time' | 'event_timezone' | 'venue' | 'city' | 'poster_url'>;

// This is intentionally the editable form surface, not a mirror of every
// persisted event column. Keeping historical detail fields out of updates
// means editing the simplified form cannot erase existing event data.
export interface CommunityEventInput {
    title: string;
    event_type: CommunityEventType;
    event_date: string;
    start_time: string;
    end_time?: string | null;
    ends_next_day: boolean;
    event_timezone: string;
    venue?: string | null;
    city?: string | null;
    poster_url?: string | null;
    external_url?: string | null;
}

export function isSafeExternalUrl(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
        return false;
    }
}

export function validateCommunityEventPoster(file: Pick<File, 'type' | 'size'>): string | null {
    if (!(COMMUNITY_EVENT_POSTER_TYPES as readonly string[]).includes(file.type)) return 'Use a JPG, PNG, or WebP image for the poster.';
    if (file.size > COMMUNITY_EVENT_POSTER_MAX_BYTES) return 'Poster images must be 5 MB or smaller.';
    return null;
}

export function isValidEventTimezone(value: string): boolean {
    try {
        Intl.DateTimeFormat('en-US', { timeZone: value }).format();
        return true;
    } catch {
        return false;
    }
}

export function eventTimezoneLabel(timezone: string): string {
    return COMMUNITY_EVENT_TIMEZONES.find(([key]) => key === timezone)?.[1] || timezone;
}

// Times are wall-clock times at the venue. Do not construct a Date here: that
// would silently convert them into the viewer's local timezone.
export function formatEventTime(value: string | null): string {
    if (!value) return '';
    const [hours, minutes] = value.split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function cleanOptional(value?: string | null): string | null {
    const cleaned = value?.trim() || '';
    return cleaned || null;
}

function toEventPayload(input: CommunityEventInput) {
    return {
        title: input.title.trim(),
        event_type: input.event_type,
        event_date: input.event_date,
        start_time: input.start_time,
        ends_next_day: input.ends_next_day,
        event_timezone: input.event_timezone.trim(),
        venue: cleanOptional(input.venue),
        city: cleanOptional(input.city),
        poster_url: cleanOptional(input.poster_url),
        external_url: cleanOptional(input.external_url),
        end_time: cleanOptional(input.end_time),
    };
}

async function enrichEvents(events: CommunityEvent[]): Promise<CommunityEvent[]> {
    if (!events.length) return events;
    const authorIds = [...new Set(events.map(event => event.author_id).filter((id): id is string => Boolean(id)))];
    const [profiles, users] = await Promise.all([
        supabaseAuth.from('community_profiles').select('id, display_name, avatar_url, bio').in('id', authorIds),
        supabaseAuth.from('users').select('id, role').in('id', authorIds),
    ]);
    const profileMap = new Map((profiles.data || []).map((profile: any) => [profile.id, profile]));
    const roleMap = new Map((users.data || []).map((user: any) => [user.id, user.role]));
    return events.map(event => ({
        ...event,
        author: {
            id: event.author_id || 'former-community-member',
            display_name: event.author_id ? (profileMap.get(event.author_id)?.display_name || 'KFA Member') : 'Former Community Member',
            avatar_url: event.author_id ? (profileMap.get(event.author_id)?.avatar_url || null) : null,
            bio: event.author_id ? (profileMap.get(event.author_id)?.bio || null) : null,
            badge: event.author_id ? resolveUserBadge(roleMap.get(event.author_id)) : undefined,
        },
    }));
}

export async function getCommunityEvents(params: { past?: boolean; eventType?: string; city?: string } = {}): Promise<CommunityEvent[]> {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let query: any = supabaseAuth.from('community_events').select('*').eq('is_deleted', false);
    query = params.past ? query.lt('event_date', today).order('event_date', { ascending: false }) : query.gte('event_date', today).order('event_date', { ascending: true });
    query = query.order('start_time', { ascending: !params.past });
    if (params.eventType) query = query.eq('event_type', params.eventType);
    if (params.city) query = query.ilike('city', `%${params.city.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    return enrichEvents((data || []) as CommunityEvent[]);
}

export async function getUpcomingCommunityEventPreviews(limit = 3): Promise<CommunityEventPreview[]> {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const { data, error } = await supabaseAuth.from('community_events')
        .select('id,title,event_type,event_date,start_time,event_timezone,venue,city,poster_url')
        .eq('is_deleted', false)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(Math.min(Math.max(limit, 1), 3));
    if (error) throw error;
    return (data || []) as CommunityEventPreview[];
}

export async function getCommunityEvent(id: string): Promise<CommunityEvent | null> {
    const { data, error } = await supabaseAuth.from('community_events').select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return (await enrichEvents([data as CommunityEvent]))[0] || null;
}

export async function createCommunityEvent(input: CommunityEventInput, authorId: string) {
    if (input.external_url && !isSafeExternalUrl(input.external_url)) throw new Error('Use a valid HTTP or HTTPS event link.');
    if (!isValidEventTimezone(input.event_timezone)) throw new Error('Choose a valid event timezone.');
    const { data, error } = await supabaseAuth.from('community_events').insert({ ...toEventPayload(input), author_id: authorId }).select('id').single();
    if (error) throw error;
    return data.id as string;
}

export async function updateCommunityEvent(id: string, input: CommunityEventInput) {
    if (input.external_url && !isSafeExternalUrl(input.external_url)) throw new Error('Use a valid HTTP or HTTPS event link.');
    if (!isValidEventTimezone(input.event_timezone)) throw new Error('Choose a valid event timezone.');
    const { error } = await supabaseAuth.from('community_events').update(toEventPayload(input)).eq('id', id);
    if (error) throw error;
}

export async function removeCommunityEvent(id: string, reason?: string) {
    const { error } = await supabaseAuth.from('community_events').update({ is_deleted: true, deletion_reason: cleanOptional(reason) }).eq('id', id);
    if (error) throw error;
}

export async function uploadCommunityEventPoster(file: File, userId: string): Promise<string> {
    const validationError = validateCommunityEventPoster(file);
    if (validationError) throw new Error(validationError);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabaseAuth.storage.from('community-event-posters').upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    const { data } = supabaseAuth.storage.from('community-event-posters').getPublicUrl(path);
    return data.publicUrl;
}

export function eventTypeLabel(type: string): string {
    return COMMUNITY_EVENT_TYPES.find(([key]) => key === type)?.[1] || 'Music Event';
}
