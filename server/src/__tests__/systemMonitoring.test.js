/**
 * System Monitoring — Event Store Tests
 *
 * Tests the in-memory event store used for operational monitoring.
 * Uses _resetForTesting() to ensure clean state between tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordEvent,
  getRecentEvents,
  getCounters,
  getMonitoringSummary,
  _resetForTesting,
} from '../utils/eventStore.js';

beforeEach(() => {
  _resetForTesting();
});

// ─── recordEvent ──────────────────────────────────────────────

describe('recordEvent', () => {
  it('returns an event object with required fields', () => {
    const evt = recordEvent('auth', 'login_success', 'info', { userId: 'u-1' });

    expect(evt.id).toBeDefined();
    expect(evt.category).toBe('auth');
    expect(evt.event).toBe('login_success');
    expect(evt.severity).toBe('info');
    expect(evt.timestamp).toBeDefined();
    expect(evt.userId).toBe('u-1');
  });

  it('defaults severity to info when not provided', () => {
    const evt = recordEvent('delivery', 'invite_sent');
    expect(evt.severity).toBe('info');
  });

  it('includes arbitrary meta fields in the event', () => {
    const evt = recordEvent('upload', 'file_uploaded', 'info', {
      filename: 'photo.jpg',
      sizeBytes: 12345,
    });
    expect(evt.filename).toBe('photo.jpg');
    expect(evt.sizeBytes).toBe(12345);
  });

  it('increments the counter for category/event key', () => {
    recordEvent('auth', 'login_failed', 'warn');
    recordEvent('auth', 'login_failed', 'warn');
    recordEvent('auth', 'login_success', 'info');

    const counters = getCounters();
    expect(counters['auth/login_failed']).toBe(2);
    expect(counters['auth/login_success']).toBe(1);
  });

  it('stores events newest-first', () => {
    recordEvent('a', 'first');
    recordEvent('a', 'second');

    const events = getRecentEvents();
    expect(events[0].event).toBe('second');
    expect(events[1].event).toBe('first');
  });

  it('caps the buffer at 500 events', () => {
    for (let i = 0; i < 520; i++) {
      recordEvent('test', 'event', 'info');
    }
    const events = getRecentEvents({ limit: 1000 });
    expect(events.length).toBeLessThanOrEqual(500);
  });
});

// ─── getRecentEvents ──────────────────────────────────────────

describe('getRecentEvents', () => {
  beforeEach(() => {
    recordEvent('auth', 'login_success', 'info');
    recordEvent('auth', 'login_failed', 'warn');
    recordEvent('upload', 'file_uploaded', 'info');
    recordEvent('permission', 'role_denied', 'warn');
    recordEvent('system', 'startup_error', 'error');
  });

  it('returns all events when no filter applied', () => {
    const events = getRecentEvents();
    expect(events.length).toBe(5);
  });

  it('filters by category', () => {
    const events = getRecentEvents({ category: 'auth' });
    expect(events).toHaveLength(2);
    expect(events.every(e => e.category === 'auth')).toBe(true);
  });

  it('filters by exact severity', () => {
    const events = getRecentEvents({ severity: 'warn' });
    expect(events).toHaveLength(2);
    expect(events.every(e => e.severity === 'warn')).toBe(true);
  });

  it('filters by minSeverity (warn = warn + error + critical)', () => {
    const events = getRecentEvents({ minSeverity: 'warn' });
    expect(events).toHaveLength(3); // login_failed (warn) + role_denied (warn) + startup_error (error)
    expect(events.every(e => ['warn', 'error', 'critical'].includes(e.severity))).toBe(true);
  });

  it('minSeverity error excludes warn events', () => {
    const events = getRecentEvents({ minSeverity: 'error' });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('startup_error');
  });

  it('respects limit parameter', () => {
    const events = getRecentEvents({ limit: 2 });
    expect(events).toHaveLength(2);
  });

  it('returns empty array when no events match filter', () => {
    const events = getRecentEvents({ category: 'nonexistent' });
    expect(events).toHaveLength(0);
  });
});

// ─── getCounters ──────────────────────────────────────────────

describe('getCounters', () => {
  it('starts empty after reset', () => {
    expect(getCounters()).toEqual({});
  });

  it('tracks multiple event types independently', () => {
    recordEvent('auth', 'login_success', 'info');
    recordEvent('auth', 'login_success', 'info');
    recordEvent('delivery', 'email_sent', 'info');

    const counters = getCounters();
    expect(counters['auth/login_success']).toBe(2);
    expect(counters['delivery/email_sent']).toBe(1);
  });

  it('returns a copy (not the live reference)', () => {
    recordEvent('auth', 'test', 'info');
    const c1 = getCounters();
    recordEvent('auth', 'test', 'info');
    // c1 should not reflect the new event (it was captured before)
    expect(c1['auth/test']).toBe(1);
  });
});

// ─── getMonitoringSummary ─────────────────────────────────────

describe('getMonitoringSummary', () => {
  it('returns required top-level fields', () => {
    const summary = getMonitoringSummary();

    expect(summary.startedAt).toBeDefined();
    expect(typeof summary.uptimeHours).toBe('number');
    expect(typeof summary.totalEventsRecorded).toBe('number');
    expect(summary.bufferCapacity).toBe(500);
    expect(summary.lastHour).toBeDefined();
    expect(summary.last24h).toBeDefined();
    expect(summary.lifetimeCounters).toBeDefined();
  });

  it('counts recent error events in lastHour', () => {
    recordEvent('system', 'crash', 'error');
    recordEvent('system', 'crash', 'critical');
    recordEvent('auth', 'login_success', 'info');

    const summary = getMonitoringSummary();
    expect(summary.lastHour.errors).toBe(2);
  });

  it('counts warn events separately in lastHour', () => {
    recordEvent('auth', 'login_failed', 'warn');
    recordEvent('permission', 'denied', 'warn');

    const summary = getMonitoringSummary();
    expect(summary.lastHour.warnings).toBe(2);
  });

  it('reports zero error counts when no error events', () => {
    recordEvent('auth', 'login_success', 'info');
    const summary = getMonitoringSummary();
    expect(summary.lastHour.errors).toBe(0);
    expect(summary.lastHour.warnings).toBe(0);
  });

  it('totalEventsRecorded increases with each event', () => {
    const before = getMonitoringSummary().totalEventsRecorded;
    recordEvent('test', 'one');
    recordEvent('test', 'two');
    const after = getMonitoringSummary().totalEventsRecorded;
    expect(after).toBe(before + 2);
  });

  it('includes category breakdown in categoryCounts', () => {
    recordEvent('auth', 'event', 'info');
    recordEvent('auth', 'event', 'info');
    recordEvent('upload', 'event', 'info');

    const summary = getMonitoringSummary();
    expect(summary.categoryCounts.auth).toBe(2);
    expect(summary.categoryCounts.upload).toBe(1);
  });
});

// ─── _resetForTesting ─────────────────────────────────────────

describe('_resetForTesting', () => {
  it('clears all events', () => {
    recordEvent('auth', 'test', 'info');
    recordEvent('auth', 'test', 'info');
    _resetForTesting();
    expect(getRecentEvents()).toHaveLength(0);
  });

  it('clears all counters', () => {
    recordEvent('auth', 'test', 'info');
    _resetForTesting();
    expect(getCounters()).toEqual({});
  });
});
