'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, PlusCircle, RefreshCw } from 'lucide-react';
import CommunityNavbar from './CommunityNavbar';
import CommunityEventCard from './CommunityEventCard';
import { COMMUNITY_EVENT_TYPES, CommunityEvent, getCommunityEvents } from '../../lib/community-events';

export default function CommunityEventsView() {
    const [past, setPast] = useState(false);
    const [eventType, setEventType] = useState('');
    const [city, setCity] = useState('');
    const [events, setEvents] = useState<CommunityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const load = useCallback(async () => {
        setLoading(true); setError('');
        try { setEvents(await getCommunityEvents({ past, eventType: eventType || undefined, city: city || undefined })); }
        catch { setError('Events could not be loaded. Please try again.'); }
        finally { setLoading(false); }
    }, [past, eventType, city]);
    useEffect(() => { load(); }, [load]);
    return <div className="min-h-screen bg-[#faf8f5] dark:bg-[#120d09] text-slate-900 dark:text-slate-100"><CommunityNavbar />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-amber-700"><CalendarDays className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-widest">KFA Community</span></div><h1 className="mt-1 text-3xl font-black tracking-tight">Music Events</h1><p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Discover concerts, recitals, workshops, baithaks, and music gatherings shared by the community.</p></div><Link href="/community/events/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#a15912] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#8a4b0f]"><PlusCircle className="h-4 w-4" />Share an Event</Link></div>
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-900/10 bg-white p-3 dark:border-amber-500/15 dark:bg-[#1a140e] sm:flex-row sm:items-center"><div className="flex rounded-xl bg-amber-50 p-1 dark:bg-amber-950/30"><button onClick={() => setPast(false)} className={`rounded-lg px-3 py-2 text-xs font-bold ${!past ? 'bg-white text-amber-900 shadow-sm dark:bg-[#24170c] dark:text-amber-200' : 'text-slate-500'}`}>Upcoming</button><button onClick={() => setPast(true)} className={`rounded-lg px-3 py-2 text-xs font-bold ${past ? 'bg-white text-amber-900 shadow-sm dark:bg-[#24170c] dark:text-amber-200' : 'text-slate-500'}`}>Past Events</button></div><select aria-label="Filter by event type" value={eventType} onChange={e => setEventType(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-[#120d09]"><option value="">All categories</option>{COMMUNITY_EVENT_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input aria-label="Filter by city" value={city} onChange={e => setCity(e.target.value)} placeholder="Filter by city" maxLength={100} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-[#120d09]" /><button onClick={load} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 dark:text-amber-300"><RefreshCw className="h-3.5 w-3.5" />Refresh</button></div>
            {loading ? <div className="py-24 text-center text-sm font-semibold text-slate-500">Loading events…</div> : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div> : events.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{events.map(event => <CommunityEventCard key={event.id} event={event} />)}</div> : <div className="rounded-3xl border border-dashed border-amber-900/20 bg-white px-6 py-16 text-center dark:border-amber-500/20 dark:bg-[#1a140e]"><CalendarDays className="mx-auto h-10 w-10 text-amber-600" /><h2 className="mt-4 text-lg font-black">No {past ? 'past' : 'upcoming'} events yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">Be the first to share a relevant concert, workshop, recital, or music gathering.</p><Link href="/community/events/new" className="mt-5 inline-flex text-sm font-bold text-amber-800 hover:underline dark:text-amber-300">Share an Event</Link></div>}
        </main></div>;
}
