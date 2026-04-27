/**
 * ResetPassword — /reset-password?token=…
 *
 * Four explicit states (user-spec §6):
 *   1. loading  — pre-flight verifying the URL token. Shown until
 *                 POST /api/v2/auth/verify-reset-token resolves.
 *                 Without this, a dead link still renders the form
 *                 and the user only finds out on submit.
 *   2. default  — token verified valid; user enters new password
 *                 + confirm.
 *   3. success  — password updated; CTA goes to /login.
 *   4. expired  — token missing / invalid / expired / used /
 *                 belongs to a deactivated account. CTA goes to
 *                 /forgot-password so the user can request a new
 *                 link without retyping their email from memory.
 *
 * Server contract (server/routes/auth.js):
 *   POST /api/v2/auth/verify-reset-token { token }     -> { valid: boolean }
 *   POST /api/v2/auth/reset-password     { token, password }
 *
 * Both endpoints are uniformly opaque about WHY a token is bad
 * (missing / wrong / expired / used / inactive all collapse to
 * one signal). The page mirrors that: every failure mode lands
 * on the same recovery CTA without leaking detail.
 *
 * Farroway styling: dark #0F172A background, #1B2330 card, #22C55E
 * primary CTA, #EAF2FF body text, mobile-first (centered card,
 * responsive padding, 44px+ tap targets).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { resetPassword, verifyResetToken } from '../lib/api';
import { useTranslation } from '../i18n/index.js';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthFormMessage from '../components/auth/AuthFormMessage.jsx';
import LoadingButton from '../components/auth/LoadingButton.jsx';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const MIN_PASSWORD = 8;

// Detect the "this link is dead" signal coming back from the server.
// Server is intentionally opaque (single message for missing/expired/
// already-used tokens). We match on substrings + a 400-like bucket
// so any future rewording of the server message still routes here.
function looksLikeExpiredToken(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '').toLowerCase();
  if (code.includes('token')) return true;
  if (code === 'invalid_or_expired') return true;
  if (code === 'token_invalid' || code === 'token_expired') return true;
  if (msg.includes('invalid or expired')) return true;
  if (msg.includes('reset token')) return true;
  return false;
}

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // ─── State ─────────────────────────────────────────────────────
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  // Initial view depends on whether the URL even carries a token.
  // Missing token short-circuits to 'expired' immediately so we
  // don't waste a network round-trip on a guaranteed failure.
  // Otherwise we start on 'verifying' and the on-mount effect
  // below resolves to 'default' or 'expired'.
  const [view,     setView]     = useState(() => (token ? 'verifying' : 'expired'));
  const [fieldErrors, setFieldErrors] = useState({}); // { password?, confirm? }
  const [formError, setFormError] = useState(''); // generic banner when not field-scoped
  const submittingRef = useRef(false);
  const newPwRef = useRef(null);

  // Pre-flight verify on mount — fail closed (treat any non-true
  // response, including network errors, as expired) so a dead link
  // surfaces the recovery CTA before the user types a new password.
  // The endpoint itself is uniformly opaque about WHY (no enumeration
  // surface); the page mirrors that opacity in its single 'expired'
  // view.
  useEffect(() => {
    if (!token) return; // already on 'expired'
    let cancelled = false;
    (async () => {
      try {
        const result = await verifyResetToken({ token });
        if (cancelled) return;
        setView(result && result.valid === true ? 'default' : 'expired');
      } catch {
        if (!cancelled) setView('expired');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Autofocus the first password field on default view.
  useEffect(() => {
    if (view === 'default' && newPwRef.current) {
      try { newPwRef.current.focus(); } catch { /* ignore */ }
    }
  }, [view]);

  // ─── Copy (goes through i18n with safe English fallbacks) ──────
  const L = useMemo(() => ({
    // Default state
    title:            resolve(t, 'auth.resetPassword.title',
      'Reset your password'),
    subtitle:         resolve(t, 'auth.resetPassword.subtitle',
      'Enter your new password below to regain access to your Farroway account.'),
    newPwLbl:         resolve(t, 'auth.resetPassword.newPassword',
      'New password'),
    confirmLbl:       resolve(t, 'auth.resetPassword.confirmPassword',
      'Confirm password'),
    newPwHint:        resolve(t, 'auth.resetPassword.newPasswordHint',
      `At least ${MIN_PASSWORD} characters`),
    confirmHint:      resolve(t, 'auth.resetPassword.confirmPasswordHint',
      'Re-enter your new password'),
    submitLbl:        resolve(t, 'auth.resetPassword.submit',      'Reset Password'),
    submittingLbl:    resolve(t, 'auth.resetPassword.submitting',  'Resetting\u2026'),
    backToLoginLbl:   resolve(t, 'auth.resetPassword.backToLogin', 'Back to login'),
    // Loading (pre-flight verify on mount)
    verifyingTitle:   resolve(t, 'auth.resetPassword.verifyingTitle',
      'Checking your reset link\u2026'),
    verifyingSubtitle: resolve(t, 'auth.resetPassword.verifyingSubtitle',
      'One moment while we make sure this link is still valid.'),
    // Validation
    errPwRequired:    resolve(t, 'auth.resetPassword.errNewPwRequired',
      'New password is required'),
    errConfirmRequired: resolve(t, 'auth.resetPassword.errConfirmRequired',
      'Confirm password is required'),
    errMinLen:        resolve(t, 'auth.resetPassword.errMinLen',
      `Password must be at least ${MIN_PASSWORD} characters`),
    errMismatch:      resolve(t, 'auth.resetPassword.errMismatch',
      'Passwords do not match'),
    errGeneric:       resolve(t, 'auth.resetPassword.errGeneric',
      'Unable to reset password right now. Please try again.'),
    // Success
    successTitle:     resolve(t, 'auth.resetPassword.successTitle',
      'Your password has been reset'),
    successSubtitle:  resolve(t, 'auth.resetPassword.successSubtitle',
      'You can now sign in.'),
    successCta:       resolve(t, 'auth.resetPassword.successCta',
      'Back to sign in'),
    // Expired
    expiredTitle:     resolve(t, 'auth.resetPassword.expiredTitle',
      'Reset link invalid or expired'),
    expiredSubtitle:  resolve(t, 'auth.resetPassword.expiredSubtitle',
      'Request a new reset email and try again.'),
    expiredCta:       resolve(t, 'auth.resetPassword.expiredCta',
      'Request new reset link'),
  }), [t]);

  // ─── Validation ────────────────────────────────────────────────
  function validate() {
    const errs = {};
    if (!password) errs.password = L.errPwRequired;
    else if (password.length < MIN_PASSWORD) errs.password = L.errMinLen;
    if (!confirm) errs.confirm = L.errConfirmRequired;
    else if (password && password !== confirm) errs.confirm = L.errMismatch;
    return errs;
  }

  // ─── Submit ────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (submittingRef.current) return;

    setFormError('');
    setFieldErrors({});

    // If token vanished between render and submit (user cleared it
    // manually via devtools), bounce to the expired view.
    if (!token) { setView('expired'); return; }

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // Autofocus the first errored input for keyboard-only flows.
      if (errs.password && newPwRef.current) {
        try { newPwRef.current.focus(); } catch { /* ignore */ }
      }
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // Server contract: { token, password }. Keep this shape locked
      // to validateResetPasswordPayload in server/lib/validation.js.
      await resetPassword({ token, password });
      setView('success');
    } catch (err) {
      if (looksLikeExpiredToken(err)) {
        setView('expired');
        return;
      }
      // Server-provided message is already user-safe (it's the
      // validateResetPasswordPayload string or the 500 fallback).
      // Clip defensively.
      const msg = String(err?.message || '').slice(0, 160);
      setFormError(msg && !/stack|error:/i.test(msg) ? msg : L.errGeneric);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  // ─── Render: verifying (pre-flight) ────────────────────────────
  // Must NOT show the password form here — submitting against an
  // unverified token would leak detail about the failure mode via
  // the timing of /reset-password's response.
  if (view === 'verifying') {
    return (
      <div style={S.page}>
        <div
          style={S.card}
          role="status"
          aria-live="polite"
          aria-busy="true"
          data-testid="reset-password-verifying"
        >
          <div style={S.iconWrap} aria-hidden="true">
            <Spinner />
          </div>
          <h1 style={S.title}>{L.verifyingTitle}</h1>
          <p style={S.subtitle}>{L.verifyingSubtitle}</p>
        </div>
      </div>
    );
  }

  // ─── Render: success ───────────────────────────────────────────
  if (view === 'success') {
    return (
      <div style={S.page}>
        <div style={S.card} role="status">
          <div style={S.iconWrap} aria-hidden="true">
            <CheckIcon />
          </div>
          <h1 style={S.title}>{L.successTitle}</h1>
          <p style={S.subtitle}>{L.successSubtitle}</p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={S.primaryBtn}
            data-testid="reset-password-success-cta"
            autoFocus
          >
            {L.successCta}
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: expired / invalid token ──────────────────────────
  if (view === 'expired') {
    return (
      <div style={S.page}>
        <div style={S.card} role="alert">
          <div style={S.iconWrapDanger} aria-hidden="true">
            <AlertIcon />
          </div>
          <h1 style={S.title}>{L.expiredTitle}</h1>
          <p style={S.subtitle}>{L.expiredSubtitle}</p>
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            style={S.primaryBtn}
            data-testid="reset-password-expired-cta"
            autoFocus
          >
            {L.expiredCta}
          </button>
          <p style={S.footerText}>
            <Link to="/login" style={S.link}>{L.backToLoginLbl}</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── Render: default ───────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{L.title}</h1>
        <p style={S.subtitle}>{L.subtitle}</p>

        <AuthFormMessage
          tone="error"
          message={formError}
          testId="reset-password-form-error"
        />

        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <div>
            <label style={S.label} htmlFor="rp-new">{L.newPwLbl}</label>
            <PasswordInput
              id="rp-new"
              ref={newPwRef}
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((s) => ({ ...s, password: undefined }));
                }
              }}
              placeholder={L.newPwHint}
              style={{
                ...S.input,
                ...(fieldErrors.password ? S.inputError : {}),
              }}
              disabled={loading}
              minLength={MIN_PASSWORD}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'rp-new-err' : undefined}
              data-testid="reset-password-new"
              testIdPrefix="reset-password-new"
              toggleAriaLabels={{
                show: resolve(t, 'auth.showPassword', 'Show password'),
                hide: resolve(t, 'auth.hidePassword', 'Hide password'),
              }}
            />
            {fieldErrors.password && (
              <div id="rp-new-err" style={S.fieldError} data-testid="reset-password-new-error">
                {fieldErrors.password}
              </div>
            )}
          </div>

          <div>
            <label style={S.label} htmlFor="rp-confirm">{L.confirmLbl}</label>
            <PasswordInput
              id="rp-confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (fieldErrors.confirm) {
                  setFieldErrors((s) => ({ ...s, confirm: undefined }));
                }
              }}
              placeholder={L.confirmHint}
              style={{
                ...S.input,
                ...(fieldErrors.confirm ? S.inputError : {}),
              }}
              disabled={loading}
              minLength={MIN_PASSWORD}
              aria-invalid={!!fieldErrors.confirm}
              aria-describedby={fieldErrors.confirm ? 'rp-confirm-err' : undefined}
              data-testid="reset-password-confirm"
              testIdPrefix="reset-password-confirm"
              toggleAriaLabels={{
                show: resolve(t, 'auth.showPassword', 'Show password'),
                hide: resolve(t, 'auth.hidePassword', 'Hide password'),
              }}
            />
            {fieldErrors.confirm && (
              <div id="rp-confirm-err" style={S.fieldError} data-testid="reset-password-confirm-error">
                {fieldErrors.confirm}
              </div>
            )}
          </div>

          <LoadingButton
            loading={loading}
            loadingText={L.submittingLbl}
            testId="reset-password-submit"
            style={S.primaryBtn}
          >
            {L.submitLbl}
          </LoadingButton>
        </form>

        <p style={S.footerText}>
          <Link to="/login" style={S.link} data-testid="reset-password-back-to-login">
            {L.backToLoginLbl}
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Inline SVG icons (no dependency on an icon library) ─────────
function Spinner() {
  // Pure-CSS spinner — keyed off the `farroway-spin` keyframe used
  // elsewhere in the app (ProfileGuard / OnboardingSteps). No CSS
  // animation library, no extra import. The keyframe is registered
  // in the global stylesheet that ships with the auth pages so we
  // can reference it directly.
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: '1.5rem',
        height: '1.5rem',
        border: '3px solid rgba(255,255,255,0.16)',
        borderTopColor: '#22C55E',
        borderRadius: '50%',
        animation: 'farroway-spin 0.8s linear infinite',
      }}
    />
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#22C55E" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3 L22 20 L2 20 Z" stroke="#FCA5A5" strokeWidth="2"
            strokeLinejoin="round" />
      <path d="M12 10v5" stroke="#FCA5A5" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1" fill="#FCA5A5" />
    </svg>
  );
}

// ─── Styles (Farroway dark theme, mobile-first) ─────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#EAF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    boxSizing: 'border-box',
  },
  card: {
    width: '100%',
    maxWidth: '28rem',
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '2rem 1.75rem',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
    color: '#FFFFFF',
    lineHeight: 1.25,
  },
  subtitle: {
    color: '#9FB3C8',
    fontSize: '0.9375rem',
    marginTop: '0.375rem',
    marginBottom: '1.5rem',
    lineHeight: 1.5,
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#9FB3C8',
    marginBottom: '0.375rem',
    display: 'block',
  },
  input: {
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#EAF2FF',
    outline: 'none',
    width: '100%',
    fontSize: '0.9375rem',
    boxSizing: 'border-box',
    minHeight: 44,
  },
  inputError: {
    borderColor: 'rgba(252,165,165,0.6)',
    background: 'rgba(252,165,165,0.04)',
  },
  fieldError: {
    color: '#FCA5A5',
    fontSize: '0.8125rem',
    marginTop: '0.375rem',
  },
  errorBox: {
    background: 'rgba(252,165,165,0.08)',
    border: '1px solid rgba(252,165,165,0.3)',
    borderRadius: '12px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    marginBottom: '0.75rem',
  },
  primaryBtn: {
    background: '#22C55E',
    color: '#07210E',
    border: 'none',
    borderRadius: '12px',
    padding: '0.875rem 1rem',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%',
    minHeight: 48,
    marginTop: '0.5rem',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  primaryBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  link: { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  footerText: {
    textAlign: 'center',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    marginTop: '1.25rem',
  },
  iconWrap: {
    width: '3rem', height: '3rem', borderRadius: '50%',
    background: 'rgba(34,197,94,0.14)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '0.75rem',
  },
  iconWrapDanger: {
    width: '3rem', height: '3rem', borderRadius: '50%',
    background: 'rgba(252,165,165,0.12)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '0.75rem',
  },
};
