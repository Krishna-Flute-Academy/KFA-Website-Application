/**
 * Utility functions to validate and format curriculum lesson media attachments and badges.
 * 
 * Ensures that VIDEO labels and durations are ONLY displayed when a lesson actually
 * has a valid uploaded/attached video or real video URL (e.g. YouTube, Vimeo, mp4).
 * If no media attachment exists, no media-type or duration badge is shown.
 */

export type DetectedMaterialType = 'youtube' | 'video' | 'pdf' | 'audio' | 'image' | 'link' | 'none';

export interface CurriculumMediaInfo {
    hasMedia: boolean;
    mediaType: 'video' | 'pdf' | 'audio' | 'image' | null;
    isVideo: boolean;
    isPdf: boolean;
    isAudio: boolean;
    isImage: boolean;
    videoDuration: string | null; // e.g. "08:45"
    badgeLabel: string | null;    // e.g. "VIDEO • 08:45", "VIDEO", "PDF", "AUDIO", or null
}

const cleanString = (val: unknown): string => {
    if (typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return '';
    return trimmed;
};

const isYouTubeOrVimeo = (url: string): boolean => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return (
        lower.includes('youtube.com') ||
        lower.includes('youtu.be') ||
        lower.includes('vimeo.com')
    );
};

const getUrlPath = (url: string): string => {
    try {
        return url.split('?')[0].split('#')[0].toLowerCase();
    } catch {
        return url.toLowerCase();
    }
};

/**
 * Validates and detects the true material type based on the actual URL/file path as the primary source of truth.
 * 
 * Rules:
 * - YouTube or Vimeo URL -> 'youtube'
 * - .mp4, .webm, .ogv, .mov, .m4v, .mkv -> 'video'
 * - .pdf -> 'pdf'
 * - .mp3, .wav, .m4a, .ogg, .aac, .flac -> 'audio'
 * - image extensions (.png, .jpg, .jpeg, .gif, .svg, .webp, .bmp, .ico) -> 'image'
 * - Valid webpage / reference URL (http://, https://) -> 'link'
 * - No valid URL -> 'none'
 * 
 * IMPORTANT: Never returns 'video' solely because declaredMaterialType === 'video'.
 * If declaredMaterialType is video but URL is not a video or YouTube stream, returns 'link'.
 */
export const detectMaterialType = (
    url: string | null | undefined,
    declaredMaterialType?: string | null
): DetectedMaterialType => {
    const rawUrl = cleanString(url);
    if (!rawUrl) return 'none';

    if (isYouTubeOrVimeo(rawUrl)) {
        return 'youtube';
    }

    const path = getUrlPath(rawUrl);

    if (/\.(mp4|webm|ogv|mov|m4v|mkv)$/i.test(path)) {
        return 'video';
    }
    if (/\.pdf$/i.test(path)) {
        return 'pdf';
    }
    if (/\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(path)) {
        return 'audio';
    }
    if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(path)) {
        return 'image';
    }

    const declared = cleanString(declaredMaterialType).toLowerCase();

    // If it's a web/reference URL (starts with http:// or https://)
    if (/^https?:\/\//i.test(rawUrl)) {
        if (declared === 'pdf' && rawUrl.toLowerCase().includes('.pdf')) {
            return 'pdf';
        }
        if (declared === 'audio' && (rawUrl.toLowerCase().includes('.mp3') || rawUrl.toLowerCase().includes('.wav'))) {
            return 'audio';
        }
        // If declared as video, but it's not a real video or YouTube URL, treat as reference link!
        return 'link';
    }

    // Fallback for non-http paths or relative storage names
    if (declared === 'pdf') return 'pdf';
    if (declared === 'audio') return 'audio';
    if (declared === 'image') return 'image';

    return 'link';
};

/**
 * Extracts a real video timestamp (e.g. "08:45", "12:30", "1:05:20") from a duration string.
 * Strictly ignores estimated times like "5 mins", "20 Mins", file sizes, or empty strings.
 */
export const extractVideoTimestamp = (durationVal: unknown): string | null => {
    const str = cleanString(durationVal);
    if (!str) return null;

    // Must match a timestamp like 08:45, 12:30, or 1:05:20
    const match = str.match(/(?:^|\s|[•·\-])\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:$|\s|[•·\-])/);
    if (match && match[1]) {
        return match[1].trim();
    }

    // Also check if the entire string is just the timestamp
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(str)) {
        return str;
    }

    return null;
};

/**
 * Inspects the curriculum lesson's actual attachment/content fields to determine
 * true media type, video status, and duration badge.
 */
export const getCurriculumMediaInfo = (lesson: any): CurriculumMediaInfo => {
    if (!lesson) {
        return {
            hasMedia: false,
            mediaType: null,
            isVideo: false,
            isPdf: false,
            isAudio: false,
            isImage: false,
            videoDuration: null,
            badgeLabel: null
        };
    }

    const materialUrl = cleanString(lesson.material_url);
    const linkUrl = cleanString(lesson.link_url);
    const rawType = cleanString(lesson.material_type).toLowerCase();
    const rawFileName = cleanString(lesson.file_name).toLowerCase();

    // Check material_url first, then link_url
    const detectedFromMaterial = materialUrl ? detectMaterialType(materialUrl, rawType) : 'none';
    const detectedFromLink = linkUrl ? detectMaterialType(linkUrl, rawType) : 'none';

    // Also check rawFileName if file_name has extension
    let detectedFromFileName: DetectedMaterialType = 'none';
    if (rawFileName) {
        if (/\.(mp4|webm|mov|m4v|ogv|mkv)$/i.test(rawFileName)) detectedFromFileName = 'video';
        else if (/\.pdf$/i.test(rawFileName)) detectedFromFileName = 'pdf';
        else if (/\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(rawFileName)) detectedFromFileName = 'audio';
        else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(rawFileName)) detectedFromFileName = 'image';
    }

    let isVideo = false;
    let isPdf = false;
    let isAudio = false;
    let isImage = false;

    // Real video exists only if YouTube/Vimeo or actual video file exists
    if (detectedFromMaterial === 'video' || detectedFromMaterial === 'youtube' ||
        detectedFromLink === 'video' || detectedFromLink === 'youtube' ||
        (materialUrl && detectedFromFileName === 'video')) {
        isVideo = true;
    } else if (detectedFromMaterial === 'pdf' || (materialUrl && detectedFromFileName === 'pdf') || detectedFromLink === 'pdf') {
        isPdf = true;
    } else if (detectedFromMaterial === 'audio' || (materialUrl && detectedFromFileName === 'audio') || detectedFromLink === 'audio') {
        isAudio = true;
    } else if (detectedFromMaterial === 'image' || (materialUrl && detectedFromFileName === 'image') || detectedFromLink === 'image') {
        isImage = true;
    }

    const hasMedia = isVideo || isPdf || isAudio || isImage;
    const mediaType: 'video' | 'pdf' | 'audio' | 'image' | null = isVideo 
        ? 'video' 
        : isPdf 
        ? 'pdf' 
        : isAudio 
        ? 'audio' 
        : isImage 
        ? 'image' 
        : null;

    // Only extract video duration if a real video exists
    const videoDuration = isVideo ? extractVideoTimestamp(lesson.duration) : null;

    let badgeLabel: string | null = null;
    if (isVideo) {
        badgeLabel = videoDuration ? `VIDEO • ${videoDuration}` : 'VIDEO';
    } else if (isPdf) {
        badgeLabel = 'PDF';
    } else if (isAudio) {
        badgeLabel = 'AUDIO';
    } else if (isImage) {
        badgeLabel = 'IMAGE';
    }

    return {
        hasMedia,
        mediaType,
        isVideo,
        isPdf,
        isAudio,
        isImage,
        videoDuration,
        badgeLabel
    };
};

/**
 * Returns the formatted display line for curriculum lesson cards.
 * E.g.
 * - No media: "Easy"
 * - PDF: "PDF • Easy"
 * - Real Video with duration: "VIDEO • 08:45 • Easy"
 * - Real Video without duration: "VIDEO • Easy"
 */
export const formatCurriculumSubtitle = (lesson: any): string => {
    const info = getCurriculumMediaInfo(lesson);
    const difficulty = cleanString(lesson?.difficulty) || 'Easy';

    if (info.badgeLabel) {
        return `${info.badgeLabel} • ${difficulty}`;
    }
    return difficulty;
};
