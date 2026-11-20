/**
 * KFA — End-to-End Verification: Makeup Student Live Class Access & Teacher Makeup Roster UI
 * Target: STAGING ONLY (hxpplzixfqhzmkhrjfba)
 * Confined strictly to synthetic identities (synth.makeup.*@kfa-synthetic.test) with full cleanup.
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
    REQUIRED_STAGING_HOST,
    assertStrictStagingUrl
} from '../../src/lib/production-guard';

const STAGING_URL = process.env.NEXT_PUBLIC_AUTH_SUPABASE_URL || `https://${REQUIRED_STAGING_HOST}`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4cHBseml4ZnFoem1raHJqZmJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTUxNTkxMiwiZXhwIjoyMTA3MDkxOTEyfQ.rCKV6Yc6xm8kARVt_yj7L9EVNjbpH58QD0bJYwlgXsg';

assertStrictStagingUrl(STAGING_URL, 'makeup-live-class-access.spec.ts init');

const adminClient = createClient(STAGING_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const RUN_ID = Date.now().toString();
const DOMAIN = 'kfa-synthetic.test';

function formatLocalDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const todayDate = new Date();
const TODAY_STR = formatLocalDate(todayDate);
const TODAY_DOW = todayDate.getDay();

const missedDate = new Date(todayDate);
missedDate.setDate(missedDate.getDate() - 3);
const MISSED_DATE_STR = formatLocalDate(missedDate);

const pastOverrideDate = new Date(todayDate);
pastOverrideDate.setDate(pastOverrideDate.getDate() - 21);
const PAST_OVERRIDE_STR = formatLocalDate(pastOverrideDate);

const pastMissedDate = new Date(todayDate);
pastMissedDate.setDate(pastMissedDate.getDate() - 25);
const PAST_MISSED_STR = formatLocalDate(pastMissedDate);

const MEETING_URL = `https://meet.google.com/kfa-test-${RUN_ID.slice(-4)}`;

const CREDS = {
    teacher: {
        email: `synth.teacher.mk.${RUN_ID}@${DOMAIN}`,
        password: `TeacherPass#${RUN_ID}`,
        name: `Synth Teacher ${RUN_ID}`,
        id: ''
    },
    studentMakeup: {
        email: `synth.student.mk.${RUN_ID}@${DOMAIN}`,
        password: `StudentPass#${RUN_ID}`,
        name: `Synth Makeup Student ${RUN_ID}`,
        id: ''
    },
    studentPast: {
        email: `synth.student.past.${RUN_ID}@${DOMAIN}`,
        password: `StudentPast#${RUN_ID}`,
        name: `Synth Past Student ${RUN_ID}`,
        id: ''
    }
};

let permRoomId = '';
let targetRoomId = '';
let todayOverrideId = '';
let pastOverrideId = '';

async function createSyntheticUser(email: string, password: string, name: string, role: 'teacher' | 'student', teacherId?: string) {
    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role, must_change_password: false }
    });
    if (authErr || !authData.user) {
        throw new Error(`Failed to create auth user ${email}: ${authErr?.message}`);
    }
    const uid = authData.user.id;
    const { error: profileErr } = await adminClient.from('users').upsert({
        id: uid,
        email,
        name,
        phone: '9876543210',
        profile_pic_url: 'https://example.com/avatar.png',
        role,
        status: 'active',
        level: 'beginner',
        teacher_id: teacherId || null,
        fees_basis: 'monthly',
        fees_amount: 1000,
        fees_classes_paid: 4,
        fees_collection_date: 28,
        join_date: PAST_MISSED_STR
    }, { onConflict: 'id' });
    if (profileErr) {
        throw new Error(`Failed to upsert user profile ${email}: ${profileErr.message}`);
    }
    return uid;
}

test.describe('Makeup Student Live Class Access & Teacher UI E2E', () => {
    test.setTimeout(120_000);

    test.beforeAll(async () => {
        CREDS.teacher.id = await createSyntheticUser(CREDS.teacher.email, CREDS.teacher.password, CREDS.teacher.name, 'teacher');
        CREDS.studentMakeup.id = await createSyntheticUser(CREDS.studentMakeup.email, CREDS.studentMakeup.password, CREDS.studentMakeup.name, 'student', CREDS.teacher.id);
        CREDS.studentPast.id = await createSyntheticUser(CREDS.studentPast.email, CREDS.studentPast.password, CREDS.studentPast.name, 'student', CREDS.teacher.id);

        // Create permanent classroom A (studentMakeup's regular room) and target classroom B (makeup room)
        const { data: roomA, error: errA } = await adminClient.from('classrooms').insert({
            name: `Synth Regular Room ${RUN_ID}`,
            type: 'permanent',
            status: 'active',
            teacher_id: CREDS.teacher.id,
            description: 'Synthetic regular room'
        }).select('id').single();
        if (errA || !roomA) throw new Error(`Failed to create Room A: ${errA?.message}`);
        permRoomId = roomA.id;

        const { data: roomB, error: errB } = await adminClient.from('classrooms').insert({
            name: `Synth Makeup Target Room ${RUN_ID}`,
            type: 'permanent',
            status: 'active',
            teacher_id: CREDS.teacher.id,
            description: 'Synthetic target makeup room'
        }).select('id').single();
        if (errB || !roomB) throw new Error(`Failed to create Room B: ${errB?.message}`);
        targetRoomId = roomB.id;

        // Add batch schedule on today's day of week for Room B
        await adminClient.from('batch_schedules').insert({
            classroom_id: targetRoomId,
            day_of_week: TODAY_DOW,
            start_time: '07:00',
            end_time: '08:00'
        });

        // Enroll studentMakeup permanently in Room A ONLY (NOT in Room B)
        await adminClient.from('classroom_students').insert({
            classroom_id: permRoomId,
            student_id: CREDS.studentMakeup.id
        });

        // Give studentMakeup a valid paid fee package so financial standing is GOOD_STANDING
        const { error: payErr } = await adminClient.from('fees_payments').insert({
            student_id: CREDS.studentMakeup.id,
            amount: 1000,
            classes_added: 4,
            payment_date: PAST_MISSED_STR,
            status: 'approved',
            payment_method: 'upi',
            notes: `Synthetic test payment ${RUN_ID}`
        });
        if (payErr) throw new Error(`Failed to insert synthetic payment: ${payErr.message}`);

        // Record an excused absence in Room A on MISSED_DATE_STR
        await adminClient.from('attendance').insert({
            student_id: CREDS.studentMakeup.id,
            classroom_id: permRoomId,
            date: MISSED_DATE_STR,
            status: 'excused',
            marked_by: CREDS.teacher.id
        });

        // Insert today's active makeup override in Room B for studentMakeup
        const { data: todayOv, error: todayOvErr } = await adminClient.from('session_student_overrides').insert({
            student_id: CREDS.studentMakeup.id,
            target_classroom_id: targetRoomId,
            original_classroom_id: permRoomId,
            override_date: TODAY_STR,
            missed_session_date: MISSED_DATE_STR,
            credit_treatment: 'makeup',
            booking_status: 'scheduled',
            reason: `[MissedDate:${MISSED_DATE_STR}] [MissedDate:${MISSED_DATE_STR}] Makeup for missed class`
        }).select('id').single();
        if (todayOvErr || !todayOv) throw new Error(`Failed to create today override: ${todayOvErr?.message}`);
        todayOverrideId = todayOv.id;

        // Insert a historical completed makeup override in Room B for studentPast
        const { data: pastOv, error: pastOvErr } = await adminClient.from('session_student_overrides').insert({
            student_id: CREDS.studentPast.id,
            target_classroom_id: targetRoomId,
            original_classroom_id: permRoomId,
            override_date: PAST_OVERRIDE_STR,
            missed_session_date: PAST_MISSED_STR,
            credit_treatment: 'makeup',
            booking_status: 'completed',
            reason: `[MissedDate:${PAST_MISSED_STR}] Historical completed makeup`
        }).select('id').single();
        if (pastOvErr || !pastOv) throw new Error(`Failed to create past override: ${pastOvErr?.message}`);
        pastOverrideId = pastOv.id;
    });

    test.afterAll(async () => {
        const userIds = [CREDS.studentMakeup.id, CREDS.studentPast.id, CREDS.teacher.id].filter(Boolean);
        const roomIds = [permRoomId, targetRoomId].filter(Boolean);

        if (userIds.length > 0) {
            await adminClient.from('notifications').delete().in('user_id', userIds);
            await adminClient.from('fees_payments').delete().in('student_id', userIds);
            await adminClient.from('attendance').delete().in('student_id', userIds);
            await adminClient.from('session_student_overrides').delete().in('student_id', userIds);
            await adminClient.from('classroom_students').delete().in('student_id', userIds);
        }
        if (roomIds.length > 0) {
            await adminClient.from('classroom_session_logs').delete().in('classroom_id', roomIds);
            await adminClient.from('batch_schedules').delete().in('classroom_id', roomIds);
            await adminClient.from('classrooms').delete().in('id', roomIds);
        }
        for (const uid of userIds) {
            await adminClient.from('users').delete().eq('id', uid);
            await adminClient.auth.admin.deleteUser(uid);
        }
    });

    test('Teacher sees Today & Upcoming vs Past History tabs, starts online class, makeup student gets notification & Join Class link, and teacher can remove makeup in one click', async ({ browser }) => {
        const teacherContext = await browser.newContext();
        const studentContext = await browser.newContext();
        const teacherPage = await teacherContext.newPage();
        const studentPage = await studentContext.newPage();
        studentPage.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                console.log(`[StudentConsole ${msg.type()}]`, msg.text());
            }
        });
        studentPage.on('response', res => {
            if (res.status() >= 300 && res.url().includes('supabase.co')) {
                console.log(`[StudentSupabase ${res.status()}]`, res.url());
            }
        });

        try {
            // 1. Log in as Teacher
            await teacherPage.goto('/login?type=teacher');
            await teacherPage.fill('input[type="email"]', CREDS.teacher.email);
            await teacherPage.fill('input[type="password"]', CREDS.teacher.password);
            await teacherPage.click('button[type="submit"]');
            await teacherPage.waitForURL(/teacher-dashboard/, { timeout: 30_000 });

            // 2. Open Target Makeup Room -> Students tab
            await teacherPage.goto(`/teacher-dashboard/classrooms/${targetRoomId}`);
            await teacherPage.waitForLoadState('networkidle');
            await teacherPage.getByRole('button', { name: 'Students', exact: true }).click();

            // Verify Today & Upcoming tab shows ONLY today's makeup student with TODAY badge and clean notes
            await expect(teacherPage.getByRole('button', { name: /Today & Upcoming/i })).toBeVisible({ timeout: 15_000 });
            await expect(teacherPage.getByText(CREDS.studentMakeup.name)).toBeVisible({ timeout: 15_000 });
            await expect(teacherPage.getByText('TODAY', { exact: true })).toBeVisible();
            // Historical past student must NOT clutter Today & Upcoming
            await expect(teacherPage.getByText(CREDS.studentPast.name)).toHaveCount(0);
            // Duplicate [MissedDate:...] tags must NOT be displayed
            await expect(teacherPage.getByText(/\[MissedDate:/)).toHaveCount(0);

            // Switch to Past History tab -> verify past completed record IS preserved there
            await teacherPage.getByRole('button', { name: /Past History/i }).click();
            await expect(teacherPage.getByText(CREDS.studentPast.name)).toBeVisible({ timeout: 10_000 });
            await expect(teacherPage.getByText('COMPLETED', { exact: true })).toBeVisible();
            // Switch back to Today & Upcoming
            await teacherPage.getByRole('button', { name: /Today & Upcoming/i }).click();
            await expect(teacherPage.getByText(CREDS.studentMakeup.name)).toBeVisible();

            // 3. Log in as Makeup Student in separate browser context
            await studentPage.goto('/login?type=student');
            await studentPage.waitForLoadState('networkidle');
            await studentPage.fill('input[type="email"]', CREDS.studentMakeup.email);
            await studentPage.fill('input[type="password"]', CREDS.studentMakeup.password);
            await studentPage.click('button[type="submit"]');
            await studentPage.waitForURL(/student-dashboard/, { timeout: 30_000 });
            await studentPage.waitForLoadState('networkidle');

            // Before class starts, no LIVE NOW banner
            await expect(studentPage.getByText('LIVE NOW')).toHaveCount(0);

            // 4. Teacher opens Meeting page for Target Makeup Room & starts online class with URL
            await teacherPage.goto(`/teacher-dashboard/classrooms/${targetRoomId}/meeting`);
            await teacherPage.waitForLoadState('networkidle');

            // Step 1: Select Online Video Class, enter meeting URL, continue
            await teacherPage.getByText('Online Video Class', { exact: false }).first().click();
            const urlInput = teacherPage.locator('input[type="url"], input[placeholder*="meet"], input[placeholder*="https://"]').first();
            await urlInput.fill(MEETING_URL);
            await teacherPage.getByRole('button', { name: /Continue to Attendance/i }).click();

            // Step 2: Verify makeup student appears in meeting attendance roster, mark present, start class
            await expect(teacherPage.getByText(CREDS.studentMakeup.name)).toBeVisible({ timeout: 15_000 });
            await teacherPage.getByRole('button', { name: /Mark All Present/i }).click();
            await teacherPage.getByRole('button', { name: /Save Attendance & Start Video Session/i }).click();

            // Wait until class goes live in DB
            await expect.poll(async () => {
                const { data } = await adminClient.from('classrooms').select('is_live, live_meeting_link').eq('id', targetRoomId).single();
                return data?.is_live && data?.live_meeting_link === MEETING_URL;
            }, { timeout: 20_000 }).toBeTruthy();

            // 5. Verify Makeup Student receives in-app notification in DB
            await expect.poll(async () => {
                const { data } = await adminClient
                    .from('notifications')
                    .select('id, title, type')
                    .eq('user_id', CREDS.studentMakeup.id)
                    .eq('type', 'live_class');
                return (data || []).length;
            }, { timeout: 15_000 }).toBeGreaterThan(0);

            // 6. Verify Makeup Student dashboard receives LIVE NOW banner + Join Class button
            // Wait briefly for Realtime; if Realtime WebSocket is delayed in headless test, reload to verify full dashboard hydration too
            const liveLocator = studentPage.getByText('LIVE NOW').first();
            const appearedRealtime = await liveLocator.isVisible().catch(() => false) ||
                await liveLocator.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
            console.log('[E2E] Appeared via Realtime without reload:', appearedRealtime);
            if (!appearedRealtime) {
                await studentPage.reload({ waitUntil: 'networkidle' });
            }
            await expect(studentPage.getByText('LIVE NOW').first()).toBeVisible({ timeout: 20_000 });
            await expect(studentPage.getByText(`Synth Makeup Target Room ${RUN_ID}`).first()).toBeVisible({ timeout: 10_000 });
            // Click the JOIN CLASS button in the active live modal (on top of the banner)
            const joinBtn = studentPage.getByRole('button', { name: /Join Class/i }).last();
            await expect(joinBtn).toBeVisible();

            // Verify clicking Join Class opens the exact meeting URL
            const [popupPage] = await Promise.all([
                studentContext.waitForEvent('page', { timeout: 10_000 }),
                joinBtn.click()
            ]);
            expect(popupPage.url()).toContain(`kfa-test-${RUN_ID.slice(-4)}`);
            await popupPage.close();

            // 7. End the live session cleanly
            await adminClient.from('classrooms').update({
                is_live: false,
                live_meeting_link: null,
                live_session_started_at: null
            }).eq('id', targetRoomId);

            // 8. Test one-click Remove on a scheduled makeup override
            const { data: removableOv, error: remErr } = await adminClient.from('session_student_overrides').insert({
                student_id: CREDS.studentPast.id,
                target_classroom_id: targetRoomId,
                original_classroom_id: permRoomId,
                override_date: TODAY_STR,
                missed_session_date: MISSED_DATE_STR,
                credit_treatment: 'makeup',
                booking_status: 'scheduled',
                reason: 'Mistakenly added makeup'
            }).select('id').single();
            if (remErr || !removableOv) throw new Error(`Failed to insert removable override: ${remErr?.message}`);

            await teacherPage.goto(`/teacher-dashboard/classrooms/${targetRoomId}`);
            await teacherPage.waitForLoadState('networkidle');
            await teacherPage.getByRole('button', { name: 'Students', exact: true }).click();

            const removableRow = teacherPage.locator('tr', { hasText: CREDS.studentPast.name });
            await expect(removableRow).toBeVisible({ timeout: 15_000 });

            teacherPage.once('dialog', dialog => dialog.accept());
            await removableRow.getByRole('button', { name: 'Remove' }).click();

            await expect(removableRow).toHaveCount(0, { timeout: 15_000 });

            // Verify row is actually deleted in DB
            const { data: checkDeleted } = await adminClient
                .from('session_student_overrides')
                .select('id')
                .eq('id', removableOv.id)
                .maybeSingle();
            expect(checkDeleted).toBeNull();
        } finally {
            await teacherContext.close();
            await studentContext.close();
        }
    });
});
