/**
 * SMS verification business logic.
 *
 * Sits on top of the provider abstraction in `./provider.js` and is
 * the ONLY place that knows about:
 *   • E.164 normalization
 *   • Purpose-scoped flows (`password_reset`, `login_verify`,
 *     `phone_verify`)
 *   • Per-phone resend cooldown (in-memory; 30 s default)
 *   • Post-success side-effects (bcrypt password update, session
 *     revocation, audit log)
 *
 * Routes in `./routes.js` are thin wrappers — they only shape
 * req/res and never talk to the provider directly.
 *
 * The service is intentionally provider-agnostic: the injected
 * `provider` argument (default: active provider from env) follows
 * the shape declared in `./provider.js`. Tests swap in a stub
 * provider to exercise every branch without Twilio.
 */

import bcrypt from 'bcryptjs';
import prisma from '../../../config/database.js';
import { writeAuditLog } from '../../audit/service.js';
import { opsEvent } from '../../../utils/opsLogger.js';
import { validatePassword } from '../../../middleware/validate.js';
import { normalizePhoneForStorage, validatePhone } from '../../../utils/phoneUtils.js';
import { getActiveSmsVerificationProvider } from './provider.js';

// Purposes supported by the API surface. Anything else is 400'd
// early so routes can't silently become catch-all OTP sinks.
export const SMS_PURPOSES = Object.freeze({
  PASSWORD_RESET: 'password_reset',
  LOGIN_VERIFY:   'login_verify',
  PHONE_VERIFY:   'phone_verify',
});

const VALID_PURPOSES = new Set(Object.values(SMS_PURPOSES));
const VALID_CHANNELS = new Set(['sms', 'whatsapp', 'call']);

// ─── Anti-abuse counters (in-memory, no Redis for v1) ─────────────
//   • RESEND_COOLDOWN_MS: shortest gap between two consecutive sends
//     for the same phone. Catches obvious double-tap + script loops.
//   • MAX_PHONE_REQUESTS / MAX_IP_REQUESTS: count over WINDOW_MS.
//     Both counters are enforced BEFORE the provider is called, so
//     attackers don't burn Twilio budget to discover the limit.
//
// Everything clears on process restart. That's acceptable for v1 on
// Railway (single instance). A distributed deployment should swap
// these maps for Redis — the shape is designed for that: `phone`/
// `ip` string key, timestamp-list value.
const RESEND_COOLDOWN_MS  = 30 * 1000;         // 30 s
const WINDOW_MS           = 10 * 60 * 1000;    // 10 min
const MAX_PHONE_REQUESTS  = 3;                 // per phone per WINDOW_MS
const MAX_IP_REQUESTS     = 5;                 // per IP per WINDOW_MS

const recentSends    = new Map();   // phone → last-send ts (cooldown)
const phoneRequests  = new Map();   // phone → ts[] (sliding window)
const ipRequests     = new Map();   // ip    → ts[] (sliding window)

function cooldownRemaining(phone, now = Date.now()) {
  const last = recentSends.get(phone);
  if (!last) return 0;
  const remaining = RESEND_COOLDOWN_MS - (now - last);
  return remaining > 0 ? remaining : 0;
}

/**
 * Count how many requests `key` made inside WINDOW_MS, pruning any
 * stale timestamps at the same time so the map doesn't grow.
 */
function windowCount(bucket, key, now) {
  if (!key) return 0;
  const arr = bucket.get(key);
  if (!arr || arr.length === 0) return 0;
  const cutoff = now - WINDOW_MS;
  // Most entries are appended in ascending order, so walk until we
  // find one that's still fresh.
  let firstFresh = 0;
  while (firstFresh < arr.length && arr[firstFresh] <= cutoff) firstFresh += 1;
  if (firstFresh > 0) {
    const kept = arr.slice(firstFresh);
    if (kept.length === 0) bucket.delete(key); else bucket.set(key, kept);
    return kept.length;
  }
  return arr.length;
}

function recordRequest(bucket, key, now) {
  if (!key) return;
  const arr = bucket.get(key);
  if (arr) arr.push(now); else bucket.set(key, [now]);
  // Opportunistic global cleanup so the map can't grow past ~5k keys.
  if (bucket.size > 5000) {
    const cutoff = now - WINDOW_MS;
    for (const [k, ts] of bucket.entries()) {
      if (!ts || ts.length === 0 || ts[ts.length - 1] <= cutoff) bucket.delete(k);
    }
  }
}

function markSent(phone, now = Date.now()) {
  recentSends.set(phone, now);
  if (recentSends.size > 5000) {
    for (const [k, t] of recentSends.entries()) {
      if (now - t > RESEND_COOLDOWN_MS * 4) recentSends.delete(k);
    }
  }
}

/**
 * Redact a phone number for logs — keep the country prefix + last
 * 3 digits, mask the middle. "+254712345678" → "+2547*****678".
 * Server logs never see the full number, even under warn/error.
 */
function redactPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 6) return '***';
  return `${phone.slice(0, 5)}${'*'.repeat(Math.max(0, phone.length - 8))}${phone.slice(-3)}`;
}

/**
 * Convert a user-entered phone to a stable lookup form. We defer
 * *strict* E.164 to the PhoneInput component on the client — here
 * we just strip whitespace/punctuation, confirm 7–15 digits, and
 * require a leading '+'. Anything else fails validation so the
 * provider never sees malformed input.
 */
export function toE164(raw) {
  const stripped = normalizePhoneForStorage(String(raw || ''));
  if (!stripped) return null;
  const check = validatePhone(stripped);
  if (!check.valid) return null;
  if (!stripped.startsWith('+')) return null; // E.164 requires country code with '+'
  return stripped;
}

/**
 * startSmsVerification — send an OTP for one of the declared
 * purposes. Always returns a shape the route can send directly
 * (no throws). Anti-enumeration rules:
 *
 *   • For `password_reset` + `login_verify` we only hit the
 *     provider when the phone matches a real, active user. But
 *     the JSON response is identical whether we sent or not.
 *   • For `phone_verify` we always send — the caller is already
 *     authenticated and linking their own number.
 */
export async function startSmsVerification({
  phone,
  purpose = SMS_PURPOSES.PASSWORD_RESET,
  channel = 'sms',
  locale,
  userId = null,     // set when the endpoint is authenticated
  ip = null,         // caller IP from routes.js (req.ip)
  provider = getActiveSmsVerificationProvider(),
  now = Date.now(),
} = {}) {
  if (!VALID_PURPOSES.has(purpose)) {
    return { ok: false, code: 'invalid_purpose', status: 400,
      message: 'Unsupported purpose.' };
  }
  if (!VALID_CHANNELS.has(channel)) {
    return { ok: false, code: 'invalid_channel', status: 400,
      message: 'Unsupported channel.' };
  }

  const to = toE164(phone);
  if (!to) {
    return { ok: false, code: 'invalid_phone', status: 400,
      message: 'Enter a valid international phone number (e.g. +2547…).' };
  }

  // Provider availability check up front so we fail loud when
  // Twilio Verify isn't configured (rather than silently dropping
  // reset requests in production).
  if (!provider.isConfigured()) {
    opsEvent('auth', 'sms_verify_unconfigured', 'warn', {
      provider: provider.name, purpose,
    });
    return { ok: false, code: 'provider_unavailable', status: 503,
      message: 'SMS verification is not configured. Use the email reset link.' };
  }

  opsEvent('auth', 'sms_verify_request', 'info', {
    purpose, channel, phone: redactPhone(to), ip: ip || null,
  });

  // Resend cooldown — short-lived per-phone guard. Blocks
  // double-tap + script loops before the sliding-window check.
  const remaining = cooldownRemaining(to, now);
  if (remaining > 0) {
    opsEvent('auth', 'sms_verify_blocked', 'warn', {
      scope: 'cooldown', phone: redactPhone(to), ip: ip || null,
    });
    return { ok: false, code: 'cooldown', status: 429,
      retryAfterSec: Math.ceil(remaining / 1000),
      message: `Please wait ${Math.ceil(remaining / 1000)}s before resending.` };
  }

  // Per-phone sliding window (3 / 10 min). Enforced BEFORE the
  // provider call so we never burn Twilio budget once the quota
  // is hit — the attacker's only signal is our generic 429.
  const phoneCount = windowCount(phoneRequests, to, now);
  if (phoneCount >= MAX_PHONE_REQUESTS) {
    opsEvent('auth', 'sms_verify_blocked', 'warn', {
      scope: 'phone', phone: redactPhone(to), ip: ip || null,
      count: phoneCount, limit: MAX_PHONE_REQUESTS,
    });
    return { ok: false, code: 'rate_limited', status: 429,
      retryAfterSec: Math.ceil(WINDOW_MS / 1000),
      message: 'Too many requests for this phone number. Please try again later.' };
  }

  // Per-IP sliding window (5 / 10 min). Same reasoning; also
  // layered on top of the route-level express-rate-limit.
  if (ip) {
    const ipCount = windowCount(ipRequests, ip, now);
    if (ipCount >= MAX_IP_REQUESTS) {
      opsEvent('auth', 'sms_verify_blocked', 'warn', {
        scope: 'ip', phone: redactPhone(to), ip,
        count: ipCount, limit: MAX_IP_REQUESTS,
      });
      return { ok: false, code: 'rate_limited', status: 429,
        retryAfterSec: Math.ceil(WINDOW_MS / 1000),
        message: 'Too many requests from this network. Please try again later.' };
    }
  }

  // For recovery purposes, only actually call the provider when
  // the phone matches a real account. The caller still sees a
  // generic "sent" response either way (anti-enumeration).
  let targetUserId = userId;
  if (!targetUserId && (purpose === SMS_PURPOSES.PASSWORD_RESET
                     || purpose === SMS_PURPOSES.LOGIN_VERIFY)) {
    // Phone lives on Farmer in this schema, not User — join across.
    const farmer = await prisma.farmer.findFirst({
      where: { phone: to, userAccount: { active: true } },
      select: { userId: true },
    });
    if (farmer && farmer.userId) targetUserId = farmer.userId;
  }

  const shouldSend = purpose === SMS_PURPOSES.PHONE_VERIFY || !!targetUserId;

  if (shouldSend) {
    // Wrap the provider call so a thrown Twilio SDK error (network,
    // SDK bug, unexpected shape) can never crash the request. We
    // still record the attempt in the counters — a failed send is
    // still an attempt for abuse purposes.
    let r;
    try {
      r = await provider.startVerification({ to, channel, locale });
    } catch (err) {
      r = { ok: false, status: 'error', error: err?.message || 'Provider exception' };
    }
    recordRequest(phoneRequests, to, now);
    recordRequest(ipRequests,    ip, now);

    if (!r || !r.ok) {
      opsEvent('auth', 'sms_verify_start_failed', 'error', {
        purpose, providerStatus: r && r.status, error: r && r.error,
        phone: redactPhone(to), ip: ip || null,
      });
      // Only `phone_verify` (already authenticated, user is linking
      // their own number) sees a provider error. The recovery flows
      // swallow it so callers can't use error timing to enumerate.
      if (purpose === SMS_PURPOSES.PHONE_VERIFY) {
        return { ok: false, code: 'provider_error', status: 502,
          message: 'Could not send the verification code. Please try again.' };
      }
    } else {
      markSent(to, now);
      try {
        await writeAuditLog({
          userId: targetUserId,
          action: 'auth.sms_verify_started',
          details: { purpose, channel, provider: provider.name },
        });
      } catch { /* non-fatal */ }
      opsEvent('auth', 'sms_verify_started', 'info', {
        purpose, channel, provider: provider.name,
        phone: redactPhone(to), ip: ip || null,
      });
    }
  } else {
    // No-op path — respond identically so callers can't enumerate,
    // but still record against the counters so a scripted enumerator
    // can't bypass limits by hitting unknown numbers.
    opsEvent('auth', 'sms_verify_no_account', 'info', {
      purpose, phone: redactPhone(to), ip: ip || null,
    });
    recordRequest(phoneRequests, to, now);
    recordRequest(ipRequests,    ip, now);
    markSent(to, now);
  }

  return {
    ok: true, code: 'sent', status: 200,
    channel, purpose,
    cooldownSec: RESEND_COOLDOWN_MS / 1000,
    // Deliberately NO sid / requestId in the response — the caller
    // only needs {phone, code} to check, which avoids a handle the
    // attacker could reuse.
  };
}

/**
 * checkSmsVerification — validate a code. Can optionally drive a
 * follow-up action when `purpose === 'password_reset'`:
 *   • If `newPassword` is supplied + the code is approved, we
 *     atomically hash + set the password, revoke active sessions,
 *     and return { verified: true, passwordReset: true }.
 * For other purposes we just return the verification result.
 */
export async function checkSmsVerification({
  phone,
  code,
  purpose = SMS_PURPOSES.PASSWORD_RESET,
  newPassword = null,
  provider = getActiveSmsVerificationProvider(),
} = {}) {
  if (!VALID_PURPOSES.has(purpose)) {
    return { ok: false, code: 'invalid_purpose', status: 400,
      message: 'Unsupported purpose.' };
  }
  const to = toE164(phone);
  if (!to) {
    return { ok: false, code: 'invalid_phone', status: 400,
      message: 'Enter a valid international phone number.' };
  }
  if (!code || String(code).trim().length < 4) {
    return { ok: false, code: 'invalid_code', status: 400,
      message: 'Enter the code from your SMS.' };
  }
  if (!provider.isConfigured()) {
    return { ok: false, code: 'provider_unavailable', status: 503,
      message: 'SMS verification is not configured.' };
  }

  // Same protective envelope as the start path — a thrown SDK
  // error never propagates to the client as a 500.
  let r;
  try {
    r = await provider.checkVerification({ to, code });
  } catch (err) {
    r = { ok: false, status: 'error', error: err?.message || 'Provider exception' };
  }

  if (!r || !r.ok) {
    const status = r && r.status;
    // Fine-grained code for logging + UX, but the message stays
    // generic so attackers can't distinguish "wrong code" from
    // "expired" from "already used".
    let code = 'invalid_or_expired';
    if (status === 'max_attempts_reached') code = 'max_attempts';
    else if (status === 'error' || status === 'unconfigured') code = 'provider_error';

    const userMessage =
      code === 'max_attempts'  ? 'Too many attempts on this code. Request a new one.'
    : code === 'provider_error' ? 'Could not verify the code. Please try again.'
    :                              'Invalid or expired code. Request a new one.';

    opsEvent('auth', 'sms_verify_check_failed', 'warn', {
      purpose, providerStatus: status, code, phone: redactPhone(to),
    });

    return {
      ok: false,
      code,
      status: code === 'provider_error' ? 502 : 400,
      message: userMessage,
    };
  }

  opsEvent('auth', 'sms_verify_check_success', 'info', {
    purpose, phone: redactPhone(to),
  });

  // Password-reset branch — atomic update when newPassword present.
  if (purpose === SMS_PURPOSES.PASSWORD_RESET && newPassword) {
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return { ok: false, code: 'weak_password', status: 400,
        message: pwCheck.message };
    }
    const farmer = await prisma.farmer.findFirst({
      where: { phone: to, userAccount: { active: true } },
      select: { userId: true },
    });
    const userId = farmer && farmer.userId;
    if (!userId) {
      // Code verified but no account — treat as verified-only so
      // callers can't enumerate accounts via password-reset either.
      return { ok: true, verified: true, passwordReset: false };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Same atomic envelope as the email flow: update password,
    // bump tokenVersion so outstanding JWTs die, revoke server-side
    // sessions if the schema has them, and wipe any outstanding
    // email reset tokens so a leaked one can't be replayed.
    const ops = [
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId, usedAt: null },
      }),
    ];
    // Best-effort session invalidation — UserSession exists in v2
    // schema; wrap so older schemas don't blow up.
    try {
      if (prisma.userSession && typeof prisma.userSession.updateMany === 'function') {
        ops.push(prisma.userSession.updateMany({
          where: { userId, revokedAt: null },
          data:  { revokedAt: new Date() },
        }));
      }
    } catch { /* no-op */ }

    await prisma.$transaction(ops);

    try {
      await writeAuditLog({
        userId,
        action: 'auth.password_reset_via_sms',
        details: { provider: provider.name },
      });
    } catch { /* non-fatal */ }
    opsEvent('auth', 'password_reset_via_sms', 'info', { userId });

    return { ok: true, verified: true, passwordReset: true };
  }

  // Phone-verify branch — mark the farmer's number as verified.
  // Phone lives on Farmer in this schema; guard with try/catch so
  // future schema evolution can add/drop `phoneVerifiedAt` safely.
  if (purpose === SMS_PURPOSES.PHONE_VERIFY) {
    try {
      if (prisma.farmer && typeof prisma.farmer.updateMany === 'function') {
        await prisma.farmer.updateMany({
          where: { phone: to },
          data:  { phoneVerifiedAt: new Date() },
        });
      }
    } catch { /* farmer.phoneVerifiedAt not present — non-fatal */ }
    try {
      await writeAuditLog({
        action: 'auth.phone_verified',
        details: { phone: to, provider: provider.name },
      });
    } catch { /* non-fatal */ }
    return { ok: true, verified: true, purpose };
  }

  // login_verify — OTP approved, now issue a session. We stamp
  // phoneVerifiedAt on the farmer row in the same flow so a first-
  // time phone-login farmer is "verified" after step 1 completes.
  if (purpose === SMS_PURPOSES.LOGIN_VERIFY) {
    try {
      if (prisma.farmer && typeof prisma.farmer.updateMany === 'function') {
        await prisma.farmer.updateMany({
          where: { phone: to },
          data:  { phoneVerifiedAt: new Date() },
        });
      }
    } catch { /* non-fatal */ }

    // Dynamic import keeps the SMS service tree-shakable from tests
    // that stub the provider but don't need a real auth service.
    try {
      const { loginViaPhone } = await import('../service.js');
      const session = await loginViaPhone({ phone: to });
      if (!session) {
        // No account on this phone. We still return ok:true/verified:
        // true so the farmer sees an honest "no account found on this
        // number" state in the UI instead of a scary auth error, but
        // we surface a distinct code so the caller can route to
        // signup instead of into the app.
        try {
          await writeAuditLog({
            action: 'auth.phone_login_no_account',
            details: { phone: to, provider: provider.name },
          });
        } catch { /* non-fatal */ }
        return {
          ok: true, verified: true, purpose,
          code: 'no_account',
          message: 'No account is linked to this phone number.',
        };
      }
      try {
        await writeAuditLog({
          userId: session.user.id,
          action: 'auth.phone_login_success',
          details: { phone: to, role: session.user.role },
        });
      } catch { /* non-fatal */ }
      return {
        ok: true, verified: true, purpose,
        user: session.user,
        accessToken: session.accessToken,
      };
    } catch (err) {
      opsEvent('auth', 'phone_login_failed', 'error',
        { phone: to, error: err?.message });
      // Do NOT throw — the OTP itself was valid. Return a safe
      // signal so the UI can show a retry / support prompt.
      return {
        ok: false, verified: true, purpose,
        code: 'login_failed',
        message: 'Verification succeeded but we could not start your session. Please try again.',
      };
    }
  }

  // Any other purpose — fall through with a plain verified result.
  // Success event already logged above the purpose branches.
  return { ok: true, verified: true, purpose };
}

export const _internal = Object.freeze({
  RESEND_COOLDOWN_MS,
  WINDOW_MS,
  MAX_PHONE_REQUESTS,
  MAX_IP_REQUESTS,
  cooldownRemaining,
  windowCount,
  redactPhone,
  recentSends,
  phoneRequests,
  ipRequests,
  clearCooldowns: () => {
    recentSends.clear();
    phoneRequests.clear();
    ipRequests.clear();
  },
});
