import { Metadata } from 'next';
import DiscussionDetailView from '../../../../src/components/community/DiscussionDetailView';
import { getCommunityPostBySlug } from '../../../../src/lib/community';
import { htmlToPlainText, truncatePlainText } from '../../../../src/lib/text-utils';

interface DiscussionPageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DiscussionPageProps): Promise<Metadata> {
    const { slug } = await params;
    const post = await getCommunityPostBySlug(slug, null);

    const canonicalUrl = `https://krishnafluteacademy.com/community/discussion/${slug}`;
    const ogImageUrl = `https://krishnafluteacademy.com/community/discussion/${slug}/opengraph-image`;

    if (!post) {
        return {
            title: 'Discussion | KFA Community',
            description: 'Flute and Indian classical music discussion on Krishna Flute Academy Community. Learn • Ask • Discuss • Grow.',
            alternates: {
                canonical: canonicalUrl,
            },
            openGraph: {
                title: 'Krishna Flute Academy Community',
                description: 'Learn • Ask • Discuss • Grow — Join the flute learning community.',
                url: canonicalUrl,
                siteName: 'Krishna Flute Academy Community',
                type: 'article',
                images: [
                    {
                        url: ogImageUrl,
                        width: 1200,
                        height: 630,
                        alt: 'Krishna Flute Academy Community',
                    },
                ],
            },
            twitter: {
                card: 'summary_large_image',
                title: 'Krishna Flute Academy Community',
                description: 'Learn • Ask • Discuss • Grow — Join the flute learning community.',
                images: [ogImageUrl],
            },
        };
    }

    const isPrivate = post.visibility !== 'public' || post.is_deleted;
    const plainContent = htmlToPlainText(post.content);
    const excerpt = truncatePlainText(plainContent, 160) || 'Flute and Indian classical music discussion on KFA Community.';

    return {
        title: `${post.title} | KFA Community`,
        description: excerpt,
        robots: isPrivate ? { index: false, follow: false } : { index: true, follow: true },
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: isPrivate
            ? undefined
            : {
                  title: `${post.title} | KFA Community`,
                  description: excerpt,
                  url: canonicalUrl,
                  siteName: 'Krishna Flute Academy Community',
                  type: 'article',
                  publishedTime: post.created_at,
                  modifiedTime: post.updated_at,
                  authors: post.author?.display_name ? [post.author.display_name] : undefined,
                  images: [
                      {
                          url: ogImageUrl,
                          width: 1200,
                          height: 630,
                          alt: post.title,
                      },
                  ],
              },
        twitter: isPrivate
            ? undefined
            : {
                  card: 'summary_large_image',
                  title: post.title,
                  description: excerpt,
                  images: [ogImageUrl],
              },
    };
}

export default async function DiscussionPage({ params }: DiscussionPageProps) {
    const { slug } = await params;
    return <DiscussionDetailView slug={slug} />;
}
