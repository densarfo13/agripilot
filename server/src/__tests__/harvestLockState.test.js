/**
 * harvestLockState.test.js — locks the three regression-prevention
 * fixes for the harvest detection + lock state spec:
 *
 *   A. hasRecentHarvest tolerates small plantingDate edits so a
 *      post-completion date correction can't regress the cycle
 *   B. hasRecentHarvest uses "record after plantingDate" as a
 *      fallback — ensures a completed cycle stays locked even when
 *      plantingDate drifts far from the record's stored anchor
 *   C. stageAdvanceNotifier emits a harvest-specific message when
 *      the computed stage advances INTO harvest
 *   D. getStageProgress.headline reflects cycleState=completed so
 *      the timeline card reads "Cycle complete" after recording
 *   E. getStageProgress.headline reads "likely ready for harvest"
 *      when cycleState=harvest_ready (not the generic "get ready")
 *   F. completed cycle + reload still stays completed (end-to-end
 *      via detectHarvestState + getCropCycleState)
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installMemoryStorage() {
  const store = new Map();
  const mem = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = mem;
  return mem;
}

import {
  recordHarvest, hasRecentHarvest, clearHarvestsForFarm,
} from '../../../src/lib/harvest/harvestRecordStore.js';
import { detectHarvestState } from '../../../src/lib/harvest/harvestDetectionEngine.js';
import { getCropCycleState }  from '../../../src/lib/harvest/cropCycleCompletionEngine.js';
import {
  detectStageAdvance, clearLastSeenStage, _internal as notifierInt,
} from '../../../src/lib/timeline/stageAdvanceNotifier.js';
import { getCropTimeline } from '../../../src/lib/timeline/cropTimelineEngine.js';
import { getStageProgress } from '../../../src/lib/timeline/stageProgressEngine.js';

function isoAgo(days) { return new Date(Date.now() - days * 86400000).toISOString(); }

beforeEach(() => { installMemoryStorage(); });

// ─── A + B. hasRecentHarvest regression guards ───────────────────
describe('hasRecentHarvest — regression-proof checks', () => {
  it('tolerates a ±3 day plantingDate correction post-record', () => {
    const originalPlanting = isoAgo(100);
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg', plantingDate: originalPlanting,
    });
    // Farmer corrects plantingDate by 2 days (e.g. "actually I
    // planted on the Saturday, not Monday").
    const correctedPlanting = isoAgo(98);
    expect(hasRecentHarvest({ farmId: 'f1', plantingDate: correctedPlanting })).toBe(true);
  });

  it('does NOT tolerate a big plantingDate jump (new cycle starts)', () => {
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg', plantingDate: isoAgo(100),
    });
    // Farmer starts a fresh cycle with a planting date 6 months ago
    // (so the last harvest record is AFTER that new plantingDate —
    // that actually counts as THIS cycle's harvest via rule #3).
    // For a true "new cycle" test, the new plantingDate must be
    // LATER than the existing record's harvestedAt.
    const newPlantingLaterThanHarvest = new Date(Date.now() + 1 * 86400000).toISOString();
    expect(hasRecentHarvest({
      farmId: 'f1', plantingDate: newPlantingLaterThanHarvest,
    })).toBe(false);
  });

  it('uses "record after plantingDate" as a final guard', () => {
    // Record with plantingDate = 200 days ago, harvested today.
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg', plantingDate: isoAgo(200),
    });
    // Farmer edits plantingDate to 150 days ago — no longer matches
    // the record's stored anchor, outside ±3 day window. But the
    // record was harvested AFTER 150 days ago → still this cycle.
    expect(hasRecentHarvest({
      farmId: 'f1', plantingDate: isoAgo(150),
    })).toBe(true);
  });

  it('legacy 60-day fallback still works when no plantingDate is given', () => {
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg',
    });
    expect(hasRecentHarvest({ farmId: 'f1' })).toBe(true);
  });
});

// ─── C. stage-advance notifier — harvest-specific message ────────
describe('stageAdvanceNotifier — harvest advance copy', () => {
  it('emits a "likely ready for harvest" message when advancing into harvest', () => {
    window.localStorage.setItem(notifierInt.KEY, JSON.stringify({
      byFarm: { f1: { stage: 'grain_fill', seenAt: Date.now() - 72 * 3600 * 1000 } },
    }));
    // maize total = 105 days; day 100 is inside the harvest stage.
    const r = detectStageAdvance({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(100) },
      now: new Date(),
    });
    expect(r).not.toBeNull();
    expect(r.harvestAdvance).toBe(true);
    expect(r.toStage).toBe('harvest');
    expect(r.message.key).toBe('timeline.advancedWhileAway.harvestReady');
    expect(r.message.fallback.toLowerCase()).toContain('likely ready for harvest');
  });

  it('still uses the generic message for non-harvest advances', () => {
    window.localStorage.setItem(notifierInt.KEY, JSON.stringify({
      byFarm: { f1: { stage: 'vegetative', seenAt: Date.now() - 72 * 3600 * 1000 } },
    }));
    // Maize day 60 → tasseling.
    const r = detectStageAdvance({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(60) },
      now: new Date(),
    });
    expect(r.harvestAdvance).toBe(false);
    expect(r.message.key).toBe('timeline.advancedWhileAway.message');
    expect(r.message.fallback.toLowerCase()).toContain('tasseling');
  });
});

// ─── D + E. getStageProgress headline respects cycleState ────────
describe('getStageProgress — cycleState-aware headline', () => {
  it('completed cycle reads "Cycle complete — your harvest is recorded."', () => {
    const timeline = getCropTimeline({
      farm: { crop: 'maize', plantingDate: isoAgo(100) },
    });
    const progress = getStageProgress({ timeline, cycleState: 'completed' });
    expect(progress.headline.key).toBe('timeline.headline.completed');
    expect(progress.headline.fallback.toLowerCase()).toContain('cycle complete');
  });

  it('harvest_ready reads "likely ready for harvest", not the generic line', () => {
    const timeline = getCropTimeline({
      farm: { crop: 'maize', plantingDate: isoAgo(100) },
    });
    const progress = getStageProgress({ timeline, cycleState: 'harvest_ready' });
    expect(progress.headline.key).toBe('timeline.headline.harvestReady');
    expect(progress.headline.fallback.toLowerCase()).toContain('likely ready for harvest');
  });

  it('active + harvest stage (pre-cycle-state-aware) keeps original copy', () => {
    const timeline = getCropTimeline({
      farm: { crop: 'maize', plantingDate: isoAgo(100) },
    });
    const progress = getStageProgress({ timeline, cycleState: 'active' });
    // Technically unreachable in production (detectHarvestState flips
    // to harvest_ready as soon as the timeline reaches harvest) but
    // the guard keeps existing callers working without a param.
    expect(progress.headline.key).toBe('timeline.headline.harvest');
  });

  it('defaults to active cycle when cycleState is omitted (back-compat)', () => {
    const timeline = getCropTimeline({
      farm: { crop: 'maize', plantingDate: isoAgo(20) },
    });
    const progress = getStageProgress({ timeline });   // no cycleState
    expect(progress.headline).toBeDefined();
    expect(progress.headline.fallback.length).toBeGreaterThan(0);
  });
});

// ─── F. End-to-end: completed cycle survives a plantingDate edit ─
describe('End-to-end — cycle stays completed after plantingDate edit', () => {
  it('record + correct plantingDate by a few days → still completed', () => {
    const original = isoAgo(100);
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg', plantingDate: original,
    });
    // Confirm completed with original date.
    const before = detectHarvestState({
      farm: { id: 'f1', crop: 'maize', plantingDate: original },
    });
    expect(before.cycleState).toBe('completed');
    // Farmer corrects planting date by 2 days — cycle must NOT regress.
    const after = detectHarvestState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(98) },
    });
    expect(after.cycleState).toBe('completed');
  });

  it('getCropCycleState mirrors the detection — growth tasks suppressed', () => {
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg', plantingDate: isoAgo(100),
    });
    const cycle = getCropCycleState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(97) },   // 3-day drift
    });
    expect(cycle.state).toBe('completed');
    expect(cycle.shouldSuppressGrowthTasks).toBe(true);
    expect(cycle.shouldInjectHarvestTasks).toBe(false);
    expect(cycle.nextStep.actionKey).toBe('start_new_cycle');
  });

  it('clearing the harvest record releases the lock', () => {
    recordHarvest({
      farmId: 'f1', crop: 'maize', harvestedAmount: 50,
      harvestedUnit: 'kg', plantingDate: isoAgo(100),
    });
    clearHarvestsForFarm('f1');
    const cycle = getCropCycleState({
      farm: { id: 'f1', crop: 'maize', plantingDate: isoAgo(100) },
    });
    // 100 days > maize total 105? No, 100 < 105, so timeline still
    // bumps into the harvest stage bucket → harvest_ready, not active.
    expect(['harvest_ready', 'active']).toContain(cycle.state);
    expect(cycle.shouldSuppressGrowthTasks).toBe(false);
  });
});
