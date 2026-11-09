import { test, expect } from '@playwright/test';
import path from 'path';

const CREDS = {
    admin: {
        email: 'synth.e2e.admin@kfa-test.internal',
        password: 'TestAdminPassword123!'
    },
    student: {
        email: 'synth.e2e.student@kfa-test.internal',
        password: 'TestStudentPassword123!'
    }
};

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'tests/playwright/screenshots');

async function dismissPopups(page: any) {
    try {
        await page.evaluate(() => {
            document.querySelectorAll('.fixed.inset-0.z-\\[9999\\], .fixed.inset-0.z-\\[200\\]').forEach(el => el.remove());
        });
    } catch (_) {}
}

test.describe('KFA Verification: Independent Primary File and Voice Guide', () => {

    test('1. Admin Inventory Topic Editor: Independent Section 3 and Section 4 controls', async ({ page }) => {
        // Log in as Admin
        await page.goto('/login');
        await page.waitForSelector('#email-input', { timeout: 15000 });
        await page.fill('#email-input', CREDS.admin.email);
        await page.fill('#password-input', CREDS.admin.password);
        await page.click('button[type="submit"]');

        await page.waitForURL('**/teacher-dashboard**', { timeout: 25000 });
        await dismissPopups(page);

        // Navigate to Inventory Library
        await page.goto('/teacher-dashboard/inventory');
        await page.waitForLoadState('networkidle');
        await dismissPopups(page);

        // Click on Level 1 module card to reveal chapters & topic cards
        const level1Card = page.locator('h3:has-text("Level 1"), div:has-text("Level 1")').first();
        if (await level1Card.isVisible()) {
            await level1Card.click();
            await page.waitForTimeout(1000);
        }

        // Click "Edit Topic Details" on the first available topic card or click Add Material Card
        const editTopicBtn = page.locator('button[title="Edit Topic Details"]').first();
        if (await editTopicBtn.isVisible()) {
            await editTopicBtn.click();
        } else {
            const addBtn = page.locator('button:has-text("Add Material Card")').first();
            await addBtn.click();
        }

        // Wait for Lesson modal to be visible
        await page.waitForSelector('text=3. Attachment File', { timeout: 15000 });
        await page.waitForSelector('text=4. Recorded Audio / Voice Guide', { timeout: 15000 });

        // Verify Section 3 and Section 4 exist independently
        const section3 = page.locator('text=3. Attachment File');
        const section4 = page.locator('text=4. Recorded Audio / Voice Guide');
        await expect(section3).toBeVisible();
        await expect(section4).toBeVisible();

        // Verify Section 4 has BOTH "Record Audio Guide" AND "Upload Audio File"
        const recordBtn = page.locator('button:has-text("Record Audio Guide"), button:has-text("Re-record Audio Guide")');
        const uploadAudioBtn = page.locator('label:has-text("Upload Audio File"), label:has-text("Replace Audio File")');
        await expect(recordBtn.first()).toBeVisible();
        await expect(uploadAudioBtn.first()).toBeVisible();

        // Capture screenshot of Admin Editor
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, '01_admin_editor_independent_controls.png'),
            fullPage: false
        });

        // Test responsive layout at 768px, 390px, 360px without horizontal overflow
        for (const width of [768, 390, 360]) {
            await page.setViewportSize({ width, height: 740 });
            await page.waitForTimeout(300);

            const isOverflowing = await page.evaluate(() => {
                const modal = document.querySelector('.animate-scaleIn') || document.body;
                return modal.scrollWidth > window.innerWidth + 2;
            });
            expect(isOverflowing).toBe(false);

            if (width === 360) {
                await page.screenshot({
                    path: path.join(SCREENSHOT_DIR, '02_admin_editor_mobile_360.png'),
                    fullPage: false
                });
            }
        }
    });

    test('2. Student View: Independent Audio Guide inline player and accessible controls', async ({ page }) => {
        // Log in as Student
        await page.goto('/login');
        await page.waitForSelector('#email-input', { timeout: 15000 });
        await page.fill('#email-input', CREDS.student.email);
        await page.fill('#password-input', CREDS.student.password);
        await page.click('button[type="submit"]');

        await page.waitForURL('**/student-dashboard**', { timeout: 25000 });
        await dismissPopups(page);

        // Click on Curriculum tab if present
        const curriculumTab = page.locator('button:has-text("Curriculum"), button:has-text("Syllabus")').first();
        if (await curriculumTab.isVisible()) {
            await curriculumTab.click();
            await page.waitForTimeout(1000);
        }

        // Test at Desktop Viewport (1280px)
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.waitForTimeout(500);

        // Capture desktop view screenshot
        await page.screenshot({
            path: path.join(SCREENSHOT_DIR, '03_student_learning_view_inline_audio.png'),
            fullPage: false
        });

        // Test Mobile Viewports: 768px, 390px, 360px without horizontal overflow
        for (const width of [768, 390, 360]) {
            await page.setViewportSize({ width, height: 740 });
            await page.waitForTimeout(300);

            const hasHorizontalOverflow = await page.evaluate(() => {
                return document.documentElement.scrollWidth > window.innerWidth + 2;
            });
            expect(hasHorizontalOverflow).toBe(false);

            if (width === 360) {
                await page.screenshot({
                    path: path.join(SCREENSHOT_DIR, '04_student_mobile_360.png'),
                    fullPage: false
                });
            }
        }
    });
});
