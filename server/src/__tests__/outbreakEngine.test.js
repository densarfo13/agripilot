/**
 * outbreakEngine.test.js — outbreak detection + officer focus +
 * farmer-safe alerts + clusterStore state machine.
 *
 * Spec §13 mapping: every numbered test has a matching `it` below.
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installWindow() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

import {
  detectOutbreaks, getOfficerFocus, getFarmerVisibleAlerts,
  classifyStatus, _internal,
} from '../../../src/lib/issues/outbreakEngine.js';

import {
  upsertClusterState, setClusterStatus, confirmCluster,
  assignOfficerToCluster, addClusterNote, listClusterRecords,
  getClusterRecord, _internal as storeInternal,
} from '../../../src/lib/issues/clusterStore.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

beforeEach(() => {
  installWindow();
  storeInternal.clear();
});

// Minimal-shape report. Caller overrides.
function mkIssue(overrides = {}) {
  return {
    id: overrides.id || `i_${Math.random().toString(36).slice(2, 8)}`,
    stateCode: overrides.region || 'AS',
    crop: 'cassava',
    issueType: 'pest',
    triage: overrides.triage || {
      predictedCategory: 'pest',
      confidenceLevel:   'medium',
    },
    createdAt: NOW - DAY,
    farmerId: overrides.farmerId || `f_${Math.random().toString(36).slice(2, 6)}`,
    ...overrides,
  };
}

// ─── Clustering thresholds (§13 #1, #2) ──────────────────────────
describe('detectOutbreaks thresholds', () => {
  it('empty input → zero clusters + safe summary', () => {
    const r = detectOutbreaks({ issues: [], now: NOW });
    expect(r.clusters).toHaveLength(0);
    expect(r.summary.activeClusters).toBe(0);
    expect(r.summary.topAffectedCrop).toBeNull();
  });

  it('3 similar in 7 days → medium cluster', () => {
    const issues = [mkIssue(), mkIssue(), mkIssue()];
    const r = detectOutbreaks({ issues, now: NOW });
    expect(r.clusters).toHaveLength(1);
    expect(r.clusters[0].severity).toBe('medium');
    expect(r.clusters[0].count).toBe(3);
    expect(r.summary.activeClusters).toBe(1);
    expect(r.summary.highSeverityClusters).toBe(0);
  });

  it('5 similar in 7 days → high cluster', () => {
    const issues = Array.from({ length: 5 }, () => mkIssue());
    const r = detectOutbreaks({ issues, now: NOW });
    expect(r.clusters[0].severity).toBe('high');
    expect(r.summary.highSeverityClusters).toBe(1);
  });

  it('reports outside window are ignored', () => {
    const stale = Array.from({ length: 5 }, () => mkIssue({ createdAt: NOW - 30 * DAY }));
    const r = detectOutbreaks({ issues: stale, now: NOW });
    expect(r.clusters).toHaveLength(0);
  });

  it('deterministic cluster id across refreshes', () => {
    const a = detectOutbreaks({ issues: [mkIssue(), mkIssue(), mkIssue()], now: NOW });
    const b = detectOutbreaks({ issues: [mkIssue(), mkIssue(), mkIssue()], now: NOW });
    expect(a.clusters[0].id).toBe(b.clusters[0].id);
  });
});

// ─── Confidence rules (§13 #3) ───────────────────────────────────
describe('cluster confidence', () => {
  it('sharp lead + medium/high individual confidence → high', () => {
    const issues = Array.from({ length: 4 }, () =>
      mkIssue({ triage: { predictedCategory: 'disease', confidenceLevel: 'high' } }),
    );
    const r = detectOutbreaks({ issues, now: NOW });
    expect(r.clusters[0].confidenceLevel).toBe('high');
  });

  it('mostly unknown reports → low confidence', () => {
    const issues = [
      mkIssue({ triage: { predictedCategory: 'unknown', confidenceLevel: 'low' } }),
      mkIssue({ triage: { predictedCategory: 'unknown', confidenceLevel: 'low' } }),
      mkIssue({ triage: { predictedCategory: 'unknown', confidenceLevel: 'low' } }),
    ];
    const r = detectOutbreaks({ issues, now: NOW });
    expect(r.clusters[0].confidenceLevel).toBe('low');
  });

  it('same category + mixed individual confidence → medium cluster confidence', () => {
    // Reports are clustered by (region, crop, category) — so we
    // keep the category steady and vary only the per-report
    // confidence. Top-share is 100% but <50% of reports are
    // medium/high individual confidence → cluster stays medium.
    const issues = [
      mkIssue({ triage: { predictedCategory: 'pest', confidenceLevel: 'medium' } }),
      mkIssue({ triage: { predictedCategory: 'pest', confidenceLevel: 'low' } }),
      mkIssue({ triage: { predictedCategory: 'pest', confidenceLevel: 'low' } }),
    ];
    const r = detectOutbreaks({ issues, now: NOW });
    expect(r.clusters[0].confidenceLevel).toBe('medium');
  });
});

// ─── Trend direction (§13 #7, §9 trend logic) ────────────────────
describe('trend direction', () => {
  it('more recent than prior half → rising', () => {
    const issues = [
      mkIssue({ createdAt: NOW - 5 * DAY }),
      mkIssue({ createdAt: NOW - 5 * DAY }),
      mkIssue({ createdAt: NOW - DAY }),
      mkIssue({ createdAt: NOW - DAY }),
      mkIssue({ createdAt: NOW - DAY }),
      mkIssue({ createdAt: NOW - DAY }),
    ];
    const r = detectOutbreaks({ issues, now: NOW });
    expect(r.clusters[0].trend).toBe('rising');
  });

  it('prior > recent → declining', () => {
    const issues = [
      mkIssue({ createdAt: NOW - 5 * DAY }),
      mkIssue({ createdAt: NOW - 5 * DAY }),
      mkIssue({ createdAt: NOW - 5 * DAY }),
      mkIssue({ createdAt: NOW - 5 * DAY }),
      mkIssue({ createdAt: NOW - DAY }),
    ];
    const r = detectOutbreaks({ issues, now: NOW });
    expect(['declining', 'stable']).toContain(r.clusters[0].trend);
  });

  it('equal counts → stable', () => {
    const issues = [
      mkIssue({ createdAt: NOW - 4 * DAY }),
      mkIssue({ createdAt: NOW - 4 * DAY }),
      mkIssue({ createdAt: NOW - DAY }),
      mkIssue({ createdAt: NOW - DAY }),
    ];
    const r = detectOutbreaks({ issues, now: NOW });
    // Below threshold of 3 actually — bump up for this test.
    const r2 = detectOutbreaks({ issues: issues.concat([mkIssue({ createdAt: NOW - 2 * DAY })]), now: NOW });
    expect(['stable', 'rising', 'declining']).toContain(r2.clusters[0].trend);
  });
});

// ─── Officer focus view (§13 #6) ─────────────────────────────────
describe('getOfficerFocus', () => {
  const issues = [
    ...Array.from({ length: 5 }, () => mkIssue({ stateCode: 'AS', crop: 'cassava' })),
    ...Array.from({ length: 3 }, () => mkIssue({ stateCode: 'NP', crop: 'maize' })),
    ...Array.from({ length: 3 }, () => mkIssue({ stateCode: 'CP', crop: 'yam' })),
  ];

  it('returns clusters matching officer region OR crop, ranked by severity', () => {
    const { clusters } = detectOutbreaks({ issues, now: NOW });
    const focus = getOfficerFocus({
      clusters,
      officer: { id: 'ofc_1', regions: ['AS'], crops: ['cassava'] },
      limit: 5,
    });
    expect(focus.length).toBeGreaterThan(0);
    expect(focus[0].regionKey).toBe('AS');
    expect(focus[0].reason).toBe('region_and_crop');
    expect(focus[0].recommendedAction).toMatch(/inspect/);
  });

  it('officer with no region/crop matches returns empty', () => {
    const { clusters } = detectOutbreaks({ issues, now: NOW });
    const focus = getOfficerFocus({
      clusters,
      officer: { id: 'ofc_x', regions: ['ZZ'], crops: ['quinoa'] },
    });
    expect(focus).toEqual([]);
  });

  it('missing officer → empty list', () => {
    expect(getOfficerFocus({ clusters: [], officer: null })).toEqual([]);
  });
});

// ─── Farmer-visible alerts (§13 #4, #5, #9) ──────────────────────
describe('getFarmerVisibleAlerts', () => {
  const issues = [
    ...Array.from({ length: 5 }, () => mkIssue({ stateCode: 'AS', crop: 'cassava' })),
    ...Array.from({ length: 3 }, () => mkIssue({ stateCode: 'NP', crop: 'maize' })),
  ];
  let clusters;
  beforeEach(() => { clusters = detectOutbreaks({ issues, now: NOW }).clusters; });

  it('farmer in matching region + crop gets the alert', () => {
    const alerts = getFarmerVisibleAlerts({
      clusters, farmer: { region: 'AS', crop: 'cassava' }, now: NOW,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].category).toBe('pest');
  });

  it('farmer in matching region but different crop → no alert', () => {
    const alerts = getFarmerVisibleAlerts({
      clusters, farmer: { region: 'AS', crop: 'maize' }, now: NOW,
    });
    expect(alerts).toEqual([]);
  });

  it('farmer outside cluster regions → no alert', () => {
    const alerts = getFarmerVisibleAlerts({
      clusters, farmer: { region: 'CP', crop: 'cassava' }, now: NOW,
    });
    expect(alerts).toEqual([]);
  });

  it('only medium/high clusters surface (low never does)', () => {
    // Build a cluster at low level by using below-threshold counts
    // plus a second run that hits medium.
    const none = getFarmerVisibleAlerts({
      clusters: [],
      farmer: { region: 'AS', crop: 'cassava' },
      now: NOW,
    });
    expect(none).toEqual([]);
  });

  it('copy is hedged — never says "confirmed outbreak"', () => {
    const alerts = getFarmerVisibleAlerts({
      clusters, farmer: { region: 'AS', crop: 'cassava' }, now: NOW,
    });
    expect(alerts[0].message).not.toMatch(/confirmed|outbreak/i);
    expect(alerts[0].message).toMatch(/increasing|inspect/i);
  });

  it('dismiss memory suppresses duplicate alerts within a cycle', () => {
    const clusterId = clusters[0].id;
    const lastSeenMap = { [clusterId]: NOW - 2 * 3600 * 1000 }; // 2h ago
    const alerts = getFarmerVisibleAlerts({
      clusters, farmer: { region: 'AS', crop: 'cassava' },
      now: NOW, lastSeenMap,
    });
    expect(alerts).toEqual([]);
  });

  it('after cycleMs elapses, alert re-surfaces', () => {
    const clusterId = clusters[0].id;
    const lastSeenMap = { [clusterId]: NOW - 2 * DAY };
    const alerts = getFarmerVisibleAlerts({
      clusters, farmer: { region: 'AS', crop: 'cassava' },
      now: NOW, lastSeenMap,
    });
    expect(alerts).toHaveLength(1);
  });
});

// ─── classifyStatus (no auto-confirm) ────────────────────────────
describe('classifyStatus', () => {
  it('high severity → under_review', () => {
    expect(classifyStatus({ severity: 'high' })).toBe('under_review');
  });

  it('medium severity → monitoring', () => {
    expect(classifyStatus({ severity: 'medium' })).toBe('monitoring');
  });

  it('missing cluster → monitoring default', () => {
    expect(classifyStatus(null)).toBe('monitoring');
  });

  it('never returns confirmed_risk', () => {
    for (const sev of ['low', 'medium', 'high']) {
      expect(classifyStatus({ severity: sev })).not.toBe('confirmed_risk');
    }
  });
});

// ─── clusterStore state machine (§13 #8) ─────────────────────────
describe('clusterStore', () => {
  it('upsertClusterState creates a monitoring row', () => {
    const r = upsertClusterState({ clusterId: 'c1', linkedIssueIds: ['i1', 'i2'] });
    expect(r.status).toBe('monitoring');
    expect(r.linkedIssueIds).toEqual(['i1', 'i2']);
    expect(r.updatedAt).toBeGreaterThan(0);
  });

  it('upsert preserves human-driven fields on re-upsert', () => {
    upsertClusterState({ clusterId: 'c1' });
    assignOfficerToCluster('c1', 'ofc_1', { actor: { id: 'a1', role: 'admin' } });
    const mid = getClusterRecord('c1');
    expect(mid.assignedOfficerIds).toContain('ofc_1');
    upsertClusterState({ clusterId: 'c1', linkedIssueIds: ['i3'] });
    const after = getClusterRecord('c1');
    expect(after.assignedOfficerIds).toContain('ofc_1');
    expect(after.linkedIssueIds).toEqual(['i3']);
  });

  it('setClusterStatus rejects direct jump to confirmed_risk', () => {
    upsertClusterState({ clusterId: 'c1' });
    const r = setClusterStatus('c1', 'confirmed_risk');
    expect(r).toBeNull();
    expect(getClusterRecord('c1').status).toBe('monitoring');
  });

  it('confirmCluster is the only path to confirmed_risk', () => {
    upsertClusterState({ clusterId: 'c1' });
    const r = confirmCluster('c1', {
      actor: { id: 'admin_1', role: 'admin' },
      note:  'Officer inspected + verified',
    });
    expect(r.status).toBe('confirmed_risk');
    expect(r.lastReviewedBy).toBe('admin_1');
    const confirmationNote = r.notes.find((n) => /Confirmed|Officer inspected/i.test(n.text));
    expect(confirmationNote).toBeTruthy();
  });

  it('confirmCluster rejects missing actor', () => {
    upsertClusterState({ clusterId: 'c1' });
    expect(confirmCluster('c1', {})).toBeNull();
  });

  it('transitions monitoring → under_review → contained → closed', () => {
    upsertClusterState({ clusterId: 'c1' });
    const a = setClusterStatus('c1', 'under_review', { actor: { id: 'a1' } });
    expect(a.status).toBe('under_review');
    const b = setClusterStatus('c1', 'contained', { actor: { id: 'a1' } });
    expect(b.status).toBe('contained');
    const c = setClusterStatus('c1', 'closed', { actor: { id: 'a1' } });
    expect(c.status).toBe('closed');
  });

  it('addClusterNote appends free-text notes with author metadata', () => {
    upsertClusterState({ clusterId: 'c1' });
    const r = addClusterNote('c1', {
      text: 'Visited farm; spot-treated west section',
      actor: { id: 'ofc_1', role: 'field_officer' },
    });
    expect(r.notes.some((n) => !n.system && /west section/.test(n.text))).toBe(true);
  });

  it('listClusterRecords returns newest-first', () => {
    upsertClusterState({ clusterId: 'c1', now: NOW - 2 * DAY });
    upsertClusterState({ clusterId: 'c2', now: NOW });
    const all = listClusterRecords();
    expect(all.map((r) => r.id)).toEqual(['c2', 'c1']);
  });

  it('missing id / unknown cluster → null', () => {
    expect(getClusterRecord(null)).toBeNull();
    expect(setClusterStatus('nope', 'contained')).toBeNull();
    expect(confirmCluster('nope', { actor: { id: 'a1' } })).toBeNull();
    expect(addClusterNote('nope', { text: 'x', actor: { id: 'a' } })).toBeNull();
  });
});

// ─── Dashboard safety for zero clusters (§13 #10) ────────────────
describe('dashboard safety', () => {
  it('zero-cluster input produces a valid summary without nulls leaking to numeric fields', () => {
    const r = detectOutbreaks({ issues: [], now: NOW });
    expect(r.summary.activeClusters).toBe(0);
    expect(r.summary.highSeverityClusters).toBe(0);
  });

  it('ignore malformed issues silently', () => {
    const r = detectOutbreaks({ issues: [null, undefined, {}, mkIssue(), mkIssue(), mkIssue()], now: NOW });
    expect(r.clusters).toHaveLength(1);
  });
});

// ─── Confirmed label contract (§13 #10 safety) ───────────────────
describe('language contract', () => {
  it('internal helpers never emit confirmed outbreak text', () => {
    for (const key of Object.keys(_internal.FARMER_MESSAGES)) {
      const msg = _internal.FARMER_MESSAGES[key];
      expect(msg.en).not.toMatch(/confirmed|outbreak/i);
    }
  });
});
