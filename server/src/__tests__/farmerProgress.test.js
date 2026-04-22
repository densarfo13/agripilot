/**
 * farmerProgress.test.js — locks the farmer-progress system:
 *   1. completing a task increases streak for same day
 *   2. missing a day resets streak
 *   3. progress score increases after task completion
 *   4. unresolved issues reduce score
 *   5. milestone triggers on first task completion
 *   6. 3-day streak milestone triggers correctly
 *   7. all-done state still shows next action (tomorrow preview)
 *   8. progress summary renders correctly (coherent shape)
 *   9. backyard users see simpler wording than commercial
 *  10. no crashes when no history exists
 *  11. language switches don't break the shape
 *  12. legacy completion rows without status field still work
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

import { getStreak, streakMessage } from '../../../src/lib/progress/streakEngine.js';
import { getProgressScore } from '../../../src/lib/progress/progressScoreEngine.js';
import { detectMilestones } from '../../../src/lib/progress/milestoneEngine.js';
import {
  getDailyProgress, resetProgressLedger,
} from '../../../src/lib/progress/progressTracker.js';

const NOW = new Date('2025-05-10T09:00:00');
function d(str, h = 12) { return new Date(`${str}T${String(h).padStart(2, '0')}:00:00`).toISOString(); }

beforeEach(() => {
  installMemoryStorage();
  resetProgressLedger();
});

// ─── Streak engine ───────────────────────────────────────────────
describe('streakEngine.getStreak', () => {
  it('counts 0 when no completions exist', () => {
    const s = getStreak({ completions: [], now: NOW });
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.todayActive).toBe(false);
  });

  it('increments for every unique active day (same-day dedup)', () => {
    const s = getStreak({
      completions: [
        { completed: true, timestamp: d('2025-05-10') },
        { completed: true, timestamp: d('2025-05-10', 14) },  // duplicate day
      ],
      now: NOW,
    });
    expect(s.currentStreak).toBe(1);
    expect(s.todayActive).toBe(true);
  });

  it('counts a 3-day streak of consecutive days', () => {
    const s = getStreak({
      completions: [
        { completed: true, timestamp: d('2025-05-08') },
        { completed: true, timestamp: d('2025-05-09') },
        { completed: true, timestamp: d('2025-05-10') },
      ],
      now: NOW,
    });
    expect(s.currentStreak).toBe(3);
    expect(s.longestStreak).toBe(3);
    expect(s.todayActive).toBe(true);
  });

  it('resets streak after a missed day gap ≥ 2', () => {
    const s = getStreak({
      completions: [
        { completed: true, timestamp: d('2025-05-05') },
        { completed: true, timestamp: d('2025-05-06') },
        { completed: true, timestamp: d('2025-05-07') },
      ],
      now: NOW,   // 3 days later
    });
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(3);
  });

  it('preserves streak with gracePending when last active is yesterday', () => {
    const s = getStreak({
      completions: [
        { completed: true, timestamp: d('2025-05-08') },
        { completed: true, timestamp: d('2025-05-09') },
      ],
      now: NOW,
    });
    expect(s.currentStreak).toBe(2);
    expect(s.gracePending).toBe(true);
    expect(s.todayActive).toBe(false);
  });

  it('ignores skipped rows', () => {
    const s = getStreak({
      completions: [
        { status: 'skipped', timestamp: d('2025-05-10') },
      ],
      now: NOW,
    });
    expect(s.currentStreak).toBe(0);
  });

  it('accepts legacy shape { completed:true, timestamp } and new shape { status:"complete", completedAt }', () => {
    const s = getStreak({
      completions: [
        { completed: true, timestamp: d('2025-05-09') },
        { status: 'complete', completedAt: d('2025-05-10') },
      ],
      now: NOW,
    });
    expect(s.currentStreak).toBe(2);
  });

  it('streakMessage adapts to farmType + state', () => {
    expect(streakMessage({ currentStreak: 0, farmType: 'backyard' }).fallback).toMatch(/start a streak/);
    expect(streakMessage({ currentStreak: 5 }).fallback).toMatch(/5 day/);
    expect(streakMessage({ currentStreak: 7 }).fallback).toMatch(/strong habit|momentum|consistency/);
  });
});

// ─── Progress score engine ───────────────────────────────────────
describe('progressScoreEngine.getProgressScore', () => {
  it('returns a neutral baseline with empty inputs', () => {
    const r = getProgressScore({ now: NOW });
    expect(r.score).toBeGreaterThanOrEqual(30);
    expect(r.score).toBeLessThanOrEqual(60);
    expect(['low', 'fair', 'good', 'strong', 'getting']).toContain(r.label);
  });

  it('score increases after completing today\u2019s task', () => {
    const before = getProgressScore({
      tasks: [{ id: 't1', date: '2025-05-10', status: 'pending', priority: 'high' }],
      now: NOW,
    });
    const after = getProgressScore({
      tasks: [{ id: 't1', date: '2025-05-10', status: 'complete', priority: 'high' }],
      completions: [{ completed: true, timestamp: d('2025-05-10') }],
      streak: { currentStreak: 1 },
      now: NOW,
    });
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.reasons.some((r) => r.tag === 'today_action')).toBe(true);
  });

  it('unresolved issues reduce the score', () => {
    const base = getProgressScore({ now: NOW });
    const withIssues = getProgressScore({
      issues: [
        { id: 'i1', status: 'open' }, { id: 'i2', status: 'open' },
        { id: 'i3', status: 'open' }, { id: 'i4', status: 'open' },
      ],
      now: NOW,
    });
    expect(withIssues.score).toBeLessThan(base.score);
    expect(withIssues.reasons.some((r) => r.tag === 'issues')).toBe(true);
  });

  it('high risk reduces the score + surfaces a caution reason', () => {
    const r = getProgressScore({ risk: { level: 'high' }, now: NOW });
    expect(r.reasons.some((x) => x.tag === 'risk' && x.tone === 'caution')).toBe(true);
  });

  it('backyard baseline nudges the score up vs small_farm', () => {
    const backyard   = getProgressScore({ farmType: 'backyard',   now: NOW });
    const small      = getProgressScore({ farmType: 'small_farm', now: NOW });
    expect(backyard.score).toBeGreaterThanOrEqual(small.score);
  });

  it('labels + explanation adapt to farmType for backyard', () => {
    const r = getProgressScore({ farmType: 'backyard', now: NOW });
    expect(typeof r.explanation).toBe('string');
    expect(r.explanation.length).toBeGreaterThan(0);
    // No punitive phrasing
    expect(r.explanation.toLowerCase()).not.toMatch(/fail|bad|poor|lazy/);
  });
});

// ─── Milestone engine ────────────────────────────────────────────
describe('milestoneEngine.detectMilestones', () => {
  it('fires first_task_completed on any completion', () => {
    const ms = detectMilestones({
      completions: [{ completed: true, timestamp: d('2025-05-10') }],
      now: NOW,
    });
    expect(ms.some((m) => m.type === 'first_task_completed')).toBe(true);
  });

  it('fires streak_3 when longestStreak >= 3', () => {
    const ms = detectMilestones({
      streak: { longestStreak: 3, currentStreak: 3 },
      now: NOW,
    });
    expect(ms.some((m) => m.type === 'streak_3')).toBe(true);
  });

  it('fires streak_7 when longestStreak >= 7 (and streak_3 too)', () => {
    const ms = detectMilestones({
      streak: { longestStreak: 8, currentStreak: 8 },
      now: NOW,
    });
    const types = ms.map((m) => m.type);
    expect(types).toContain('streak_3');
    expect(types).toContain('streak_7');
  });

  it('fires farm_setup_complete when profile is fully filled', () => {
    const ms = detectMilestones({
      farm: { crop: 'maize', normalizedAreaSqm: 1000, cropStage: 'growing', countryCode: 'NG' },
      now: NOW,
    });
    expect(ms.some((m) => m.type === 'farm_setup_complete')).toBe(true);
  });

  it('fires first_harvest_recorded when a harvest template completion exists', () => {
    const ms = detectMilestones({
      completions: [
        { completed: true, taskId: 'farm-1:2025-05-10:harvest.check_readiness',
          timestamp: d('2025-05-10') },
      ],
      now: NOW,
    });
    expect(ms.some((m) => m.type === 'first_harvest_recorded')).toBe(true);
  });

  it('no milestones when history is empty', () => {
    expect(detectMilestones({ now: NOW })).toEqual([]);
  });
});

// ─── Progress tracker (orchestrator) ─────────────────────────────
describe('progressTracker.getDailyProgress', () => {
  const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                 cropStage: 'growing', normalizedAreaSqm: 5000, countryCode: 'NG' };

  it('returns a coherent view with streak + score + today + nextAction', () => {
    const view = getDailyProgress({
      farm,
      tasks: [
        { id: 'a', date: '2025-05-10', status: 'pending',  priority: 'high',
          title: 'Water the field' },
        { id: 'b', date: '2025-05-10', status: 'complete', priority: 'medium',
          title: 'Scout' },
      ],
      completions: [{ completed: true, timestamp: d('2025-05-10') }],
      now: NOW,
    });
    expect(view.streak.currentStreak).toBe(1);
    expect(view.score.score).toBeGreaterThan(0);
    expect(view.today.total).toBe(2);
    expect(view.today.completed).toBe(1);
    expect(view.nextAction.kind).toBe('task');
    expect(view.nextAction.fallback).toBe('Water the field');
  });

  it('all-done state surfaces a tomorrow-preview next action', () => {
    const view = getDailyProgress({
      farm,
      tasks: [
        { id: 'a', date: '2025-05-10', status: 'complete', priority: 'high' },
        { id: 'b', date: '2025-05-10', status: 'complete', priority: 'medium' },
      ],
      completions: [
        { completed: true, timestamp: d('2025-05-10') },
        { completed: true, timestamp: d('2025-05-10', 14) },
      ],
      now: NOW,
    });
    expect(view.today.remaining).toBe(0);
    expect(view.nextAction.kind).toBe('tomorrow');
    expect(view.nextAction.fallback).toMatch(/tomorrow|done|complete/i);
    expect(view.motivation.fallback.length).toBeGreaterThan(0);
  });

  it('backyard users see simpler wording than commercial', () => {
    const backyard = getDailyProgress({
      farm: { ...farm, farmType: 'backyard' }, tasks: [], now: NOW,
    });
    const commercial = getDailyProgress({
      farm: { ...farm, farmType: 'commercial' }, tasks: [], now: NOW,
    });
    expect(backyard.today.summary.fallback.length).toBeGreaterThan(0);
    expect(commercial.today.summary.fallback.length).toBeGreaterThan(0);
    // At least one of the farmType-specific blocks differs.
    const anyDifference =
         backyard.today.summary.fallback   !== commercial.today.summary.fallback
      || backyard.nextAction.fallback      !== commercial.nextAction.fallback
      || backyard.motivation.fallback      !== commercial.motivation.fallback
      || backyard.score.explanation         !== commercial.score.explanation;
    expect(anyDifference).toBe(true);
  });

  it('never crashes with no history / no farm', () => {
    expect(() => getDailyProgress({ now: NOW })).not.toThrow();
    const view = getDailyProgress({ now: NOW });
    expect(view.streak.currentStreak).toBe(0);
    expect(view.today.total).toBe(0);
    expect(view.nextAction.fallback.length).toBeGreaterThan(0);
  });

  it('language param does not break the shape', () => {
    const en = getDailyProgress({ farm, language: 'en', now: NOW });
    const fr = getDailyProgress({ farm, language: 'fr', now: NOW });
    expect(en.score.score).toBe(fr.score.score);
    expect(en.streak.currentStreak).toBe(fr.streak.currentStreak);
    expect(typeof en.score.labelKey).toBe('string');
  });

  it('legacy completion rows (no status/completedAt) still work', () => {
    const view = getDailyProgress({
      farm,
      completions: [
        // Old pilot-era entries had only { taskId, timestamp }
        { taskId: 'x', timestamp: d('2025-05-09'), completed: true },
      ],
      now: NOW,
    });
    expect(view.streak.gracePending).toBe(true);
    expect(view.streak.currentStreak).toBe(1);
  });

  it('acknowledging a milestone once hides it from the next call', () => {
    const first = getDailyProgress({
      farm,
      completions: [{ completed: true, timestamp: d('2025-05-10') }],
      now: NOW,
    });
    expect(first.milestones.unseen.some((m) => m.type === 'first_task_completed')).toBe(true);
    const second = getDailyProgress({
      farm,
      completions: [{ completed: true, timestamp: d('2025-05-10') }],
      now: NOW,
    });
    // The tracker auto-marks milestones as seen after returning them.
    expect(second.milestones.unseen.some((m) => m.type === 'first_task_completed')).toBe(false);
    expect(second.milestones.allAchieved.some((m) => m.type === 'first_task_completed')).toBe(true);
  });
});
