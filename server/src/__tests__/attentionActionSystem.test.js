/**
 * attentionActionSystem.test.js — priority scoring + quick actions +
 * daily contact suggestions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function installWindow() {
  const map = new Map();
  globalThis.window = {
    location: { pathname: '/admin/dashboard', search: '' },
    localStorage: {
      getItem:    (k) => (map.has(k) ? map.get(k) : null),
      setItem:    (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      key:        (i) => Array.from(map.keys())[i] || null,
      get length() { return map.size; },
    },
    addEventListener:    () => {},
    removeEventListener: () => {},
  };
}

beforeEach(() => { installWindow(); });
afterEach(() => { delete globalThis.window; });

const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime();
const DAY = 24 * 3600 * 1000;

// ─── Priority scoring ────────────────────────────────────────────
describe('scoreAttentionTarget', () => {
  it('empty input → score 0, priority low, reasons empty', async () => {
    const { scoreAttentionTarget } = await import('../../../src/lib/admin/attentionPriority.js');
    const r = scoreAttentionTarget({});
    expect(r.score).toBe(0);
    expect(r.priority).toBe('low');
    expect(r.reasons).toEqual([]);
  });

  it('big staple-crop farm with critical issue → high/critical', async () => {
    const { scoreAttentionTarget } = await import('../../../src/lib/admin/attentionPriority.js');
    const r = scoreAttentionTarget({
      farm:  { farmSize: 10, crop: 'maize' },
      issue: { severity: 'critical', createdAt: NOW - 20 * DAY },
      now:   NOW,
    });
    expect(['high', 'critical']).toContain(r.priority);
    expect(r.daysSince).toBeGreaterThanOrEqual(14);
    const ruleSet = new Set(r.reasons.map((x) => x.rule));
    expect(ruleSet.has('staple_crop')).toBe(true);
    expect(ruleSet.has('issue_severity')).toBe(true);
    expect(ruleSet.has('issue_14d_plus')).toBe(true);
  });

  it('small non-staple farm with low issue → medium or lower', async () => {
    const { scoreAttentionTarget } = await import('../../../src/lib/admin/attentionPriority.js');
    const r = scoreAttentionTarget({
      farm:  { farmSize: 0.8, crop: 'tomato' },
      issue: { severity: 'low', createdAt: NOW - 2 * DAY },
      now:   NOW,
    });
    expect(['low', 'medium']).toContain(r.priority);
  });

  it('inactive farm without issue still scores from inactivity bucket', async () => {
    const { scoreAttentionTarget } = await import('../../../src/lib/admin/attentionPriority.js');
    const r = scoreAttentionTarget({
      farm: { farmSize: 2, crop: 'maize', lastActivityAt: NOW - 30 * DAY },
      now:  NOW,
    });
    expect(r.score).toBeGreaterThan(0);
    expect(r.reasons.some((x) => x.rule === 'inactive_21d_plus')).toBe(true);
  });

  it('farm size weight is log-scaled and capped at 15', async () => {
    const { _internal } = await import('../../../src/lib/admin/attentionPriority.js');
    expect(_internal.farmSizeWeight(0.5)).toBe(0);
    expect(_internal.farmSizeWeight(10)).toBeGreaterThan(0);
    expect(_internal.farmSizeWeight(500)).toBeLessThanOrEqual(15);
  });
});

describe('sortByPriority', () => {
  it('sorts score desc, daysSince desc, stable on ties', async () => {
    const { sortByPriority } = await import('../../../src/lib/admin/attentionPriority.js');
    const list = [
      { farmId: 'a', score: 40, daysSince: 3 },
      { farmId: 'b', score: 40, daysSince: 10 },
      { farmId: 'c', score: 80, daysSince: 1 },
      { farmId: 'd', score: 20, daysSince: 0 },
    ];
    const r = sortByPriority(list);
    expect(r.map((x) => x.farmId)).toEqual(['c', 'b', 'a', 'd']);
  });
});

// ─── Action log ──────────────────────────────────────────────────
describe('admin action log', () => {
  it('logAdminAction writes a row the log can read back', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    const row = mod.logAdminAction({
      type: 'review', targetId: 'farm_1',
      actor: { role: 'admin', id: 'admin_7' },
      metadata: { note: 'contacted by phone' },
    });
    expect(row.id).toBeTruthy();
    expect(row.type).toBe('review');
    const log = mod.getAdminActionLog();
    expect(log).toHaveLength(1);
    expect(log[0].metadata.note).toBe('contacted by phone');
  });

  it('rejects empty/invalid types', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    expect(mod.logAdminAction({})).toBeNull();
    expect(mod.logAdminAction({ type: '' })).toBeNull();
  });

  it('caps the log at MAX_LOG_ROWS', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    for (let k = 0; k < mod._internal.MAX_LOG_ROWS + 50; k += 1) {
      mod.logAdminAction({ type: 'review', targetId: `f_${k}` });
    }
    expect(mod._internal.readLog().length).toBe(mod._internal.MAX_LOG_ROWS);
  });

  it('isReviewed honours the sinceTs filter', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    mod.markAttentionReviewed({ targetId: 'farm_1', now: 1000 });
    expect(mod.isReviewed('farm_1', { sinceTs: 0 })).toBe(true);
    expect(mod.isReviewed('farm_1', { sinceTs: 2000 })).toBe(false);
    expect(mod.isReviewed('farm_other', { sinceTs: 0 })).toBe(false);
  });

  it('getAdminActionLog filters by type + targetId + limit', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    mod.logAdminAction({ type: 'review',   targetId: 'f1' });
    mod.logAdminAction({ type: 'send_sms', targetId: 'f1' });
    mod.logAdminAction({ type: 'send_sms', targetId: 'f2' });
    const all = mod.getAdminActionLog();
    expect(all.length).toBe(3);
    expect(mod.getAdminActionLog({ type: 'send_sms' })).toHaveLength(2);
    expect(mod.getAdminActionLog({ targetId: 'f1' })).toHaveLength(2);
    expect(mod.getAdminActionLog({ type: 'send_sms', targetId: 'f2' })).toHaveLength(1);
    expect(mod.getAdminActionLog({ limit: 2 })).toHaveLength(2);
  });
});

// ─── Assign + SMS primitives ─────────────────────────────────────
describe('assignFarmerToOfficer', () => {
  it('writes an assign entry to the admin log', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    mod.assignFarmerToOfficer({ farmId: 'f1', officerId: 'ofc_1', adminId: 'a1' });
    const log = mod.getAdminActionLog({ type: 'assign_to_officer' });
    expect(log).toHaveLength(1);
    expect(log[0].metadata.officerId).toBe('ofc_1');
  });

  it('is a no-op on missing ids', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    expect(mod.assignFarmerToOfficer({})).toBeNull();
    expect(mod.assignFarmerToOfficer({ farmId: 'f1' })).toBeNull();
  });
});

describe('sendSmsReminder', () => {
  it('records a delivered=true when the endpoint returns ok', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    const fetchJson = vi.fn(async () => ({ ok: true }));
    const r = await mod.sendSmsReminder({
      phone: '+254700000001', message: 'Please check your farm today',
      targetId: 'f1', fetchJson,
    });
    expect(r.delivered).toBe(true);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    const log = mod.getAdminActionLog({ type: 'send_sms' });
    expect(log[0].metadata.delivered).toBe(true);
  });

  it('falls back to manual_share_ready on endpoint error', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    const fetchJson = vi.fn(async () => ({ ok: false, status: 500 }));
    const r = await mod.sendSmsReminder({
      phone: '+254700000002', message: 'Hello',
      targetId: 'f2', fetchJson,
    });
    expect(r.delivered).toBe(false);
    expect(r.channel).toBe('manual_share_ready');
  });

  it('rejects missing phone / message with a logged failure', async () => {
    const mod = await import('../../../src/lib/admin/attentionActions.js');
    const r = await mod.sendSmsReminder({ phone: '', message: 'x' });
    expect(r.delivered).toBe(false);
    expect(r.reason).toBe('missing_fields');
    const log = mod.getAdminActionLog({ type: 'send_sms' });
    expect(log[0].metadata.reason).toBe('missing_fields');
  });
});

// ─── Daily contact suggestions ───────────────────────────────────
describe('getDailyContactSuggestions', () => {
  it('returns top N sorted by score descending', async () => {
    const sugMod = await import('../../../src/lib/admin/attentionSuggestions.js');

    const farms = [
      { id: 'a', farmerName: 'Ada',  crop: 'maize',   farmSize: 10, phone: '+1', lastActivityAt: NOW - 30 * DAY },
      { id: 'b', farmerName: 'Ben',  crop: 'tomato',  farmSize: 1,  phone: '+2', lastActivityAt: NOW - 2  * DAY },
      { id: 'c', farmerName: 'Ceda', crop: 'cassava', farmSize: 5,  phone: '+3', lastActivityAt: NOW - 10 * DAY },
      { id: 'd', farmerName: 'Dan',  crop: 'wheat',   farmSize: 4,  phone: '+4' },
      { id: 'e', farmerName: 'Eve',  crop: 'onion',   farmSize: 0.5, phone: '+5' },
    ];
    const issues = [
      { id: 'i1', farmId: 'a', severity: 'critical', status: 'open', createdAt: NOW - 15 * DAY, updatedAt: NOW - 2 * DAY },
      { id: 'i2', farmId: 'c', severity: 'medium',   status: 'open', createdAt: NOW - 4  * DAY, updatedAt: NOW - DAY },
      { id: 'i3', farmId: 'd', severity: 'low',      status: 'open', createdAt: NOW - DAY,      updatedAt: NOW },
    ];

    const out = sugMod.getDailyContactSuggestions({
      farms, issues, events: [], now: NOW, limit: 5,
    });

    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(5);
    // Ada's critical long-running issue should be first.
    expect(out[0].farmerName).toBe('Ada');
    expect(out[0].issueId).toBe('i1');
    expect(out[0].daysSince).toBeGreaterThanOrEqual(14);
  });

  it('respects the limit param', async () => {
    const sugMod = await import('../../../src/lib/admin/attentionSuggestions.js');
    const farms = [];
    const issues = [];
    for (let k = 0; k < 10; k += 1) {
      farms.push({ id: `f_${k}`, crop: 'maize', farmSize: 5,
                   lastActivityAt: NOW - 20 * DAY });
    }
    const out = sugMod.getDailyContactSuggestions({
      farms, issues, events: [], now: NOW, limit: 3,
    });
    expect(out).toHaveLength(3);
  });

  it('excludes rows reviewed AFTER their latest update', async () => {
    const actMod = await import('../../../src/lib/admin/attentionActions.js');
    const sugMod = await import('../../../src/lib/admin/attentionSuggestions.js');

    const farms = [
      { id: 'a', crop: 'maize', farmSize: 5 },
      { id: 'b', crop: 'cassava', farmSize: 5 },
    ];
    const issues = [
      { id: 'i1', farmId: 'a', severity: 'high', status: 'open',
        createdAt: NOW - 10 * DAY, updatedAt: NOW - 5 * DAY },
      { id: 'i2', farmId: 'b', severity: 'high', status: 'open',
        createdAt: NOW - 10 * DAY, updatedAt: NOW - 5 * DAY },
    ];
    // Admin reviewed A after the latest update → A should drop off.
    actMod.markAttentionReviewed({ targetId: 'a', now: NOW - DAY });

    const out = sugMod.getDailyContactSuggestions({
      farms, issues, events: [], now: NOW, limit: 5,
    });
    const ids = out.map((r) => r.farmId);
    expect(ids).toContain('b');
    expect(ids).not.toContain('a');
  });

  it('re-surfaces when the target updates after the review', async () => {
    const actMod = await import('../../../src/lib/admin/attentionActions.js');
    const sugMod = await import('../../../src/lib/admin/attentionSuggestions.js');

    const farms = [{ id: 'a', crop: 'maize', farmSize: 5 }];
    // Reviewed at T-3. Issue then updated at T-1 → row should reappear.
    actMod.markAttentionReviewed({ targetId: 'a', now: NOW - 3 * DAY });
    const issues = [
      { id: 'i1', farmId: 'a', severity: 'high', status: 'open',
        createdAt: NOW - 5 * DAY, updatedAt: NOW - DAY },
    ];

    const out = sugMod.getDailyContactSuggestions({
      farms, issues, events: [], now: NOW, limit: 5,
    });
    expect(out.some((r) => r.farmId === 'a')).toBe(true);
  });
});
