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

  it('CameraScanPage source file has been deleted', () => {
    // Stronger contract than the previous "deprecated header"
    // check: CameraScanPage was deleted in commit a9b71c1c as
    // part of the dual-Scan-interface fix. The /scan-crop legacy
    // route is now a Navigate redirect handled in App.jsx (see
    // the next test), with no source file to deprecate.
    const fs = readFileSync;
    let exists = true;
    try { fs(resolve(ROOT, 'src/pages/CameraScanPage.jsx'), 'utf8'); }
    catch { exists = false; }
    expect(exists).toBe(false);
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
