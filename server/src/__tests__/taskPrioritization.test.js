/**
 * taskPrioritization.test.js — pins the §3 contract:
 *   1. Empty inputs return [].
 *   2. High urgency outranks low urgency at equal everything else.
 *   3. Overdue task outranks future-due task at equal everything else.
 *   4. Weather-matched action gets boosted when a risk fires.
 *   5. Confidence + impact + cost contribute to ordering.
 *   6. Stable sort: equal-score tasks keep original order.
 *   7. topAction returns the first ranked task.
 */

import { describe, it, expect } from 'vitest';
import {
  prioritizeTasks,
  topAction,
  PRIORITY_WEIGHTS,
} from '../../../src/lib/taskPrioritization.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

const makeTask = (overrides = {}) => ({
  id:        'task',
  title:     'do thing',
  urgency:   'medium',
  actionType: 'inspect',
  dueAt:     new Date(NOW + 24 * HOUR).toISOString(),
  ...overrides,
});

describe('prioritizeTasks — contract', () => {
  it('returns [] on empty / garbage input', () => {
    expect(prioritizeTasks(null)).toEqual([]);
    expect(prioritizeTasks([])).toEqual([]);
  });

  it('places high-urgency tasks above low-urgency at equal everything else', () => {
    const r = prioritizeTasks([
      makeTask({ id: 'low',  urgency: 'low' }),
      makeTask({ id: 'high', urgency: 'high' }),
    ], { nowMs: NOW });
    expect(r[0].task.id).toBe('high');
  });

  it('places overdue tasks above future-due tasks at equal urgency', () => {
    const r = prioritizeTasks([
      makeTask({ id: 'future', urgency: 'medium', dueAt: new Date(NOW + 96 * HOUR).toISOString() }),
      makeTask({ id: 'overdue', urgency: 'medium', dueAt: new Date(NOW - 12 * HOUR).toISOString() }),
    ], { nowMs: NOW });
    expect(r[0].task.id).toBe('overdue');
  });

  it('boosts a spray task when a fungal risk is active', () => {
    const ranked = prioritizeTasks([
      makeTask({ id: 'spray',   actionType: 'spray',   urgency: 'medium' }),
      makeTask({ id: 'harvest', actionType: 'harvest', urgency: 'high' }),
    ], {
      nowMs: NOW,
      weatherRisks: [{ kind: 'fungal', level: 'high' }],
    });
    // Without the boost, harvest would win (high urgency). With it,
    // spray jumps ahead.
    expect(ranked[0].task.id).toBe('spray');
    expect(ranked[0].why).toContain('weather_match:fungal');
  });

  it('boosts a drain task on flood signal', () => {
    const r = prioritizeTasks(
      [makeTask({ id: 'drain', actionType: 'drain', urgency: 'medium' })],
      { nowMs: NOW, weatherRisks: [{ kind: 'flood', level: 'medium' }] }
    );
    expect(r[0].why).toContain('weather_match:flood');
  });

  it('uses confidence as a smaller signal', () => {
    const r = prioritizeTasks([
      makeTask({ id: 'low_conf',  urgency: 'medium', confidence: 0.1 }),
      makeTask({ id: 'high_conf', urgency: 'medium', confidence: 0.95 }),
    ], { nowMs: NOW });
    expect(r[0].task.id).toBe('high_conf');
  });

  it('parses string impact tiers', () => {
    const r = prioritizeTasks([
      makeTask({ id: 'a', urgency: 'medium', estimatedImpact: 'low' }),
      makeTask({ id: 'b', urgency: 'medium', estimatedImpact: 'high' }),
    ], { nowMs: NOW });
    expect(r[0].task.id).toBe('b');
  });

  it('keeps stable order for genuinely-tied tasks', () => {
    const r = prioritizeTasks([
      makeTask({ id: 'first',  urgency: 'medium' }),
      makeTask({ id: 'second', urgency: 'medium' }),
    ], { nowMs: NOW });
    expect(r[0].task.id).toBe('first');
    expect(r[1].task.id).toBe('second');
  });

  it('topAction returns the first ranked task or null', () => {
    expect(topAction([])).toBeNull();
    const top = topAction([makeTask({ id: 'a' })], { nowMs: NOW });
    expect(top.task.id).toBe('a');
  });

  it('exposes frozen weights', () => {
    expect(Object.isFrozen(PRIORITY_WEIGHTS)).toBe(true);
    expect(PRIORITY_WEIGHTS.URGENCY).toBeGreaterThan(0);
  });
});
