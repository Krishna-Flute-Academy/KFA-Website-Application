import { Metadata } from 'next';
import ClientTanpuraPage from './ClientTanpuraPage';

export const metadata: Metadata = {
    title: 'Tanpura Drone Online | Bansuri Sur Riyaz & Shruti | KFA',
    description: 'Practise with an authentic acoustic Tanpura drone. Features 12 Shruti pitches (Kali & Safed keys), Pa/Ma/Ni/Sa tuning modes, and fine cents adjustments.',
    alternates: {
        canonical: 'https://www.krishnafluteacademy.com/practice-tools/tanpura',
    },
    openGraph: {
        title: 'Tanpura Drone Online | Krishna Flute Academy',
        description: 'Authentic Indian classical Tanpura drone for vocal and Bansuri flute Riyaz.',
        url: 'https://www.krishnafluteacademy.com/practice-tools/tanpura',
        type: 'website',
    },
};

export default function TanpuraPage() {
    return <ClientTanpuraPage />;
}
