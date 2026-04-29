/**
 * smsConfirmations.js — fire-and-forget SMS confirmations for
 * the three farmer-side program / funding actions.
 *
 *   confirmFundingApplied(profile, opportunity, lang)
 *   confirmFundingHelpRequested(profile, opportunity, lang)
 *   confirmProgramActed(profile, program, lang)
 *
 * Why this thin module exists
 * ───────────────────────────
 * The three action sites (Dashboard.onAck, FundingOpportunityDetail.
 * handleApplyNow, the Help-modal submit) all need the same fire-
 * and-forget path:
 *   1. resolve the farmer's phone from profile (E.164 preferred)
 *   2. resolve a short, localized message via tShort
 *   3. POST to /api/send-sms via smsService.sendSMS
 *   4. swallow any failure — never block the UI.
 *
 * Centralising here keeps each call site to a single line and
 * keeps the SMS template keys + interpolation contract in one
 * place, so a future translator pass touches one file.
 *
 * Strict-rule audit
 *   * Never throws. Every step is wrapped in try/catch; missing
 *     phone / unavailable fetch / Twilio failure all degrade to
 *     a no-op with at most one console.warn for ops.
 *   * No PII beyond the phone number itself. The opportunity
 *     title is interpolated into the message — that's a public
 *     program name, not sensitive data.
 *   * Trust-safe templates: confirms the action was logged,
 *     never claims approval. Source templates live in
 *     src/i18n/smsTemplates.js with full 6-language coverage.
 */

import { sendSMS } from '../core/farroway/smsService.js';
import { tShort } from '../i18n/smsTemplates.js';

function _phone(profile) {
  if (!profile || typeof profile !== 'object') return '';
  return String(
    profile.phoneE164
      || profile.phone
      || profile.farmerPhone
      || '',
  ).trim();
}

function _title(obj) {
  if (!obj || typeof obj !== 'object') return '';
  return String(obj.title || obj.name || '').trim();
}

function _send(key, phone, vars, lang) {
  if (!phone) return;
  try {
    const message = tShort(key, lang || 'en', vars);
    if (!message) return;
    // sendSMS itself swallows fetch failures and returns a
    // plain object — fire-and-forget is safe.
    sendSMS(phone, message);
  } catch (err) {
    try { console.warn('[smsConfirmations]', key, err && err.message); }
    catch { /* console missing in some sandboxes */ }
  }
}

/**
 * Sent when a farmer taps Apply Now on a funding opportunity.
 * The app has already opened the official source URL in a new
 * tab; this SMS is the trail-of-action confirmation.
 */
export function confirmFundingApplied(profile, opportunity, lang) {
  _send('sms.funding.applied', _phone(profile),
    { title: _title(opportunity) || 'a funding opportunity' },
    lang);
}

/**
 * Sent when a farmer submits a Request Help form. Sets honest
 * expectations ("a partner may contact you") rather than
 * promising a callback.
 */
export function confirmFundingHelpRequested(profile, opportunity, lang) {
  _send('sms.funding.helpRequested', _phone(profile),
    { title: _title(opportunity) || 'a funding opportunity' },
    lang);
}

/**
 * Sent when a farmer taps "I'll do this" on a program card
 * (markActed transition SENT/OPENED → ACTED).
 */
export function confirmProgramActed(profile, program, lang) {
  _send('sms.program.acted', _phone(profile),
    { title: _title(program) || 'this program' },
    lang);
}
