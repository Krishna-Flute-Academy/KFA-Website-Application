import { MetadataRoute } from 'next';
import { supabase } from '../src/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.krishnafluteacademy.com';

  // Base static routes
  const routes = [
    '',
    '/courses',
    '/courses/beginner-bansuri',
    '/courses/intermediate-bansuri',
    '/courses/advanced-bansuri',
    '/courses/kids-bansuri',
    '/practice-tools',
    '/practice-tools/bansuri-tuner',
    '/practice-tools/metronome',
    '/practice-tools/tanpura',
    '/practice-tools/rhythm-machine',
    '/practice-tools/flute-to-notes',
    '/gallery',
    '/blog',
    '/community',
    '/login',
    '/signup',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : route.startsWith('/courses') || route.startsWith('/practice-tools') ? 0.9 : 0.8,
  }));

  let communityRoutes: any[] = [];
  try {
    // Dynamically import supabaseAuth to query public community discussions
    const { supabaseAuth } = await import('../src/lib/supabase-auth');
    const { data: communityPosts } = await supabaseAuth
      .from('community_posts')
      .select('slug, updated_at, created_at')
      .eq('visibility', 'public');

    if (communityPosts) {
      communityRoutes = communityPosts
        .filter((post: any) => !post.is_deleted)
        .map((post) => ({
          url: `${baseUrl}/community/discussion/${post.slug}`,
          lastModified: new Date(post.updated_at || post.created_at || new Date()),
          changeFrequency: 'weekly' as const,
          priority: 0.7,
        }));
    }
  } catch (error) {
    // Non-blocking
  }

  try {
    // Fetch all active blog posts
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, created_at')
      .eq('status', 'published');

    if (posts) {
      const postRoutes = posts.map((post) => ({
        url: `${baseUrl}/blog/${post.slug}`,
        lastModified: new Date(post.updated_at || post.created_at || new Date()),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }));
      return [...routes, ...postRoutes, ...communityRoutes];
    }
  } catch (error) {
    console.error('Error generating sitemap for blog posts:', error);
  }

  return [...routes, ...communityRoutes];
}
