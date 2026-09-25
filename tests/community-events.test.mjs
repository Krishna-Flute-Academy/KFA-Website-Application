import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadEventsModule() {
    let source = await readFile(new URL('../src/lib/community-events.ts', import.meta.url), 'utf8');
    source = source
        .replace("from './supabase-auth'", "from 'data:text/javascript,export const supabaseAuth={}'")
        .replace("from './text-utils'", "from 'data:text/javascript,export const sanitizeHtml=(value)=>value;'")
        .replace("from './community'", "from 'data:text/javascript,export const resolveUserBadge=()=>\"Community Member\";'");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } });
    return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { COMMUNITY_EVENT_POSTER_TYPES, COMMUNITY_EVENT_TYPES, COMMUNITY_EVENT_TIMEZONES, eventTypeLabel, formatEventTime, isSafeExternalUrl, isValidEventTimezone, validateCommunityEventPoster } = await loadEventsModule();

test('Community Events exposes the expected music-focused categories', () => {
    assert.equal(COMMUNITY_EVENT_TYPES.length, 10);
    assert.equal(eventTypeLabel('flute_bansuri'), 'Flute / Bansuri');
    assert.equal(eventTypeLabel('unknown'), 'Music Event');
});

test('Community Events stores and displays venue-local IANA timezones without viewer conversion', () => {
    assert.equal(COMMUNITY_EVENT_TIMEZONES[0][0], 'Asia/Kolkata');
    assert.equal(isValidEventTimezone('Asia/Kolkata'), true);
    assert.equal(isValidEventTimezone('Not/A-Timezone'), false);
    assert.equal(formatEventTime('18:05:00'), '6:05 PM');
    assert.equal(formatEventTime('00:00:00'), '12:00 AM');
});

test('Community Events accepts only HTTP(S) external URLs', () => {
    assert.equal(isSafeExternalUrl('https://events.example.com/recital'), true);
    assert.equal(isSafeExternalUrl('http://localhost:3000/event'), true);
    assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
    assert.equal(isSafeExternalUrl('data:text/html,test'), false);
    assert.equal(isSafeExternalUrl('not a url'), false);
});

test('Community Event poster attachments use the same image and size rules for picker, drop, and clipboard files', () => {
    assert.deepEqual(COMMUNITY_EVENT_POSTER_TYPES, ['image/jpeg', 'image/png', 'image/webp']);
    assert.equal(validateCommunityEventPoster({ type: 'image/png', size: 5 * 1024 * 1024 }), null);
    assert.match(validateCommunityEventPoster({ type: 'image/gif', size: 100 }), /JPG, PNG, or WebP/);
    assert.match(validateCommunityEventPoster({ type: 'image/webp', size: 5 * 1024 * 1024 + 1 }), /5 MB/);
});

test('Community Event form supports deferred picker, drop, and image clipboard attachment without OCR', async () => {
    const source = await readFile(new URL('../src/components/community/CommunityEventForm.tsx', import.meta.url), 'utf8');
    assert.ok(source.includes('onPaste={onPaste}'));
    assert.ok(source.includes('onDrop={onDrop}'));
    assert.ok(source.includes("item.kind === 'file' && item.type.startsWith('image/')"));
    assert.ok(source.includes('validateCommunityEventPoster(file)'));
    assert.ok(source.includes('if (poster) posterUrl = await uploadCommunityEventPoster(poster, userId)'));
    assert.ok(source.includes('Replace'));
    assert.ok(source.includes('Remove'));
    assert.equal(/ocr|vision|analy[sz]e/i.test(source), false);
});

test('Community Event detail view preserves poster aspect ratio and supports a dismissible full view', async () => {
    const source = await readFile(new URL('../src/components/community/CommunityEventDetailView.tsx', import.meta.url), 'utf8');
    assert.ok(source.includes('object-contain'));
    assert.equal(source.includes('object-cover'), false);
    assert.ok(source.includes("e.key === 'Escape'"));
    assert.ok(source.includes('View full poster'));
    assert.ok(source.includes('md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]'));
    assert.ok(source.includes('About the Event'));
});

test('Community landing showcase uses a bounded, active upcoming-event query and uncropped posters', async () => {
    const [library, showcase, landing] = await Promise.all([
        readFile(new URL('../src/lib/community-events.ts', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/CommunityUpcomingEventsShowcase.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/CommunityClientView.tsx', import.meta.url), 'utf8'),
    ]);
    assert.ok(library.includes('getUpcomingCommunityEventPreviews(limit = 3)'));
    assert.ok(library.includes(".eq('is_deleted', false)"));
    assert.ok(library.includes(".limit(Math.min(Math.max(limit, 1), 3))"));
    assert.ok(showcase.includes('object-contain'));
    assert.equal(showcase.includes('object-cover'), false);
    assert.ok(showcase.includes('View All Events →'));
    assert.ok(showcase.includes('max-w-[320px]'));
    assert.ok(showcase.includes('h-[116px]'));
    assert.equal(showcase.includes('Explore all upcoming events →'), false);
    assert.ok(landing.includes('<CommunityUpcomingEventsShowcase currentUserId={currentUserId} />'));
});

test('Community Events migration includes ownership, moderation, and scoped poster security', async () => {
    const sql = await readFile(new URL('../supabase/migrations/20260925120000_create_community_events.sql', import.meta.url), 'utf8');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.community_events'));
    assert.ok(sql.includes('is_community_participant()'));
    assert.ok(sql.includes('enforce_community_event_update_rules()'));
    assert.ok(sql.includes('ON DELETE SET NULL'));
    assert.ok(sql.includes('ends_next_day BOOLEAN NOT NULL DEFAULT false'));
    assert.ok(sql.includes('Deletion attribution is audit data'));
    assert.ok(sql.includes("Admins may moderate or remove events, but cannot alter the author''s event details"));
    assert.ok(sql.includes("'community-event-posters'"));
    assert.ok(sql.includes("owner_id = (SELECT auth.uid()::text)"));
    assert.ok(sql.includes("lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')"));
});

test('Community Events forward migration preserves production objects while adding timezone support', async () => {
    const sql = await readFile(new URL('../supabase/migrations/20260925130000_community_events_final_design.sql', import.meta.url), 'utf8');
    assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS event_timezone TEXT'));
    assert.ok(sql.includes("SET event_timezone = 'Asia/Kolkata'"));
    assert.ok(sql.includes("ALTER COLUMN event_timezone SET DEFAULT 'Asia/Kolkata'"));
    assert.ok(sql.includes('community_events_valid_iana_timezone'));
    assert.ok(sql.includes('pg_catalog.pg_timezone_names'));
    assert.ok(sql.includes('NEW.ends_next_day IS DISTINCT FROM OLD.ends_next_day'));
    assert.ok(sql.includes('NEW.event_timezone IS DISTINCT FROM OLD.event_timezone'));
    assert.equal(/DROP\s+(TABLE|POLICY|TRIGGER|INDEX|BUCKET)/i.test(sql), false);
});

test('Community Events forward migration protects NULL-author historical event content from admins', async () => {
    const sql = await readFile(new URL('../supabase/migrations/20260925130000_community_events_final_design.sql', import.meta.url), 'utf8');
    assert.ok(sql.includes('(SELECT auth.uid()) IS DISTINCT FROM OLD.author_id AND v_is_admin AND v_content_changed'));
    assert.equal(sql.includes('(SELECT auth.uid()) <> OLD.author_id AND v_is_admin AND v_content_changed'), false);
});
