/**
 * smsService.js — Farroway core SMS sender (spec section 6).
 *
 * Talks to whatever route the existing backend exposes at
 * /api/send-sms. Per strict rule, this module does NOT define or
 * change that endpoint - it just calls it. Failures are swallowed
 * (the strict rule "must not crash if data missing" extends here:
 * a notification path can never abort because of a network blip).
 *
 * Returns:
 *   { ok: true,  status }  - request reached the server
 *   { ok: false, reason }  - guarded out, fetch unavailable, or threw
 */

const ENDPOINT = '/api/send-sms';

export async function sendSMS(to, message) {
  if (!to || !message) {
    return { ok: false, reason: 'empty' };
  }
  if (typeof fetch !== 'function') {
    return { ok: false, reason: 'no_fetch' };
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message }),
    });
    return { ok: !!(res && res.ok), status: res && res.status };
  } catch (err) {
    // Strict rule: notification path never throws. Log + swallow.
    try { console.warn('[FARROWAY_SMS_FAILED]', err?.message); }
    catch { /* console missing in some sandboxes */ }
    return { ok: false, reason: 'threw' };
  }
}
