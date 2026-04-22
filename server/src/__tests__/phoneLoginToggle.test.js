/**
 * phoneLoginToggle.test.js — locks the Email / Phone method toggle
 * on Login.jsx and the existing phone-OTP integration contract.
 *
 *   1. Login.jsx exposes both methods with role=tab buttons
 *   2. Switching methods clears errors + general state
 *   3. Phone submit validates E.164 format inline
 *   4. Phone submit calls requestPhoneOtp via AuthContext
 *   5. Happy-path navigates to /verify-otp with phone in state
 *   6. Phone errors are mapped to friendly copy (no raw Twilio strings)
 *   7. Rate-limit / recipient_invalid / provider_error codes are
 *      all handled with safe messages
 *   8. VerifyOtp routes no_account users to /farmer-register
 *      (create-account-if-new contract)
 *   9. requestPhoneOtp + verifyPhoneOtp talk to the documented
 *      v2 endpoints
 *  10. Server rate limit wired on both otp/request + otp/verify
 *  11. Server cookie-setting on phone-login verify (session start)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

const LOGIN       = readFile('src/pages/Login.jsx');
const VERIFY      = readFile('src/pages/VerifyOtp.jsx');
const API         = readFile('src/lib/api.js');
const AUTH        = readFile('src/context/AuthContext.jsx');
const SERVER_AUTH = readFile('server/routes/auth.js');

// ─── Login method toggle ────────────────────────────────────────
describe('Login — method toggle', () => {
  it('renders a role="tablist" with Email + Phone tabs', () => {
    expect(LOGIN).toMatch(/role="tablist"/);
    expect(LOGIN).toMatch(/data-testid="login-method-email"/);
    expect(LOGIN).toMatch(/data-testid="login-method-phone"/);
    expect(LOGIN).toMatch(/aria-selected=\{method === 'email'\}/);
    expect(LOGIN).toMatch(/aria-selected=\{method === 'phone'\}/);
  });

  it('switching methods clears field + general error state', () => {
    // Both onClick handlers reset errors / general / phone error.
    expect(LOGIN).toMatch(/setMethod\('phone'\);[\s\S]*setErrors\(\{\}\);[\s\S]*setGeneralError\(''\);[\s\S]*setPhoneError\(''\);/);
    expect(LOGIN).toMatch(/setMethod\('email'\);[\s\S]*setErrors\(\{\}\);[\s\S]*setGeneralError\(''\);[\s\S]*setPhoneError\(''\);/);
  });

  it('phone form uses the shared PhoneInput + LoadingButton', () => {
    expect(LOGIN).toMatch(/<PhoneInput[\s\S]*data-testid="login-phone"/);
    expect(LOGIN).toMatch(/<LoadingButton[\s\S]*testId="login-phone-submit"/);
  });

  it('E.164 format check blocks submit with a friendly inline error', () => {
    expect(LOGIN).toMatch(/function isLikelyE164/);
    expect(LOGIN).toMatch(/\/\^\\\+\[1-9\]\\d\{6,14\}\$\//);
    expect(LOGIN).toMatch(/Enter a full phone number including country code/);
  });

  it('phone submit calls requestPhoneOtp on AuthContext', () => {
    expect(LOGIN).toMatch(/const \{\s*[\s\S]*requestPhoneOtp,[\s\S]*\} = useAuth\(\)/);
    expect(LOGIN).toMatch(/await requestPhoneOtp\(trimmed\)/);
  });

  it('happy path navigates to /verify-otp with phone in route state', () => {
    expect(LOGIN).toMatch(/navigate\('\/verify-otp'[\s\S]*state: \{ phone: trimmed \}/);
  });

  it('double-submit guard via phoneSubmittingRef', () => {
    expect(LOGIN).toMatch(/phoneSubmittingRef\.current = true/);
    expect(LOGIN).toMatch(/phoneSubmittingRef\.current = false/);
  });

  it('maps provider codes to user-safe lines — no raw Twilio strings', () => {
    expect(LOGIN).toMatch(/function friendlyPhoneError/);
    expect(LOGIN).toMatch(/rate_limited[\s\S]*Too many attempts/);
    expect(LOGIN).toMatch(/recipient_invalid/);
    expect(LOGIN).toMatch(/provider_error/);
  });

  it('shows the phone-side error banner via AuthFormMessage', () => {
    expect(LOGIN).toMatch(/testId={method === 'email' \? 'login-error' : 'login-phone-error'}/);
  });
});

// ─── API contract ───────────────────────────────────────────────
describe('API — phone OTP endpoints', () => {
  it('requestPhoneOtp targets POST /api/v2/auth/otp/request', () => {
    expect(API).toMatch(/requestPhoneOtp[\s\S]*\/api\/v2\/auth\/otp\/request[\s\S]*method: 'POST'/);
  });

  it('verifyPhoneOtp targets POST /api/v2/auth/otp/verify', () => {
    expect(API).toMatch(/verifyPhoneOtp[\s\S]*\/api\/v2\/auth\/otp\/verify[\s\S]*method: 'POST'/);
  });
});

// ─── AuthContext bridge ─────────────────────────────────────────
describe('AuthContext — phone OTP', () => {
  it('exposes requestPhoneOtp + verifyPhoneOtp through useAuth', () => {
    expect(AUTH).toMatch(/requestPhoneOtp as requestPhoneOtpApi/);
    expect(AUTH).toMatch(/verifyPhoneOtp as verifyPhoneOtpApi/);
    expect(AUTH).toMatch(/requestPhoneOtp,\s*\n?\s*verifyPhoneOtp,/);
  });

  it('verifyPhoneOtp sets the user on success (auth cookies via server)', () => {
    expect(AUTH).toMatch(/async function verifyPhoneOtp[\s\S]*setUser\(loggedInUser\)/);
  });
});

// ─── VerifyOtp page — create-if-new + resend cooldown ────────────
describe('VerifyOtp', () => {
  it('routes no_account responses into /farmer-register (create new user)', () => {
    expect(VERIFY).toMatch(/data\.code === 'no_account'[\s\S]*navigate\('\/farmer-register'[\s\S]*state: \{ phone \}/);
  });

  it('resend cooldown honours server cooldownSec + retryAfterSec', () => {
    expect(VERIFY).toMatch(/cooldownSec/);
    expect(VERIFY).toMatch(/retryAfterSec/);
    expect(VERIFY).toMatch(/setResendCooldown\(retry\)/);
  });

  it('clears the code field on any verify failure so farmer can retry', () => {
    expect(VERIFY).toMatch(/setDigits\(Array\(CODE_LENGTH\)\.fill\(''\)\)/);
  });

  it('maps server codes to safe copy (no raw Twilio strings)', () => {
    expect(VERIFY).toMatch(/invalid_code/);
    expect(VERIFY).toMatch(/expired_or_invalid/);
    expect(VERIFY).toMatch(/max_attempts/);
    expect(VERIFY).toMatch(/rate_limited/);
    expect(VERIFY).toMatch(/provider_error/);
  });

  it('6-digit paste support auto-submits when full', () => {
    expect(VERIFY).toMatch(/handlePaste/);
    expect(VERIFY).toMatch(/CODE_LENGTH = 6/);
    expect(VERIFY).toMatch(/pasted\.length === CODE_LENGTH[\s\S]*handleVerify\(pasted\)/);
  });
});

// ─── Server — rate limit + cookies + E.164 ──────────────────────
describe('server/routes/auth — phone OTP', () => {
  it('applies passwordResetLimiter to both otp/request and otp/verify', () => {
    expect(SERVER_AUTH).toMatch(/router\.post\('\/otp\/request', passwordResetLimiter, handleSendOtp\)/);
    expect(SERVER_AUTH).toMatch(/router\.post\('\/otp\/verify',\s*passwordResetLimiter, handleVerifyOtp\)/);
  });

  it('sets HttpOnly auth cookies when the verify step produces a session', () => {
    expect(SERVER_AUTH).toMatch(/result\.ok && result\.user && result\.accessToken[\s\S]*setAuthCookies/);
  });

  it('never leaks the session token in the response body', () => {
    // The happy-path payload forwards `user` but NEVER `accessToken` /
    // `refreshToken`. Cookies are the only session carrier.
    const payload = SERVER_AUTH.match(/const payload = result\.ok[\s\S]*?: \{[\s\S]*?\}/);
    expect(payload).not.toBeNull();
    expect(payload[0]).not.toMatch(/accessToken:/);
    expect(payload[0]).not.toMatch(/refreshToken:/);
  });

  it('provider errors are mapped to a user-safe 500 body', () => {
    expect(SERVER_AUTH).toMatch(/Could not send a verification code right now|Could not send verification code right now/);
    expect(SERVER_AUTH).toMatch(/Could not verify the code right now/);
  });
});
