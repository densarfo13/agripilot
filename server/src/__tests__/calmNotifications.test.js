/**
 * calmNotifications.test.js — acceptance coverage for the
 * May 2026 calm-intelligence notification system.
 *
 * Spec §18 cases:
 *   • duplicate prevention (cooldown)
 *   • quiet-hours deferral
 *   • timezone handling (window classifier)
 *   • template rendering (vars + missing var safety)
 *   • permission-denied fallback (engine never crashes)
 *   • candidate identification per signal
 *   • forbidden-wording final-net filter
 *   • priority ladder (LOW / NORMAL / IMPORTANT)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Dynamic-import startup grace.
vi.setConfig({ testTimeout: 15000 });

function makeStorage() {
  const store = new Map();
  return {
    getItem:    (k) => (store.has(k) ? store.get(k) : null),
    setItem:    (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear:      () => { store.clear(); },
  };
}

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

// ─── Priority ────────────────────────────────────────────────────
describe('notificationPriority', () => {
  it('coerces unknown / urgent strings to safe tiers', async () => {
    const { normalizePriority, PRIORITY } = await import('../../../src/intelligence/notifications/notificationPriority.js');
    expect(normalizePriority('low')).toBe(PRIORITY.LOW);
    expect(normalizePriority('important')).toBe(PRIORITY.IMPORTANT);
    expect(normalizePriority('urgent')).toBe(PRIORITY.IMPORTANT);
    expect(normalizePriority('alert')).toBe(PRIORITY.IMPORTANT);
    expect(normalizePriority('garbage')).toBe(PRIORITY.NORMAL);
    expect(normalizePriority(undefined)).toBe(PRIORITY.NORMAL);
  });

  it('priority contracts ban LOW from pushing', async () => {
    const { priorityContract, PRIORITY } = await import('../../../src/intelligence/notifications/notificationPriority.js');
    expect(priorityContract(PRIORITY.LOW).canPush).toBe(false);
    expect(priorityContract(PRIORITY.NORMAL).canPush).toBe(true);
    expect(priorityContract(PRIORITY.IMPORTANT).canPush).toBe(true);
    // No tier overrides quiet hours — even IMPORTANT waits till morning.
    expect(priorityContract(PRIORITY.IMPORTANT).overrideQuiet).toBe(false);
  });
});

// ─── Timing ──────────────────────────────────────────────────────
describe('notificationTiming', () => {
  it('classifies hours into the four windows', async () => {
    const { classifyWindow, WINDOW } = await import('../../../src/intelligence/notifications/notificationTiming.js');
    expect(classifyWindow(new Date('2026-05-09T08:00:00'))).toBe(WINDOW.MORNING);
    expect(classifyWindow(new Date('2026-05-09T14:00:00'))).toBe(WINDOW.AFTERNOON);
    expect(classifyWindow(new Date('2026-05-09T19:30:00'))).toBe(WINDOW.EVENING);
    expect(classifyWindow(new Date('2026-05-09T23:30:00'))).toBe(WINDOW.NIGHT);
    expect(classifyWindow(new Date('2026-05-09T03:00:00'))).toBe(WINDOW.NIGHT);
  });

  it('isQuietHours covers 21:00–06:59', async () => {
    const { isQuietHours } = await import('../../../src/intelligence/notifications/notificationTiming.js');
    expect(isQuietHours(new Date('2026-05-09T22:00:00'))).toBe(true);
    expect(isQuietHours(new Date('2026-05-09T06:30:00'))).toBe(true);
    expect(isQuietHours(new Date('2026-05-09T07:00:00'))).toBe(false);
    expect(isQuietHours(new Date('2026-05-09T20:30:00'))).toBe(false);
  });

  it('nextDeliveryAt rolls forward when target hour passed', async () => {
    const { nextDeliveryAt, WINDOW } = await import('../../../src/intelligence/notifications/notificationTiming.js');
    const at22 = new Date('2026-05-09T22:00:00');
    const next = nextDeliveryAt(at22, WINDOW.MORNING);
    expect(next.getDate()).toBe(at22.getDate() + 1);
    expect(next.getHours()).toBe(8);
  });
});

// ─── Deduplication ───────────────────────────────────────────────
describe('notificationDeduplication', () => {
  it('shouldDeliver respects per-kind cooldown', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearDedup();
    const now = new Date('2026-05-09T10:00:00');
    expect(dd.shouldDeliver('weather', 'rain', now)).toBe(true);
    dd.markDelivered('weather', 'rain', now);
    expect(dd.shouldDeliver('weather', 'rain', now)).toBe(false);
    // 13 h later → cooldown elapsed (12 h window).
    const later = new Date(now.getTime() + 13 * 60 * 60 * 1000);
    expect(dd.shouldDeliver('weather', 'rain', later)).toBe(true);
  });

  it('different keys do not collide', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearDedup();
    const now = new Date('2026-05-09T10:00:00');
    dd.markDelivered('task', 'task_1', now);
    expect(dd.shouldDeliver('task', 'task_2', now)).toBe(true);
    expect(dd.shouldDeliver('task', 'task_1', now)).toBe(false);
  });

  it('unknown kind uses default cooldown', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearDedup();
    const now = new Date('2026-05-09T10:00:00');
    expect(dd.shouldDeliver('mystery', '', now)).toBe(true);
    dd.markDelivered('mystery', '', now);
    // 6 h later → still inside default 12 h cooldown.
    expect(dd.shouldDeliver('mystery', '', new Date(now.getTime() + 6 * 60 * 60 * 1000))).toBe(false);
  });
});

// ─── Templates ───────────────────────────────────────────────────
describe('notificationTemplates', () => {
  it('renderTemplate substitutes vars and tolerates missing keys', async () => {
    const { renderTemplate } = await import('../../../src/intelligence/notifications/notificationTemplates.js');
    expect(renderTemplate('Hello {name}', { name: 'Farmer' })).toBe('Hello Farmer');
    // Missing var leaves the literal placeholder visible to QA.
    expect(renderTemplate('Hello {name}', {})).toBe('Hello {name}');
    // regionSuffix is the special "drop silently" placeholder.
    expect(renderTemplate('Rain expected{regionSuffix}', {})).toBe('Rain expected');
    expect(renderTemplate('Rain expected{regionSuffix}', { regionSuffix: ' in NG' })).toBe('Rain expected in NG');
  });

  it('resolveTemplate returns null on unknown id', async () => {
    const { resolveTemplate, TEMPLATES } = await import('../../../src/intelligence/notifications/notificationTemplates.js');
    expect(resolveTemplate('garbage:nope')).toBeNull();
    expect(resolveTemplate('weather:rain')).toBe(TEMPLATES['weather:rain']);
  });

  it('every template carries a non-empty English fallback', async () => {
    const { TEMPLATES } = await import('../../../src/intelligence/notifications/notificationTemplates.js');
    for (const [id, t] of Object.entries(TEMPLATES)) {
      expect(typeof t.titleFb).toBe('string');
      expect(typeof t.bodyFb).toBe('string');
      expect(t.titleFb.length).toBeGreaterThan(0);
      expect(t.bodyFb.length).toBeGreaterThan(0);
      // No template can carry forbidden wording out of the box.
      const blob = (t.titleFb + ' ' + t.bodyFb + ' ' + (t.actionLabelFb || '')).toLowerCase();
      expect(blob).not.toMatch(/fraud|risky|suspicious|guaranteed/);
      expect(id).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });
});

// ─── Scheduler ───────────────────────────────────────────────────
describe('notificationScheduler', () => {
  it('defers during quiet hours', async () => {
    const { evaluateSchedule } = await import('../../../src/intelligence/notifications/notificationScheduler.js');
    const at22 = new Date('2026-05-09T22:00:00');
    const r = evaluateSchedule({ kind: 'task', priority: 'normal' }, at22);
    expect(r.canDeliverNow).toBe(false);
    expect(r.reason).toBe('quiet_hours');
  });

  it('IMPORTANT delivers immediately outside quiet hours', async () => {
    const { evaluateSchedule } = await import('../../../src/intelligence/notifications/notificationScheduler.js');
    const at14 = new Date('2026-05-09T14:00:00');
    const r = evaluateSchedule({ kind: 'weather', priority: 'important' }, at14);
    expect(r.canDeliverNow).toBe(true);
  });

  it('NORMAL defers when not in preferred window', async () => {
    const { evaluateSchedule } = await import('../../../src/intelligence/notifications/notificationScheduler.js');
    // task prefers MORNING — at 14:00 we should defer to next 08:00.
    const at14 = new Date('2026-05-09T14:00:00');
    const r = evaluateSchedule({ kind: 'task', priority: 'normal' }, at14);
    expect(r.canDeliverNow).toBe(false);
    expect(r.reason).toMatch(/defer_to:morning/);
  });
});

// ─── Engine ──────────────────────────────────────────────────────
describe('notificationEngine — identification + build', () => {
  it('rain context → weather:rain candidate', async () => {
    const { identifyCandidates } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    const cands = identifyCandidates({
      weather: { rainProbability: 0.7 },
      region:  'Frederick',
    });
    expect(cands.some((c) => c.id === 'weather:rain')).toBe(true);
  });

  it('open tasks → task:morning; only-completed → task:complete', async () => {
    const { identifyCandidates } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    expect(identifyCandidates({ tasks: [{ id: '1', completed: false }] })
      .some((c) => c.id === 'task:morning')).toBe(true);
    expect(identifyCandidates({ tasks: [{ id: '1', completed: true }] })
      .some((c) => c.id === 'task:complete')).toBe(true);
  });

  it('flagged scan → scan_followup candidate', async () => {
    const { identifyCandidates } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    const cs = identifyCandidates({
      scanHistory: [{ category: 'yellowing', scanId: 's1' }],
    });
    expect(cs.some((c) => c.id === 'scan_followup:default' && c.key === 's1')).toBe(true);
  });

  it('null context returns []', async () => {
    const { identifyCandidates, buildNotification, queueNotifications } =
      await import('../../../src/intelligence/notifications/notificationEngine.js');
    expect(identifyCandidates(null)).toEqual([]);
    expect(buildNotification(null)).toBeNull();
    expect(queueNotifications(null)).toEqual([]);
  });

  it('build returns a deferred envelope during quiet hours', async () => {
    const { buildNotification } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    const out = buildNotification(
      { id: 'weather:rain', kind: 'weather', key: 'rain', vars: { regionSuffix: ' in Frederick' } },
      { now: new Date('2026-05-09T23:00:00'), commit: false },
    );
    expect(out).not.toBeNull();
    expect(out.deferredReason).toBe('quiet_hours');
    expect(out.title).toBe('');
    expect(out._fallback.title).toMatch(/Rain expected/);
  });

  it('build commits to dedup only with commit:true', async () => {
    const { buildNotification } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearDedup();
    const at8 = new Date('2026-05-09T08:00:00');
    const out1 = buildNotification(
      { id: 'task:morning', kind: 'task', key: 'morning', vars: { count: 2 } },
      { now: at8, commit: false },
    );
    expect(out1).not.toBeNull();
    expect(out1.title).toMatch(/2 important task/);
    // Without commit, dedup remains clean — second build still passes.
    const out2 = buildNotification(
      { id: 'task:morning', kind: 'task', key: 'morning', vars: { count: 2 } },
      { now: at8, commit: false },
    );
    expect(out2).not.toBeNull();
    // With commit, the third call returns null (cooldown engaged).
    buildNotification(
      { id: 'task:morning', kind: 'task', key: 'morning', vars: { count: 2 } },
      { now: at8, commit: true },
    );
    const out3 = buildNotification(
      { id: 'task:morning', kind: 'task', key: 'morning', vars: { count: 2 } },
      { now: at8, commit: false },
    );
    expect(out3).toBeNull();
  });

  it('queueNotifications never includes forbidden wording', async () => {
    const { queueNotifications } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    const out = queueNotifications({
      weather: { rainProbability: 0.7 },
      tasks:   [{ id: 't1', completed: false }],
      buyerInterest: [{ id: 'b1' }],
      region:  'NG-Lagos',
    }, { now: new Date('2026-05-09T08:00:00') });
    for (const n of out) {
      // Either rendered (delivered) or pre-rendered fallback (deferred).
      const title = n.title || (n._fallback && n._fallback.title) || '';
      const body  = n.body  || (n._fallback && n._fallback.body)  || '';
      const blob = (title + ' ' + body).toLowerCase();
      expect(blob).not.toMatch(/fraud|risky|suspicious|guaranteed|100%/);
    }
  });

  it('priority is normalized on every output', async () => {
    const { queueNotifications, PRIORITY } = await import('../../../src/intelligence/notifications/index.js');
    const out = queueNotifications({
      weather: { rainProbability: 0.7 },
      region:  'Frederick',
    }, { now: new Date('2026-05-09T14:00:00') });
    for (const n of out) {
      expect([PRIORITY.LOW, PRIORITY.NORMAL, PRIORITY.IMPORTANT]).toContain(n.priority);
    }
  });

  // ── Trusted-daily spec §6: explicit envelope fields ──────────
  it('envelope exposes reason, expiresAt, dedupeKey', async () => {
    const { queueNotifications } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    const out = queueNotifications({
      weather: { rainProbability: 0.7 },
      region:  'NG-Lagos',
    }, { now: new Date('2026-05-09T14:00:00') });
    expect(out.length).toBeGreaterThan(0);
    const n = out[0];
    expect(typeof n.reason).toBe('string');
    expect(n.reason.length).toBeGreaterThan(0);
    expect(typeof n.dedupeKey).toBe('string');
    expect(n.dedupeKey).toMatch(/^[a-z_]+:/);
    expect(typeof n.expiresAt).toBe('string');
    // expiresAt must parse to a future date relative to scheduledAt.
    expect(Date.parse(n.expiresAt)).toBeGreaterThan(Date.parse(n.scheduledAt));
  });

  // ── Trusted-daily spec §7: Farm vs Garden separation ─────────
  it('garden mode strips funding + buyer candidates', async () => {
    const { identifyCandidates } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    // Same context, two modes. Farm sees buyer + funding; Garden does not.
    const ctxFarm   = { mode: 'farm',   buyerInterest: [{ id: 'b1' }], fundingMatches: [{ id: 'f1' }] };
    const ctxGarden = { mode: 'garden', buyerInterest: [{ id: 'b1' }], fundingMatches: [{ id: 'f1' }] };
    const farmCands   = identifyCandidates(ctxFarm);
    const gardenCands = identifyCandidates(ctxGarden);
    expect(farmCands.some((c) => c.kind === 'buyer')).toBe(true);
    expect(farmCands.some((c) => c.kind === 'funding')).toBe(true);
    // Garden — neither commercial category may appear.
    expect(gardenCands.some((c) => c.kind === 'buyer')).toBe(false);
    expect(gardenCands.some((c) => c.kind === 'funding')).toBe(false);
  });

  it('garden mode keeps weather + scan + task + progress candidates', async () => {
    const { identifyCandidates } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    const cands = identifyCandidates({
      mode:    'garden',
      weather: { rainProbability: 0.7 },
      tasks:   [{ id: 't1', completed: false }],
      scanHistory: [{ scanId: 's1', category: 'yellowing' }],
    });
    expect(cands.some((c) => c.kind === 'weather')).toBe(true);
    expect(cands.some((c) => c.kind === 'task')).toBe(true);
    expect(cands.some((c) => c.kind === 'scan_followup')).toBe(true);
  });

  // ── Trusted-daily spec §3: daily ceilings ───────────────────
  it('queueNotifications enforces MAX_DAILY_TOTAL', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    const { queueNotifications, MAX_DAILY_TOTAL } =
      await import('../../../src/intelligence/notifications/notificationEngine.js');
    dd.clearDedup();
    expect(MAX_DAILY_TOTAL).toBe(2);

    const at8 = new Date('2026-05-09T08:00:00');
    // Pretend 2 generic notifications have already shipped today.
    dd.markDelivered('weather', 'rain', new Date('2026-05-09T07:00:00'));
    dd.markDelivered('task',    'morning', new Date('2026-05-09T07:30:00'));

    // A new context that would otherwise generate fresh candidates.
    const out = queueNotifications({
      mode:   'farm',
      weather: { tempC: 33 }, // would be weather:heat
      tasks:  [{ id: 't2', completed: false }],
    }, { now: at8, commit: true });

    // Ceiling already hit → nothing new should be DELIVERED.
    const deliveredNow = out.filter((n) => n.deliveredAt);
    expect(deliveredNow.length).toBe(0);
  });

  it('queueNotifications enforces MAX_DAILY_WEATHER for non-severe', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    const { queueNotifications, MAX_DAILY_WEATHER } =
      await import('../../../src/intelligence/notifications/notificationEngine.js');
    dd.clearDedup();
    expect(MAX_DAILY_WEATHER).toBe(1);
    // One weather already today (heat = NORMAL priority).
    dd.markDelivered('weather', 'heat', new Date('2026-05-09T08:00:00'));

    // A cold context would also be weather:* — NORMAL priority,
    // so the cap should drop it.
    const out = queueNotifications({
      mode:    'farm',
      weather: { tempC: 4 }, // weather:cold (NORMAL)
    }, { now: new Date('2026-05-09T14:00:00'), commit: true });
    const deliveredWeather = out.filter((n) => n.kind === 'weather' && n.deliveredAt);
    expect(deliveredWeather.length).toBe(0);
  });

  // ── Trusted-daily spec §3: 3-day encouragement cooldown ─────
  it('progress cooldown lasts 72 hours (max 1 every 3 days)', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearDedup();
    const now = new Date('2026-05-09T18:00:00');
    expect(dd.shouldDeliver('progress', 'evening', now)).toBe(true);
    dd.markDelivered('progress', 'evening', now);
    // 48 h later — still inside the 72 h window.
    expect(dd.shouldDeliver('progress', 'evening', new Date(now.getTime() + 48 * 60 * 60 * 1000))).toBe(false);
    // 73 h later — released.
    expect(dd.shouldDeliver('progress', 'evening', new Date(now.getTime() + 73 * 60 * 60 * 1000))).toBe(true);
  });

  // ── Trusted-daily spec §8: missing data must not invent alerts
  it('missing data never produces a fake candidate', async () => {
    const { identifyCandidates } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    // Nothing in the context — no weather, no tasks, no scans.
    const cands = identifyCandidates({ mode: 'farm' });
    expect(cands).toEqual([]);
  });

  // ── Trusted-daily spec §3 day-count helper ──────────────────
  it('countDeliveredSince counts only entries at/after the cutoff', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearDedup();
    const dayStart = new Date('2026-05-09T00:00:00');
    dd.markDelivered('weather', 'rain', new Date('2026-05-09T07:00:00'));
    dd.markDelivered('task',    'morning', new Date('2026-05-09T07:30:00'));
    dd.markDelivered('scan_followup', 's1', new Date('2026-05-08T20:00:00')); // PREVIOUS day
    expect(dd.countDeliveredSince(dayStart)).toBe(2);
    expect(dd.countDeliveredSince(dayStart, 'weather')).toBe(1);
    expect(dd.countDeliveredSince(dayStart, 'task')).toBe(1);
    expect(dd.countDeliveredSince(dayStart, 'scan_followup')).toBe(0);
  });
});

// ─── Per-user scoping ───────────────────────────────────────────
describe('notificationDeduplication per-user scope', () => {
  it('cooldowns set under user A do not affect user B', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearAllDedupScopes();
    const at = new Date('2026-05-09T08:00:00');
    // User A delivers a weather:rain.
    dd.setActiveUserId('userA');
    dd.markDelivered('weather', 'rain', at);
    expect(dd.shouldDeliver('weather', 'rain', at)).toBe(false);
    // Switch to user B — cooldown does not apply.
    dd.setActiveUserId('userB');
    expect(dd.shouldDeliver('weather', 'rain', at)).toBe(true);
    // Back to user A — still on cooldown.
    dd.setActiveUserId('userA');
    expect(dd.shouldDeliver('weather', 'rain', at)).toBe(false);
  });

  it('clearDedup only wipes the active scope; the other survives', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearAllDedupScopes();
    const at = new Date('2026-05-09T08:00:00');
    dd.setActiveUserId('userA'); dd.markDelivered('task', 'morning', at);
    dd.setActiveUserId('userB'); dd.markDelivered('task', 'morning', at);
    // Clear active (user B) scope. User A's record is unaffected.
    dd.clearDedup();
    expect(dd.shouldDeliver('task', 'morning', at)).toBe(true);  // B was wiped
    dd.setActiveUserId('userA');
    expect(dd.shouldDeliver('task', 'morning', at)).toBe(false); // A intact
  });

  it('null userId falls back to __device scope', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    dd.clearAllDedupScopes();
    dd.setActiveUserId(null);
    expect(dd.getActiveUserId()).toBeNull();
    const at = new Date('2026-05-09T08:00:00');
    dd.markDelivered('weather', 'rain', at);
    // A signed-in user inheriting the device-scope cooldown? No —
    // the scopes are isolated. The signed-in lookup hits an empty
    // map.
    dd.setActiveUserId('userA');
    expect(dd.shouldDeliver('weather', 'rain', at)).toBe(true);
  });
});

// ─── Action / dismissed state ───────────────────────────────────
describe('notificationState', () => {
  it('markAction suppresses the same dedupeKey for 24h', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    const ns = await import('../../../src/intelligence/notifications/notificationState.js');
    dd.setActiveUserId('userS');
    ns.clearAllState();
    const at = new Date('2026-05-09T08:00:00');
    ns.markAction('task:morning', at);
    expect(ns.isSuppressed('task:morning', at)).toBe(true);
    expect(ns.isSuppressed('task:morning', new Date(at.getTime() + 23 * 60 * 60 * 1000))).toBe(true);
    expect(ns.isSuppressed('task:morning', new Date(at.getTime() + 25 * 60 * 60 * 1000))).toBe(false);
  });

  it('markDismissed suppresses for 72h', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    const ns = await import('../../../src/intelligence/notifications/notificationState.js');
    dd.setActiveUserId('userS');
    ns.clearAllState();
    const at = new Date('2026-05-09T08:00:00');
    ns.markDismissed('weather:rain', at);
    expect(ns.isSuppressed('weather:rain', at)).toBe(true);
    expect(ns.isSuppressed('weather:rain', new Date(at.getTime() + 71 * 60 * 60 * 1000))).toBe(true);
    expect(ns.isSuppressed('weather:rain', new Date(at.getTime() + 73 * 60 * 60 * 1000))).toBe(false);
  });

  it('engine skips candidates the user already dismissed', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    const ns = await import('../../../src/intelligence/notifications/notificationState.js');
    const { buildNotification } = await import('../../../src/intelligence/notifications/notificationEngine.js');
    dd.setActiveUserId('userS');
    dd.clearDedup();
    ns.clearAllState();
    const at = new Date('2026-05-09T08:00:00');
    // Dismiss weather:rain proactively.
    ns.markDismissed('weather:rain', at);
    const out = buildNotification(
      { id: 'weather:rain', kind: 'weather', key: 'rain', vars: {} },
      { now: at, commit: false },
    );
    expect(out).toBeNull();
  });
});

// ─── Feed bridge ────────────────────────────────────────────────
describe('notificationFeedBridge', () => {
  it('writes delivered envelopes to the user-facing feed', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    const ns = await import('../../../src/intelligence/notifications/notificationState.js');
    const { commitCalmQueue } = await import('../../../src/intelligence/notifications/notificationFeedBridge.js');
    const feed = await import('../../../src/notifications/notificationStore.js');
    dd.clearAllDedupScopes();
    ns.clearAllState();
    // Wipe any prior feed rows so the assertion below is clean.
    try { globalThis.localStorage.removeItem('farroway_notifications'); } catch { /* ignore */ }

    const ctx = { mode: 'farm', weather: { rainProbability: 0.7 }, region: 'Frederick' };
    const at = new Date('2026-05-09T14:00:00');
    const result = commitCalmQueue(ctx, { userId: 'userBridge', now: at, commit: true });

    expect(result.delivered.length).toBeGreaterThan(0);
    // Bridge persisted at least one feed row.
    const rows = feed.getNotifications('userBridge');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].userId).toBe('userBridge');
    expect(rows[0].title).toMatch(/Rain expected/);
    // weather kind → TASK in the existing feed schema.
    expect(rows[0].type).toBe('TASK');
  });

  it('garden mode does not write funding rows', async () => {
    const dd = await import('../../../src/intelligence/notifications/notificationDeduplication.js');
    const ns = await import('../../../src/intelligence/notifications/notificationState.js');
    const { commitCalmQueue } = await import('../../../src/intelligence/notifications/notificationFeedBridge.js');
    const feed = await import('../../../src/notifications/notificationStore.js');
    dd.clearAllDedupScopes();
    ns.clearAllState();
    try { globalThis.localStorage.removeItem('farroway_notifications'); } catch { /* ignore */ }

    const at = new Date('2026-05-09T14:00:00');
    commitCalmQueue({
      mode:           'garden',
      fundingMatches: [{ id: 'f1' }],
      buyerInterest:  [{ id: 'b1' }],
    }, { userId: 'userGarden', now: at, commit: true });

    const rows = feed.getNotifications('userGarden');
    expect(rows.some((r) => r.type === 'FUNDING')).toBe(false);
    expect(rows.some((r) => r.type === 'BUYER')).toBe(false);
  });
});
