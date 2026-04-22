import { useState, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { STAFF_ROLES } from '../utils/roles.js';
import { consumeReturnTo } from '../core/auth/returnToStorage.js';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthFormMessage from '../components/auth/AuthFormMessage.jsx';
import LoadingButton from '../components/auth/LoadingButton.jsx';
import OTPInput from '../components/auth/OTPInput.jsx';
import PhoneInput from '../components/PhoneInput.jsx';

// Lightweight, user-safe email shape check. The server still
// validates strictly — this just catches obvious typos before submit.
function isLikelyEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

// E.164 check — "+" then 7–15 digits. We don't try to be clever
// about national format here; PhoneInput onBlur normalises the
// country-dialing prefix so most users end up with a clean +…
// string on submit.
function isLikelyE164(s) {
  const cleaned = String(s || '').replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{6,14}$/.test(cleaned);
}

// Map any phone-auth error surface to a short, user-safe line. We
// never expose Twilio / provider strings directly.
function friendlyPhoneError(err, fallback) {
  if (!err) return fallback;
  const code = err.code || err.response?.data?.code;
  switch (code) {
    case 'rate_limited':
    case 'too_many_requests':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'invalid_phone':
    case 'recipient_invalid':
      return 'That phone number does not look right. Check the format and try again.';
    case 'provider_error':
    case 'unconfigured':
      return 'We could not send a code right now. Try again in a moment.';
    default:
      return err.message || fallback;
  }
}

// ─── Remembered email ──────────────────────────────────────
function getRememberedEmail() {
  try { return localStorage.getItem('farroway:last_email') || ''; } catch { return ''; }
}

export default function Login() {
  const {
    login, completeMfaChallenge, requestPhoneOtp,
    isAuthenticated, authLoading,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // ─── Method toggle — "email" | "phone" ───────────────────────
  const [method, setMethod] = useState('email');

  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState('');

  // ─── Phone login state ───────────────────────────────────────
  const [phone, setPhone]           = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError,   setPhoneError]   = useState('');
  const phoneSubmittingRef = useRef(false);

  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  // ─── MFA challenge state ──────────────────────────────────
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const mfaInputRef = useRef(null);

  const { user } = useAuth();
  const defaultRedirect = (user && STAFF_ROLES.includes(user.role)) ? '/' : '/dashboard';
  // Capture the persisted returnTo ONCE on mount. Consuming on
  // every render would clear it before we navigate.
  const returnToRef = useRef(null);
  if (returnToRef.current === null) {
    returnToRef.current = consumeReturnTo() || '';
  }
  const persistedReturnTo = returnToRef.current || null;
  const redirectTo = location.state?.from || persistedReturnTo || defaultRedirect;

  // ─── Gate 1: Auth still loading ───
  if (authLoading) {
    return (
      <div style={S.page}>
        <div style={S.loadingInner}>
          <div style={S.spinner} />
          <span style={S.brand}>Farroway</span>
        </div>
      </div>
    );
  }

  // ─── Gate 2: Already authenticated ───
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Surface a session-expired info banner when the protected route
  // sent the user back to /login with a `reason`. Cleared as soon as
  // the user starts typing.
  const [sessionNotice, setSessionNotice] = useState(() => {
    const reason = location.state && location.state.reason;
    if (reason === 'session_expired') {
      return t('auth.sessionExpired')
        || 'Your session expired. Please sign in again.';
    }
    if (reason === 'signed_out') {
      return t('auth.signedOut')
        || 'You\u2019ve been signed out. Sign in to continue.';
    }
    return '';
  });

  // ─── Password login (step 1) ────────────────────────────
  const validate = () => {
    const e = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      e.email = t('auth.emailRequired') || 'Email is required.';
    } else if (!isLikelyEmail(trimmedEmail)) {
      e.email = t('auth.emailInvalid') || 'Enter a valid email address.';
    }
    if (!password) {
      e.password = t('auth.passwordRequired') || 'Password is required.';
    }
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setGeneralError('');
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    submittingRef.current = true;
    try {
      const data = await login(email, password);

      // MFA challenge required — show step 2
      if (data.mfaChallengeRequired) {
        setMfaToken(data.mfaToken);
        setMfaStep(true);
        setMfaCode('');
        setMfaError('');
        safeTrackEvent('auth.mfa.challenge_shown', {});
        setTimeout(() => mfaInputRef.current?.focus(), 100);
        return;
      }

      safeTrackEvent('auth.login.success', {});
    } catch (err) {
      safeTrackEvent('auth.login.failed', {});
      if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(err.message || t('auth.loginFailed'));
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // ─── MFA verify (step 2) ────────────────────────────────
  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    const trimmed = mfaCode.trim();
    if (!trimmed) {
      setMfaError(t('auth.mfa.enterCode') || 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    setMfaError('');
    setMfaLoading(true);
    try {
      await completeMfaChallenge(mfaToken, trimmed);
      safeTrackEvent('auth.mfa.verified', {});
    } catch (err) {
      // Server error messages here are already user-safe ("Code is
      // invalid or expired"). We surface them as-is, with a calm
      // fallback if the message is missing.
      setMfaError(err.message || t('auth.mfa.invalidCode') || 'That code did not match. Try again with a fresh 6-digit code from your app.');
      setMfaCode('');
      safeTrackEvent('auth.mfa.failed', {});
      setTimeout(() => mfaInputRef.current?.focus(), 50);
    } finally {
      setMfaLoading(false);
    }
  };

  // ─── Phone login — send OTP ───────────────────────────────────
  // Anti-enumeration contract: the server always returns ok:true /
  // a normalized "sent" response for well-formed phone numbers,
  // whether or not an account exists. We navigate to the OTP screen
  // unconditionally on a clean request so there's no signal here
  // about whether the number is registered.
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (phoneSubmittingRef.current) return;
    setPhoneError('');
    const trimmed = String(phone || '').trim();
    if (!trimmed) {
      setErrors({ phone: t('auth.phoneRequired') || 'Phone number is required.' });
      return;
    }
    if (!isLikelyE164(trimmed)) {
      setErrors({ phone: t('auth.phoneInvalid')
        || 'Enter a full phone number including country code, e.g. +254712345678.' });
      return;
    }
    setErrors({});
    setPhoneLoading(true);
    phoneSubmittingRef.current = true;
    try {
      const r = await requestPhoneOtp(trimmed);
      // requestPhoneOtp returns the server payload — ok:true when
      // the code is queued. Provider / rate-limit errors throw.
      if (r && r.ok === false) {
        setPhoneError(friendlyPhoneError({ code: r.code, message: r.message },
          t('auth.phone.sendFailed') || 'We could not send a code right now. Try again in a moment.'));
        return;
      }
      safeTrackEvent('auth.phone.otp_requested', {});
      // Navigate to the existing VerifyOtp page with the normalised
      // phone in route state so it never has to hit storage.
      navigate('/verify-otp', { state: { phone: trimmed } });
    } catch (err) {
      safeTrackEvent('auth.phone.otp_failed', {});
      setPhoneError(friendlyPhoneError(err,
        t('auth.phone.sendFailed') || 'We could not send a code right now. Try again in a moment.'));
    } finally {
      setPhoneLoading(false);
      phoneSubmittingRef.current = false;
    }
  };

  const handleBackToLogin = () => {
    setMfaStep(false);
    setMfaToken('');
    setMfaCode('');
    setMfaError('');
    setPassword('');
    setGeneralError('');
  };

  // ─── MFA step UI ─────────────────────────────────────────
  if (mfaStep) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <div style={S.mfaIconRow}>
            <span style={S.mfaIcon}>🔐</span>
          </div>
          <h1 style={S.title}>Two-Factor Authentication</h1>
          <p style={S.subtitle}>
            Enter the 6-digit code from your authenticator app.
          </p>

          <AuthFormMessage tone="error" message={mfaError} testId="login-mfa-error" />

          <form onSubmit={handleMfaSubmit} style={S.form}>
            <div>
              <label style={S.label}>
                {t('auth.mfa.codeLabel') || 'Verification code'}
              </label>
              <OTPInput
                ref={mfaInputRef}
                value={mfaCode}
                onChange={(v) => setMfaCode(v)}
                length={6}
                ariaLabel={t('auth.mfa.codeLabel') || 'Verification code'}
                testId="login-mfa-code"
                disabled={mfaLoading}
                autoFocus
              />
              <p style={S.mfaHint}>
                {t('auth.mfa.backupCodeHint')
                  || 'You can also use a 10-character backup code.'}
              </p>
            </div>

            <LoadingButton
              loading={mfaLoading}
              loadingText={t('auth.verifying') || 'Verifying\u2026'}
              testId="login-mfa-submit"
            >
              {t('auth.verify') || 'Verify'}
            </LoadingButton>
          </form>

          <LoadingButton
            variant="ghost"
            type="button"
            onClick={handleBackToLogin}
            testId="login-mfa-back"
            style={{ marginTop: '1rem' }}
          >
            {t('auth.backToLogin') || 'Back to login'}
          </LoadingButton>
        </div>
      </div>
    );
  }

  // ─── Login form (step 1) ──────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>{t('auth.welcomeBack')}</h1>
        <p style={S.subtitle}>{t('auth.signInPrompt')}</p>

        <AuthFormMessage tone="info" message={sessionNotice} testId="login-session-notice" />
        {/* Email / Phone method toggle */}
        <div style={S.methodRow} role="tablist" aria-label="Sign-in method">
          <button
            type="button"
            role="tab"
            aria-selected={method === 'email'}
            onClick={() => {
              if (method === 'email') return;
              setMethod('email');
              setErrors({});
              setGeneralError('');
              setPhoneError('');
            }}
            style={{ ...S.methodBtn, ...(method === 'email' ? S.methodBtnActive : {}) }}
            data-testid="login-method-email"
          >
            {t('auth.method.email') || 'Email'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={method === 'phone'}
            onClick={() => {
              if (method === 'phone') return;
              setMethod('phone');
              setErrors({});
              setGeneralError('');
              setPhoneError('');
            }}
            style={{ ...S.methodBtn, ...(method === 'phone' ? S.methodBtnActive : {}) }}
            data-testid="login-method-phone"
          >
            {t('auth.method.phone') || 'Phone'}
          </button>
        </div>

        <AuthFormMessage
          tone="error"
          message={method === 'email' ? generalError : phoneError}
          testId={method === 'email' ? 'login-error' : 'login-phone-error'}
        />

        {method === 'phone' ? (
          // ─── Phone login form ─────────────────────────────
          <form onSubmit={handlePhoneSubmit} style={S.form} noValidate>
            <div>
              <label style={S.label} htmlFor="login-phone">
                {t('auth.phone') || 'Phone number'}
              </label>
              <PhoneInput
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((s) => ({ ...s, phone: undefined }));
                }}
                style={S.input}
                required
                disabled={phoneLoading}
                data-testid="login-phone"
              />
              <p style={S.mfaHint}>
                {t('auth.phoneHint')
                  || 'Include your country code, e.g. +254712345678.'}
              </p>
              {errors.phone && (
                <span style={S.fieldError} data-testid="login-phone-error-inline">
                  {errors.phone}
                </span>
              )}
            </div>

            <LoadingButton
              loading={phoneLoading}
              loadingText={t('auth.phone.sending') || 'Sending code\u2026'}
              testId="login-phone-submit"
            >
              {t('auth.phone.sendCode') || 'Send code'}
            </LoadingButton>

            <p style={S.footerText}>
              {t('auth.noAccount') || 'New to Farroway?'}{' '}
              <Link to="/register" style={S.link}>
                {t('auth.createOne') || 'Create account'}
              </Link>
            </p>
          </form>
        ) : (
        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <div>
            <label style={S.label} htmlFor="login-email">
              {t('auth.email') || 'Email address'}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (sessionNotice) setSessionNotice('');
                if (errors.email) setErrors((s) => ({ ...s, email: undefined }));
              }}
              onBlur={() => {
                // Show an invalid-format hint once the user leaves
                // the field — don't interrupt while they're typing.
                const trimmed = email.trim();
                if (trimmed && !isLikelyEmail(trimmed)) {
                  setErrors((s) => ({ ...s, email:
                    t('auth.emailInvalid') || 'Enter a valid email address.' }));
                }
              }}
              placeholder={t('auth.emailPlaceholder') || 'Email address'}
              autoComplete="email"
              inputMode="email"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'login-email-err' : undefined}
              style={S.input}
              data-testid="login-email"
            />
            {errors.email && (
              <span id="login-email-err" style={S.fieldError} data-testid="login-email-error">
                {errors.email}
              </span>
            )}
          </div>

          <div>
            <label style={S.label}>{t('auth.password')}</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder') || 'Password'}
              autoComplete="current-password"
              style={S.input}
              testIdPrefix="login-password"
              toggleAriaLabels={{
                show: t('auth.showPassword') || 'Show password',
                hide: t('auth.hidePassword') || 'Hide password',
              }}
            />
            {errors.password && <span style={S.fieldError}>{errors.password}</span>}
          </div>

          <div style={S.forgotRow}>
            <Link to="/forgot-password" style={S.link} data-testid="login-forgot-link">
              {t('auth.forgotPassword') || 'Forgot your password?'}
            </Link>
          </div>

          <LoadingButton
            loading={loading}
            loadingText={t('auth.signingIn') || 'Signing in\u2026'}
            testId="login-submit"
          >
            {t('auth.signIn') || 'Sign in'}
          </LoadingButton>
        </form>
        )}

        {method === 'email' && (
          <p style={S.footerText}>
            {t('auth.noAccount')}{' '}
            <Link to="/register" style={S.link}>{t('auth.createOne')}</Link>
          </p>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', color: '#EAF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  loadingInner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  spinner: { width: '2rem', height: '2rem', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite' },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: '#EAF2FF', letterSpacing: '0.02em' },
  card: { width: '100%', maxWidth: '28rem', borderRadius: '22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '2.25rem', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#EAF2FF' },
  subtitle: { color: '#9FB3C8', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block', color: '#9FB3C8' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#EAF2FF', outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  fieldError: { color: '#FCA5A5', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' },
  errorBox: { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)', borderRadius: '14px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  forgotRow: { textAlign: 'right' },
  link: { color: '#9FB3C8', textDecoration: 'none', fontSize: '0.875rem' },
  button: { background: '#22C55E', color: '#fff', border: 'none', borderRadius: '14px', padding: '0.875rem 1rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', width: '100%', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: '#6F8299', fontSize: '0.875rem', marginTop: '1.5rem' },
  // Email / Phone method toggle
  methodRow: {
    display: 'flex', gap: '0.5rem', marginBottom: '1rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px', padding: '0.25rem',
  },
  methodBtn: {
    flex: 1, padding: '0.5rem 0.75rem',
    border: 'none', borderRadius: '10px',
    background: 'transparent', color: '#9FB3C8',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    minHeight: '2.5rem',
    transition: 'background-color 120ms ease, color 120ms ease',
  },
  methodBtnActive: {
    background: 'rgba(34,197,94,0.15)',
    color: '#86EFAC',
  },
  // MFA-specific styles
  mfaIconRow: { textAlign: 'center', marginBottom: '0.5rem' },
  mfaIcon: { fontSize: '2.5rem' },
  mfaInput: { fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'monospace' },
  mfaHint: { color: '#6F8299', fontSize: '0.75rem', marginTop: '0.5rem' },
  backBtn: { marginTop: '1rem', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '0.6rem', color: '#9FB3C8', fontSize: '0.875rem', cursor: 'pointer' },
};
