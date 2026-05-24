/**
 * renderByExperienceMode.js — pure formatters that reshape the
 * existing engine outputs for Simple vs Standard mode (spec §13).
 *
 *   import {
 *     formatRecommendationForMode,
 *     formatScanResultForMode,
 *     formatTaskForMode,
 *     formatWeatherInsightForMode,
 *     formatNotificationForMode,
 *   } from 'src/core/experience/renderByExperienceMode.js';
 *
 *   const card = formatRecommendationForMode(decision, 'simple');
 *
 * What it is — and is NOT
 * ───────────────────────
 *   ONE place that knows what each surface card should look like
 *   in each mode. It does NOT change the underlying decision; it
 *   just strips / keeps fields and picks the right copy density.
 *
 *   Simple Mode rule (across all helpers): no raw confidence
 *   numbers, no technical disease terms, no long explanations,
 *   no source attribution chips.
 *
 *   Standard Mode rule: keep the operational detail — confidence
 *   label, best time, source, urgency.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe. Every envelope it RETURNS
 *     is either `{ key, fallback, params }` or a string — no
 *     React, no DOM.
 */

import { EXPERIENCE_MODE, getExperienceMode } from './experienceMode.js';

const _str = (v) => String(v == null ? '' : v).toLowerCase();

function _resolveMode(mode) {
  const m = _str(mode);
  if (m === EXPERIENCE_MODE.SIMPLE || m === EXPERIENCE_MODE.STANDARD) return m;
  try { return getExperienceMode(); } catch { return EXPERIENCE_MODE.SIMPLE; }
}

function _isSimple(mode) {
  return _resolveMode(mode) === EXPERIENCE_MODE.SIMPLE;
}

function _safeEnvelope(v) {
  if (!v) return null;
  if (typeof v === 'string') return { fallback: v };
  if (typeof v === 'object' && (v.fallback || v.key)) return v;
  return null;
}

// ─── §5/§7 Recommendation / Task ─────────────────────────

/**
 * Reshape an orchestrator/decision recommendation for the surface.
 *
 * @param {object} rec  shape from intelligenceOrchestrator OR
 *                      dailyDecisionAssistant
 * @param {string} [mode]
 * @returns {object}
 */
export function formatRecommendationForMode(rec, mode) {
  try {
    if (!rec || typeof rec !== 'object') return null;
    const simple = _isSimple(mode);
    const title = _safeEnvelope(rec.title || (rec.bestAction && rec.bestAction.title) || rec.primaryAction);
    const reason = _safeEnvelope(rec.reason || rec.why);

    if (simple) {
      return {
        mode: EXPERIENCE_MODE.SIMPLE,
        title,
        reason,
        // Simple mode = one button + short.
      };
    }

    return {
      mode:        EXPERIENCE_MODE.STANDARD,
      title,
      reason,
      urgency:     rec.urgency || null,
      bestTime:    rec.bestTime || null,
      confidence:  rec.confidence || rec.confidenceLabel || null,
      source:      rec.source || (rec.bestAction && rec.bestAction.type) || rec.type || null,
      microHelp:   _safeEnvelope(rec.microHelp),
    };
  } catch { return null; }
}

export function formatTaskForMode(task, mode) {
  try {
    if (!task || typeof task !== 'object') return null;
    const simple = _isSimple(mode);
    const title = _safeEnvelope(task.title)
      || (task.titleKey ? { key: task.titleKey, fallback: task.titleFallback || '' } : null);
    const reason = _safeEnvelope(task.reason || task.why);

    if (simple) {
      return { mode: EXPERIENCE_MODE.SIMPLE, title, reason };
    }
    return {
      mode:       EXPERIENCE_MODE.STANDARD,
      title, reason,
      bestTime:   task.bestTime || null,
      urgency:    task.urgency  || null,
      source:     task.source || task.actionType || null,
    };
  } catch { return null; }
}

// ─── §6 Scan result ──────────────────────────────────────

export function formatScanResultForMode(result, mode) {
  try {
    if (!result || typeof result !== 'object') return null;
    const simple = _isSimple(mode);

    const whatWeFound  = _safeEnvelope(result.whatWeNoticed)
      || _safeEnvelope(result.possibleIssue);
    const whatToDoNext = _safeEnvelope(result.whatToCheckNext)
      || _safeEnvelope(Array.isArray(result.recommendedAction)
        ? result.recommendedAction[0] : result.nextBestAction);

    const common = {
      whatWeFound,
      whatToDoNext,
      // Both modes must offer the image preview + manual fallback;
      // those are wired by the surface from the underlying record.
    };

    if (simple) {
      return { mode: EXPERIENCE_MODE.SIMPLE, ...common };
    }

    return {
      mode:           EXPERIENCE_MODE.STANDARD,
      ...common,
      possibleIssue:  _safeEnvelope(result.possibleIssue),
      confidence:     result.confidence || null,
      confidenceLabel:result.confidenceLabel || null,
      urgency:        result.urgency || null,
      safetyNote:     _safeEnvelope(result.safetyNote),
      followUpTask:   result.followUpTask || null,
    };
  } catch { return null; }
}

// ─── §8 Weather / watering ───────────────────────────────

export function formatWeatherInsightForMode(insight, mode) {
  try {
    if (!insight || typeof insight !== 'object') return null;
    const simple = _isSimple(mode);
    const message = _safeEnvelope(insight.localizedMessage || insight.message);

    if (simple) {
      return { mode: EXPERIENCE_MODE.SIMPLE, message };
    }
    return {
      mode:     EXPERIENCE_MODE.STANDARD,
      message,
      severity: insight.severity || null,
      type:     insight.type || null,
      advice:   insight.advice || null,
    };
  } catch { return null; }
}

// ─── §10 Notification ─────────────────────────────────────

export function formatNotificationForMode(notification, mode) {
  try {
    if (!notification || typeof notification !== 'object') return null;
    const simple = _isSimple(mode);

    // Simple mode prefers the short title only; Standard keeps the
    // operational body line.
    if (simple) {
      return {
        mode:     EXPERIENCE_MODE.SIMPLE,
        id:       notification.id || null,
        kind:     notification.kind || null,
        title:    notification.title || '',
        body:     '',                  // dropped in Simple mode
        language: notification.language || null,
      };
    }

    return {
      mode:     EXPERIENCE_MODE.STANDARD,
      id:       notification.id || null,
      kind:     notification.kind || null,
      title:    notification.title || '',
      body:     notification.body || '',
      urgency:  notification.urgency || null,
      language: notification.language || null,
    };
  } catch { return null; }
}

const _module = {
  formatRecommendationForMode,
  formatTaskForMode,
  formatScanResultForMode,
  formatWeatherInsightForMode,
  formatNotificationForMode,
};
export default _module;
