/**
 * notificationGenerator.js — runs the rule list against live app
 * state and appends any new notifications via the store.
 *
 *   runNotificationChecks({
 *     now, tasks, completions, loopFacts, journey, weatherSummary,
 *     rules?,          // override for tests
 *     storeApi?,       // override { addNotification }
 *     dispatch?,       // override channel dispatcher
 *   }) → { created: Notification[], skipped: number }
 *
 * Pure logic — the only side-effects happen through the store and
 * dispatcher interfaces, which are dependency-injected. Safe to
 * call on every app-open.
 */

import { RULES } from '../../config/notificationRules.js';
import { addNotification as defaultAdd } from './notificationStore.js';
import { dispatchNotification as defaultDispatch } from './notificationDispatcher.js';

function toIsoDate(d) {
  const dt = d instanceof Date ? d : new Date(d || Date.now());
  if (!Number.isFinite(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayIso(d) {
  const base = d instanceof Date ? d : new Date(d || Date.now());
  const y = new Date(base.getTime() - 86400000);
  return toIsoDate(y);
}

export function runNotificationChecks({
  now,
  tasks = [],
  completions = [],
  loopFacts = null,
  journey = null,
  weatherSummary = null,
  rules,
  storeApi,
  dispatch,
} = {}) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const todayIso     = toIsoDate(d);
  const yIso         = yesterdayIso(d);

  const activeRules = Array.isArray(rules) && rules.length > 0 ? rules : RULES;
  const addFn       = typeof storeApi?.addNotification === 'function'
    ? storeApi.addNotification
    : defaultAdd;
  const dispatchFn  = typeof dispatch === 'function'
    ? dispatch
    : defaultDispatch;

  const ctx = {
    now:            d,
    todayIso,
    yesterdayIso:   yIso,
    tasks,
    completions,
    loopFacts,
    journey,
    weatherSummary,
  };

  const created = [];
  let skipped = 0;
  for (const rule of activeRules) {
    let eligible = false;
    try { eligible = !!rule.shouldFire(ctx); }
    catch { eligible = false; }
    if (!eligible) { skipped += 1; continue; }

    const key = typeof rule.keyFor === 'function'
      ? (rule.keyFor(ctx) || todayIso)
      : todayIso;
    const id = `${rule.id}:${key}`;

    let payload;
    try { payload = rule.build(ctx); }
    catch { payload = null; }
    if (!payload || !payload.messageKey) { skipped += 1; continue; }

    const row = addFn({
      id,
      type:        rule.type,
      priority:    rule.priority || 'medium',
      channel:     rule.channel || 'in_app',
      messageKey:  payload.messageKey,
      messageVars: payload.messageVars || null,
      data:        payload.data || null,
      createdAt:   d.getTime(),
      read:        false,
    });
    if (row && row.createdAt === d.getTime()) {
      // new entry — dispatch to the appropriate channel
      try { dispatchFn(row); } catch { /* dispatcher must never throw */ }
      created.push(row);
    } else {
      skipped += 1;
    }
  }
  return { created, skipped };
}

export const _internal = Object.freeze({ toIsoDate, yesterdayIso });
