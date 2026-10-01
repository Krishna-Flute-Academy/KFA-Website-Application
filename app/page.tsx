import { Suspense } from 'react';
import { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '../src/lib/supabase';
import { PageClient } from './PageClient';

// Enable Incremental Static Regeneration (ISR) to cache the database results at the edge for 60 seconds
export const revalidate = 60;

export const metadata: Metadata = {
    title: 'Krishna Flute Academy | Learn Indian Classical Bansuri',
    description: 'Learn Indian classical bansuri with Krishna Gopal Bhaumik at Krishna Flute Academy. Structured flute lessons, courses, practice tools and a growing music community.',
    alternates: {
        canonical: 'https://krishnafluteacademy.com/',
    },
    openGraph: {
        title: 'Krishna Flute Academy | Learn Indian Classical Bansuri',
        description: 'Learn Indian classical bansuri with Krishna Gopal Bhaumik at Krishna Flute Academy. Structured flute lessons, courses, practice tools and a growing music community.',
        url: 'https://krishnafluteacademy.com/',
        siteName: 'Krishna Flute Academy',
        type: 'website',
        locale: 'en_US',
        images: [
            {
                url: '/og-image.jpg',
                width: 1200,
                height: 630,
                alt: 'Krishna Flute Academy | Learn Indian Classical Bansuri',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Krishna Flute Academy | Learn Indian Classical Bansuri',
        description: 'Learn Indian classical bansuri with Krishna Gopal Bhaumik at Krishna Flute Academy. Structured flute lessons, courses, practice tools and a growing music community.',
        images: ['/og-image.jpg'],
    },
};

const homepageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MusicSchool',
    '@id': 'https://krishnafluteacademy.com/#organization',
    name: 'Krishna Flute Academy',
    alternateName: ['KFA', 'Krishna Flute Academy Bangalore'],
    url: 'https://krishnafluteacademy.com',
    logo: 'https://krishnafluteacademy.com/image.png',
    image: 'https://krishnafluteacademy.com/og-image.jpg',
    description: 'Learn Indian classical bansuri with Krishna Gopal Bhaumik at Krishna Flute Academy. Structured flute lessons, courses, practice tools and a growing music community.',
    founder: {
        '@type': 'Person',
        name: 'Krishna Gopal Bhaumik',
        jobTitle: 'Founder & Bansuri Guru',
    },
    telephone: '+919836952545',
    email: 'kgbhaumik86@gmail.com',
    address: {
        '@type': 'PostalAddress',
        streetAddress: 'Electronic City Phase 1',
        addressLocality: 'Bangalore',
        addressRegion: 'Karnataka',
        postalCode: '560100',
        addressCountry: 'IN',
    },
    sameAs: [
        'https://www.facebook.com/krishnafluteacademy/',
        'https://www.instagram.com/krishnafluteacademy',
        'https://www.youtube.com/@krishnafluteacademy',
        'https://maps.app.goo.gl/Xumte2BGx8FwLijg8',
    ],
};

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
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd) }}
            />
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}>
                <PageClient 
                    initialPosts={validPosts}
                    initialEvent={eventData || null}
                    initialTestimonials={validReviews}
                    initialGallery={validGallery}
                />
            </Suspense>
        </>
    );
}
