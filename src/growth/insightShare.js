/**
 * insightShare.js — share helper for the viral growth loop.
 *
 *   shareFarrowayInsight({ source, action, streakDays, lang })
 *     → Promise<{ ok: boolean, channel: 'web_share'|'copy'|'noop' }>
 *
 * Spec coverage (Viral Growth Loop §1, §2)
 *   §1 Triggers: first action / streak / insight — caller passes
 *      `source` so analytics can attribute which moment converted.
 *   §2 Message format: "Farroway told me {action} based on my
 *      location". Caller supplies `action` (a localized verb +
 *      object string from the engine, e.g. "check moisture").
 *
 * Why a new file rather than extending scanShare.js
 * ─────────────────────────────────────────────────
 *   `scanShare.js` is wired tightly to scan-result payloads
 *   (issue / disease / confidence). The viral-loop share is a
 *   different shape — it's the user's daily action, not a scan
 *   result. Living in a sibling helper keeps both surfaces
 *   stable and lets the analytics events stay distinct.
 *
 * Strategy
 *   • Web Share API first (mobile primary path)
 *   • Clipboard write fallback ("Copied" toast)
 *   • Final fallback: { ok: false, channel: 'noop' }
 *
 * Strict rules
 *   • Never throws.
 *   • Fires `viral_share_clicked` on tap and
 *     `viral_share_completed` once the share / copy resolves
 *     so the analytics pipeline can compute share→completion
 *     funnel.
 */

import { trackEvent } from '../analytics/analyticsStore.js';
import { buildInviteUrl } from './referralStore.js';

const DEFAULT_ACTION = 'what to do today';

function _safeStr(v, fallback = '') {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

/**
 * Build the spec §2 message body. Pure helper exported for
 * tests and so the caller can preview the line before tapping.
 *
 * Format: "Farroway told me {action} based on my location"
 *
 * Caller supplies `action` already localized (engine emits
 * a one-line verb phrase via `actionTitleFallback`). When the
 * caller doesn't pass one, we ship a generic line ("what to do
 * today") rather than blanking — keeps the share usable when
 * the engine state is unavailable.
 */
export function buildShareText({ action } = {}) {
  const a = _safeStr(action, DEFAULT_ACTION);
  return `Farroway told me ${a} based on my location`;
}

/**
 * shareFarrowayInsight — main entry. Called from any of the
 * spec §1 trigger surfaces (post-Done CTA on FirstActionGate,
 * streak milestones, insight cards).
 *
 * @param {object}  input
 * @param {string}  input.source      — 'first_action'|'streak'|'insight'
 * @param {string}  [input.action]    — localized one-line action
 * @param {number}  [input.streakDays]— context for analytics only
 * @param {string}  [input.lang]      — analytics tag only
 * @returns {Promise<{ok:boolean, channel:string}>}
 */
export async function shareFarrowayInsight({
  source     = 'unknown',
  action     = '',
  streakDays = null,
  lang       = 'en',
} = {}) {
  const text       = buildShareText({ action });
  const inviteUrl  = buildInviteUrl();
  const fullBody   = `${text}\n\n${inviteUrl}`;

  try {
    trackEvent('viral_share_clicked', {
      source,
      hasAction:  !!action,
      streakDays: Number.isFinite(streakDays) ? streakDays : null,
      lang,
    });
  } catch { /* analytics never blocks */ }

  // Web Share API — preferred mobile path.
  try {
    if (typeof navigator !== 'undefined'
        && typeof navigator.share === 'function') {
      await navigator.share({
        title: 'Farroway',
        text,
        url:   inviteUrl,
      });
      try { trackEvent('viral_share_completed', { source, channel: 'web_share' }); }
      catch { /* swallow */ }
      return { ok: true, channel: 'web_share' };
    }
  } catch {
    // User cancelled or share failed — fall through to clipboard.
  }

  // Clipboard fallback.
  try {
    if (typeof navigator !== 'undefined'
        && navigator.clipboard
        && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(fullBody);
      try { trackEvent('viral_share_completed', { source, channel: 'copy' }); }
      catch { /* swallow */ }
      return { ok: true, channel: 'copy' };
    }
  } catch { /* fall through to noop */ }

  return { ok: false, channel: 'noop' };
}

export default { shareFarrowayInsight, buildShareText };

export const _internal = Object.freeze({ DEFAULT_ACTION, _safeStr });
