/**
 * alertCandidates.test.js — pins the §7 contract:
 *   1. Empty inputs → no alerts (never spammed).
 *   2. High risk → IMPORTANT alert with action body.
 *   3. Medium risk → NORMAL alert.
 *   4. Overdue high-urgency task → IMPORTANT.
 *   5. ≥3 pending tasks → NORMAL queue alert.
 *   6. Pattern recurrence ≥3 → NORMAL.
 *   7. Improving trend → LOW (positive reinforcement only).
 *   8. Cap at 5 alerts so a bad day doesn't carpet-bomb.
 *   9. Stable dedupeKey per signal kind.
 */

import { describe, it, expect } from 'vitest';
import { buildAlertCandidates, ALERT_LEVELS } from '../../../src/lib/alertCandidates.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;

describe('buildAlertCandidates — contract', () => {
  it('returns [] on empty / null input', () => {
    expect(buildAlertCandidates({})).toEqual([]);
    expect(buildAlertCandidates(null)).toEqual([]);
  });

  it('never throws on garbage input', () => {
    expect(() => buildAlertCandidates({ risks: 'string' })).not.toThrow();
  });

  it('emits IMPORTANT for a high-level risk', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      risks: [{ kind: 'fungal', level: 'high', headline: 'Fungal pressure rising.', action: 'Delay irrigation.' }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].level).toBe(ALERT_LEVELS.IMPORTANT);
    expect(r[0].kind).toBe('risk:fungal');
    expect(r[0].title).toBe('Fungal pressure rising.');
    expect(r[0].body).toBe('Delay irrigation.');
    expect(r[0].dedupeKey).toBe('risk_fungal');
  });

  it('emits NORMAL for a medium-level risk', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      risks: [{ kind: 'drought', level: 'medium', headline: '7 days without rain.', action: 'Water at dawn.' }],
    });
    expect(r[0].level).toBe(ALERT_LEVELS.NORMAL);
  });

  it('drops low-level risks (never spammed for non-actionable)', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      risks: [{ kind: 'fungal', level: 'low', headline: 'Low risk.', action: '...' }],
    });
    expect(r).toHaveLength(0);
  });

  it('emits IMPORTANT for overdue high-urgency task', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      scanTasks: [{
        id: 't1',
        urgency: 'high',
        completed: false,
        title: 'Spray copper today',
        dueAt: new Date(NOW - 6 * HOUR).toISOString(),
      }],
    });
    expect(r[0].kind).toBe('task:overdue_high');
    expect(r[0].level).toBe(ALERT_LEVELS.IMPORTANT);
  });

  it('does NOT alert on a not-yet-due high-urgency task', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      scanTasks: [{ id: 't1', urgency: 'high', completed: false, dueAt: new Date(NOW + 48 * HOUR).toISOString() }],
    });
    expect(r.find((a) => a.kind === 'task:overdue_high')).toBeUndefined();
  });

  it('emits NORMAL queue alert at 3+ pending tasks', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      scanTasks: [
        { completed: false }, { completed: false }, { completed: false },
      ],
    });
    expect(r.find((a) => a.kind === 'task:queue_growing')).toBeDefined();
  });

  it('emits NORMAL for pattern recurrence count >= 3', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      pattern: { recurrence: { count: 4, issue: 'leaf rust' }, trend: 'stable' },
    });
    const rec = r.find((a) => a.kind === 'pattern:recurrence');
    expect(rec).toBeDefined();
    expect(rec.level).toBe(ALERT_LEVELS.NORMAL);
    expect(rec.dedupeKey).toBe('pattern_recurrence_leaf rust');
  });

  it('emits LOW for an improving trend (positive reinforcement only)', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      pattern: { trend: 'improving', recurrence: { count: 0 } },
    });
    const imp = r.find((a) => a.kind === 'pattern:improving');
    expect(imp).toBeDefined();
    expect(imp.level).toBe(ALERT_LEVELS.LOW);
  });

  it('emits IMPORTANT for an urgent farm health band', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      healthScore: { score: 28, band: 'urgent' },
    });
    const h = r.find((a) => a.kind === 'health:urgent');
    expect(h).toBeDefined();
    expect(h.level).toBe(ALERT_LEVELS.IMPORTANT);
    expect(h.title).toContain('28/100');
  });

  it('caps at 5 alerts even on a very bad day', () => {
    const r = buildAlertCandidates({
      nowMs: NOW,
      risks: [
        { kind: 'fungal',   level: 'high',   headline: 'A', action: 'a' },
        { kind: 'drought',  level: 'high',   headline: 'B', action: 'b' },
        { kind: 'heat',     level: 'high',   headline: 'C', action: 'c' },
        { kind: 'flood',    level: 'medium', headline: 'D', action: 'd' },
      ],
      scanTasks: [
        { id: 't1', urgency: 'high', completed: false, dueAt: new Date(NOW - HOUR).toISOString() },
        { completed: false }, { completed: false }, { completed: false },
      ],
      pattern:     { recurrence: { count: 5, issue: 'x' }, trend: 'worsening' },
      healthScore: { score: 20, band: 'urgent' },
    });
    expect(r.length).toBeLessThanOrEqual(5);
    // IMPORTANT alerts should sort first.
    expect(r[0].level).toBe(ALERT_LEVELS.IMPORTANT);
  });

  it('ALERT_LEVELS is frozen', () => {
    expect(Object.isFrozen(ALERT_LEVELS)).toBe(true);
  });
});
