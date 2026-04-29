import { useState, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { formatApiError } from '../api/client.js';
import { STAFF_ROLES } from '../utils/roles.js';
import { consumeReturnTo } from '../core/auth/returnToStorage.js';
import PasswordInput from '../components/PasswordInput.jsx';
import AuthFormMessage from '../components/auth/AuthFormMessage.jsx';
import LoadingButton from '../components/auth/LoadingButton.jsx';
import OTPInput from '../components/auth/OTPInput.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import { tSafe } from '../i18n/tSafe.js';
import BrandLogo from '../components/BrandLogo.jsx';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

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
    // Splash treatment per the v3 brand spec: logo + Farroway
    // wordmark + tagline. Calmer than a bare spinner so a slow
    // /me roundtrip never feels like the app is broken.
    return (
      <div style={S.page}>
        <div style={S.loadingInner}>
          <BrandLogo variant="light" size="lg" />
          <p style={S.splashTagline}>{FARROWAY_BRAND.tagline}</p>
          <div style={S.spinner} />
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
  //
  // Two delivery channels — react-router state (used when an in-app
  // navigation triggers the redirect) and URLSearchParams (used when
  // the api/client.js interceptor hard-navigates after a 401, which
  // can't carry router state). The interceptor sets ?reason=…; this
  // hook reads either source so the banner fires in both paths.
  const [sessionNotice, setSessionNotice] = useState(() => {
    const stateReason = location.state && location.state.reason;
    let queryReason = '';
    try {
      const sp = new URLSearchParams(location.search || '');
      queryReason = sp.get('reason') || '';
    } catch { /* ignore malformed search string */ }
    const reason = stateReason || queryReason;
    if (reason === 'session_expired') {
      return tSafe('auth.sessionExpired', '');
    }
    if (reason === 'signed_out') {
      return tSafe('auth.signedOut', '');
    }
    return '';
  });

  // ─── Password login (step 1) ────────────────────────────
  const validate = () => {
    const e = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      e.email = tSafe('auth.emailRequired', '');
    } else if (!isLikelyEmail(trimmedEmail)) {
      e.email = tSafe('auth.emailInvalid', '');
    }
    if (!password) {
      e.password = tSafe('auth.passwordRequired', '');
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
      // Login error path now handles three shapes defensively
      // (P0 audit fix). Previous code read `.fieldErrors` then
      // fell back to a raw `.message`, which surfaced technical
      // strings like "Failed to fetch" on connectivity blips.
      //
      //   1. Per-field validation errors → render inline. The
      //      lib/api.js fetch wrapper sets `.fieldErrors` on the
      //      thrown Error; this short-circuit predates this fix.
      //   2. Network / connectivity (no .status, no .response,
      //      or interceptor-tagged .isNetworkError) → calm,
      //      localized "no signal" message.
      //   3. Anything else → run through formatApiError so the
      //      user sees the backend's per-field summary or a
      //      user-safe message, never a raw stack/message.
      if (err && err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
      } else if (err && (
        err.isNetworkError
          || (!err.status && !err.response && !err.fieldErrors)
      )) {
        setGeneralError(
          tSafe(
            'auth.networkError',
            'No network connection — check your signal and try again.',
          ),
        );
      } else {
        const fallback = tSafe(
          'auth.loginFailed',
          'Login failed. Please check your credentials.',
        );
        setGeneralError(formatApiError(err, fallback));
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
      setMfaError(tSafe('auth.mfa.enterCode', ''));
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
      setMfaError(err.message || tSafe('auth.mfa.invalidCode', ''));
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
      setErrors({ phone: tSafe('auth.phoneRequired', '') });
      return;
    }
    if (!isLikelyE164(trimmed)) {
      setErrors({ phone: tSafe('auth.phoneInvalid', '') });
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
          tSafe('auth.phone.sendFailed', '')));
        return;
      }
      safeTrackEvent('auth.phone.otp_requested', {});
      // Navigate to the existing VerifyOtp page with the normalised
      // phone in route state so it never has to hit storage.
      navigate('/verify-otp', { state: { phone: trimmed } });
    } catch (err) {
      safeTrackEvent('auth.phone.otp_failed', {});
      setPhoneError(friendlyPhoneError(err,
        tSafe('auth.phone.sendFailed', '')));
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
                {tSafe('auth.mfa.codeLabel', '')}
              </label>
              <OTPInput
                ref={mfaInputRef}
                value={mfaCode}
                onChange={(v) => setMfaCode(v)}
                length={6}
                ariaLabel={tSafe('auth.mfa.codeLabel', '')}
                testId="login-mfa-code"
                disabled={mfaLoading}
                autoFocus
              />
              <p style={S.mfaHint}>
                {tSafe('auth.mfa.backupCodeHint', '')}
              </p>
            </div>

            <LoadingButton
              loading={mfaLoading}
              loadingText={tSafe('auth.verifying', '')}
              testId="login-mfa-submit"
            >
              {tSafe('auth.verify', '')}
            </LoadingButton>
          </form>

          <LoadingButton
            variant="ghost"
            type="button"
            onClick={handleBackToLogin}
            testId="login-mfa-back"
            style={{ marginTop: '1rem' }}
          >
            {tSafe('auth.backToLogin', '')}
          </LoadingButton>
        </div>
      </div>
    );
  }

  // ─── Login form (step 1) ──────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* v3 brand header — logo + Farroway wordmark + tagline.
            Sits above the existing welcome heading so the page
            opens with the brand voice before the auth controls. */}
        <div style={S.brandRow}>
          <BrandLogo variant="light" size="md" />
        </div>
        <p style={S.brandTagline}>{FARROWAY_BRAND.tagline}</p>

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
            {tSafe('auth.method.email', '')}
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
            {tSafe('auth.method.phone', '')}
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
                {tSafe('auth.phone', '')}
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
                {tSafe('auth.phoneHint', '')}
              </p>
              {errors.phone && (
                <span style={S.fieldError} data-testid="login-phone-error-inline">
                  {errors.phone}
                </span>
              )}
            </div>

            <LoadingButton
              loading={phoneLoading}
              loadingText={tSafe('auth.phone.sending', '')}
              testId="login-phone-submit"
            >
              {tSafe('auth.phone.sendCode', '')}
            </LoadingButton>

            <p style={S.footerText}>
              {tSafe('auth.noAccount', '')}{' '}
              <Link to="/register" style={S.link}>
                {tSafe('auth.createOne', '')}
              </Link>
            </p>
          </form>
        ) : (
        <form onSubmit={handleSubmit} style={S.form} noValidate>
          <div>
            <label style={S.label} htmlFor="login-email">
              {tSafe('auth.email', '')}
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
                    tSafe('auth.emailInvalid', '') }));
                }
              }}
              placeholder={tSafe('auth.emailPlaceholder', '')}
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
              placeholder={tSafe('auth.passwordPlaceholder', '')}
              autoComplete="current-password"
              style={S.input}
              testIdPrefix="login-password"
              toggleAriaLabels={{
                show: tSafe('auth.showPassword', ''),
                hide: tSafe('auth.hidePassword', ''),
              }}
            />
            {errors.password && <span style={S.fieldError}>{errors.password}</span>}
          </div>

          <div style={S.forgotRow}>
            <Link to="/forgot-password" style={S.link} data-testid="login-forgot-link">
              {tSafe('auth.forgotPassword', '')}
            </Link>
          </div>

          <LoadingButton
            loading={loading}
            loadingText={tSafe('auth.signingIn', '')}
            testId="login-submit"
          >
            {tSafe('auth.signIn', '')}
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
  loadingInner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' },
  spinner: { width: '2rem', height: '2rem', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite' },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: '#EAF2FF', letterSpacing: '0.02em' },
  splashTagline: {
    margin: 0, color: 'rgba(255,255,255,0.72)',
    fontSize: '0.9375rem', textAlign: 'center', maxWidth: '20rem',
  },
  // v3 login card brand block
  brandRow: {
    display: 'flex', justifyContent: 'flex-start', alignItems: 'center',
    marginBottom: '0.5rem',
  },
  brandTagline: {
    margin: '0 0 1.25rem', color: 'rgba(255,255,255,0.72)',
    fontSize: '0.875rem',
  },
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
