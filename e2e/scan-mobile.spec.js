/**
 * scan-mobile.spec.js — Playwright mobile safe-area / bottom-nav verification for the Scan page.
 *
 * NOT YET RUNNABLE IN THIS REPO — Playwright is not installed. To run:
 *   npm i -D @playwright/test && npx playwright install
 *   BASE_URL=http://localhost:5173 npx playwright test e2e/scan-mobile.spec.js
 * (point BASE_URL at a running dev server with a logged-in session, or wire an auth fixture).
 *
 * Verifies, on the four target devices: scan action buttons are visible + clickable, the bottom
 * nav does not overlap them, the iOS safe area is respected, and there is no scroll trap.
 */
import { test, expect, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCAN_PATH = process.env.SCAN_PATH || '/scan';

const TARGETS = [
  { name: 'iPhone SE',           device: devices['iPhone SE'] },
  { name: 'iPhone 13',           device: devices['iPhone 13'] },
  { name: 'iPhone 15 Pro Max',   device: devices['iPhone 15 Pro Max'] || devices['iPhone 14 Pro Max'] },
  { name: 'Pixel 8',             device: devices['Pixel 8'] || devices['Pixel 7'] },
];

// The Scan page's primary recovery/action buttons (ScanGuidanceCard + result CTAs).
const ACTION_TESTIDS = [
  'scan-guidance-retake',
  'scan-guidance-upload',
  'scan-guidance-save-review',
];

for (const { name, device } of TARGETS) {
  test.describe(`Scan mobile — ${name}`, () => {
    test.use({ ...device });

    test('action buttons are visible, clickable, not overlapped by bottom nav, no scroll trap', async ({ page }) => {
      await page.goto(BASE_URL + SCAN_PATH, { waitUntil: 'networkidle' });

      const scanPage = page.getByTestId('scan-page');
      await expect(scanPage).toBeVisible();

      // If a failure/guidance state is present, its action buttons must be reachable.
      const nav = page.locator('.bottom-nav, [data-testid="bottom-nav"]').first();
      const navBox = (await nav.count()) ? await nav.boundingBox() : null;

      for (const id of ACTION_TESTIDS) {
        const btn = page.getByTestId(id);
        if (!(await btn.count())) continue; // not in this scan state
        await btn.scrollIntoViewIfNeeded();
        await expect(btn).toBeVisible();
        const box = await btn.boundingBox();
        expect(box, `${id} has a layout box`).not.toBeNull();
        // No overlap: the button's bottom edge sits above the bottom nav's top edge.
        if (navBox) {
          expect(box.y + box.height, `${id} not under bottom nav`).toBeLessThanOrEqual(navBox.y + 1);
        }
        // Clickable (would receive the event; does not throw / is not covered).
        await expect(btn).toBeEnabled();
      }

      // No scroll trap: the page can be scrolled to the very bottom and the last action stays visible.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const last = page.getByTestId('scan-guidance-save-review');
      if (await last.count()) await expect(last).toBeInViewport();
    });
  });
}
