/**
 * livingContinuityEngines.test.js — Living Farm Continuity §1/§4/§6.
 *
 * Covers:
 *   • homeContinuityEngine — calm "living" insight envelope
 *   • adaptiveTaskEngine   — ONE primary task per call, with `why`
 *   • livingMemoryEngine   — milestone detection
 *
 * Calm UX contract enforced — no "AI" / "%" / "model" leaks.
 */

import { describe, it, expect } from 'vitest';

import {
  buildHomeContinuity, _internal as homeInternal,
} from '../../../src/core/home/homeContinuityEngine.js';

import {
  generateAdaptiveTask, _internal as taskInternal,
} from '../../../src/core/tasks/adaptiveTaskEngine.js';

import {
  buildLivingMemory, MILESTONE, _internal as memoryInternal,
} from '../../../src/core/journal/livingMemoryEngine.js';

// ═══ homeContinuityEngine ════════════════════════════════════

describe('homeContinuityEngine — envelope shape', () => {
  it('empty input returns calm fallback envelope', () => {
    const v = buildHomeContinuity({});
    expect(v.engineVersion).toBe('home-continuity-v1');
    expect(typeof v.todayFocus.key).toBe('string');
    expect(typeof v.todayFocus.fallback).toBe('string');
    expect(v.urgency).toBe('low');
    expect(['high_confidence', 'medium_confidence', 'needs_review'])
      .toContain(v.confidenceTone);
  });

  it('garbage never throws', () => {
    expect(() => buildHomeContinuity(null)).not.toThrow();
    expect(() => buildHomeContinuity(undefined)).not.toThrow();
    expect(() => buildHomeContinuity('hi')).not.toThrow();
  });
});

describe('homeContinuityEngine — sub-insights', () => {
  it('recovery insight fires on successful interventions', () => {
    const v = buildHomeContinuity({
      farmMemory: {
        resolvedCount: 3,
        activeFlags: { hasSuccessfulInterventions: true },
      },
    });
    expect(v.recoveryInsight).toBeTruthy();
    expect(v.recoveryInsight.key).toBe('home.continuity.recovery.successful');
  });

  it('recovery insight warns when worsening trend present', () => {
    const v = buildHomeContinuity({
      farmMemory: { activeFlags: { hasWorseningTrend: true } },
    });
    expect(v.recoveryInsight.key).toBe('home.continuity.recovery.watch');
  });

  it('continuity insight fires on 3+ healthy scans', () => {
    const v = buildHomeContinuity({
      scanHistory: [
        { severity: 'mild' }, { severity: 'mild' },
        { severity: 'healthy' }, { severity: '' },
      ],
    });
    expect(v.continuityInsight).toBeTruthy();
    expect(v.continuityInsight.key).toBe('home.continuity.streak.healthy');
  });

  it('recurring issue beats long-gap as continuity insight', () => {
    const v = buildHomeContinuity({
      farmMemory: {
        recurringIssues: [{ category: 'leaf_spots', count: 3 }],
        daysSinceLastScan: 14,
      },
    });
    expect(v.continuityInsight.key).toBe('home.continuity.recurring');
  });

  it('weatherAwareness picks frost over heat', () => {
    const v = buildHomeContinuity({ weather: { temp: 2 } });
    expect(v.weatherAwareness.key).toBe('home.continuity.weather.frost');
  });

  it('weatherAwareness handles fungal humidity window', () => {
    const v = buildHomeContinuity({
      weather: { humidityPct: 85, temp: 24 },
    });
    expect(v.weatherAwareness.key).toBe('home.continuity.weather.fungal');
  });

  it('growthMomentum reflects harvest stage', () => {
    const v = buildHomeContinuity({
      cropLifecycle: { currentStage: 'harvest' },
    });
    expect(v.growthMomentum.key).toBe('home.continuity.momentum.harvest');
  });

  it('passes governance.oneBestAction through to todayFocus', () => {
    const v = buildHomeContinuity({
      governance: {
        oneBestAction: { key: 'custom.action', fallback: 'Custom thing' },
        reason: { key: 'r', fallback: 'because' },
        urgency: 'high', confidenceTone: 'high_confidence',
      },
    });
    expect(v.todayFocus.key).toBe('custom.action');
    expect(v.urgency).toBe('high');
    expect(v.confidenceTone).toBe('high_confidence');
    expect(v.recommendationReason.fallback).toBe('because');
  });
});

// ═══ adaptiveTaskEngine ═══════════════════════════════════════

describe('adaptiveTaskEngine — envelope shape', () => {
  it('empty input returns the routine task as primary', () => {
    const v = generateAdaptiveTask({});
    expect(v.engineVersion).toBe('adaptive-task-v1');
    expect(v.primary).toBeTruthy();
    expect(v.primary.id).toBe('task.routine.inspection');
    expect(v.secondary).toBeNull();
  });

  it('garbage never throws', () => {
    expect(() => generateAdaptiveTask(null)).not.toThrow();
    expect(() => generateAdaptiveTask(undefined)).not.toThrow();
    expect(() => generateAdaptiveTask('hi')).not.toThrow();
  });

  it('every task carries a `why` envelope', () => {
    const v = generateAdaptiveTask({});
    expect(typeof v.primary.why.key).toBe('string');
    expect(typeof v.primary.why.fallback).toBe('string');
  });
});

describe('adaptiveTaskEngine — priority ladder', () => {
  it('frost beats everything else', () => {
    const v = generateAdaptiveTask({
      weather: { temp: 2 },
      scan: { severity: 'serious' },
    });
    expect(v.primary.id).toBe('task.survival.frost');
    expect(v.primary.urgency).toBe('high');
  });

  it('scan follow-up beats lifecycle + weather routine', () => {
    const v = generateAdaptiveTask({
      scan: { severity: 'serious' },
      cropLifecycle: { criticalTaskOverdueDays: 3 },
      weather: { humidityPct: 85, temp: 24 },
    });
    expect(v.primary.id).toBe('task.scan.followup');
  });

  it('humidity + warm temp fires the fungal task', () => {
    const v = generateAdaptiveTask({
      weather: { humidityPct: 85, temp: 24 },
    });
    expect(v.primary.id).toBe('task.weather.fungal');
  });

  it('dry heat fires the deep-watering task', () => {
    const v = generateAdaptiveTask({
      weather: { temp: 30, rainProbability24hPct: 5 },
    });
    expect(v.primary.id).toBe('task.weather.dryHeat');
  });

  it('recurring memory fires the memory task', () => {
    const v = generateAdaptiveTask({
      farmMemory: { activeFlags: { hasRecurringIssue: true } },
    });
    expect(v.primary.id).toBe('task.memory.recurring');
  });
});

describe('adaptiveTaskEngine — secondary + suppression', () => {
  it('emits a secondary when sources differ + urgency is enough', () => {
    const v = generateAdaptiveTask({
      weather: { temp: 2 },                  // survival → primary
      scan: { severity: 'serious' },          // scan → secondary
    });
    expect(v.primary.source).toBe('weather');
    expect(v.secondary).toBeTruthy();
    expect(v.secondary.source).toBe('scan');
  });

  it('does NOT add a secondary when only routine is available alongside', () => {
    const v = generateAdaptiveTask({
      weather: { temp: 2 },
    });
    expect(v.primary.id).toBe('task.survival.frost');
    expect(v.secondary).toBeNull();
  });

  it('suppressed list carries reason markers', () => {
    const v = generateAdaptiveTask({
      weather: { temp: 2 },
      scan: { severity: 'serious' },
      farmMemory: { activeFlags: { hasRecurringIssue: true } },
    });
    expect(v.suppressed.length).toBeGreaterThan(0);
    for (const s of v.suppressed) {
      expect(['lower_priority', 'demoted_to_routine']).toContain(s.reason);
    }
  });
});

// ═══ livingMemoryEngine ══════════════════════════════════════

describe('livingMemoryEngine — envelope shape', () => {
  it('empty input returns empty envelope', () => {
    const v = buildLivingMemory({});
    expect(v.engineVersion).toBe('living-memory-v1');
    expect(v.milestones.length).toBe(0);
    expect(v.totalScans).toBe(0);
    expect(v.healthyStreak).toBe(0);
  });

  it('garbage never throws', () => {
    expect(() => buildLivingMemory(null)).not.toThrow();
    expect(() => buildLivingMemory(undefined)).not.toThrow();
    expect(() => buildLivingMemory('hi')).not.toThrow();
  });
});

describe('livingMemoryEngine — milestone detection', () => {
  const now = Date.now();

  it('emits FIRST_SCAN from the oldest scan in history', () => {
    const v = buildLivingMemory({
      scanHistory: [
        { id: 's3', createdAt: now,           severity: 'mild' },
        { id: 's1', createdAt: now - 86400e3, severity: 'mild' },
      ],
    });
    const m = v.milestones.find((x) => x.kind === MILESTONE.FIRST_SCAN);
    expect(m).toBeTruthy();
    expect(m.scanId).toBe('s1');
  });

  it('emits HEALTHY_STREAK when 3+ recent scans look healthy', () => {
    const v = buildLivingMemory({
      scanHistory: [
        { id: 's3', createdAt: now,           severity: 'mild' },
        { id: 's2', createdAt: now - 86400e3, severity: '' },
        { id: 's1', createdAt: now - 2*86400e3, severity: 'healthy' },
      ],
    });
    expect(v.milestones.some((m) => m.kind === MILESTONE.HEALTHY_STREAK)).toBe(true);
    expect(v.healthyStreak).toBeGreaterThanOrEqual(3);
  });

  it('emits FIRST_ISSUE when a serious / moderate scan exists', () => {
    const v = buildLivingMemory({
      scanHistory: [
        { id: 's2', createdAt: now,            severity: 'mild' },
        { id: 's1', createdAt: now - 86400e3,  severity: 'serious' },
      ],
    });
    const m = v.milestones.find((x) => x.kind === MILESTONE.FIRST_ISSUE);
    expect(m).toBeTruthy();
    expect(m.scanId).toBe('s1');
  });

  it('emits RECOVERY for each resolved outcome', () => {
    const v = buildLivingMemory({
      scanOutcomes: [
        { scanId: 's1', outcome: 'resolved', recordedAt: now - 3600e3 },
        { scanId: 's2', outcome: 'improved', recordedAt: now },
      ],
    });
    expect(v.recoveryCount).toBeGreaterThanOrEqual(2);
    expect(v.milestones.some((m) => m.kind === MILESTONE.RECOVERY)).toBe(true);
    expect(v.milestones.some((m) => m.kind === MILESTONE.TREATMENT_SUCCESS)).toBe(true);
  });

  it('emits FIRST_FLOWER from a flowering-stage scan', () => {
    const v = buildLivingMemory({
      scanHistory: [
        { id: 's1', createdAt: now - 86400e3, lifecycleStage: 'flowering' },
      ],
    });
    expect(v.milestones.some((m) => m.kind === MILESTONE.FIRST_FLOWER)).toBe(true);
  });

  it('emits HARVEST events from harvestEvents', () => {
    const v = buildLivingMemory({
      harvestEvents: [{ atMs: now, crop: 'tomato' }],
    });
    const m = v.milestones.find((x) => x.kind === MILESTONE.HARVEST);
    expect(m).toBeTruthy();
    expect(m.detail.params.crop).toBe('tomato');
  });

  it('emits GROWTH_PROGRESSION when 2+ distinct stages exist', () => {
    const v = buildLivingMemory({
      scanHistory: [
        { id: 's3', createdAt: now,            lifecycleStage: 'fruiting' },
        { id: 's2', createdAt: now - 86400e3,  lifecycleStage: 'flowering' },
        { id: 's1', createdAt: now - 2*86400e3, lifecycleStage: 'vegetative' },
      ],
    });
    expect(v.milestones.some((m) => m.kind === MILESTONE.GROWTH_PROGRESSION)).toBe(true);
  });

  it('caps milestones at 10', () => {
    const history = [];
    for (let i = 0; i < 20; i++) {
      history.push({ id: 's' + i, createdAt: now - (i * 3600e3), severity: 'mild' });
    }
    const outcomes = [];
    for (let i = 0; i < 15; i++) {
      outcomes.push({ scanId: 's' + i, outcome: 'resolved', recordedAt: now - (i * 3600e3) });
    }
    const v = buildLivingMemory({ scanHistory: history, scanOutcomes: outcomes });
    expect(v.milestones.length).toBeLessThanOrEqual(10);
  });

  it('milestones sorted newest-first', () => {
    const v = buildLivingMemory({
      scanHistory: [
        { id: 's2', createdAt: 2000, severity: 'mild' },
        { id: 's1', createdAt: 1000, severity: 'mild' },
      ],
    });
    for (let i = 1; i < v.milestones.length; i++) {
      expect(v.milestones[i].atMs).toBeLessThanOrEqual(v.milestones[i - 1].atMs);
    }
  });
});

// ═══ Calm UX contract ════════════════════════════════════════

describe('Calm UX contract — no AI / % leaks', () => {
  it('homeContinuityEngine never leaks raw AI / %', () => {
    const v = buildHomeContinuity({
      weather: { temp: 2, humidityPct: 85 },
      farmMemory: {
        recurringIssues: [{ category: 'leaf_spots', count: 3 }],
        activeFlags: { hasSuccessfulInterventions: true },
      },
    });
    const text = [
      v.todayFocus.fallback,
      v.recoveryInsight && v.recoveryInsight.fallback,
      v.continuityInsight && v.continuityInsight.fallback,
      v.weatherAwareness && v.weatherAwareness.fallback,
      v.growthMomentum && v.growthMomentum.fallback,
    ].filter(Boolean).join(' ');
    expect(text).not.toMatch(/%/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });

  it('adaptiveTaskEngine never leaks raw AI / %', () => {
    const v = generateAdaptiveTask({
      weather: { temp: 2 },
      scan: { severity: 'serious' },
    });
    const text = [
      v.primary.title.fallback,
      v.primary.why.fallback,
      v.secondary && v.secondary.title.fallback,
      v.secondary && v.secondary.why.fallback,
    ].filter(Boolean).join(' ');
    expect(text).not.toMatch(/%/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });

  it('livingMemoryEngine never leaks raw AI / %', () => {
    const v = buildLivingMemory({
      scanHistory: [{ id: 's1', createdAt: Date.now(), severity: 'serious' }],
      scanOutcomes: [{ scanId: 's1', outcome: 'resolved', recordedAt: Date.now() }],
    });
    const text = v.milestones.flatMap((m) => [m.title.fallback, m.detail.fallback]).join(' ');
    expect(text).not.toMatch(/%/);
    expect(text.toLowerCase()).not.toMatch(/\b(ai|model|neural|probability)\b/);
  });
});

// ═══ _internal smoke ═════════════════════════════════════════

describe('_internal handles exist', () => {
  it('home internal exposes ENGINE_VERSION', () => {
    expect(homeInternal.ENGINE_VERSION).toBe('home-continuity-v1');
  });
  it('task internal exposes RANK + ENGINE_VERSION', () => {
    expect(taskInternal.RANK.SURVIVAL).toBe(1);
    expect(taskInternal.ENGINE_VERSION).toBe('adaptive-task-v1');
  });
  it('memory internal exposes MAX_MILESTONES', () => {
    expect(memoryInternal.MAX_MILESTONES).toBe(10);
  });
});
