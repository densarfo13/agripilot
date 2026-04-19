/**
 * farmerStateEngine.test.js — behavioral contract for the farmer
 * state engine. Covers:
 *
 *   • priority ordering
 *   • candidate classification
 *   • confidence scoring (high / medium / low across signals)
 *   • validation overrides (6 rules)
 *   • display mode (state-first vs task-first)
 *   • next-step bridges (including blocker-specific)
 *   • regional tone suffixes
 *   • buildHomeExperience wiring (tier + tone + soft prefix)
 *   • localization overlay across all locales (no English leak)
 *   • dev assertions flag real problems
 *   • stability / edge cases
 */

import { describe, it, expect } from 'vitest';

import {
  resolveFarmerState,
  buildHomeExperience,
  STATE_TYPES,
  STATE_PRIORITY,
  pickByPriority,
  getStatePriorityIndex,
} from '../../../src/utils/farmerState/index.js';
import { classifyStateCandidates } from '../../../src/utils/farmerState/classifyStateCandidates.js';
import { scoreStateConfidence } from '../../../src/utils/farmerState/stateConfidence.js';
import { validateResolvedState } from '../../../src/utils/farmerState/stateValidation.js';
import { resolveDisplayMode } from '../../../src/utils/farmerState/stateDisplayMode.js';
import { appendNextStepBridge } from '../../../src/utils/farmerState/nextStepBridge.js';
import {
  applyStateToneByRegion,
  resolveRegionBucket,
} from '../../../src/utils/farmerState/stateTone.js';
import { runDevAssertions } from '../../../src/utils/farmerState/devAssertions.js';
import {
  FARMER_STATE_TRANSLATIONS,
  applyFarmerStateOverlay,
} from '../../../src/i18n/farmerStateTranslations.js';

const HOUR = 60 * 60 * 1000;

function makeT(locale) {
  const dict = FARMER_STATE_TRANSLATIONS[locale] || {};
  return (key) => dict[key] || key;
}

// ─── 1. Priority order ────────────────────────────────────
describe('state priority', () => {
  it('first entry is camera_issue', () => {
    expect(STATE_PRIORITY[0]).toBe(STATE_TYPES.CAMERA_ISSUE);
  });
  it('stale_offline is higher priority than blocked_by_land', () => {
    expect(getStatePriorityIndex(STATE_TYPES.STALE_OFFLINE))
      .toBeLessThan(getStatePriorityIndex(STATE_TYPES.BLOCKED_BY_LAND));
  });
  it('safe_fallback is the last resort', () => {
    expect(STATE_PRIORITY[STATE_PRIORITY.length - 1]).toBe(STATE_TYPES.SAFE_FALLBACK);
  });
  it('pickByPriority returns the highest-priority candidate', () => {
    const winner = pickByPriority([
      STATE_TYPES.ACTIVE_CYCLE,
      STATE_TYPES.CAMERA_ISSUE,
      STATE_TYPES.WEATHER_SENSITIVE,
    ]);
    expect(winner).toBe(STATE_TYPES.CAMERA_ISSUE);
  });
  it('pickByPriority with no candidates returns safe_fallback', () => {
    expect(pickByPriority([])).toBe(STATE_TYPES.SAFE_FALLBACK);
  });
});

// ─── 2. Candidate classification ──────────────────────────
describe('classifyStateCandidates', () => {
  it('detects camera issue when cameraTask has a known type', () => {
    const cands = classifyStateCandidates({ cameraTask: { type: 'pest_detected' } });
    expect(cands).toContain(STATE_TYPES.CAMERA_ISSUE);
  });
  it('detects stale_offline only when offline AND data is old', () => {
    const fresh = classifyStateCandidates({
      offlineState: { isOffline: true }, lastUpdatedAt: Date.now(),
    });
    expect(fresh).not.toContain(STATE_TYPES.STALE_OFFLINE);
    const stale = classifyStateCandidates({
      offlineState: { isOffline: true }, lastUpdatedAt: Date.now() - 10 * HOUR,
    });
    expect(stale).toContain(STATE_TYPES.STALE_OFFLINE);
  });
  it('detects blocked_by_land on wet soil + planting intent', () => {
    const cands = classifyStateCandidates({
      cropProfile: { stage: 'planting' },
      landProfile: { moisture: 'wet' },
    });
    expect(cands).toContain(STATE_TYPES.BLOCKED_BY_LAND);
  });
  it('detects weather_sensitive on rain risk high', () => {
    const cands = classifyStateCandidates({ weatherNow: { rainRisk: 'high' } });
    expect(cands).toContain(STATE_TYPES.WEATHER_SENSITIVE);
  });
  it('detects first_use when onboarding not done', () => {
    expect(classifyStateCandidates({ hasCompletedOnboarding: false }))
      .toContain(STATE_TYPES.FIRST_USE);
  });
  it('detects returning_inactive at missedDays >= 3', () => {
    expect(classifyStateCandidates({ missedDays: 3 }))
      .toContain(STATE_TYPES.RETURNING_INACTIVE);
  });
});

// ─── 3. Confidence scoring ────────────────────────────────
describe('scoreStateConfidence', () => {
  it('HIGH when land signals are explicit + stage resolved', () => {
    const c = scoreStateConfidence({
      stateType: STATE_TYPES.BLOCKED_BY_LAND,
      landProfile: { blocker: 'wet_soil', source: 'question', moisture: 'wet' },
      cropProfile: { stage: 'planting' },
      weatherNow: { rainRisk: 'low' },
    });
    expect(['high', 'medium']).toContain(c.level);
    expect(c.reasons).toContain('land_blocker_explicit');
  });

  it('drops sharply when land/stage/weather conflict', () => {
    const c = scoreStateConfidence({
      stateType: STATE_TYPES.ACTIVE_CYCLE,
      landProfile: { moisture: 'wet' },
      cropProfile: { stage: 'planting' },
      weatherNow: { rainRisk: 'low' },
    });
    expect(c.reasons).toContain('conflict_planting_vs_wet_soil');
    expect(c.level).toBe('low');
  });

  it('LOW when camera finding is uncertain', () => {
    const c = scoreStateConfidence({
      stateType: STATE_TYPES.CAMERA_ISSUE,
      cameraTask: { type: 'unknown_issue' },
      landProfile: {}, weatherNow: {}, cropProfile: { stage: 'growing' },
    });
    expect(c.reasons).toContain('camera_uncertain');
    expect(c.level).toBe('low');
  });

  it('drops when offline + stale', () => {
    const c = scoreStateConfidence({
      stateType: STATE_TYPES.HARVEST_COMPLETE,
      offlineState: { isOffline: true },
      lastUpdatedAt: Date.now() - 24 * HOUR,
      landProfile: {}, cropProfile: { stage: 'harvest' },
    });
    expect(c.reasons).toContain('stale_offline');
  });

  it('drops for certainty-sensitive state with recent correction', () => {
    const c = scoreStateConfidence({
      stateType: STATE_TYPES.HARVEST_COMPLETE,
      cropProfile: { stage: 'harvest' },
      landProfile: {}, weatherNow: {},
      recentEvents: [{ type: 'harvest_reopened' }],
    });
    expect(c.reasons).toContain('recent_corrections');
  });

  it('returns neutral-ish when all upstream data is missing', () => {
    const c = scoreStateConfidence({ stateType: STATE_TYPES.SAFE_FALLBACK });
    expect(c.reasons).toContain('upstream_data_sparse');
    expect(c.level).toBe('low');
  });
});

// ─── 4. Validation overrides ──────────────────────────────
describe('validateResolvedState — overrides', () => {
  it('post_harvest + uncleared land → field_reset', () => {
    const s = validateResolvedState(
      { stateType: STATE_TYPES.POST_HARVEST, confidenceLevel: 'high', sourceReasons: [] },
      {
        cropProfile: { stage: 'post_harvest', name: 'maize' },
        landProfile: { cleared: false, blocker: 'uncleared_land' },
      },
    );
    expect(s.stateType).toBe(STATE_TYPES.FIELD_RESET);
    expect(s.confidenceLevel).not.toBe('high');
    expect(s.sourceReasons).toContain('override_post_harvest_to_field_reset');
  });

  it('harvest_complete + recent undo downgrades confidence', () => {
    const s = validateResolvedState(
      { stateType: STATE_TYPES.HARVEST_COMPLETE, confidenceLevel: 'high', sourceReasons: [] },
      {
        cropProfile: { stage: 'harvest', name: 'maize' },
        recentEvents: [{ type: 'harvest_reopened' }],
      },
    );
    expect(s.stateType).toBe(STATE_TYPES.HARVEST_COMPLETE);
    expect(s.confidenceLevel).toBe('medium');
    expect(s.sourceReasons).toContain('downgrade_harvest_complete_recent_undo');
  });

  it('planting stage + wet soil overrides to blocked_by_land', () => {
    const s = validateResolvedState(
      { stateType: STATE_TYPES.ACTIVE_CYCLE, confidenceLevel: 'medium', sourceReasons: [] },
      { cropProfile: { stage: 'planting' }, landProfile: { moisture: 'wet' } },
    );
    expect(s.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
    expect(s.sourceReasons).toContain('override_planting_to_blocked_by_land');
  });

  it('weather encourages planting + wet soil → blocked_by_land', () => {
    const s = validateResolvedState(
      { stateType: STATE_TYPES.WEATHER_SENSITIVE, confidenceLevel: 'medium', sourceReasons: [] },
      {
        cropProfile: { stage: 'planting' },
        landProfile: { moisture: 'wet' },
        weatherNow: { rainRisk: 'high' },
      },
    );
    expect(s.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
  });

  it('camera uncertain sets confidence to low', () => {
    const s = validateResolvedState(
      { stateType: STATE_TYPES.CAMERA_ISSUE, confidenceLevel: 'medium', sourceReasons: [] },
      { cameraTask: { type: 'blurry' } },
    );
    expect(s.confidenceLevel).toBe('low');
    expect(s.sourceReasons).toContain('soften_camera_uncertain');
  });

  it('stale offline marks staleData and downgrades high confidence', () => {
    const s = validateResolvedState(
      { stateType: STATE_TYPES.ACTIVE_CYCLE, confidenceLevel: 'high', sourceReasons: [] },
      {
        cropProfile: { stage: 'growing', name: 'maize' },
        offlineState: { isOffline: true },
        lastUpdatedAt: Date.now() - 24 * HOUR,
      },
    );
    expect(s.staleData).toBe(true);
    expect(s.confidenceLevel).toBe('medium');
  });

  it('crop-dependent state without a crop profile → safe_fallback', () => {
    const s = validateResolvedState(
      { stateType: STATE_TYPES.HARVEST_COMPLETE, confidenceLevel: 'medium', sourceReasons: [] },
      { /* no cropProfile */ },
    );
    expect(s.stateType).toBe(STATE_TYPES.SAFE_FALLBACK);
    expect(s.confidenceLevel).toBe('low');
  });
});

// ─── 5. Display mode ──────────────────────────────────────
describe('resolveDisplayMode', () => {
  it('harvest_complete → state_first', () => {
    expect(resolveDisplayMode({ stateType: STATE_TYPES.HARVEST_COMPLETE, confidenceLevel: 'high' }))
      .toBe('state_first');
  });
  it('blocked_by_land → task_first', () => {
    expect(resolveDisplayMode({ stateType: STATE_TYPES.BLOCKED_BY_LAND, confidenceLevel: 'high' }))
      .toBe('task_first');
  });
  it('weather_sensitive → task_first', () => {
    expect(resolveDisplayMode({ stateType: STATE_TYPES.WEATHER_SENSITIVE, confidenceLevel: 'high' }))
      .toBe('task_first');
  });
  it('LOW confidence on any state flips to state_first', () => {
    expect(resolveDisplayMode({ stateType: STATE_TYPES.BLOCKED_BY_LAND, confidenceLevel: 'low' }))
      .toBe('state_first');
  });
});

// ─── 6. Next-step bridge ──────────────────────────────────
describe('appendNextStepBridge', () => {
  it('harvest_complete gets a "prepare field" bridge', () => {
    const s = appendNextStepBridge({ stateType: STATE_TYPES.HARVEST_COMPLETE });
    expect(s.nextKey).toBe('state.next.prepare_field_for_next_cycle');
  });
  it('blocked_by_land (wet soil) gets a wet-soil-specific bridge', () => {
    const s = appendNextStepBridge(
      { stateType: STATE_TYPES.BLOCKED_BY_LAND },
      { landProfile: { blocker: 'wet_soil' } },
    );
    expect(s.nextKey).toBe('state.next.fix_blocker.wet_soil');
  });
  it('active_cycle has no bridge (task card IS the next step)', () => {
    const s = appendNextStepBridge({ stateType: STATE_TYPES.ACTIVE_CYCLE });
    expect(s.nextKey).toBeNull();
    expect(s.nextFallback).toBeNull();
  });
  it('stale_offline bridges to reconnect', () => {
    const s = appendNextStepBridge({ stateType: STATE_TYPES.STALE_OFFLINE });
    expect(s.nextKey).toBe('state.next.reconnect_to_refresh');
  });
});

// ─── 7. Regional tone ─────────────────────────────────────
describe('applyStateToneByRegion', () => {
  it('attaches tone suffixes to every wording key', () => {
    const s = applyStateToneByRegion(
      { titleKey: 'state.blocked_by_land.title', subtitleKey: 'state.blocked_by_land.subtitle' },
      'monsoon_mixed',
    );
    expect(s.toneKeys.title).toBe('state.blocked_by_land.title.monsoon_mixed');
    expect(s.toneKeys.subtitle).toBe('state.blocked_by_land.subtitle.monsoon_mixed');
    expect(s.regionBucket).toBe('monsoon_mixed');
  });
  it('unknown bucket defaults to unknown', () => {
    const s = applyStateToneByRegion({ titleKey: 'x' }, 'not_a_bucket');
    expect(s.regionBucket).toBe('unknown');
  });
  it('resolveRegionBucket accepts ISO codes and bucket names', () => {
    expect(resolveRegionBucket('GH')).toBe('tropical_manual');
    expect(resolveRegionBucket('monsoon_mixed')).toBe('monsoon_mixed');
    expect(resolveRegionBucket('')).toBe('unknown');
  });
});

// ─── 8. Top-level resolver scenarios ──────────────────────
describe('resolveFarmerState — end-to-end scenarios', () => {
  it('harvest_complete with confirmed cleared land + online → state_first state', () => {
    const s = resolveFarmerState({
      hasJustCompletedHarvest: true,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'harvest', name: 'maize' },
      landProfile: { cleared: true, moisture: 'dry' },
      weatherNow: { rainRisk: 'low' },
      countryCode: 'GH',
    });
    expect(s.stateType).toBe(STATE_TYPES.HARVEST_COMPLETE);
    expect(s.displayMode).toBe('state_first');
    expect(s.nextKey).toBe('state.next.prepare_field_for_next_cycle');
    expect(s.regionBucket).toBe('tropical_manual');
    expect(s.devIssues).toEqual([]);
  });

  it('post_harvest + uncleared land gets flipped to field_reset with low confidence', () => {
    const s = resolveFarmerState({
      cropProfile: { stage: 'post_harvest', name: 'maize' },
      landProfile: { cleared: false, blocker: 'uncleared_land' },
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
    });
    expect(s.stateType).toBe(STATE_TYPES.FIELD_RESET);
    expect(s.nextKey).toBe('state.next.finish_field_cleanup');
  });

  it('planting intent + wet soil → blocked_by_land (TASK-FIRST)', () => {
    const s = resolveFarmerState({
      cropProfile: { stage: 'planting', name: 'tomato' },
      landProfile: { moisture: 'wet', blocker: 'wet_soil' },
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      countryCode: 'IN',
    });
    expect(s.stateType).toBe(STATE_TYPES.BLOCKED_BY_LAND);
    expect(s.displayMode).toBe('task_first');
    expect(s.nextKey).toBe('state.next.fix_blocker.wet_soil');
    expect(s.regionBucket).toBe('monsoon_mixed');
  });

  it('offline + stale → stale_offline (state_first, staleData)', () => {
    const s = resolveFarmerState({
      offlineState: { isOffline: true },
      lastUpdatedAt: Date.now() - 24 * HOUR,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry', cleared: true },
    });
    expect(s.stateType).toBe(STATE_TYPES.STALE_OFFLINE);
    expect(s.displayMode).toBe('state_first');
    expect(s.staleData).toBe(true);
  });

  it('camera uncertain → camera_issue with LOW confidence (state_first fallback)', () => {
    const s = resolveFarmerState({
      cameraTask: { type: 'blurry' },
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry' },
    });
    expect(s.stateType).toBe(STATE_TYPES.CAMERA_ISSUE);
    expect(s.confidenceLevel).toBe('low');
    // low confidence flips task_first → state_first
    expect(s.displayMode).toBe('state_first');
  });

  it('first_use when onboarding incomplete', () => {
    const s = resolveFarmerState({ hasCompletedOnboarding: false });
    expect(s.stateType).toBe(STATE_TYPES.FIRST_USE);
    expect(s.nextKey).toBe('state.next.start_setup');
  });

  it('returning_inactive at 5 missed days', () => {
    const s = resolveFarmerState({
      missedDays: 5,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry' },
    });
    expect(s.stateType).toBe(STATE_TYPES.RETURNING_INACTIVE);
    expect(s.nextKey).toBe('state.next.check_today_task');
  });

  it('active_cycle is the normal state — no bridge, confidence=medium+', () => {
    const s = resolveFarmerState({
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'maize' },
      landProfile: { moisture: 'dry', cleared: true },
      weatherNow: { rainRisk: 'low', heatRisk: 'low' },
    });
    expect(s.stateType).toBe(STATE_TYPES.ACTIVE_CYCLE);
    expect(s.nextKey).toBeNull();
  });

  it('safe_fallback never throws on empty input', () => {
    expect(() => resolveFarmerState()).not.toThrow();
    expect(() => resolveFarmerState(null)).not.toThrow();
    const s = resolveFarmerState({});
    expect([STATE_TYPES.FIRST_USE, STATE_TYPES.SAFE_FALLBACK]).toContain(s.stateType);
  });
});

// ─── 9. buildHomeExperience ───────────────────────────────
describe('buildHomeExperience', () => {
  const t = makeT('en');

  it('STATE-FIRST uses state title; TASK-FIRST prefers task title', () => {
    const stateFirst = buildHomeExperience({
      farmerState: resolveFarmerState({
        hasJustCompletedHarvest: true,
        hasCompletedOnboarding: true, hasActiveCropCycle: true,
        cropProfile: { stage: 'harvest', name: 'maize' },
        landProfile: { cleared: true, moisture: 'dry' }, weatherNow: { rainRisk: 'low' },
      }),
      task: { title: 'Start next cycle', id: 't-1' },
      t,
    });
    expect(stateFirst.displayMode).toBe('state_first');
    expect(stateFirst.title).toMatch(/Harvest complete/);

    const taskFirst = buildHomeExperience({
      farmerState: resolveFarmerState({
        cropProfile: { stage: 'planting', name: 'tomato' },
        landProfile: { moisture: 'wet', blocker: 'wet_soil' },
        hasCompletedOnboarding: true, hasActiveCropCycle: true,
      }),
      task: { title: 'Wait before planting', id: 't-2' },
      t,
    });
    expect(taskFirst.displayMode).toBe('task_first');
    expect(taskFirst.title).toBe('Wait before planting');
    expect(taskFirst.next).toBeTruthy();
  });

  it('prepends soft "Based on your last update" for stale offline', () => {
    const home = buildHomeExperience({
      farmerState: resolveFarmerState({
        offlineState: { isOffline: true },
        lastUpdatedAt: Date.now() - 24 * HOUR,
        hasCompletedOnboarding: true, hasActiveCropCycle: true,
        cropProfile: { stage: 'growing', name: 'maize' },
        landProfile: { moisture: 'dry' },
      }),
      t,
    });
    expect(home.confidenceLine).toBe('Based on your last update');
  });

  it('never exposes the numeric confidence score', () => {
    const home = buildHomeExperience({
      farmerState: resolveFarmerState({
        hasJustCompletedHarvest: true,
        hasCompletedOnboarding: true, hasActiveCropCycle: true,
        cropProfile: { stage: 'harvest', name: 'maize' },
        landProfile: { cleared: true, moisture: 'dry' },
      }),
      t,
    });
    const serialized = JSON.stringify(home);
    expect(serialized).not.toMatch(/\"confidenceScore\"/);
  });
});

// ─── 10. i18n overlay & localization ──────────────────────
const NON_EN_LOCALES = ['hi', 'tw', 'es', 'pt', 'fr', 'ar', 'sw', 'id'];
const CORE_KEYS = [
  'state.blocked_by_land.title',
  'state.harvest_complete.title',
  'state.stale_offline.title',
  'state.first_use.title',
  'state.returning_inactive.title',
  'state.active_cycle.title',
  'state.soft.based_on_last_update',
];

describe('farmerStateTranslations overlay', () => {
  it('every supported locale is present', () => {
    for (const l of ['en', ...NON_EN_LOCALES]) {
      expect(FARMER_STATE_TRANSLATIONS[l]).toBeDefined();
    }
  });

  it('core keys exist in every locale', () => {
    for (const l of ['en', ...NON_EN_LOCALES]) {
      for (const k of CORE_KEYS) {
        expect(FARMER_STATE_TRANSLATIONS[l][k]).toBeTruthy();
      }
    }
  });

  it('non-English locales do not leak the English title', () => {
    for (const l of NON_EN_LOCALES) {
      for (const k of CORE_KEYS) {
        expect(FARMER_STATE_TRANSLATIONS[l][k]).not.toBe(FARMER_STATE_TRANSLATIONS.en[k]);
      }
    }
  });

  it('applyFarmerStateOverlay merges into an existing dictionary', () => {
    const existing = { en: { 'some.key': 'v' }, hi: {} };
    const ref = applyFarmerStateOverlay(existing);
    expect(ref).toBe(existing);
    expect(existing.en['some.key']).toBe('v');
    expect(existing.en['state.harvest_complete.title']).toMatch(/Harvest/);
    expect(existing.hi['state.harvest_complete.title']).toBe('फ़सल पूरी हुई 🌾');
  });

  it('Hindi buildHomeExperience round-trip renders Hindi', () => {
    const t = makeT('hi');
    const home = buildHomeExperience({
      farmerState: resolveFarmerState({
        hasJustCompletedHarvest: true,
        hasCompletedOnboarding: true, hasActiveCropCycle: true,
        cropProfile: { stage: 'harvest', name: 'maize' },
        landProfile: { cleared: true, moisture: 'dry' },
      }),
      t,
    });
    expect(home.title).toBe('फ़सल पूरी हुई 🌾');
    expect(home.next).toBe('अगले चक्र के लिए खेत तैयार करें');
  });
});

// ─── 11. Dev assertions ───────────────────────────────────
describe('runDevAssertions', () => {
  it('flags a strong state missing validation markers', () => {
    const issues = runDevAssertions({
      stateType: STATE_TYPES.HARVEST_COMPLETE,
      confidenceLevel: 'high', sourceReasons: [],
      displayMode: 'state_first', nextKey: 'x', toneKeys: { title: 'x' },
    }, {});
    expect(issues).toContain('strong_state_without_validation_check');
  });

  it('flags low confidence + task_first', () => {
    const issues = runDevAssertions({
      stateType: STATE_TYPES.BLOCKED_BY_LAND,
      confidenceLevel: 'low',
      displayMode: 'task_first',
      sourceReasons: ['override_planting_to_blocked_by_land'],
      nextKey: 'x', toneKeys: { title: 'x' },
    }, {});
    expect(issues).toContain('low_confidence_with_task_first_display');
  });

  it('flags missing tone adapter', () => {
    const issues = runDevAssertions({
      stateType: STATE_TYPES.HARVEST_COMPLETE,
      confidenceLevel: 'medium',
      sourceReasons: ['validation_confirmed'],
      displayMode: 'state_first',
      nextKey: 'x',
      toneKeys: null,
    }, {});
    expect(issues).toContain('region_tone_adapter_not_applied');
  });

  it('is silent when everything is fine', () => {
    const s = resolveFarmerState({
      hasJustCompletedHarvest: true,
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'harvest', name: 'maize' },
      landProfile: { cleared: true }, weatherNow: { rainRisk: 'low' },
      countryCode: 'GH',
    });
    expect(s.devIssues).toEqual([]);
  });
});

// ─── 12. Stability / edge cases ───────────────────────────
describe('stability', () => {
  it('handles null landProfile without throwing', () => {
    expect(() => resolveFarmerState({
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
      cropProfile: { stage: 'growing', name: 'x' },
    })).not.toThrow();
  });

  it('greeting copy never contains the word "Farroway"', () => {
    for (const type of STATE_PRIORITY) {
      const w = FARMER_STATE_TRANSLATIONS.en[`state.${type}.title`];
      if (!w) continue;
      expect(w.toLowerCase()).not.toContain('farroway');
    }
  });

  it('buildHomeExperience returns null for null state', () => {
    expect(buildHomeExperience({ farmerState: null })).toBeNull();
  });

  it('re-running resolveFarmerState with identical input is deterministic', () => {
    const input = {
      cropProfile: { stage: 'planting', name: 'tomato' },
      landProfile: { moisture: 'wet', blocker: 'wet_soil' },
      hasCompletedOnboarding: true, hasActiveCropCycle: true,
    };
    const a = resolveFarmerState(input);
    const b = resolveFarmerState(input);
    expect(a.stateType).toBe(b.stateType);
    expect(a.displayMode).toBe(b.displayMode);
    expect(a.nextKey).toBe(b.nextKey);
  });
});
