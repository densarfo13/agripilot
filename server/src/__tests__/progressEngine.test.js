/**
 * progressEngine.test.js — deterministic contract for the Progress Engine.
 *
 * Covers the spec §11 checklist:
 *   1. score increases when a task is completed
 *   2. score decreases when overdue + nothing done
 *   3. status band transitions are correct
 *   4. nextBestAction returns the first incomplete task
 *   5. all-complete returns a bridge action (never empty)
 *   6. pure / offline — no IO, inputs in → snapshot out
 */

import { describe, it, expect } from 'vitest';

import {
  computeProgress,
  getNextBestAction,
  STATUS,
  STATUS_LABEL_KEY,
} from '../../../src/lib/progress/progressEngine.js';

// ─── Fixtures ──────────────────────────────────────────────────────
const TODAY = new Date('2026-04-20T10:00:00Z').getTime();
const YESTERDAY = TODAY - 24 * 3600 * 1000;

function mkTask(id, extras = {}) {
  return { id: String(id), title: `Task ${id}`, ...extras };
}

function mkCompletion(taskId, ts = TODAY) {
  return { taskId: String(taskId), farmId: 'f1', completed: true, timestamp: ts };
}

// ─── 1. Score increases when tasks are completed ─────────────────
describe('computeProgress — score grows with completions', () => {
  it('0 of N gives a low / zero score', () => {
    const snap = computeProgress({
      tasks: [mkTask(1), mkTask(2), mkTask(3)],
      completions: [],
      now: TODAY,
    });
    expect(snap.progressScore).toBe(0);
    expect(snap.completedCount).toBe(0);
    expect(snap.totalCount).toBe(3);
  });

  it('completing a task raises the score (delta test)', () => {
    const before = computeProgress({
      tasks: [mkTask(1), mkTask(2)],
      completions: [],
      now: TODAY,
    });
    const after  = computeProgress({
      tasks: [mkTask(1), mkTask(2)],
      completions: [mkCompletion(1, TODAY)],
      now: TODAY,
    });
    expect(after.progressScore).toBeGreaterThan(before.progressScore);
    expect(after.completedCount).toBe(1);
  });

  it('completing all tasks gives a high score', () => {
    const snap = computeProgress({
      tasks: [mkTask(1), mkTask(2)],
      completions: [mkCompletion(1, TODAY), mkCompletion(2, TODAY)],
      stageCompletionPercent: 80,
      now: TODAY,
    });
    // base 60 + today-bonus 15 + stage>=70 15 = 90
    expect(snap.progressScore).toBe(90);
    expect(snap.status).toBe(STATUS.ON_TRACK);
  });
});

// ─── 2. Overdue + no action penalises ────────────────────────────
describe('computeProgress — penalties', () => {
  it('overdue task + no completions today → -20 penalty', () => {
    const snap = computeProgress({
      tasks: [mkTask(1, { overdue: true }), mkTask(2)],
      completions: [],
      now: TODAY,
    });
    // base 0, bonus 0, penalty -20, clamp(>=0) → 0
    expect(snap.progressScore).toBe(0);
    expect(snap.status).toBe(STATUS.HIGH_RISK);
  });

  it('overdue task but completed today: no overdue penalty', () => {
    const snap = computeProgress({
      tasks: [mkTask(1, { overdue: true }), mkTask(2)],
      completions: [mkCompletion(1, TODAY)],
      now: TODAY,
    });
    // base 30 + today-bonus 10 + stage 8 (50% via completedCount) = 48
    expect(snap.progressScore).toBeGreaterThan(30);
  });

  it('two "not helpful" feedback entries cap at -10', () => {
    const snap = computeProgress({
      tasks: [mkTask(1), mkTask(2)],
      completions: [mkCompletion(1, TODAY), mkCompletion(2, TODAY)],
      feedback: [
        { taskId: '1', feedback: 'no', timestamp: TODAY },
        { taskId: '2', feedback: 'no', timestamp: TODAY },
        { taskId: '2', feedback: 'no', timestamp: TODAY },
      ],
      stageCompletionPercent: 100,
      now: TODAY,
    });
    // base 60 + today 15 + stage 15 - 10 = 80
    expect(snap.progressScore).toBe(80);
    expect(snap.status).toBe(STATUS.ON_TRACK);
  });
});

// ─── 3. Status band transitions ──────────────────────────────────
describe('computeProgress — status bands', () => {
  it('≥ 70 → on_track', () => {
    const snap = computeProgress({
      tasks: [mkTask(1), mkTask(2)],
      completions: [mkCompletion(1, TODAY), mkCompletion(2, TODAY)],
      stageCompletionPercent: 80,
      now: TODAY,
    });
    expect(snap.progressScore).toBeGreaterThanOrEqual(70);
    expect(snap.status).toBe(STATUS.ON_TRACK);
  });

  it('40..69 → slight_delay', () => {
    const snap = computeProgress({
      tasks: [mkTask(1), mkTask(2), mkTask(3)],
      completions: [mkCompletion(1, TODAY)],
      now: TODAY,
    });
    // base 20 + today 10 + stage 8 (33%→wait 20 actually 33% under 40, so no stage bonus)
    // Actually: completedCount/totalCount = 33%, stage bonus needs ≥40 → 0
    // base 20 + today 10 = 30 → high_risk; adjust inputs
    // Use explicit stage percent to land in the band:
    const s2 = computeProgress({
      tasks: [mkTask(1), mkTask(2), mkTask(3)],
      completions: [mkCompletion(1, TODAY)],
      stageCompletionPercent: 60,
      now: TODAY,
    });
    // base 20 + today 10 + stage 8 = 38 (still high_risk) → raise today count
    const s3 = computeProgress({
      tasks: [mkTask(1), mkTask(2), mkTask(3)],
      completions: [mkCompletion(1, TODAY), mkCompletion(2, TODAY)],
      stageCompletionPercent: 60,
      now: TODAY,
    });
    // base 40 + today 15 + stage 8 = 63 → slight_delay
    expect(s3.status).toBe(STATUS.SLIGHT_DELAY);
    // and the first attempt is still the documented "anywhere < 40"
    expect(snap.status).toBe(STATUS.HIGH_RISK);
    expect(s2.status).toBe(STATUS.HIGH_RISK);
  });

  it('< 40 → high_risk', () => {
    const snap = computeProgress({
      tasks: [mkTask(1), mkTask(2)],
      completions: [],
      now: TODAY,
    });
    expect(snap.status).toBe(STATUS.HIGH_RISK);
  });

  it('status label keys exist for every status', () => {
    expect(STATUS_LABEL_KEY[STATUS.ON_TRACK]).toBe('progress.on_track');
    expect(STATUS_LABEL_KEY[STATUS.SLIGHT_DELAY]).toBe('progress.slight_delay');
    expect(STATUS_LABEL_KEY[STATUS.HIGH_RISK]).toBe('progress.high_risk');
  });
});

// ─── 4. nextBestAction returns the first incomplete task ─────────
describe('getNextBestAction', () => {
  it('returns the first incomplete task', () => {
    const action = getNextBestAction(
      [mkTask(1), mkTask(2), mkTask(3)],
      [mkCompletion(1, TODAY)],
    );
    expect(action.kind).toBe('task');
    expect(action.taskId).toBe('2');
  });

  it('priority high goes first even when listed later', () => {
    const action = getNextBestAction(
      [mkTask(1, { priority: 'normal' }), mkTask(2, { priority: 'high' })],
      [],
    );
    expect(action.kind).toBe('task');
    expect(action.taskId).toBe('2');
  });

  // ─── 5. All complete → bridge action, never empty ────────────
  it('all complete → bridge action (check_tomorrow)', () => {
    const action = getNextBestAction(
      [mkTask(1), mkTask(2)],
      [mkCompletion(1, TODAY), mkCompletion(2, TODAY)],
    );
    expect(action.kind).toBe('bridge');
    expect(action.taskId).toBeNull();
    expect(action.bridgeKey).toBe('progress.check_tomorrow');
  });

  it('all complete + deep stage progress → prepare_next_stage bridge', () => {
    const action = getNextBestAction(
      [mkTask(1)],
      [mkCompletion(1, TODAY)],
      { stageCompletionPercent: 90 },
    );
    expect(action.bridgeKey).toBe('progress.prepare_next_stage');
  });

  it('empty task list + no completions → still returns a bridge', () => {
    const action = getNextBestAction([], []);
    expect(action.kind).toBe('bridge');
    expect(action.bridgeKey).toBeTruthy();
  });
});

// ─── 6. computeProgress is pure ──────────────────────────────────
describe('computeProgress — purity and safety', () => {
  it('same inputs → same output', () => {
    const args = {
      tasks: [mkTask(1), mkTask(2)],
      completions: [mkCompletion(1, TODAY)],
      stageCompletionPercent: 50,
      now: TODAY,
    };
    const a = computeProgress(args);
    const b = computeProgress(args);
    expect(a).toEqual(b);
  });

  it('output and nextBestAction are frozen', () => {
    const snap = computeProgress({ tasks: [], completions: [] });
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.nextBestAction)).toBe(true);
  });

  it('handles null / undefined inputs safely', () => {
    const snap = computeProgress();
    expect(snap.progressScore).toBe(0);
    expect(snap.status).toBe(STATUS.HIGH_RISK);
    expect(snap.totalCount).toBe(0);
    expect(snap.completedCount).toBe(0);
    expect(snap.nextBestAction.kind).toBe('bridge');
  });

  it('score is clamped to [0, 100]', () => {
    const allDone = computeProgress({
      tasks: [mkTask(1)],
      completions: [mkCompletion(1, TODAY)],
      stageCompletionPercent: 100,
      feedback: [],
      now: TODAY,
    });
    // base 60 + today 10 + stage 15 = 85 ≤ 100
    expect(allDone.progressScore).toBeLessThanOrEqual(100);

    const catastrophic = computeProgress({
      tasks: [mkTask(1, { overdue: true })],
      completions: [],
      feedback: [
        { taskId: '1', feedback: 'no' }, { taskId: '1', feedback: 'no' },
        { taskId: '1', feedback: 'no' }, { taskId: '1', feedback: 'no' },
      ],
      now: TODAY,
    });
    expect(catastrophic.progressScore).toBeGreaterThanOrEqual(0);
  });

  it('completedTodayCount only counts same-day timestamps', () => {
    const snap = computeProgress({
      tasks: [mkTask(1), mkTask(2)],
      completions: [mkCompletion(1, YESTERDAY), mkCompletion(2, TODAY)],
      now: TODAY,
    });
    expect(snap.completedTodayCount).toBe(1);
  });
});
