import { Metadata } from 'next';
import CommunityClientView from '../../src/components/community/CommunityClientView';

export const metadata: Metadata = {
    title: 'KFA Community | Learn • Discuss • Practice • Grow',
    description: 'A space for flute learners and music lovers to ask questions, share knowledge, discuss Indian classical music, and grow together.',
    openGraph: {
        title: 'KFA Community | Learn • Discuss • Practice • Grow',
        description: 'Ask flute questions, discuss raag concepts, share practice tips, and learn Indian classical bansuri with Krishna Flute Academy.',
        url: 'https://krishnafluteacademy.com/community',
        siteName: 'Krishna Flute Academy',
        type: 'website',
        images: [
            {
                url: '/Toppic.jpg',
                width: 1200,
                height: 630,
                alt: 'KFA Community Flute Forum',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'KFA Community | Learn • Discuss • Practice • Grow',
        description: 'Ask flute questions, discuss raag concepts, share practice tips, and learn Indian classical bansuri with Krishna Flute Academy.',
        images: ['/Toppic.jpg'],
    },
    alternates: {
        canonical: 'https://krishnafluteacademy.com/community',
    },
};

export default function CommunityPage() {
    return <CommunityClientView />;
}
