import { Metadata } from 'next';
import ClientFluteToNotesPage from './ClientFluteToNotesPage';

export const metadata: Metadata = {
    title: 'Flute to Notes (Sur to Notation) | Bansuri Ear Training | KFA',
    description: 'Explore Flute to Notes (Sur to Notation) technology by Krishna Flute Academy. Live acoustic ear training and real-time Sargam transcription for Bansuri students.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/practice-tools/flute-to-notes',
    },
    openGraph: {
        title: 'Flute to Notes (Sur to Notation) | Krishna Flute Academy',
        description: 'Interactive acoustic ear training that transcribes live Indian classical Sargam notes as you play your flute.',
        url: 'https://www.krishnafluteacademy.com/practice-tools/flute-to-notes',
        type: 'website',
    },
};

export default function FluteToNotesPage() {
    return <ClientFluteToNotesPage />;
}
