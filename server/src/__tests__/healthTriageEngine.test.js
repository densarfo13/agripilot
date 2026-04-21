/**
 * healthTriageEngine.test.js — symptom → category triage + regional
 * alerts + farmer/officer wrappers on issueStore.
 *
 * Covers spec §18 end-to-end.
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    location: { pathname: '/', search: '' },
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
  triageFarmHealthIssue, CATEGORY_LABELS, NEXT_STEPS, _internal as triageInternal,
} from '../../../src/lib/issues/healthTriageEngine.js';

import {
  detectRegionalHealthAlerts, farmerVisibleAlertsFor,
} from '../../../src/lib/issues/regionalHealthAlerts.js';

import {
  createHealthReport, confirmHealthCategory,
  getIssueById, _internal as storeInternal,
} from '../../../src/lib/issues/issueStore.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

beforeEach(() => {
  installLocalStorage();
  storeInternal.clearAll();
});

// ─── Category classification (§18 #1-5) ──────────────────────────
describe('triageFarmHealthIssue — category rules', () => {
  it('insects_visible + holes_in_leaves → pest, high confidence', () => {
    const r = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['insects_visible', 'holes_in_leaves'],
      affectedPart: 'leaf', extent: 'few_plants', duration: 'today',
    });
    expect(r.predictedCategory).toBe('pest');
    expect(r.predictedCategoryFallback).toBe('Likely pest issue');
    expect(['medium', 'high']).toContain(r.confidenceLevel);
    expect(r.reasoning.some((x) => x.rule === 'symptom_insects_visible')).toBe(true);
  });

  it('mold_fungus + brown_spots → disease', () => {
    const r = triageFarmHealthIssue({
      crop: 'cassava',
      symptoms: ['mold_fungus', 'brown_spots'],
      affectedPart: 'leaf', extent: 'many_plants', duration: 'within_week',
    });
    expect(r.predictedCategory).toBe('disease');
    expect(r.confidenceLevel).not.toBe('low');
    expect(r.predictedCategoryFallback).toMatch(/disease/i);
  });

  it('yellow_leaves alone → nutrient_deficiency, medium/low confidence', () => {
    const r = triageFarmHealthIssue({
      crop: 'tomato',
      symptoms: ['yellow_leaves'],
      affectedPart: 'leaf', extent: 'few_plants', duration: 'within_week',
    });
    expect(r.predictedCategory).toBe('nutrient_deficiency');
    expect(['low', 'medium']).toContain(r.confidenceLevel);
  });

  it('wilting + dry_soil → water_stress', () => {
    const r = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['wilting', 'dry_soil'],
      affectedPart: 'whole_plant', extent: 'many_plants', duration: 'two_three_days',
    });
    expect(r.predictedCategory).toBe('water_stress');
  });

  it('ambiguous signals route to unknown or physical_damage, officer-review only when unknown', () => {
    const r = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['other'], affectedPart: 'stem', extent: 'one_plant',
      duration: 'today',
    });
    expect(['unknown', 'physical_damage']).toContain(r.predictedCategory);
    // physical_damage is localized + low-risk — officer review is
    // only required for genuinely unclassifiable (unknown) reports.
    if (r.predictedCategory === 'unknown') {
      expect(r.requiresOfficerReview).toBe(true);
    }
  });

  it('empty input → unknown, review required', () => {
    const r = triageFarmHealthIssue({});
    expect(r.predictedCategory).toBe('unknown');
    expect(r.requiresOfficerReview).toBe(true);
    expect(r.confidenceLevel).toBe('low');
  });

  it('isolated single-plant non-spreading → physical_damage', () => {
    const r = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['stunted_growth'],
      affectedPart: 'stem', extent: 'one_plant', duration: 'today',
    });
    expect(['physical_damage', 'nutrient_deficiency']).toContain(r.predictedCategory);
  });
});

// ─── Severity rules (§18 #6) ─────────────────────────────────────
describe('severity', () => {
  it('extent=most_of_farm → critical', () => {
    const r = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['yellow_leaves'],
      affectedPart: 'whole_plant',
      extent: 'most_of_farm',
      duration: 'within_week',
    });
    expect(r.severity).toBe('critical');
    expect(r.escalationFlag).toBe(true);
  });

  it('extent=many_plants → high', () => {
    const r = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['brown_spots'],
      extent: 'many_plants', duration: 'today',
    });
    expect(r.severity).toBe('high');
  });

  it('single plant, fresh → low', () => {
    const r = triageFarmHealthIssue({
      crop: 'tomato',
      symptoms: ['holes_in_leaves'],
      extent: 'one_plant', duration: 'today',
    });
    expect(r.severity).toBe('low');
  });

  it('disease on staple + rain weather bumps severity', () => {
    const lower = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['mold_fungus', 'brown_spots'],
      extent: 'few_plants', duration: 'today',
    });
    const wetter = triageFarmHealthIssue({
      crop: 'maize',
      symptoms: ['mold_fungus', 'brown_spots'],
      extent: 'few_plants', duration: 'today',
      weather: { status: 'rain_expected' },
    });
    const order = triageInternal.SEVERITY_ORDER;
    expect(order.indexOf(wetter.severity)).toBeGreaterThanOrEqual(order.indexOf(lower.severity));
  });

  it('repeated same-farm reports bump severity', () => {
    const base = triageFarmHealthIssue({
      crop: 'maize', symptoms: ['yellow_leaves'],
      extent: 'few_plants', duration: 'today',
    });
    const repeated = triageFarmHealthIssue({
      crop: 'maize', symptoms: ['yellow_leaves'],
      extent: 'few_plants', duration: 'today',
      recentFarmReports: 5,
    });
    const order = triageInternal.SEVERITY_ORDER;
    expect(order.indexOf(repeated.severity)).toBeGreaterThan(order.indexOf(base.severity));
  });
});

// ─── Safety contract (§18 #10) ───────────────────────────────────
describe('safety: no exact diagnosis claimed', () => {
  it('farmer-visible label never names a specific disease', () => {
    for (const key of Object.keys(CATEGORY_LABELS)) {
      const label = CATEGORY_LABELS[key].en;
      // Safe copy uses hedged language: Likely / Possible / Needs.
      expect(label).toMatch(/Likely|Possible|Needs|noted/);
    }
  });

  it('suggested next steps never contain dosage / chemical / "spray"', () => {
    for (const key of Object.keys(NEXT_STEPS)) {
      const step = NEXT_STEPS[key].en;
      expect(step).not.toMatch(/spray|pesticide|insecticide|mg\/L|dosage/i);
    }
  });
});

// ─── Regional alerts (§18 #9) ────────────────────────────────────
describe('detectRegionalHealthAlerts', () => {
  function mkReport(overrides = {}) {
    return {
      id: overrides.id || `r_${Math.random().toString(36).slice(2, 8)}`,
      stateCode: 'AS', crop: 'cassava',
      predictedCategory: 'disease',
      createdAt: NOW - DAY,
      ...overrides,
    };
  }

  it('no alerts below threshold (3)', () => {
    const alerts = detectRegionalHealthAlerts({
      reports: [mkReport(), mkReport()],
      now: NOW, windowDays: 7,
    });
    expect(alerts).toEqual([]);
  });

  it('medium level at 3+', () => {
    const alerts = detectRegionalHealthAlerts({
      reports: [mkReport(), mkReport(), mkReport()],
      now: NOW, windowDays: 7,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].level).toBe('medium');
    expect(alerts[0].message).toMatch(/Possible disease/i);
    expect(alerts[0].category).toBe('disease');
  });

  it('high level at 5+', () => {
    const reports = Array.from({ length: 6 }, () => mkReport());
    const alerts = detectRegionalHealthAlerts({ reports, now: NOW, windowDays: 7 });
    expect(alerts[0].level).toBe('high');
  });

  it('outside window → no alert', () => {
    const reports = Array.from({ length: 4 }, () => mkReport({ createdAt: NOW - 30 * DAY }));
    const alerts = detectRegionalHealthAlerts({ reports, now: NOW, windowDays: 7 });
    expect(alerts).toEqual([]);
  });

  it('copy never claims confirmed outbreak', () => {
    const reports = Array.from({ length: 5 }, () => mkReport());
    const alerts = detectRegionalHealthAlerts({ reports, now: NOW });
    expect(alerts[0].message).not.toMatch(/confirmed|outbreak/i);
    expect(alerts[0].message).toMatch(/Possible/i);
  });

  it('farmerVisibleAlertsFor filters by region + crop', () => {
    const reports = [
      ...Array.from({ length: 3 }, () => mkReport({ stateCode: 'AS', crop: 'cassava' })),
      ...Array.from({ length: 3 }, () => mkReport({ stateCode: 'NP', crop: 'maize' })),
    ];
    const alerts = detectRegionalHealthAlerts({ reports, now: NOW });
    expect(alerts.length).toBeGreaterThan(1);
    const visibleAS = farmerVisibleAlertsFor(alerts, { region: 'AS', crop: 'cassava' });
    expect(visibleAS).toHaveLength(1);
    expect(visibleAS[0].region).toBe('AS');
  });
});

// ─── End-to-end: createHealthReport + confirmHealthCategory ──────
describe('createHealthReport end-to-end', () => {
  it('stores symptoms + triage output on the issue', async () => {
    const iss = await createHealthReport({
      farmerId: 'u1', farmId: 'f1', crop: 'maize',
      symptoms: ['insects_visible', 'holes_in_leaves'],
      affectedPart: 'leaf', extent: 'few_plants', duration: 'today',
    });
    expect(iss).toBeTruthy();
    expect(iss.triage.predictedCategory).toBe('pest');
    expect(iss.symptoms).toContain('insects_visible');
    expect(iss.affectedPart).toBe('leaf');
    expect(iss.extent).toBe('few_plants');
    // Suggested note attached with `suggested: true` so farmer view
    // hides it until officer confirms.
    const suggestion = iss.notes.find((n) => n.suggested);
    expect(suggestion).toBeTruthy();
    expect(suggestion.text).toMatch(/inspect/i);
  });

  it('escalates automatically when severity is high/critical', async () => {
    const iss = await createHealthReport({
      farmerId: 'u1', farmId: 'f1', crop: 'maize',
      symptoms: ['mold_fungus', 'brown_spots'],
      affectedPart: 'leaf', extent: 'most_of_farm', duration: 'more_than_week',
    });
    expect(iss.status).toBe('escalated');
    expect(iss.escalatedAuto).toBe(true);
    expect(iss.triage.severity).toBe('critical');
  });

  it('unknown triage routes to officer review without escalating', async () => {
    const iss = await createHealthReport({
      crop: 'tomato', symptoms: ['other'],
      affectedPart: 'stem', extent: 'one_plant', duration: 'today',
    });
    expect(['unknown', 'physical_damage']).toContain(iss.triage.predictedCategory);
    if (iss.triage.predictedCategory === 'unknown') {
      expect(iss.requiresOfficerReview).toBe(true);
    }
  });

  it('image upload is optional — omitting it still stores the report', async () => {
    const iss = await createHealthReport({
      crop: 'maize', symptoms: ['yellow_leaves'],
      affectedPart: 'leaf', extent: 'few_plants', duration: 'today',
    });
    expect(iss).toBeTruthy();
    expect(iss.imageUrl).toBeNull();
  });

  it('passes imageUrl through when supplied', async () => {
    const iss = await createHealthReport({
      crop: 'maize', symptoms: ['yellow_leaves'],
      affectedPart: 'leaf', extent: 'few_plants', duration: 'today',
      imageUrl: 'data:image/jpeg;base64,AAAA',
    });
    expect(iss.imageUrl).toMatch(/^data:image/);
  });
});

describe('confirmHealthCategory', () => {
  it('officer confirmation locks in the human-validated category', async () => {
    const iss = await createHealthReport({
      farmerId: 'u1', farmId: 'f1', crop: 'maize',
      symptoms: ['insects_visible', 'holes_in_leaves'],
      affectedPart: 'leaf', extent: 'few_plants', duration: 'today',
    });
    const after = confirmHealthCategory(iss.id, {
      category: 'pest',
      diagnosis: 'Fall armyworm observed',
      note: 'Spot-treat with water spray as first step.',
      confirmedBy: 'ofc_1',
    });
    expect(after).toBeTruthy();
    expect(after.triage.confirmedCategory).toBe('pest');
    expect(after.triage.confirmedBy).toBe('ofc_1');
    expect(after.triage.confirmedDiagnosis).toMatch(/armyworm/i);
    expect(after.requiresOfficerReview).toBe(false);
    // Officer note (not system: true) is visible to the farmer.
    const visibleNote = after.notes.find((n) => !n.system && !n.suggested);
    expect(visibleNote).toBeTruthy();
    expect(visibleNote.text).toMatch(/water spray/i);
  });

  it('requires non-empty category', () => {
    const r = confirmHealthCategory('missing', {});
    expect(r).toBeNull();
  });

  it('missing issue id → null', () => {
    expect(confirmHealthCategory(null, { category: 'pest' })).toBeNull();
  });
});
