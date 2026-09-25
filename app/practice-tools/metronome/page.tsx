import { Metadata } from 'next';
import ClientMetronomePage from './ClientMetronomePage';

export const metadata: Metadata = {
    title: 'Flute Metronome Online | Bansuri Riyaz & Timing | KFA',
    description: 'Practise with a steady beat using our free online metronome. Features custom BPM, tap tempo, sound selection, and speed ramp modes for Bansuri students.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/practice-tools/metronome',
    },
    openGraph: {
        title: 'Flute Metronome Online | Krishna Flute Academy',
        description: 'High-precision Web Audio metronome with custom subdivisions and tempo ramp acceleration.',
        url: 'https://www.krishnafluteacademy.com/practice-tools/metronome',
        type: 'website',
    },
};

export default function MetronomePage() {
    return <ClientMetronomePage />;
}
