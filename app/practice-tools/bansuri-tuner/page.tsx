import { Metadata } from 'next';
import ClientTunerPage from './ClientTunerPage';

export const metadata: Metadata = {
    title: 'Bansuri Tuner Online | Flute Pitch & Sur Detector | KFA',
    description: 'Check pitch accuracy and Swara tuning with our free online Bansuri tuner. Supports Indian Sargam, chromatic modes, and all Indian flute keys.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/practice-tools/bansuri-tuner',
    },
    openGraph: {
        title: 'Bansuri Tuner Online | Krishna Flute Academy',
        description: 'Accurate real-time pitch and Sur detector designed specifically for Indian Bansuri flutes.',
        url: 'https://www.krishnafluteacademy.com/practice-tools/bansuri-tuner',
        type: 'website',
    },
};

export default function BansuriTunerPage() {
    return <ClientTunerPage />;
}
