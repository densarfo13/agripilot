/**
 * notificationEngine.js — public facade for the smart-reminder
 * spec (push + email).
 *
 *   import {
 *     generateNotification, generateDailyEmail,
 *   } from '../core/notificationEngine.js';
 *
 *   const notif = generateNotification({ context, weather, memory, riskLevel });
 *   const email = generateDailyEmail({ decision });
 *
 * Why a facade
 * ────────────
 * Strict rule from every prior session: **no duplicate systems.**
 * The push-notification decision logic the spec describes is
 * already implemented in `notificationDecisionEngine.js`
 * (`getNotificationForToday`). This module:
 *   • Re-exports it under the spec's name (`generateNotification`)
 *     so call sites can use either the new or the old name
 *   • Adds `generateDailyEmail({ decision })` which is genuinely
 *     new — renders subject + body lines from a composer decision
 *     (`ultimateDecisionEngine.decideToday()` output)
 *
 * Email rendering rules (per spec §4)
 * ───────────────────────────────────
 * The email body is composed of THREE lines, all derived from
 * the supplied decision:
 *
 *   1. Primary action title  ("Do not water today")
 *   2. Reason / confidence   ("Based on recent rain and humidity.")
 *   3. Tomorrow hook         ("Tomorrow: check soil moisture again")
 *
 * No long paragraphs. No marketing copy. The renderer returns
 * keys + fallbacks so the caller's email transport can pass the
 * keys to its existing tStrict pipeline before send.
 *
 * Safety
 * ──────
 *   • Never throws. A pathological decision input collapses to
 *     a "skip — nothing to send" sentinel.
 *   • Returns null when the decision has no primaryAction (e.g.
 *     onboarding state) — caller should not send an empty email.
 *   • Respects the existing email-opt-out at the call site, not
 *     here. This module is a renderer; transport policy lives at
 *     the dispatcher.
 */

import { getNotificationForToday } from './notificationDecisionEngine.js';

/**
 * Spec name for `getNotificationForToday`. Pure re-export so
 * either function name resolves.
 */
export const generateNotification = getNotificationForToday;

/**
 * Render the daily email's three lines from a composer decision.
 *
 * @param {{decision?: object}} input
 *   `decision` is the output of
 *   `ultimateDecisionEngine.decideToday(...)`. Both the legacy
 *   `primaryAction` field shape and the spec's compact shape
 *   are accepted — we read the same denormalised fields the
 *   FirstActionGate already uses.
 * @returns {null|{
 *   subject:    { key: string, fallback: string },
 *   primary:    { key: string, fallback: string },
 *   reason:     { key: string, fallback: string },
 *   tomorrow:   { key: string, fallback: string },
 *   meta:       { primaryActionType: string|null, generatedAt: number },
 * }}
 */
export function generateDailyEmail(input = {}) {
  try {
    const decision = input && input.decision;
    if (!decision) return null;

    // Accept both the composer's nested shape (`{ primaryAction,
    // confidenceLine, tomorrowPreview }`) and the legacy flat
    // shape from a direct `buildPrimaryAction` call.
    const action = decision.primaryAction || decision;
    if (!action || !action.titleKey) return null;

    const titleKey      = action.titleKey;
    const titleFallback = action.titleFallback || '';

    // Reason line — composer denormalises onto the action; legacy
    // flat shape has it directly.
    const reasonKey      = action.reasonKey
      || (decision.confidenceLine && decision.confidenceLine.key)
      || null;
    const reasonFallback = action.reasonFallback
      || (decision.confidenceLine && decision.confidenceLine.fallback)
      || '';

    // Tomorrow hook — same precedence.
    const tomorrowKey      = action.tomorrowKey
      || (decision.tomorrowPreview && decision.tomorrowPreview.key)
      || 'primaryAction.tomorrow.hook';
    const tomorrowFallback = action.tomorrowFallback
      || (decision.tomorrowPreview && decision.tomorrowPreview.fallback)
      || 'Tomorrow: quick leaf check (30s)';

    return {
      subject:  { key: 'email.daily.subject',  fallback: 'Your Farroway plan for today' },
      primary:  { key: titleKey,              fallback: titleFallback },
      reason:   { key: reasonKey,             fallback: reasonFallback },
      tomorrow: { key: tomorrowKey,           fallback: tomorrowFallback },
      meta: {
        primaryActionType: action.primaryActionType || action.type || null,
        generatedAt:       Date.now(),
      },
    };
  } catch {
    // Never crash the caller — the daily-email pipeline is a
    // best-effort retention surface, not a critical path.
    return null;
  }
}

export const _internal = Object.freeze({});
