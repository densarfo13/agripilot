/**
 * cropTimeline.test.js — locks the Crop Timeline System contract
 * (spec §14, all 12 scenarios):
 *
 *   1. planting date + crop produces a stage estimate
 *   2. cassava progression follows cassava durations
 *   3. maize progression follows maize durations
 *   4. tomato progression follows tomato durations
 *   5. manual override takes precedence over auto estimate
 *   6. timeline falls back safely when plantingDate missing
 *   7. progress percent calculates correctly
 *   8. next stage is derived correctly
 *   9. tasks change when stage changes (via timelineStage override)
 *  10. timeline labels localize via translation keys
 *  11. old stage values (land_preparation, mid_growth) normalize
 *  12. no crashes on incomplete farm data
 */

import { describe, it, expect } from 'vitest';

import { getCropTimeline }   from '../../../src/lib/timeline/cropTimelineEngine.js';
import { getStageProgress }  from '../../../src/lib/timeline/stageProgressEngine.js';
import { generateDailyTasks } from '../../../src/lib/dailyTasks/taskEngine.js';
import {
  getLifecycle, normalizeStageKey, normalizeCropKey, hasLifecycle,
} from '../../../src/config/cropLifecycles.js';
import { generateCandidates } from '../../../src/lib/notifications/notificationEngine.js';

function isoAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

// ─── Lifecycle catalog ──────────────────────────────────────────
describe('cropLifecycles', () => {
  it('cassava stage durations match the spec', () => {
    const lc = getLifecycle('cassava');
    const map = Object.fromEntries(lc.map((s) => [s.key, s.durationDays]));
    expect(map.planting).toBe(14);
    expect(map.establishment).toBe(30);
    expect(map.vegetative).toBe(60);
    expect(map.bulking).toBe(90);
    expect(map.maturation).toBe(60);
    expect(map.harvest).toBe(14);
  });

  it('maize stage durations match the spec', () => {
    const lc = getLifecycle('maize');
    const map = Object.fromEntries(lc.map((s) => [s.key, s.durationDays]));
    expect(map.planting).toBe(7);
    expect(map.germination).toBe(10);
    expect(map.vegetative).toBe(30);
    expect(map.tasseling).toBe(14);
    expect(map.grain_fill).toBe(30);
    expect(map.harvest).toBe(14);
  });

  it('tomato stage durations match the spec', () => {
    const lc = getLifecycle('tomato');
    const map = Object.fromEntries(lc.map((s) => [s.key, s.durationDays]));
    expect(map.seedling).toBe(14);
    expect(map.transplant).toBe(14);
    expect(map.vegetative).toBe(21);
    expect(map.flowering).toBe(21);
    expect(map.fruiting).toBe(30);
    expect(map.harvest).toBe(21);
  });

  it('hasLifecycle returns false for unknown crops', () => {
    expect(hasLifecycle('dragonfruit')).toBe(false);
    expect(hasLifecycle('cassava')).toBe(true);
  });

  it('normalizeCropKey collapses separator variants', () => {
    expect(normalizeCropKey('Sweet Potato')).toBe('sweet-potato');
    expect(normalizeCropKey('SWEET_POTATO')).toBe('sweet-potato');
    expect(normalizeCropKey('CASSAVA')).toBe('cassava');
  });

  it('normalizeStageKey maps legacy aliases to canonical keys', () => {
    expect(normalizeStageKey('land_preparation')).toBe('planting');
    expect(normalizeStageKey('mid_growth')).toBe('vegetative');
    expect(normalizeStageKey('grain-fill')).toBe('grain_fill');
    expect(normalizeStageKey('post_harvest')).toBe('harvest');
  });
});

// ─── Scenario 1 + 7: planting date produces an estimate ─────────
describe('getCropTimeline — planting-date estimate', () => {
  it('cassava 30 days in → establishment stage with the right daysInto', () => {
    const tl = getCropTimeline({
      farm: { id: 'f1', crop: 'cassava', plantingDate: isoAgo(30) },
    });
    // cassava: planting 0-14, establishment 14-44
    expect(tl.currentStage).toBe('establishment');
    expect(tl.currentStageIndex).toBe(1);
    expect(tl.daysIntoStage).toBe(30 - 14);
    expect(tl.stageDurationDays).toBe(30);
    expect(tl.estimatedDaysRemainingInStage).toBe(30 - (30 - 14));
    expect(tl.source).toBe('planting_date');
    expect(tl.confidenceLevel).toBe('high');
  });

  it('progress percent is elapsed / total ×100', () => {
    const tl = getCropTimeline({
      farm: { crop: 'cassava', plantingDate: isoAgo(44) },
    });
    // total = 14+30+60+90+60+14 = 268; 44/268 ≈ 16%
    expect(tl.overallProgressPercent).toBe(Math.round((44 / 268) * 100));
  });

  // ── Scenarios 2, 3, 4: per-crop progression ──────────────────
  it('cassava at day 45 sits in vegetative stage', () => {
    const tl = getCropTimeline({
      farm: { crop: 'cassava', plantingDate: isoAgo(45) },
    });
    expect(tl.currentStage).toBe('vegetative');  // 14+30=44 → starts at 44
    expect(tl.nextStage).toBe('bulking');
  });

  it('maize at day 20 sits in vegetative (0-7 planting, 7-17 germination, 17-47 veg)', () => {
    const tl = getCropTimeline({
      farm: { crop: 'maize', plantingDate: isoAgo(20) },
    });
    expect(tl.currentStage).toBe('vegetative');
    expect(tl.nextStage).toBe('tasseling');
  });

  it('tomato at day 50 sits in flowering (14+14+21=49 → flowering starts)', () => {
    const tl = getCropTimeline({
      farm: { crop: 'tomato', plantingDate: isoAgo(50) },
    });
    expect(tl.currentStage).toBe('flowering');
    expect(tl.nextStage).toBe('fruiting');
  });
});

// ─── Scenario 5: manual override takes precedence ───────────────
describe('getCropTimeline — manual override', () => {
  it('manualStageOverride beats plantingDate-based estimate', () => {
    const tl = getCropTimeline({
      farm: {
        crop: 'cassava',
        plantingDate: isoAgo(30),
        manualStageOverride: 'harvest',   // override wins
      },
    });
    expect(tl.currentStage).toBe('harvest');
    expect(tl.source).toBe('manual_override');
    expect(tl.manualOverride).toBe(true);
    expect(tl.confidenceLevel).toBe('medium');
  });

  it('override pointing at an unknown stage falls through to auto', () => {
    const tl = getCropTimeline({
      farm: {
        crop: 'maize',
        plantingDate: isoAgo(10),
        manualStageOverride: 'fictional_stage',
      },
    });
    expect(tl.source).toBe('planting_date');
    expect(tl.manualOverride).toBe(false);
    expect(tl.assumptions.some((a) => a.tag === 'override_unknown_stage')).toBe(true);
  });
});

// ─── Scenario 6: fallback when planting date missing ────────────
describe('getCropTimeline — fallbacks', () => {
  it('cropStage + stageStartedAt → stage_start source, medium confidence', () => {
    const tl = getCropTimeline({
      farm: {
        crop: 'tomato',
        cropStage: 'flowering',
        stageStartedAt: isoAgo(5),
      },
    });
    expect(tl.currentStage).toBe('flowering');
    expect(tl.daysIntoStage).toBe(5);
    expect(tl.source).toBe('stage_start');
    expect(tl.confidenceLevel).toBe('medium');
  });

  it('cropStage only → stage_only source, low confidence, daysRemaining null', () => {
    const tl = getCropTimeline({
      farm: { crop: 'cassava', cropStage: 'bulking' },
    });
    expect(tl.currentStage).toBe('bulking');
    expect(tl.source).toBe('stage_only');
    expect(tl.confidenceLevel).toBe('low');
    expect(tl.estimatedDaysRemainingInStage).toBeNull();
  });

  it('no stage + no date → generic source, first stage as placeholder', () => {
    const tl = getCropTimeline({ farm: { crop: 'cassava' } });
    expect(tl.source).toBe('generic');
    expect(tl.currentStageIndex).toBe(0);
    expect(tl.confidenceLevel).toBe('low');
  });

  it('unknown crop → uses generic lifecycle, not null', () => {
    const tl = getCropTimeline({
      farm: { crop: 'dragonfruit', plantingDate: isoAgo(40) },
    });
    expect(tl).not.toBeNull();
    expect(tl.assumptions.some((a) => a.tag === 'generic_lifecycle')).toBe(true);
  });

  it('legacy stage names (land_preparation, mid_growth) normalize safely', () => {
    const tl = getCropTimeline({
      farm: { crop: 'maize', cropStage: 'land_preparation' },
    });
    expect(tl.currentStage).toBe('planting');   // land_preparation → planting
  });
});

// ─── Scenario 8: next stage derivation ──────────────────────────
describe('next stage derivation', () => {
  it('harvest (last stage) has nextStage = null', () => {
    const tl = getCropTimeline({
      farm: { crop: 'tomato', manualStageOverride: 'harvest' },
    });
    expect(tl.nextStage).toBeNull();
    expect(tl.nextStageIndex).toBe(-1);
  });

  it('second-to-last stage points to harvest', () => {
    const tl = getCropTimeline({
      farm: { crop: 'maize', manualStageOverride: 'grain_fill' },
    });
    expect(tl.nextStage).toBe('harvest');
  });
});

// ─── Scenario 12: incomplete data doesn't crash ─────────────────
describe('safety', () => {
  it('no farm → null', () => {
    expect(getCropTimeline({ farm: null })).toBeNull();
  });

  it('farm without crop → null', () => {
    expect(getCropTimeline({ farm: { id: 'x' } })).toBeNull();
  });

  it('null/undefined inputs never throw', () => {
    expect(() => getCropTimeline({})).not.toThrow();
    expect(() => getCropTimeline()).not.toThrow();
  });

  it('bad plantingDate string is ignored gracefully', () => {
    const tl = getCropTimeline({
      farm: { crop: 'cassava', plantingDate: 'not-a-date' },
    });
    // Falls through to stage_only or generic — never crashes.
    expect(['stage_only', 'generic']).toContain(tl.source);
  });
});

// ─── stageProgressEngine ────────────────────────────────────────
describe('getStageProgress', () => {
  it('computes stagePercent within the current stage', () => {
    const tl = getCropTimeline({
      farm: { crop: 'cassava', plantingDate: isoAgo(29) },
    });
    const prog = getStageProgress({ timeline: tl });
    // cassava establishment (30 days), 29-14 = 15 days in → 50%
    expect(prog.stagePercent).toBe(50);
  });

  it('flags transitionImminent when ≤ 20% of stage remains', () => {
    // Maize tasseling = 14 days; 13 days in → 1 day left = 7% → imminent.
    // Elapsed from planting = 7+10+30+13 = 60 days.
    const tl = getCropTimeline({
      farm: { crop: 'maize', plantingDate: isoAgo(60) },
    });
    const prog = getStageProgress({ timeline: tl });
    expect(tl.currentStage).toBe('tasseling');
    expect(prog.transitionImminent).toBe(true);
  });

  it('produces localisable stage label keys', () => {
    const tl = getCropTimeline({
      farm: { crop: 'tomato', plantingDate: isoAgo(10) },
    });
    const prog = getStageProgress({ timeline: tl });
    expect(prog.stageLabelKey).toMatch(/^timeline\.stage\./);
    expect(prog.headline.key).toMatch(/^timeline\.headline\./);
  });

  it('harvest stage produces a dedicated headline', () => {
    const tl = getCropTimeline({
      farm: { crop: 'maize', manualStageOverride: 'harvest' },
    });
    const prog = getStageProgress({ timeline: tl });
    expect(prog.headline.fallback.toLowerCase()).toMatch(/harvest/);
  });
});

// ─── Scenario 9: tasks change when stage changes ────────────────
describe('taskEngine accepts timelineStage override', () => {
  it('same farm, different timelineStage → different task pool', () => {
    const farm = { id: 'f1', crop: 'tomato', farmType: 'small_farm' };
    const early = generateDailyTasks({
      farm, timelineStage: 'planting', weather: { status: 'ok' },
      date: '2025-05-10',
    });
    const later = generateDailyTasks({
      farm, timelineStage: 'harvest', weather: { status: 'ok' },
      date: '2025-05-10',
    });
    const earlyIds = new Set(early.tasks.map((t) => t.templateId));
    const laterIds = new Set(later.tasks.map((t) => t.templateId));
    // At least one distinct template should differ between stages.
    const intersection = [...earlyIds].filter((id) => laterIds.has(id));
    expect(intersection.length).toBeLessThan(earlyIds.size);
  });

  it('timelineStage overrides farm.cropStage on the pool choice', () => {
    const farm = { id: 'f1', crop: 'tomato', cropStage: 'planting',
                   farmType: 'small_farm' };
    const plan = generateDailyTasks({
      farm, timelineStage: 'harvest',
      weather: { status: 'ok' }, date: '2025-05-10',
    });
    expect(plan.stage).toBe('harvest');
  });
});

// ─── notificationEngine — stage_transition candidate ────────────
describe('notificationEngine — stage_transition', () => {
  it('fires when timeline flags an imminent transition', () => {
    // Maize at day 60 is 13/14 days into tasseling → imminent.
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                   plantingDate: isoAgo(60) };
    const out = generateCandidates({
      farm, tasks: [], weather: { status: 'ok' }, now: new Date(),
    });
    const st = out.find((c) => c.type === 'stage_transition');
    expect(st).toBeDefined();
    expect(st.data.nextStage).toBe('grain_fill');
    expect(st.key).toMatch(/^stage_transition:f1:/);
  });

  it('does NOT fire when the farmer is mid-stage (not imminent)', () => {
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                   plantingDate: isoAgo(20) };   // mid vegetative
    const out = generateCandidates({
      farm, tasks: [], weather: { status: 'ok' }, now: new Date(),
    });
    expect(out.find((c) => c.type === 'stage_transition')).toBeUndefined();
  });

  it('harvest-stage transition is high priority', () => {
    // Maize total = 7+10+30+14+30+14 = 105 days
    // grain_fill is days 61-90; 89 days in → 1 day left = 3% → imminent,
    // next is harvest.
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                   plantingDate: isoAgo(89) };
    const out = generateCandidates({
      farm, tasks: [], weather: { status: 'ok' }, now: new Date(),
    });
    const st = out.find((c) => c.type === 'stage_transition');
    expect(st).toBeDefined();
    expect(st.data.nextStage).toBe('harvest');
    expect(st.priority).toBe('high');
  });
});
