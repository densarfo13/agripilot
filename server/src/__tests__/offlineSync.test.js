/**
 * offlineSync.test.js — locks the offline-first + SMS-fallback
 * strategy for Farroway's farmer flow:
 *
 *   1. networkStatus reports online / offline + lastSyncAt
 *   2. setOnlineForTesting flips state + notifies subscribers
 *   3. enqueueAction stores the row with defaults
 *   4. dedupKey blocks a duplicate unsynced entry
 *   5. markSynced / markFailure update rows in place
 *   6. markTaskComplete enqueues a task_complete action
 *   7. skipTask enqueues a task_skip action
 *   8. syncPending is a no-op when offline (returns skipped count)
 *   9. syncPending drains succeeded items + bumps lastSyncAt
 *  10. failed actions stay in queue with attempts + lastError
 *  11. duplicate server code marks action synced (idempotent retry)
 *  12. transport throws don't crash the engine
 *  13. OfflineCache stores + retrieves each core key
 *  14. Channel router: phone-only user gets SMS primary for
 *      password reset + invite, escalates SMS on high-risk alert
 *  15. Channel router: no-email user still gets SMS for critical
 *      recovery even without smsEnabled preference
 */

import { describe, it, expect, beforeEach } from 'vitest';

function installMemoryStorage() {
  const store = new Map();
  const mem = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i) => Array.from(store.keys())[i] || null,
    get length() { return store.size; },
  };
  globalThis.window = globalThis.window || {};
  globalThis.window.localStorage = mem;
  // No-op event wiring for tests — listeners won't fire, but none of
  // the units under test rely on them.
  globalThis.window.addEventListener = globalThis.window.addEventListener || (() => {});
  globalThis.window.removeEventListener = globalThis.window.removeEventListener || (() => {});
  return mem;
}

import {
  getNetworkStatus, subscribeNetworkStatus,
  setOnlineForTesting, setLastSyncAt,
} from '../../../src/lib/network/networkStatus.js';
import {
  enqueueAction, listQueue, markSynced, markFailure, pendingCount,
  hasPending, clearQueue, pruneSynced,
} from '../../../src/lib/sync/offlineQueue.js';
import { syncPending } from '../../../src/lib/sync/syncEngine.js';
import {
  updateCache, updateCacheBulk, getCached, getCacheUpdatedAt, clearCache,
} from '../../../src/lib/offline/offlineCache.js';
import {
  markTaskComplete, skipTask, getTodayTasks, resetForFarm,
} from '../../../src/lib/dailyTasks/taskScheduler.js';
import { chooseChannels } from '../../../src/lib/notifications/channelRouter.js';

beforeEach(() => {
  installMemoryStorage();
  clearQueue();
  clearCache();
  setOnlineForTesting(true);
});

// ─── networkStatus ───────────────────────────────────────────────
describe('networkStatus', () => {
  it('snapshot reflects the current online state', () => {
    expect(getNetworkStatus().online).toBe(true);
    setOnlineForTesting(false);
    expect(getNetworkStatus().online).toBe(false);
  });

  it('subscribers receive a snapshot on subscribe + on every change', () => {
    const got = [];
    const unsub = subscribeNetworkStatus((s) => got.push(s.online));
    setOnlineForTesting(false);
    setOnlineForTesting(true);
    unsub();
    // [initial, offline, online] at minimum — exact ordering varies
    // depending on the initial state, but the latest value is true.
    expect(got[got.length - 1]).toBe(true);
    expect(got).toContain(false);
  });

  it('setLastSyncAt persists to localStorage and updates snapshot', () => {
    setLastSyncAt(1_700_000_000_000);
    expect(getNetworkStatus().lastSyncAt).toBe(1_700_000_000_000);
    expect(window.localStorage.getItem('farroway.lastSyncAt')).toBe('1700000000000');
  });
});

// ─── offlineQueue ────────────────────────────────────────────────
describe('offlineQueue', () => {
  it('enqueueAction stores defaults and increments pendingCount', () => {
    expect(pendingCount()).toBe(0);
    const row = enqueueAction({ type: 'task_complete', farmId: 'f1', taskId: 't1' });
    expect(row).not.toBeNull();
    expect(row.type).toBe('task_complete');
    expect(row.synced).toBe(false);
    expect(pendingCount()).toBe(1);
    expect(hasPending()).toBe(true);
  });

  it('dedupKey blocks a second unsynced entry', () => {
    const first  = enqueueAction({ type: 'task_complete', dedupKey: 'k1' });
    const second = enqueueAction({ type: 'task_complete', dedupKey: 'k1' });
    expect(first.id).toBe(second.id);
    expect(pendingCount()).toBe(1);
  });

  it('markSynced and markFailure update rows in place', () => {
    const row = enqueueAction({ type: 'task_complete', dedupKey: 'k2' });
    markFailure(row.id, new Error('offline'));
    let [updated] = listQueue();
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toBe('offline');
    markSynced(row.id);
    [updated] = listQueue();
    expect(updated.synced).toBe(true);
    expect(updated.syncedAt).not.toBeNull();
  });

  it('pruneSynced drops synced entries older than 24h', () => {
    const row = enqueueAction({ type: 'x' });
    markSynced(row.id);
    // Fake age: backdate syncedAt directly in storage.
    const list = JSON.parse(window.localStorage.getItem('farroway.offlineQueue.v1'));
    list[0].syncedAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
    window.localStorage.setItem('farroway.offlineQueue.v1', JSON.stringify(list));
    const dropped = pruneSynced();
    expect(dropped).toBe(1);
    expect(listQueue().length).toBe(0);
  });
});

// ─── taskScheduler ↔ offline queue ──────────────────────────────
describe('taskScheduler offline wiring', () => {
  it('markTaskComplete enqueues a task_complete action', () => {
    // Seed a task for today so the scheduler has something to flip.
    const farm = { id: 'f1', crop: 'maize', farmType: 'small_farm',
                   cropStage: 'mid_growth' };
    resetForFarm('f1');
    const plan = getTodayTasks({ farm, weather: { status: 'ok' },
      now: new Date() });
    const tid = plan.tasks[0].id;
    markTaskComplete('f1', tid);

    const q = listQueue({ pendingOnly: true });
    expect(q.length).toBe(1);
    expect(q[0].type).toBe('task_complete');
    expect(q[0].taskId).toBe(tid);
  });

  it('skipTask enqueues a task_skip action', () => {
    const farm = { id: 'f2', crop: 'maize', farmType: 'small_farm',
                   cropStage: 'mid_growth' };
    resetForFarm('f2');
    const plan = getTodayTasks({ farm, weather: { status: 'ok' },
      now: new Date() });
    const tid = plan.tasks[0].id;
    skipTask('f2', tid);

    const q = listQueue({ pendingOnly: true, type: 'task_skip' });
    expect(q.length).toBe(1);
    expect(q[0].taskId).toBe(tid);
  });

  it('dedup prevents a second complete for the same task while offline', () => {
    const farm = { id: 'f3', crop: 'maize', farmType: 'small_farm',
                   cropStage: 'mid_growth' };
    resetForFarm('f3');
    const plan = getTodayTasks({ farm, weather: { status: 'ok' },
      now: new Date() });
    const tid = plan.tasks[0].id;
    markTaskComplete('f3', tid);
    markTaskComplete('f3', tid);     // repeat
    expect(pendingCount()).toBe(1);
  });
});

// ─── syncEngine ──────────────────────────────────────────────────
describe('syncEngine.syncPending', () => {
  it('is a no-op when offline and reports skipped count', async () => {
    enqueueAction({ type: 'task_complete' });
    setOnlineForTesting(false);
    const transport = { send: async () => ({ ok: true }) };
    const r = await syncPending({ transport });
    expect(r.attempted).toBe(0);
    expect(r.skipped).toBeGreaterThan(0);
    expect(pendingCount()).toBe(1);
  });

  it('drains pending items when online and marks them synced', async () => {
    enqueueAction({ type: 'task_complete', dedupKey: 'a' });
    enqueueAction({ type: 'task_skip',     dedupKey: 'b' });
    setOnlineForTesting(true);
    const transport = { send: async () => ({ ok: true }) };
    const r = await syncPending({ transport });
    expect(r.attempted).toBe(2);
    expect(r.succeeded).toBe(2);
    expect(pendingCount()).toBe(0);
    expect(getNetworkStatus().lastSyncAt).not.toBeNull();
  });

  it('duplicate server code also counts as synced (idempotent retry)', async () => {
    enqueueAction({ type: 'task_complete', dedupKey: 'dup' });
    const transport = { send: async () => ({ ok: false, code: 'duplicate' }) };
    const r = await syncPending({ transport });
    expect(r.succeeded).toBe(1);
    expect(pendingCount()).toBe(0);
  });

  it('failed actions stay queued with attempts + lastError', async () => {
    enqueueAction({ type: 'task_complete', dedupKey: 'x' });
    const transport = { send: async () => ({ ok: false, code: 'server_error' }) };
    await syncPending({ transport });
    const [row] = listQueue();
    expect(row.synced).toBe(false);
    expect(row.attempts).toBe(1);
    expect(row.lastError).toMatch(/server_error|unknown/);
  });

  it('transport throws do not crash the engine', async () => {
    enqueueAction({ type: 'task_complete', dedupKey: 'y' });
    const transport = { send: async () => { throw new Error('boom'); } };
    const r = await syncPending({ transport });
    expect(r.failed).toBe(1);
    expect(pendingCount()).toBe(1);
  });
});

// ─── offlineCache ────────────────────────────────────────────────
describe('offlineCache', () => {
  it('stores and retrieves each core key with updatedAt stamp', () => {
    updateCache({ key: 'farm', value: { id: 'f1', crop: 'maize' } });
    const got = getCached('farm');
    expect(got.id).toBe('f1');
    expect(getCacheUpdatedAt('farm')).not.toBeNull();
  });

  it('updateCacheBulk writes many keys at once', () => {
    updateCacheBulk({
      language: 'fr',
      tasks: [{ id: 't1' }],
      farmSummary: { crop: 'maize' },
    });
    expect(getCached('language')).toBe('fr');
    expect(getCached('tasks').length).toBe(1);
    expect(getCached('farmSummary').crop).toBe('maize');
  });

  it('returns the default per-key when unset (never throws)', () => {
    expect(getCached('farm')).toBeNull();
    expect(getCached('tasks')).toEqual([]);
    expect(getCached('language')).toBe('en');
  });

  it('ignores unknown keys (canonical values never get corrupted)', () => {
    updateCache({ key: 'not_a_real_key', value: 'oops' });
    expect(getCached('not_a_real_key')).toBeNull();
  });
});

// ─── Phone-first routing in channelRouter ───────────────────────
describe('channelRouter — phone-first / SMS fallback rules', () => {
  const phoneOnly = { id: 'u1', phone: '+254712345678' };
  const emailOnly = { id: 'u2', email: 'a@b.com' };
  const both      = { id: 'u3', email: 'a@b.com', phone: '+254712345678' };

  it('password reset: phone-only user → SMS with phone_only_primary reason', () => {
    const plans = chooseChannels({
      candidate: { type: 'password_reset_notification', priority: 'high' },
      preferences: { smsEnabled: true },
      user: phoneOnly,
    });
    const sms = plans.find((p) => p.channel === 'sms');
    expect(sms).toBeDefined();
    expect(sms.reason).toBe('phone_only_primary');
    expect(plans.find((p) => p.channel === 'email')).toBeUndefined();
  });

  it('password reset: email user → email first, no SMS needed', () => {
    const plans = chooseChannels({
      candidate: { type: 'password_reset_notification', priority: 'high' },
      preferences: { smsEnabled: false },
      user: emailOnly,
    });
    expect(plans[0].channel).toBe('email');
    expect(plans.find((p) => p.channel === 'sms' && p.canSend)).toBeUndefined();
  });

  it('invite: phone-only user → SMS invite when smsEnabled', () => {
    const plans = chooseChannels({
      candidate: { type: 'invite_notification', priority: 'medium' },
      preferences: { smsEnabled: true },
      user: phoneOnly,
    });
    const sms = plans.find((p) => p.channel === 'sms');
    expect(sms).toBeDefined();
    expect(sms.reason).toBe('phone_only_primary');
  });

  it('high-risk alert: phone-only user gets SMS even without smsEnabled preference', () => {
    const plans = chooseChannels({
      candidate: { type: 'risk_alert', priority: 'high' },
      preferences: { riskAlertsEnabled: true, smsEnabled: false },
      user: phoneOnly,
    });
    const sms = plans.find((p) => p.channel === 'sms');
    expect(sms).toBeDefined();
    expect(sms.reason).toBe('phone_only_critical');
  });

  it('high-risk alert: dual-channel user gets in_app + SMS + email on high priority', () => {
    const plans = chooseChannels({
      candidate: { type: 'risk_alert', priority: 'high' },
      preferences: { riskAlertsEnabled: true, smsEnabled: true, emailEnabled: true },
      user: both,
    });
    const chans = plans.map((p) => p.channel);
    expect(chans).toContain('in_app');
    expect(chans).toContain('sms');
    expect(chans).toContain('email');
  });

  it('daily reminder: SMS is NOT added unless user opted in (no spam)', () => {
    const plans = chooseChannels({
      candidate: { type: 'daily_task_reminder', priority: 'medium' },
      preferences: { dailyReminderEnabled: true, smsEnabled: false },
      user: phoneOnly,
    });
    expect(plans.find((p) => p.channel === 'sms')).toBeUndefined();
  });
});
