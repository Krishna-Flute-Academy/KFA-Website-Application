import { Suspense } from 'react';
import { Metadata } from 'next';
import { Blog } from '../../src/components/Blog';

// ISR: refresh blog list every 60 seconds so new posts appear automatically
export const revalidate = 60;


export const metadata: Metadata = {
    title: 'Blog | Krishna Flute Academy',
    description: 'Explore articles on Indian classical flute, music theory, Vedic scales, mindfulness, and musical wisdom from Guru Krishna Gopal Bhaumik.',
    openGraph: {
        title: 'Blog | Krishna Flute Academy',
        description: 'Explore articles on Indian classical flute, music theory, Vedic scales, mindfulness, and musical wisdom.',
        url: 'https://krishnafluteacademy.com/blog',
        siteName: 'Krishna Flute Academy',
        type: 'website',
        images: [
            {
                url: '/Toppic.jpg',
                width: 1200,
                height: 630,
                alt: 'Krishna Flute Academy Blog',
            },
        ],
    },
    alternates: {
        canonical: 'https://krishnafluteacademy.com/blog',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Blog | Krishna Flute Academy',
        description: 'Explore articles on Indian classical flute, music theory, Vedic scales, mindfulness, and musical wisdom.',
        images: ['/Toppic.jpg'],
    },
};

export default function BlogPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <Blog />
        </Suspense>
    );
}
