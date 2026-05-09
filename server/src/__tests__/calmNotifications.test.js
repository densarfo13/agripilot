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
});
