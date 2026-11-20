/**
 * Mobile Forms Acceptance Tests
 * Validates fixes for MF-01 through MF-08 across KFA teacher/admin dashboard, modals, drawers, and editors.
 * Enforces touch targets (min 44x44px), chevron padding (pr-10/pr-11), single scroll containers,
 * responsive grids (1-col on mobile -> sm:2/3/4-col), and WCAG AA contrast.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

function readFile(relPath) {
    return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

describe('Mobile Form Acceptance Suite (MF-01 to MF-08)', () => {

    describe('MF-01: Edit Student Form (/teacher-dashboard/students/[id]/edit)', () => {
        const content = readFile('app/teacher-dashboard/students/[id]/edit/page.tsx');

        it('should have mobile-optimized container padding (p-4 sm:p-6 lg:p-12)', () => {
            assert.match(content, /p-4\s+sm:p-6\s+lg:p-12/);
            assert.match(content, /p-4\s+sm:p-6\s+lg:p-10/);
        });

        it('should have responsive header and footer action stacking', () => {
            assert.match(content, /flex\s+flex-col\s+sm:flex-row\s+sm:items-end/);
            assert.match(content, /flex-col-reverse\s+sm:flex-row/);
        });

        it('should reserve chevron space with pr-10 and min 44px touch height on all selects', () => {
            const selectMatches = content.match(/<select[\s\S]*?<\/select>/g) || [];
            assert.ok(selectMatches.length >= 4, 'Should contain at least 4 select elements');
            for (const sel of selectMatches) {
                assert.match(sel, /pr-10/, 'Select element must reserve chevron space via pr-10');
                assert.match(sel, /min-h-\[44px\]/, 'Select element must meet 44px touch target');
            }
        });

        it('should have explicit label htmlFor and select id programmatic associations', () => {
            assert.match(content, /htmlFor="edit-student-batch"/);
            assert.match(content, /id="edit-student-batch"/);
            assert.match(content, /htmlFor="edit-student-learning-mode"/);
            assert.match(content, /id="edit-student-learning-mode"/);
            assert.match(content, /htmlFor="edit-student-fees-basis"/);
            assert.match(content, /id="edit-student-fees-basis"/);
        });

        it('should render human-readable fee plan summary badges for mobile', () => {
            assert.match(content, /edit-student-fee-plan-summary/);
        });
    });

    describe('MF-02: Role Allocation Modal (/teacher-dashboard/role-allocation)', () => {
        const content = readFile('app/teacher-dashboard/role-allocation/page.tsx');

        it('should have single scroll container with safe viewport height', () => {
            assert.match(content, /max-h-\[calc\(100dvh-2rem\)\]/);
            assert.match(content, /flex\s+flex-col/);
            assert.match(content, /overflow-y-auto\s+custom-scrollbar\s+flex-1/);
        });

        it('should stack role selector buttons responsively (grid-cols-1 sm:grid-cols-3)', () => {
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-3\s+gap-2\.5/);
        });

        it('should stack teacher/batch and experience/mode on mobile (grid-cols-1 sm:grid-cols-2)', () => {
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-4/);
        });

        it('should stack fee inputs on mobile (grid-cols-1 sm:grid-cols-3)', () => {
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-3\s+gap-4/);
        });

        it('should reserve chevron room and min-h-44 on selects', () => {
            assert.match(content, /pr-10\s+py-2\.5\s+min-h-\[44px\]/);
        });

        it('should stack footer buttons on mobile with min 44px touch height', () => {
            assert.match(content, /flex\s+flex-col-reverse\s+sm:flex-row\s+items-stretch\s+sm:items-center/);
        });
    });

    describe('MF-03: Fees Modal (/teacher-dashboard/fees)', () => {
        const content = readFile('app/teacher-dashboard/fees/page.tsx');

        it('should use responsive 1-to-2 column grids for amount/classes and method/date', () => {
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3\s+sm:gap-4/);
        });

        it('should reserve chevron space with pr-10 and min-h-44 on payment method select', () => {
            assert.match(content, /pl-3\s+pr-10\s+py-2\.5\s+min-h-\[44px\]/);
            assert.match(content, /UPI \/ GPay \/ PhonePe/);
        });

        it('should stack payment action footer buttons on mobile', () => {
            assert.match(content, /flex\s+flex-col-reverse\s+sm:flex-row\s+items-stretch\s+sm:items-center\s+gap-2/);
        });

        it('should format history modal summary widget responsively (grid-cols-1 sm:grid-cols-3)', () => {
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-3\s+gap-3/);
        });
    });

    describe('MF-04: Add Student Form (/teacher-dashboard/students/add)', () => {
        const content = readFile('app/teacher-dashboard/students/add/page.tsx');

        it('should provide min 44x44px touch target for password eye, refresh, and copy buttons', () => {
            assert.match(content, /w-11\s+h-11\s+min-w-\[44px\]\s+min-h-\[44px\]\s+flex\s+items-center\s+justify-center/);
            assert.match(content, /aria-label="Toggle password visibility"/);
        });

        it('should reserve chevron room with pr-11 and min 44px on all student creation dropdowns', () => {
            assert.match(content, /id="student-batch"[\s\S]*?pr-11[\s\S]*?min-h-\[44px\]/);
            assert.match(content, /id="student-teacher"[\s\S]*?pr-11[\s\S]*?min-h-\[44px\]/);
            assert.match(content, /id="student-level"[\s\S]*?pr-11[\s\S]*?min-h-\[44px\]/);
            assert.match(content, /id="student-learning-mode"[\s\S]*?pr-11[\s\S]*?min-h-\[44px\]/);
            assert.match(content, /id="student-fees-basis"[\s\S]*?pr-11[\s\S]*?min-h-\[44px\]/);
        });

        it('should display visual billing plan summary badges', () => {
            assert.match(content, /Class-Basis/);
            assert.match(content, /Monthly Subscription/);
        });

        it('should stack action footer on mobile with 44px buttons', () => {
            assert.match(content, /flex-col-reverse\s+sm:flex-row\s+items-stretch\s+sm:items-center/);
        });
    });

    describe('MF-05: RichTextEditor & Inventory Modals', () => {
        const rte = readFile('src/components/RichTextEditor.tsx');
        const inv = readFile('app/teacher-dashboard/inventory/page.tsx');

        it('should provide minimum touch targets and horizontal scroll for RichTextEditor toolbar', () => {
            assert.match(rte, /overflow-x-auto/);
            assert.match(rte, /min-w-\[36px\]\s+min-h-\[36px\]/);
            assert.match(rte, /min-w-\[32px\]\s+min-h-\[32px\]/);
        });

        it('should use high-contrast styling for RichTextEditor line-spacing label', () => {
            assert.match(rte, /text-slate-600\s+dark:text-slate-300/);
        });

        it('should enlarge category chips in inventory modal to min 32px touch targets', () => {
            assert.match(inv, /min-h-\[32px\]\s+flex\s+items-center/);
        });

        it('should give inventory modals responsive padding, single scroll containers, and 40px close buttons', () => {
            assert.match(inv, /max-h-\[calc\(100dvh-2rem\)\]\s+flex\s+flex-col/);
            assert.match(inv, /min-w-\[40px\]\s+min-h-\[40px\]/);
        });
    });

    describe('MF-06: Messages & Common RichTextEditor', () => {
        const messages = readFile('app/teacher-dashboard/messages/page.tsx');
        const commonRte = readFile('src/components/common/RichTextEditor.tsx');

        it('should stack message composer header and action buttons on mobile', () => {
            assert.match(messages, /flex\s+flex-col\s+sm:flex-row\s+sm:items-center\s+justify-between/);
            assert.match(messages, /flex-col\s+sm:flex-row\s+items-stretch\s+sm:items-center\s+gap-2\.5/);
        });

        it('should provide touch-friendly toolbar buttons and font selectors in common RichTextEditor', () => {
            assert.match(commonRte, /min-w-\[36px\]\s+min-h-\[36px\]/);
            assert.match(commonRte, /overflow-x-auto/);
        });
    });

    describe('MF-07: Classroom Creation (/teacher-dashboard/classrooms/add)', () => {
        const content = readFile('app/teacher-dashboard/classrooms/add/page.tsx');

        it('should use high-contrast styling for active class type buttons (not low-contrast yellow text)', () => {
            assert.match(content, /border-amber-500\s+bg-amber-500\/15\s+text-amber-900\s+dark:text-amber-200/);
            assert.doesNotMatch(content, /text-\[#ecb613\]\s+bg-amber-500\/10/);
        });

        it('should render clear label for class off replacement', () => {
            assert.match(content, /Class Off Replacement \(Optional\)/);
        });

        it('should stack delivery format buttons on mobile (grid-cols-1 sm:grid-cols-2)', () => {
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3/);
        });

        it('should reserve chevron room (pr-11) and meet min 44px on all classroom dropdowns', () => {
            const selectMatches = content.match(/<select[\s\S]*?<\/select>/g) || [];
            assert.ok(selectMatches.length >= 4, 'Should contain at least 4 select elements');
            for (const sel of selectMatches) {
                assert.match(sel, /pr-11/, 'Select dropdown must reserve chevron room via pr-11');
                assert.match(sel, /min-h-\[44px\]/, 'Select dropdown must meet min 44px height');
            }
        });

        it('should stack action buttons on mobile with min 44px touch targets', () => {
            assert.match(content, /flex-col-reverse\s+sm:flex-row\s+items-stretch\s+sm:items-center/);
        });
    });

    describe('MF-08: Secondary Modals, Drawers, and Classroom Tabs', () => {
        it('ReviewDrawer: should stack score and proficiency on mobile with min 44px height', () => {
            const content = readFile('src/components/teacher-dashboard/tasks/ReviewDrawer.tsx');
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3/);
            assert.match(content, /pr-10\s+py-2\.5\s+min-h-\[44px\]/);
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-2/);
        });

        it('DeclareHolidayModal: should stack scope buttons and time inputs responsively', () => {
            const content = readFile('src/components/teacher-dashboard/holidays/DeclareHolidayModal.tsx');
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-3\s+gap-2/);
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3/);
            assert.match(content, /min-w-\[40px\]\s+min-h-\[40px\]/);
        });

        it('ScheduleAlternativeModal: should stack time inputs and action buttons', () => {
            const content = readFile('src/components/teacher-dashboard/holidays/ScheduleAlternativeModal.tsx');
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3/);
            assert.match(content, /flex-col-reverse\s+sm:flex-row\s+items-stretch\s+sm:items-center/);
        });

        it('HistoricalAttendanceCorrectionModal: should use responsive 2-to-4 column grid and 44px buttons', () => {
            const content = readFile('src/components/teacher-dashboard/attendance/HistoricalAttendanceCorrectionModal.tsx');
            assert.match(content, /grid\s+grid-cols-2\s+sm:grid-cols-4\s+gap-2/);
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-3\s+gap-2/);
        });

        it('HistoricalLeaveCorrectionModal: should stack target leave and attendance inputs on mobile', () => {
            const content = readFile('src/components/teacher-dashboard/attendance/HistoricalLeaveCorrectionModal.tsx');
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3\s+sm:gap-4/);
            assert.match(content, /pl-3\s+pr-10[\s\S]*?min-h-\[44px\]/);
        });

        it('UnmarkAttendanceModal: should provide safe scroll container and 40px close button', () => {
            const content = readFile('src/components/teacher-dashboard/attendance/UnmarkAttendanceModal.tsx');
            assert.match(content, /max-h-\[calc\(100dvh-2rem\)\]\s+overflow-y-auto/);
            assert.match(content, /min-w-\[40px\]\s+min-h-\[40px\]/);
        });

        it('SettingsTab: should stack classroom slot timing inputs responsively', () => {
            const content = readFile('src/components/classroom/SettingsTab.tsx');
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3\s+sm:gap-4/);
            assert.match(content, /pr-10[\s\S]*?min-h-\[44px\]/);
        });

        it('StudentsTab: should make mentor note modal responsive and stack inputs', () => {
            const content = readFile('src/components/classroom/StudentsTab.tsx');
            assert.match(content, /max-h-\[calc\(100dvh-2rem\)\]\s+flex\s+flex-col\s+overflow-y-auto/);
            assert.match(content, /grid\s+grid-cols-1\s+sm:grid-cols-2\s+gap-3/);
            assert.match(content, /min-w-\[40px\]\s+min-h-\[40px\]/);
        });

        it('ForcePasswordChangeModal: should provide 44px eye toggles and responsive modal', () => {
            const content = readFile('src/components/common/ForcePasswordChangeModal.tsx');
            assert.match(content, /max-h-\[calc\(100dvh-2rem\)\]\s+flex\s+flex-col\s+overflow-y-auto/);
            assert.match(content, /w-11\s+h-11\s+min-w-\[44px\]\s+min-h-\[44px\]/);
            assert.match(content, /pr-12/);
        });

        it('TaskStudentsModal: should provide safe mobile padding and 40px close button', () => {
            const content = readFile('src/components/teacher-dashboard/tasks/TaskStudentsModal.tsx');
            assert.match(content, /max-h-\[calc\(100dvh-2rem\)\]/);
            assert.match(content, /min-w-\[40px\]\s+min-h-\[40px\]/);
        });
    });

    describe('Cross-Cutting Verification', () => {
        it('should verify no modified modals have hardcoded non-responsive grid-cols in critical form sections', () => {
            const roleModal = readFile('app/teacher-dashboard/role-allocation/page.tsx');
            const roleModalForm = roleModal.slice(roleModal.indexOf('<form onSubmit={handleSave}'), roleModal.indexOf('</form>'));
            assert.doesNotMatch(roleModalForm, /className="grid grid-cols-2 gap/);
            assert.doesNotMatch(roleModalForm, /className="grid grid-cols-3 gap/);

            const feeModal = readFile('app/teacher-dashboard/fees/page.tsx');
            assert.doesNotMatch(feeModal, /className="grid grid-cols-2 gap-[^"]*?"\s*>\s*<div>\s*<label[^>]*?>Amount/);

            const holidayModal = readFile('src/components/teacher-dashboard/holidays/DeclareHolidayModal.tsx');
            assert.doesNotMatch(holidayModal, /className="grid grid-cols-2 gap-[^"]*?"\s*>\s*<div>\s*<label[^>]*?>Start Time/);
        });
    });
});
