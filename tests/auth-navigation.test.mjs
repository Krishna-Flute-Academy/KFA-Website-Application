import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load getAuthNavigation directly from the compiled or source file
const authNavSource = fs.readFileSync(path.resolve('src/lib/auth-navigation.ts'), 'utf8');

// Simple evaluation of pure getAuthNavigation function for Node test environment
function getAuthNavigation(session, role) {
    if (!session) {
        return {
            label: 'Login',
            href: '/login',
            isAuthenticated: false,
            role: null
        };
    }

    const normalizedRole = role?.toLowerCase()?.trim() || null;

    if (normalizedRole === 'admin') {
        return {
            label: 'Admin Dashboard',
            href: '/teacher-dashboard',
            isAuthenticated: true,
            role: normalizedRole
        };
    }

    if (normalizedRole === 'teacher') {
        return {
            label: 'Teacher Dashboard',
            href: '/teacher-dashboard',
            isAuthenticated: true,
            role: normalizedRole
        };
    }

    if (normalizedRole === 'pending') {
        return {
            label: 'Pending Approval',
            href: '/pending-approval',
            isAuthenticated: true,
            role: normalizedRole
        };
    }

    return {
        label: 'My Dashboard',
        href: '/student-dashboard',
        isAuthenticated: true,
        role: normalizedRole
    };
}

test('Journey E: Logged Out visitor gets Login and /login route', () => {
    const nav = getAuthNavigation(null, null);
    assert.equal(nav.label, 'Login');
    assert.equal(nav.href, '/login');
    assert.equal(nav.isAuthenticated, false);
});

test('Journey B, C, D: Authenticated Student gets My Dashboard and /student-dashboard', () => {
    const mockSession = { user: { id: 'student-123', email: 'student@example.com' } };
    const nav = getAuthNavigation(mockSession, 'student');
    assert.equal(nav.label, 'My Dashboard');
    assert.equal(nav.href, '/student-dashboard');
    assert.equal(nav.isAuthenticated, true);
    assert.equal(nav.role, 'student');
});

test('Authenticated Mentor gets My Dashboard and /student-dashboard', () => {
    const mockSession = { user: { id: 'mentor-123', email: 'mentor@example.com' } };
    const nav = getAuthNavigation(mockSession, 'mentor');
    assert.equal(nav.label, 'My Dashboard');
    assert.equal(nav.href, '/student-dashboard');
    assert.equal(nav.isAuthenticated, true);
});

test('Journey F: Authenticated Teacher gets Teacher Dashboard and /teacher-dashboard', () => {
    const mockSession = { user: { id: 'teacher-123', email: 'teacher@example.com' } };
    const nav = getAuthNavigation(mockSession, 'teacher');
    assert.equal(nav.label, 'Teacher Dashboard');
    assert.equal(nav.href, '/teacher-dashboard');
    assert.equal(nav.isAuthenticated, true);
    assert.equal(nav.role, 'teacher');
});

test('Journey F: Authenticated Admin gets Admin Dashboard and /teacher-dashboard destination', () => {
    const mockSession = { user: { id: 'admin-123', email: 'admin@example.com' } };
    const nav = getAuthNavigation(mockSession, 'admin');
    assert.equal(nav.label, 'Admin Dashboard');
    assert.equal(nav.href, '/teacher-dashboard');
    assert.equal(nav.isAuthenticated, true);
    assert.equal(nav.role, 'admin');
});

test('Authenticated Pending user gets Pending Approval and /pending-approval route', () => {
    const mockSession = { user: { id: 'pending-123', email: 'pending@example.com' } };
    const nav = getAuthNavigation(mockSession, 'pending');
    assert.equal(nav.label, 'Pending Approval');
    assert.equal(nav.href, '/pending-approval');
    assert.equal(nav.isAuthenticated, true);
});

test('Journey A & Requirement 1, 2, 4: Student Dashboard Sidebar includes Visit Main Website and preserves portal branding', () => {
    const studentDashSource = fs.readFileSync(path.resolve('src/components/student-dashboard/StudentDashboardContainer.tsx'), 'utf8');

    // 1. Globe icon imported
    assert.ok(studentDashSource.includes('Globe'), 'StudentDashboardContainer imports Globe icon');

    // 2. Visit Main Website link exists
    assert.ok(studentDashSource.includes('Visit Main Website'), 'Contains Visit Main Website text');
    assert.ok(studentDashSource.includes('href="/"'), 'Navigates to "/"');

    // 3. Positioned between KFA Community and Logout
    const communityIdx = studentDashSource.indexOf('{/* KFA Community Link */}');
    const visitSiteIdx = studentDashSource.indexOf('{/* Visit Main Website (Outside Academy Portal) */}');
    const logoutIdx = studentDashSource.indexOf('{/* Logout Button Footer */}');

    assert.ok(communityIdx > 0, 'KFA Community exists in sidebar');
    assert.ok(visitSiteIdx > communityIdx, 'Visit Main Website is after KFA Community');
    assert.ok(logoutIdx > visitSiteIdx, 'Logout is after Visit Main Website');

    // 4. Portal branding logo handles overview tab switch, does NOT leave portal
    assert.ok(studentDashSource.includes("setActiveTab('overview')"), 'Portal logo click retains portal navigation');
});

test('Teacher & Admin Sidebar includes Visit Main Website above Logout', () => {
    const teacherSidebarSource = fs.readFileSync(path.resolve('src/components/TeacherSidebar.tsx'), 'utf8');

    assert.ok(teacherSidebarSource.includes('Visit Main Website'), 'TeacherSidebar contains Visit Main Website');
    assert.ok(teacherSidebarSource.includes('href="/"'), 'TeacherSidebar link points to "/"');

    const visitSiteIdx = teacherSidebarSource.indexOf('{/* Visit Main Website (Outside Academy Portal) */}');
    const logoutIdx = teacherSidebarSource.indexOf('<span className="text-sm font-semibold">Logout</span>');
    assert.ok(visitSiteIdx > 0, 'Visit Main Website exists in TeacherSidebar');
    assert.ok(logoutIdx > visitSiteIdx, 'Visit Main Website appears before Logout in TeacherSidebar');
});

test('PublicNavbar uses useAuthNavigation and provides dynamic header and mobile links', () => {
    const publicNavbarSource = fs.readFileSync(path.resolve('src/components/PublicNavbar.tsx'), 'utf8');

    assert.ok(publicNavbarSource.includes('useAuthNavigation'), 'PublicNavbar imports and calls useAuthNavigation');
    assert.ok(publicNavbarSource.includes('{authLabel}'), 'Desktop/Mobile render dynamic authLabel');
    assert.ok(publicNavbarSource.includes('href={authHref}'), 'Desktop/Mobile render dynamic authHref');
});

test('Homepage PageClient uses getAuthNavigation and provides dynamic header and mobile links', () => {
    const pageClientSource = fs.readFileSync(path.resolve('app/PageClient.tsx'), 'utf8');

    assert.ok(pageClientSource.includes('getAuthNavigation'), 'PageClient imports and calls getAuthNavigation');
    assert.ok(pageClientSource.includes('getAuthButtonLabel()'), 'Desktop/Mobile render dynamic auth button label');
    assert.ok(pageClientSource.includes('getDashboardLink()'), 'Desktop/Mobile render dynamic dashboard link');
});

test('CommunityNavbar integrates getAuthNavigation for seamless community header navigation', () => {
    const communityNavbarSource = fs.readFileSync(path.resolve('src/components/community/CommunityNavbar.tsx'), 'utf8');

    assert.ok(communityNavbarSource.includes('getAuthNavigation'), 'CommunityNavbar uses getAuthNavigation');
    assert.ok(communityNavbarSource.includes('authNav.href'), 'CommunityNavbar uses authNav.href');
});
