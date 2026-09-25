'use client';
import { use, useEffect, useState } from 'react';
import CommunityEventForm from '../../../../../src/components/community/CommunityEventForm';
import { CommunityEvent, getCommunityEvent } from '../../../../../src/lib/community-events';
export default function EditCommunityEventPage({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); const [event, setEvent] = useState<CommunityEvent | null>(null); useEffect(() => { getCommunityEvent(id).then(setEvent); }, [id]); return event ? <CommunityEventForm event={event} /> : <div className="min-h-screen flex items-center justify-center text-sm font-bold text-slate-500">Loading event…</div>; }
