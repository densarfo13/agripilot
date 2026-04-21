/**
 * ResetPassword — /reset-password?token=…
 *
 * Reads the reset token from the query string, lets the farmer pick
 * a new password (with confirm), and submits to
 * `POST /api/v2/auth/reset-password`. On success shows a confirmation
 * card and offers a button back to Sign In.
 *
 * UX contract:
 *   • Token missing → inputs disabled, clear error.
 *   • Min 8 chars (matches server policy).
 *   • Passwords must match (client-side guard; server re-validates).
 *   • Submit button disabled while loading.
 *   • Success state is persistent — we do NOT auto-navigate silently,
 *     so the farmer always sees a confirmation before moving on.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { resetPassword } from '../lib/api';
import { useTranslation } from '../i18n/index.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const MIN_PASSWORD = 8;

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [error,    setError]      = useState('');
  const [loading,  setLoading]    = useState(false);
  const [done,     setDone]       = useState(false);

  // Labels — all go through i18n with English fallback.
  const titleLbl    = resolve(t, 'auth.resetPassword.title',       'Reset Password');
  const subLbl      = resolve(t, 'auth.resetPassword.subtitle',    'Enter your new password');
  const newLbl      = resolve(t, 'auth.resetPassword.new',         'New Password');
  const confirmLbl  = resolve(t, 'auth.resetPassword.confirm',     'Confirm Password');
  const submitLbl   = resolve(t, 'auth.resetPassword.submit',      'Reset Password');
  const submittingLbl = resolve(t, 'auth.resetPassword.submitting','Resetting\u2026');
  const backLbl     = resolve(t, 'auth.resetPassword.backToLogin', 'Back to Sign In');
  const successTitle = resolve(t, 'auth.resetPassword.successTitle','Password updated');
  const successMsg   = resolve(t, 'auth.resetPassword.successMsg',
    'You can now sign in with your new password.');
  const goToLoginLbl = resolve(t, 'auth.resetPassword.goToLogin',  'Go to Sign In');
  const missingTokenLbl = resolve(t, 'auth.resetPassword.missingToken',
    'Invalid or missing reset token. Please request a new reset link.');
  const minLenLbl = resolve(t, 'auth.resetPassword.minLen',
    `Password must be at least ${MIN_PASSWORD} characters`);
  const mismatchLbl = resolve(t, 'auth.resetPassword.mismatch',
    'Passwords do not match');
  const genericErrLbl = resolve(t, 'auth.resetPassword.genericError',
    'Could not reset password. The link may be invalid or expired.');
  const phPwd = resolve(t, 'auth.resetPassword.placeholderPwd',
    `At least ${MIN_PASSWORD} characters`);
  const phConfirm = resolve(t, 'auth.resetPassword.placeholderConfirm',
    'Repeat the password');

  // Client-side validation signals — block submit before network.
  const validation = useMemo(() => {
    if (!token) return { ok: false, msg: '' };
    if (!password) return { ok: false, msg: '' };
    if (password.length < MIN_PASSWORD) return { ok: false, msg: minLenLbl };
    if (password !== confirm) return { ok: false, msg: mismatchLbl };
    return { ok: true, msg: '' };
  }, [token, password, confirm, minLenLbl, mismatchLbl]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!token) { setError(missingTokenLbl); return; }
    if (!password) { setError(minLenLbl); return; }
    if (password.length < MIN_PASSWORD) { setError(minLenLbl); return; }
    if (password !== confirm) { setError(mismatchLbl); return; }

    setLoading(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      // Server is deliberately opaque — map everything to a single
      // farmer-friendly line. Field-level errors (e.g. weak password)
      // come back as `err.message` from the API wrapper.
      setError(err?.message ? String(err.message) : genericErrLbl);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>{successTitle}</h1>
          <div style={S.successBox}>{successMsg}</div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            style={S.button}
            data-testid="reset-password-go-login"
          >
            {goToLoginLbl}
          </button>
        </div>
      </div>
    );
  }

  const submitDisabled = loading || !validation.ok;

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{titleLbl}</h1>
        <p style={S.subtitle}>{subLbl}</p>

        {!token && (
          <div style={S.errorBox} role="alert">
            {missingTokenLbl}
          </div>
        )}

        {error && <div style={S.errorBox} role="alert">{error}</div>}

        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <div>
            <label style={S.label} htmlFor="rp-new">{newLbl}</label>
            <input
              id="rp-new"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={phPwd}
              style={S.input}
              disabled={!token || loading}
              minLength={MIN_PASSWORD}
              data-testid="reset-password-new"
            />
          </div>

          <div>
            <label style={S.label} htmlFor="rp-confirm">{confirmLbl}</label>
            <input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder={phConfirm}
              style={S.input}
              disabled={!token || loading}
              minLength={MIN_PASSWORD}
              data-testid="reset-password-confirm"
            />
          </div>

          <button
            type="submit"
            disabled={submitDisabled}
            style={{ ...S.button, ...(submitDisabled ? S.buttonDisabled : {}) }}
            data-testid="reset-password-submit"
          >
            {loading ? submittingLbl : submitLbl}
          </button>
        </form>

        <p style={S.footerText}>
          <Link to="/login" style={S.link}>{backLbl}</Link>
        </p>
      </div>
    </div>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card:       { width: '100%', maxWidth: '28rem', borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  title:      { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  subtitle:   { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.5rem' },
  form:       { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label:      { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' },
  input:      { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff', outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' },
  errorBox:   { background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  successBox: { background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#86EFAC', fontSize: '0.875rem', marginBottom: '1rem' },
  link:       { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  button:     { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
};
