/**
 * feedbackEvent.js — §8. Pure builder for the lightweight
 * "Helpful / Not right" feedback on the dominant task or
 * state card.
 *
 * Builds ONE structured event object. The caller decides how
 * to send it (safeTrackEvent, server POST, offline queue).
 *
 *   buildFeedbackEvent({
 *     verdict:      'helpful' | 'not_right',
 *     reason?:      'doesnt_match_field' | 'already_did' | 'not_clear',
 *     taskId?, stateType?,
 *     countryCode?, cropId?, stage?,
 *     locale?, userId?, farmId?,
 *     nowMs? (injectable for tests)
 *   })
 *     → { name: 'task_feedback' | 'state_feedback',
 *         payload: { ... normalized fields ... } }
 *
 * Rules:
 *   • verdict must be one of the two allowed values; anything
 *     else returns null (caller should then do nothing)
 *   • reason only applies to 'not_right'; ignored for 'helpful'
 *   • event name = 'task_feedback' when taskId present, else
 *     'state_feedback' when stateType present. If neither, null.
 *   • optional fields are dropped when falsy so we don't log
 *     empty strings to analytics
 */

const ALLOWED_VERDICTS = Object.freeze(new Set(['helpful', 'not_right']));
const ALLOWED_REASONS  = Object.freeze(new Set([
  'doesnt_match_field',
  'already_did',
  'not_clear',
]));

/** Normalize country codes — upper-case ISO-2, else pass through. */
function normalizeCountry(code) {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (trimmed.length === 2) return trimmed.toUpperCase();
  return trimmed;
}

/**
 * buildFeedbackEvent — returns `{name, payload}` or `null`
 * when the input fails validation. Never throws.
 */
export function buildFeedbackEvent(input = {}) {
  if (!input || typeof input !== 'object') return null;

  const {
    verdict, reason,
    taskId, stateType,
    countryCode, cropId, stage,
    locale, userId, farmId,
    nowMs,
  } = input;

  if (!ALLOWED_VERDICTS.has(verdict)) return null;

  // Normalize reason: only carry it for 'not_right', only if valid.
  let cleanReason = null;
  if (verdict === 'not_right' && reason && ALLOWED_REASONS.has(reason)) {
    cleanReason = reason;
  }

  // Choose the event name from what actually identifies the card.
  let name = null;
  if (taskId)        name = 'task_feedback';
  else if (stateType) name = 'state_feedback';
  if (!name) return null;

  const payload = { verdict };
  if (cleanReason)   payload.reason = cleanReason;
  if (taskId)        payload.taskId = String(taskId);
  if (stateType)     payload.stateType = String(stateType);
  const ctry = normalizeCountry(countryCode);
  if (ctry)          payload.countryCode = ctry;
  if (cropId)        payload.cropId = String(cropId);
  if (stage)         payload.stage = String(stage);
  if (locale)        payload.locale = String(locale);
  if (userId)        payload.userId = String(userId);
  if (farmId)        payload.farmId = String(farmId);
  const ts = typeof nowMs === 'number' ? nowMs : Date.now();
  payload.at = ts;

  return { name, payload };
}

/** Exposed for caller-side validation. */
export function isValidReason(reason) {
  return ALLOWED_REASONS.has(reason);
}

export const _internal = { ALLOWED_VERDICTS, ALLOWED_REASONS };
