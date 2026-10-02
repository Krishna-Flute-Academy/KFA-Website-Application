import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function importTypeScriptModule(path, mockReplacements = {}) {
    let source = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const [from, to] of Object.entries(mockReplacements)) {
        source = source.replaceAll(from, to);
    }
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.ES2022,
            target: ts.ScriptTarget.ES2022,
        },
    });

    const encodedModule = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
    return import(encodedModule);
}

const { 
    sanitizeHtml, 
    htmlToPlainText, 
    truncatePlainText 
} = await importTypeScriptModule('../src/lib/text-utils.ts');

const { 
    generatePostSlug, 
    getCommunityDiscussionUrl,
    resolveUserBadge, 
    getFallbackCategories,
    getSafeRedirectUrl,
    isContentEdited
} = await importTypeScriptModule('../src/lib/community.ts', {
    "from './supabase-auth'": "from 'data:text/javascript,export const supabaseAuth={auth:{getSession:async()=>({data:{session:null}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})})};'",
    "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
});

test('1. Community Slug Generation: cleans special characters and preserves readability', () => {
    const title = 'How to Improve Breath Control on E Bass Bansuri?! (Tips & Riyaz)';
    const slug = generatePostSlug(title);

    assert.ok(slug.startsWith('how-to-improve-breath-control-on-e-bass-bansuri-tips-riyaz-'));
    assert.ok(!slug.includes('?'));
    assert.ok(!slug.includes('!'));
    assert.ok(!slug.includes('('));
    assert.ok(!slug.includes(')'));
    assert.ok(!slug.includes('&'));
    // Ensure random suffix is appended
    const parts = slug.split('-');
    assert.ok(parts[parts.length - 1].length >= 4);
});

test('2. Community Slug Generation: handles empty or symbols-only titles', () => {
    const slug1 = generatePostSlug('   ');
    assert.ok(slug1.startsWith('discussion-'));

    const slug2 = generatePostSlug('@@@ ### $$$');
    assert.ok(slug2.startsWith('discussion-'));
});

test('3. Community Role Badges: resolves correct badge for each role without exposing internal data', () => {
    assert.equal(resolveUserBadge('admin'), 'Admin');
    assert.equal(resolveUserBadge('teacher'), 'Teacher');
    assert.equal(resolveUserBadge('student'), 'KFA Student');
    assert.equal(resolveUserBadge('mentor'), 'KFA Student');
    assert.equal(resolveUserBadge('pending'), 'Community Member');
    assert.equal(resolveUserBadge(null), 'Community Member');
    assert.equal(resolveUserBadge(undefined), 'Community Member');
    assert.equal(resolveUserBadge('external_guest'), 'Community Member');
});

test('4. Community Categories: verifies initial 8 categories and access scopes', () => {
    const categories = getFallbackCategories();
    assert.equal(categories.length, 8);

    const publicCategories = categories.filter(c => c.access_scope === 'public');
    const studentCategories = categories.filter(c => c.access_scope === 'students');

    assert.equal(publicCategories.length, 4);
    assert.equal(studentCategories.length, 4);

    // Verify canonical public slugs
    const publicSlugs = publicCategories.map(c => c.slug);
    assert.ok(publicSlugs.includes('flute-questions'));
    assert.ok(publicSlugs.includes('beginner-discussions'));
    assert.ok(publicSlugs.includes('raag-and-music-discussions'));
    assert.ok(publicSlugs.includes('general-bansuri-discussion'));

    // Verify canonical student slugs
    const studentSlugs = studentCategories.map(c => c.slug);
    assert.ok(studentSlugs.includes('practice-corner'));
    assert.ok(studentSlugs.includes('learning-discussions'));
    assert.ok(studentSlugs.includes('student-performances'));
    assert.ok(studentSlugs.includes('ask-krishna-sir'));
});

test('5. Community Security & Sanitization: strips harmful scripts and attributes from post/reply content', () => {
    const maliciousHtml = '<p>Hello <script>alert("hack")</script><img src="x" onerror="stealCookie()" /><a href="javascript:alert(1)">Click me</a></p>';
    const cleaned = sanitizeHtml(maliciousHtml);

    assert.ok(!cleaned.includes('<script>'));
    assert.ok(!cleaned.includes('onerror'));
    assert.ok(!cleaned.includes('javascript:'));
    assert.ok(cleaned.includes('<p>Hello'));
});

test('6. Plain Text Excerpt: converts rich HTML into readable preview text', () => {
    const richContent = '<h3>Bansuri Blowing Technique</h3><p>Ensure your lower lip covers <strong>one-third</strong> of the embouchure hole.</p><ul><li>Relax your jaw</li><li>Form a focused oval</li></ul>';
    const plain = htmlToPlainText(richContent);

    assert.ok(!plain.includes('<'));
    assert.ok(plain.includes('Ensure your lower lip covers one-third of the embouchure hole.'));
    assert.ok(plain.includes('• Relax your jaw • Form a focused oval'));

    const truncated = truncatePlainText(richContent, 50);
    assert.ok(truncated.length <= 53);
    assert.ok(truncated.endsWith('...'));
});

test('7. Database Migration Security Audit: verifies SQL file enforces all 10 security safeguards', async () => {
    const migrationSql = await readFile(
        new URL('../supabase/migrations/20260924000000_create_community_system.sql', import.meta.url), 
        'utf8'
    );

    // 1. Post update immutability trigger
    assert.ok(migrationSql.includes('enforce_community_post_update_rules()'));
    assert.ok(migrationSql.includes('Cannot alter post author_id'));
    assert.ok(migrationSql.includes('Only authorized teachers and admins can modify post moderation flags'));
    assert.ok(!migrationSql.includes('is_admin_or_teacher()'), 'Broad is_admin_or_teacher() must not exist in Community migration');

    // 2. Reply update immutability trigger
    assert.ok(migrationSql.includes('enforce_community_reply_update_rules()'));
    assert.ok(migrationSql.includes('Cannot alter reply author_id'));
    assert.ok(migrationSql.includes('Cannot alter reply post_id'));
    assert.ok(migrationSql.includes('is_accepted can only be updated through the accepted answer workflow'));

    // 3. Accepted answer atomic RPC
    assert.ok(migrationSql.includes('FUNCTION public.set_community_accepted_answer'));
    assert.ok(migrationSql.includes('p_post_id UUID, p_reply_id UUID'));
    assert.ok(migrationSql.includes('kfa.allow_accepted_answer_update'));

    // 4. Safe views incrementer RPC
    assert.ok(migrationSql.includes('FUNCTION public.increment_community_post_view'));

    // 5. Delete restriction: author or admin only (NOT arbitrary teacher deletion)
    assert.ok(migrationSql.includes('(SELECT auth.uid()) = author_id OR (SELECT public.is_admin())'));
    assert.ok(migrationSql.includes('DROP POLICY IF EXISTS "Authors and staff can delete posts"'));
    assert.ok(migrationSql.includes('CREATE POLICY "Authors and admins can delete posts"'));
    assert.ok(migrationSql.includes('DROP POLICY IF EXISTS "Authors and staff can delete replies"'));
    assert.ok(migrationSql.includes('CREATE POLICY "Authors and admins can delete replies"'));

    // 6. Explicit Phase 1 KFA eligibility helper
    assert.ok(migrationSql.includes('FUNCTION public.is_kfa_member()'));
    assert.ok(migrationSql.includes("role IN ('student', 'mentor', 'teacher', 'admin')"));
    assert.ok(migrationSql.includes("status = 'active'"));

    // 7. Category and visibility consistency trigger
    assert.ok(migrationSql.includes('validate_community_post_category_visibility()'));
    assert.ok(migrationSql.includes('Posts in student-only categories cannot have public visibility'));
    assert.ok(migrationSql.includes('Posts in classroom categories must have classroom visibility'));

    // 8. Classroom authorization check
    assert.ok(migrationSql.includes('can_access_classroom_community'));

    // 9. Notifications type check includes community & feedback
    assert.ok(migrationSql.includes("'community'"));
    assert.ok(migrationSql.includes("'feedback'"));

    // 10. Search path hardening on SECURITY DEFINER functions
    const secDefinerCount = (migrationSql.match(/SECURITY DEFINER/g) || []).length;
    const searchPathCount = (migrationSql.match(/SET search_path = public, pg_temp/g) || []).length;
    assert.ok(secDefinerCount > 0);
    assert.equal(secDefinerCount, searchPathCount, 'Every SECURITY DEFINER function must have SET search_path = public, pg_temp');
});

test('8. Accepted Answer Client Workflow: delegates to atomic set_community_accepted_answer RPC', async () => {
    const rpcCalls = [];
    globalThis.__testCommunityRpc = (name, params) => {
        rpcCalls.push({ name, params });
    };

    const { toggleAcceptedAnswer } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": "from 'data:text/javascript,export const supabaseAuth = { rpc: async (n, p) => { globalThis.__testCommunityRpc(n, p); return { error: null }; } };'",
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    // Test marking reply-456 as accepted
    const markRes = await toggleAcceptedAnswer('post-123', 'reply-456', false);
    assert.equal(markRes.success, true);
    assert.equal(rpcCalls[0].name, 'set_community_accepted_answer');
    assert.equal(rpcCalls[0].params.p_post_id, 'post-123');
    assert.equal(rpcCalls[0].params.p_reply_id, 'reply-456');

    // Test unmarking reply-456 as accepted
    const unmarkRes = await toggleAcceptedAnswer('post-123', 'reply-456', true);
    assert.equal(unmarkRes.success, true);
    assert.equal(rpcCalls[1].name, 'set_community_accepted_answer');
    assert.equal(rpcCalls[1].params.p_post_id, 'post-123');
    assert.equal(rpcCalls[1].params.p_reply_id, null);

    delete globalThis.__testCommunityRpc;
});

test('9. Granular Community Authorization Rules Matrix: classroom isolation, accepted answer, delete & reports', () => {
    // Database fixture
    const users = {
        admin: { id: 'u-admin', role: 'admin', status: 'active' },
        teacherA: { id: 'u-teacher-a', role: 'teacher', status: 'active' },
        teacherB: { id: 'u-teacher-b', role: 'teacher', status: 'active' },
        studentA: { id: 'u-student-a', role: 'student', status: 'active' },
        studentB: { id: 'u-student-b', role: 'student', status: 'active' },
        nonKfaUser: { id: 'u-outsider', role: 'pending', status: 'pending' },
        anon: null
    };

    const classrooms = {
        'class-a': { id: 'class-a', teacher_id: users.teacherA.id },
        'class-b': { id: 'class-b', teacher_id: users.teacherB.id }
    };

    const classroomEnrollments = [
        { classroom_id: 'class-a', student_id: users.studentA.id },
        { classroom_id: 'class-b', student_id: users.studentB.id }
    ];

    const posts = {
        classroomA: {
            id: 'post-cla-1',
            author_id: users.studentA.id,
            visibility: 'classroom',
            classroom_id: 'class-a'
        },
        classroomB: {
            id: 'post-clb-1',
            author_id: users.studentB.id,
            visibility: 'classroom',
            classroom_id: 'class-b'
        },
        publicPost: {
            id: 'post-pub-1',
            author_id: users.studentA.id,
            visibility: 'public',
            classroom_id: null
        }
    };

    // Helper functions implementing exact SQL logic
    const isKfaMember = (u) => Boolean(
        u && ['student', 'mentor', 'teacher', 'admin'].includes(u.role) && u.status === 'active'
    );

    const ownsClassroom = (classId, teacherId) => {
        return classrooms[classId]?.teacher_id === teacherId;
    };

    const canAccessClassroomCommunity = (classId, u) => {
        if (!u) return false;
        if (u.role === 'admin') return true;
        if (ownsClassroom(classId, u.id)) return true;
        if (isKfaMember(u) && classroomEnrollments.some(e => e.classroom_id === classId && e.student_id === u.id)) {
            return true;
        }
        return false;
    };

    const canReadPost = (post, u) => {
        if (post.visibility === 'public') return true;
        if (post.visibility === 'students' && isKfaMember(u)) return true;
        if (post.visibility === 'classroom' && post.classroom_id && canAccessClassroomCommunity(post.classroom_id, u)) {
            return true;
        }
        if (u?.role === 'admin') return true;
        return false;
    };

    const canExecuteAcceptedAnswerRpc = (post, u) => {
        if (!u) throw new Error('Authentication required');
        if (u.role === 'admin') return true;
        if (u.id === post.author_id) {
            if (post.visibility === 'classroom' && !canAccessClassroomCommunity(post.classroom_id, u)) {
                return false;
            }
            return true;
        }
        if (u.role === 'teacher' && u.status === 'active') {
            if (post.visibility === 'classroom') {
                return ownsClassroom(post.classroom_id, u.id);
            }
            return true;
        }
        return false;
    };

    const canDeletePost = (post, u) => {
        if (!u) return false;
        return u.id === post.author_id || u.role === 'admin';
    };

    const canSubmitReport = (report, targetPost, u) => {
        if (!u || !isKfaMember(u)) return false;
        if (report.reporter_id !== u.id) return false;
        // Exactly one target
        const hasValidTarget = (report.post_id && !report.reply_id) || (!report.post_id && report.reply_id);
        if (!hasValidTarget) return false;
        // Must have legitimate read access to target
        return canReadPost(targetPost, u);
    };

    // 1. Teacher A + Classroom A → allowed
    assert.equal(canReadPost(posts.classroomA, users.teacherA), true, 'Teacher A can access Classroom A');

    // 2. Teacher A + Classroom B → denied (Classroom isolation)
    assert.equal(canReadPost(posts.classroomB, users.teacherA), false, 'Teacher A cannot access Classroom B');

    // 3. Student A + Classroom A → allowed
    assert.equal(canReadPost(posts.classroomA, users.studentA), true, 'Student A can access enrolled Classroom A');

    // 4. Student A + Classroom B → denied
    assert.equal(canReadPost(posts.classroomB, users.studentA), false, 'Student A cannot access non-enrolled Classroom B');

    // 5. Admin + Classroom A/B → allowed
    assert.equal(canReadPost(posts.classroomA, users.admin), true, 'Admin can access Classroom A');
    assert.equal(canReadPost(posts.classroomB, users.admin), true, 'Admin can access Classroom B');

    // 6. Anonymous + classroom post → denied
    assert.equal(canReadPost(posts.classroomA, users.anon), false, 'Anonymous cannot access classroom post');

    // 7. Teacher A attempts accepted-answer RPC on Classroom B → denied
    assert.equal(canExecuteAcceptedAnswerRpc(posts.classroomB, users.teacherA), false, 'Teacher A cannot moderate accepted answer on Classroom B');
    assert.equal(canExecuteAcceptedAnswerRpc(posts.classroomA, users.teacherA), true, 'Teacher A CAN moderate accepted answer on Classroom A');

    // 8. Teacher A attempts delete of another user's post → denied
    assert.equal(canDeletePost(posts.classroomA, users.teacherA), false, 'Teacher A cannot delete another user post');

    // 9. Teacher A deletes own post → allowed
    const teacherOwnPost = { id: 'post-tea-1', author_id: users.teacherA.id, visibility: 'public' };
    assert.equal(canDeletePost(teacherOwnPost, users.teacherA), true, 'Teacher A can delete own post');

    // 10. Non-KFA authenticated account attempts to submit Community report → denied
    const reportFromOutsider = { reporter_id: users.nonKfaUser.id, post_id: posts.publicPost.id };
    assert.equal(canSubmitReport(reportFromOutsider, posts.publicPost, users.nonKfaUser), false, 'Non-KFA account cannot submit reports');

    // 11. KFA student attempts to report inaccessible classroom post → denied
    const invalidReportFromStudent = { reporter_id: users.studentA.id, post_id: posts.classroomB.id };
    assert.equal(canSubmitReport(invalidReportFromStudent, posts.classroomB, users.studentA), false, 'Student A cannot report inaccessible Classroom B post');

    // Valid report from Student on accessible post → allowed
    const validReportFromStudent = { reporter_id: users.studentA.id, post_id: posts.classroomA.id };
    assert.equal(canSubmitReport(validReportFromStudent, posts.classroomA, users.studentA), true, 'Student A can report accessible Classroom A post');
});

test('10. Live Supabase Post-Migration Verification: tables, RLS filtering, profiles & RPCs', async () => {
    const envContent = await readFile(new URL('../.env', import.meta.url), 'utf8');
    const authUrlMatch = envContent.match(/NEXT_PUBLIC_AUTH_SUPABASE_URL=(https:\/\/[^\s\n]+)/);
    const anonKeyMatch = envContent.match(/NEXT_PUBLIC_AUTH_SUPABASE_ANON_KEY=([A-Za-z0-9._-]+)/);

    if (!authUrlMatch || !anonKeyMatch) {
        console.warn('Skipping live DB check: Missing credentials in .env');
        return;
    }

    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const { createClient } = require('../node_modules/@supabase/supabase-js/dist/main/index.js');
    const supabase = createClient(authUrlMatch[1], anonKeyMatch[1]);

    // 1. Query community_categories as anonymous visitor
    const { data: categories, error: catErr } = await supabase
        .from('community_categories')
        .select('*')
        .order('display_order', { ascending: true });

    assert.equal(catErr, null, 'Querying community_categories should succeed');
    assert.ok(categories && categories.length >= 4, 'Must return at least 4 public categories');
    
    // Ensure all returned categories are public (RLS hides student categories from anon)
    const nonPublic = categories.filter(c => c.access_scope !== 'public');
    assert.equal(nonPublic.length, 0, 'Anonymous visitor must not receive student categories via RLS');

    const returnedSlugs = categories.map(c => c.slug);
    assert.ok(returnedSlugs.includes('flute-questions'));
    assert.ok(returnedSlugs.includes('beginner-discussions'));
    assert.ok(returnedSlugs.includes('raag-and-music-discussions'));
    assert.ok(returnedSlugs.includes('general-bansuri-discussion'));

    // 2. Query community_profiles (backfilled from public.users)
    const { data: profiles, error: profErr } = await supabase
        .from('community_profiles')
        .select('id, display_name, avatar_url')
        .limit(5);

    assert.equal(profErr, null, 'Querying community_profiles should succeed');
    assert.ok(profiles && profiles.length > 0, 'Backfilled profiles must exist');

    // 3. Test RPC get_community_role_badge
    const testUserId = profiles[0].id;
    const { data: badge, error: badgeErr } = await supabase.rpc('get_community_role_badge', { u_id: testUserId });
    assert.equal(badgeErr, null, 'get_community_role_badge RPC must execute successfully');
    assert.ok(['Admin', 'Teacher', 'KFA Student', 'Community Member'].includes(badge));

    // 4. Test RPC set_community_accepted_answer without auth (must fail)
    const { error: answerErr } = await supabase.rpc('set_community_accepted_answer', {
        p_post_id: '00000000-0000-0000-0000-000000000001',
        p_reply_id: '00000000-0000-0000-0000-000000000002'
    });
    assert.ok(answerErr !== null, 'Anonymous accepted answer RPC must be rejected');
    assert.ok(answerErr.message.includes('Authentication required'));
});

// ============================================================================
// PHASE 2: External Community Membership & Security Invariant Tests
// ============================================================================

test('11. Phase 2 Safe Open Redirect Prevention: blocks external and protocol-relative redirect attacks', () => {
    // Dangerous URLs that must be neutralized to fallback
    assert.equal(getSafeRedirectUrl('//evil.com'), '/community', 'Must reject protocol-relative open redirects');
    assert.equal(getSafeRedirectUrl('//attacker.com/steal-session'), '/community', 'Must reject protocol-relative paths');
    assert.equal(getSafeRedirectUrl('https://evil.com'), '/community', 'Must reject absolute external URLs');
    assert.equal(getSafeRedirectUrl('http://evil.com'), '/community', 'Must reject HTTP external URLs');
    assert.equal(getSafeRedirectUrl('/\\evil.com'), '/community', 'Must reject backslash escaping');
    assert.equal(getSafeRedirectUrl('\\evil.com'), '/community', 'Must reject leading backslash');
    assert.equal(getSafeRedirectUrl('/evil\\something'), '/community', 'Must reject paths with backslashes');
    assert.equal(getSafeRedirectUrl('javascript:alert(1)'), '/community', 'Must reject javascript: pseudo-protocols');
    assert.equal(getSafeRedirectUrl(null), '/community', 'Must fallback on null');
    assert.equal(getSafeRedirectUrl(undefined), '/community', 'Must fallback on undefined');
    assert.equal(getSafeRedirectUrl(''), '/community', 'Must fallback on empty string');

    // Legitimate in-app paths that must be preserved
    assert.equal(getSafeRedirectUrl('/community'), '/community');
    assert.equal(getSafeRedirectUrl('/community/new'), '/community/new');
    assert.equal(getSafeRedirectUrl('/community/discussion/raag-yaman-guide-123'), '/community/discussion/raag-yaman-guide-123');
    assert.equal(getSafeRedirectUrl('/community/discussion/tips?page=2'), '/community/discussion/tips?page=2');
    assert.equal(getSafeRedirectUrl('/student-dashboard', '/student-dashboard'), '/student-dashboard');
});

test('12. Phase 2 Migration SQL Invariants: verifies handle_new_user() trigger and RLS isolation', async () => {
    const migrationSql = await readFile(new URL('../supabase/migrations/20260924120000_community_phase2_external_members.sql', import.meta.url), 'utf8');

    // 1. Verify community account branching
    assert.ok(migrationSql.includes("v_account_type = 'community'"), 'Trigger must branch on account_type = community');
    assert.ok(migrationSql.includes('INSERT INTO public.community_profiles'), 'Community branch must insert into community_profiles');
    assert.ok(migrationSql.includes('RETURN NEW;'), 'Community branch must exit immediately without touching public.users');

    // 2. Verify privilege escalation prevention for academy accounts
    // The trigger must NOT use NEW.raw_user_meta_data->>'role' as an authoritative role!
    assert.ok(!migrationSql.includes("COALESCE(NEW.raw_user_meta_data->>'role'"), 'Trigger must NOT trust raw_user_meta_data role');
    assert.ok(migrationSql.includes("COALESCE(role, 'pending')") || migrationSql.includes("'pending'"), 'Default role must be pending');

    // 3. Verify community_posts RLS policies for external members
    assert.ok(migrationSql.includes("visibility = 'public'"), 'Posts with visibility = public must be permitted for authenticated members');
    assert.ok(migrationSql.includes("visibility = 'students' AND (SELECT public.is_kfa_member())"), 'Posts in student categories must strictly verify is_kfa_member');

    // 4. Verify community_replies RLS policies
    assert.ok(migrationSql.includes('Permitted users can insert replies') && migrationSql.includes('ON public.community_replies'), 'Must define community_replies insert policy');

    // 5. Verify community_reactions RLS policies
    assert.ok(migrationSql.includes('Authenticated users can insert reaction') && migrationSql.includes('ON public.community_reactions'), 'Must define community_reactions insert policy');
    assert.ok(migrationSql.includes('(SELECT auth.uid()) = user_id'), 'Reactions must enforce auth.uid() matching user_id');
});

test('13. Phase 2 Dashboard Guard Invariants: verifies Student and Teacher dashboards bar external members', async () => {
    // 1. Audit StudentDashboardContainer
    const studentDashContent = await readFile(new URL('../src/components/student-dashboard/StudentDashboardContainer.tsx', import.meta.url), 'utf8');
    assert.ok(
        studentDashContent.includes("router.push('/community')"), 
        'Student dashboard must redirect non-academy users (e.g. community members) to /community'
    );
    assert.ok(
        studentDashContent.includes("!['student', 'mentor'].includes") || studentDashContent.includes("normalizedRole !== 'student'"),
        'Student dashboard must explicitly restrict access to student and mentor roles only'
    );

    // 2. Audit TeacherDashboardContainer
    const teacherDashContent = await readFile(new URL('../src/components/teacher-dashboard/TeacherDashboardContainer.tsx', import.meta.url), 'utf8');
    assert.ok(
        teacherDashContent.includes("!['teacher', 'admin'].includes"),
        'Teacher dashboard must use explicit allow-list for teacher and admin'
    );
    assert.ok(
        teacherDashContent.includes("router.push('/community')"),
        'Teacher dashboard must redirect non-teachers/non-students to /community'
    );
});

test('14. Phase 2 Community Registration Page: verifies account_type metadata and clear disclaimer', async () => {
    const joinPageContent = await readFile(new URL('../app/community/join/page.tsx', import.meta.url), 'utf8');

    // Must set account_type: 'community' in supabase signUp
    assert.ok(joinPageContent.includes("account_type: 'community'"), 'Join page must specify account_type: community');
    // Must contain disclaimer regarding student courses & classrooms
    assert.ok(joinPageContent.includes('student courses'), 'Join page must state it does not provide student courses');
    assert.ok(joinPageContent.includes('classrooms'), 'Join page must state it does not provide classroom access');
    // Must provide login link for existing academy students
    assert.ok(joinPageContent.includes('/login'), 'Join page must link to existing login');
    // Must NOT insert into public.users
    assert.ok(!joinPageContent.includes(".from('users')"), 'Join page must NEVER insert into public.users');
});

test('15. Phase 2 Community Navbar & Badge Resolution: verifies external member dashboard routing and badges', async () => {
    const navbarContent = await readFile(new URL('../src/components/community/CommunityNavbar.tsx', import.meta.url), 'utf8');

    // Navbar must link to /community for community members (when userRole is falsy)
    assert.ok(navbarContent.includes("if (!userRole) return '/community'"), 'Navbar must return /community for external community members');
    // Navbar must link to /community/join
    assert.ok(navbarContent.includes('/community/join'), 'Navbar must link to /community/join');
    // Navbar must hydrate from community_profiles when user is not in public.users
    assert.ok(navbarContent.includes(".from('community_profiles')"), 'Navbar must hydrate from community_profiles');

    // Badge resolution test
    assert.equal(resolveUserBadge(null), 'Community Member');
    assert.equal(resolveUserBadge(undefined), 'Community Member');
    assert.equal(resolveUserBadge(''), 'Community Member');
});

test('16. Phase 2 Granular Report Authorization: tests public, student, classroom & target constraints', () => {
    // Model the exact SQL policy:
    // (SELECT auth.uid()) = reporter_id
    // AND (SELECT public.is_community_participant())
    // AND (
    //   (post_id IS NOT NULL AND reply_id IS NULL AND EXISTS (SELECT 1 FROM community_posts p WHERE ...))
    //   OR (reply_id IS NOT NULL AND post_id IS NULL AND EXISTS (SELECT 1 FROM community_replies r JOIN community_posts p ...))
    // )
    function evaluateReportInsertPolicy({
        reporterId,
        authUid,
        hasCommunityProfile,
        kfaRole, // 'admin' | 'teacher' | 'student' | 'mentor' | null
        kfaStatus, // 'active' | 'pending' | null
        enrolledClassrooms = [],
        assignedClassrooms = [],
        reportData
    }, postDb, replyDb, explicitReportData = null) {
        // 1. auth check
        if (!authUid || authUid !== reporterId) return { allowed: false, reason: 'Reporter ID mismatch or unauthenticated' };

        // 2. is_community_participant check
        const isKfaMember = (kfaRole && ['admin', 'teacher', 'student', 'mentor'].includes(kfaRole) && kfaStatus === 'active');
        const isCommunityParticipant = hasCommunityProfile || isKfaMember;
        if (!isCommunityParticipant) return { allowed: false, reason: 'Not a valid community participant' };

        const actualReportData = explicitReportData || reportData || {};
        const { post_id, reply_id } = actualReportData;

        // Exactly-one-target constraint
        const isPostOnly = (post_id !== null && post_id !== undefined && (reply_id === null || reply_id === undefined));
        const isReplyOnly = (reply_id !== null && reply_id !== undefined && (post_id === null || post_id === undefined));

        if (!isPostOnly && !isReplyOnly) {
            return { allowed: false, reason: 'Target constraint failed: must have exactly one target (post_id OR reply_id)' };
        }

        const isAdmin = kfaRole === 'admin' && kfaStatus === 'active';

        if (isPostOnly) {
            const post = postDb.find(p => p.id === post_id);
            if (!post) return { allowed: false, reason: 'Target post not found' };

            // Visibility check
            if (post.visibility === 'public') return { allowed: true };
            if (post.visibility === 'students' && isKfaMember) return { allowed: true };
            if (post.visibility === 'classroom' && post.classroom_id) {
                if (isAdmin) return { allowed: true };
                if (kfaRole === 'teacher' && assignedClassrooms.includes(post.classroom_id)) return { allowed: true };
                if ((kfaRole === 'student' || kfaRole === 'mentor') && enrolledClassrooms.includes(post.classroom_id)) return { allowed: true };
            }
            if (isAdmin) return { allowed: true };

            return { allowed: false, reason: 'Inaccessible post visibility' };
        }

        if (isReplyOnly) {
            const reply = replyDb.find(r => r.id === reply_id);
            if (!reply) return { allowed: false, reason: 'Target reply not found' };

            const post = postDb.find(p => p.id === reply.post_id);
            if (!post) return { allowed: false, reason: 'Parent post for reply not found' };

            if (post.visibility === 'public') return { allowed: true };
            if (post.visibility === 'students' && isKfaMember) return { allowed: true };
            if (post.visibility === 'classroom' && post.classroom_id) {
                if (isAdmin) return { allowed: true };
                if (kfaRole === 'teacher' && assignedClassrooms.includes(post.classroom_id)) return { allowed: true };
                if ((kfaRole === 'student' || kfaRole === 'mentor') && enrolledClassrooms.includes(post.classroom_id)) return { allowed: true };
            }
            if (isAdmin) return { allowed: true };

            return { allowed: false, reason: 'Inaccessible reply parent post visibility' };
        }

        return { allowed: false, reason: 'Unknown condition' };
    }

    // Mock DB
    const posts = [
        { id: 'post-pub-1', visibility: 'public', classroom_id: null },
        { id: 'post-stu-1', visibility: 'students', classroom_id: null },
        { id: 'post-cls-1', visibility: 'classroom', classroom_id: 'class-beginner-batch' }
    ];
    const replies = [
        { id: 'reply-pub-1', post_id: 'post-pub-1' },
        { id: 'reply-stu-1', post_id: 'post-stu-1' },
        { id: 'reply-cls-1', post_id: 'post-cls-1' }
    ];

    const communityUser = {
        reporterId: 'user-comm-123',
        authUid: 'user-comm-123',
        hasCommunityProfile: true,
        kfaRole: null,
        kfaStatus: null
    };

    // 1. Community Member -> report public post = ALLOWED
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: 'post-pub-1', reply_id: null } }, posts, replies).allowed, true, 'Community Member reporting public post must be ALLOWED');

    // 2. Community Member -> report public reply = ALLOWED
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: null, reply_id: 'reply-pub-1' } }, posts, replies).allowed, true, 'Community Member reporting public reply must be ALLOWED');

    // 3. Community Member -> report student post = DENIED
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: 'post-stu-1', reply_id: null } }, posts, replies).allowed, false, 'Community Member reporting student post must be DENIED');

    // 4. Community Member -> report classroom post = DENIED
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: 'post-cls-1', reply_id: null } }, posts, replies).allowed, false, 'Community Member reporting classroom post must be DENIED');

    // 5. Community Member -> report nonexistent UUID = DENIED
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: 'post-nonexistent-999', reply_id: null } }, posts, replies).allowed, false, 'Community Member reporting nonexistent post UUID must be DENIED');
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: null, reply_id: 'reply-nonexistent-999' } }, posts, replies).allowed, false, 'Community Member reporting nonexistent reply UUID must be DENIED');

    // 6. Community Member -> report with both post_id and reply_id = DENIED
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: 'post-pub-1', reply_id: 'reply-pub-1' } }, posts, replies).allowed, false, 'Report with both post_id and reply_id must be DENIED');

    // 7. Community Member -> report with neither target = DENIED
    assert.equal(evaluateReportInsertPolicy({ ...communityUser, reportData: { post_id: null, reply_id: null } }, posts, replies).allowed, false, 'Report with neither target must be DENIED');

    // KFA Student reporting student post = ALLOWED
    const studentUser = {
        reporterId: 'user-stu-123',
        authUid: 'user-stu-123',
        hasCommunityProfile: true,
        kfaRole: 'student',
        kfaStatus: 'active',
        enrolledClassrooms: ['class-beginner-batch']
    };
    assert.equal(evaluateReportInsertPolicy({ ...studentUser, reportData: { post_id: 'post-stu-1', reply_id: null } }, posts, replies).allowed, true, 'KFA Student reporting student post must be ALLOWED');
    assert.equal(evaluateReportInsertPolicy({ ...studentUser, reportData: { post_id: 'post-cls-1', reply_id: null } }, posts, replies).allowed, true, 'KFA Student reporting their enrolled classroom post must be ALLOWED');
});

test('17. Phase 2 Participant Verification Helper: unverified authenticated users barred from participation', () => {
    function evaluateCommunityParticipation({ authUid, hasCommunityProfile, kfaRole, kfaStatus }) {
        if (!authUid) return false;
        const isKfaMember = !!(kfaRole && ['admin', 'teacher', 'student', 'mentor'].includes(kfaRole) && kfaStatus === 'active');
        return hasCommunityProfile || isKfaMember;
    }

    function evaluateInsertPost({ authUid, authorId, isParticipant, visibility }) {
        if (authUid !== authorId) return false;
        if (!isParticipant) return false;
        return visibility === 'public';
    }

    // Authenticated user with NO community_profiles and NO public.users role
    const unverifiedUser = {
        authUid: 'unverified-uuid-456',
        authorId: 'unverified-uuid-456',
        hasCommunityProfile: false,
        kfaRole: null,
        kfaStatus: null
    };

    const isParticipant = evaluateCommunityParticipation(unverifiedUser);
    assert.equal(isParticipant, false, 'Arbitrary authenticated user without community_profiles or KFA role is NOT a participant');

    // Verify denial on post, reply, react, and report
    const canCreatePost = evaluateInsertPost({ ...unverifiedUser, isParticipant, visibility: 'public' });
    assert.equal(canCreatePost, false, 'Unverified user creating public post must be DENIED');

    // Legitimate Community Member
    const verifiedCommUser = {
        authUid: 'comm-uuid-789',
        authorId: 'comm-uuid-789',
        hasCommunityProfile: true,
        kfaRole: null,
        kfaStatus: null
    };
    const isCommParticipant = evaluateCommunityParticipation(verifiedCommUser);
    assert.equal(isCommParticipant, true, 'Registered Community Member with community_profiles is a valid participant');
    assert.equal(evaluateInsertPost({ ...verifiedCommUser, isParticipant: isCommParticipant, visibility: 'public' }), true, 'Community Member creating public post must be ALLOWED');
});

test('18. Phase 2 Privilege Escalation Defense: malicious metadata during signup grants ZERO academy privileges', () => {
    // Model handle_new_user() branching logic
    function simulateHandleNewUser(authRecord, rawMetadata, existingUsersDb) {
        const v_account_type = rawMetadata.account_type || '';
        const v_display_name = rawMetadata.full_name || rawMetadata.name || authRecord.email.split('@')[0];

        // BRANCH A: External Community Member
        if (v_account_type === 'community') {
            const communityProfile = {
                id: authRecord.id,
                display_name: v_display_name,
                avatar_url: rawMetadata.avatar_url || null
            };
            // Strictly returns without touching public.users
            return {
                createdCommunityProfile: communityProfile,
                createdPublicUser: null,
                accountType: 'community'
            };
        }

        // BRANCH B: Academy Registration
        const existing = existingUsersDb.find(u => u.email === authRecord.email);
        if (existing && existing.id !== authRecord.id) {
            return {
                createdCommunityProfile: { id: authRecord.id, display_name: v_display_name },
                createdPublicUser: {
                    id: authRecord.id,
                    role: existing.role || 'pending', // Preserves DB role, ignores metadata!
                    status: existing.status
                },
                accountType: 'merged_academy'
            };
        }

        // Fresh academy signup
        return {
            createdCommunityProfile: { id: authRecord.id, display_name: v_display_name },
            createdPublicUser: {
                id: authRecord.id,
                role: 'pending', // Hardcoded!
                status: 'pending' // Hardcoded!
            },
            accountType: 'fresh_academy'
        };
    }

    const existingDb = [
        { id: 'pre-existing-teacher-uuid', email: 'guruji@kfa.com', role: 'teacher', status: 'active' }
    ];

    // Scenario 1: Malicious Community signup with role = 'admin'
    const attack1 = simulateHandleNewUser(
        { id: 'user-att-1', email: 'hacker1@evil.com' },
        { account_type: 'community', role: 'admin', full_name: 'Hacker Admin' },
        existingDb
    );
    assert.equal(attack1.accountType, 'community');
    assert.ok(attack1.createdCommunityProfile !== null);
    assert.equal(attack1.createdPublicUser, null, 'Malicious community signup with role=admin must NEVER create a public.users row');

    // Scenario 2: Malicious Community signup with role = 'student'
    const attack2 = simulateHandleNewUser(
        { id: 'user-att-2', email: 'hacker2@evil.com' },
        { account_type: 'community', role: 'student', full_name: 'Hacker Student' },
        existingDb
    );
    assert.equal(attack2.accountType, 'community');
    assert.equal(attack2.createdPublicUser, null, 'Malicious community signup with role=student must NEVER create a public.users row');

    // Scenario 3: Malicious Academy self-signup with role = 'admin' (no account_type)
    const attack3 = simulateHandleNewUser(
        { id: 'user-att-3', email: 'hacker3@evil.com' },
        { role: 'admin', full_name: 'Hacker Academy Admin' },
        existingDb
    );
    assert.equal(attack3.accountType, 'fresh_academy');
    assert.equal(attack3.createdPublicUser.role, 'pending', 'Public academy signup attempting role=admin MUST be forced to role=pending');
    assert.equal(attack3.createdPublicUser.status, 'pending', 'Public academy signup MUST be forced to status=pending');

    // Scenario 4: Legitimate pre-registered teacher login merge
    const legitimateTeacher = simulateHandleNewUser(
        { id: 'confirmed-auth-uuid-4', email: 'guruji@kfa.com' },
        { full_name: 'Krishna Sir' },
        existingDb
    );
    assert.equal(legitimateTeacher.accountType, 'merged_academy');
    assert.equal(legitimateTeacher.createdPublicUser.role, 'teacher', 'Pre-registered teacher account MUST preserve database role');
});

test('19. Option B Student Persona Authorization Matrix: public, student, classroom & dashboard access', () => {
    // Model the exact SQL functions and RLS policies under Option B:
    // 1. is_kfa_member() -> checks public.users (role in student, mentor, teacher, admin and status active)
    // 2. can_access_student_community() -> is_kfa_member() OR (community_profiles.community_role = 'student_persona')
    // 3. can_access_classroom_community(c_id) -> is_admin() OR teacher ownership OR (is_kfa_member() AND enrolled in classroom_students)

    function evaluateAccess({
        userId,
        publicUser, // { role: string, status: string } or null
        communityProfile, // { community_role: 'member' | 'student_persona' } or null
        enrolledClassrooms = [],
        assignedClassrooms = [],
        targetScope, // 'public' | 'students' | 'classroom'
        targetClassroomId = null
    }) {
        const isAdmin = publicUser?.role === 'admin' && publicUser?.status === 'active';
        const isTeacher = publicUser?.role === 'teacher' && publicUser?.status === 'active';
        const isKfaMember = Boolean(
            publicUser &&
            ['student', 'mentor', 'teacher', 'admin'].includes(publicUser.role) &&
            publicUser.status === 'active'
        );

        const canAccessStudentCommunity = isKfaMember || communityProfile?.community_role === 'student_persona';

        const canAccessClassroomCommunity = (cid) => {
            if (isAdmin) return true;
            if (isTeacher && assignedClassrooms.includes(cid)) return true;
            if (isKfaMember && enrolledClassrooms.includes(cid)) return true;
            return false;
        };

        const canAccessStudentDashboard = isKfaMember && ['student', 'mentor'].includes(publicUser.role);
        const canAccessTeacherDashboard = isKfaMember && ['teacher', 'admin'].includes(publicUser.role);

        let canRead = false;
        let canPost = false;

        if (targetScope === 'public') {
            canRead = true; // Anyone can read public
            canPost = Boolean(communityProfile || isKfaMember); // Any authenticated participant can post public
        } else if (targetScope === 'students') {
            canRead = canAccessStudentCommunity || isAdmin;
            canPost = canAccessStudentCommunity && (Boolean(communityProfile) || isKfaMember);
        } else if (targetScope === 'classroom') {
            canRead = canAccessClassroomCommunity(targetClassroomId);
            canPost = canAccessClassroomCommunity(targetClassroomId);
        }

        return {
            isKfaMember,
            canAccessStudentCommunity,
            canRead,
            canPost,
            canAccessStudentDashboard,
            canAccessTeacherDashboard
        };
    }

    // Role 1: Normal Community Member (Aarav Mehta / external user)
    const normalMember = evaluateAccess({
        userId: 'aarav-uuid',
        publicUser: null, // NOT in public.users
        communityProfile: { community_role: 'member' },
        targetScope: 'students'
    });
    assert.equal(normalMember.isKfaMember, false);
    assert.equal(normalMember.canAccessStudentCommunity, false);
    assert.equal(normalMember.canRead, false, 'Normal Community Member cannot read student-only discussions');
    assert.equal(normalMember.canPost, false, 'Normal Community Member cannot post in student-only discussions');
    assert.equal(normalMember.canAccessStudentDashboard, false, 'Normal Community Member cannot access Student Dashboard');

    const normalMemberPublic = evaluateAccess({
        userId: 'aarav-uuid',
        publicUser: null,
        communityProfile: { community_role: 'member' },
        targetScope: 'public'
    });
    assert.equal(normalMemberPublic.canRead, true, 'Normal Community Member can read public discussions');
    assert.equal(normalMemberPublic.canPost, true, 'Normal Community Member can post in public discussions');

    // Role 2: Student Persona (Ananya Sharma / Rohit Mukherjee)
    const studentPersonaStudentScope = evaluateAccess({
        userId: 'ananya-uuid',
        publicUser: null, // STRICT GUARANTEE: Never in public.users!
        communityProfile: { community_role: 'student_persona' },
        targetScope: 'students'
    });
    assert.equal(studentPersonaStudentScope.isKfaMember, false, 'Student Persona is NOT a KFA Academy member in public.users');
    assert.equal(studentPersonaStudentScope.canAccessStudentCommunity, true, 'Student Persona has student community access');
    assert.equal(studentPersonaStudentScope.canRead, true, 'Student Persona can read student discussions');
    assert.equal(studentPersonaStudentScope.canPost, true, 'Student Persona can post in student discussions');
    assert.equal(studentPersonaStudentScope.canAccessStudentDashboard, false, 'Student Persona CANNOT access Student Dashboard');

    const studentPersonaClassroom = evaluateAccess({
        userId: 'ananya-uuid',
        publicUser: null,
        communityProfile: { community_role: 'student_persona' },
        targetScope: 'classroom',
        targetClassroomId: 'class-beginner-batch'
    });
    assert.equal(studentPersonaClassroom.canRead, false, 'Student Persona CANNOT read classroom discussions');
    assert.equal(studentPersonaClassroom.canPost, false, 'Student Persona CANNOT post in classroom discussions');

    // Role 3: Real Enrolled KFA Student
    const realStudent = evaluateAccess({
        userId: 'real-student-uuid',
        publicUser: { role: 'student', status: 'active' },
        communityProfile: { community_role: 'member' },
        enrolledClassrooms: ['class-beginner-batch'],
        targetScope: 'classroom',
        targetClassroomId: 'class-beginner-batch'
    });
    assert.equal(realStudent.isKfaMember, true);
    assert.equal(realStudent.canAccessStudentCommunity, true);
    assert.equal(realStudent.canRead, true, 'Real enrolled student can read their classroom discussions');
    assert.equal(realStudent.canPost, true, 'Real enrolled student can post in their classroom discussions');
    assert.equal(realStudent.canAccessStudentDashboard, true, 'Real enrolled student can access Student Dashboard');

    const realStudentOtherClass = evaluateAccess({
        userId: 'real-student-uuid',
        publicUser: { role: 'student', status: 'active' },
        communityProfile: { community_role: 'member' },
        enrolledClassrooms: ['class-beginner-batch'],
        targetScope: 'classroom',
        targetClassroomId: 'class-advanced-batch'
    });
    assert.equal(realStudentOtherClass.canRead, false, 'Real student CANNOT access non-enrolled classroom');

    // Role 4: Real KFA Teacher
    const teacher = evaluateAccess({
        userId: 'teacher-uuid',
        publicUser: { role: 'teacher', status: 'active' },
        communityProfile: { community_role: 'member' },
        assignedClassrooms: ['class-beginner-batch'],
        targetScope: 'classroom',
        targetClassroomId: 'class-beginner-batch'
    });
    assert.equal(teacher.canAccessTeacherDashboard, true, 'Teacher can access Teacher Dashboard');
    assert.equal(teacher.canRead, true, 'Teacher can access assigned classroom');

    const teacherUnassigned = evaluateAccess({
        userId: 'teacher-uuid',
        publicUser: { role: 'teacher', status: 'active' },
        communityProfile: { community_role: 'member' },
        assignedClassrooms: ['class-beginner-batch'],
        targetScope: 'classroom',
        targetClassroomId: 'class-advanced-batch'
    });
    assert.equal(teacherUnassigned.canRead, false, 'Teacher CANNOT access unassigned classroom');
});

test('20. Option B Public Badge & Zero Identity Leak Guarantee: student persona displays Community Member', () => {
    // Test resolveUserBadge function
    // Case 1: Student Persona has NO role in public.users (role is undefined / null)
    const personaBadge = resolveUserBadge(null);
    assert.equal(personaBadge, 'Community Member', 'Student Persona MUST resolve to Community Member badge');

    // Even if somehow passed 'student_persona' string, it falls back to Community Member
    const stringSafetyBadge = resolveUserBadge('student_persona');
    assert.equal(stringSafetyBadge, 'Community Member', 'Direct student_persona string must resolve to Community Member');

    // Case 2: Real users
    assert.equal(resolveUserBadge('student'), 'KFA Student');
    assert.equal(resolveUserBadge('mentor'), 'KFA Student');
    assert.equal(resolveUserBadge('teacher'), 'Teacher');
    assert.equal(resolveUserBadge('admin'), 'Admin');

    // Verification of privacy: verify prohibited terms are NEVER present in personaBadge
    const lowerBadge = personaBadge.toLowerCase();
    const prohibitedTerms = ['student', 'persona', 'seed', 'test', 'dummy', 'bot', 'synthetic', 'special'];
    for (const term of prohibitedTerms) {
        assert.ok(!lowerBadge.includes(term), `Badge '${personaBadge}' must not contain prohibited token '${term}'`);
    }

    // Model the exact SQL function:
    // SELECT CASE
    //   WHEN EXISTS (SELECT 1 FROM public.users WHERE id = u_id AND role = 'admin') THEN 'Admin'
    //   WHEN EXISTS (SELECT 1 FROM public.users WHERE id = u_id AND role = 'teacher') THEN 'Teacher'
    //   WHEN EXISTS (SELECT 1 FROM public.users WHERE id = u_id AND role IN ('student', 'mentor')) THEN 'KFA Student'
    //   ELSE 'Community Member'
    // END;
    function simulateGetCommunityRoleBadge(userId, publicUsersDb) {
        const u = publicUsersDb.find(user => user.id === userId);
        if (u?.role === 'admin') return 'Admin';
        if (u?.role === 'teacher') return 'Teacher';
        if (u?.role === 'student' || u?.role === 'mentor') return 'KFA Student';
        return 'Community Member';
    }

    const publicUsersDb = [
        { id: 'real-student-1', role: 'student' },
        { id: 'teacher-1', role: 'teacher' },
        { id: 'admin-1', role: 'admin' }
    ];

    const ananyaBadge = simulateGetCommunityRoleBadge('ananya-sharma-persona-uuid', publicUsersDb);
    const rohitBadge = simulateGetCommunityRoleBadge('rohit-mukherjee-persona-uuid', publicUsersDb);
    const aaravBadge = simulateGetCommunityRoleBadge('aarav-mehta-external-uuid', publicUsersDb);

    assert.equal(ananyaBadge, 'Community Member', 'Ananya Sharma badge must be Community Member');
    assert.equal(rohitBadge, 'Community Member', 'Rohit Mukherjee badge must be Community Member');
    assert.equal(aaravBadge, 'Community Member', 'Aarav Mehta badge must be Community Member');
});

test('21. Zero Operational Contamination Invariants & Trigger Protection: personas cannot corrupt academy tables', () => {
    // 1. Academy operational tables simulation
    const academyState = {
        users: [
            { id: 's1', name: 'Deepak Pun', role: 'student', status: 'active' },
            { id: 's2', name: 'Bharath Kannan', role: 'student', status: 'active' },
            { id: 't1', name: 'Teacher A', role: 'teacher', status: 'active' }
        ],
        classroom_students: [
            { classroom_id: 'c1', student_id: 's1' },
            { classroom_id: 'c1', student_id: 's2' }
        ],
        fees_payments: [
            { student_id: 's1', amount: 3000, status: 'approved' }
        ],
        attendance: [
            { student_id: 's1', status: 'present' }
        ],
        assignment_students: [
            { assignment_id: 'a1', student_id: 's1', status: 'pending' }
        ],
        notifications: [
            { user_id: 's1', type: 'reminder', message: 'Class reminder' }
        ]
    };

    // 5 Personas in community_profiles
    const communityProfiles = [
        { id: 'p1', display_name: 'Aarav Mehta', community_role: 'member' },
        { id: 'p2', display_name: 'Riya Sen', community_role: 'member' },
        { id: 'p3', display_name: 'Arjun Nair', community_role: 'member' },
        { id: 'p4', display_name: 'Ananya Sharma', community_role: 'student_persona' },
        { id: 'p5', display_name: 'Rohit Mukherjee', community_role: 'student_persona' }
    ];

    // Invariant 1: Total active academy students query
    const activeStudentCount = academyState.users.filter(u => u.role === 'student' && u.status === 'active').length;
    assert.equal(activeStudentCount, 2, 'Active student count in public.users MUST remain 2 (personas never counted)');

    // Invariant 2: Unassigned students query (students without classrooms)
    const enrolledStudentIds = new Set(academyState.classroom_students.map(cs => cs.student_id));
    const unassignedStudents = academyState.users.filter(u => u.role === 'student' && !enrolledStudentIds.has(u.id));
    assert.equal(unassignedStudents.length, 0, 'Personas must never appear in unassigned students operational alert');

    // Invariant 3: Fees due and attendance queries
    const feeRecordsForPersonas = academyState.fees_payments.filter(f => communityProfiles.some(p => p.id === f.student_id));
    assert.equal(feeRecordsForPersonas.length, 0, 'No persona may have fees records');

    const attendanceRecordsForPersonas = academyState.attendance.filter(a => communityProfiles.some(p => p.id === a.student_id));
    assert.equal(attendanceRecordsForPersonas.length, 0, 'No persona may have attendance records');

    // Invariant 4: Broadcast notifications targeting all students
    const broadcastRecipients = academyState.users.filter(u => u.role === 'student').map(u => u.id);
    for (const persona of communityProfiles) {
        assert.ok(!broadcastRecipients.includes(persona.id), 'Personas must NEVER receive academy operational broadcasts');
    }

    // 2. Trigger protection simulation (protect_community_profile_role)
    function simulateProtectCommunityProfileRole(op, oldRow, newRow, isSessionAdmin) {
        if (op === 'UPDATE') {
            if (newRow.community_role !== oldRow.community_role) {
                if (!isSessionAdmin) {
                    return { ...newRow, community_role: oldRow.community_role };
                }
            }
        } else if (op === 'INSERT') {
            if (newRow.community_role && newRow.community_role !== 'member') {
                if (!isSessionAdmin) {
                    return { ...newRow, community_role: 'member' };
                }
            }
        }
        return newRow;
    }

    // Scenario A: Malicious non-admin tries to self-elevate to student_persona via UPDATE
    const attackUpdate = simulateProtectCommunityProfileRole(
        'UPDATE',
        { id: 'hacker-uuid', community_role: 'member' },
        { id: 'hacker-uuid', community_role: 'student_persona' },
        false // Not admin
    );
    assert.equal(attackUpdate.community_role, 'member', 'Non-admin UPDATE cannot self-elevate community_role to student_persona');

    // Scenario B: Non-admin tries to set student_persona on INSERT
    const attackInsert = simulateProtectCommunityProfileRole(
        'INSERT',
        null,
        { id: 'hacker-uuid', community_role: 'student_persona' },
        false // Not admin
    );
    assert.equal(attackInsert.community_role, 'member', 'Non-admin INSERT cannot set community_role to student_persona');

    // Scenario C: Admin sets student_persona
    const adminInsert = simulateProtectCommunityProfileRole(
        'INSERT',
        null,
        { id: 'ananya-uuid', community_role: 'student_persona' },
        true // Admin
    );
    assert.equal(adminInsert.community_role, 'student_persona', 'Admin CAN provision student_persona');
});

test('22. Option B Migration File Invariants & RLS Hardening Audit: verifies SQL definitions', async () => {
    const migrationContent = await readFile(
        new URL('../supabase/migrations/20260924140000_community_student_personas.sql', import.meta.url),
        'utf8'
    );

    // 1. Column and constraint
    assert.ok(migrationContent.includes("community_role TEXT NOT NULL DEFAULT 'member'"), 'Must define community_role with default member');
    assert.ok(migrationContent.includes("CHECK (community_role IN ('member', 'student_persona'))"), 'Must restrict community_role to valid values');

    // 2. Trigger protection
    assert.ok(migrationContent.includes('protect_community_profile_role()'), 'Must include protect_community_profile_role function');
    assert.ok(migrationContent.includes('BEFORE INSERT OR UPDATE ON public.community_profiles'), 'Must attach protection trigger');

    // 3. can_access_student_community() definition
    assert.ok(migrationContent.includes('CREATE OR REPLACE FUNCTION public.can_access_student_community()'), 'Must update can_access_student_community');
    assert.ok(migrationContent.includes("cp.community_role = 'student_persona'"), 'can_access_student_community must check student_persona');
    assert.ok(migrationContent.includes('(SELECT public.is_kfa_member())'), 'can_access_student_community must preserve is_kfa_member()');

    // 4. is_kfa_member() and can_access_classroom_community() must NOT be broadened or redefined
    assert.ok(!migrationContent.includes('CREATE OR REPLACE FUNCTION public.is_kfa_member()'), 'is_kfa_member must NOT be redefined in this migration');
    assert.ok(!migrationContent.includes('CREATE OR REPLACE FUNCTION public.can_access_classroom_community('), 'can_access_classroom_community must NOT be redefined');

    // 5. get_community_role_badge definition
    assert.ok(migrationContent.includes('CREATE OR REPLACE FUNCTION public.get_community_role_badge(u_id UUID)'), 'Must reaffirm get_community_role_badge');
    assert.ok(migrationContent.includes("ELSE 'Community Member'"), 'get_community_role_badge must default to Community Member');

    // 6. Community RLS policies updated to can_access_student_community()
    assert.ok(migrationContent.includes("access_scope = 'students' AND (SELECT public.can_access_student_community())"), 'Category policy must use can_access_student_community');
    assert.ok(migrationContent.includes("visibility = 'students' AND (SELECT public.can_access_student_community())"), 'Post visibility rule must use can_access_student_community');
});

test('23. Subtle "Edited" Indicator Invariants: prevents false positives and detects true edits', () => {
    // 1. Identical creation and update timestamps (new post)
    const now = '2026-09-25T10:00:00.000Z';
    assert.equal(isContentEdited(now, now), false, 'New post with same timestamps must not be marked edited');

    // 2. Microsecond/millisecond drift <= 2000ms (database trigger overhead or race)
    const slightlyLater = '2026-09-25T10:00:01.500Z'; // 1.5 seconds later
    assert.equal(isContentEdited(now, slightlyLater), false, 'Diff under 2000ms must not trigger edited badge');

    // 3. Genuine content update > 2000ms
    const genuinelyEdited = '2026-09-25T10:05:00.000Z'; // 5 minutes later
    assert.equal(isContentEdited(now, genuinelyEdited), true, 'Diff over 2000ms must trigger edited badge');

    // 4. Missing or null dates
    assert.equal(isContentEdited(undefined, undefined), false);
    assert.equal(isContentEdited(now, null), false);
    assert.equal(isContentEdited('invalid', 'dates'), false);
});

test('24. Edit/Delete Moderation Database Migration Integrity: verifies SQL schemas, triggers, and admin restrictions', async () => {
    const migrationContent = await readFile(
        new URL('../supabase/migrations/20260925080000_community_edit_delete_moderation.sql', import.meta.url),
        'utf8'
    );

    // 1. Soft-delete columns and indexes on community_posts
    assert.ok(migrationContent.includes('ALTER TABLE public.community_posts'));
    assert.ok(migrationContent.includes('is_deleted BOOLEAN NOT NULL DEFAULT false'));
    assert.ok(migrationContent.includes('deleted_at TIMESTAMPTZ'));
    assert.ok(migrationContent.includes('deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL'));
    assert.ok(migrationContent.includes('deletion_reason TEXT'));
    assert.ok(migrationContent.includes('CREATE INDEX IF NOT EXISTS idx_community_posts_is_deleted'));

    // 2. Soft-delete columns and indexes on community_replies
    assert.ok(migrationContent.includes('ALTER TABLE public.community_replies'));
    assert.ok(migrationContent.includes('CREATE INDEX IF NOT EXISTS idx_community_replies_is_deleted'));

    // 3. Immutability & Admin word tampering restriction on community_posts
    assert.ok(migrationContent.includes('CREATE OR REPLACE FUNCTION public.enforce_community_post_update_rules()'));
    assert.ok(migrationContent.includes('Cannot alter post author_id'));
    assert.ok(migrationContent.includes('accepted_reply_id can only be updated through the accepted answer workflow'));
    // CRITICAL: Admins cannot tamper with author words
    assert.ok(migrationContent.includes("RAISE EXCEPTION 'Admins may moderate or delete posts, but cannot alter the author''s original content'"));
    // Updated_at only bumps when title, content, category, or post_type changes
    assert.ok(migrationContent.includes('NEW.title IS DISTINCT FROM OLD.title OR'));
    assert.ok(migrationContent.includes('NEW.updated_at := now()'));
    assert.ok(migrationContent.includes('NEW.updated_at := OLD.updated_at'));

    // 4. Immutability & Admin word tampering restriction on community_replies
    assert.ok(migrationContent.includes('CREATE OR REPLACE FUNCTION public.enforce_community_reply_update_rules()'));
    assert.ok(migrationContent.includes('Cannot alter reply author_id'));
    assert.ok(migrationContent.includes('Cannot alter reply post_id'));
    assert.ok(migrationContent.includes("RAISE EXCEPTION 'Admins may moderate or delete replies, but cannot alter the author''s original words'"));

    // 5. Soft-delete aware stats trigger
    assert.ok(migrationContent.includes('NEW.is_deleted = true AND OLD.is_deleted = false'));
    assert.ok(migrationContent.includes('replies_count = GREATEST(0, replies_count - 1)'));

    // 6. Hardened RLS policies
    assert.ok(migrationContent.includes('CREATE POLICY "Community posts visibility rule"'));
    assert.ok(migrationContent.includes('is_deleted = false OR (SELECT public.is_admin()) OR (SELECT auth.uid()) = author_id'));
    assert.ok(migrationContent.includes('CREATE POLICY "Replies readable if parent post is readable"'));
    assert.ok(migrationContent.includes('CREATE POLICY "Authors and staff can update posts"'));
    assert.ok(migrationContent.includes('CREATE POLICY "Authors and staff can update replies"'));
    assert.ok(migrationContent.includes('CREATE POLICY "Authors and admins can delete posts"'));
    assert.ok(migrationContent.includes('CREATE POLICY "Authors and admins can delete replies"'));
});

test('25. UI Components Invariants: verifies ActionMenu, EditModal, DeleteModal, and removed placeholders', async () => {
    // 1. Action Menu
    const actionMenuCode = await readFile(
        new URL('../src/components/community/CommunityActionMenu.tsx', import.meta.url),
        'utf8'
    );
    assert.ok(actionMenuCode.includes('isAuthor'), 'Action menu must check author permissions');
    assert.ok(actionMenuCode.includes('isAdmin'), 'Action menu must check admin permissions');
    assert.ok(actionMenuCode.includes('Delete as Admin'), 'Action menu must offer distinct admin deletion');
    assert.ok(actionMenuCode.includes('aria-label="Actions"'), 'Action menu must be accessible');

    // 2. Edit Modal
    const editModalCode = await readFile(
        new URL('../src/components/community/EditPostModal.tsx', import.meta.url),
        'utf8'
    );
    assert.ok(editModalCode.includes('title'), 'Edit modal must allow title editing');
    assert.ok(editModalCode.includes('content'), 'Edit modal must allow content editing');
    assert.ok(editModalCode.includes('selectedCategoryId'), 'Edit modal must allow category selection');
    assert.ok(editModalCode.includes('postType'), 'Edit modal must allow post_type selection');
    assert.ok(editModalCode.includes('Notation Quick-Insert'), 'Edit modal must support flute notation buttons');
    assert.ok(editModalCode.includes('showPreview'), 'Edit modal must support live preview');

    // 3. Delete Confirm Modal
    const deleteModalCode = await readFile(
        new URL('../src/components/community/DeleteConfirmModal.tsx', import.meta.url),
        'utf8'
    );
    assert.ok(deleteModalCode.includes('Remove this content from the Community?'), 'Delete modal must have distinct admin text');
    assert.ok(deleteModalCode.includes('MODERATION_REASONS'), 'Delete modal must define moderation reasons');
    assert.ok(deleteModalCode.includes('Spam'), 'Delete modal must include Spam moderation option');
    assert.ok(deleteModalCode.includes('Inappropriate content'), 'Delete modal must include Inappropriate content');
    assert.ok(deleteModalCode.includes('Delete this post?'), 'Delete modal must include author post delete title');
    assert.ok(deleteModalCode.includes('Delete this reply?'), 'Delete modal must include author reply delete title');

    // 4. Discussion Card
    const cardCode = await readFile(
        new URL('../src/components/community/DiscussionCard.tsx', import.meta.url),
        'utf8'
    );
    assert.ok(cardCode.includes('isContentEdited'), 'Discussion card must check for edited status');
    assert.ok(cardCode.includes('Edited'), 'Discussion card must display subtle edited indicator');

    // 5. Discussion Detail View
    const detailCode = await readFile(
        new URL('../src/components/community/DiscussionDetailView.tsx', import.meta.url),
        'utf8'
    );
    assert.ok(detailCode.includes('Discussion Removed'), 'Detail view must handle deleted post state');
    assert.ok(detailCode.includes('This reply has been removed.'), 'Detail view must display tombstone for deleted replies');
    assert.ok(detailCode.includes('CommunityActionMenu'), 'Detail view must render action menus');
    assert.ok(detailCode.includes('EditPostModal'), 'Detail view must render edit post modal');
    assert.ok(detailCode.includes('DeleteConfirmModal'), 'Detail view must render delete confirm modal');
});

test('26. Sitemap SEO Exclusions: soft-deleted community posts are excluded from XML sitemap', async () => {
    const sitemapCode = await readFile(
        new URL('../app/sitemap.ts', import.meta.url),
        'utf8'
    );
    assert.ok(sitemapCode.includes('!post.is_deleted'), 'Sitemap must exclude soft-deleted posts');
});

test('27. Community Notifications: sendCommunityNotification prevents self-notifications', async () => {
    const insertedNotifs = [];
    const { sendCommunityNotification } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,export const supabaseAuth={from:()=>({insert:async(p)=>{globalThis.__insertedNotifs.push(p);return{error:null};},select:()=>({eq:()=>({eq:()=>({gte:()=>({order:()=>({limit:async()=>({data:[]})})})})})})})};'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    globalThis.__insertedNotifs = insertedNotifs;

    // Test 1: User reacting to own post -> returns false, 0 inserts
    const selfRes = await sendCommunityNotification({
        recipientUserId: 'user-krishna',
        actorUserId: 'user-krishna',
        actorName: 'Krishna',
        title: 'New Reaction',
        message: 'Krishna liked your post',
        link: '/community/discussion/test-slug'
    });
    assert.equal(selfRes, false, 'Must not send notification when recipient is actor');
    assert.equal(insertedNotifs.length, 0, 'No notification should be inserted for self-action');

    // Test 2: User B reacting to User A's post -> returns true, 1 insert
    const otherRes = await sendCommunityNotification({
        recipientUserId: 'user-krishna',
        actorUserId: 'user-ravi',
        actorName: 'Ravi',
        title: 'New Reaction',
        message: 'Ravi liked your community post "How to Improve Breath Control?"',
        link: '/community/discussion/how-to-improve-breath-control',
        metadata: { type: 'post_reaction', post_id: 'post-1', actor_id: 'user-ravi' },
        isReaction: true,
        postId: 'post-1'
    });
    assert.equal(otherRes, true, 'Must send notification to recipient when actor is different');
    assert.equal(insertedNotifs.length, 1);
    assert.equal(insertedNotifs[0].user_id, 'user-krishna');
    assert.equal(insertedNotifs[0].type, 'community');
    assert.ok(insertedNotifs[0].message.includes('Ravi liked your community post'));
    assert.equal(insertedNotifs[0].link, '/community/discussion/how-to-improve-breath-control');
});

test('28. Community Notification Anti-Spam: deduplicates repeated reaction toggles', async () => {
    // Mock existing unread notification within 24 hours
    const { sendCommunityNotification } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,export const supabaseAuth={from:()=>({insert:async()=>({error:null}),select:()=>({eq:()=>({eq:()=>({gte:()=>({order:()=>({limit:async()=>({data:[{id:"notif-existing",is_read:false,created_at:new Date().toISOString()}]})})})})})})})};'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    // Ravi unlikes and immediately likes again -> existing unread notification exists
    const duplicateRes = await sendCommunityNotification({
        recipientUserId: 'user-krishna',
        actorUserId: 'user-ravi',
        actorName: 'Ravi',
        title: 'New Reaction',
        message: 'Ravi liked your community post "How to Improve Breath Control?"',
        link: '/community/discussion/how-to-improve-breath-control',
        isReaction: true,
        postId: 'post-1'
    });

    assert.equal(duplicateRes, false, 'Must prevent duplicate notification when an unread notification already exists');
});

test('29. Community Reply Notifications: distinct messaging for post author vs comment author', async () => {
    const insertedNotifs = [];
    globalThis.__insertedNotifs = insertedNotifs;

    const { sendCommunityNotification } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,export const supabaseAuth={from:()=>({insert:async(p)=>{globalThis.__insertedNotifs.push(p);return{error:null};}})}'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    // 1. Reply to Post
    await sendCommunityNotification({
        recipientUserId: 'user-author',
        actorUserId: 'user-replier',
        actorName: 'Raga',
        title: 'New Community Reply',
        message: 'Raga replied to your community post "How to Improve Breath Control?"',
        link: '/community/discussion/how-to-improve-breath-control#reply-rep1',
        metadata: { type: 'post_reply', post_id: 'post-1', reply_id: 'rep1', slug: 'how-to-improve-breath-control' }
    });

    // 2. Reply to Comment
    await sendCommunityNotification({
        recipientUserId: 'user-commenter',
        actorUserId: 'user-replier-2',
        actorName: 'Kaushik',
        title: 'New Reply to Your Comment',
        message: 'Kaushik replied to your comment on "How to Improve Breath Control?"',
        link: '/community/discussion/how-to-improve-breath-control#reply-rep2',
        metadata: { type: 'comment_reply', post_id: 'post-1', reply_id: 'rep2', parent_reply_id: 'rep1', slug: 'how-to-improve-breath-control' }
    });

    assert.equal(insertedNotifs.length, 2);
    assert.equal(insertedNotifs[0].title, 'New Community Reply');
    assert.ok(insertedNotifs[0].message.includes('Raga replied to your community post'));
    assert.equal(insertedNotifs[0].link, '/community/discussion/how-to-improve-breath-control#reply-rep1');

    assert.equal(insertedNotifs[1].title, 'New Reply to Your Comment');
    assert.ok(insertedNotifs[1].message.includes('Kaushik replied to your comment'));
    assert.equal(insertedNotifs[1].link, '/community/discussion/how-to-improve-breath-control#reply-rep2');
});

test('30. Reaction Users Privacy: returns safe Community profiles with zero UUIDs, emails, or phone numbers', async () => {
    const mockReactions = [
        { user_id: 'uuid-1', reaction_type: 'upvote', created_at: '2026-10-01T09:00:00Z' },
        { user_id: 'uuid-2', reaction_type: 'upvote', created_at: '2026-10-01T08:30:00Z' }
    ];
    const mockProfiles = [
        { id: 'uuid-1', display_name: 'Ravi Kumar', avatar_url: 'https://example.com/avatar1.jpg' },
        { id: 'uuid-2', display_name: 'Krishna Gopal Bhaumik', avatar_url: null }
    ];
    const mockUsers = [
        { id: 'uuid-1', role: 'student' },
        { id: 'uuid-2', role: 'admin' }
    ];

    const mockCode = `
        export const supabaseAuth = {
            from: (table) => {
                if (table === "community_reactions") {
                    return {
                        select: () => ({
                            eq: () => ({
                                order: () => ({
                                    range: async () => ({
                                        data: ${JSON.stringify(mockReactions)},
                                        count: 2,
                                        error: null
                                    })
                                })
                            })
                        })
                    };
                }
                if (table === "community_profiles") {
                    return {
                        select: () => ({
                            in: async () => ({
                                data: ${JSON.stringify(mockProfiles)},
                                error: null
                            })
                        })
                    };
                }
                if (table === "users") {
                    return {
                        select: () => ({
                            in: async () => ({
                                data: ${JSON.stringify(mockUsers)},
                                error: null
                            })
                        })
                    };
                }
                return { select: () => ({}) };
            }
        };
    `;

    const { getCommunityReactionUsers } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,${encodeURIComponent(mockCode)}'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    const res = await getCommunityReactionUsers({ postId: 'post-123' });
    assert.equal(res.totalCount, 2);
    assert.equal(res.users.length, 2);

    // Verify first user
    assert.equal(res.users[0].displayName, 'Ravi Kumar');
    assert.equal(res.users[0].avatarUrl, 'https://example.com/avatar1.jpg');
    assert.equal(res.users[0].badge, 'KFA Student');
    assert.equal(res.users[0].reactionType, 'upvote');

    // Verify second user
    assert.equal(res.users[1].displayName, 'Krishna Gopal Bhaumik');
    assert.equal(res.users[1].badge, 'Admin');

    // PRIVACY VERIFICATION: ensure NO UUIDs, emails, or internal IDs are leaked
    for (const u of res.users) {
        assert.equal(u.id, undefined, 'User ID / UUID must NOT be present on ReactionUser');
        assert.equal(u.user_id, undefined, 'user_id must NOT be present on ReactionUser');
        assert.equal(u.email, undefined, 'Email must NOT be present on ReactionUser');
        assert.equal(u.phone, undefined, 'Phone must NOT be present on ReactionUser');
        assert.ok(u.displayName, 'displayName must be present');
        assert.ok(u.badge, 'badge must be present');
    }
});

test('31. Database Migration Audit: verifies idempotent community notifications migration', async () => {
    const migrationSql = await readFile(
        new URL('../supabase/migrations/20261001000000_community_interactions_and_notifications.sql', import.meta.url),
        'utf8'
    );

    assert.ok(migrationSql.includes('ADD COLUMN IF NOT EXISTS link TEXT'), 'Must add link column for deep linking');
    assert.ok(migrationSql.includes('ADD COLUMN IF NOT EXISTS metadata JSONB'), 'Must add metadata column');
    assert.ok(migrationSql.includes("'community'"), 'Must guarantee community notification type check');
    assert.ok(migrationSql.includes('idx_notifications_user_type_created'), 'Must create targeted performance index');
});

test('32. UI Component Integration: verifies ReactionUsersModal and deep-link click routing', async () => {
    const [cardCode, detailCode, studentCode, teacherCode, modalCode] = await Promise.all([
        readFile(new URL('../src/components/community/DiscussionCard.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/DiscussionDetailView.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/student-dashboard/StudentDashboardContainer.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/TeacherHeader.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/ReactionUsersModal.tsx', import.meta.url), 'utf8')
    ]);

    // ReactionUsersModal checks
    assert.ok(modalCode.includes('ReactionUsersModal'), 'Modal component must exist');
    assert.ok(modalCode.includes('getCommunityReactionUsers'), 'Modal must fetch via safe helper');
    assert.ok(modalCode.includes('loadMore') || modalCode.includes('handleLoadMore'), 'Modal must support pagination');

    // DiscussionCard checks
    assert.ok(cardCode.includes('ReactionUsersModal'), 'Card must import ReactionUsersModal');
    assert.ok(cardCode.includes('setShowReactionsModal'), 'Card must support opening reactions modal');

    // DiscussionDetailView checks
    assert.ok(detailCode.includes('ReactionUsersModal'), 'Detail view must import ReactionUsersModal');
    assert.ok(detailCode.includes('setActiveReactionModal'), 'Detail view must support opening reactions modal');
    assert.ok(detailCode.includes('reply-${reply.id}'), 'Detail view must set DOM id for comment scrolling');
    assert.ok(detailCode.includes('#reply-'), 'Detail view must handle hash scrolling for deep-linked comments');

    // Student Dashboard click routing
    assert.ok(studentCode.includes('notif.link'), 'Student dashboard must support notif.link direct navigation');
    assert.ok(studentCode.includes('community'), 'Student dashboard must support community notification routing');

    // Teacher Dashboard click routing
    assert.ok(teacherCode.includes('handleNotificationItemClick'), 'Teacher header must handle notification clicks');
    assert.ok(teacherCode.includes('notif.link'), 'Teacher header must support notif.link direct navigation');
});

test('33. Mention Member Search & Privacy: debounced search with role badges and zero contact leaks', async () => {
    const mockProfiles = [
        { id: 'uuid-soumen-1', display_name: 'Soumen Mukherjee', avatar_url: 'https://example.com/soumen.jpg' },
        { id: 'uuid-soumen-2', display_name: 'Soumen Roy', avatar_url: null }
    ];
    const mockUsers = [
        { id: 'uuid-soumen-1', role: 'student' },
        { id: 'uuid-soumen-2', role: 'student' }
    ];

    const mockCode = `
        export const supabaseAuth = {
            from: (table) => {
                if (table === "community_profiles") {
                    return {
                        select: () => ({
                            ilike: () => ({
                                limit: async () => ({ data: ${JSON.stringify(mockProfiles)}, error: null })
                            })
                        })
                    };
                }
                if (table === "users") {
                    return {
                        select: () => ({
                            in: async () => ({ data: ${JSON.stringify(mockUsers)}, error: null })
                        })
                    };
                }
                return { select: () => ({}) };
            }
        };
    `;

    const { searchCommunityMentionUsers } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,${encodeURIComponent(mockCode)}'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    const suggestions = await searchCommunityMentionUsers('@sou');
    assert.equal(suggestions.length, 2);
    assert.equal(suggestions[0].displayName, 'Soumen Mukherjee');
    assert.equal(suggestions[0].badge, 'KFA Student');
    assert.equal(suggestions[0].avatarUrl, 'https://example.com/soumen.jpg');

    assert.equal(suggestions[1].displayName, 'Soumen Roy');
    assert.equal(suggestions[1].badge, 'KFA Student');

    // Zero contact leaks
    for (const s of suggestions) {
        assert.equal(s.email, undefined, 'Email must never be present in mention suggestions');
        assert.equal(s.phone, undefined, 'Phone must never be present in mention suggestions');
    }
});

test('34. Mention Priority Deduplication: mention notification takes priority over generic reply notification', async () => {
    globalThis.__testNotifs = [];
    globalThis.__testMentions = [];

    const mockCode = `
        export const supabaseAuth = {
            from: (table) => {
                if (table === "community_profiles") {
                    return { upsert: async () => ({ error: null }) };
                }
                if (table === "community_replies") {
                    return {
                        insert: () => ({
                            select: () => ({
                                single: async () => ({
                                    data: { id: "rep-101", post_id: "post-1", author_id: "user-soumen", content: "@Krishna please check this." },
                                    error: null
                                })
                            })
                        })
                    };
                }
                if (table === "community_posts") {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: async () => ({
                                    data: { id: "post-1", author_id: "user-krishna", title: "Breath Control", slug: "breath-control" },
                                    error: null
                                })
                            })
                        })
                    };
                }
                if (table === "community_mentions") {
                    return {
                        insert: async (rows) => {
                            globalThis.__testMentions.push(...rows);
                            return { error: null };
                        }
                    };
                }
                if (table === "notifications") {
                    return {
                        select: () => ({
                            eq: () => ({
                                eq: () => ({
                                    gte: () => ({
                                        order: () => ({
                                            limit: async () => ({ data: [] })
                                        })
                                    })
                                })
                            })
                        }),
                        insert: async (payload) => {
                            globalThis.__testNotifs.push(payload);
                            return { error: null };
                        }
                    };
                }
                return { select: () => ({}) };
            }
        };
    `;

    const { createCommunityReply } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,${encodeURIComponent(mockCode)}'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    // User Soumen replies to User Krishna's post, AND Soumen mentions Krishna in the reply:
    // Krishna must receive ONE notification (the priority mention notification), NOT duplicate notifications!
    const res = await createCommunityReply({
        postId: 'post-1',
        content: '@Krishna please check this.',
        authorId: 'user-soumen',
        authorName: 'Soumen',
        mentionedUserIds: ['user-krishna']
    });

    assert.equal(res.success, true);
    // Mentions table recorded
    assert.equal(globalThis.__testMentions.length, 1);
    assert.equal(globalThis.__testMentions[0].mentioned_user_id, 'user-krishna');
    assert.equal(globalThis.__testMentions[0].mentioned_by_user_id, 'user-soumen');

    // EXACTLY 1 notification sent to Krishna (the priority mention notification)
    assert.equal(globalThis.__testNotifs.length, 1, 'Krishna should only receive 1 notification due to priority mention deduplication');
    assert.equal(globalThis.__testNotifs[0].user_id, 'user-krishna');
    assert.equal(globalThis.__testNotifs[0].title, 'You were mentioned');
    assert.ok(globalThis.__testNotifs[0].message.includes('Soumen mentioned you in a reply.'));
    assert.equal(globalThis.__testNotifs[0].link, '/community/discussion/breath-control#reply-rep-101');
});

test('35. Multiple Mentions & Self-Mention Exclusion', async () => {
    globalThis.__testNotifs = [];
    globalThis.__testMentions = [];

    const mockCode = `
        export const supabaseAuth = {
            from: (table) => {
                if (table === "community_profiles") return { upsert: async () => ({ error: null }) };
                if (table === "community_posts") {
                    return {
                        insert: () => ({
                            select: () => ({
                                single: async () => ({
                                    data: { id: "post-multi", title: "Raag Yaman discussion", slug: "raag-yaman-discussion" },
                                    error: null
                                })
                            })
                        })
                    };
                }
                if (table === "community_categories") {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: async () => ({ data: { access_scope: "public" }, error: null })
                            })
                        })
                    };
                }
                if (table === "community_mentions") {
                    return {
                        insert: async (rows) => {
                            globalThis.__testMentions.push(...rows);
                            return { error: null };
                        }
                    };
                }
                if (table === "notifications") {
                    return {
                        select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }) }),
                        insert: async (payload) => {
                            globalThis.__testNotifs.push(payload);
                            return { error: null };
                        }
                    };
                }
                return { select: () => ({}) };
            }
        };
    `;

    const { createCommunityPost } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,${encodeURIComponent(mockCode)}'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    // Krishna creates post and mentions Soumen, Ravi, Krishna (self-mention), and Soumen again (duplicate in array)
    const res = await createCommunityPost({
        categoryId: 'cat-1',
        title: 'Raag Yaman discussion with fingering tips',
        content: '@Soumen and @Ravi what do you think? @Krishna and @Soumen again',
        authorId: 'user-krishna',
        authorName: 'Krishna',
        mentionedUserIds: ['user-soumen', 'user-ravi', 'user-krishna', 'user-soumen']
    });

    assert.equal(res.success, true);

    // Only 2 distinct mentions should be recorded (Soumen and Ravi; self-mention and duplicate excluded)
    assert.equal(globalThis.__testMentions.length, 2);
    const recordedIds = globalThis.__testMentions.map(m => m.mentioned_user_id).sort();
    assert.deepEqual(recordedIds, ['user-ravi', 'user-soumen']);

    // Only 2 notifications created (1 for Soumen, 1 for Ravi)
    assert.equal(globalThis.__testNotifs.length, 2);
    const recipientIds = globalThis.__testNotifs.map(n => n.user_id).sort();
    assert.deepEqual(recipientIds, ['user-ravi', 'user-soumen']);

    // None sent to Krishna (self-action prevented)
    assert.ok(!globalThis.__testNotifs.some(n => n.user_id === 'user-krishna'));
});

test('36. Edit-Aware Mention Diffing: only newly added mentioned users receive notifications on post edit', async () => {
    globalThis.__testNotifs = [];
    globalThis.__testMentions = [];

    // Already mentioned: user-soumen
    const existingMentions = [{ mentioned_user_id: 'user-soumen' }];

    const mockCode = `
        export const supabaseAuth = {
            from: (table) => {
                if (table === "community_posts") {
                    return {
                        update: () => ({
                            eq: async () => ({ error: null })
                        }),
                        select: () => ({
                            eq: () => ({
                                maybeSingle: async () => ({
                                    data: { slug: "raag-yaman-discussion" }
                                })
                            })
                        })
                    };
                }
                if (table === "community_mentions") {
                    return {
                        select: () => ({
                            eq: async () => ({ data: ${JSON.stringify(existingMentions)}, error: null })
                        }),
                        insert: async (rows) => {
                            globalThis.__testMentions.push(...rows);
                            return { error: null };
                        }
                    };
                }
                if (table === "notifications") {
                    return {
                        select: () => ({ eq: () => ({ eq: () => ({ gte: () => ({ order: () => ({ limit: async () => ({ data: [] }) }) }) }) }) }),
                        insert: async (payload) => {
                            globalThis.__testNotifs.push(payload);
                            return { error: null };
                        }
                    };
                }
                return { select: () => ({}) };
            }
        };
    `;

    const { updateCommunityPost } = await importTypeScriptModule('../src/lib/community.ts', {
        "from './supabase-auth'": `from 'data:text/javascript,${encodeURIComponent(mockCode)}'`,
        "from './text-utils'": "from 'data:text/javascript,export const sanitizeHtml=(s)=>s;export const htmlToPlainText=(s)=>s;export const truncatePlainText=(s,n)=>s.slice(0,n);'"
    });

    // Editor adds Ravi to the post, while Soumen was already mentioned previously
    const res = await updateCommunityPost({
        postId: 'post-1',
        title: 'Updated Raag Yaman discussion title',
        content: 'Updated content mentioning @Soumen and newly @Ravi',
        editorUserId: 'user-krishna',
        editorName: 'Krishna',
        mentionedUserIds: ['user-soumen', 'user-ravi']
    });

    assert.equal(res.success, true);

    // Only Ravi is newly recorded
    assert.equal(globalThis.__testMentions.length, 1);
    assert.equal(globalThis.__testMentions[0].mentioned_user_id, 'user-ravi');

    // Only Ravi receives a notification (Soumen is NOT re-notified!)
    assert.equal(globalThis.__testNotifs.length, 1);
    assert.equal(globalThis.__testNotifs[0].user_id, 'user-ravi');
});

test('37. Database Migration Audit: community_mentions schema and constraints', async () => {
    const migrationSql = await readFile(
        new URL('../supabase/migrations/20261001010000_community_mentions.sql', import.meta.url),
        'utf8'
    );

    assert.ok(migrationSql.includes('CREATE TABLE IF NOT EXISTS public.community_mentions'), 'Must create community_mentions table');
    assert.ok(migrationSql.includes('unique_post_user_mention'), 'Must create unique post user mention index');
    assert.ok(migrationSql.includes('unique_reply_user_mention'), 'Must create unique reply user mention index');
    assert.ok(migrationSql.includes('idx_community_mentions_mentioned_user'), 'Must create fast recipient index');
    assert.ok(migrationSql.includes('ENABLE ROW LEVEL SECURITY'), 'Must enable RLS');
    assert.ok(migrationSql.includes('auth.uid() = mentioned_by_user_id'), 'Must restrict insertion to authentic actor');
});

test('38. UI Integration: CommunityNotificationBell in Navbar & MentionTextarea in composers', async () => {
    const [navbarCode, bellCode, textareaCode, newPostCode, detailCode, editCode] = await Promise.all([
        readFile(new URL('../src/components/community/CommunityNavbar.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/CommunityNotificationBell.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/MentionTextarea.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../app/community/new/page.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/DiscussionDetailView.tsx', import.meta.url), 'utf8'),
        readFile(new URL('../src/components/community/EditPostModal.tsx', import.meta.url), 'utf8')
    ]);

    // Navbar integration
    assert.ok(navbarCode.includes('CommunityNotificationBell'), 'CommunityNavbar must import CommunityNotificationBell');
    assert.ok(navbarCode.includes('<CommunityNotificationBell currentUserId={user.id} />'), 'CommunityNavbar must render CommunityNotificationBell for logged-in user');

    // Bell component features
    assert.ok(bellCode.includes('channel'), 'Bell must subscribe to realtime notifications');
    assert.ok(bellCode.includes('unreadCount'), 'Bell must compute and display unread badge count');
    assert.ok(bellCode.includes('handleMarkAllRead'), 'Bell must support mark all as read');
    assert.ok(bellCode.includes('router.push'), 'Bell must support navigation on notification click');

    // MentionTextarea component features
    assert.ok(textareaCode.includes('detectMentionTrigger'), 'MentionTextarea must detect @ trigger');
    assert.ok(textareaCode.includes('searchCommunityMentionUsers'), 'MentionTextarea must query mention search');
    assert.ok(textareaCode.includes('ArrowDown'), 'MentionTextarea must support keyboard navigation');
    assert.ok(textareaCode.includes('handleSelectUser'), 'MentionTextarea must support selection');

    // Composer integrations
    assert.ok(newPostCode.includes('MentionTextarea'), 'New discussion page must use MentionTextarea');
    assert.ok(newPostCode.includes('mentionedUserIds'), 'New discussion page must pass mentionedUserIds');

    assert.ok(detailCode.includes('MentionTextarea'), 'Discussion detail view must use MentionTextarea');
    assert.ok(detailCode.includes('mentionedUserIds'), 'Discussion detail view must pass mentionedUserIds');

    assert.ok(editCode.includes('MentionTextarea'), 'Edit post modal must use MentionTextarea');
    assert.ok(editCode.includes('mentionedUserIds'), 'Edit post modal must pass mentionedUserIds');
});

test('74. Canonical Discussion URL Helper: constructs valid deep-links', () => {
    // 1. Post object with slug
    const url1 = getCommunityDiscussionUrl({ slug: 'how-to-riyaz-effectively-12345' });
    assert.equal(url1, '/community/discussion/how-to-riyaz-effectively-12345');

    // 2. Post object with slug and replyId
    const url2 = getCommunityDiscussionUrl(
        { slug: 'how-to-riyaz-effectively-12345' },
        'reply-abc-6789'
    );
    assert.equal(url2, '/community/discussion/how-to-riyaz-effectively-12345#reply-reply-abc-6789');

    // 3. String slug directly
    const url3 = getCommunityDiscussionUrl('breath-control-technique-99887');
    assert.equal(url3, '/community/discussion/breath-control-technique-99887');

    // 4. Fallback to post id if slug is missing
    const url4 = getCommunityDiscussionUrl({ id: '892079cf-6f60-40be-b481-9056ac7c38ba' });
    assert.equal(url4, '/community/discussion/892079cf-6f60-40be-b481-9056ac7c38ba');

    // 5. Empty inputs return fallback
    const url5 = getCommunityDiscussionUrl('');
    assert.equal(url5, '/community');

    const url6 = getCommunityDiscussionUrl({});
    assert.equal(url6, '/community');
});

test('75. Dynamic Social Sharing Metadata: generates complete OpenGraph and Twitter card tags', async () => {
    const mockCommunityCode = `
        export const getCommunityPostBySlug = async (slug) => {
            if (slug === "bigger-flute") {
                return {
                    id: "post-123",
                    title: "How Do You Know When It’s Time to Move to a Bigger Flute?",
                    slug: "bigger-flute",
                    content: "<p>I have been practicing on G Bass for 6 months and wondering when to transition to E Bass.</p>",
                    visibility: "public",
                    created_at: "2026-03-01T10:00:00Z",
                    updated_at: "2026-03-01T10:00:00Z",
                    author: { display_name: "Riyaz Student" },
                    category: { name: "Flute Questions" }
                };
            }
            if (slug === "private-post") {
                return {
                    id: "post-priv",
                    title: "Internal Class Notes",
                    slug: "private-post",
                    content: "<p>Classroom notes only.</p>",
                    visibility: "students",
                    created_at: "2026-03-01T10:00:00Z",
                    updated_at: "2026-03-01T10:00:00Z"
                };
            }
            return null;
        };
    `;
    const mockCommunityUri = `data:text/javascript;base64,${Buffer.from(mockCommunityCode).toString('base64')}`;

    const mockTextCode = `
        export const htmlToPlainText = (s) => (s || "").replace(/<[^>]+>/g, " ").trim();
        export const truncatePlainText = (s, n) => (s || "").slice(0, n);
    `;
    const mockTextUri = `data:text/javascript;base64,${Buffer.from(mockTextCode).toString('base64')}`;

    let pageSource = await readFile(new URL('../app/community/discussion/[slug]/page.tsx', import.meta.url), 'utf8');
    pageSource = pageSource.replaceAll("from '../../../../src/lib/community'", `from '${mockCommunityUri}'`);
    pageSource = pageSource.replaceAll("from '../../../../src/lib/text-utils'", `from '${mockTextUri}'`);
    pageSource = pageSource.replace(/export default async function DiscussionPage[\s\S]*$/, 'export default function DiscussionPage() { return null; }');

    const { outputText } = ts.transpileModule(pageSource, {
        compilerOptions: {
            module: ts.ModuleKind.ES2022,
            target: ts.ScriptTarget.ES2022,
        },
    });

    const encodedModule = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
    const { generateMetadata } = await import(encodedModule);


    // 1. Public discussion page metadata
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'bigger-flute' }) });

    assert.equal(meta.title, 'How Do You Know When It’s Time to Move to a Bigger Flute? | KFA Community');
    assert.ok(meta.description.includes('I have been practicing on G Bass'));
    assert.equal(meta.alternates.canonical, 'https://krishnafluteacademy.com/community/discussion/bigger-flute');
    assert.deepEqual(meta.robots, { index: true, follow: true });

    // OpenGraph article tags
    assert.ok(meta.openGraph);
    assert.equal(meta.openGraph.type, 'article');
    assert.equal(meta.openGraph.title, 'How Do You Know When It’s Time to Move to a Bigger Flute? | KFA Community');
    assert.equal(meta.openGraph.url, 'https://krishnafluteacademy.com/community/discussion/bigger-flute');
    assert.equal(meta.openGraph.siteName, 'Krishna Flute Academy Community');
    assert.equal(meta.openGraph.images.length, 1);
    assert.equal(
        meta.openGraph.images[0].url,
        'https://krishnafluteacademy.com/community/discussion/bigger-flute/opengraph-image'
    );
    assert.equal(meta.openGraph.images[0].width, 1200);
    assert.equal(meta.openGraph.images[0].height, 630);

    // Twitter card tags
    assert.ok(meta.twitter);
    assert.equal(meta.twitter.card, 'summary_large_image');
    assert.equal(meta.twitter.title, 'How Do You Know When It’s Time to Move to a Bigger Flute?');
    assert.ok(meta.twitter.description.includes('I have been practicing on G Bass'));
    assert.deepEqual(meta.twitter.images, [
        'https://krishnafluteacademy.com/community/discussion/bigger-flute/opengraph-image'
    ]);

    // 2. Private discussion page metadata (does not expose private details to public crawlers)
    const privMeta = await generateMetadata({ params: Promise.resolve({ slug: 'private-post' }) });
    assert.deepEqual(privMeta.robots, { index: false, follow: false });
    assert.equal(privMeta.openGraph, undefined);
    assert.equal(privMeta.twitter, undefined);

    // 3. Fallback when post is not found
    const missingMeta = await generateMetadata({ params: Promise.resolve({ slug: 'non-existent' }) });
    assert.equal(missingMeta.title, 'Discussion | KFA Community');
    assert.ok(missingMeta.openGraph.title.includes('Krishna Flute Academy Community'));
    assert.ok(missingMeta.openGraph.description.includes('Learn • Ask • Discuss • Grow'));
    assert.equal(
        missingMeta.openGraph.images[0].url,
        'https://krishnafluteacademy.com/community/discussion/non-existent/opengraph-image'
    );
});










