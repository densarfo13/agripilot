/**
 * notificationFeed.test.js — notification store + rules + generator
 * + dispatcher.
 *
 * Spec §9:
 *   • trigger generation (each rule)
 *   • priority ordering
 *   • read/unread state
 *   • inactivity trigger
 *   • dedup (same rule, same day → one record)
 *   • dispatcher stubs never throw
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  addNotification, listNotifications, markAsRead, markAllAsRead,
  getUnreadCount, getTopNotification, clearNotifications, _keys,
} from '../../../src/lib/notifications/notificationStore.js';

import {
  runNotificationChecks, _internal as genInternals,
} from '../../../src/lib/notifications/notificationGenerator.js';

import {
  dispatchNotification, setPushAdapter, setSmsAdapter, setInAppAdapter,
  resetAdapters, _internal as dispatchInternals,
} from '../../../src/lib/notifications/notificationDispatcher.js';

import { RULES } from '../../../src/config/notificationRules.js';

function installLocalStorage() {
  const map = new Map();
  globalThis.window = {
    localStorage: {
      getItem:    (k) => map.has(k) ? map.get(k) : null,
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    },
  };
  return map;
}

// ─── Store ───────────────────────────────────────────────────────
describe('notificationStore', () => {
  beforeEach(() => { installLocalStorage(); });
  afterEach(()  => { delete globalThis.window; });

  it('addNotification dedupes by id', () => {
    addNotification({ id: 'n1', messageKey: 'x', priority: 'medium' });
    addNotification({ id: 'n1', messageKey: 'x', priority: 'high' });
    const list = listNotifications();
    expect(list.length).toBe(1);
    // first write wins — high is NOT overwritten
    expect(list[0].priority).toBe('medium');
  });

  it('list is sorted priority desc then createdAt desc', () => {
    addNotification({ id: 'a', messageKey: 'a', priority: 'low',    createdAt: 10 });
    addNotification({ id: 'b', messageKey: 'b', priority: 'high',   createdAt: 5  });
    addNotification({ id: 'c', messageKey: 'c', priority: 'medium', createdAt: 20 });
    const list = listNotifications();
    expect(list.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });

  it('markAsRead flips the flag + readAt', () => {
    addNotification({ id: 'a', messageKey: 'x', priority: 'medium' });
    markAsRead('a', { now: 1000 });
    const [n] = listNotifications();
    expect(n.read).toBe(true);
    expect(n.readAt).toBe(1000);
  });

  it('markAllAsRead flips every row', () => {
    addNotification({ id: 'a', messageKey: 'x', priority: 'high' });
    addNotification({ id: 'b', messageKey: 'x', priority: 'medium' });
    markAllAsRead({ now: 500 });
    const list = listNotifications();
    expect(list.every((n) => n.read)).toBe(true);
    expect(getUnreadCount()).toBe(0);
  });

  it('listNotifications can filter unread + limit', () => {
    addNotification({ id: 'a', messageKey: 'x', priority: 'high' });
    addNotification({ id: 'b', messageKey: 'x', priority: 'medium' });
    addNotification({ id: 'c', messageKey: 'x', priority: 'low' });
    markAsRead('a');
    expect(listNotifications({ unreadOnly: true }).length).toBe(2);
    expect(listNotifications({ unreadOnly: true, limit: 1 })).toHaveLength(1);
  });

  it('getTopNotification returns the highest unread', () => {
    addNotification({ id: 'a', messageKey: 'x', priority: 'low',    createdAt: 5  });
    addNotification({ id: 'b', messageKey: 'x', priority: 'high',   createdAt: 10 });
    addNotification({ id: 'c', messageKey: 'x', priority: 'medium', createdAt: 7  });
    expect(getTopNotification().id).toBe('b');
  });

  it('storage key namespaced + clearable', () => {
    expect(_keys.STORAGE_KEY.startsWith('farroway.')).toBe(true);
    addNotification({ id: 'a', messageKey: 'x' });
    clearNotifications();
    expect(listNotifications()).toEqual([]);
  });

  it('degrades safely without localStorage', () => {
    delete globalThis.window;
    expect(addNotification({ id: 'a', messageKey: 'x' })).toBeTruthy();
    expect(listNotifications()).toEqual([]); // read returns []
  });
});

// ─── Dispatcher stubs ────────────────────────────────────────────
describe('notificationDispatcher', () => {
  beforeEach(resetAdapters);

  it('in_app channel runs the registered adapter', () => {
    let seen = null;
    setInAppAdapter((n) => { seen = n; });
    const r = dispatchNotification({ id: 'x', channel: 'in_app', messageKey: 'x' });
    expect(r).toBe('ok');
    expect(seen.id).toBe('x');
  });

  it('push / sms silently no-op when no adapter registered', () => {
    expect(dispatchNotification({ channel: 'push', messageKey: 'x', id: 'p' }))
      .toBe('no_adapter');
    expect(dispatchNotification({ channel: 'sms',  messageKey: 'x', id: 's' }))
      .toBe('no_adapter');
  });

  it('push / sms adapters run when registered', async () => {
    let pushed = null, smsd = null;
    setPushAdapter(async (n) => { pushed = n.id; });
    setSmsAdapter (async (n) => { smsd = n.id; });
    expect(dispatchNotification({ channel: 'push', id: 'p', messageKey: 'x' })).toBe('ok');
    expect(dispatchNotification({ channel: 'sms',  id: 's', messageKey: 'x' })).toBe('ok');
    // Allow the microtasks to flush so the assertions below are valid.
    await Promise.resolve();
    expect(pushed).toBe('p');
    expect(smsd).toBe('s');
  });

  it('adapter throws → classified "error", never crashes', () => {
    setInAppAdapter(() => { throw new Error('boom'); });
    expect(dispatchNotification({ channel: 'in_app', id: 'e', messageKey: 'x' }))
      .toBe('error');
  });

  it('missing / invalid notif → noop', () => {
    expect(dispatchNotification(null)).toBe('noop');
    expect(dispatchNotification()).toBe('noop');
  });

  it('adapters list is introspectable', () => {
    const a = dispatchInternals.getAdapters();
    expect(typeof a.in_app).toBe('function');
  });
});

// ─── Rules + Generator ───────────────────────────────────────────
describe('runNotificationChecks — rules', () => {
  beforeEach(() => { installLocalStorage(); resetAdapters(); });
  afterEach(()  => { delete globalThis.window; });

  const NOW_MS = new Date(2026, 3, 20, 10, 0, 0).getTime();  // 2026-04-20 10:00
  const DAY = 86400000;

  it('daily reminder fires when today has uncompleted tasks', () => {
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [{ id: 't1' }, { id: 't2' }],
      completions: [],
    });
    const daily = r.created.find((n) => n.type === 'daily');
    expect(daily).toBeTruthy();
    expect(daily.messageVars.count).toBe(2);
    expect(daily.priority).toBe('medium');
  });

  it('daily reminder is deduped within the same day', () => {
    runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [{ id: 't1' }], completions: [],
    });
    const second = runNotificationChecks({
      now: new Date(NOW_MS + 3600_000),
      tasks: [{ id: 't1' }], completions: [],
    });
    const dailyCreatedAgain = second.created.find((n) => n.type === 'daily');
    expect(dailyCreatedAgain).toBeFalsy();
  });

  it('missed-tasks fires when yesterday had no completions but older history exists', () => {
    const older = NOW_MS - 5 * DAY;
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [], // nothing today
      completions: [{ taskId: 'ot', completed: true, timestamp: older }],
    });
    const missed = r.created.find((n) => n.type === 'missed');
    expect(missed).toBeTruthy();
    expect(missed.priority).toBe('high');
  });

  it('missed-tasks does NOT fire when yesterday had completions', () => {
    const yIso = new Date(NOW_MS - DAY);
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [],
      completions: [{ taskId: 't', completed: true, timestamp: yIso.getTime() }],
    });
    expect(r.created.find((n) => n.type === 'missed')).toBeFalsy();
  });

  it('stage alert fires when journey has a meaningful state', () => {
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [],
      completions: [],
      journey: { state: 'active_farming', enteredAt: NOW_MS, crop: 'maize' },
    });
    expect(r.created.find((n) => n.type === 'stage')).toBeTruthy();
  });

  it('stage alert dedups by enteredAt', () => {
    const journey = { state: 'active_farming', enteredAt: NOW_MS - DAY, crop: 'maize' };
    runNotificationChecks({ now: new Date(NOW_MS), journey, tasks: [], completions: [] });
    const second = runNotificationChecks({
      now: new Date(NOW_MS + DAY), journey, tasks: [], completions: [],
    });
    expect(second.created.find((n) => n.type === 'stage')).toBeFalsy();
  });

  it('harvest notification fires when journey is harvest', () => {
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [], completions: [],
      journey: { state: 'harvest', crop: 'maize', enteredAt: NOW_MS },
    });
    expect(r.created.find((n) => n.type === 'harvest')).toBeTruthy();
  });

  it('harvest notification fires at ~150 days after planting', () => {
    const plantedAt = NOW_MS - 170 * DAY;
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [], completions: [],
      journey: { state: 'active_farming', plantedAt, crop: 'maize' },
    });
    expect(r.created.find((n) => n.type === 'harvest')).toBeTruthy();
  });

  it('inactivity fires when missedDays ≥ 3', () => {
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [], completions: [],
      loopFacts: { missedDays: 4 },
    });
    const in1 = r.created.find((n) => n.type === 'inactivity');
    expect(in1).toBeTruthy();
    expect(in1.messageVars.days).toBe(4);
  });

  it('inactivity does NOT fire for a first-time user', () => {
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [], completions: [],
      loopFacts: { missedDays: 0 },
    });
    expect(r.created.find((n) => n.type === 'inactivity')).toBeFalsy();
  });

  it('RULES are frozen + stable', () => {
    expect(Object.isFrozen(RULES)).toBe(true);
    const ids = RULES.map((r) => r.id);
    expect(ids).toEqual([
      'daily_reminder', 'missed_tasks', 'stage_alert',
      'harvest_approaching', 'inactivity',
    ]);
  });

  it('generator honours the store override', () => {
    const bucket = [];
    const r = runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [{ id: 't1' }],
      completions: [],
      storeApi: { addNotification: (n) => { bucket.push(n); return n; } },
    });
    expect(bucket.length).toBeGreaterThan(0);
    expect(r.created.length).toBeGreaterThan(0);
  });

  it('generator honours the dispatcher override', () => {
    let dispatched = 0;
    runNotificationChecks({
      now: new Date(NOW_MS),
      tasks: [{ id: 't1' }],
      completions: [],
      dispatch: () => { dispatched += 1; },
    });
    expect(dispatched).toBeGreaterThan(0);
  });

  it('toIsoDate / yesterdayIso helpers are deterministic', () => {
    const d = new Date(2026, 0, 5);
    expect(genInternals.toIsoDate(d)).toBe('2026-01-05');
    expect(genInternals.yesterdayIso(d)).toBe('2026-01-04');
  });
});
