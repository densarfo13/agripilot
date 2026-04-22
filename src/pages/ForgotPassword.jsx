/**
 * ForgotPassword — /forgot-password
 *
 * Posts the farmer's email to `POST /api/v2/auth/forgot-password`.
 * The server always answers `{ success: true }` regardless of
 * whether the account exists (anti-enumeration), so we just show
 * the same confirmation panel on every successful response.
 *
 * Features wired in the integrated password-reset pass:
 *   • Resend cooldown (30s) after a successful send so farmers on
 *     weak networks can't spam-click and rate-limit themselves out.
 *   • SMS reset link ("Use SMS instead") is hidden when the server
 *     reports `recovery-methods.sms === false`, so we never render
 *     a broken option.
 *   • All copy is final + production-ready; no placeholder wording.
 *
 * The UI stays mobile-first, localized via useTranslation with safe
 * English fallbacks so the screen works even before new i18n keys
 * land in translations.js.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { forgotPassword, getRecoveryMethods } from '../lib/api';
import { useTranslation } from '../i18n/index.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

// Server rate-limits at a 15-minute window, but farmers re-tapping
// after 3s see a 429 they can't explain. A 30-second client cooldown
// gives honest feedback without masking real rate-limit errors.
const RESEND_COOLDOWN_SECONDS = 30;

export default function ForgotPassword() {
  const { t } = useTranslation();

  const [email,    setEmail]    = useState('');
  const [error,    setError]    = useState('');
  const [sent,     setSent]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(0);     // seconds remaining
  const [smsAvailable, setSmsAvailable] = useState(null);  // null = probing
  const tickRef = useRef(null);

  // ─── Final copy ────────────────────────────────────────────────
  const titleLbl      = resolve(t, 'auth.forgotPassword.title',     'Reset your password');
  const subLbl        = resolve(t, 'auth.forgotPassword.subtitle',
    'Enter the email on your Farroway account and we\u2019ll send a reset link.');
  const emailLbl      = resolve(t, 'auth.forgotPassword.email',     'Email address');
  const submitLbl     = resolve(t, 'auth.forgotPassword.submit',    'Send reset link');
  const submittingLbl = resolve(t, 'auth.forgotPassword.submitting','Sending\u2026');
  const backLbl       = resolve(t, 'auth.forgotPassword.backToLogin','Back to sign in');
  const sentTitle     = resolve(t, 'auth.forgotPassword.sentTitle',
    'We\u2019ve sent you a reset link');
  const sentMsg       = resolve(t, 'auth.forgotPassword.sentMsg',
    'If an account exists, we\u2019ve sent password reset instructions. '
    + 'Check your inbox and spam folder.');
  const sentHint      = resolve(t, 'auth.forgotPassword.sentHint',
    'Didn\u2019t get it? You can request another link after the cooldown.');
  const resendLbl     = resolve(t, 'auth.forgotPassword.resend',     'Resend link');
  const resendWaitLbl = resolve(t, 'auth.forgotPassword.resendWait', 'Try again in {{s}}s');
  const emailReq      = resolve(t, 'auth.forgotPassword.emailRequired',
    'Please enter the email address on your account.');
  const emailBad      = resolve(t, 'auth.forgotPassword.emailInvalid',
    'That doesn\u2019t look like a valid email address.');
  const generic       = resolve(t, 'auth.forgotPassword.generic',
    'We could not send the reset link. Please try again in a moment.');
  const preferSmsLbl  = resolve(t, 'auth.forgotPassword.preferSms',
    'Use SMS instead');

  // ─── Probe recovery methods so we can hide SMS when unavailable ─
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getRecoveryMethods();
        if (!cancelled) setSmsAvailable(!!(r && r.sms));
      } catch {
        // Fail-closed: if we can't verify SMS, don't offer it — an
        // apparent offer that returns 503 when clicked is worse than
        // no offer.
        if (!cancelled) setSmsAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Cooldown timer ────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [cooldown]);

  // ─── Submit / resend ───────────────────────────────────────────
  async function doSend(trimmedEmail) {
    setLoading(true);
    try {
      await forgotPassword({ email: trimmedEmail });
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      // Anti-enumeration means the happy-path server always returns
      // 200; this branch covers network / 5xx / rate-limit only.
      setError(err?.message ? friendly(err.message) : generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = email.trim();
    if (!trimmed) { setError(emailReq); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError(emailBad); return; }
    await doSend(trimmed);
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setError('');
    await doSend(email.trim());
  }

  // Map server / network shapes to short, user-safe lines. Never
  // renders raw provider / SendGrid errors.
  function friendly(msg) {
    const s = String(msg || '').toLowerCase();
    if (s.includes('rate') || s.includes('429') || s.includes('too many')) {
      return 'Too many requests. Please wait a minute and try again.';
    }
    if (s.includes('network') || s.includes('fetch')) {
      return 'We could not reach the server. Check your connection and try again.';
    }
    return generic;
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{titleLbl}</h1>
        <p style={S.subtitle}>{subLbl}</p>

        {sent ? (
          <div style={S.successBox} role="status" data-testid="forgot-password-sent">
            <div style={S.successTitle}>{sentTitle}</div>
            <p style={S.successBody}>{sentMsg}</p>
            <p style={S.successHint}>{sentHint}</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              style={{
                ...S.resendBtn,
                ...(cooldown > 0 || loading ? S.resendBtnDisabled : {}),
              }}
              data-testid="forgot-password-resend"
            >
              {cooldown > 0
                ? resendWaitLbl.replace('{{s}}', String(cooldown))
                : (loading ? submittingLbl : resendLbl)}
            </button>
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
          {smsAvailable && (
            <>
              {' \u00B7 '}
              <Link
                to="/forgot-password/sms"
                style={S.link}
                data-testid="forgot-password-sms-link"
              >
                {preferSmsLbl}
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#0F172A', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card:       { width: '100%', maxWidth: '28rem', borderRadius: '16px',
                background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)',
                padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  title:      { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  subtitle:   { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem',
                marginTop: '0.25rem', marginBottom: '1.5rem', lineHeight: 1.5 },
  form:       { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label:      { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' },
  input:      { background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff',
                outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' },
  errorBox:   { background: 'rgba(252,165,165,0.1)',
                border: '1px solid rgba(252,165,165,0.3)',
                borderRadius: '12px', padding: '0.75rem 1rem',
                color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  successBox: { background: 'rgba(134,239,172,0.08)',
                border: '1px solid rgba(134,239,172,0.3)',
                borderRadius: '12px', padding: '1rem 1.125rem',
                marginBottom: '0.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  successTitle:{ color: '#86EFAC', fontSize: '1rem', fontWeight: 700 },
  successBody: { color: '#D1FAE5', fontSize: '0.875rem', margin: 0, lineHeight: 1.5 },
  successHint: { color: 'rgba(255,255,255,0.55)', fontSize: '0.8125rem',
                 margin: 0, lineHeight: 1.45 },
  resendBtn:   { marginTop: '0.25rem', alignSelf: 'flex-start',
                 padding: '0.5rem 0.875rem', borderRadius: 10,
                 border: '1px solid rgba(134,239,172,0.3)',
                 background: 'transparent', color: '#86EFAC',
                 fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' },
  resendBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  link:        { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  button:      { background: '#22C55E', color: '#000', border: 'none',
                 borderRadius: '12px', padding: '0.75rem 1rem',
                 fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText:  { textAlign: 'center', color: 'rgba(255,255,255,0.6)',
                 fontSize: '0.875rem', marginTop: '1.5rem' },
};
