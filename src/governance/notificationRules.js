/**
 * notificationRules — governance for any module that fires a
 * push / SMS / WhatsApp / email notification to the farmer.
 *
 *   import { validateNotification } from
 *     'src/governance/notificationRules.js';
 *
 *   const v = validateNotification({
 *     channel: 'push',
 *     title:   'URGENT: water now',
 *     body:    'High disease risk detected on your crop',
 *     contextual: false,
 *   });
 *   if (!v.ok) console.warn('blocked:', v.reasons);
 *
 * Strict-rule audit
 *   • Pure / no I/O. Frozen exports.
 *   • The notification ENGINE (src/core/notificationDecisionEngine.js)
 *     is authoritative for *whether* to send; this file is the
 *     contract the experience audit checks the engine output
 *     against. Engines that already produce calm copy pass; new
 *     engines that emit alarmist phrasing fail validation here.
 *
 * @typedef {object} NotificationCandidate
 * @property {string}  channel       'push' | 'sms' | 'whatsapp' | 'email'
 * @property {string}  [title]
 * @property {string}  [body]
 * @property {boolean} [contextual]  driven by weather / scan / care signal
 * @property {boolean} [weatherAware]
 * @property {boolean} [growthAware]
 *
 * @typedef {object} NotificationDecision
 * @property {boolean}  ok
 * @property {string[]} reasons
 */

// Frequency contract per channel — soft guidance for engines.
// The audit doesn't enforce these (frequency is runtime state),
// but they document the expectation so PRs touching the
// notification engine can self-check.
export const FREQUENCY_LIMITS = Object.freeze({
  push:     Object.freeze({ perDay: 2,  cooldownHours: 4  }),
  sms:      Object.freeze({ perDay: 1,  cooldownHours: 12 }),
  whatsapp: Object.freeze({ perDay: 2,  cooldownHours: 6  }),
  email:    Object.freeze({ perDay: 2,  cooldownHours: 6  }),
});

// Patterns that must NOT appear in a notification's title or body.
// Mirror the alarm-tone block from emotionalToneRules but applied
// at the notification edge so even a hand-authored copy can't
// slip through.
export const FORBIDDEN_NOTIFICATION_PATTERNS = Object.freeze([
  Object.freeze({ pattern: /\bURGENT\b/i,                 reason: 'all-caps urgency' }),
  Object.freeze({ pattern: /\bACTION REQUIRED\b/i,        reason: 'all-caps urgency' }),
  Object.freeze({ pattern: /!{2,}/,                       reason: 'excessive punctuation' }),
  Object.freeze({ pattern: /\bclick now\b/i,              reason: 'engagement bait' }),
  Object.freeze({ pattern: /\bdon'?t miss\b/i,            reason: 'engagement bait' }),
  Object.freeze({ pattern: /\bhigh risk of\b/i,           reason: 'alarm wording' }),
  Object.freeze({ pattern: /\bcritical (?:risk|alert)\b/i, reason: 'alarm wording' }),
  Object.freeze({ pattern: /\bdanger\b/i,                 reason: 'alarm wording' }),
  Object.freeze({ pattern: /\bAI confidence\b/i,          reason: 'AI jargon (P10)' }),
  Object.freeze({ pattern: /\brisk score\b/i,             reason: 'AI jargon (P10)' }),
]);

const VALID_CHANNELS = new Set(['push', 'sms', 'whatsapp', 'email']);

/**
 * Validate a single notification candidate against the rules.
 * Returns { ok, reasons } — never throws.
 *
 * @param {NotificationCandidate} input
 * @returns {NotificationDecision}
 */
export function validateNotification(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const reasons = [];

  if (!VALID_CHANNELS.has(String(safe.channel || ''))) {
    reasons.push('unknown_channel');
  }

  const title = typeof safe.title === 'string' ? safe.title : '';
  const body  = typeof safe.body  === 'string' ? safe.body  : '';
  if (!title.trim() && !body.trim()) {
    reasons.push('empty_content');
  }

  for (const entry of FORBIDDEN_NOTIFICATION_PATTERNS) {
    try {
      if (entry.pattern.test(title) || entry.pattern.test(body)) {
        reasons.push('forbidden:' + entry.reason);
      }
    } catch { /* swallow — defensive */ }
  }

  // Spec §13: notifications must be contextual + timing-aware.
  // We don't fail when those flags are missing (would be too
  // intrusive on existing call sites); instead the audit reports
  // them as soft warnings via a separate path.

  return Object.freeze({
    ok:      reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export default Object.freeze({
  FREQUENCY_LIMITS,
  FORBIDDEN_NOTIFICATION_PATTERNS,
  validateNotification,
});
