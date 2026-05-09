/**
 * scanCanonicalLock.test.js — locks the canonical scan-system
 * contract (May 2026 canonical scan-system lock pass).
 *
 *   • `/scan` is the ONLY canonical route. App.jsx maps
 *     `/scan-crop` → `<Navigate to="/scan" replace />` and the
 *     ScanPage no longer self-bounces in the opposite direction.
 *   • CameraScanPage carries a deprecation header and on mount
 *     unconditionally redirects to `/scan` for any direct caller.
 *
 * Why this test exists
 *   ScanPage previously had `if (!flagOn) navigate('/scan-crop')`,
 *   while App.jsx redirects `/scan-crop` → `/scan` permanently. If
 *   anyone flipped the flag off again, the browser would loop
 *   between the two routes. This test fails CI the moment that
 *   bounce reappears in either file.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../../');

function read(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

describe('scan-canonical-lock — only one scan flow ships', () => {
  it('ScanPage never calls navigate("/scan-crop")', () => {
    const src = read('src/pages/ScanPage.jsx');
    // Match any quote style, with or without an options arg.
    const banned = /navigate\(\s*['"`]\/scan-crop['"`]/;
    expect(banned.test(src)).toBe(false);
  });

  it('CameraScanPage unconditionally redirects to /scan', () => {
    const src = read('src/pages/CameraScanPage.jsx');
    // Must contain the redirect — the deprecation contract.
    expect(/navigate\(\s*['"`]\/scan['"`]/.test(src)).toBe(true);
    // Must NOT carry the old flag-gated bounce; specifically: no
    // `isFeatureEnabled` reference inside CameraScanPage now that
    // the redirect is unconditional.
    expect(/isFeatureEnabled\(\s*['"`]scanDetection['"`]/.test(src)).toBe(false);
  });

  it('CameraScanPage carries the DEPRECATED header', () => {
    const src = read('src/pages/CameraScanPage.jsx');
    expect(src.includes('DEPRECATED')).toBe(true);
    expect(src.includes('canonical scan')).toBe(true);
  });

  it('App.jsx routes /scan-crop to <Navigate to="/scan" />', () => {
    const src = read('src/App.jsx');
    // The route line should map the legacy path through Navigate,
    // not through CameraScanPage. Allow any whitespace + attribute
    // ordering.
    const ok = /Route\s+path="\/scan-crop"\s+element=\{\s*<Navigate\s+to="\/scan"/.test(src);
    expect(ok).toBe(true);
  });

  it('App.jsx /scan route still mounts ScanPage', () => {
    const src = read('src/App.jsx');
    // Defence-in-depth: the canonical entry must still be mounted.
    expect(/Route\s+path="\/scan"\s+element=/.test(src)).toBe(true);
    expect(src.includes('ScanPage')).toBe(true);
  });

  it('Soil scan stays on its own route — not folded into /scan', () => {
    const src = read('src/App.jsx');
    expect(/Route\s+path="\/scan\/soil"/.test(src)).toBe(true);
  });
});
