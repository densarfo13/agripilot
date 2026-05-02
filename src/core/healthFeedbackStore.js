/**
 * healthFeedbackStore.js — micro health-feedback persistence
 * (Retention Loop spec §6).
 *
 *   import {
 *     recordHealthFeedback, getHealthFeedbackForToday,
 *   } from '../core/healthFeedbackStore.js';
 *
 *   recordHealthFeedback({
 *     contextId:    'garden_abc123',
 *     contextType:  'garden',          // 'garden' | 'farm'
 *     date:         '2026-05-02',
 *     healthFeedback: 'yes' | 'not_sure' | 'no',
 *   });
 *
 * Why a separate store
 * ────────────────────
 * Spec §6 mandates a 3-button (Yes / Not sure / No) prompt that
 * fires AFTER a task is marked done — non-blocking, optional,
 * and stored alongside the daily-completion log so admins can
 * later compute "% of completed days where the user reported
 * the plant looked healthy". That signal pairs with the streak
 * + completion counters to feed the NGO impact dashboard.
 *
 * The store is its own file (rather than a column on the
 * dailyTaskCompletion entry) because the feedback is OPTIONAL
 * and per-day, while task completions are per-action. Keeping
 * the surfaces separate means a missing feedback row doesn't
 * imply a missing completion, and the analytics query stays
 * clean.
 *
 * Strict-rule audit
 *   • Pure outside the localStorage I/O. Every read/write
 *     wrapped in try/catch — never throws.
 *   • Idempotent: calling recordHealthFeedback twice on the
 *     same (contextId, date) overwrites the previous answer
 *     with the new one (the user changed their mind). The
 *     timestamp is updated so admin views can still tell
 *     when the answer landed.
 *   • SSR-safe: every storage access guarded by typeof
 *     localStorage check.
 *   • Cap: rolling 200-entry window so a long-running session
 *     can't fill up localStorage. The oldest entries drop
 *     when the cap is hit.
 */

import { trackEvent } from '../analytics/analyticsStore.js';

export const HEALTH_FEEDBACK_KEY = 'farroway_health_feedback';
const MAX_ENTRIES = 200;

const ALLOWED_VALUES   = new Set(['yes', 'not_sure', 'no']);
const ALLOWED_CONTEXTS = new Set(['garden', 'farm']);

function _safeRead() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(HEALTH_FEEDBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeWrite(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(HEALTH_FEEDBACK_KEY, JSON.stringify(list));
  } catch { /* swallow — quota / private mode */ }
}

/** Format a Date as 'YYYY-MM-DD' in local time. */
function _localDayKey(date) {
  const d = (date instanceof Date) ? date : new Date(date || Date.now());
  if (Number.isNaN(d.getTime())) return null;
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Persist a feedback answer. Idempotent on (contextId, date) —
 * later calls overwrite earlier answers. Returns the entry that
 * was stored (or null if the input was invalid). Never throws.
 *
 * @param {object} input
 * @param {string} input.contextId      — gardenId or farmId
 * @param {string} input.contextType    — 'garden' | 'farm'
 * @param {string} [input.date]         — 'YYYY-MM-DD' (defaults to today)
 * @param {string} input.healthFeedback — 'yes' | 'not_sure' | 'no'
 */
export function recordHealthFeedback(input) {
  const i = (input && typeof input === 'object') ? input : {};
  const contextId   = (typeof i.contextId   === 'string' && i.contextId)   ? i.contextId   : null;
  const contextType = (typeof i.contextType === 'string' && ALLOWED_CONTEXTS.has(i.contextType))
    ? i.contextType : null;
  const value       = (typeof i.healthFeedback === 'string' && ALLOWED_VALUES.has(i.healthFeedback))
    ? i.healthFeedback : null;
  const date        = (typeof i.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.date))
    ? i.date : _localDayKey();

  if (!contextId || !contextType || !value || !date) return null;

  const list = _safeRead();
  // Drop any prior entry for the same (contextId, date) so the
  // store keeps "the latest answer the user gave today" rather
  // than a multi-row history. Date-grain dedupe matches the
  // spec — the prompt is a once-per-day question.
  const filtered = list.filter(
    (e) => !(e && e.contextId === contextId && e.date === date),
  );
  const entry = {
    contextId,
    contextType,
    date,
    healthFeedback: value,
    recordedAt: new Date().toISOString(),
  };
  filtered.push(entry);
  // Cap to the rolling window so localStorage doesn't grow
  // unbounded for a long-running pilot.
  const next = filtered.slice(-MAX_ENTRIES);
  _safeWrite(next);
  // Telemetry: an admin "Daily Health Feedback" surface can
  // then compute % positive / % negative / % unsure per
  // experience over a 7-day window. Strict rule §1 — wrapped
  // in try/catch so the store write never depends on the
  // analytics call landing.
  try {
    trackEvent('health_feedback_submitted', {
      contextType,
      healthFeedback: value,
      date,
    });
  } catch { /* swallow */ }
  return entry;
}

/**
 * Read today's feedback for a given context (so the card can
 * show "thanks" instead of re-prompting after the user has
 * already answered).
 *
 * @param {object} input
 * @param {string} input.contextId
 * @param {string} [input.date] — 'YYYY-MM-DD' (defaults to today)
 * @returns {string|null} — the stored value, or null if none.
 */
export function getHealthFeedbackForToday(input) {
  const i = (input && typeof input === 'object') ? input : {};
  if (typeof i.contextId !== 'string' || !i.contextId) return null;
  const date = (typeof i.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(i.date))
    ? i.date : _localDayKey();
  if (!date) return null;
  const list = _safeRead();
  const hit = list.find((e) => e && e.contextId === i.contextId && e.date === date);
  return (hit && hit.healthFeedback) || null;
}

/**
 * Aggregate feedback over the last N days. Used by admin /
 * NGO surfaces; not consumed inside the farmer-facing card.
 *
 * @param {number} [windowDays=7]
 * @returns {{ yes:number, no:number, not_sure:number, total:number }}
 */
export function aggregateRecentFeedback(windowDays = 7) {
  const list = _safeRead();
  const cutoff = Date.now() - Math.max(1, windowDays) * 24 * 60 * 60 * 1000;
  const counts = { yes: 0, no: 0, not_sure: 0, total: 0 };
  for (const e of list) {
    if (!e || !ALLOWED_VALUES.has(e.healthFeedback)) continue;
    const t = e.recordedAt ? new Date(e.recordedAt).getTime() : 0;
    if (!Number.isFinite(t) || t < cutoff) continue;
    counts[e.healthFeedback] += 1;
    counts.total += 1;
  }
  return counts;
}

export default { recordHealthFeedback, getHealthFeedbackForToday, aggregateRecentFeedback };
