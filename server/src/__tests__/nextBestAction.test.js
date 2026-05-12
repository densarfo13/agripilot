/**
 * nextBestAction.test.js — pins the §1 contract:
 *   1. Decision priority order is preserved.
 *   2. Returns a stable shape on null / garbage.
 *   3. Falls back to the calm "walk the field" line when there
 *      is genuinely nothing else.
 *   4. dedupeKey is stable per signal so push layers can suppress
 *      repeats.
 */

import { describe, it, expect } from 'vitest';
import { computeNextBestAction } from '../../../src/lib/nextBestAction.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('computeNextBestAction — priority order', () => {
  it('urgent health band wins over everything else', () => {
    const r = computeNextBestAction({
      nowMs: NOW,
      healthScore: { score: 28, band: 'urgent' },
      risks: [{ kind: 'fungal', level: 'high', headline: 'Fungal pressure rising', action: 'Spray copper.' }],
      scanTasks: [{ id: 't1', urgency: 'high', completed: false, dueAt: new Date(NOW - HOUR).toISOString(), title: 'overdue thing' }],
    });
    expect(r.kind).toBe('health_urgent');
    expect(r.urgency).toBe('high');
    expect(r.confidence).toBe('high');
  });

  it('overdue high-urgency task wins over high-level risk', () => {
    const r = computeNextBestAction({
      nowMs: NOW,
      risks: [{ kind: 'fungal', level: 'high', headline: 'Fungal pressure rising', action: 'Spray copper.' }],
      scanTasks: [{ id: 't1', urgency: 'high', completed: false, dueAt: new Date(NOW - HOUR).toISOString(), title: 'Spray copper on lower leaves' }],
    });
    expect(r.kind).toBe('task_overdue_high');
    expect(r.title).toBe('Spray copper on lower leaves');
    expect(r.dedupeKey).toBe('nba_task_t1');
  });

  it('high-level risk wins over top prioritized task', () => {
    const r = computeNextBestAction({
      nowMs: NOW,
      risks: [{ kind: 'fungal', level: 'high', headline: 'Fungal pressure rising', action: 'Spray copper.' }],
      topPrioritizedAction: { task: { id: 't1', title: 'Inspect maize', actionType: 'inspect' } },
    });
    expect(r.kind).toBe('risk_high:fungal');
    expect(r.dedupeKey).toBe('nba_risk_fungal');
    expect(r.actionType).toBe('spray');
  });

  it('top prioritized task wins over medium risk', () => {
    const r = computeNextBestAction({
      nowMs: NOW,
      risks: [{ kind: 'drought', level: 'medium', headline: '7 dry days', action: 'Water at dawn.' }],
      topPrioritizedAction: { task: { id: 't1', title: 'Inspect maize', urgency: 'medium', actionType: 'inspect' } },
    });
    expect(r.kind).toBe('task_top');
    expect(r.title).toBe('Inspect maize');
  });

  it('medium risk wins over worsening pattern', () => {
    const r = computeNextBestAction({
      nowMs: NOW,
      risks: [{ kind: 'drought', level: 'medium', headline: '7 dry days', action: 'Water at dawn.' }],
      pattern: { trend: 'worsening', previous: { daysAgo: 3 } },
    });
    expect(r.kind).toBe('risk_medium:drought');
  });

  it('worsening pattern wins over scan follow-up', () => {
    const r = computeNextBestAction({
      nowMs: NOW,
      pattern: { trend: 'worsening', previous: { daysAgo: 3 } },
      latestScan: { id: 's1', noticed: 'leaf rust', crop: 'maize' },
    });
    expect(r.kind).toBe('pattern_worsening');
  });

  it('scan follow-up surfaces when nothing else fires', () => {
    const r = computeNextBestAction({
      nowMs: NOW,
      latestScan: { id: 's1', noticed: 'leaf rust', crop: 'maize' },
    });
    expect(r.kind).toBe('scan_followup');
    expect(r.title.toLowerCase()).toContain('maize');
  });

  it('falls back to walk-the-field when nothing fires', () => {
    const r = computeNextBestAction({ nowMs: NOW });
    expect(r.kind).toBe('fallback_walk');
    expect(r.urgency).toBe('low');
    expect(r.confidence).toBe('low');
  });

  it('does not throw on null / garbage input', () => {
    expect(() => computeNextBestAction(null)).not.toThrow();
    expect(() => computeNextBestAction({ risks: 'not-array' })).not.toThrow();
    const r = computeNextBestAction(null);
    expect(r).toHaveProperty('kind');
    expect(r).toHaveProperty('title');
    expect(r).toHaveProperty('dedupeKey');
  });
});
