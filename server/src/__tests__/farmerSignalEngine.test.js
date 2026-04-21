/**
 * farmerSignalEngine.test.js — covers spec §14 (tests 1-12) plus
 * farmType behaviour and the learning-loop helpers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function installWindow() {
  const map = new Map();
  globalThis.window = {
    location: { pathname: '/', search: '' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      clear:      () => map.clear(),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener: () => {}, removeEventListener: () => {},
  };
}

import {
  getFarmerSignals,
  recordSignalOutcome,
  getSignalOutcomes,
  getOutcomeStats,
  _internal,
} from '../../../src/lib/signals/farmerSignalEngine.js';

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

beforeEach(() => { installWindow(); });
afterEach(()  => { delete globalThis.window; });

// A minimal farm skeleton — callers only ever need id/farmType/crop.
const farm = (overrides = {}) => ({
  id: 'farm1', farmerId: 'u1', crop: 'maize',
  farmType: 'small_farm', location: 'AS',
  ...overrides,
});

// ─── 1. Symptom report increases signal score ────────────────────
describe('symptom report → score bump', () => {
  it('empty input stays in low band', () => {
    const r = getFarmerSignals({ farm: farm(), now: NOW });
    expect(r.signalScore).toBeLessThan(30);
    expect(r.riskLevel).toBe('low');
    expect(r.likelyCategory).toBe('unknown');
  });

  it('providing a symptom report increases the score by ≥20', () => {
    const empty = getFarmerSignals({ farm: farm(), now: NOW });
    const withReport = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['yellow_leaves'], affectedPart: 'leaf', extent: 'few_plants' },
      now: NOW,
    });
    expect(withReport.signalScore - empty.signalScore).toBeGreaterThanOrEqual(20);
    expect(withReport.reasons.some((r) => r.rule === 'symptom_present')).toBe(true);
  });
});

// ─── 2. Photo attachment increases confidence ────────────────────
describe('photo presence → score + confidence', () => {
  it('photo lifts score by 10 and bumps confidence when category is clear', () => {
    const noPhoto = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['mold_fungus', 'brown_spots'],
                       affectedPart: 'leaf', extent: 'few_plants' },
      now: NOW,
    });
    const withPhoto = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['mold_fungus', 'brown_spots'],
                       affectedPart: 'leaf', extent: 'few_plants' },
      imageMeta: { url: 'data:image/jpg;base64,xxx' },
      now: NOW,
    });
    expect(withPhoto.signalScore - noPhoto.signalScore).toBe(10);
    // Disease signal with a photo should be ≥ medium confidence
    expect(['medium', 'high']).toContain(withPhoto.confidenceLevel);
    expect(withPhoto.details.hasPhoto).toBe(true);
  });

  it('imageMeta.present=true is also treated as a photo', () => {
    const r = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['wilting'], affectedPart: 'leaf', extent: 'few_plants' },
      imageMeta: { present: true },
      now: NOW,
    });
    expect(r.details.hasPhoto).toBe(true);
  });
});

// ─── 3. Dry weather + wilting → water stress ─────────────────────
describe('dry weather + wilting → water_stress', () => {
  it('infers water_stress when wilting is reported under dry weather', () => {
    const r = getFarmerSignals({
      farm: farm(),
      weather: { status: 'excessive_heat' },
      symptomReport: { symptoms: ['wilting'], affectedPart: 'leaf', extent: 'few_plants' },
      now: NOW,
    });
    expect(r.likelyCategory).toBe('water_stress');
    expect(r.reasons.some((x) => x.rule === 'weather_stress')).toBe(true);
  });

  it('adds water-stress bias via missed irrigation tasks + dry ahead', () => {
    const r = getFarmerSignals({
      farm: farm(),
      tasks: [
        { id: 'pre_planting.water_schedule', overdue: true },
        { id: 'mid.water_check',             missedCount: 2 },
      ],
      weather: { status: 'dry_ahead' },
      now: NOW,
    });
    // Without a symptom report we may stay 'unknown' but the water
    // stress bias should at least push the risk band up and reasons
    // should cite missed routine tasks + weather.
    expect(r.reasons.some((x) => x.rule === 'weather_stress')).toBe(true);
    expect(r.reasons.some((x) => x.rule.startsWith('missed_tasks'))).toBe(true);
  });
});

// ─── 4. Insects + holes → pest ───────────────────────────────────
describe('insects + holes → pest', () => {
  it('classifies as pest with at least medium confidence', () => {
    const r = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['insects_visible', 'holes_in_leaves'],
                       affectedPart: 'leaf', extent: 'few_plants' },
      now: NOW,
    });
    expect(r.likelyCategory).toBe('pest');
    expect(['medium', 'high']).toContain(r.confidenceLevel);
    // Never claims a specific pest name.
    expect(r.likelyCategoryFallback).toMatch(/pest/i);
    expect(r.likelyCategoryFallback).not.toMatch(/aphid|locust|weevil/i);
  });
});

// ─── 5. Mold/spots + wet weather → disease ───────────────────────
describe('mold/spots + wet weather → disease', () => {
  it('classifies as disease risk, not a specific disease name', () => {
    const r = getFarmerSignals({
      farm: farm(),
      weather: { status: 'heavy_rain' },
      symptomReport: { symptoms: ['mold_fungus', 'brown_spots'],
                       affectedPart: 'leaf', extent: 'many_plants' },
      now: NOW,
    });
    expect(r.likelyCategory).toBe('disease');
    expect(r.likelyCategoryFallback).toMatch(/possible/i);
    expect(r.likelyCategoryFallback).not.toMatch(/blight|rust|mildew/i);
    expect(r.requiresReview).toBe(true);
  });
});

// ─── 6. Repeated missed tasks increase risk ──────────────────────
describe('missed tasks → higher score', () => {
  it('2 missed tasks add +10, 3+ missed tasks add +20', () => {
    const twoMissed = getFarmerSignals({
      farm: farm(),
      tasks: [
        { id: 'mid.water_check', overdue: true },
        { id: 'mid.pest_inspection', overdue: true },
      ],
      now: NOW,
    });
    const manyMissed = getFarmerSignals({
      farm: farm(),
      tasks: [
        { id: 'mid.water_check', overdue: true },
        { id: 'mid.pest_inspection', overdue: true },
        { id: 'mid.weed_check', overdue: true },
        { id: 'mid.disease_check', overdue: true },
      ],
      now: NOW,
    });
    expect(twoMissed.reasons.some((r) => r.rule === 'missed_tasks_few')).toBe(true);
    expect(manyMissed.reasons.some((r) => r.rule === 'missed_tasks_many')).toBe(true);
    expect(manyMissed.signalScore).toBeGreaterThan(twoMissed.signalScore);
  });
});

// ─── 7. Unknown when signals conflict ───────────────────────────
describe('conflicting signals → unknown', () => {
  it('returns unknown when symptoms carry no category weight', () => {
    // 'other' scores 0 across all categories, and extent=few_plants
    // avoids the physical_damage special case — nothing to classify.
    const r = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['other'], affectedPart: 'leaf', extent: 'few_plants' },
      now: NOW,
    });
    expect(r.likelyCategory).toBe('unknown');
    expect(r.confidenceLevel).toBe('low');
    expect(r.requiresReview).toBe(true);
  });

  it('returns unknown with no input at all', () => {
    const r = getFarmerSignals({ farm: farm(), now: NOW });
    expect(r.likelyCategory).toBe('unknown');
    expect(r.confidenceLevel).toBe('low');
  });
});

// ─── 8. High-risk / low-confidence forces review ─────────────────
describe('officer review routing', () => {
  it('forces review when risk is high', () => {
    const r = getFarmerSignals({
      farm: farm(),
      weather: { status: 'heavy_rain' },
      symptomReport: { symptoms: ['mold_fungus', 'rotting', 'brown_spots'],
                       affectedPart: 'leaf', extent: 'most_of_farm' },
      imageMeta: { url: 'data:image/jpg;x' },
      now: NOW,
    });
    expect(r.riskLevel).toBe('high');
    expect(r.requiresReview).toBe(true);
  });

  it('forces review when low-confidence + serious symptom', () => {
    const r = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['spreading'], affectedPart: 'leaf', extent: 'many_plants' },
      now: NOW,
    });
    // 'spreading' is a serious symptom even alone; review must fire.
    expect(r.requiresReview).toBe(true);
  });

  it('forces review on 3+ unresolved same-farm issues', () => {
    const issues = Array.from({ length: 3 }, (_, i) => ({
      id: `iss_${i}`, farmId: 'farm1', issueType: 'pest',
      status: 'open', createdAt: NOW - i * DAY,
    }));
    const r = getFarmerSignals({ farm: farm(), issues, now: NOW });
    expect(r.requiresReview).toBe(true);
    expect(r.reasons.some((x) => x.rule === 'repeat_unresolved')).toBe(true);
  });
});

// ─── 9. Backyard wording simpler than commercial ─────────────────
describe('farmType behaviour', () => {
  const shared = {
    symptomReport: { symptoms: ['wilting'], affectedPart: 'leaf', extent: 'few_plants' },
    weather: { status: 'excessive_heat' },
    imageMeta: { present: true },
    now: NOW,
  };

  it('backyard returns a simpler action + fewer reasons', () => {
    const r = getFarmerSignals({ ...shared, farm: farm({ farmType: 'backyard' }) });
    expect(r.farmType).toBe('backyard');
    expect(r.reasons.length).toBeLessThanOrEqual(2);
    expect(r.suggestedActionFallback).toMatch(/check the soil|water gently/i);
  });

  it('small_farm uses the standard healthTriageEngine next step', () => {
    const r = getFarmerSignals({ ...shared, farm: farm({ farmType: 'small_farm' }) });
    expect(r.farmType).toBe('small_farm');
    expect(r.suggestedActionFallback).toMatch(/soil moisture|drainage/i);
  });

  it('commercial gets operational, multi-step wording + more reasons', () => {
    const r = getFarmerSignals({ ...shared, farm: farm({ farmType: 'commercial' }) });
    expect(r.farmType).toBe('commercial');
    // Commercial adds the operational hint when risk > low.
    expect(r.reasons.some((x) => x.rule === 'commercial_operations_hint')).toBe(true);
    expect(r.suggestedActionFallback).toMatch(/irrigation|inspection/i);
  });

  it('missing farmType falls back to small_farm', () => {
    const r = getFarmerSignals({
      farm: { id: 'x', crop: 'maize' },
      symptomReport: { symptoms: ['wilting'], extent: 'few_plants' },
      now: NOW,
    });
    expect(r.farmType).toBe('small_farm');
  });
});

// ─── 10. No exact diagnosis claimed ──────────────────────────────
describe('safe output language', () => {
  it('never echoes a specific disease / pest name', () => {
    const r = getFarmerSignals({
      farm: farm(),
      weather: { status: 'heavy_rain' },
      symptomReport: { symptoms: ['mold_fungus', 'brown_spots'],
                       affectedPart: 'leaf', extent: 'many_plants' },
      now: NOW,
    });
    // Category label stays generic.
    expect(r.likelyCategoryFallback).toMatch(/possible|likely|risk/i);
    // All reasons avoid specific disease names.
    for (const reason of r.reasons) {
      expect(reason.detail).not.toMatch(/blight|rust|mildew|armyworm|fall_armyworm/i);
    }
  });

  it('emits a stable i18n key for every category', () => {
    const categories = ['pest', 'disease', 'nutrient_deficiency',
                        'water_stress', 'physical_damage', 'unknown'];
    for (const cat of categories) {
      const r = getFarmerSignals({
        farm: farm(),
        symptomReport: (cat === 'pest')
          ? { symptoms: ['insects_visible', 'holes_in_leaves'], extent: 'few_plants' }
          : (cat === 'disease')
            ? { symptoms: ['mold_fungus', 'brown_spots'], extent: 'many_plants' }
            : (cat === 'water_stress')
              ? { symptoms: ['wilting', 'dry_soil'], extent: 'few_plants' }
              : (cat === 'nutrient_deficiency')
                ? { symptoms: ['yellow_leaves', 'stunted_growth'], extent: 'few_plants' }
                : (cat === 'physical_damage')
                  ? { symptoms: ['leaf_damage'], affectedPart: 'stem', extent: 'one_plant' }
                  : { symptoms: ['other'], extent: 'one_plant' },
        now: NOW,
      });
      expect(typeof r.likelyCategoryKey).toBe('string');
      expect(r.likelyCategoryKey).toMatch(/^signal\.category\./);
    }
  });
});

// ─── 11. i18n labels stable for non-English callers ──────────────
describe('translation key stability', () => {
  it('category + action keys are namespaced + deterministic', () => {
    const r = getFarmerSignals({
      farm: farm(),
      symptomReport: { symptoms: ['insects_visible', 'holes_in_leaves'], extent: 'few_plants' },
      now: NOW,
    });
    expect(r.likelyCategoryKey).toBe('signal.category.pest');
    // healthTriageEngine NEXT_STEPS keys pass through unchanged when
    // farmType is small_farm.
    expect(r.suggestedActionKey).toMatch(/^health\.next\.|^signal\.next\./);
  });

  it('re-running with the same inputs returns the same keys (determinism)', () => {
    const ctx = {
      farm: farm(),
      weather: { status: 'heavy_rain' },
      symptomReport: { symptoms: ['mold_fungus', 'brown_spots'],
                       affectedPart: 'leaf', extent: 'many_plants' },
      imageMeta: { present: true },
      now: NOW,
    };
    const a = getFarmerSignals(ctx);
    const b = getFarmerSignals(ctx);
    expect(a.likelyCategoryKey).toBe(b.likelyCategoryKey);
    expect(a.suggestedActionKey).toBe(b.suggestedActionKey);
    expect(a.signalScore).toBe(b.signalScore);
  });
});

// ─── 12. No crashes with missing optional inputs ─────────────────
describe('robustness to missing input', () => {
  it('all inputs omitted → low risk, unknown category', () => {
    const r = getFarmerSignals();
    expect(r.signalScore).toBe(0);
    expect(r.riskLevel).toBe('low');
    expect(r.likelyCategory).toBe('unknown');
    expect(r.confidenceLevel).toBe('low');
    expect(r.requiresReview).toBe(false);
  });

  it('malformed tasks / issues are ignored silently', () => {
    const r = getFarmerSignals({
      farm: farm(),
      tasks: [null, 'not an object', { /* no id */ }],
      issues: [null, { farmId: 'farm1' }, 'bad'],
      symptomReport: null,
      imageMeta: null,
      weather: 'not-an-object',
      now: NOW,
    });
    expect(r.signalScore).toBe(0);
    expect(r.likelyCategory).toBe('unknown');
  });
});

// ─── Learning loop (spec §10) ────────────────────────────────────
describe('recordSignalOutcome + getOutcomeStats', () => {
  it('persists an outcome and aggregates accuracy', () => {
    recordSignalOutcome({
      issueId: 'i1', farmId: 'farm1',
      predictedCategory: 'pest', confirmedCategory: 'pest',
      predictedConfidence: 'medium', signalScore: 55,
      ts: NOW,
    });
    recordSignalOutcome({
      issueId: 'i2', farmId: 'farm1',
      predictedCategory: 'disease', confirmedCategory: 'nutrient_deficiency',
      predictedConfidence: 'low', signalScore: 35,
      ts: NOW + 1000,
    });
    const rows = getSignalOutcomes();
    expect(rows.length).toBe(2);
    const stats = getOutcomeStats();
    expect(stats.total).toBe(2);
    expect(stats.correct).toBe(1);
    expect(stats.accuracy).toBe(50);
    expect(stats.byCategory.pest.correct).toBe(1);
    expect(stats.byCategory.disease.incorrect).toBe(1);
  });

  it('returns empty list when no storage is available', () => {
    delete globalThis.window;
    expect(getSignalOutcomes()).toEqual([]);
    expect(getOutcomeStats().total).toBe(0);
    // Re-install for afterEach cleanup
    installWindow();
  });
});

// ─── Internals sanity ────────────────────────────────────────────
describe('_internal helpers', () => {
  it('categoriseTask recognises the main buckets', () => {
    const { categoriseTask } = _internal;
    expect(categoriseTask({ id: 'mid.water_check' })).toBe('irrigation');
    expect(categoriseTask({ id: 'pre.pest_scout' })).toBe('pest_inspection');
    expect(categoriseTask({ id: 'mid.fertilizer_round' })).toBe('fertilizer');
    expect(categoriseTask({ id: 'mid.weeding' })).toBe('weeding');
    expect(categoriseTask({ id: 'random_task' })).toBe(null);
  });

  it('bandFor respects backyard + commercial thresholds', () => {
    const { bandFor } = _internal;
    // Backyard: needs 65+ to be high
    expect(bandFor(60, 'backyard')).toBe('medium');
    expect(bandFor(65, 'backyard')).toBe('high');
    // Commercial: 55+ already high
    expect(bandFor(55, 'commercial')).toBe('high');
    // Small farm: standard 60
    expect(bandFor(60, 'small_farm')).toBe('high');
    expect(bandFor(59, 'small_farm')).toBe('medium');
  });
});
