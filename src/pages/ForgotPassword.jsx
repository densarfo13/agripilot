/**
 * ForgotPassword — /forgot-password
 *
 * Posts the farmer's email to `POST /api/v2/auth/forgot-password`.
 * The server always answers `{ success: true }` regardless of
 * whether the account exists (anti-enumeration), so we just show
 * the same success panel on every successful response.
 *
 * The UI stays mobile-first, localized via useTranslation with
 * safe English fallbacks so this screen works even before new
 * keys land in translations.js.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { forgotPassword } from '../lib/api';
import { useTranslation } from '../i18n/index.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const titleLbl      = resolve(t, 'auth.forgotPassword.title',    'Forgot Password');
  const subLbl        = resolve(t, 'auth.forgotPassword.subtitle',
    'Enter your email and we\u2019ll send a reset link.');
  const emailLbl      = resolve(t, 'auth.forgotPassword.email',    'Email');
  const submitLbl     = resolve(t, 'auth.forgotPassword.submit',   'Send Reset Link');
  const submittingLbl = resolve(t, 'auth.forgotPassword.submitting','Sending\u2026');
  const backLbl       = resolve(t, 'auth.forgotPassword.backToLogin','Back to Sign In');
  const sentMsg       = resolve(t, 'auth.forgotPassword.sentMsg',
    'If an account exists for this email, a reset link has been sent. Check your inbox \u2014 the link expires in 30 minutes.');
  const emailReq      = resolve(t, 'auth.forgotPassword.emailRequired', 'Email is required');
  const emailBad      = resolve(t, 'auth.forgotPassword.emailInvalid',  'Enter a valid email');
  const generic       = resolve(t, 'auth.forgotPassword.generic',
    'Something went wrong. Please try again.');
  const preferSmsLbl  = resolve(t, 'auth.forgotPassword.preferSms',
    'Reset by SMS instead');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) { setError(emailReq); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError(emailBad); return; }

    setLoading(true);
    try {
      await forgotPassword({ email: trimmed });
      setSent(true);
    } catch (err) {
      setError(err?.message ? String(err.message) : generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{titleLbl}</h1>
        <p style={S.subtitle}>{subLbl}</p>

        {sent ? (
          <div style={S.successBox} data-testid="forgot-password-sent">
            {sentMsg}
          </div>
        ) : (
          <>
            {error && <div style={S.errorBox} role="alert">{error}</div>}

            <form onSubmit={handleSubmit} style={S.form} noValidate>
              <div>
                <label style={S.label} htmlFor="fp-email">{emailLbl}</label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={emailLbl}
                  style={S.input}
                  disabled={loading}
                  data-testid="forgot-password-email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ ...S.button, ...(loading ? S.buttonDisabled : {}) }}
                data-testid="forgot-password-submit"
              >
                {loading ? submittingLbl : submitLbl}
              </button>
            </form>
          </>
        )}

        <p style={S.footerText}>
          <Link to="/login" style={S.link}>{backLbl}</Link>
          {' \u00B7 '}
          <Link to="/forgot-password/sms" style={S.link}>{preferSmsLbl}</Link>
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
  successBox: { background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#86EFAC', fontSize: '0.875rem', marginBottom: '0.5rem' },
  link:       { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  button:     { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
};
