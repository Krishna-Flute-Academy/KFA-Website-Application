import { supabase } from '../../../src/lib/supabase';

// ISR: Vercel regenerates this page in the background every 60 seconds.
// Content changes in Supabase appear on the live site within ~1 minute.
export const revalidate = 60;
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ClientBlogPost from './ClientBlogPost';

type Props = {
    params: Promise<{ slug: string }>;
};

/**
 * Fetch a blog post by slug OR by UUID id.
 *
 * Uses two SEPARATE queries instead of .or() because Supabase's .or() filter
 * breaks silently when slug values contain special characters (double dashes,
 * long strings, etc.), returning null instead of the correct row.
 */
async function getPost(slugOrId: string) {
    const decoded = decodeURIComponent(slugOrId);

    // 1. Try to find by slug (most common case)
    const { data: bySlug } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', decoded)
        .maybeSingle();

    if (bySlug) return bySlug;

    // 2. If not found by slug, try by UUID id (legacy/fallback URLs)
    const { data: byId } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', decoded)
        .maybeSingle();

    return byId ?? null;
}

/**
 * STATIC PAGE GENERATION
 *
 * Fetches ALL posts and returns both their slugs AND their IDs as valid paths.
 * This ensures both /blog/my-slug/ and /blog/uuid/ work correctly.
 *
 * Returns a placeholder if Supabase is unreachable at build time, to prevent
 * the "missing param in generateStaticParams()" build crash.
 */
export async function generateStaticParams() {
    try {
        const { data: posts, error } = await supabase
            .from('blog_posts')
            .select('id, slug');

        if (error) {
            console.error('⚠️ generateStaticParams Supabase error:', error.message);
            return [{ slug: '_placeholder' }];
        }

        if (!posts || posts.length === 0) {
            return [{ slug: '_placeholder' }];
        }

        const params: { slug: string }[] = [];

        for (const post of posts) {
            // Always register the UUID path
            if (post.id) params.push({ slug: post.id });
            // Also register the human-readable slug path if it exists and differs
            if (post.slug && post.slug.trim() && post.slug !== post.id) {
                params.push({ slug: post.slug.trim() });
            }
        }

        console.log(`✅ generateStaticParams: Registering ${params.length} blog path(s).`);
        return params.length > 0 ? params : [{ slug: '_placeholder' }];
    } catch (err) {
        console.error('❌ generateStaticParams failed:', err);
        return [{ slug: '_placeholder' }];
    }
}

/**
 * METADATA — for WhatsApp / Social previews
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    if (slug === '_placeholder') return { title: 'Blog | Krishna Flute Academy' };

    const post = await getPost(slug);
    if (!post) return { title: 'Blog | Krishna Flute Academy' };

    return {
        title: `${post.title} | Krishna Flute Academy`,
        description: post.excerpt || 'Learn the art of Indian Flute.',
        alternates: {
            canonical: `https://krishnafluteacademy.com/blog/${post.slug || slug}`,
        },
        openGraph: {
            title: post.title,
            description: post.excerpt,
            url: `https://krishnafluteacademy.com/blog/${post.slug || slug}`,
            siteName: 'Krishna Flute Academy',
            type: 'article',
            images: post.featured_image ? [
                {
                    url: post.featured_image,
                    width: 1200,
                    height: 630,
                    alt: post.title,
                },
            ] : [],
        },
    };
}

/**
 * MAIN PAGE COMPONENT
 */
export default async function BlogPostPage({ params }: Props) {
    const { slug } = await params;

    if (!slug || slug === '_placeholder') return notFound();

    const post = await getPost(slug);

    if (!post) {
        console.warn(`⚠️ No post found for: [${slug}]`);
        return notFound();
    }

    return <ClientBlogPost post={post} />;
}