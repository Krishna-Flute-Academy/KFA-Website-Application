import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('KFA-UI-001: Active-class floating panel has resize clamping, mobile tray, and accessible controls', () => {
    const sidebarPath = path.join(ROOT_DIR, 'src/components/TeacherSidebar.tsx');
    const content = fs.readFileSync(sidebarPath, 'utf8');

    // 1. Resize listener clamps coordinates and handles compact screens
    assert.ok(content.includes("window.addEventListener('resize', handleResize)"), 'Window resize event listener must be registered to clamp persisted coordinates');
    assert.ok(content.includes('isCompact'), 'Compact viewport state must be tracked to adapt mobile tray layout');
    assert.ok(content.includes('Math.max(80,'), 'Vertical clamping must avoid covering the top navigation bar');

    // 2. Docked bottom tray on narrow screens
    assert.ok(content.includes('fixed bottom-3 inset-x-3') || content.includes('fixed bottom-0 inset-x-0'), 'Must provide fixed bottom tray positioning on mobile viewports');
    assert.ok(content.includes('safe-area-inset-bottom'), 'Must respect safe-area insets on mobile devices');

    // 3. Accessible naming and semantics
    assert.ok(content.includes('aria-label="Expand active class session tray"'), 'Expand button must have an accessible name');
    assert.ok(content.includes('aria-label="Minimize active class session panel"'), 'Minimize button must have an accessible name');
    assert.ok(content.includes('role="region"'), 'Floating widget must expose semantic region for assistive technology');
});

test('KFA-UI-002: Live-class actions have minimum 44px touch height and separated destructive menu', () => {
    const classroomsPath = path.join(ROOT_DIR, 'app/teacher-dashboard/classrooms/page.tsx');
    const content = fs.readFileSync(classroomsPath, 'utf8');

    // 1. Invalid Tailwind classes removed
    assert.ok(!content.includes('h-8.5'), 'Invalid Tailwind class h-8.5 must not be present');
    assert.ok(!content.includes('w-8.5'), 'Invalid Tailwind class w-8.5 must not be present');

    // 2. Start/End Class buttons have min 44px touch target
    assert.ok(content.includes('min-h-[44px]'), 'Start and End Class controls must have minimum 44px touch height');

    // 3. Destructive control separated into named overflow menu on mobile
    assert.ok(content.includes('mobileActionMenuId'), 'Mobile card view must use an action menu state for destructive actions');
    assert.ok(content.includes('aria-label={`Classroom options for ${room.name}`}') || content.includes('aria-label={`Delete classroom ${room.name}`}') || content.includes('Classroom options'), 'Action triggers must have accessible names');
    assert.ok(content.includes('handleDeleteClassroom'), 'Classroom deletion logic must be preserved with confirmation');
});

test('KFA-UI-003: Form controls have programmatic label associations', () => {
    // 1. Fees Filters
    const feesPath = path.join(ROOT_DIR, 'app/teacher-dashboard/fees/page.tsx');
    const feesContent = fs.readFileSync(feesPath, 'utf8');
    
    const feesSelectIds = [
        'fees-active-period-select',
        'fees-filter-period',
        'fees-filter-plan',
        'fees-filter-classes',
        'fees-filter-due',
        'fees-filter-amount',
        'fees-filter-joined'
    ];
    for (const id of feesSelectIds) {
        assert.ok(feesContent.includes(`id="${id}"`), `Fees filter select must have id="${id}"`);
        assert.ok(feesContent.includes(`htmlFor="${id}"`), `Fees filter must have matching <label htmlFor="${id}">`);
        assert.ok(feesContent.includes(`aria-label=`), `Fees filter select must have aria-label`);
    }

    // 2. Task Dialog Inputs
    const taskDialogPath = path.join(ROOT_DIR, 'src/components/teacher-dashboard/tasks/TaskCreateDialog.tsx');
    const taskContent = fs.readFileSync(taskDialogPath, 'utf8');

    assert.ok(taskContent.includes('id="task-title-input"'), 'Task Title input must have id');
    assert.ok(taskContent.includes('htmlFor="task-title-input"'), 'Task Title label must reference input id');
    assert.ok(taskContent.includes('id="task-description-input"'), 'Detailed Instructions textarea must have id');
    assert.ok(taskContent.includes('htmlFor="task-description-input"'), 'Detailed Instructions label must reference textarea id');
    assert.ok(taskContent.includes('id="task-due-date-input"'), 'Due Date input must have id');
    assert.ok(taskContent.includes('htmlFor="task-due-date-input"'), 'Due Date label must reference input id');

    // 3. Add Student Form Inputs
    const studentAddPath = path.join(ROOT_DIR, 'app/teacher-dashboard/students/add/page.tsx');
    const studentContent = fs.readFileSync(studentAddPath, 'utf8');

    const studentFieldIds = [
        'student-full-name',
        'student-email',
        'student-phone',
        'student-start-date',
        'student-batch',
        'student-level',
        'student-learning-mode',
        'student-notes',
        'student-welcome-kit'
    ];
    for (const id of studentFieldIds) {
        assert.ok(studentContent.includes(`id="${id}"`), `Add student field must have id="${id}"`);
        assert.ok(studentContent.includes(`htmlFor="${id}"`), `Add student label must reference htmlFor="${id}"`);
    }
});

test('KFA-UI-004: Create Task modal has dialog semantics, named close button, and focus trap', () => {
    const taskDialogPath = path.join(ROOT_DIR, 'src/components/teacher-dashboard/tasks/TaskCreateDialog.tsx');
    const taskContent = fs.readFileSync(taskDialogPath, 'utf8');

    assert.ok(taskContent.includes('role="dialog"'), 'Task modal must expose role="dialog"');
    assert.ok(taskContent.includes('aria-modal="true"'), 'Task modal must expose aria-modal="true"');
    assert.ok(taskContent.includes('aria-labelledby="task-dialog-title"'), 'Task modal must have aria-labelledby');
    assert.ok(taskContent.includes('aria-describedby="task-dialog-description"'), 'Task modal must have aria-describedby');
    assert.ok(taskContent.includes('aria-label="Close task dialog"'), 'Close button must have accessible name');
    assert.ok(taskContent.includes("e.key === 'Escape'"), 'Escape key must trigger modal dismissal');
    assert.ok(taskContent.includes("e.key === 'Tab'"), 'Tab navigation must be trapped within modal');
});

test('KFA-UI-005: Community header collapses at tablet breakpoint to avoid horizontal overflow', () => {
    const navbarPath = path.join(ROOT_DIR, 'src/components/community/CommunityNavbar.tsx');
    const navbarContent = fs.readFileSync(navbarPath, 'utf8');

    assert.ok(navbarContent.includes('hidden lg:flex'), 'Desktop links must hide below lg to prevent horizontal scroll at 768px/820px');
    assert.ok(navbarContent.includes('lg:hidden'), 'Mobile hamburger menu must be visible on tablet viewports below lg');
    assert.ok(!navbarContent.includes('hidden md:flex'), 'Nav must not be unconditionally forced open at md (768px)');
});

test('KFA-UI-006: Add Student mobile layout uses compact padding and vertically stacked header', () => {
    const studentAddPath = path.join(ROOT_DIR, 'app/teacher-dashboard/students/add/page.tsx');
    const studentContent = fs.readFileSync(studentAddPath, 'utf8');

    assert.ok(studentContent.includes('p-4 sm:p-6 lg:p-12'), 'Outer page padding must be responsive and compact on mobile');
    assert.ok(studentContent.includes('p-4 sm:p-6 lg:p-10'), 'Form card padding must be responsive and compact on mobile');
    assert.ok(studentContent.includes('flex flex-col sm:flex-row'), 'Header row must stack vertically on mobile screens');
    assert.ok(studentContent.includes('text-2xl sm:text-3xl'), 'Heading text must scale responsively');
});
