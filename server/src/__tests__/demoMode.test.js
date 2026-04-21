/**
 * demoMode.test.js — coordinated demo-readiness contract.
 *
 * Spec §9 coverage:
 *   • demo mode navigation filter
 *   • hidden advanced modules in demo mode
 *   • fallback analytics state
 *   • demo MFA bypass only for demo accounts in demo mode
 *   • session recovery (soft vs hard error dispatch)
 *   • demo seed population + idempotency
 *   • friendly empty/error wording
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function installWindow({ demoQuery = false, demoSticky = false } = {}) {
  const map = new Map();
  if (demoSticky) map.set('farroway.demoMode', '1');
  globalThis.window = {
    location: { search: demoQuery ? '?demo=1' : '' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener:    () => {},
    removeEventListener: () => {},
  };
  return map;
}

async function fresh() {
  // Re-import each suite so module-level state (if any) resets.
  const demoMode   = await import('../../../src/config/demoMode.js?t=' + Math.random());
  const fallbacks  = await import('../../../src/lib/demo/demoFallbacks.js?t=' + Math.random());
  const adminNav   = await import('../../../src/lib/demo/adminNav.js?t=' + Math.random());
  const mfaBypass  = await import('../../../src/lib/demo/mfaBypass.js?t=' + Math.random());
  const sessionGuard = await import('../../../src/lib/demo/sessionGuard.js?t=' + Math.random());
  const demoSeed   = await import('../../../src/lib/demo/demoSeed.js?t=' + Math.random());
  const issueStore = await import('../../../src/lib/issues/issueStore.js?t=' + Math.random());
  const farroway   = await import('../../../src/store/farrowayLocal.js?t=' + Math.random());
  return { demoMode, fallbacks, adminNav, mfaBypass, sessionGuard, demoSeed, issueStore, farroway };
}

// ─── isDemoMode detection ────────────────────────────────────────
describe('isDemoMode', () => {
  afterEach(() => { delete globalThis.window; });

  it('false by default', async () => {
    installWindow();
    const { demoMode } = await fresh();
    expect(demoMode.isDemoMode()).toBe(false);
  });

  it('true when ?demo=1 in URL', async () => {
    installWindow({ demoQuery: true });
    const { demoMode } = await fresh();
    expect(demoMode.isDemoMode()).toBe(true);
  });

  it('true when localStorage sticky flag set', async () => {
    installWindow({ demoSticky: true });
    const { demoMode } = await fresh();
    expect(demoMode.isDemoMode()).toBe(true);
  });

  it('setDemoMode round-trips', async () => {
    installWindow();
    const { demoMode } = await fresh();
    demoMode.setDemoMode(true);
    expect(demoMode.isDemoMode()).toBe(true);
    demoMode.setDemoMode(false);
    expect(demoMode.isDemoMode()).toBe(false);
  });

  it('isDemoAccount matches allow-list (case-insensitive)', async () => {
    installWindow();
    const { demoMode } = await fresh();
    expect(demoMode.isDemoAccount('demo@farroway.com')).toBe(true);
    expect(demoMode.isDemoAccount('DEMO@farroway.com')).toBe(true);
    expect(demoMode.isDemoAccount('real-admin@farroway.com')).toBe(false);
    expect(demoMode.isDemoAccount('')).toBe(false);
    expect(demoMode.isDemoAccount(null)).toBe(false);
  });
});

// ─── Admin nav filter ────────────────────────────────────────────
describe('admin nav filter', () => {
  afterEach(() => { delete globalThis.window; });

  const allItems = [
    { id: 'dashboard',        label: 'Dashboard' },
    { id: 'farmers',          label: 'Farmers' },
    { id: 'reports',          label: 'Reports' },
    { id: 'notifications',    label: 'Notifications' },
    { id: 'fraud-queue',      label: 'Fraud Queue' },
    { id: 'hotspots',         label: 'Hotspot Inspector' },
    { id: 'security',         label: 'Security Requests' },
    { id: 'intelligence',     label: 'Advanced Intelligence' },
  ];

  it('non-demo mode → all items pass through', async () => {
    installWindow();
    const { adminNav } = await fresh();
    expect(adminNav.filterAdminNav(allItems)).toHaveLength(allItems.length);
    expect(adminNav.hiddenInDemo(allItems)).toEqual([]);
  });

  it('demo mode → only the four demo items remain', async () => {
    installWindow({ demoQuery: true });
    const { adminNav } = await fresh();
    const visible = adminNav.filterAdminNav(allItems);
    expect(visible.map((i) => i.id)).toEqual(['dashboard', 'farmers', 'reports', 'notifications']);
    const hidden = adminNav.hiddenInDemo(allItems);
    expect(hidden.map((i) => i.id))
      .toEqual(['fraud-queue', 'hotspots', 'security', 'intelligence']);
  });

  it('matches nav items by id, key, label, slug, or path', async () => {
    installWindow({ demoQuery: true });
    const { adminNav } = await fresh();
    const items = [
      { key: 'dashboard' },           // by key
      { label: 'Reports' },           // by label
      { slug: 'farmers' },            // by slug
      { path: '/admin/notifications' }, // by nested path
      { id: 'secret' },               // unknown → hidden
    ];
    const visible = adminNav.filterAdminNav(items);
    expect(visible).toHaveLength(4);
  });
});

// ─── Fallback analytics ──────────────────────────────────────────
describe('demo fallback analytics', () => {
  afterEach(() => { delete globalThis.window; });

  it('fallback summary returns non-zero demo KPIs', async () => {
    installWindow({ demoQuery: true });
    const { fallbacks } = await fresh();
    const fb = fallbacks.getFallbackNgoSummary();
    expect(fb.totalFarmers).toBeGreaterThan(0);
    expect(fb.activeFarmers).toBeGreaterThan(0);
    expect(fb.source).toBe('demo_fallback');
  });

  it('shouldShowFallback only fires in demo mode', async () => {
    installWindow(); // no demo
    let mod = await fresh();
    expect(mod.fallbacks.shouldShowFallback({ error: 'boom' })).toBe(false);
    delete globalThis.window;
    installWindow({ demoQuery: true });
    mod = await fresh();
    expect(mod.fallbacks.shouldShowFallback({ error: 'boom' })).toBe(true);
  });

  it('shouldShowFallback catches empty arrays + all-zero payloads', async () => {
    installWindow({ demoQuery: true });
    const { fallbacks } = await fresh();
    expect(fallbacks.shouldShowFallback({ data: [] })).toBe(true);
    expect(fallbacks.shouldShowFallback({ data: null })).toBe(true);
    expect(fallbacks.shouldShowFallback({
      data: { totalFarmers: 0, activeFarmers: 0 },
    })).toBe(true);
    expect(fallbacks.shouldShowFallback({
      data: { totalFarmers: 5, activeFarmers: 0 },
    })).toBe(false);
  });

  it('friendly empty/error messages return i18n-key + fallback pair', async () => {
    installWindow();
    const { fallbacks } = await fresh();
    const e = fallbacks.friendlyEmptyMessage('notifications');
    expect(e.key).toBe('admin.empty.notifications');
    expect(e.fallback).toMatch(/clear|alerts|right now/i);
    const err = fallbacks.friendlyErrorMessage('analytics');
    expect(err.key).toBe('admin.softError.analytics');
    expect(err.fallback).toMatch(/preparing|moment/i);
  });
});

// ─── MFA bypass ──────────────────────────────────────────────────
describe('shouldBypassMfa', () => {
  afterEach(() => { delete globalThis.window; });

  it('false outside demo mode even for demo accounts', async () => {
    installWindow();
    const { mfaBypass } = await fresh();
    expect(mfaBypass.shouldBypassMfa('demo@farroway.com')).toBe(false);
  });

  it('false in demo mode for non-demo accounts', async () => {
    installWindow({ demoQuery: true });
    const { mfaBypass } = await fresh();
    expect(mfaBypass.shouldBypassMfa('admin@farroway.com')).toBe(false);
  });

  it('true only when BOTH conditions hold', async () => {
    installWindow({ demoQuery: true });
    const { mfaBypass } = await fresh();
    expect(mfaBypass.shouldBypassMfa('demo@farroway.com')).toBe(true);
    expect(mfaBypass.shouldBypassMfa('demo-admin@farroway.com')).toBe(true);
  });
});

// ─── Session guard ───────────────────────────────────────────────
describe('handleApiError — session recovery', () => {
  afterEach(() => { delete globalThis.window; });

  it('in demo mode, 401 errors trigger soft-expire handler', async () => {
    installWindow({ demoQuery: true });
    const { sessionGuard } = await fresh();
    let softCalled = false;
    let hardCalled = false;
    const result = sessionGuard.handleApiError(
      { status: 401, message: 'Session expired' },
      { onSoftExpire: () => { softCalled = true; },
        onHardError:  () => { hardCalled = true; } },
    );
    expect(softCalled).toBe(true);
    expect(hardCalled).toBe(false);
    expect(result.handled).toBe('soft_expire');
  });

  it('outside demo mode, 401 errors take the hard path', async () => {
    installWindow();
    const { sessionGuard } = await fresh();
    let softCalled = false;
    let hardCalled = false;
    sessionGuard.handleApiError(
      { status: 401 },
      { onSoftExpire: () => { softCalled = true; },
        onHardError:  () => { hardCalled = true; } },
    );
    expect(softCalled).toBe(false);
    expect(hardCalled).toBe(true);
  });

  it('non-session errors go to hardError even in demo mode', async () => {
    installWindow({ demoQuery: true });
    const { sessionGuard } = await fresh();
    let hardCalled = false;
    const result = sessionGuard.handleApiError(
      { status: 500, message: 'DB crashed' },
      { onHardError: () => { hardCalled = true; } },
    );
    expect(hardCalled).toBe(true);
    expect(result.handled).toBe('hard_error');
  });
});

// ─── Seed ────────────────────────────────────────────────────────
describe('ensureDemoSeed', () => {
  afterEach(() => { delete globalThis.window; });

  it('no-op outside demo mode', async () => {
    installWindow();
    const { demoSeed, farroway } = await fresh();
    const result = demoSeed.ensureDemoSeed();
    expect(result.seeded).toBe(false);
    expect(result.reason).toBe('demo_mode_off');
    expect(farroway.getFarms()).toEqual([]);
  });

  it('seeds the store in demo mode on first call', async () => {
    installWindow({ demoQuery: true });
    const { demoSeed, farroway, issueStore } = await fresh();
    const result = demoSeed.ensureDemoSeed();
    expect(result.seeded).toBe(true);
    expect(result.counts.farms).toBe(18);          // spec §4 "15-20"
    expect(result.counts.activeFarms).toBeGreaterThan(10);
    expect(result.counts.issues).toBeGreaterThan(0);
    expect(farroway.getFarms().length).toBe(18);
    expect(issueStore.getAllIssues().length).toBeGreaterThan(0);
    // Mixed active/inactive
    expect(farroway.getActiveFarmId()).toBeTruthy();
  });

  it('idempotent — second call is a no-op', async () => {
    installWindow({ demoQuery: true });
    const { demoSeed } = await fresh();
    demoSeed.ensureDemoSeed();
    const second = demoSeed.ensureDemoSeed();
    expect(second.seeded).toBe(false);
    expect(second.reason).toBe('already_seeded');
  });

  it('skips seed when store already has real data', async () => {
    installWindow({ demoQuery: true });
    const { demoSeed, farroway } = await fresh();
    farroway.saveFarm({ name: 'Real', crop: 'maize', country: 'GH' });
    const result = demoSeed.ensureDemoSeed();
    expect(result.seeded).toBe(false);
    expect(result.reason).toBe('store_not_empty');
  });
});
