import { test, expect } from '@playwright/test';

test.describe('Community Layout Stability & Zero Shake', () => {
    test('Desktop: Navbar height, nav links X position, and header stability on /community', async ({ page }) => {
        // Collect layout shifts during page load
        await page.addInitScript(() => {
            (window as any).__layoutShifts = [];
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!(entry as any).hadRecentInput) {
                            (window as any).__layoutShifts.push((entry as any).value);
                        }
                    }
                });
                observer.observe({ type: 'layout-shift', buffered: true });
            } catch (e) {}
        });

        await page.goto('/community', { waitUntil: 'domcontentloaded' });

        // Measure immediate header and nav position
        const header = page.locator('header');
        await expect(header).toBeVisible();

        const initialHeaderBox = await header.boundingBox();
        expect(initialHeaderBox).not.toBeNull();
        expect(initialHeaderBox?.height).toBe(65);

        const discussionsLink = page.locator('nav >> text=Discussions');
        const initialNavBox = await discussionsLink.boundingBox();

        // Wait for network idle / auth to resolve
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Measure post-auth header and nav position
        const finalHeaderBox = await header.boundingBox();
        expect(finalHeaderBox?.height).toBe(65);

        const finalNavBox = await discussionsLink.boundingBox();

        // Navigation links MUST NOT shift horizontally
        expect(Math.round(initialNavBox?.x || 0)).toBe(Math.round(finalNavBox?.x || 0));

        // Evaluate CLS
        const clsScores = await page.evaluate(() => (window as any).__layoutShifts || []);
        const totalCls = clsScores.reduce((sum: number, val: number) => sum + val, 0);
        console.log(`[Community CLS] Total CLS on /community: ${totalCls}`);
        expect(totalCls).toBeLessThan(0.05);
    });

    test('Desktop: Discussion Detail Page maintains stable header and main content Y-coordinate', async ({ page }) => {
        await page.addInitScript(() => {
            (window as any).__layoutShifts = [];
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!(entry as any).hadRecentInput) {
                            (window as any).__layoutShifts.push((entry as any).value);
                        }
                    }
                });
                observer.observe({ type: 'layout-shift', buffered: true });
            } catch (e) {}
        });

        // Navigate to a real discussion
        await page.goto('/community/discussion/should-we-learn-songs-alongside-classical-bansuri-practice-uevzq', {
            waitUntil: 'domcontentloaded'
        });

        const header = page.locator('header');
        await expect(header).toBeVisible();

        const headerBox = await header.boundingBox();
        expect(headerBox?.height).toBe(65);

        const main = page.locator('main');
        await expect(main).toBeVisible();
        const initialMainBox = await main.boundingBox();

        // The top of <main> should be immediately below the 65px header
        expect(initialMainBox?.y).toBe(65);

        // Wait for discussion data and replies to settle
        await page.waitForSelector('article h1', { state: 'visible', timeout: 15000 });
        await page.waitForTimeout(1000);

        const finalMainBox = await main.boundingBox();
        // The top of <main> MUST remain at the exact same Y position
        expect(finalMainBox?.y).toBe(65);

        const clsScores = await page.evaluate(() => (window as any).__layoutShifts || []);
        const totalCls = clsScores.reduce((sum: number, val: number) => sum + val, 0);
        console.log(`[Discussion CLS] Total CLS on /community/discussion: ${totalCls}`);
        expect(totalCls).toBeLessThan(0.05);
    });

    test('Mobile: Header height and hamburger trigger remain stable during auth loading', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 }); // iPhone 12/13/14 size
        await page.goto('/community', { waitUntil: 'domcontentloaded' });

        const header = page.locator('header');
        await expect(header).toBeVisible();

        const initialHeaderBox = await header.boundingBox();
        expect(initialHeaderBox?.height).toBe(65);

        const menuButton = page.locator('button[aria-label="Toggle menu"]');
        await expect(menuButton).toBeVisible();
        const initialMenuBox = await menuButton.boundingBox();

        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        const finalHeaderBox = await header.boundingBox();
        expect(finalHeaderBox?.height).toBe(65);

        const finalMenuBox = await menuButton.boundingBox();
        // Menu button on mobile should remain at the exact same X and Y position
        expect(Math.round(initialMenuBox?.x || 0)).toBe(Math.round(finalMenuBox?.x || 0));
        expect(Math.round(initialMenuBox?.y || 0)).toBe(Math.round(finalMenuBox?.y || 0));
    });
});
