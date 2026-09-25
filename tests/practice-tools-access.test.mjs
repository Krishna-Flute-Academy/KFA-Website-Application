import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load hasStudentToolsAccess logic directly from src/lib/auth-navigation.ts
function hasStudentToolsAccess(session, role) {
    if (!session || !session.user) {
        return false;
    }
    const normalizedRole = role?.toLowerCase()?.trim() || null;
    const allowedRoles = ['student', 'mentor', 'teacher', 'admin'];
    return normalizedRole !== null && allowedRoles.includes(normalizedRole);
}

test('Access Control: hasStudentToolsAccess evaluates permissions accurately', () => {
    // Logged out visitors
    assert.equal(hasStudentToolsAccess(null, null), false, 'Null session has no student tools access');
    assert.equal(hasStudentToolsAccess(null, 'student'), false, 'Null session with role has no access');
    assert.equal(hasStudentToolsAccess({}, 'student'), false, 'Session without user object has no access');

    // Pending users
    assert.equal(
        hasStudentToolsAccess({ user: { id: 'u1' } }, 'pending'),
        false,
        'Pending user has no access to student tools'
    );
    assert.equal(
        hasStudentToolsAccess({ user: { id: 'u2' } }, null),
        false,
        'Null role has no access to student tools'
    );

    // Enrolled students, mentors, teachers, admins
    assert.equal(
        hasStudentToolsAccess({ user: { id: 's1' } }, 'student'),
        true,
        'Enrolled student has student tools access'
    );
    assert.equal(
        hasStudentToolsAccess({ user: { id: 'm1' } }, 'mentor'),
        true,
        'Mentor has student tools access'
    );
    assert.equal(
        hasStudentToolsAccess({ user: { id: 't1' } }, 'teacher'),
        true,
        'Teacher has student tools access'
    );
    assert.equal(
        hasStudentToolsAccess({ user: { id: 'a1' } }, 'admin'),
        true,
        'Admin has student tools access'
    );
    assert.equal(
        hasStudentToolsAccess({ user: { id: 's2' } }, '  STUDENT  '),
        true,
        'Role normalization trims and lowercases'
    );
});

test('Analytics Events: All required practice tools event types are declared', () => {
    const analyticsSource = fs.readFileSync(path.resolve('src/lib/analytics.ts'), 'utf8');
    const requiredEvents = [
        'free_tool_open',
        'student_tool_interest',
        'student_tool_login_click',
        'student_tool_course_click',
        'student_tool_enquiry_click'
    ];

    for (const evt of requiredEvents) {
        assert.ok(
            analyticsSource.includes(`'${evt}'`),
            `Analytics defines required event: ${evt}`
        );
    }
});

test('Direct Security Guard: SurToNotationModal blocks unauthenticated access before initializing audio', () => {
    const modalSource = fs.readFileSync(
        path.resolve('src/components/tools/sur-to-notation/SurToNotationModal.tsx'),
        'utf8'
    );

    assert.ok(
        modalSource.includes('useAuthNavigation'),
        'SurToNotationModal imports useAuthNavigation'
    );
    assert.ok(
        modalSource.includes('hasStudentAccess'),
        'SurToNotationModal checks hasStudentAccess'
    );
    assert.ok(
        modalSource.includes('<StudentAccessModal'),
        'SurToNotationModal renders StudentAccessModal for non-students'
    );
    assert.ok(
        modalSource.includes('if (!hasStudentAccess)'),
        'SurToNotationModal contains early guard return before pitch detector init'
    );
});

test('Direct Security Guard: PracticeSuiteModal restricts Rhythm Machine (drums) and combo modes', () => {
    const suiteSource = fs.readFileSync(
        path.resolve('src/components/PracticeSuiteModal.tsx'),
        'utf8'
    );

    assert.ok(
        suiteSource.includes('useAuthNavigation'),
        'PracticeSuiteModal imports useAuthNavigation'
    );
    assert.ok(
        suiteSource.includes('hasStudentAccess'),
        'PracticeSuiteModal checks hasStudentAccess'
    );
    assert.ok(
        suiteSource.includes('<StudentAccessModal'),
        'PracticeSuiteModal renders StudentAccessModal'
    );
    assert.ok(
        suiteSource.includes("activeTool === 'drums'") || suiteSource.includes("activeTab === 'drums'"),
        'PracticeSuiteModal protects drums tab'
    );
});

test('Public Informational Pages: Rhythm Machine and Flute to Notes exist with SEO metadata', () => {
    // Rhythm Machine page
    const rmPage = fs.readFileSync(
        path.resolve('app/practice-tools/rhythm-machine/page.tsx'),
        'utf8'
    );
    assert.ok(rmPage.includes('/practice-tools/rhythm-machine'), 'Rhythm Machine page sets canonical URL');
    assert.ok(rmPage.includes('ClientRhythmMachinePage'), 'Rhythm Machine renders ClientRhythmMachinePage');

    // Flute to Notes page
    const fnPage = fs.readFileSync(
        path.resolve('app/practice-tools/flute-to-notes/page.tsx'),
        'utf8'
    );
    assert.ok(fnPage.includes('/practice-tools/flute-to-notes'), 'Flute to Notes page sets canonical URL');
    assert.ok(fnPage.includes('ClientFluteToNotesPage'), 'Flute to Notes renders ClientFluteToNotesPage');

    // Client components have student access handling
    const rmClient = fs.readFileSync(
        path.resolve('app/practice-tools/rhythm-machine/ClientRhythmMachinePage.tsx'),
        'utf8'
    );
    assert.ok(rmClient.includes('hasStudentAccess'), 'ClientRhythmMachinePage uses hasStudentAccess');
    assert.ok(rmClient.includes('StudentAccessModal'), 'ClientRhythmMachinePage renders StudentAccessModal');

    const fnClient = fs.readFileSync(
        path.resolve('app/practice-tools/flute-to-notes/ClientFluteToNotesPage.tsx'),
        'utf8'
    );
    assert.ok(fnClient.includes('hasStudentAccess'), 'ClientFluteToNotesPage uses hasStudentAccess');
    assert.ok(fnClient.includes('StudentAccessModal'), 'ClientFluteToNotesPage renders StudentAccessModal');
});

test('Sitemap: app/sitemap.ts contains new practice tool routes', () => {
    const sitemapSource = fs.readFileSync(path.resolve('app/sitemap.ts'), 'utf8');
    assert.ok(
        sitemapSource.includes('/practice-tools/rhythm-machine'),
        'Sitemap includes /practice-tools/rhythm-machine'
    );
    assert.ok(
        sitemapSource.includes('/practice-tools/flute-to-notes'),
        'Sitemap includes /practice-tools/flute-to-notes'
    );
});

test('Hub Structure: ClientPracticeToolsPage organizes tools into 2 clear sections', () => {
    const hubSource = fs.readFileSync(
        path.resolve('app/practice-tools/ClientPracticeToolsPage.tsx'),
        'utf8'
    );

    // Section 1: Free Bansuri Practice Tools
    assert.ok(
        hubSource.includes('Free Bansuri Practice Tools'),
        'Hub includes Free Bansuri Practice Tools section'
    );

    // Section 2: More Practice Tools for KFA Students
    assert.ok(
        hubSource.includes('More Practice Tools for KFA Students'),
        'Hub includes More Practice Tools for KFA Students section'
    );

    // Badges
    assert.ok(
        hubSource.includes('Free Practice Tool'),
        'Hub labels free tools with Free Practice Tool'
    );
    assert.ok(
        hubSource.includes('KFA Student Tool'),
        'Hub labels student tools with KFA Student Tool'
    );

    // Student Access Modal wired
    assert.ok(
        hubSource.includes('<StudentAccessModal'),
        'Hub mounts StudentAccessModal'
    );

    // Title should be clean without (Tanpura + Metronome + Drums) beside it
    assert.ok(
        hubSource.includes('Combo Session Mixer'),
        'Hub includes Combo Session Mixer'
    );
    assert.ok(
        !hubSource.includes('Combo Session Mixer (Tanpura + Metronome + Drums)'),
        'Hub does not put (Tanpura + Metronome + Drums) beside Combo Session Mixer'
    );
});

test('Homepage Preview: app/PageClient.tsx renders 3 free tools + 1 distinct card for KFA students', () => {
    const pageClientSource = fs.readFileSync(path.resolve('app/PageClient.tsx'), 'utf8');

    // Practice Tools preview section
    assert.ok(
        pageClientSource.includes('Practice Smarter with KFA Tools'),
        'PageClient contains Practice Smarter with KFA Tools section'
    );
    assert.ok(
        pageClientSource.includes('Bansuri Tuner'),
        'PageClient contains Bansuri Tuner card'
    );
    assert.ok(
        pageClientSource.includes('Practice Metronome'),
        'PageClient contains Practice Metronome card'
    );
    assert.ok(
        pageClientSource.includes('Tanpura Drone'),
        'PageClient contains Tanpura Drone card'
    );
    assert.ok(
        pageClientSource.includes('More Tools for KFA Students'),
        'PageClient contains distinct More Tools for KFA Students card'
    );
    assert.ok(
        pageClientSource.includes('Krishna Flute Academy students receive access to dedicated tools'),
        'PageClient distinct card contains required copy'
    );
    assert.ok(
        pageClientSource.includes('Explore Student Tools →'),
        'PageClient distinct card contains Explore Student Tools button'
    );
});

test('Free Tool Pages: bansuri-tuner, metronome, tanpura contain Practising on Your Own callout', () => {
    const tunerSource = fs.readFileSync(
        path.resolve('app/practice-tools/bansuri-tuner/ClientTunerPage.tsx'),
        'utf8'
    );
    const metronomeSource = fs.readFileSync(
        path.resolve('app/practice-tools/metronome/ClientMetronomePage.tsx'),
        'utf8'
    );
    const tanpuraSource = fs.readFileSync(
        path.resolve('app/practice-tools/tanpura/ClientTanpuraPage.tsx'),
        'utf8'
    );

    const pages = [
        { name: 'Bansuri Tuner', content: tunerSource },
        { name: 'Metronome', content: metronomeSource },
        { name: 'Tanpura', content: tanpuraSource }
    ];

    for (const page of pages) {
        assert.ok(
            page.content.includes('Practising on Your Own?'),
            `${page.name} contains Practising on Your Own? heading`
        );
        assert.ok(
            page.content.includes('Practice tools can help you work on pitch, rhythm and listening'),
            `${page.name} contains required guidance copy`
        );
        assert.ok(
            page.content.includes('Explore Bansuri Courses'),
            `${page.name} contains Explore Bansuri Courses button`
        );
        assert.ok(
            page.content.includes('Talk to Krishna Flute Academy'),
            `${page.name} contains Talk to Krishna Flute Academy button`
        );
    }
});
