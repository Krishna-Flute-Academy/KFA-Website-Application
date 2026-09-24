import { Metadata } from 'next';
import GalleryClientPage from './GalleryClientPage';

export const metadata: Metadata = {
    title: 'Performance & Student Recital Gallery | Krishna Flute Academy',
    description: 'Watch classical Indian bansuri recitals, student performances, and masterclasses from Krishna Flute Academy.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/gallery',
    },
    openGraph: {
        title: 'Performance & Student Recital Gallery | Krishna Flute Academy',
        description: 'Watch classical Indian bansuri recitals, student performances, and masterclasses from Krishna Flute Academy.',
        url: 'https://www.krishnafluteacademy.com/gallery',
        siteName: 'Krishna Flute Academy',
        type: 'website',
        images: [
            {
                url: '/Toppic.jpg',
                width: 1200,
                height: 630,
                alt: 'Krishna Flute Academy Gallery',
            },
        ],
    },
};

export default function GalleryPage() {
    return <GalleryClientPage />;
}
