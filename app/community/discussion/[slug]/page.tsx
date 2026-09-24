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

    if (!post) {
        return {
            title: 'Discussion | KFA Community',
            description: 'Flute and music discussion on Krishna Flute Academy Community.',
        };
    }

    const isPrivate = post.visibility !== 'public';
    const excerpt = truncatePlainText(post.content, 150);

    return {
        title: `${post.title} | KFA Community`,
        description: excerpt || 'Flute and Indian classical music discussion on KFA Community.',
        robots: isPrivate ? { index: false, follow: false } : { index: true, follow: true },
        openGraph: isPrivate
            ? undefined
            : {
                  title: `${post.title} | KFA Community`,
                  description: excerpt,
                  url: `https://www.krishnafluteacademy.com/community/discussion/${slug}`,
                  siteName: 'Krishna Flute Academy Community',
                  type: 'article',
                  publishedTime: post.created_at,
                  modifiedTime: post.updated_at,
                  authors: post.author?.display_name ? [post.author.display_name] : undefined,
                  images: [
                      {
                          url: '/Toppic.jpg',
                          width: 1200,
                          height: 630,
                          alt: post.title,
                      },
                  ],
              },
        alternates: {
            canonical: `https://www.krishnafluteacademy.com/community/discussion/${slug}`,
        },
    };
}

export default async function DiscussionPage({ params }: DiscussionPageProps) {
    const { slug } = await params;
    return <DiscussionDetailView slug={slug} />;
}
