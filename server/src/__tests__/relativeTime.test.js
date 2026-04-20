/**
 * relativeTime.test.js — pure contract for the trust-signal helper.
 */

import { describe, it, expect } from 'vitest';

import { formatRelativeTime } from '../../../src/lib/time/relativeTime.js';

const NOW = 1_713_600_000_000;

describe('formatRelativeTime', () => {
  it('no timestamp → time.no_activity', () => {
    expect(formatRelativeTime(0, NOW).key).toBe('time.no_activity');
    expect(formatRelativeTime(null, NOW).key).toBe('time.no_activity');
    expect(formatRelativeTime(undefined, NOW).key).toBe('time.no_activity');
  });

  it('< 1 minute → time.just_now', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW).key).toBe('time.just_now');
  });

  it('minutes bucket', () => {
    const p = formatRelativeTime(NOW - 5 * 60 * 1000, NOW);
    expect(p.key).toBe('time.minutes_ago');
    expect(p.vars.n).toBe(5);
  });

  it('hours bucket', () => {
    const p = formatRelativeTime(NOW - 3 * 3600 * 1000, NOW);
    expect(p.key).toBe('time.hours_ago');
    expect(p.vars.n).toBe(3);
  });

  it('days bucket', () => {
    const p = formatRelativeTime(NOW - 9 * 24 * 3600 * 1000, NOW);
    expect(p.key).toBe('time.days_ago');
    expect(p.vars.n).toBe(9);
  });

  it('future timestamps clamp to just_now (never negative)', () => {
    expect(formatRelativeTime(NOW + 60_000, NOW).key).toBe('time.just_now');
  });

  it('fallback string is always populated', () => {
    const p = formatRelativeTime(NOW - 5 * 60 * 1000, NOW);
    expect(typeof p.fallback).toBe('string');
    expect(p.fallback.length).toBeGreaterThan(0);
  });

  it('accepts Date instances', () => {
    const p = formatRelativeTime(new Date(NOW - 60_000 * 2), NOW);
    expect(p.key).toBe('time.minutes_ago');
    expect(p.vars.n).toBe(2);
  });
});
