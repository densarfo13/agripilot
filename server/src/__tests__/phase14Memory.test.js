/**
 * phase14Memory.test.js — Phase 14 farm memory + outcome
 * intelligence. Covers:
 *   • recommendationLearning (priority adjustments from outcomes)
 *   • outcomeAnalytics (NGO-facing aggregation)
 *   • farmMemorySnapshot (unified read facade + derived guidance)
 */

import { describe, it, expect, beforeEach } from 'vitest';

import {
  TASK_ACTION, recordTaskAction, getTaskActions, clearTaskActions,
  computePriorityAdjustments, applyLearningToTask, getLearningSnapshot,
} from '../../../src/core/intelligence/recommendationLearning.js';

import {
  recordScanOutcome, clearScanOutcomes, OUTCOME,
} from '../../../src/core/scan/scanOutcomeTracker.js';

import {
  interventionEffectiveness, diseaseReductionTrend,
  farmerEngagement, recoveryOutcomes, regionalCropStress,
  getOutcomeAnalyticsSnapshot,
} from '../../../src/core/ngo/outcomeAnalytics.js';

import {
  getFarmMemorySnapshot, deriveMemoryGuidance,
} from '../../../src/core/memory/farmMemorySnapshot.js';

function _stubLocalStorage() {
  if (typeof globalThis.localStorage === 'undefined') {
    const _store = new Map();
    globalThis.localStorage = {
      getItem: (k) => _store.has(k) ? _store.get(k) : null,
      setItem: (k, v) => _store.set(k, String(v)),
      removeItem: (k) => _store.delete(k),
      clear: () => _store.clear(),
      get length() { return _store.size; },
      key: (i) => Array.from(_store.keys())[i] || null,
    };
  } else {
    try { globalThis.localStorage.clear(); } catch { /* swallow */ }
  }
}

// ─── recommendationLearning ─────────────────────────

describe('recommendationLearning', () => {
  beforeEach(() => {
    _stubLocalStorage();
    clearTaskActions();
    clearScanOutcomes();
  });

  it('exports the documented TASK_ACTION constants', () => {
    expect(TASK_ACTION.ACCEPTED).toBe('accepted');
    expect(TASK_ACTION.COMPLETED).toBe('completed');
    expect(TASK_ACTION.IGNORED).toBe('ignored');
    expect(TASK_ACTION.DISPUTED).toBe('disputed');
  });

  it('recordTaskAction persists + reads back', () => {
    const row = recordTaskAction('task.checkSoil.tomato', TASK_ACTION.COMPLETED, {
      crop: 'tomato', region: 'Ashanti',
    });
    expect(row).toBeTruthy();
    expect(row.taskKey).toBe('task.checkSoil.tomato');
    expect(getTaskActions()).toHaveLength(1);
  });

  it('dedupes the same action within an hour', () => {
    recordTaskAction('t.a', TASK_ACTION.COMPLETED, {});
    recordTaskAction('t.a', TASK_ACTION.COMPLETED, {});
    expect(getTaskActions()).toHaveLength(1);
  });

  it('rejects invalid actions', () => {
    expect(recordTaskAction('t.a', 'made_up_action', {})).toBeNull();
    expect(recordTaskAction(null, TASK_ACTION.COMPLETED, {})).toBeNull();
  });

  it('computePriorityAdjustments returns empty when no actions', () => {
    expect(computePriorityAdjustments()).toEqual({});
  });

  it('computes positive boost when task completed + outcome resolved', () => {
    recordTaskAction('task.spray.tomato', TASK_ACTION.COMPLETED, { crop: 'tomato', region: 'Ashanti' });
    recordScanOutcome('scan_1', OUTCOME.RESOLVED, {
      issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti',
      linkedTaskKey: 'task.spray.tomato',
    });
    const adj = computePriorityAdjustments();
    const bucket = adj['task.spray.tomato|Ashanti'];
    expect(bucket).toBeTruthy();
    expect(bucket.priorityBoost).toBeGreaterThan(0);
  });

  it('computes negative boost when task ignored + outcome worsened', () => {
    recordTaskAction('task.spray.tomato', TASK_ACTION.IGNORED, { region: 'Ashanti' });
    recordScanOutcome('s1', OUTCOME.WORSENED, {
      issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti',
      linkedTaskKey: 'task.spray.tomato',
    });
    const adj = computePriorityAdjustments();
    const bucket = adj['task.spray.tomato|Ashanti'];
    expect(bucket).toBeTruthy();
    expect(bucket.priorityBoost).toBeLessThan(0);
  });

  it('priorityBoost is bounded to ±0.40', () => {
    for (let i = 0; i < 50; i++) {
      // Burn dedupe window with different actions.
      recordTaskAction('task.spam', TASK_ACTION.COMPLETED, {});
      recordScanOutcome('s' + i, OUTCOME.RESOLVED, {
        issueCategory: 'x', crop: 'y', region: 'z',
        linkedTaskKey: 'task.spam',
      });
    }
    const adj = computePriorityAdjustments();
    for (const k of Object.keys(adj)) {
      expect(adj[k].priorityBoost).toBeLessThanOrEqual(0.40);
      expect(adj[k].priorityBoost).toBeGreaterThanOrEqual(-0.40);
    }
  });

  it('applyLearningToTask boosts priority + attaches signal hint', () => {
    recordTaskAction('task.water', TASK_ACTION.COMPLETED, { region: 'Volta' });
    recordScanOutcome('s1', OUTCOME.RESOLVED, {
      issueCategory: 'dry', crop: 'maize', region: 'Volta',
      linkedTaskKey: 'task.water',
    });
    recordScanOutcome('s2', OUTCOME.RESOLVED, {
      issueCategory: 'dry', crop: 'maize', region: 'Volta',
      linkedTaskKey: 'task.water',
    });
    const adj = computePriorityAdjustments();
    const boosted = applyLearningToTask(
      { titleKey: 'task.water', priority: 0.5 }, adj, 'Volta',
    );
    expect(boosted.priority).toBeGreaterThan(0.5);
    expect(boosted.learningSignal).toBeTruthy();
  });

  it('applyLearningToTask is a no-op on garbage input', () => {
    expect(applyLearningToTask(null, {})).toBeNull();
    expect(applyLearningToTask({}, null)).toEqual({});
  });

  it('getLearningSnapshot reports counts', () => {
    recordTaskAction('t.a', TASK_ACTION.COMPLETED, {});
    const snap = getLearningSnapshot();
    expect(snap.actionCount).toBe(1);
    expect(typeof snap.adjustmentCount).toBe('number');
  });

  it('never throws on garbage input', () => {
    expect(() => recordTaskAction(null, null, null)).not.toThrow();
    expect(() => computePriorityAdjustments()).not.toThrow();
    expect(() => applyLearningToTask(undefined, undefined)).not.toThrow();
  });
});

// ─── outcomeAnalytics (NGO) ─────────────────────────

describe('outcomeAnalytics', () => {
  beforeEach(() => {
    _stubLocalStorage();
    clearScanOutcomes();
    clearTaskActions();
  });

  it('interventionEffectiveness returns empty array on empty log', () => {
    expect(interventionEffectiveness()).toEqual([]);
  });

  it('interventionEffectiveness computes per-bucket effectiveness %', () => {
    recordScanOutcome('s1', OUTCOME.RESOLVED,  { issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti' });
    recordScanOutcome('s2', OUTCOME.IMPROVED,  { issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti' });
    recordScanOutcome('s3', OUTCOME.WORSENED,  { issueCategory: 'leaf_spots', crop: 'tomato', region: 'Ashanti' });
    const rows = interventionEffectiveness();
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(3);
    expect(rows[0].effective).toBe(2);
    expect(rows[0].effectivenessPct).toBeCloseTo(66.7, 0);
  });

  it('diseaseReductionTrend reports improving / worsening / stable', () => {
    // Start with 4 worsened, then 4 resolved → improving
    for (let i = 0; i < 4; i++) {
      recordScanOutcome('s' + i, OUTCOME.WORSENED, {
        issueCategory: 'rust', crop: 'maize', region: 'Volta',
      });
    }
    for (let i = 4; i < 8; i++) {
      recordScanOutcome('s' + i, OUTCOME.RESOLVED, {
        issueCategory: 'rust', crop: 'maize', region: 'Volta',
      });
    }
    const rows = diseaseReductionTrend();
    expect(rows.length).toBe(1);
    expect(rows[0].trend).toBe('improving');
  });

  it('farmerEngagement reports KPIs', () => {
    recordTaskAction('t.a', TASK_ACTION.COMPLETED, {});
    recordTaskAction('t.b', TASK_ACTION.IGNORED,   {});
    recordScanOutcome('s1', OUTCOME.RESOLVED, { issueCategory: 'x' });
    const e = farmerEngagement();
    expect(e.scansWithOutcome).toBe(1);
    expect(e.tasksCompleted).toBe(1);
    expect(e.tasksIgnored).toBe(1);
    expect(e.taskCompletionRate).toBe(50);
  });

  it('recoveryOutcomes returns the documented shape', () => {
    recordScanOutcome('s1', OUTCOME.RESOLVED, { issueCategory: 'x' });
    recordScanOutcome('s2', OUTCOME.RESOLVED, { issueCategory: 'x' });
    recordScanOutcome('s3', OUTCOME.WORSENED, { issueCategory: 'x' });
    const r = recoveryOutcomes();
    expect(r.total).toBe(3);
    expect(r.counts.resolved).toBe(2);
    expect(r.pct.resolved).toBeCloseTo(66.7, 0);
  });

  it('regionalCropStress sorts by stress %', () => {
    recordScanOutcome('s1', OUTCOME.WORSENED, { region: 'A', crop: 'tomato', issueCategory: 'x' });
    recordScanOutcome('s2', OUTCOME.WORSENED, { region: 'A', crop: 'tomato', issueCategory: 'x' });
    recordScanOutcome('s3', OUTCOME.RESOLVED, { region: 'B', crop: 'maize',  issueCategory: 'x' });
    recordScanOutcome('s4', OUTCOME.RESOLVED, { region: 'B', crop: 'maize',  issueCategory: 'x' });
    const rows = regionalCropStress();
    expect(rows.length).toBe(2);
    expect(rows[0].region).toBe('A');           // higher stress first
    expect(rows[0].stressPct).toBe(100);
    expect(rows[1].stressPct).toBe(0);
  });

  it('getOutcomeAnalyticsSnapshot returns all five sections', () => {
    recordScanOutcome('s1', OUTCOME.RESOLVED, { issueCategory: 'x', crop: 'y', region: 'z' });
    const snap = getOutcomeAnalyticsSnapshot();
    expect(snap.interventionEffectiveness).toBeTruthy();
    expect(snap.diseaseReductionTrend).toBeTruthy();
    expect(snap.farmerEngagement).toBeTruthy();
    expect(snap.recoveryOutcomes).toBeTruthy();
    expect(snap.regionalCropStress).toBeTruthy();
    expect(typeof snap.generatedAt).toBe('number');
  });

  it('never throws on garbage state', () => {
    expect(() => interventionEffectiveness()).not.toThrow();
    expect(() => diseaseReductionTrend()).not.toThrow();
    expect(() => farmerEngagement()).not.toThrow();
    expect(() => recoveryOutcomes()).not.toThrow();
    expect(() => regionalCropStress()).not.toThrow();
  });
});

// ─── farmMemorySnapshot ─────────────────────────────

describe('farmMemorySnapshot', () => {
  beforeEach(() => {
    _stubLocalStorage();
    clearScanOutcomes();
    clearTaskActions();
  });

  it('getFarmMemorySnapshot returns the documented shape', () => {
    const snap = getFarmMemorySnapshot({ crop: 'tomato', region: 'Ashanti' });
    expect(snap.crop).toBe('tomato');
    expect(snap.region).toBe('Ashanti');
    expect(typeof snap.scanHistorySize).toBe('number');
    expect(typeof snap.outcomesRecordedSize).toBe('number');
    expect(Array.isArray(snap.recurringIssues)).toBe(true);
    expect(typeof snap.activeFlags).toBe('object');
    expect(typeof snap.learningSignal).toBe('object');
  });

  it('reports zero-state cleanly with no data', () => {
    const snap = getFarmMemorySnapshot();
    expect(snap.scanHistorySize).toBe(0);
    expect(snap.outcomesRecordedSize).toBe(0);
    expect(snap.activeFlags.hasRecurringIssue).toBe(false);
    expect(snap.activeFlags.hasWorseningTrend).toBe(false);
  });

  it('flags successful interventions when outcomes include resolved', () => {
    recordScanOutcome('s1', OUTCOME.RESOLVED, { issueCategory: 'x' });
    const snap = getFarmMemorySnapshot();
    expect(snap.activeFlags.hasSuccessfulInterventions).toBe(true);
    expect(snap.resolvedCount).toBe(1);
  });

  it('deriveMemoryGuidance returns an empty array on empty snapshot', () => {
    const snap = getFarmMemorySnapshot();
    expect(deriveMemoryGuidance(snap)).toEqual([]);
  });

  it('deriveMemoryGuidance returns wins hint when resolved without worsening', () => {
    recordScanOutcome('s1', OUTCOME.RESOLVED, { issueCategory: 'x' });
    const snap = getFarmMemorySnapshot();
    const hints = deriveMemoryGuidance(snap);
    expect(hints.some((h) => h.kind === 'wins')).toBe(true);
  });

  it('deriveMemoryGuidance caps at 3 hints', () => {
    // Stack many active flags
    for (let i = 0; i < 10; i++) {
      recordScanOutcome('s' + i, OUTCOME.RESOLVED, { issueCategory: 'x' });
    }
    const snap = getFarmMemorySnapshot();
    expect(deriveMemoryGuidance(snap).length).toBeLessThanOrEqual(3);
  });

  it('every guidance hint has a translation envelope', () => {
    recordScanOutcome('s1', OUTCOME.RESOLVED, { issueCategory: 'x' });
    const snap = getFarmMemorySnapshot();
    for (const h of deriveMemoryGuidance(snap)) {
      expect(typeof h.key).toBe('string');
      expect(typeof h.fallback).toBe('string');
      expect(typeof h.kind).toBe('string');
      expect(['low', 'medium', 'high']).toContain(h.severity);
    }
  });

  it('never throws on garbage input', () => {
    expect(() => getFarmMemorySnapshot(null)).not.toThrow();
    expect(() => getFarmMemorySnapshot('garbage')).not.toThrow();
    expect(() => deriveMemoryGuidance(null)).not.toThrow();
    expect(() => deriveMemoryGuidance(undefined)).not.toThrow();
  });
});
