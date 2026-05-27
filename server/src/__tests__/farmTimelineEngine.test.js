/**
 * farmTimelineEngine.test.js — unified farm event timeline.
 */

import { describe, it, expect } from 'vitest';

import {
  buildFarmTimeline, EVENT_KIND, _internal,
} from '../../../src/core/journal/farmTimelineEngine.js';

describe('buildFarmTimeline — envelope shape', () => {
  it('empty input returns the empty timeline', () => {
    const v = buildFarmTimeline({});
    expect(v.engineVersion).toBe('farm-timeline-v1');
    expect(Array.isArray(v.events)).toBe(true);
    expect(v.events.length).toBe(0);
    expect(Array.isArray(v.bucketsByDay)).toBe(true);
  });

  it('garbage never throws', () => {
    expect(() => buildFarmTimeline(null)).not.toThrow();
    expect(() => buildFarmTimeline(undefined)).not.toThrow();
    expect(() => buildFarmTimeline('string')).not.toThrow();
  });
});

describe('buildFarmTimeline — event types', () => {
  const now = Date.now();
  const oneHrAgo = now - (60 * 60 * 1000);
  const oneDayAgo = now - (24 * 60 * 60 * 1000);

  it('normalizes scan entries', () => {
    const v = buildFarmTimeline({
      scanHistory: [{
        id: 's1', createdAt: oneHrAgo,
        diseasePrediction: 'leaf spot',
        severity: 'moderate',
      }],
    });
    expect(v.events.length).toBe(1);
    expect(v.events[0].kind).toBe(EVENT_KIND.SCAN);
    expect(v.events[0].severity).toBe('moderate');
  });

  it('normalizes scan outcomes to RECOVERY when resolved/improved', () => {
    const v = buildFarmTimeline({
      scanOutcomes: [
        { scanId: 'a', outcome: 'resolved', recordedAt: oneHrAgo },
        { scanId: 'b', outcome: 'worsened', recordedAt: oneHrAgo },
      ],
    });
    const kinds = v.events.map((e) => e.kind);
    expect(kinds).toContain(EVENT_KIND.RECOVERY);
    expect(kinds).toContain(EVENT_KIND.SCAN_OUTCOME);
  });

  it('normalizes weather events with severity', () => {
    const v = buildFarmTimeline({
      weatherEvents: [{ type: 'frost', atMs: oneHrAgo }],
    });
    expect(v.events[0].kind).toBe(EVENT_KIND.WEATHER);
    expect(v.events[0].severity).toBe('serious');
  });

  it('normalizes completed tasks', () => {
    const v = buildFarmTimeline({
      completedTasks: [{ id: 't1', label: 'Watering', completedAt: oneHrAgo }],
    });
    expect(v.events[0].kind).toBe(EVENT_KIND.TASK_DONE);
    // Envelope: fallback is the template, params carries the value.
    expect(v.events[0].label.params.label).toBe('Watering');
  });

  it('normalizes harvest milestones', () => {
    const v = buildFarmTimeline({
      harvestEvents: [{ crop: 'tomato', atMs: oneHrAgo, quantity: '5kg' }],
    });
    expect(v.events[0].kind).toBe(EVENT_KIND.HARVEST);
    expect(v.events[0].detail.params.qty).toBe('5kg');
  });

  it('normalizes decisions', () => {
    const v = buildFarmTimeline({
      decisions: [{
        generatedAt: oneHrAgo,
        oneBestAction: { key: 'decision.action.x', fallback: 'Do X' },
        reason:        { key: 'r', fallback: 'why' },
      }],
    });
    expect(v.events[0].kind).toBe(EVENT_KIND.DECISION);
    expect(v.events[0].label.fallback).toBe('Do X');
  });

  it('orders newest first', () => {
    const v = buildFarmTimeline({
      scanHistory: [
        { id: 'old', createdAt: oneDayAgo },
        { id: 'new', createdAt: oneHrAgo },
      ],
    });
    expect(v.events[0].id).toBe('new');
    expect(v.events[1].id).toBe('old');
  });

  it('caps to limit', () => {
    const many = [];
    for (let i = 0; i < 100; i++) {
      many.push({ id: 'x' + i, createdAt: now - (i * 1000) });
    }
    const v = buildFarmTimeline({ scanHistory: many, limit: 25 });
    expect(v.events.length).toBe(25);
  });

  it('buckets events by day', () => {
    const v = buildFarmTimeline({
      scanHistory: [
        { id: 'a', createdAt: oneHrAgo },
        { id: 'b', createdAt: oneDayAgo },
      ],
    });
    expect(v.bucketsByDay.length).toBeGreaterThanOrEqual(1);
    expect(typeof v.bucketsByDay[0].day).toBe('string');
  });

  it('drops entries with no timestamp', () => {
    const v = buildFarmTimeline({
      scanHistory: [{ id: 'no_ts' }, { id: 'has', createdAt: oneHrAgo }],
    });
    expect(v.events.length).toBe(1);
  });
});

describe('_internal normalizers', () => {
  it('_ymd produces yyyy-mm-dd', () => {
    const d = new Date('2026-05-26T12:00:00Z');
    expect(_internal._ymd(d.getTime())).toBe('2026-05-26');
  });
});
