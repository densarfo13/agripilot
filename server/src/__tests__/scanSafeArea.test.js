/**
 * scanSafeArea.test.js — locks the 2026-07-06 mobile safe-area / bottom-nav-clearance fix.
 *
 * PremiumPage (the shared premium layout the Scan page renders inside) padded the bottom with
 * only `bottomPad`, never `env(safe-area-inset-bottom)` — so on notched iPhones the home
 * indicator overlapped the last row of content. And ScanPage passed `bottomPad="2rem"` (below
 * the 4.5rem default), too small to clear the fixed bottom nav → the action buttons could be
 * hidden. Fix: layout adds the safe-area inset (0 on desktop → desktop unchanged); Scan uses a
 * nav-clearing 6rem. Source-asserted (no jsdom / device runtime needed).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(resolve(__dirname, '../../../', p), 'utf8');

describe('mobile safe-area — Scan page never hidden behind bottom nav / notch', () => {
  const premium = read('src/components/premium/PremiumPage.jsx');
  const scan = read('src/pages/ScanPage.jsx');

  it('PremiumPage bottom padding includes env(safe-area-inset-bottom) via calc()', () => {
    expect(premium).toMatch(/padding:\s*`1\.25rem 1rem calc\(\$\{bottomPad\} \+ env\(safe-area-inset-bottom, 0px\)\)`/);
  });

  it('the safe-area default is 0px (env fallback) → desktop unchanged', () => {
    expect(premium).toContain('env(safe-area-inset-bottom, 0px)');
  });

  it('ScanPage no longer uses the too-small 2rem bottomPad (nav overlap)', () => {
    expect(scan).not.toContain('bottomPad="2rem"');
    expect(scan).toMatch(/bottomPad="(4\.5rem|5rem|6rem)"/); // clears the ~56px bottom nav
  });
});
