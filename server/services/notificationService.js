/**
 * notificationService.js — multi-channel orchestrator for auth
 * notifications. Owns the "email first, SMS fallback if email
 * fails AND phone is present" policy so individual routes don't
 * re-implement it.
 *
 * Public surface:
 *
 *   sendPasswordReset({ user, resetLink, requestId? })
 *     → { email: {...}, sms: {attempted, ...}, delivered: boolean }
 *
 *     • email:    the full emailService result ({ ok, code, … })
 *     • sms:      { attempted: true|false, ok?: bool, code?, details? }
 *     • delivered: true iff at least one channel accepted the message
 *
 * Rules:
 *   • Email is always tried first, using emailTemplates for body.
 *   • SMS fallback fires only when:
 *       - email failed (email.ok === false), AND
 *       - user.phone is a non-empty E.164 / E.164-ish string, AND
 *       - isSmsMessagingConfigured() is true
 *   • When SMS is not configured the `sms.attempted` flag is false
 *     and ops sees the missing-provider line in the boot log.
 *   • No PII / tokens / raw provider bodies flow back to the caller:
 *     both channel results are already sanitised by their services.
 *
 * The caller (e.g. forgot-password route) is responsible for keeping
 * the HTTP response generic (`{ success: true }`) for anti-
 * enumeration — this service only reports delivery outcomes for
 * logs + audit rows.
 */

import { sendEmail, isEmailConfigured } from './emailService.js';
import { buildPasswordResetEmail } from './emailTemplates.js';
import { sendSms, isSmsMessagingConfigured } from './smsService.js';

function maskPhone(raw) {
  const s = String(raw || '');
  if (s.length <= 4) return s;
  return s.slice(0, 1) + '*'.repeat(Math.max(0, s.length - 5)) + s.slice(-4);
}

/**
 * sendPasswordReset — email first, SMS fallback.
 *
 *   user:      { email, phone?, fullName? }  — email is required; phone
 *              is optional and triggers the SMS fallback when email
 *              delivery fails.
 *   resetLink: absolute reset URL built by the caller (we do NOT build
 *              it here so the route stays in control of APP_BASE_URL
 *              validation + token hashing).
 */
export async function sendPasswordReset({ user, resetLink, requestId = null } = {}) {
  const tag = requestId ? `[notify:${requestId}]` : '[notify]';
  const email = user && user.email ? String(user.email).trim() : '';
  const phone = user && user.phone ? String(user.phone).trim() : '';

  if (!email || !resetLink) {
    console.warn(`${tag} refusing to send — missing user.email or resetLink`);
    return {
      email: { ok: false, code: 'missing_inputs' },
      sms:   { attempted: false },
      delivered: false,
    };
  }

  // ── 1) Email first ───────────────────────────────────────────
  let emailResult;
  if (!isEmailConfigured()) {
    emailResult = { ok: false, code: 'not_configured' };
    console.error(`${tag} email skipped — SENDGRID_API_KEY is not set`);
  } else {
    const { subject, text, html } = buildPasswordResetEmail({ resetUrl: resetLink });
    console.log(`${tag} email_start to=${email}`);
    emailResult = await sendEmail({ to: email, subject, text, html, requestId });
    if (emailResult.ok) {
      console.log(`${tag} email_ok status=${emailResult.statusCode || '?'}`);
    } else {
      console.error(`${tag} email_fail code=${emailResult.code} details=${emailResult.details || '(none)'}`);
    }
  }

  // ── 2) SMS fallback — only when email failed + phone present ─
  let smsResult = { attempted: false };
  const emailFailed = !emailResult.ok;
  const hasPhone = /^\+?[\d]{7,15}$/.test(phone.replace(/[\s-]/g, ''));

  if (emailFailed && hasPhone) {
    if (!isSmsMessagingConfigured()) {
      smsResult = { attempted: true, ok: false, code: 'not_configured' };
      console.error(`${tag} sms fallback skipped — TWILIO_* not configured (phone=${maskPhone(phone)})`);
    } else {
      console.log(`${tag} sms_start to=${maskPhone(phone)}`);
      const r = await sendSms({
        to: phone,
        body: `Reset your Farroway password: ${resetLink}`,
        requestId,
      });
      smsResult = { attempted: true, ok: r.ok, code: r.code, details: r.details };
      if (r.ok) {
        console.log(`${tag} sms_ok sid=${r.messageSid}`);
      } else {
        console.error(`${tag} sms_fail code=${r.code} details=${r.details || '(none)'}`);
      }
    }
  } else if (emailFailed && !hasPhone) {
    console.warn(`${tag} sms fallback skipped — no phone on user record`);
  }

  return {
    email: emailResult,
    sms:   smsResult,
    delivered: !!emailResult.ok || !!(smsResult.attempted && smsResult.ok),
  };
}

export const _internal = Object.freeze({ maskPhone });
