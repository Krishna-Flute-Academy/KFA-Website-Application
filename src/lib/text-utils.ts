/**
 * Global text and HTML utility functions for Krishna Flute Academy.
 * Safely strips HTML markup for preview contexts (notifications, toasts, cards, push alerts)
 * and provides safe sanitization for rich text display contexts.
 * Fully compatible with Next.js SSR (Node.js) and browser client rendering.
 */

/**
 * Converts rich HTML content into clean, readable plain text.
 * - Strips all HTML tags and editor attributes (e.g. data-path-to-node)
 * - Replaces structural line/block breaks with spaces to avoid concatenated words
 * - Decodes HTML entities (both named and numeric)
 * - Normalizes whitespace and trims
 */
export function htmlToPlainText(input: string | null | undefined): string {
    if (!input || typeof input !== 'string') return '';

    let text = input;

    // 1. Replace structural line/block breaks with a space separator to prevent word concatenation
    text = text.replace(/<\/(?:p|div|blockquote|h[1-6]|tr|table|section|article)>/gi, ' ');
    text = text.replace(/<li[^>]*>/gi, ' • ');
    text = text.replace(/<\/li>/gi, ' ');
    text = text.replace(/<br\s*[\/]?>/gi, ' ');
    text = text.replace(/<hr\s*[\/]?>/gi, ' ');

    // 2. Remove all remaining HTML tags and attributes
    text = text.replace(/<[^>]+>/g, '');

    // 3. Decode common and numeric HTML entities
    const entityMap: Record<string, string> = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&#x27;': "'",
        '&#x2f;': '/',
        '&#x2F;': '/',
        '&mdash;': '—',
        '&ndash;': '–',
        '&bull;': '•',
        '&hellip;': '...'
    };

    text = text.replace(/&(?:nbsp|amp|lt|gt|quot|apos|mdash|ndash|bull|hellip|#39|#x27|#x2[fF]);/gi, match => {
        return entityMap[match.toLowerCase()] || ' ';
    });

    // Handle general numeric entities &#123; and &#x123;
    text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)));
    text = text.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    // 4. Collapse repeated whitespace and trim
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Backward compatibility alias for htmlToPlainText
 */
export const stripHtml = htmlToPlainText;

/**
 * Truncates text safely to a maximum character length.
 * If the input contains HTML, it converts to plain text first before truncating.
 */
export function truncatePlainText(input: string | null | undefined, maxLength: number, ellipsis = '...'): string {
    const plain = htmlToPlainText(input);
    if (plain.length <= maxLength) return plain;
    return plain.slice(0, maxLength).trim() + ellipsis;
}

/**
 * Sanitizes rich HTML for safe rendering in formatted content containers.
 * Removes active script elements, object/embed tags, and event handlers.
 */
export function sanitizeHtml(html: string | null | undefined): string {
    if (!html || typeof html !== 'string') return '';

    let clean = html;

    // Remove script, iframe, object, embed, form, and applet tags and their contents
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    clean = clean.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

    // Remove event handlers (on* attributes like onclick, onerror, onload)
    clean = clean.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

    // Remove javascript: and vbscript: URIs in href/src
    clean = clean.replace(/(href|src)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, '$1="#"');
    clean = clean.replace(/(href|src)\s*=\s*(?:'vbscript:[^']*'|"vbscript:[^"]*"|vbscript:[^\s>]+)/gi, '$1="#"');

    return clean;
}
