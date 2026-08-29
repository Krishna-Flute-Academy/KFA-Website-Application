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

export interface TextToken {
    type: 'text' | 'link' | 'break';
    content: string;
    url?: string;
}

/**
 * Tokenizes plain text into text chunks, line breaks, and safe clickable URL links.
 * Handles trailing punctuation, balanced parentheses in URLs, and newlines safely.
 */
export function parseTextWithLinks(input: string | null | undefined): TextToken[] {
    if (!input || typeof input !== 'string') return [];

    const URL_REGEX = /(https?:\/\/[^\s<>"'`]+)/gi;
    const TRAILING_PUNCTUATION = /[.,!?:;'"\)\]}>]+$/;

    const tokens: TextToken[] = [];
    const lines = input.split('\n');

    lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) {
            tokens.push({ type: 'break', content: '\n' });
        }

        if (!line) return;

        let lastIndex = 0;
        let match: RegExpExecArray | null;
        const lineRegex = new RegExp(URL_REGEX.source, 'gi');

        while ((match = lineRegex.exec(line)) !== null) {
            const matchIndex = match.index;
            const rawUrl = match[0];

            // Add preceding plain text
            if (matchIndex > lastIndex) {
                tokens.push({
                    type: 'text',
                    content: line.slice(lastIndex, matchIndex)
                });
            }

            // Separate trailing punctuation that is not part of the URL
            let cleanUrl = rawUrl;
            let trailingPunct = '';

            const punctMatch = rawUrl.match(TRAILING_PUNCTUATION);
            if (punctMatch) {
                const punct = punctMatch[0];
                // Check for balanced parentheses: e.g. https://en.wikipedia.org/wiki/Flute_(instrument)
                const openParenCount = (rawUrl.match(/\(/g) || []).length;
                const closeParenCount = (rawUrl.match(/\)/g) || []).length;

                if (openParenCount === closeParenCount && punct === ')') {
                    cleanUrl = rawUrl;
                    trailingPunct = '';
                } else {
                    cleanUrl = rawUrl.slice(0, -punct.length);
                    trailingPunct = punct;
                }
            }

            // Validate URL protocol safety: only http:// and https:// allowed
            if (/^https?:\/\//i.test(cleanUrl)) {
                tokens.push({
                    type: 'link',
                    content: cleanUrl,
                    url: cleanUrl
                });
            } else {
                tokens.push({
                    type: 'text',
                    content: cleanUrl
                });
            }

            if (trailingPunct) {
                tokens.push({
                    type: 'text',
                    content: trailingPunct
                });
            }

            lastIndex = matchIndex + rawUrl.length;
        }

        // Add remaining text on the line
        if (lastIndex < line.length) {
            tokens.push({
                type: 'text',
                content: line.slice(lastIndex)
            });
        }
    });

    return tokens;
}

/**
 * Sanitizes rich HTML for safe rendering in formatted content containers.
 * Removes active script elements, object/embed tags, and event handlers.
 * Ensures existing <a> tags open in new tabs with safe attributes,
 * and auto-links plain URLs within HTML text nodes without creating nested anchors.
 */
export function sanitizeHtml(html: string | null | undefined): string {
    if (!html || typeof html !== 'string') return '';

    let clean = html;

    // 1. Remove script, iframe, object, embed, form, and applet tags and their contents
    clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '');
    clean = clean.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

    // 2. Remove event handlers (on* attributes like onclick, onerror, onload)
    clean = clean.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

    // 3. Remove javascript: and vbscript: URIs in href/src
    clean = clean.replace(/(href|src)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, '$1="#"');
    clean = clean.replace(/(href|src)\s*=\s*(?:'vbscript:[^']*'|"vbscript:[^"]*"|vbscript:[^\s>]+)/gi, '$1="#"');

    // 4. Enhance existing <a> tags: add target="_blank", rel="noopener noreferrer", and styling class if missing
    clean = clean.replace(/<a\b([^>]*)>/gi, (_, attrs) => {
        let updatedAttrs = attrs;
        if (!/target\s*=/i.test(updatedAttrs)) {
            updatedAttrs += ' target="_blank"';
        }
        if (!/rel\s*=/i.test(updatedAttrs)) {
            updatedAttrs += ' rel="noopener noreferrer"';
        }
        if (!/class\s*=/i.test(updatedAttrs)) {
            updatedAttrs += ' class="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 break-words"';
        }
        return `<a${updatedAttrs}>`;
    });

    // 5. Auto-link plain URLs in text outside of <a>, <pre>, <code> tags
    const TAG_REGEX = /(<\/?(?:a|pre|code)\b[^>]*>)|(<[^>]+>)/gi;
    let inExcludedTag = 0;
    let lastIndex = 0;
    let result = '';
    let match: RegExpExecArray | null;

    const linkPlainUrls = (chunk: string): string => {
        return chunk.replace(/(https?:\/\/[^\s<>"'`]+)/gi, (urlMatch) => {
            const punctMatch = urlMatch.match(/[.,!?:;'"\)\]}>]+$/);
            let finalUrl = urlMatch;
            let trailing = '';
            if (punctMatch) {
                const punct = punctMatch[0];
                const openCount = (urlMatch.match(/\(/g) || []).length;
                const closeCount = (urlMatch.match(/\)/g) || []).length;
                if (openCount === closeCount && punct === ')') {
                    finalUrl = urlMatch;
                } else {
                    finalUrl = urlMatch.slice(0, -punct.length);
                    trailing = punct;
                }
            }
            if (/^https?:\/\//i.test(finalUrl)) {
                return `<a href="${finalUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 break-words">${finalUrl}</a>${trailing}`;
            }
            return urlMatch;
        });
    };

    while ((match = TAG_REGEX.exec(clean)) !== null) {
        const textChunk = clean.slice(lastIndex, match.index);

        if (textChunk) {
            result += inExcludedTag === 0 ? linkPlainUrls(textChunk) : textChunk;
        }

        const fullTag = match[0];
        const specificTag = match[1];

        if (specificTag) {
            if (/^<(?:a|pre|code)\b/i.test(specificTag)) {
                inExcludedTag++;
            } else if (/^<\/(?:a|pre|code)>/i.test(specificTag)) {
                inExcludedTag = Math.max(0, inExcludedTag - 1);
            }
        }

        result += fullTag;
        lastIndex = match.index + fullTag.length;
    }

    if (lastIndex < clean.length) {
        const textChunk = clean.slice(lastIndex);
        result += inExcludedTag === 0 ? linkPlainUrls(textChunk) : textChunk;
    }

    return result;
}
