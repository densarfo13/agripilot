/**
 * taskBuckets.test.js — pins the §3 contract:
 *   1. Empty input → empty buckets.
 *   2. Overdue / high-urgency / due-within-24h → Do now.
 *   3. Low-urgency or follow-up → Monitor.
 *   4. Medium urgency + due in 1-7 days → This week.
 *   5. Due > 7 days out → Monitor (don't ask the user to think yet).
 *   6. Completed tasks are excluded.
 *   7. Within each bucket: due-soonest first, then higher urgency.
 */

import { describe, it, expect } from 'vitest';
import { bucketTasks, totalOpenTaskCount } from '../../../src/lib/taskBuckets.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY  = 24 * HOUR;

const t = (overrides = {}) => ({
  id: 'task',
  title: 'thing',
  urgency: 'medium',
  completed: false,
  ...overrides,
});

describe('bucketTasks — contract', () => {
  it('returns empty buckets on empty input', () => {
    const r = bucketTasks([]);
    expect(r.doNow).toEqual([]);
    expect(r.thisWeek).toEqual([]);
    expect(r.monitor).toEqual([]);
  });

  it('does not throw on garbage', () => {
    expect(() => bucketTasks(null)).not.toThrow();
    expect(() => bucketTasks('not-array')).not.toThrow();
  });

  it('puts overdue tasks in Do now', () => {
    const r = bucketTasks([t({ id: 'a', dueAt: new Date(NOW - 5 * HOUR).toISOString() })], { nowMs: NOW });
    expect(r.doNow.map((x) => x.id)).toEqual(['a']);
  });

  it('puts high-urgency tasks in Do now even if due-date is far', () => {
    const r = bucketTasks([t({ id: 'a', urgency: 'high', dueAt: new Date(NOW + 5 * DAY).toISOString() })], { nowMs: NOW });
    expect(r.doNow.map((x) => x.id)).toEqual(['a']);
  });

  it('puts due-within-24h tasks in Do now', () => {
    const r = bucketTasks([t({ id: 'a', dueAt: new Date(NOW + 6 * HOUR).toISOString() })], { nowMs: NOW });
    expect(r.doNow.map((x) => x.id)).toEqual(['a']);
  });

  it('puts low-urgency tasks in Monitor', () => {
    const r = bucketTasks([t({ id: 'a', urgency: 'low' })], { nowMs: NOW });
    expect(r.monitor.map((x) => x.id)).toEqual(['a']);
  });

  it('puts follow-up re-check tasks in Monitor regardless of urgency', () => {
    const r = bucketTasks([t({ id: 'a', urgency: 'medium', isFollowUp: true })], { nowMs: NOW });
    expect(r.monitor.map((x) => x.id)).toEqual(['a']);
  });

  it('puts medium-urgency tasks due in the next 7 days in This week', () => {
    const r = bucketTasks([t({ id: 'a', dueAt: new Date(NOW + 3 * DAY).toISOString() })], { nowMs: NOW });
    expect(r.thisWeek.map((x) => x.id)).toEqual(['a']);
  });

  it('puts tasks due > 7 days out in Monitor', () => {
    const r = bucketTasks([t({ id: 'a', dueAt: new Date(NOW + 14 * DAY).toISOString() })], { nowMs: NOW });
    expect(r.monitor.map((x) => x.id)).toEqual(['a']);
  });

  it('excludes completed tasks', () => {
    const r = bucketTasks([t({ id: 'a', completed: true })], { nowMs: NOW });
    expect(totalOpenTaskCount(r)).toBe(0);
  });

  it('within each bucket, sorts due-soonest first', () => {
    const r = bucketTasks([
      t({ id: 'later',  dueAt: new Date(NOW + 5 * DAY).toISOString() }),
      t({ id: 'sooner', dueAt: new Date(NOW + 2 * DAY).toISOString() }),
    ], { nowMs: NOW });
    expect(r.thisWeek.map((x) => x.id)).toEqual(['sooner', 'later']);
  });

  it('totalOpenTaskCount adds up correctly', () => {
    const r = bucketTasks([
      t({ id: 'a', urgency: 'high' }),
      t({ id: 'b', dueAt: new Date(NOW + 3 * DAY).toISOString() }),
      t({ id: 'c', urgency: 'low' }),
    ], { nowMs: NOW });
    expect(totalOpenTaskCount(r)).toBe(3);
  });
});
