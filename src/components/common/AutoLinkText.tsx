'use client';

import React from 'react';
import { parseTextWithLinks } from '../../lib/text-utils';

interface AutoLinkTextProps {
    text: string | null | undefined;
    className?: string;
    linkClassName?: string;
    preserveNewlines?: boolean;
}

/**
 * Renders plain text with automatically detected clickable URLs.
 * - Safely tokenizes text into React nodes (no innerHTML)
 * - Opens links in new tabs with target="_blank" and rel="noopener noreferrer"
 * - Supports YouTube, query parameters, trailing punctuation, and balanced parentheses
 * - Stops event propagation on click so parent cards/buttons aren't inadvertently triggered
 */
export default function AutoLinkText({
    text,
    className,
    linkClassName = 'text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 transition-colors break-words',
    preserveNewlines = false
}: AutoLinkTextProps) {
    if (!text || typeof text !== 'string') return null;

    const tokens = parseTextWithLinks(text);

    return (
        <span className={className}>
            {tokens.map((token, idx) => {
                if (token.type === 'link' && token.url) {
                    return (
                        <a
                            key={idx}
                            href={token.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={linkClassName}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {token.content}
                        </a>
                    );
                }
                if (token.type === 'break' && preserveNewlines) {
                    return <br key={idx} />;
                }
                return <React.Fragment key={idx}>{token.content}</React.Fragment>;
            })}
        </span>
    );
}
