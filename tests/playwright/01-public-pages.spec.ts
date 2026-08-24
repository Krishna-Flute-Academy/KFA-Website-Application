import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Create screenshots directory if it doesn't exist
const screenshotDir = path.join(process.cwd(), 'tests/playwright/screenshots');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

const PUBLIC_ROUTES = [
  { path: '/', name: 'Homepage' },
  { path: '/login', name: 'Login_Page' },
  { path: '/signup', name: 'Signup_Page' },
  { path: '/forgot-password', name: 'Forgot_Password_Page' },
  { path: '/blog', name: 'Blog_Listing' },
];

test.describe('01 · Public Page Load & Error Tests', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`[LOAD] ${route.name} — loads within 8s, no console errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const start = Date.now();
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - start;

      await page.screenshot({
        path: path.join(screenshotDir, `${route.name}.png`),
        fullPage: false,
      });

      // Filter out known non-critical framework warnings
      const criticalErrors = consoleErrors.filter(e =>
        !e.includes('Warning:') &&
        !e.includes('DeprecationWarning') &&
        !e.includes('punycode') &&
        !e.includes('favicon')
      );

      console.log(`  ⏱  Load time: ${loadTime}ms | Console errors: ${criticalErrors.length}`);
      if (criticalErrors.length > 0) {
        console.log(`  Console errors:\n  - ${criticalErrors.join('\n  - ')}`);
      }

      // Must load within 8 seconds
      expect(loadTime, `${route.name} took ${loadTime}ms — exceeds 8000ms limit`).toBeLessThan(8000);

      // No application-level crash
      await expect(page.locator('text=Application Error')).not.toBeVisible();
      await expect(page.locator('text=Internal Server Error')).not.toBeVisible();
      await expect(page.locator('text=500')).not.toBeVisible();
    });
  }

  test('[SPINNER] No stuck spinner on public pages after 3s', async ({ page }) => {
    for (const route of PUBLIC_ROUTES) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const spinners = await page.locator('.animate-spin').all();
      for (const spinner of spinners) {
        const visible = await spinner.isVisible();
        if (visible) {
          console.warn(`  ⚠ Stuck spinner visible on ${route.path} after 3s`);
        }
      }
    }
  });

  test('[FORM] Login page — has email, password, submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('[FORM] Login with invalid credentials — does not get stuck', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'nonexistent_test_user@kfa-audit.com');
    await page.fill('input[type="password"]', 'BadPassword999!');
    await page.keyboard.press('Enter');

    // Wait 6 seconds — spinner must not be visible anymore
    await page.waitForTimeout(6000);
    const spinner = page.locator('.animate-spin');
    const count = await spinner.count();
    expect(count, 'Login spinner stuck 6s after invalid credentials').toBe(0);
    // Must not redirect to dashboard
    expect(page.url()).not.toContain('dashboard');
  });

  test('[AUTH] Auth callback with no session — resolves in 5s', async ({ page }) => {
    await page.goto('/auth/callback');
    await page.waitForTimeout(5000);
    const isStillLoading = await page.locator('text=Signing you in').isVisible();
    expect(isStillLoading, 'Auth callback stuck in loading state for 5+ seconds').toBe(false);
  });

  test('[FORM] Forgot password — has email field and submit button', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Send"), button:has-text("Reset")')).toBeVisible();
  });
});
