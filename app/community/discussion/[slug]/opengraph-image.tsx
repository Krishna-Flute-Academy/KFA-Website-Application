import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';
import { getCommunityPostBySlug } from '../../../../src/lib/community';
import { htmlToPlainText, truncatePlainText } from '../../../../src/lib/text-utils';

export const runtime = 'nodejs';
export const alt = 'KFA Community Discussion';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

// Read local KFA emblem logo once as base64 data URI (synchronously cached in module scope)
let cachedLogoDataUri: string | null = null;
function getLogoDataUri(): string | null {
    if (cachedLogoDataUri) return cachedLogoDataUri;
    try {
        const logoPath = path.join(process.cwd(), 'public', 'image.png');
        if (fs.existsSync(logoPath)) {
            const buf = fs.readFileSync(logoPath);
            cachedLogoDataUri = `data:image/png;base64,${buf.toString('base64')}`;
            return cachedLogoDataUri;
        }
    } catch {
        // Fallback to null if file cannot be read
    }
    return null;
}

function formatTitle(raw: string, maxLen = 150): string {
    const trimmed = (raw || '').trim().replace(/\s+/g, ' ');
    if (trimmed.length <= maxLen) return trimmed;
    const sub = trimmed.slice(0, maxLen);
    const lastSpace = sub.lastIndexOf(' ');
    return (lastSpace > 100 ? sub.slice(0, lastSpace) : sub) + '…';
}

export default async function OpenGraphImage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    let post = null;

    try {
        post = await getCommunityPostBySlug(slug, null);
    } catch (err) {
        console.error('[OpenGraphImage] Error fetching post:', err);
    }

    const logoDataUri = getLogoDataUri();

    // Check if post exists and is public
    const isPublic = post && post.visibility === 'public' && !post.is_deleted;

    const displayTitle = isPublic && post?.title
        ? formatTitle(post.title)
        : 'Krishna Flute Academy Community';

    const categoryName = isPublic && post?.category?.name
        ? post.category.name.toUpperCase()
        : 'KFA COMMUNITY';

    const postType = isPublic && post?.post_type === 'question' ? 'question' : 'discussion';

    const titleLength = displayTitle.length;
    let titleFontSize = 48;
    if (titleLength > 115) {
        titleFontSize = 32;
    } else if (titleLength > 75) {
        titleFontSize = 38;
    } else if (titleLength > 45) {
        titleFontSize = 43;
    }

    // Excerpt display: only show when title is concise enough to avoid clutter
    let displayExcerpt = '';
    if (isPublic && post?.content && titleLength <= 80) {
        const plain = htmlToPlainText(post.content);
        displayExcerpt = truncatePlainText(plain, 105);
    } else if (!isPublic) {
        displayExcerpt = 'Learn • Ask • Discuss • Grow';
    }

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    backgroundColor: '#FAF6F0',
                    padding: '52px 64px 44px 64px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Top Gold/Terracotta Accent Bar */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 6,
                        background: 'linear-gradient(90deg, #9A3412 0%, #D97706 35%, #F59E0B 50%, #D97706 65%, #9A3412 100%)',
                    }}
                />

                {/* Subtle Inner Framing Border */}
                <div
                    style={{
                        position: 'absolute',
                        top: 20,
                        left: 20,
                        right: 20,
                        bottom: 20,
                        border: '1px solid #E6DCD0',
                        borderRadius: 20,
                    }}
                />

                {/* Subtle Bansuri & Indian Classical Motif in background */}
                <div
                    style={{
                        position: 'absolute',
                        right: 50,
                        bottom: 85,
                        display: 'flex',
                        opacity: 0.08,
                    }}
                >
                    <svg width="460" height="70" viewBox="0 0 460 70" fill="none">
                        {/* Swara resonance waves */}
                        <path d="M10 35 Q 70 8, 130 35 T 250 35 T 370 35 T 440 35" stroke="#9A3412" strokeWidth="2" fill="none" />
                        <path d="M10 35 Q 70 62, 130 35 T 250 35 T 370 35 T 440 35" stroke="#9A3412" strokeWidth="2" fill="none" />
                        {/* Bamboo Bansuri Body */}
                        <rect x="25" y="27" width="410" height="16" rx="8" fill="#9A3412" />
                        {/* Silk Thread Bindings */}
                        <rect x="45" y="24" width="8" height="22" rx="2" fill="#D97706" />
                        <rect x="57" y="24" width="5" height="22" rx="2" fill="#9A3412" />
                        <rect x="110" y="24" width="6" height="22" rx="2" fill="#D97706" />
                        <rect x="410" y="24" width="8" height="22" rx="2" fill="#D97706" />
                        {/* Embouchure & Tone Holes */}
                        <circle cx="85" cy="35" r="4.5" fill="#FAF6F0" />
                        <circle cx="160" cy="35" r="3.8" fill="#FAF6F0" />
                        <circle cx="200" cy="35" r="3.8" fill="#FAF6F0" />
                        <circle cx="240" cy="35" r="3.8" fill="#FAF6F0" />
                        <circle cx="290" cy="35" r="3.8" fill="#FAF6F0" />
                        <circle cx="330" cy="35" r="3.8" fill="#FAF6F0" />
                        <circle cx="370" cy="35" r="3.8" fill="#FAF6F0" />
                    </svg>
                </div>

                {/* Top Branding Area */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                    }}
                >
                    {/* Brand Logo & Title */}
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        {logoDataUri ? (
                            <img
                                src={logoDataUri}
                                width={54}
                                height={54}
                                style={{ width: 54, height: 54, objectFit: 'contain', borderRadius: 10 }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: 54,
                                    height: 54,
                                    borderRadius: 10,
                                    backgroundColor: '#78350F',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#FDE68A',
                                    fontWeight: 800,
                                    fontSize: 22,
                                }}
                            >
                                KFA
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span
                                style={{
                                    fontSize: 19,
                                    fontWeight: 800,
                                    color: '#381E11',
                                    letterSpacing: '0.04em',
                                    lineHeight: 1.15,
                                }}
                            >
                                KRISHNA FLUTE ACADEMY
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: '#9A3412',
                                        letterSpacing: '0.14em',
                                    }}
                                >
                                    COMMUNITY
                                </span>
                                {isPublic && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontSize: 11, color: '#C2410C' }}>•</span>
                                        <span
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: '#78350F',
                                                letterSpacing: '0.04em',
                                            }}
                                        >
                                            {postType === 'question' ? 'QUESTION' : 'DISCUSSION'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Category Badge */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#FEF3C7',
                            border: '1.5px solid #FDE68A',
                            borderRadius: 9999,
                            padding: '8px 22px',
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: '#92400E',
                                letterSpacing: '0.08em',
                            }}
                        >
                            {categoryName}
                        </span>
                    </div>
                </div>

                {/* Main Content Area */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        flex: 1,
                        marginTop: 22,
                        marginBottom: 20,
                        paddingRight: 40,
                    }}
                >
                    {/* Small topic type label */}
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#B45309',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {postType === 'question' ? 'Community Question' : 'Community Discussion'}
                        </span>
                    </div>

                    {/* Large Discussion Title */}
                    <div
                        style={{
                            fontSize: titleFontSize,
                            fontWeight: 800,
                            color: '#0F172A',
                            lineHeight: 1.22,
                            letterSpacing: '-0.02em',
                            display: 'flex',
                            flexWrap: 'wrap',
                        }}
                    >
                        {displayTitle}
                    </div>

                    {/* Optional Excerpt */}
                    {displayExcerpt ? (
                        <div
                            style={{
                                marginTop: 14,
                                fontSize: 18,
                                lineHeight: 1.45,
                                color: '#475569',
                                display: 'flex',
                                maxWidth: 960,
                            }}
                        >
                            {displayExcerpt}
                        </div>
                    ) : null}
                </div>

                {/* Bottom Footer Area */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        borderTop: '1px solid #E6DCD0',
                        paddingTop: 18,
                    }}
                >
                    {/* Left: Domain Branding */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: '#78350F',
                                letterSpacing: '0.02em',
                            }}
                        >
                            krishnafluteacademy.com
                        </span>
                        <span style={{ fontSize: 13, color: '#B45309' }}>/</span>
                        <span
                            style={{
                                fontSize: 14,
                                fontWeight: 500,
                                color: '#9A3412',
                            }}
                        >
                            community
                        </span>
                    </div>

                    {/* Right: Call to action pill */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            backgroundColor: '#9A3412',
                            borderRadius: 9999,
                            padding: '10px 24px',
                        }}
                    >
                        <span
                            style={{
                                fontSize: 15,
                                fontWeight: 700,
                                color: '#FFFFFF',
                                letterSpacing: '0.02em',
                            }}
                        >
                            Join the Discussion →
                        </span>
                    </div>
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
