/**
 * nextBestActionNormalizer.test.js — pins the production-trust spec's
 * 9-field contract:
 *   1. Returns the exact 9 fields.
 *   2. Accepts engine return shape OR snapshot shape.
 *   3. Returns null on garbage / missing input.
 *   4. confidenceTone is plain language ("Possible …" / "Likely …"),
 *      never a percentage.
 *   5. Risk kinds map to weather/sprayable bestTimes; scan kinds
 *      map to the scan route.
 *   6. fallback_walk yields no ctaLabel / ctaRoute (calm fallback).
 *   7. estimatedMinutes is a number when actionType is known, null otherwise.
 *   8. sourceContext is a small tag set (no raw NDVI / model JSON).
 */

import { describe, it, expect } from 'vitest';
import { normalizeNextBestAction } from '../../../src/lib/nextBestActionNormalizer.js';

describe('normalizeNextBestAction — contract', () => {
  it('returns null on null / non-object / missing kind', () => {
    expect(normalizeNextBestAction(null)).toBeNull();
    expect(normalizeNextBestAction(undefined)).toBeNull();
    expect(normalizeNextBestAction('not an object')).toBeNull();
    expect(normalizeNextBestAction({})).toBeNull();
  });

  it('accepts the engine return shape directly', () => {
    const r = normalizeNextBestAction({
      kind: 'task_top',
      title: 'Inspect maize',
      reason: 'Top priority by urgency + dueAt.',
      urgency: 'medium',
      confidence: 'medium',
      hint: 'Walk the field',
      actionType: 'inspect',
    });
    expect(r).not.toBeNull();
    expect(r.noticed).toBe('Inspect maize');
    expect(r.meaning).toBe('Top priority by urgency + dueAt.');
    expect(r.action).toBe('Walk the field');
  });

  it('accepts a snapshot shape (reads from .nextBestAction)', () => {
    const r = normalizeNextBestAction({
      nextBestAction: {
        kind: 'fallback_walk',
        title: 'Walk the field and notice anything new',
        reason: 'No urgent signals today.',
        urgency: 'low',
        confidence: 'low',
        actionType: 'inspect',
      },
    });
    expect(r).not.toBeNull();
    expect(r.noticed).toBe('No urgent signals.');
    expect(r.confidenceTone).toBe('Calm signal');
  });

  it('returns ALL 9 spec fields', () => {
    const r = normalizeNextBestAction({
      kind: 'risk_high:fungal',
      title: 'High humidity raises fungal risk',
      reason: 'Weather + crop signals agree.',
      hint: 'Delay irrigation until evening',
      actionType: 'spray',
      confidence: 'medium',
    });
    expect(Object.keys(r).sort()).toEqual([
      'action', 'bestTime', 'confidenceTone', 'ctaLabel', 'ctaRoute',
      'estimatedMinutes', 'meaning', 'noticed', 'sourceContext',
    ]);
  });

  it('confidenceTone never returns a percentage or raw word', () => {
    const cases = [
      { kind: 'health_urgent', confidence: 'high' },
      { kind: 'task_overdue_high', confidence: 'high' },
      { kind: 'risk_medium:drought', confidence: 'medium' },
      { kind: 'pattern_worsening', confidence: 'medium' },
      { kind: 'scan_followup', confidence: 'medium' },
      { kind: 'fallback_walk', confidence: 'low' },
    ];
    for (const c of cases) {
      const r = normalizeNextBestAction({ ...c, title: 't', reason: 'r', actionType: 'inspect' });
      expect(r.confidenceTone).not.toMatch(/\d+%/);
      expect(r.confidenceTone).not.toBe('high');
      expect(r.confidenceTone).not.toBe('medium');
      expect(r.confidenceTone).not.toBe('low');
    }
  });

  it('low-confidence engine output reads as "Possible" not certainty', () => {
    const r = normalizeNextBestAction({
      kind: 'task_top',
      title: 'Inspect maize',
      reason: '...',
      actionType: 'inspect',
      confidence: 'low',
    });
    expect(r.confidenceTone.toLowerCase()).toMatch(/possible/);
  });

  it('risk_high:fungal → CTA goes to /today + bestTime mentions evening', () => {
    const r = normalizeNextBestAction({
      kind: 'risk_high:fungal',
      title: 'Fungal pressure',
      reason: '...',
      actionType: 'spray',
      confidence: 'medium',
    });
    expect(r.ctaRoute).toBe('/today');
    expect(r.bestTime.toLowerCase()).toMatch(/evening/);
  });

  it('scan_followup → CTA goes to /scan with "Rescan" label', () => {
    const r = normalizeNextBestAction({
      kind: 'scan_followup',
      title: 'Re-check the maize',
      reason: '...',
      actionType: 'inspect',
    });
    expect(r.ctaRoute).toBe('/scan');
    expect(r.ctaLabel).toBe('Rescan');
  });

  it('fallback_walk yields no CTA (calm fallback, nothing to push)', () => {
    const r = normalizeNextBestAction({
      kind: 'fallback_walk',
      title: 'Walk the field',
      reason: '...',
      actionType: 'inspect',
    });
    expect(r.ctaLabel).toBeNull();
    expect(r.ctaRoute).toBeNull();
  });

  it('estimatedMinutes is a number for known actionTypes', () => {
    expect(normalizeNextBestAction({
      kind: 'task_top', title: 't', reason: 'r', actionType: 'spray',
    }).estimatedMinutes).toBeTypeOf('number');
    expect(normalizeNextBestAction({
      kind: 'task_top', title: 't', reason: 'r', actionType: 'inspect',
    }).estimatedMinutes).toBeTypeOf('number');
  });

  it('estimatedMinutes is null for unknown actionType', () => {
    const r = normalizeNextBestAction({
      kind: 'task_top', title: 't', reason: 'r', actionType: 'totally_unknown',
    });
    expect(r.estimatedMinutes).toBeNull();
  });

  it('sourceContext is a small tag set, never raw payloads', () => {
    const r = normalizeNextBestAction({
      kind: 'risk_high:fungal',
      title: 't', reason: 'r', actionType: 'spray',
    });
    expect(r.sourceContext).toEqual(['weather']);
    expect(Array.isArray(r.sourceContext)).toBe(true);
  });

  it('task signals tag sourceContext as "tasks"', () => {
    const r = normalizeNextBestAction({
      kind: 'task_overdue_high', title: 't', reason: 'r', actionType: 'inspect',
    });
    expect(r.sourceContext).toContain('tasks');
  });

  it('pattern signals tag sourceContext as "scan"', () => {
    const r = normalizeNextBestAction({
      kind: 'pattern_worsening', title: 't', reason: 'r', actionType: 'inspect',
    });
    expect(r.sourceContext).toContain('scan');
  });
});
