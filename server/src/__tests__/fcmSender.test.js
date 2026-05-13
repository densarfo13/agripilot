/**
 * fcmSender.test.js — pins the calm-push sender contract:
 *
 *   1. Daily cap of 2 per user (spec)
 *   2. Quiet hours block delivery (22:00–06:00 default)
 *   3. Dedupe by dedupeKey blocks repeats inside TTL
 *   4. Send failure returns fallback:true (caller falls back to in-app)
 *   5. Missing SDK returns fallback:true
 *   6. Invalid input returns reason:'invalid_input'
 *   7. Service NEVER throws
 *   8. getDailyCount tracks state per user/day
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendCalmPush,
  getDailyCount,
  _resetFcmTracking,
  DEFAULT_DAILY_CAP,
} from '../services/notifications/fcmSender.js';

const DAYTIME_MS = Date.parse('2026-05-12T14:00:00Z');   // 14:00 UTC, safely outside quiet
const NIGHT_MS   = Date.parse('2026-05-12T23:00:00Z');   // 23:00 UTC, inside quiet (22-6)
const EARLY_MORNING_MS = Date.parse('2026-05-12T03:00:00Z');  // 03:00 UTC, inside quiet

const _validInput = () => ({
  userId:      'user-1',
  token:       'fcm-token-abc',
  title:       'Rain expected later',
  body:        'Water earlier today.',
  dedupeKey:   'weather:rain:2026-05-12',
  clickAction: '/today',
});

function _okSdk() {
  return { send: vi.fn(async () => ({ messageId: 'msg-1' })) };
}

beforeEach(() => {
  _resetFcmTracking();
});

// ─── Happy path ──────────────────────────────────────────────

describe('sendCalmPush — happy path', () => {
  it('delivers when all rails pass + SDK succeeds', async () => {
    const sdk = _okSdk();
    const r = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: DAYTIME_MS });
    expect(r.delivered).toBe(true);
    expect(r.fallback).toBe(false);
    expect(sdk.send).toHaveBeenCalledTimes(1);
  });

  it('forwards calm content + dedupeKey in the message payload', async () => {
    const sdk = _okSdk();
    await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: DAYTIME_MS });
    const msg = sdk.send.mock.calls[0][0];
    expect(msg.token).toBe('fcm-token-abc');
    expect(msg.notification.title).toBe('Rain expected later');
    expect(msg.notification.body).toBe('Water earlier today.');
    expect(msg.data.dedupeKey).toBe('weather:rain:2026-05-12');
    expect(msg.data.clickAction).toBe('/today');
    expect(msg.webpush.fcmOptions.link).toBe('/today');
  });
});

// ─── Daily cap ───────────────────────────────────────────────

describe('sendCalmPush — daily cap (2/user/day)', () => {
  it('blocks 3rd notification on the same day → fallback', async () => {
    const sdk = _okSdk();
    const r1 = await sendCalmPush({ ..._validInput(), dedupeKey: 'a' }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    const r2 = await sendCalmPush({ ..._validInput(), dedupeKey: 'b' }, { fcmSdk: sdk, nowMs: DAYTIME_MS + 1000 });
    const r3 = await sendCalmPush({ ..._validInput(), dedupeKey: 'c' }, { fcmSdk: sdk, nowMs: DAYTIME_MS + 2000 });
    expect(r1.delivered).toBe(true);
    expect(r2.delivered).toBe(true);
    expect(r3.delivered).toBe(false);
    expect(r3.fallback).toBe(true);
    expect(r3.reason).toBe('daily_cap');
    expect(sdk.send).toHaveBeenCalledTimes(2);
  });

  it('per-user cap is independent', async () => {
    const sdk = _okSdk();
    const userA = { ..._validInput(), userId: 'A' };
    const userB = { ..._validInput(), userId: 'B' };
    for (let i = 0; i < DEFAULT_DAILY_CAP; i += 1) {
      await sendCalmPush({ ...userA, dedupeKey: `a-${i}` }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    }
    const r = await sendCalmPush({ ...userB, dedupeKey: 'b-0' }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    expect(r.delivered).toBe(true);   // B's count is still 0
  });

  it('cap resets across UTC day boundary', async () => {
    const sdk = _okSdk();
    await sendCalmPush({ ..._validInput(), dedupeKey: 'a' }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    await sendCalmPush({ ..._validInput(), dedupeKey: 'b' }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    // Next day.
    const tomorrow = DAYTIME_MS + 24 * 60 * 60 * 1000;
    const r = await sendCalmPush({ ..._validInput(), dedupeKey: 'c' }, { fcmSdk: sdk, nowMs: tomorrow });
    expect(r.delivered).toBe(true);
  });

  it('dailyCap option overrides the default', async () => {
    const sdk = _okSdk();
    await sendCalmPush({ ..._validInput(), dedupeKey: 'a' }, { fcmSdk: sdk, dailyCap: 1, nowMs: DAYTIME_MS });
    const r = await sendCalmPush({ ..._validInput(), dedupeKey: 'b' }, { fcmSdk: sdk, dailyCap: 1, nowMs: DAYTIME_MS });
    expect(r.delivered).toBe(false);
    expect(r.reason).toBe('daily_cap');
  });
});

// ─── Quiet hours ─────────────────────────────────────────────

describe('sendCalmPush — quiet hours (22:00–06:00 default)', () => {
  it('blocks delivery during late-night hours', async () => {
    const sdk = _okSdk();
    const r = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: NIGHT_MS });
    expect(r.delivered).toBe(false);
    expect(r.fallback).toBe(true);
    expect(r.reason).toBe('quiet_hours');
    expect(sdk.send).not.toHaveBeenCalled();
  });

  it('blocks delivery during early-morning hours', async () => {
    const sdk = _okSdk();
    const r = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: EARLY_MORNING_MS });
    expect(r.reason).toBe('quiet_hours');
  });

  it('delivers during daytime hours', async () => {
    const sdk = _okSdk();
    const r = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: DAYTIME_MS });
    expect(r.delivered).toBe(true);
  });

  it('bypassQuietHours option allows delivery for critical alerts', async () => {
    const sdk = _okSdk();
    const r = await sendCalmPush(_validInput(), {
      fcmSdk: sdk, nowMs: NIGHT_MS, bypassQuietHours: true,
    });
    expect(r.delivered).toBe(true);
  });

  it('respects timezone offset (user in UTC+8)', async () => {
    // UTC 14:00 = UTC+8 22:00 → quiet for an Asia-shanghai user.
    const sdk = _okSdk();
    const r = await sendCalmPush(_validInput(), {
      fcmSdk: sdk,
      nowMs: DAYTIME_MS,
      timezoneOffsetMinutes: 8 * 60,
    });
    expect(r.reason).toBe('quiet_hours');
  });
});

// ─── Dedupe ──────────────────────────────────────────────────

describe('sendCalmPush — dedupe', () => {
  it('blocks repeat sends for the same user+dedupeKey within TTL', async () => {
    const sdk = _okSdk();
    const r1 = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: DAYTIME_MS });
    const r2 = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: DAYTIME_MS + 1000 });
    expect(r1.delivered).toBe(true);
    expect(r2.delivered).toBe(false);
    expect(r2.fallback).toBe(false);
    expect(r2.reason).toBe('duplicate');
    expect(sdk.send).toHaveBeenCalledTimes(1);
  });

  it('dedupe is per-user (same key allowed for different users)', async () => {
    const sdk = _okSdk();
    await sendCalmPush({ ..._validInput(), userId: 'A', dedupeKey: 'k' }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    const r = await sendCalmPush({ ..._validInput(), userId: 'B', dedupeKey: 'k' }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    expect(r.delivered).toBe(true);
  });
});

// ─── Failure → fallback ──────────────────────────────────────

describe('sendCalmPush — fallback paths', () => {
  it('returns fallback:true when SDK send rejects', async () => {
    const sdk = { send: vi.fn(() => Promise.reject(new Error('FCM down'))) };
    const r = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: DAYTIME_MS });
    expect(r.delivered).toBe(false);
    expect(r.fallback).toBe(true);
    expect(r.reason).toBe('send_failed');
  });

  it('returns fallback:true when SDK throws synchronously', async () => {
    const sdk = { send: () => { throw new Error('sync boom'); } };
    const r = await sendCalmPush(_validInput(), { fcmSdk: sdk, nowMs: DAYTIME_MS });
    expect(r.fallback).toBe(true);
    expect(r.reason).toBe('send_failed');
  });

  it('returns fallback:true when SDK is missing', async () => {
    const r = await sendCalmPush(_validInput(), { nowMs: DAYTIME_MS });
    expect(r.fallback).toBe(true);
    expect(r.reason).toBe('no_sdk');
  });

  it('returns invalid_input on missing required field', async () => {
    const sdk = _okSdk();
    const inputs = [
      { ..._validInput(), userId: '' },
      { ..._validInput(), token: '' },
      { ..._validInput(), title: '' },
      { ..._validInput(), body: '' },
      { ..._validInput(), dedupeKey: '' },
    ];
    for (const i of inputs) {
      const r = await sendCalmPush(i, { fcmSdk: sdk, nowMs: DAYTIME_MS });
      expect(r.delivered).toBe(false);
      expect(r.reason).toBe('invalid_input');
    }
  });

  it('NEVER throws on null / garbage input', async () => {
    await expect(sendCalmPush(null)).resolves.toBeDefined();
    await expect(sendCalmPush('not an object')).resolves.toBeDefined();
    await expect(sendCalmPush({}, null)).resolves.toBeDefined();
  });
});

// ─── getDailyCount ───────────────────────────────────────────

describe('getDailyCount', () => {
  it('returns 0 for unknown users', () => {
    expect(getDailyCount('nobody')).toBe(0);
  });

  it('reflects sends made today', async () => {
    const sdk = _okSdk();
    await sendCalmPush({ ..._validInput(), dedupeKey: 'a' }, { fcmSdk: sdk, nowMs: DAYTIME_MS });
    expect(getDailyCount('user-1', DAYTIME_MS)).toBe(1);
  });

  it('returns 0 for empty userId', () => {
    expect(getDailyCount('')).toBe(0);
    expect(getDailyCount(null)).toBe(0);
  });
});
