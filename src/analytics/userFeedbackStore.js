/**
 * userFeedbackStore.js — local-first storage for the lightweight
 * post-action feedback prompt (final feedback-loop spec §1, §2).
 *
 * Storage
 *   farroway_user_feedback  : Array<{
 *     id, userId, role, experience, screen,
 *     feedbackType, feedbackText, timestamp,
 *   }>
 *
 *   farroway_feedback_session_shown : sessionStorage flag — set
 *     to 'true' after the prompt shows once this session so we
 *     don't spam the user.
 *
 * Public API
 *   saveFeedback(record)       → appends + analytics
 *   getFeedback()              → sorted newest-first
 *   getFeedbackByScreen()      → { [screen]: rows[] }
 *   getFeedbackByRole()        → { [role]: rows[] }
 *   requestUserFeedback(screen, ctx) → fires `farroway:request_feedback`
 *                                       window event for the host card
 *   markPromptShown()          → flips the session flag
 *   wasPromptShownThisSession()→ boolean read of the flag
 *   _resetFeedback()           → test/admin helper
 *
 * Strict-rule audit
 *   * Never throws — every storage call is try/catch wrapped.
 *   * Caps at 200 records per device so a runaway loop can't
 *     blow the 5 MB localStorage quota (matches marketStore).
 *   * Privacy: only the fields enumerated above are persisted.
 *     No phone, name, email — those never enter the record.
 *   * Pure ESM. No React imports — host component pulls the
 *     store separately.
 */

import { trackEvent } from './analyticsStore.js';

export const STORAGE_KEY        = 'farroway_user_feedback';
export const SESSION_FLAG_KEY   = 'farroway_feedback_session_shown';
export const REQUEST_EVENT      = 'farroway:request_feedback';

const MAX_ROWS = 200;

// Final feedback-loop spec §1 — canonical option set. The host
// component renders these in order; the classifier maps each
// `feedbackType` to a problem bucket.
export const FEEDBACK_OPTIONS = Object.freeze([
  { type: 'unclear_click',    labelKey: 'feedback.opt.unclearClick',
    fallback: 'I didn\u2019t know what to click' },
  { type: 'scan_not_obvious', labelKey: 'feedback.opt.scanNotObvious',
    fallback: 'Scan wasn\u2019t obvious' },
  { type: 'too_many_tasks',   labelKey: 'feedback.opt.tooManyTasks',
    fallback: 'Too many tasks' },
  { type: 'unclear_result',   labelKey: 'feedback.opt.unclearResult',
    fallback: 'Result wasn\u2019t clear' },
  { type: 'low_value',        labelKey: 'feedback.opt.lowValue',
    fallback: 'I wouldn\u2019t use this again' },
  { type: 'other',            labelKey: 'feedback.opt.other',
    fallback: 'Other' },
]);

function _hasStorage() {
  try { return typeof localStorage !== 'undefined'; }
  catch { return false; }
}

function _hasSessionStorage() {
  try { return typeof sessionStorage !== 'undefined'; }
  catch { return false; }
}

function _read() {
  if (!_hasStorage()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _write(rows) {
  if (!_hasStorage()) return false;
  try {
    const safe = Array.isArray(rows) ? rows.slice(-MAX_ROWS) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch { return false; }
}

function _readJson(key) {
  try {
    if (!_hasStorage()) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

function _uid() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* swallow */ }
  return `fb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function _ctxFromStorage() {
  const profile = _readJson('farroway_user_profile') || {};
  const farm    = _readJson('farroway_active_farm')  || {};
  const expRaw  = (() => {
    try { return localStorage.getItem('farroway_active_experience'); }
    catch { return null; }
  })();
  return {
    userId:     profile.id || profile.userId || profile.farmerId || null,
    role:       profile.role || profile.authRole || 'farmer',
    experience: expRaw || profile.experience || farm.farmType || null,
  };
}

/**
 * saveFeedback({ screen, feedbackType, feedbackText? }) → row
 *
 * Appends a record + emits `feedback_submitted` analytics. Returns
 * the persisted row (with id + timestamp filled in) or `null`
 * when the input is invalid.
 */
export function saveFeedback(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const screen       = String(safe.screen || '').trim();
  const feedbackType = String(safe.feedbackType || '').trim();
  if (!screen || !feedbackType) return null;

  const ctx = _ctxFromStorage();
  const row = {
    id:           _uid(),
    userId:       safe.userId       || ctx.userId,
    role:         safe.role         || ctx.role,
    experience:   safe.experience   || ctx.experience,
    screen,
    feedbackType,
    feedbackText: typeof safe.feedbackText === 'string'
      ? safe.feedbackText.slice(0, 400)
      : '',
    timestamp:    new Date().toISOString(),
  };

  const rows = _read();
  rows.push(row);
  _write(rows);

  try { trackEvent('feedback_submitted', { screen, feedbackType }); }
  catch { /* swallow */ }

  return row;
}

/** All feedback rows, newest first. */
export function getFeedback() {
  return _read()
    .slice()
    .sort((a, b) => String(b?.timestamp || '').localeCompare(String(a?.timestamp || '')));
}

/** Group by screen → rows[]. */
export function getFeedbackByScreen() {
  const out = {};
  for (const row of _read()) {
    if (!row || !row.screen) continue;
    (out[row.screen] = out[row.screen] || []).push(row);
  }
  return out;
}

/** Group by role → rows[]. */
export function getFeedbackByRole() {
  const out = {};
  for (const row of _read()) {
    if (!row || !row.role) continue;
    (out[row.role] = out[row.role] || []).push(row);
  }
  return out;
}

// ── Session rate-limiting ─────────────────────────────────────

export function wasPromptShownThisSession() {
  if (!_hasSessionStorage()) return false;
  try { return sessionStorage.getItem(SESSION_FLAG_KEY) === 'true'; }
  catch { return false; }
}

export function markPromptShown() {
  if (!_hasSessionStorage()) return false;
  try { sessionStorage.setItem(SESSION_FLAG_KEY, 'true'); return true; }
  catch { return false; }
}

// ── Public trigger helper ─────────────────────────────────────

/**
 * requestUserFeedback(screen, ctx?) — call this from any
 * "meaningful action complete" code path (scan result shown,
 * task marked done, listing saved, etc.). The host card listens
 * for `farroway:request_feedback` and renders itself if the
 * session hasn't shown the prompt yet.
 *
 * Spec §8 rules baked in:
 *   * Never shows on first app open — only after a meaningful
 *     action emits the event.
 *   * Once-per-session — host writes the session flag on first
 *     show.
 *   * Never blocks user flow — fire-and-forget; no return value
 *     callers rely on.
 *
 * Fires `feedback_prompt_shown` analytics from the host when it
 * actually renders, NOT from this dispatcher (so a request that
 * collides with the session flag doesn't double-count).
 */
export function requestUserFeedback(screen, ctx = {}) {
  try {
    if (typeof window === 'undefined') return;
    if (!screen) return;
    window.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
      detail: { screen: String(screen), ...ctx },
    }));
  } catch { /* never propagate */ }
}

// ── Test / admin reset ────────────────────────────────────────

export function _resetFeedback() {
  try {
    if (_hasStorage()) localStorage.removeItem(STORAGE_KEY);
    if (_hasSessionStorage()) sessionStorage.removeItem(SESSION_FLAG_KEY);
  } catch { /* swallow */ }
}

export default {
  STORAGE_KEY,
  SESSION_FLAG_KEY,
  REQUEST_EVENT,
  FEEDBACK_OPTIONS,
  saveFeedback,
  getFeedback,
  getFeedbackByScreen,
  getFeedbackByRole,
  wasPromptShownThisSession,
  markPromptShown,
  requestUserFeedback,
};
