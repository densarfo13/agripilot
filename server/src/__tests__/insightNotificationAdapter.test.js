/**
 * insightNotificationAdapter.test.js — locks the spec-aligned
 * notification engine + Twilio sendSMS wrapper.
 *
 * Covers the 10-point spec matrix:
 *   1.  dry weather triggers SMS alert
 *   2.  heavy rain triggers alert
 *   3.  daily reminder generated
 *   4.  SMS only sends for high priority
 *   5.  user preference disables SMS
 *   6.  message length under 160 chars
 *   7.  language switching works (keys only)
 *   8.  no duplicate alerts
 *   9.  notifications stored in DB (shape)
 *   10. no crash without phone number
 */

import { describe, it, expect, vi } from 'vitest';

import {
  buildNotifications as rawBuildNotifications,
  SMS_DAILY_CAP, MAX_SMS_CHARS, _internal,
} from '../../../src/lib/notifications/insightNotificationAdapter.js';
import { sendSMS, _internal as smsInternal } from '../../services/smsService.js';

// The adapter gates non-in_app channels behind an explicit
// `liveChannels` set (see Fix 4 in the production-stability
// sprint). These tests exercise the full channel-routing surface,
// so we opt into every channel at the test boundary.
const ALL_LIVE_CHANNELS = ['in_app', 'sms', 'whatsapp', 'voice'];
function buildNotifications(ctx) {
  return rawBuildNotifications({ liveChannels: ALL_LIVE_CHANNELS, ...ctx });
}

// ─── Fixture helpers ───────────────────────────────────────────
const FARM = Object.freeze({ id: 'farm-1', farmType: 'small_farm',
                               country: 'GH', cropType: 'cassava',
                               phone: '+233555123456' });

function insightDry() {
  return {
    id: 'insight.water.stress',
    type: 'warning', priority: 'high',
    icon: 'water',
    messageKey: 'insight.water.stress.msg',
    fallbackMessage: 'Water stress risk',
    reasonKey: 'insight.water.stress.reason',
    reason: 'Dry conditions may slow establishment',
    recommendedActionKey: 'insight.water.stress.action',
    recommendedAction: 'Plan irrigation today',
    linkedTaskTemplateId: 'irrigate_crop',
  };
}

function insightFlood() {
  return {
    id: 'insight.flood.risk',
    type: 'warning', priority: 'high',
    messageKey: 'insight.flood.risk.msg',
    fallbackMessage: 'Flooding risk',
    recommendedActionKey: 'insight.flood.risk.action',
    recommendedAction: 'Clear drainage',
  };
}

function insightStage() {
  return {
    id: 'insight.stage.vegetative',
    type: 'action', priority: 'medium',
    messageKey: 'insight.stage.vegetative.msg',
    fallbackMessage: 'Vegetative stage',
  };
}

// ─── Insight → notification ────────────────────────────────────
describe('buildNotifications', () => {
  it('dry weather insight produces a high-priority in_app + sms pair', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: { receiveSMS: true, receiveNotifications: true },
      now: new Date('2026-04-22T09:00:00Z'),
    });
    const inApp = out.find((n) => n.type === 'in_app' && n.insightId === 'insight.water.stress');
    const sms   = out.find((n) => n.type === 'sms'    && n.insightId === 'insight.water.stress');
    expect(inApp).toBeTruthy();
    expect(sms).toBeTruthy();
    expect(inApp.priority).toBe('high');
    expect(sms.priority).toBe('high');
    expect(inApp.messageKey).toBe('insight.water.stress.msg');
  });

  it('heavy rain insight also triggers SMS', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightFlood()],
      userPreferences: { receiveSMS: true },
    });
    const sms = out.find((n) => n.type === 'sms');
    expect(sms).toBeTruthy();
    expect(sms.priority).toBe('high');
  });

  it('generates a daily task reminder when tasks are pending', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [],
      tasks: [
        { id: 't1', status: 'pending', title: 'Check cassava growth' },
        { id: 't2', status: 'pending', title: 'Remove weeds' },
      ],
    });
    const daily = out.find((n) => n.source === 'task');
    expect(daily).toBeTruthy();
    expect(daily.message).toMatch(/Today/);
  });

  it('SMS only fires for high-priority insights', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightStage()],     // medium priority
      userPreferences: { receiveSMS: true },
    });
    // The stage insight is medium — no sms row should be emitted.
    expect(out.some((n) => n.type === 'sms')).toBe(false);
  });

  it('respects receiveSMS=false', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: { receiveSMS: false, receiveNotifications: true },
    });
    expect(out.some((n) => n.type === 'sms')).toBe(false);
    // in_app row still there so the dashboard renders the alert.
    expect(out.some((n) => n.type === 'in_app' && n.priority === 'high')).toBe(true);
  });

  it('respects receiveNotifications=false (no in_app rows)', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      userPreferences: { receiveNotifications: false, receiveSMS: true },
    });
    expect(out.some((n) => n.type === 'in_app')).toBe(false);
    // SMS still allowed — prefs allow it.
    expect(out.some((n) => n.type === 'sms')).toBe(true);
  });

  it('caps SMS at SMS_DAILY_CAP per day', () => {
    // Three high-priority insights — only two SMS rows should emerge.
    const third = { ...insightDry(), id: 'insight.generic.highAlert3' };
    const extra = { ...insightFlood(), id: 'insight.generic.highAlert2' };
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry(), extra, third].map(
        (i, k) => ({ ...i, id: `${i.id}-${k}`, priority: 'high' })),
      userPreferences: { receiveSMS: true },
    });
    const smsCount = out.filter((n) => n.type === 'sms').length;
    expect(smsCount).toBeLessThanOrEqual(SMS_DAILY_CAP);
  });

  it('subtracts already-sent SMS ids from the cap', () => {
    const sent = new Set([
      `sms:insight:${FARM.id}:insight.water.stress:2026-04-22`,
    ]);
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry(), { ...insightFlood(), id: 'insight.flood.risk' }],
      userPreferences: { receiveSMS: true },
      recentlySent: sent,
      now: new Date('2026-04-22T10:00:00Z'),
    });
    // The dry alert was already sent as SMS — we should NOT see it
    // again, but the flood alert (1 slot left) should still go out.
    const smsIds = out.filter((n) => n.type === 'sms').map((n) => n.insightId);
    expect(smsIds).not.toContain('insight.water.stress');
    expect(smsIds).toContain('insight.flood.risk');
  });

  it('every message is <= 160 characters', () => {
    const long = {
      ...insightDry(),
      fallbackMessage: 'x'.repeat(200),
      recommendedAction: 'y'.repeat(200),
    };
    const out = buildNotifications({
      userId: 'u1', farms: [FARM], insights: [long],
      userPreferences: { receiveSMS: true },
    });
    for (const n of out) {
      expect(n.message.length).toBeLessThanOrEqual(MAX_SMS_CHARS);
      expect(n.fallbackMessage.length).toBeLessThanOrEqual(MAX_SMS_CHARS);
    }
  });

  it('surfaces messageKey so dispatcher can localise (language-safe)', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM], insights: [insightDry()],
      userPreferences: { receiveSMS: true, preferredLanguage: 'fr' },
    });
    for (const n of out) {
      if (n.source === 'insight') {
        expect(n.messageKey).toMatch(/^insight\./);
      }
    }
  });

  it('deduplicates when the same id is passed twice', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry(), insightDry()],
    });
    const ids = out.filter((n) => n.type === 'in_app').map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('skips alerts already in recentlySent (no repeat same day)', () => {
    const sent = new Set([
      `in_app:insight:${FARM.id}:insight.water.stress:2026-04-22`,
    ]);
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [insightDry()],
      recentlySent: sent,
      now: new Date('2026-04-22T10:00:00Z'),
    });
    expect(out.some((n) => n.insightId === 'insight.water.stress' && n.type === 'in_app')).toBe(false);
  });

  it('returns DB-ready shape (userId/farmId/type/timestamp)', () => {
    const out = buildNotifications({
      userId: 'user-42', farms: [FARM],
      insights: [insightStage()],
    });
    const row = out[0];
    expect(row.userId).toBe('user-42');
    expect(row.farmId).toBe('farm-1');
    expect(['sms', 'in_app']).toContain(row.type);
    expect(['high', 'medium', 'low']).toContain(row.priority);
    expect(typeof row.timestamp).toBe('string');
    expect(() => new Date(row.timestamp).toISOString()).not.toThrow();
  });

  it('never throws on empty or garbage input', () => {
    expect(() => buildNotifications(null)).not.toThrow();
    expect(() => buildNotifications({})).not.toThrow();
    expect(buildNotifications({}).length).toBe(0);
  });

  it('priority ordering is high → medium → low', () => {
    const out = buildNotifications({
      userId: 'u1', farms: [FARM],
      insights: [
        insightStage(),                 // medium
        insightDry(),                   // high
        { ...insightStage(), id: 'insight.generic.info', priority: 'low' },
      ],
    });
    const priorities = out.filter((n) => n.type === 'in_app').map((n) => n.priority);
    const rank = (p) => ({ high: 3, medium: 2, low: 1 }[p] || 0);
    for (let i = 1; i < priorities.length; i += 1) {
      expect(rank(priorities[i - 1])).toBeGreaterThanOrEqual(rank(priorities[i]));
    }
  });
});

// ─── sendSMS wrapper ───────────────────────────────────────────
describe('sendSMS (positional wrapper)', () => {
  it('returns missing_to_or_body when phone is null', async () => {
    const r = await sendSMS(null, 'hello');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('missing_to_or_body');
  });

  it('returns missing_to_or_body when phone is empty', async () => {
    const r = await sendSMS('', 'hello');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('missing_to_or_body');
  });

  it('returns not_configured when Twilio env is missing', async () => {
    // Save + wipe env.
    const saved = {
      a: process.env.TWILIO_ACCOUNT_SID, b: process.env.TWILIO_AUTH_TOKEN,
      c: process.env.TWILIO_PHONE_NUMBER,
      d: process.env.TWILIO_SID, e: process.env.TWILIO_TOKEN, f: process.env.TWILIO_PHONE,
    };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    delete process.env.TWILIO_SID;
    delete process.env.TWILIO_TOKEN;
    delete process.env.TWILIO_PHONE;
    try {
      const r = await sendSMS('+12025551234', 'hello');
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_configured');
    } finally {
      process.env.TWILIO_ACCOUNT_SID   = saved.a;
      process.env.TWILIO_AUTH_TOKEN    = saved.b;
      process.env.TWILIO_PHONE_NUMBER  = saved.c;
      process.env.TWILIO_SID   = saved.d;
      process.env.TWILIO_TOKEN = saved.e;
      process.env.TWILIO_PHONE = saved.f;
    }
  });

  it('truncates body to 160 chars before delegating', () => {
    const huge = 'x'.repeat(500);
    const truncated = smsInternal.truncateTo160(huge);
    expect(truncated.length).toBe(160);
    expect(truncated.endsWith('\u2026')).toBe(true);
  });

  it('canonicalizeTwilioEnv maps short-form env vars onto long form', () => {
    const saved = {
      a: process.env.TWILIO_ACCOUNT_SID, b: process.env.TWILIO_AUTH_TOKEN,
      c: process.env.TWILIO_PHONE_NUMBER,
    };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    process.env.TWILIO_SID   = 'AC_test_sid';
    process.env.TWILIO_TOKEN = 'test_token';
    process.env.TWILIO_PHONE = '+15005550006';
    try {
      smsInternal.canonicalizeTwilioEnv();
      expect(process.env.TWILIO_ACCOUNT_SID).toBe('AC_test_sid');
      expect(process.env.TWILIO_AUTH_TOKEN).toBe('test_token');
      expect(process.env.TWILIO_PHONE_NUMBER).toBe('+15005550006');
    } finally {
      process.env.TWILIO_ACCOUNT_SID  = saved.a;
      process.env.TWILIO_AUTH_TOKEN   = saved.b;
      process.env.TWILIO_PHONE_NUMBER = saved.c;
      delete process.env.TWILIO_SID;
      delete process.env.TWILIO_TOKEN;
      delete process.env.TWILIO_PHONE;
    }
  });
});

// ─── Utility internals ─────────────────────────────────────────
describe('internals', () => {
  it('truncate returns <= max and appends ellipsis', () => {
    expect(_internal.truncate('abc', 10)).toBe('abc');
    const s = _internal.truncate('x'.repeat(200), 160);
    expect(s.length).toBe(160);
    expect(s.endsWith('\u2026')).toBe(true);
  });

  it('normalisePrefs defaults receiveSMS/receiveNotifications to true', () => {
    const p = _internal.normalisePrefs({});
    expect(p.receiveSMS).toBe(true);
    expect(p.receiveNotifications).toBe(true);
    expect(p.preferredLanguage).toBe('en');
  });

  it('normalisePrefs preserves explicit false values', () => {
    const p = _internal.normalisePrefs({ receiveSMS: false });
    expect(p.receiveSMS).toBe(false);
  });
});
