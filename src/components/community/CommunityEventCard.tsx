import Link from 'next/link';
import { CalendarDays, Clock3, MapPin, Music, UserRound } from 'lucide-react';
import { CommunityEvent, eventTypeLabel, eventTimezoneLabel, formatEventTime } from '../../lib/community-events';

function formatDate(value: string) {
    return new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CommunityEventCard({ event }: { event: CommunityEvent }) {
    return (
        <Link href={`/community/events/${event.id}`} className="group block overflow-hidden rounded-3xl border border-amber-900/10 dark:border-amber-500/15 bg-white dark:bg-[#1a140e] shadow-sm hover:shadow-lg transition-shadow">
            <div className="aspect-[16/8] bg-gradient-to-br from-amber-100 via-orange-50 to-stone-100 dark:from-amber-950/50 dark:via-[#21170d] dark:to-[#120d09] overflow-hidden">
                {event.poster_url ? <img src={event.poster_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <Music className="m-auto h-full w-14 text-amber-700/50" />}
            </div>
            <div className="p-5 space-y-3">
                <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-950/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-800 dark:text-amber-300">{eventTypeLabel(event.event_type)}</span>
                <h2 className="text-lg font-black leading-snug text-slate-900 dark:text-slate-100 group-hover:text-amber-800 dark:group-hover:text-amber-300">{event.title}</h2>
                <p className="line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{event.short_description}</p>
                <div className="space-y-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div className="flex gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-amber-700" />{formatDate(event.event_date)}</div>
                    <div className="flex gap-2"><Clock3 className="h-4 w-4 shrink-0 text-amber-700" />{formatEventTime(event.start_time)}{event.end_time ? ` – ${formatEventTime(event.end_time)}${event.ends_next_day ? ' (next day)' : ''}` : ''} · {eventTimezoneLabel(event.event_timezone)}</div>
                    <div className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-amber-700" />{event.venue}, {event.city}</div>
                    {event.performer_name && <div className="flex gap-2"><UserRound className="h-4 w-4 shrink-0 text-amber-700" />{event.performer_name}</div>}
                </div>
                <p className="border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400">Shared by {event.author?.display_name || 'KFA Member'}</p>
            </div>
        </Link>
    );
}
