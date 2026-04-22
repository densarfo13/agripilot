/**
 * ForgotPasswordSms — phone-based password recovery.
 *
 * Three-step single-page flow:
 *   1. enter phone → POST /api/auth/sms/start-verification
 *   2. enter OTP + new password → POST /api/auth/sms/check-verification
 *   3. success screen → link back to /login
 *
 * The server is anti-enumeration: a phone with no account still
 * receives a "sent" response, so the UI says the same thing either
 * way. If the provider isn't configured the server returns 503 and
 * we show a clear fallback pointing at the email reset.
 *
 * Mobile-first contract:
 *   • phone input uses tel keyboard + E.164 prefix hint
 *   • OTP input uses numeric keyboard + one-time-code autofill
 *   • resend cooldown is visible and live-counted
 *   • every string runs through useTranslation with English fallback
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { smsStartVerification, smsCheckVerification } from '../lib/api';
import { useTranslation } from '../i18n/index.js';
import PasswordInput from '../components/PasswordInput.jsx';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const MIN_PASSWORD = 8;
const DEFAULT_COOLDOWN = 30;     // seconds; server echoes the real one
const PURPOSE = 'password_reset';

// Lightweight client check — server re-validates via toE164().
function looksLikeE164(str) {
  const s = String(str || '').trim();
  if (!s.startsWith('+')) return false;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export default function ForgotPasswordSms() {
  const { t } = useTranslation();

  const [step,     setStep]     = useState('phone');  // 'phone' | 'otp' | 'done'
  const [phone,    setPhone]    = useState('');
  const [code,     setCode]     = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [cooldown, setCooldown] = useState(0);        // seconds remaining for resend

  const tickRef = useRef(null);
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  function startCooldown(sec) {
    setCooldown(sec);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(tickRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  // ─── Labels ─────────────────────────────────────────────
  const titleLbl       = resolve(t, 'auth.sms.title',          'Reset via SMS');
  const phoneStepSub   = resolve(t, 'auth.sms.phoneSubtitle',
    'Enter your phone number. We\u2019ll send you a one-time code.');
  const otpStepSub     = resolve(t, 'auth.sms.otpSubtitle',
    'Enter the code we just texted, then choose a new password.');
  const phoneLbl       = resolve(t, 'auth.sms.phone',          'Phone number');
  const codeLbl        = resolve(t, 'auth.sms.code',           'Verification code');
  const newPwdLbl      = resolve(t, 'auth.sms.newPassword',    'New password');
  const confirmLbl     = resolve(t, 'auth.sms.confirm',        'Confirm password');
  const sendLbl        = resolve(t, 'auth.sms.send',           'Send code');
  const sendingLbl     = resolve(t, 'auth.sms.sending',        'Sending\u2026');
  const verifyLbl      = resolve(t, 'auth.sms.verify',         'Verify and reset');
  const verifyingLbl   = resolve(t, 'auth.sms.verifying',      'Verifying\u2026');
  const resendLbl      = resolve(t, 'auth.sms.resend',         'Resend code');
  const resendInLbl    = resolve(t, 'auth.sms.resendIn',       'Resend in {{s}}s');
  const changeLbl      = resolve(t, 'auth.sms.changePhone',    'Use a different phone number');
  const sentMsg        = resolve(t, 'auth.sms.sent',
    'If an account exists for that phone, we\u2019ve sent a code. It expires in a few minutes.');
  const successTitle   = resolve(t, 'auth.sms.successTitle',   'Password updated');
  const successMsg     = resolve(t, 'auth.sms.successMsg',
    'You can now sign in with your new password.');
  const goToLoginLbl   = resolve(t, 'auth.sms.goToLogin',      'Go to Sign In');
  const backLbl        = resolve(t, 'auth.sms.backToLogin',    'Back to Sign In');
  const preferEmailLbl = resolve(t, 'auth.sms.preferEmail',    'Reset by email instead');

  const phoneInvalidLbl = resolve(t, 'auth.sms.phoneInvalid',
    'Enter your number in international format, e.g. +254712345678.');
  const codeRequiredLbl = resolve(t, 'auth.sms.codeRequired',   'Enter the code you received.');
  const minLenLbl       = resolve(t, 'auth.sms.minLen',
    `Password must be at least ${MIN_PASSWORD} characters`);
  const mismatchLbl     = resolve(t, 'auth.sms.mismatch',       'Passwords do not match');
  const genericErrLbl   = resolve(t, 'auth.sms.generic',
    'Something went wrong. Please try again.');
  const unavailableLbl  = resolve(t, 'auth.sms.unavailable',
    'SMS reset isn\u2019t available right now. Use the email link instead.');

  // ─── Handlers ────────────────────────────────────────────
  async function handleSendCode(e) {
    if (e) e.preventDefault();
    setError('');
    if (!looksLikeE164(phone)) { setError(phoneInvalidLbl); return; }
    setLoading(true);
    try {
      const r = await smsStartVerification({
        phone: phone.trim(),
        purpose: PURPOSE,
        channel: 'sms',
      });
      if (r && r.ok) {
        startCooldown(Number(r.cooldownSec) || DEFAULT_COOLDOWN);
        setStep('otp');
      } else if (r && r.code === 'provider_unavailable') {
        setError(unavailableLbl);
      } else {
        setError((r && r.message) || genericErrLbl);
      }
    } catch (err) {
      // Server returns 429 with retryAfterSec for cooldowns — surface
      // that gracefully.
      const msg = err?.payload?.message || err?.message || genericErrLbl;
      const retry = Number(err?.payload?.retryAfterSec);
      if (Number.isFinite(retry) && retry > 0) startCooldown(retry);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    await handleSendCode();
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    if (!code.trim()) { setError(codeRequiredLbl); return; }
    if (!password || password.length < MIN_PASSWORD) { setError(minLenLbl); return; }
    if (password !== confirm) { setError(mismatchLbl); return; }

    setLoading(true);
    try {
      const r = await smsCheckVerification({
        phone: phone.trim(),
        code: code.trim(),
        purpose: PURPOSE,
        newPassword: password,
      });
      if (r && r.ok && r.verified) {
        setStep('done');
      } else {
        setError((r && r.message) || genericErrLbl);
      }
    } catch (err) {
      setError(err?.payload?.message || err?.message || genericErrLbl);
    } finally {
      setLoading(false);
    }
  }

  const resendButton = useMemo(() => {
    if (cooldown > 0) {
      return String(resendInLbl).replace('{{s}}', String(cooldown));
    }
    return resendLbl;
  }, [cooldown, resendInLbl, resendLbl]);

  // ─── Render ──────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <h1 style={S.title}>{successTitle}</h1>
          <div style={S.successBox}>{successMsg}</div>
          <Link to="/login" style={{ ...S.button, textAlign: 'center', display: 'block' }}>
            {goToLoginLbl}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{titleLbl}</h1>
        <p style={S.subtitle}>
          {step === 'phone' ? phoneStepSub : otpStepSub}
        </p>

        {step === 'otp' && (
          <div style={S.successBox} data-testid="sms-sent-banner">{sentMsg}</div>
        )}

        {error && <div style={S.errorBox} role="alert">{error}</div>}

        {step === 'phone' && (
          <form onSubmit={handleSendCode} style={S.form} noValidate>
            <div>
              <label style={S.label} htmlFor="sms-phone">{phoneLbl}</label>
              <input
                id="sms-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={resolve(t, 'auth.smsReset.phonePlaceholder',
                  'Phone number, e.g. +233 24 123 4567')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={S.input}
                disabled={loading}
                aria-describedby="sms-phone-hint"
                data-testid="sms-phone"
              />
              {/* Persistent hint — stays visible once the user starts
                  typing, so the "must start with +" rule isn't lost
                  the moment the placeholder disappears. */}
              <p id="sms-phone-hint" style={S.hint}>
                {resolve(t, 'auth.smsReset.phoneHint',
                  'Include your country code, starting with +.')}
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ ...S.button, ...(loading ? S.buttonDisabled : {}) }}
              data-testid="sms-send"
            >
              {loading ? sendingLbl : sendLbl}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerify} style={S.form} noValidate>
            <div>
              <label style={S.label} htmlFor="sms-code">{codeLbl}</label>
              <input
                id="sms-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                style={S.input}
                disabled={loading}
                data-testid="sms-code"
              />
            </div>

            <div>
              <label style={S.label} htmlFor="sms-new">{newPwdLbl}</label>
              <PasswordInput
                id="sms-new"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={S.input}
                disabled={loading}
                data-testid="sms-new-password"
                testIdPrefix="sms-new-password"
              />
            </div>

            <div>
              <label style={S.label} htmlFor="sms-confirm">{confirmLbl}</label>
              <PasswordInput
                id="sms-confirm"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={S.input}
                disabled={loading}
                data-testid="sms-confirm"
                testIdPrefix="sms-confirm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ ...S.button, ...(loading ? S.buttonDisabled : {}) }}
              data-testid="sms-verify"
            >
              {loading ? verifyingLbl : verifyLbl}
            </button>

            <div style={S.linkRow}>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || loading}
                style={{
                  ...S.secondaryBtn,
                  ...(cooldown > 0 || loading ? S.secondaryBtnDisabled : {}),
                }}
                data-testid="sms-resend"
              >
                {resendButton}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep('phone'); setCode(''); setPassword(''); setConfirm('');
                  setError(''); setCooldown(0);
                  if (tickRef.current) clearInterval(tickRef.current);
                }}
                style={S.linkBtn}
                data-testid="sms-change-phone"
              >
                {changeLbl}
              </button>
            </div>
          </form>
        )}

        <div style={S.footerRow}>
          <Link to="/login" style={S.link}>{backLbl}</Link>
          <Link to="/forgot-password" style={S.link}>{preferEmailLbl}</Link>
        </div>
      </div>
    </div>
  );
}

const S = {
  page:       { minHeight: '100vh', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card:       { width: '100%', maxWidth: '28rem', borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  title:      { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  subtitle:   { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.25rem' },
  form:       { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label:      { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' },
  hint:       { fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.35rem', marginBottom: 0, lineHeight: 1.4 },
  input:      { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff', outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' },
  errorBox:   { background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  successBox: { background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#86EFAC', fontSize: '0.875rem', marginBottom: '0.5rem' },
  button:     { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%', textDecoration: 'none' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  secondaryBtn: { background: 'transparent', color: '#86EFAC', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', cursor: 'pointer' },
  secondaryBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  linkBtn:    { background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' },
  linkRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  link:       { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  footerRow:  { display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', gap: 8, flexWrap: 'wrap' },
};
