import { Suspense } from 'react';
import { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '../src/lib/supabase';
import { PageClient } from './PageClient';

// Enable Incremental Static Regeneration (ISR) to cache the database results at the edge for 60 seconds
export const revalidate = 60;

export default async function Page() {
    // Server-Side Data Fetching (Parallel)
    const [
        { data: posts },
        { data: eventData },
        { data: reviews },
        { data: gallery }
    ] = await Promise.all([
        supabase.from('blog_posts').select('*').eq('published', true).order('published_at', { ascending: false }).limit(3),
        supabase.from('events').select('title, registration_link, image_url, button_text, description').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('testimonials').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('gallery_items').select('*').eq('is_active', true).order('created_at', { ascending: false })
    ]);

    // Sanitize data (similar to client side logic)
    const validPosts = posts?.filter((p: any) => p && typeof p === 'object' && p.title && p.id) || [];
    const validReviews = reviews?.filter((r: any) => r && typeof r === 'object' && r.name && (r.content || r.message)) || [];
    const validGallery = gallery?.filter((g: any) => g && typeof g === 'object' && g.url) || [];

    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
            <PageClient 
                initialPosts={validPosts}
                initialEvent={eventData || null}
                initialTestimonials={validReviews}
                initialGallery={validGallery}
            />
        </Suspense>
    );
}
