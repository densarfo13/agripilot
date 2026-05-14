/**
 * stabilityHardeningPrimitives.test.js — Final Production
 * Stabilization deliverables:
 *
 *   1. uatSeed - realistic, idempotent demo data with a sentinel
 *      tag so production filters can exclude it.
 *   2. partnerApplicationStore - data-layer stub for the future
 *      funding-partner intake flow.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
    key:        (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
    _store: store,
  };
}

beforeEach(() => {
  vi.resetModules();
  const ls = makeStorage();
  globalThis.localStorage = ls;
  globalThis.window = {
    localStorage: ls,
    addEventListener:    vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent:       vi.fn(),
  };
});

// ─── 1. uatSeed ──────────────────────────────────────────────

describe('uatSeed.seedUatData', () => {
  it('seeds Maryland farm + listings + funding + tasks + scans + journal', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    const out = mod.seedUatData({ mode: 'farm_us' });
    expect(out.ok).toBe(true);
    expect(out.mode).toBe('farm_us');
    expect(out.counts.farms).toBe(1);
    expect(out.counts.listings).toBeGreaterThanOrEqual(2);
    expect(out.counts.funding).toBeGreaterThanOrEqual(3);
    expect(out.counts.tasks).toBeGreaterThanOrEqual(3);
    expect(out.counts.scans).toBeGreaterThanOrEqual(3);
    expect(out.counts.journal).toBeGreaterThanOrEqual(3);
  });

  it('writes to the canonical localStorage keys Home / Tasks / Sell read', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    mod.seedUatData({ mode: 'farm_us' });
    expect(globalThis.localStorage.getItem('farroway.farms')).toBeTruthy();
    expect(globalThis.localStorage.getItem('farroway.activeFarmId')).toBeTruthy();
    expect(globalThis.localStorage.getItem('farroway_active_farm')).toBeTruthy();
    expect(globalThis.localStorage.getItem('farroway_market_listings_v1')).toBeTruthy();
    expect(globalThis.localStorage.getItem('farroway_tasks_v1')).toBeTruthy();
    expect(globalThis.localStorage.getItem('farroway_journal_timeline_v1')).toBeTruthy();
  });

  it('every seeded entity carries the UAT_DEMO tag so production filters can exclude', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    mod.seedUatData({ mode: 'farm_us' });
    const farms = JSON.parse(globalThis.localStorage.getItem('farroway.farms'));
    expect(farms[0].program).toBe(mod.UAT_TAG);
    const listings = JSON.parse(globalThis.localStorage.getItem('farroway_market_listings_v1'));
    expect(listings[0].tag).toBe(mod.UAT_TAG);
    const funding = JSON.parse(globalThis.localStorage.getItem('farroway_funding_opportunities_v1'));
    expect(funding[0].tag).toBe(mod.UAT_TAG);
    expect(funding[0].isDemo).toBe(true);
  });

  it('idempotent — re-running keeps the same farmId (no duplicate farms)', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    const first  = mod.seedUatData({ mode: 'farm_us' });
    const second = mod.seedUatData({ mode: 'farm_us' });
    expect(first.farmId).toBe(second.farmId);
    const farms = JSON.parse(globalThis.localStorage.getItem('farroway.farms'));
    expect(farms.length).toBe(1);
  });

  it('Ghana scenario seeds backyard garden with country=GH for Celsius display', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    const out = mod.seedUatData({ mode: 'farm_gh' });
    expect(out.ok).toBe(true);
    const farms = JSON.parse(globalThis.localStorage.getItem('farroway.farms'));
    expect(farms[0].country).toBe('GH');
    expect(farms[0].farmType).toBe('backyard');
    // Garden experience activates so Home renders the garden-mode UI.
    expect(globalThis.localStorage.getItem('farroway_active_experience')).toBe('garden');
  });

  it('Maryland farm has US country + matching coords (covers weather unit test)', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    mod.seedUatData({ mode: 'farm_us' });
    const farms = JSON.parse(globalThis.localStorage.getItem('farroway.farms'));
    expect(farms[0].country).toBe('US');
    expect(farms[0].state).toBe('MD');
    expect(farms[0].latitude).toBeCloseTo(39.41, 1);
    expect(farms[0].longitude).toBeCloseTo(-77.41, 1);
  });
});

describe('uatSeed.clearUatData', () => {
  it('removes every UAT-tagged key', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    mod.seedUatData({ mode: 'farm_us' });
    expect(mod.isUatSeeded()).toBe(true);
    mod.clearUatData();
    expect(mod.isUatSeeded()).toBe(false);
    expect(globalThis.localStorage.getItem('farroway.farms')).toBeNull();
    expect(globalThis.localStorage.getItem('farroway_market_listings_v1')).toBeNull();
  });
});

describe('uatSeed.isUatSeeded / getUatSentinel', () => {
  it('returns false before seeding', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    expect(mod.isUatSeeded()).toBe(false);
    expect(mod.getUatSentinel()).toBeNull();
  });

  it('sentinel object carries the scenario + tag', async () => {
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    mod.seedUatData({ mode: 'farm_gh' });
    const sentinel = mod.getUatSentinel();
    expect(sentinel).toBeTruthy();
    expect(sentinel.scenario).toBe('farm_gh');
    expect(sentinel.tag).toBe(mod.UAT_TAG);
    expect(Number.isFinite(sentinel.seededAt)).toBe(true);
  });

  it('returns null on corrupted sentinel', async () => {
    globalThis.localStorage.setItem('farroway_uat_seed_sentinel', '{not-json');
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    expect(mod.getUatSentinel()).toBeNull();
  });

  it('survives SSR (no localStorage)', async () => {
    delete globalThis.localStorage;
    delete globalThis.window;
    const mod = await import('../../../src/lib/seed/uatSeed.js');
    expect(() => mod.seedUatData()).not.toThrow();
    expect(mod.isUatSeeded()).toBe(false);
  });
});

// ─── 2. partnerApplicationStore ──────────────────────────────

describe('partnerApplicationStore.submitPartnerApplication', () => {
  it('persists a valid application + returns an id', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const out = mod.submitPartnerApplication({
      orgName:      'Acme Microfinance',
      contactName:  'Jane Doe',
      contactEmail: 'jane@acme.example',
      kind:         'loan',
      regions:      ['US', 'GH'],
      summary:      'Microloans for smallholder farmers.',
    });
    expect(out.ok).toBe(true);
    expect(typeof out.id).toBe('string');
    expect(out.application.orgName).toBe('Acme Microfinance');
    expect(out.application.status).toBe('submitted');
  });

  it('rejects an application missing required fields', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const out = mod.submitPartnerApplication({ orgName: 'Solo' });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('missing_required_fields');
  });

  it('normalises unknown kind to "other"', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const out = mod.submitPartnerApplication({
      orgName: 'Org', contactName: 'X', contactEmail: 'x@y.test',
      kind: 'pyramid_scheme',
    });
    expect(out.ok).toBe(true);
    expect(out.application.kind).toBe('other');
  });

  it('idempotent on (orgName, contactEmail) - duplicate returns existing id', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const a = mod.submitPartnerApplication({
      orgName: 'Acme', contactName: 'A', contactEmail: 'a@a.test', kind: 'grant',
    });
    const b = mod.submitPartnerApplication({
      orgName: 'Acme', contactName: 'A', contactEmail: 'a@a.test', kind: 'grant',
    });
    expect(b.deduped).toBe(true);
    expect(b.id).toBe(a.id);
  });
});

describe('partnerApplicationStore.updatePartnerApplicationStatus', () => {
  it('moves submitted → reviewing → approved', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const { id } = mod.submitPartnerApplication({
      orgName: 'A', contactName: 'B', contactEmail: 'c@d.test', kind: 'grant',
    });
    expect(mod.updatePartnerApplicationStatus(id, 'reviewing').ok).toBe(true);
    expect(mod.updatePartnerApplicationStatus(id, 'approved').ok).toBe(true);
  });

  it('rejects submitted → approved (must go through reviewing)', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const { id } = mod.submitPartnerApplication({
      orgName: 'A', contactName: 'B', contactEmail: 'c@d.test', kind: 'grant',
    });
    const out = mod.updatePartnerApplicationStatus(id, 'approved');
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('invalid_transition');
  });

  it('terminal status (approved / rejected) cannot be moved again', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const { id } = mod.submitPartnerApplication({
      orgName: 'A', contactName: 'B', contactEmail: 'c@d.test', kind: 'grant',
    });
    mod.updatePartnerApplicationStatus(id, 'reviewing');
    mod.updatePartnerApplicationStatus(id, 'approved');
    const out = mod.updatePartnerApplicationStatus(id, 'reviewing');
    expect(out.ok).toBe(false);
  });

  it('records reviewer metadata', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const { id } = mod.submitPartnerApplication({
      orgName: 'A', contactName: 'B', contactEmail: 'c@d.test', kind: 'grant',
    });
    const out = mod.updatePartnerApplicationStatus(id, 'reviewing', {
      reviewedBy:  'admin-1',
      reviewNotes: 'awaiting compliance check',
    });
    expect(out.application.reviewedBy).toBe('admin-1');
    expect(out.application.reviewNotes).toBe('awaiting compliance check');
  });
});

describe('partnerApplicationStore.getReviewQueue', () => {
  it('groups by status — pending first', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const a = mod.submitPartnerApplication({ orgName: 'A', contactName: 'X', contactEmail: 'a@a.test', kind: 'grant' });
    const b = mod.submitPartnerApplication({ orgName: 'B', contactName: 'Y', contactEmail: 'b@b.test', kind: 'loan' });
    mod.updatePartnerApplicationStatus(b.id, 'reviewing');
    const queue = mod.getReviewQueue();
    expect(queue.pending.length).toBe(1);
    expect(queue.reviewing.length).toBe(1);
    expect(queue.pending[0].id).toBe(a.id);
    expect(queue.reviewing[0].id).toBe(b.id);
  });

  it('excludeDemo filters UAT-tagged entries', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    // Inject a demo-tagged row directly so we can exercise the filter.
    globalThis.localStorage.setItem(
      'farroway_partner_applications_v1',
      JSON.stringify([
        { id: 'real',  orgName: 'Real',  status: 'submitted', submittedAt: 1000, tag: null },
        { id: 'demo',  orgName: 'Demo',  status: 'submitted', submittedAt: 1500, tag: 'UAT_DEMO' },
      ]),
    );
    const queue = mod.getReviewQueue({ excludeDemo: true });
    expect(queue.pending.length).toBe(1);
    expect(queue.pending[0].id).toBe('real');
  });

  it('reports empty queue without throwing on a clean install', async () => {
    const mod = await import('../../../src/lib/partners/partnerApplicationStore.js');
    const queue = mod.getReviewQueue();
    expect(queue.pending).toEqual([]);
    expect(queue.reviewing).toEqual([]);
    expect(queue.terminal).toEqual([]);
  });
});
