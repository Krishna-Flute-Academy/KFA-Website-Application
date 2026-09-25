import { Metadata } from 'next';
import ClientPracticeToolsPage from './ClientPracticeToolsPage';

export const metadata: Metadata = {
    title: 'Bansuri Practice Tools | Tuner, Metronome & Riyaz Tools | KFA',
    description: 'Explore Bansuri practice tools from Krishna Flute Academy for pitch, rhythm, timing and listening. Use interactive tools to support focused Riyaz and flute learning.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/practice-tools',
    },
    openGraph: {
        title: 'Bansuri Practice Tools | Krishna Flute Academy',
        description: 'Interactive pitch detection, metronome, tanpura drone, rhythm sequencer, and live notation tools for Indian classical flute students.',
        url: 'https://www.krishnafluteacademy.com/practice-tools',
        siteName: 'Krishna Flute Academy',
        type: 'website',
        locale: 'en_IN',
        images: [
            {
                url: 'https://www.krishnafluteacademy.com/image.png',
                width: 800,
                height: 800,
                alt: 'Krishna Flute Academy Practice Lab',
            },
        ],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Bansuri Practice Tools | Krishna Flute Academy',
        description: 'Interactive pitch detection, metronome, tanpura drone, and rhythm tools for Bansuri Riyaz.',
        images: ['https://www.krishnafluteacademy.com/image.png'],
    },
};

export default function PracticeToolsPage() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'KFA Bansuri Practice Tools',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'INR',
        },
        description: 'Interactive Bansuri tuner, metronome, tanpura drone, tabla accompaniment, and sur notation tools for Indian classical flute students.',
        provider: {
            '@type': 'Organization',
            name: 'Krishna Flute Academy',
            url: 'https://www.krishnafluteacademy.com',
            logo: 'https://www.krishnafluteacademy.com/image.png',
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ClientPracticeToolsPage />
        </>
    );
}
