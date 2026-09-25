import { Metadata } from 'next';
import ClientRhythmMachinePage from './ClientRhythmMachinePage';

export const metadata: Metadata = {
    title: 'Rhythm Machine & Tabla Loops for Bansuri | Krishna Flute Academy',
    description: 'Explore the KFA Rhythm Machine featuring authentic Hindustani classical Taals and step groove sequences to master Bansuri timing, coordination, and layakari.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/practice-tools/rhythm-machine',
    },
    openGraph: {
        title: 'Rhythm Machine & Tabla Riyaz Loops | Krishna Flute Academy',
        description: 'Interactive rhythm accompaniment and Hindustani Taal sequencer available to Krishna Flute Academy students.',
        url: 'https://www.krishnafluteacademy.com/practice-tools/rhythm-machine',
        type: 'website',
    },
};

export default function RhythmMachinePage() {
    return <ClientRhythmMachinePage />;
}
