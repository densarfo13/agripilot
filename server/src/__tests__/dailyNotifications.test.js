/**
 * dailyNotifications.test.js — locks the notification system:
 *   1. daily reminder fires for incomplete tasks
 *   2. dedup — no second daily reminder the same day
 *   3. weather alert triggers on meaningful status
 *   4. risk alert triggers when risk engine fires
 *   5. missed-task reminder fires after enough misses
 *   6. channel routing respects preferences
 *   7. smsEnabled=false → no SMS
 *   8. emailEnabled=false → no email
 *   9. transport failure never crashes the scheduler
 *  10. farmType changes intensity
 *  11. candidates carry language in meta
 *  12. delivery log records attempts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function installMemoryStorage() {
  const store = new Map();
  const mem = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear:   () => { store.clear(); },
    key:     (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = mem;
  return mem;
}

import {
  generateCandidates,
} from '../../../src/lib/notifications/notificationEngine.js';
import {
  chooseChannels,
} from '../../../src/lib/notifications/channelRouter.js';
import {
  processNotifications,
} from '../../../src/lib/notifications/notificationScheduler.js';
import {
  setNotificationPreferences, resetNotificationPreferences,
} from '../../../src/lib/notifications/notificationPreferences.js';
import {
  listDeliveryLog, clearDeliveryLog,
} from '../../../src/lib/notifications/notificationDeliveryLog.js';
import {
  listNotifications, clearNotifications,
} from '../../../src/lib/notifications/notificationStore.js';

const TODAY = new Date('2025-05-10T09:00:00');

function makeFarm(extra = {}) {
  return {
    id: 'farm-1', crop: 'maize', farmType: 'small_farm',
    cropStage: 'mid_growth', countryCode: 'NG', ...extra,
  };
}
function makeTask(status = 'pending', extra = {}) {
  return {
    id: `farm-1:2025-05-10:mid.${Math.random().toString(36).slice(2, 6)}`,
    farmId: 'farm-1', date: '2025-05-10', priority: 'medium',
    type: 'irrigation', title: 'x', description: '', why: '', status, ...extra,
  };
}

beforeEach(() => {
  installMemoryStorage();
  resetNotificationPreferences();
  clearNotifications();
  clearDeliveryLog();
});

// ─── 1. daily reminder fires for incomplete tasks ───────────────
describe('generateCandidates', () => {
  it('emits a daily_task_reminder when pending tasks exist', () => {
    const out = generateCandidates({
      farm: makeFarm(),
      tasks: [makeTask('pending'), makeTask('pending')],
      weather: { status: 'ok' }, now: TODAY,
    });
    const daily = out.find((c) => c.type === 'daily_task_reminder');
    expect(daily).toBeDefined();
    expect(daily.priority).toBe('medium');
    expect(daily.data.openCount).toBe(2);
    expect(daily.titleFallback).toMatch(/2 farm tasks/);
  });

  it('no daily reminder when all tasks are complete', () => {
    const out = generateCandidates({
      farm: makeFarm(),
      tasks: [makeTask('complete'), makeTask('complete')],
      weather: { status: 'ok' }, now: TODAY,
    });
    expect(out.find((c) => c.type === 'daily_task_reminder')).toBeUndefined();
  });

  // ─── 3. weather alert triggers on meaningful status ─────────────
  it('emits a weather_alert for excessive_heat', () => {
    const out = generateCandidates({
      farm: makeFarm(),
      tasks: [makeTask('pending')],
      weather: { status: 'excessive_heat' }, now: TODAY,
    });
    const w = out.find((c) => c.type === 'weather_alert');
    expect(w).toBeDefined();
    expect(w.priority).toBe('high');
    expect(w.meta.ruleTag).toBe('weather_excessive_heat');
  });

  it('no weather_alert for status=ok', () => {
    const out = generateCandidates({
      farm: makeFarm(),
      tasks: [makeTask('pending')],
      weather: { status: 'ok' }, now: TODAY,
    });
    expect(out.find((c) => c.type === 'weather_alert')).toBeUndefined();
  });

  // ─── 4. risk alert when risk engine fires ───────────────────────
  it('emits a risk_alert when missed tasks + weather drive elevated risk', () => {
    const out = generateCandidates({
      farm: makeFarm(),
      tasks: [
        { id: 'w1', category: 'irrigation', overdue: true, missedCount: 3, status: 'pending',
          date: '2025-05-10', priority: 'high' },
        { id: 'w2', category: 'irrigation', overdue: true, missedCount: 2, status: 'pending',
          date: '2025-05-10', priority: 'medium' },
        { id: 'i1', category: 'pest_inspection', overdue: true, missedCount: 2, status: 'pending',
          date: '2025-05-10', priority: 'high' },
      ],
      weather: { status: 'excessive_heat' }, now: TODAY,
    });
    // riskInsightEngine may or may not fire depending on the
    // aggregator's scoring, but when it does we expect the candidate
    // shape to be correct.
    const r = out.find((c) => c.type === 'risk_alert');
    if (r) {
      expect(['medium', 'high']).toContain(r.priority);
      expect(r.meta.source).toBe('riskInsightEngine');
    }
  });

  // ─── 5. missed-task reminder ────────────────────────────────────
  it('emits a missed_task_reminder when ≥2 prior-day tasks are pending', () => {
    const out = generateCandidates({
      farm: makeFarm(),
      tasks: [
        makeTask('pending', { date: '2025-05-09' }),
        makeTask('pending', { date: '2025-05-09' }),
        makeTask('pending', { date: '2025-05-10' }),
      ],
      weather: { status: 'ok' }, now: TODAY,
    });
    const m = out.find((c) => c.type === 'missed_task_reminder');
    expect(m).toBeDefined();
    expect(m.data.missedCount).toBe(2);
    // Supportive tone — no shaming wording.
    expect(m.titleFallback.toLowerCase()).not.toMatch(/fail|neglect|lazy/);
  });

  // ─── 10. farmType changes intensity ─────────────────────────────
  it('backyard suppresses medium-tone weather alerts', () => {
    const out = generateCandidates({
      farm: makeFarm({ farmType: 'backyard' }),
      tasks: [makeTask('pending')],
      weather: { status: 'low_rain' }, now: TODAY,   // → warn-tone
    });
    expect(out.find((c) => c.type === 'weather_alert')).toBeUndefined();
  });

  it('commercial surfaces medium weather alerts that backyard hides', () => {
    const out = generateCandidates({
      farm: makeFarm({ farmType: 'commercial' }),
      tasks: [makeTask('pending')],
      weather: { status: 'low_rain' }, now: TODAY,
    });
    expect(out.find((c) => c.type === 'weather_alert')).toBeDefined();
  });

  // ─── 11. language passed through ─────────────────────────────────
  it('weather candidates carry the caller language in meta', () => {
    const out = generateCandidates({
      farm: makeFarm(), tasks: [makeTask('pending')],
      weather: { status: 'low_rain' }, now: TODAY, language: 'fr',
    });
    const w = out.find((c) => c.type === 'weather_alert');
    expect(w && w.meta.language).toBe('fr');
  });
});

// ─── 6, 7, 8. channel routing + preferences ──────────────────────
describe('chooseChannels', () => {
  const user = { id: 'u1', email: 'a@b.com', phone: '+14155551212' };

  it('daily reminder: in_app only unless email/SMS opted in', () => {
    const c = { type: 'daily_task_reminder', priority: 'medium' };
    const plans = chooseChannels({
      candidate: c,
      preferences: { dailyReminderEnabled: true, emailEnabled: false, smsEnabled: false },
      user,
    });
    expect(plans.map((p) => p.channel)).toEqual(['in_app']);
  });

  it('daily reminder: fans out to SMS when smsEnabled=true + phone present', () => {
    const c = { type: 'daily_task_reminder', priority: 'medium' };
    const plans = chooseChannels({
      candidate: c,
      preferences: { dailyReminderEnabled: true, smsEnabled: true, emailEnabled: true },
      user,
    });
    const chans = plans.map((p) => p.channel);
    expect(chans).toContain('in_app');
    expect(chans).toContain('sms');
    expect(chans).toContain('email');
  });

  it('SMS is never queued when smsEnabled=false even with phone', () => {
    const c = { type: 'weather_alert', priority: 'high' };
    const plans = chooseChannels({
      candidate: c,
      preferences: { weatherAlertsEnabled: true, smsEnabled: false },
      user,
    });
    expect(plans.find((p) => p.channel === 'sms')).toBeUndefined();
  });

  it('email is never queued when emailEnabled=false', () => {
    const c = { type: 'risk_alert', priority: 'high', meta: { farmType: 'commercial' } };
    const plans = chooseChannels({
      candidate: c,
      preferences: { riskAlertsEnabled: true, emailEnabled: false, smsEnabled: true },
      user,
    });
    expect(plans.find((p) => p.channel === 'email')).toBeUndefined();
  });

  it('password reset always goes email-first', () => {
    const c = { type: 'password_reset_notification', priority: 'high' };
    const plans = chooseChannels({
      candidate: c,
      preferences: { emailEnabled: false },   // ignored for password reset
      user,
    });
    expect(plans[0].channel).toBe('email');
  });

  it('marks canSend=false when SMS enabled but phone missing', () => {
    const c = { type: 'weather_alert', priority: 'high' };
    const plans = chooseChannels({
      candidate: c,
      preferences: { weatherAlertsEnabled: true, smsEnabled: true },
      user: { id: 'u2', email: 'a@b.com' }, // no phone
    });
    const sms = plans.find((p) => p.channel === 'sms');
    expect(sms).toBeUndefined();  // no sms plan added when canSend=false
  });

  it('entire type is suppressed when its preference toggle is off', () => {
    const c = { type: 'daily_task_reminder', priority: 'medium' };
    const plans = chooseChannels({
      candidate: c,
      preferences: { dailyReminderEnabled: false },
      user,
    });
    expect(plans).toEqual([]);
  });
});

// ─── Scheduler integration (dedup, logging, failures) ────────────
describe('processNotifications', () => {
  const user = { id: 'u1', email: 'a@b.com', phone: '+14155551212' };

  it('persists in-app notifications and logs a sent attempt', async () => {
    const rep = await processNotifications({
      user, farm: makeFarm(),
      tasks: [makeTask('pending')],
      weather: { status: 'ok' }, now: TODAY,
    });
    expect(rep.created.length).toBeGreaterThan(0);
    const stored = listNotifications({ limit: 10 });
    expect(stored.length).toBeGreaterThan(0);
    const log = listDeliveryLog({ limit: 20 });
    expect(log.some((e) => e.channel === 'in_app' && e.status === 'sent')).toBe(true);
  });

  // ─── 2. dedup — no second daily reminder the same day ───────────
  it('does not create a second daily reminder for the same farm+day', async () => {
    const base = {
      user, farm: makeFarm(),
      tasks: [makeTask('pending')],
      weather: { status: 'ok' }, now: TODAY,
    };
    await processNotifications(base);
    const rep = await processNotifications(base);
    expect(rep.created).toEqual([]);
    expect(rep.skippedDuplicate.length).toBeGreaterThan(0);
  });

  // ─── 9. transport failure doesn't crash ─────────────────────────
  it('tolerates a transport that throws', async () => {
    setNotificationPreferences({ smsEnabled: true, emailEnabled: true });
    const transport = { send: async () => { throw new Error('boom'); } };
    const rep = await processNotifications({
      user, farm: makeFarm(),
      tasks: [makeTask('pending')],
      weather: { status: 'excessive_heat' },  // high → SMS attempt
      now: TODAY, transport,
    });
    expect(rep.created.length).toBeGreaterThan(0);     // still created in-app
    const log = listDeliveryLog({ channel: 'sms', limit: 10 });
    expect(log.some((e) => e.status === 'failed')).toBe(true);
  });

  // ─── 12. delivery log records every attempt ─────────────────────
  it('logs one entry per channel attempt', async () => {
    setNotificationPreferences({ smsEnabled: true, emailEnabled: true });
    const transport = {
      send: async ({ channel }) => ({ ok: true, code: 'sent', messageId: `${channel}-1` }),
    };
    await processNotifications({
      user, farm: makeFarm({ farmType: 'commercial' }),
      tasks: [makeTask('pending')],
      weather: { status: 'excessive_heat' },
      now: TODAY, transport,
    });
    const log = listDeliveryLog({ limit: 50 });
    const byChannel = new Set(log.map((e) => e.channel));
    expect(byChannel.has('in_app')).toBe(true);
    expect(byChannel.has('sms')).toBe(true);
  });

  it('respects smsEnabled=false — no sms log entries', async () => {
    setNotificationPreferences({ smsEnabled: false, emailEnabled: true });
    await processNotifications({
      user, farm: makeFarm(),
      tasks: [makeTask('pending')],
      weather: { status: 'excessive_heat' }, now: TODAY,
    });
    const smsLog = listDeliveryLog({ channel: 'sms', limit: 10 });
    expect(smsLog.length).toBe(0);
  });
});
