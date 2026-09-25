import type { Metadata } from 'next';
import CommunityEventsView from '../../../src/components/community/CommunityEventsView';

export const metadata: Metadata = { title: 'Community Music Events | Krishna Flute Academy', description: 'Discover upcoming Indian classical music concerts, workshops, recitals, festivals, and bansuri events shared by the KFA Community.' };
export default function CommunityEventsPage() { return <CommunityEventsView />; }
