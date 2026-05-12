/**
 * scanFollowupSchedule.test.js — pins the §4 contract:
 *   1. Severity tier determines all four cadences.
 *   2. treatmentCheckAt is null when no treatment task is suggested.
 *   3. Unknown severity defaults to 'medium'.
 *   4. Returns stable shape on null / garbage.
 *   5. Healthy scans get a 2-week routine rescan, no monitoring.
 */

import { describe, it, expect } from 'vitest';
import {
  computeScanFollowupSchedule,
  FOLLOWUP_CADENCE,
} from '../../../src/lib/scanFollowupSchedule.js';

const NOW = Date.parse('2026-05-12T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function _daysFromNow(iso) {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Math.round((t - NOW) / DAY);
}

describe('computeScanFollowupSchedule — contract', () => {
  it('high severity → 2-day rescan + 14-day monitor + treatment check + 14-day watch', () => {
    const r = computeScanFollowupSchedule({
      decision: { severityTone: 'high' },
      suggestedTasks: [{ actionType: 'spray', title: 'spray copper' }],
    }, { nowMs: NOW });
    expect(_daysFromNow(r.nextScanAt)).toBe(2);
    expect(r.monitoringDays).toBe(14);
    expect(_daysFromNow(r.treatmentCheckAt)).toBe(3);
    expect(r.outbreakWatchDays).toBe(14);
    expect(r.severity).toBe('high');
  });

  it('medium severity', () => {
    const r = computeScanFollowupSchedule({
      decision: { severityTone: 'medium' },
      suggestedTasks: [{ actionType: 'spray', title: 'spray' }],
    }, { nowMs: NOW });
    expect(_daysFromNow(r.nextScanAt)).toBe(4);
    expect(r.monitoringDays).toBe(10);
    expect(_daysFromNow(r.treatmentCheckAt)).toBe(5);
  });

  it('low severity → 7-day rescan, no treatment check or outbreak watch', () => {
    const r = computeScanFollowupSchedule({
      decision: { severityTone: 'low' },
      suggestedTasks: [{ actionType: 'spray', title: 'spray' }],
    }, { nowMs: NOW });
    expect(_daysFromNow(r.nextScanAt)).toBe(7);
    expect(r.treatmentCheckAt).toBeNull();
    expect(r.outbreakWatchDays).toBeNull();
  });

  it('healthy → 2-week routine rescan, no monitoring window', () => {
    const r = computeScanFollowupSchedule({
      decision: { severityTone: 'healthy' },
    }, { nowMs: NOW });
    expect(_daysFromNow(r.nextScanAt)).toBe(14);
    expect(r.monitoringDays).toBe(0);
  });

  it('treatmentCheckAt is null when no treatment task is suggested', () => {
    const r = computeScanFollowupSchedule({
      decision: { severityTone: 'high' },
      suggestedTasks: [{ actionType: 'inspect', title: 'check' }],
    }, { nowMs: NOW });
    expect(r.treatmentCheckAt).toBeNull();
  });

  it('falls back to medium severity for unknown severity strings', () => {
    const r = computeScanFollowupSchedule({
      decision: { severityTone: 'totally_made_up' },
    }, { nowMs: NOW });
    expect(_daysFromNow(r.nextScanAt)).toBe(4);
  });

  it('does not throw on null / garbage', () => {
    expect(() => computeScanFollowupSchedule(null)).not.toThrow();
    expect(() => computeScanFollowupSchedule({})).not.toThrow();
    const r = computeScanFollowupSchedule(null, { nowMs: NOW });
    expect(r).toHaveProperty('nextScanAt');
    expect(r).toHaveProperty('monitoringDays');
  });

  it('exposes frozen cadence table', () => {
    expect(Object.isFrozen(FOLLOWUP_CADENCE)).toBe(true);
    expect(Object.isFrozen(FOLLOWUP_CADENCE.high)).toBe(true);
  });
});
