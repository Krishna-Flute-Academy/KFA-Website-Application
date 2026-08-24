import { test, expect } from '@playwright/test';

const PROTECTED_ROUTES = [
  '/student-dashboard',
  '/teacher-dashboard',
  '/teacher-dashboard/attendance',
  '/teacher-dashboard/students',
  '/teacher-dashboard/classrooms',
  '/teacher-dashboard/fees',
  '/teacher-dashboard/messages',
  '/teacher-dashboard/sessions',
  '/teacher-dashboard/tasks',
  '/teacher-dashboard/inventory',
  '/teacher-dashboard/settings',
  '/teacher-dashboard/role-allocation',
];

test.describe('02 · Protected Route Auth Redirect Tests', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`[AUTH] ${route} — redirects unauthenticated users (not 500)`, async ({ page }) => {
      await page.goto(route);
      
      // Wait for network to settle, which should include the redirect
      await page.waitForLoadState('networkidle');
      
      // Wait up to 3 seconds for the redirect to happen if it hasn't already
      try {
        await page.waitForURL((url) => {
           return url.pathname.includes('/login') || url.pathname.includes('/pending');
        }, { timeout: 3000 });
      } catch (e) {
        // We will catch it in the expect below
      }

      const url = page.url();
      const isRedirected = url.includes('/login') || url.includes('/pending');
      
      // Check for server errors
      const has500 = await page.locator('text=500').isVisible();
      const hasAppError = await page.locator('text=Application Error').isVisible();
      const hasInternalError = await page.locator('text=Internal Server Error').isVisible();

      expect(has500, `${route} returned 500 error`).toBe(false);
      expect(hasAppError, `${route} showed Application Error`).toBe(false);
      expect(hasInternalError, `${route} showed Internal Server Error`).toBe(false);
      
      expect(isRedirected, `${route} failed to redirect unauthenticated user`).toBe(true);
    });
  }
});
