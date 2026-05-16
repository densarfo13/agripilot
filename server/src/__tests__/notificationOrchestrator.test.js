/**
 * notificationOrchestrator.test.js — Smart Notification Channel
 * Architecture Fix.
 *
 * notificationOrchestrator routes generated notifications onto the
 * three channels: push (operational subset, capped), in-app
 * (persistent — receives everything), email (summary-only — never
 * per-notification).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  routeNotifications,
  CHANNEL,
} from '../../../src/core/notifications/notificationOrchestrator.js';

const ROOT = resolve(process.cwd(), '..');
const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

const note = (over) => ({
  id: 'n' + Math.random().toString(36).slice(2, 7),
  kind: 'task_reminder', urgency: 'medium', mode: 'farm',
  title: 'T', body: 'B', language: 'en', ...over,
});

// ─── 1. Channel model ──────────────────────────────────────

describe('routeNotifications — channel model', () => {
  it('returns the three-channel plan', () => {
    const plan = routeNotifications([]);
    expect(Array.isArray(plan.push)).toBe(true);
    expect(Array.isArray(plan.inApp)).toBe(true);
    expect(Array.isArray(plan.email)).toBe(true);
  });

  it('in-app receives EVERY notification (persistent memory)', () => {
    const notes = [note(), note({ kind: 'buyer_message' }), note({ kind: 'system' })];
    const plan = routeNotifications(notes, { prefsOverride: { push: true, inApp: true } });
    expect(plan.inApp.length).toBe(3);
    plan.inApp.forEach((n) => expect(n.channel).toBe(CHANNEL.IN_APP));
  });

  it('email is never a per-notification channel (summary-only)', () => {
    const plan = routeNotifications([note(), note()]);
    expect(plan.email).toEqual([]);
  });

  it('push carries only the operational kinds', () => {
    const notes = [
      note({ kind: 'weather_risk' }),
      note({ kind: 'buyer_message' }),  // not a push kind
      note({ kind: 'system' }),         // not a push kind
    ];
    const plan = routeNotifications(notes, {
      prefsOverride: { push: true, inApp: true }, nowMs: _midday(),
    });
    expect(plan.push.length).toBe(1);
    expect(plan.push[0].kind).toBe('weather_risk');
    expect(plan.push[0].channel).toBe(CHANNEL.PUSH);
  });
});

// ─── 2. Frequency + quiet hours (§4) ───────────────────────

function _midday() { const d = new Date(); d.setHours(12, 0, 0, 0); return d.getTime(); }
function _night()  { const d = new Date(); d.setHours(23, 0, 0, 0); return d.getTime(); }

describe('routeNotifications — frequency + quiet hours', () => {
  it('caps push at 2 per day', () => {
    const notes = [
      note({ kind: 'weather_risk', urgency: 'medium' }),
      note({ kind: 'scan_followup', urgency: 'medium' }),
      note({ kind: 'task_reminder', urgency: 'medium' }),
      note({ kind: 'irrigation_warning', urgency: 'medium' }),
    ];
    const plan = routeNotifications(notes, {
      prefsOverride: { push: true, inApp: true }, nowMs: _midday(),
    });
    expect(plan.push.length).toBeLessThanOrEqual(2);
    expect(plan.inApp.length).toBe(4); // in-app still gets all
  });

  it('quiet hours suppress non-critical push, keep in-app', () => {
    const notes = [note({ kind: 'task_reminder', urgency: 'medium' })];
    const plan = routeNotifications(notes, {
      prefsOverride: { push: true, inApp: true, quietStart: 21, quietEnd: 7 },
      nowMs: _night(),
    });
    expect(plan.push.length).toBe(0);
    expect(plan.inApp.length).toBe(1);
  });

  it('critical push overrides quiet hours', () => {
    const notes = [note({ kind: 'weather_risk', urgency: 'high' })];
    const plan = routeNotifications(notes, {
      prefsOverride: { push: true, inApp: true, quietStart: 21, quietEnd: 7 },
      nowMs: _night(),
    });
    expect(plan.push.length).toBe(1);
  });
});

// ─── 3. Opt-out ────────────────────────────────────────────

describe('routeNotifications — preference opt-out', () => {
  it('push:false removes the push channel', () => {
    const plan = routeNotifications([note({ kind: 'weather_risk' })], {
      prefsOverride: { push: false, inApp: true }, nowMs: _midday(),
    });
    expect(plan.push).toEqual([]);
  });

  it('inApp:false removes the in-app channel', () => {
    const plan = routeNotifications([note()], {
      prefsOverride: { push: true, inApp: false },
    });
    expect(plan.inApp).toEqual([]);
  });

  it('never throws on garbage input', () => {
    expect(() => routeNotifications(null)).not.toThrow();
    expect(() => routeNotifications('x', 42)).not.toThrow();
  });
});

// ─── 4. Wiring ─────────────────────────────────────────────

describe('returnLoopScheduler — routes through the orchestrator', () => {
  it('delivers the in-app channel set from routeNotifications', () => {
    const src = read('src/core/notifications/returnLoopScheduler.js');
    expect(src).toMatch(/import \{ routeNotifications \} from '\.\/notificationOrchestrator\.js'/);
    expect(src).toMatch(/routeNotifications\(notes\)/);
    expect(src).toMatch(/plan\.inApp/);
  });
});
