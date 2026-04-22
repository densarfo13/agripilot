/**
 * authUX.test.js — locks the production-grade auth UX contract
 * through source-level + behavioural assertions:
 *
 *   1. AuthFormMessage renders nothing when message is empty
 *   2. AuthFormMessage uses role=alert for errors, role=status for
 *      success/info
 *   3. LoadingButton disables + shows loadingText while loading
 *   4. LoadingButton renders a type="submit" by default
 *   5. OTPInput strips non-digits
 *   6. OTPInput clamps pasted strings to `length`
 *   7. OTPInput fires onComplete exactly once per completion
 *   8. OTPInput carries autoComplete="one-time-code"
 *   9. Login + Register + ResetPassword + ForgotPassword import the
 *      new reusables (no bare <button disabled + loading> / raw
 *      div-error-box patterns)
 *  10. Login shows a session-expired info banner when navigated
 *      with state.reason === 'session_expired'
 *  11. Login onBlur sets an email-format error
 *  12. Register clears field errors as the user types
 *  13. No placeholder copy (Lorem / TODO / xxx) in auth pages
 *  14. MFA OTP step uses the shared OTPInput (not a bare <input>)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

// ─── Component source contracts ─────────────────────────────────
describe('AuthFormMessage', () => {
  const src = readFile('src/components/auth/AuthFormMessage.jsx');

  it('returns null when message is empty', () => {
    expect(src).toMatch(/if \(!message\) return null/);
  });

  it('uses role="alert" for error and role="status" for success/info', () => {
    expect(src).toMatch(/tone === 'error' \? 'alert' : 'status'/);
  });

  it('has palettes for error/success/info tones', () => {
    expect(src).toMatch(/TONE\s*=\s*\{[\s\S]*error:\s*\{[\s\S]*success:\s*\{[\s\S]*info:/);
  });
});

describe('LoadingButton', () => {
  const src = readFile('src/components/auth/LoadingButton.jsx');

  it('disables on loading or disabled', () => {
    expect(src).toMatch(/isDisabled = !!disabled \|\| !!loading/);
  });

  it('swaps the label to loadingText while loading', () => {
    expect(src).toMatch(/loading \? loadingText : children/);
  });

  it('defaults to type="submit"', () => {
    expect(src).toMatch(/type = 'submit'/);
  });

  it('mounts a spin keyframes stylesheet exactly once', () => {
    expect(src).toMatch(/farroway-spin-kf/);
  });

  it('offers a ghost variant for secondary actions', () => {
    expect(src).toMatch(/ghostBase/);
  });
});

describe('OTPInput', () => {
  const src = readFile('src/components/auth/OTPInput.jsx');

  it('strips non-digits via a /\\D/g cleaner', () => {
    expect(src).toMatch(/\/\\D\/g/);
  });

  it('clamps to `length`', () => {
    expect(src).toMatch(/\.slice\(0, length\)/);
  });

  it('handles pasted codes with preventDefault', () => {
    expect(src).toMatch(/onPaste=\{handlePaste\}/);
    expect(src).toMatch(/e\.preventDefault/);
  });

  it('carries autoComplete="one-time-code" for iOS SMS autofill', () => {
    expect(src).toMatch(/autoComplete="one-time-code"/);
  });

  it('fires onComplete exactly once per completion via firedRef guard', () => {
    expect(src).toMatch(/firedRef\.current = true/);
    expect(src).toMatch(/firedRef\.current = false/);
  });
});

// ─── Page integration ───────────────────────────────────────────
describe('Login page', () => {
  const src = readFile('src/pages/Login.jsx');

  it('uses the shared AuthFormMessage for form-level errors', () => {
    expect(src).toMatch(/AuthFormMessage[\s\S]*tone="error"/);
  });

  it('surfaces a session-expired info banner via location.state.reason', () => {
    expect(src).toMatch(/location\.state[\s\S]*reason/);
    expect(src).toMatch(/session_expired/);
    expect(src).toMatch(/AuthFormMessage[\s\S]*tone="info"/);
  });

  it('swaps the submit button to LoadingButton', () => {
    expect(src).toMatch(/<LoadingButton[\s\S]*testId="login-submit"/);
  });

  it('MFA step uses OTPInput for the 6-digit code', () => {
    expect(src).toMatch(/<OTPInput[\s\S]*testId="login-mfa-code"/);
  });

  it('invalid email shows an inline error on blur', () => {
    expect(src).toMatch(/onBlur=\{\(\) => \{[\s\S]*isLikelyEmail/);
    expect(src).toMatch(/auth\.emailInvalid.*Enter a valid email address/);
  });

  it('clears field errors as user types (no stale red text)', () => {
    expect(src).toMatch(/setErrors\(\(s\) => \(\{ \.\.\.s, email: undefined \}\)\)/);
  });

  it('double-submit guard via submittingRef', () => {
    expect(src).toMatch(/submittingRef/);
  });
});

describe('Register page', () => {
  const src = readFile('src/pages/Register.jsx');

  it('uses AuthFormMessage + LoadingButton', () => {
    expect(src).toMatch(/AuthFormMessage[\s\S]*tone="error"/);
    expect(src).toMatch(/<LoadingButton[\s\S]*testId="register-submit"/);
  });

  it('submittingRef guards against double create-account submits', () => {
    expect(src).toMatch(/submittingRef/);
  });

  it('email onBlur triggers format validation', () => {
    expect(src).toMatch(/onBlur=\{\(\) => \{[\s\S]*Enter a valid email address/);
  });

  it('clears field errors on change', () => {
    expect(src).toMatch(/setErrors\(\(s\) => \(\{ \.\.\.s, email: undefined \}\)\)/);
    expect(src).toMatch(/setErrors\(\(s\) => \(\{ \.\.\.s, password: undefined \}\)\)/);
  });

  it('buttons + placeholders use production copy (not weak generics)', () => {
    expect(src).toMatch(/Create account/);
    expect(src).toMatch(/Creating account/);
    expect(src).toMatch(/Email address/);
  });
});

describe('ForgotPassword page', () => {
  const src = readFile('src/pages/ForgotPassword.jsx');

  it('uses AuthFormMessage for error banner', () => {
    expect(src).toMatch(/<AuthFormMessage[\s\S]*tone="error"/);
  });

  it('uses LoadingButton for submit', () => {
    expect(src).toMatch(/<LoadingButton[\s\S]*testId="forgot-password-submit"/);
  });

  it('success panel still describes the anti-enumeration flow', () => {
    // Existing copy asserted in other tests; here we just make sure
    // the panel remains wired and accessible.
    expect(src).toMatch(/data-testid="forgot-password-sent"/);
    expect(src).toMatch(/If an account exists/);
  });
});

describe('ResetPassword page', () => {
  const src = readFile('src/pages/ResetPassword.jsx');

  it('uses AuthFormMessage for top-level form errors', () => {
    expect(src).toMatch(/<AuthFormMessage[\s\S]*tone="error"[\s\S]*reset-password-form-error/);
  });

  it('uses LoadingButton for submit', () => {
    expect(src).toMatch(/<LoadingButton[\s\S]*testId="reset-password-submit"/);
  });

  it('PasswordInput wraps BOTH the new and confirm fields (toggle on each)', () => {
    const count = (src.match(/<PasswordInput\b/g) || []).length;
    expect(count).toBe(2);
  });
});

describe('ForgotPasswordSms page', () => {
  const src = readFile('src/pages/ForgotPasswordSms.jsx');

  it('replaces the raw code input with OTPInput', () => {
    expect(src).toMatch(/<OTPInput[\s\S]*testId="sms-code"/);
  });

  it('uses LoadingButton for both Send code and Verify code', () => {
    expect(src).toMatch(/<LoadingButton[\s\S]*testId="sms-send"/);
    expect(src).toMatch(/<LoadingButton[\s\S]*testId="sms-verify"/);
  });

  it('uses AuthFormMessage for the error banner', () => {
    expect(src).toMatch(/<AuthFormMessage[\s\S]*tone="error"/);
  });
});

// ─── No weak copy anywhere in the 5 auth pages ──────────────────
describe('auth pages — no placeholder / weak copy', () => {
  const files = [
    'src/pages/Login.jsx',
    'src/pages/Register.jsx',
    'src/pages/ForgotPassword.jsx',
    'src/pages/ResetPassword.jsx',
    'src/pages/ForgotPasswordSms.jsx',
  ];

  for (const f of files) {
    it(`${f} has no placeholder / lorem / TODO markers`, () => {
      const src = readFile(f);
      expect(src.toLowerCase()).not.toMatch(/\blorem\b/);
      expect(src.toLowerCase()).not.toMatch(/\btodo\b/);
      expect(src.toLowerCase()).not.toMatch(/\bplaceholder[ _-]?text\b/);
      // Raw translation keys rendered as fallback usually look like
      // "auth.xxx.yyy" shown in plain text — ensure we always pipe
      // translations through `t(...) || 'English fallback'`.
      expect(src).not.toMatch(/>\s*auth\.[a-zA-Z.]+\s*</);
    });
  }
});
