import { MetadataRoute } from 'next';
import { supabase } from '../src/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.krishnafluteacademy.com';

  // Base static routes
  const routes = [
    '',
    '/blog',
    '/login',
    '/signup',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

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
      return [...routes, ...postRoutes];
    }
  } catch (error) {
    console.error('Error generating sitemap for blog posts:', error);
  }

  return routes;
}
