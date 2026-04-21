/**
 * VerifyOtp — 6-digit OTP code entry after phone number submission.
 *
 * Receives phone number via route state from FarmerWelcome.
 * On success, navigates to /dashboard.
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { postAuthDestination } from './FarmerWelcome.jsx';

const CODE_LENGTH = 6;

export default function VerifyOtp() {
  const { verifyPhoneOtp, requestPhoneOtp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const phone = location.state?.phone;

  const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputsRef = useRef([]);
  const submittingRef = useRef(false);

  // If no phone in state, redirect back to welcome
  if (!phone) {
    return <Navigate to="/farmer-welcome" replace />;
  }

  // If already authenticated, go to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Auto-focus first input on mount
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function handleDigitChange(index, value) {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');

    // Auto-advance to next input
    if (digit && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === CODE_LENGTH - 1 && next.every(d => d)) {
      handleVerify(next.join(''));
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    // Focus last filled or next empty
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    inputsRef.current[focusIdx]?.focus();
    // Auto-submit if full
    if (pasted.length === CODE_LENGTH) {
      handleVerify(pasted);
    }
  }

  async function handleVerify(code) {
    if (!code || code.length !== CODE_LENGTH) code = digits.join('');
    if (code.length !== CODE_LENGTH || submittingRef.current) return;

    setError('');
    setLoading(true);
    submittingRef.current = true;

    try {
      await verifyPhoneOtp(phone, code);
      safeTrackEvent('auth.otp.verified', { method: 'phone' });
      navigate(postAuthDestination(), { replace: true });
    } catch (err) {
      // Map server-side codes to safe, user-facing copy. The server
      // returns a structured { ok:false, code, message, retryAfterSec }
      // shape; the request wrapper surfaces `code` on err.code.
      setError(friendlyOtpError(err, t));
      safeTrackEvent('auth.otp.verify_failed', { code: err?.code || 'unknown' });
      // Clear digits on failure so user can re-enter
      setDigits(Array(CODE_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    try {
      // Server echoes the real cooldown in { cooldownSec }. Fall back
      // to 60s only if the field is missing (e.g. old deploy).
      const r = await requestPhoneOtp(phone);
      const echoed = Number(r?.cooldownSec);
      const cooldown = Number.isFinite(echoed) && echoed > 0 ? echoed : 60;
      setResent(true);
      setResendCooldown(cooldown);
      setError('');
      safeTrackEvent('auth.otp.resent', { method: 'phone' });
      setTimeout(() => setResent(false), 3000);
    } catch (err) {
      // On server-enforced cooldown / rate-limit, honour the
      // retryAfterSec so the countdown matches reality.
      const retry = Number(err?.retryAfterSec);
      if (Number.isFinite(retry) && retry > 0) setResendCooldown(retry);
      setError(friendlyOtpError(err, t));
    }
  }

  function friendlyOtpError(err, tFn) {
    const code = err?.code || '';
    if (code === 'invalid_code')        return tFn('auth.otp.invalid')       || 'That code did not match. Please try again.';
    if (code === 'expired_or_invalid')  return tFn('auth.otp.expired')       || 'That code has expired. Tap resend for a new one.';
    if (code === 'max_attempts')        return tFn('auth.otp.maxAttempts')   || 'Too many attempts. Please wait a minute and try again.';
    if (code === 'rate_limited')        return tFn('auth.otp.rateLimited')   || 'Too many requests. Please wait and try again.';
    if (code === 'cooldown')            return tFn('auth.otp.cooldown')      || 'Please wait before requesting another code.';
    if (code === 'provider_error')      return tFn('auth.otp.providerError') || 'Verification service is unavailable. Try email recovery instead.';
    // Fall back to the server-provided message if it looks safe, else generic.
    const msg = err?.message || '';
    if (msg && msg.length < 160 && !/stack|error:/i.test(msg)) return msg;
    return tFn('auth.invalidCode') || 'Could not verify the code. Please try again.';
  }

  const code = digits.join('');
  const canSubmit = code.length === CODE_LENGTH && !loading;

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate('/farmer-welcome')}
          style={S.backBtn}
        >
          {'\u2190'} {t('common.back')}
        </button>

        {/* Header */}
        <div style={S.iconWrap}>
          <span style={S.icon}>{'\uD83D\uDD10'}</span>
        </div>
        <h1 style={S.title}>{t('auth.enterCode')}</h1>
        <p style={S.subtitle}>
          {t('auth.codeSentTo')} <strong style={S.phoneBold}>{phone}</strong>
        </p>

        {error && <div style={S.errorBox}>{error}</div>}
        {resent && <div style={S.successBox}>{t('auth.codeResent')}</div>}

        {/* 6-digit inputs */}
        <div style={S.digitRow} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => inputsRef.current[i] = el}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              onChange={e => handleDigitChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              style={{
                ...S.digitInput,
                ...(d ? S.digitFilled : {}),
              }}
            />
          ))}
        </div>

        {/* Verify button */}
        <button
          type="button"
          onClick={() => handleVerify()}
          disabled={!canSubmit}
          style={{
            ...S.verifyBtn,
            ...(!canSubmit ? S.btnDisabled : {}),
          }}
        >
          {loading ? t('auth.verifying') : t('auth.verifyCode')}
        </button>

        {/* Resend */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0}
          style={{
            ...S.resendBtn,
            ...(resendCooldown > 0 ? S.resendDisabled : {}),
          }}
        >
          {resendCooldown > 0
            ? `${t('auth.resendCode')} (${resendCooldown}s)`
            : t('auth.resendCode')
          }
        </button>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '2rem 1.75rem',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
  },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    background: 'none',
    border: 'none',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.25rem 0',
    marginBottom: '1.25rem',
    WebkitTapHighlightColor: 'transparent',
  },
  iconWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  icon: { fontSize: '2.5rem' },
  title: {
    fontSize: '1.375rem',
    fontWeight: 700,
    margin: 0,
    color: '#EAF2FF',
    textAlign: 'center',
  },
  subtitle: {
    color: '#9FB3C8',
    fontSize: '0.875rem',
    textAlign: 'center',
    marginTop: '0.375rem',
    marginBottom: '1.5rem',
    lineHeight: 1.5,
  },
  phoneBold: {
    color: '#EAF2FF',
    fontWeight: 700,
  },
  errorBox: {
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.14)',
    borderRadius: '14px',
    padding: '0.75rem 1rem',
    color: '#FCA5A5',
    fontSize: '0.875rem',
    marginBottom: '0.75rem',
    textAlign: 'center',
  },
  successBox: {
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.14)',
    borderRadius: '14px',
    padding: '0.75rem 1rem',
    color: '#86EFAC',
    fontSize: '0.875rem',
    marginBottom: '0.75rem',
    textAlign: 'center',
  },
  digitRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  digitInput: {
    width: '3rem',
    height: '3.5rem',
    textAlign: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#EAF2FF',
    background: 'rgba(255,255,255,0.04)',
    border: '2px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    outline: 'none',
    caretColor: '#22C55E',
    letterSpacing: '0.05em',
    boxSizing: 'border-box',
  },
  digitFilled: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.06)',
  },
  verifyBtn: {
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    padding: '0.875rem 1rem',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    width: '100%',
    minHeight: '52px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  resendBtn: {
    width: '100%',
    padding: '0.625rem 1rem',
    borderRadius: '14px',
    border: 'none',
    background: 'transparent',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.75rem',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  resendDisabled: {
    color: '#6F8299',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
};
