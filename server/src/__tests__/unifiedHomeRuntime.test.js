/**
 * unifiedHomeRuntime.test.js — locks the May 2026 unified-runtime
 * contract for the Home / Dashboard route tree.
 *
 * Spec §11: only ONE active runtime tree allowed for Home / My Farm
 * / My Grow. This test pins the canonical wiring:
 *
 *   • /home          → <Home /> (Soft Ochre runtime)
 *   • /dashboard     → RoleAwareDashboard
 *                        farmer/null → <Navigate to="/home" />
 *                        ngo / admin → <NgoDashboardV1 />
 *   • /my-farm       → <MyFarmPage />
 *   • /my-grow       → <MyFarmPage /> (mode-aware copy, NOT a duplicate page)
 *
 * Anyone wiring a parallel farmer Home (e.g. mounting V2Dashboard
 * back on /dashboard) fails CI.
 */

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

vi.setConfig({ testTimeout: 15000 });

const ROOT = resolve(__dirname, '../../../');
function read(rel) { return readFileSync(resolve(ROOT, rel), 'utf8'); }

describe('Unified Home runtime — App.jsx route table', () => {
  it('/home mounts Home (canonical premium runtime)', () => {
    const src = read('src/App.jsx');
    expect(src).toMatch(/Route\s+path="\/home"/);
    // The Home symbol — boundary-anchored so a substring like
    // `HomeErrorBoundary` is not matched.
    expect(src).toMatch(/<Home\s*\/>/);
  });

  it('/dashboard route still exists but goes through RoleAwareDashboard', () => {
    const src = read('src/App.jsx');
    expect(src).toMatch(/Route\s+path="\/dashboard"/);
    expect(src).toMatch(/<RoleAwareDashboard>/);
  });

  it('/my-farm and /my-grow both mount MyFarmPage (no parallel garden page)', () => {
    const src = read('src/App.jsx');
    expect(src).toMatch(/Route\s+path="\/my-farm"\s+element=/);
    expect(src).toMatch(/Route\s+path="\/my-grow"\s+element=/);
    // The "Strict no-duplicates: NO parallel /my-grow page" comment
    // is the canonical contract — fail CI if anyone removes it.
    expect(src).toMatch(/Strict no-duplicates/);
  });
});

describe('RoleAwareDashboard — farmer redirect', () => {
  it('farmer / null / unknown role redirects to /home', async () => {
    // The component reads `useAuthOrNull` for role; in this
    // test we just assert the source-level contract: the file
    // imports Navigate and uses it on the farmer path.
    const src = read('src/components/system/RoleAwareDashboard.jsx');
    expect(src).toMatch(/import\s*\{\s*Navigate\s*\}\s*from\s*'react-router-dom'/);
    expect(src).toMatch(/<Navigate\s+to="\/home"\s+replace\s*\/>/);
    // The `children || null` legacy fallback (which used to
    // render V2Dashboard) MUST be gone from the farmer path.
    expect(src).not.toMatch(/return\s+children\s*\|\|\s*null/);
  });

  it('NGO/admin path still renders NgoDashboardV1', () => {
    const src = read('src/components/system/RoleAwareDashboard.jsx');
    expect(src).toMatch(/NGO_ROLES\.has\(role\)/);
    expect(src).toMatch(/<NgoDashboardV1\s*\/>/);
  });
});

describe('Home runtime — Soft Ochre lock', () => {
  it('imports PREMIUM_TOKENS from the canonical leaf', () => {
    const src = read('src/pages/Home.jsx');
    expect(src).toMatch(/PREMIUM_TOKENS as T/);
    expect(src).toMatch(/from '\.\.\/components\/premium\/tokens\.js'/);
  });

  it('does not carry legacy neon-green hex literals', () => {
    const src = read('src/pages/Home.jsx');
    // The Soft Ochre migration pass removed every #22C55E /
    // #16A34A / #86EFAC literal from Home. Anyone reintroducing
    // them fails CI.
    expect(src).not.toMatch(/#22C55E/);
    expect(src).not.toMatch(/#16A34A/);
    expect(src).not.toMatch(/#86EFAC/);
  });
});
