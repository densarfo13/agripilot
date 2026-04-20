/**
 * FarmerWelcome — farmer-first entry screen.
 *
 * Three options:
 *   1. Continue with phone (primary — OTP)
 *   2. Continue with Google (secondary — existing SSO)
 *   3. Continue offline (tertiary — no auth)
 *
 * Simple, mobile-first, one screen.
 * If already authenticated, redirects straight to Home.
 */
import { useState, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { safeTrackEvent } from '../lib/analytics.js';
import { getDialCode } from '../utils/countries.js';
import { normalizePhone } from '../components/PhoneInput.jsx';

// ── Entry-intent helpers ─────────────────────────────────
// Intent flows from FarmerEntry: 'new' (Start a new crop) or 'continue' (Continue my farm).
// Persisted to sessionStorage so OTP verify / SSO redirect keeps the hint.
const INTENT_KEY = 'farroway:entry_intent';
function persistIntent(intent) {
  try {
    if (intent) sessionStorage.setItem(INTENT_KEY, intent);
    else sessionStorage.removeItem(INTENT_KEY);
  } catch { /* ignore */ }
}
function readIntent() {
  try { return sessionStorage.getItem(INTENT_KEY) || ''; } catch { return ''; }
}
export function postAuthDestination() {
  const intent = readIntent();
  persistIntent(null);
  if (intent === 'new') {
    // New farmer flow goes through the reassurance screen first,
    // unless the farmer has already seen it this session (resume case).
    try {
      const seen = sessionStorage.getItem('farroway:reassurance_seen') === '1';
      // Fast onboarding is the new-farmer flow. Reassurance screen
      // still shows once per session and then forwards to /onboarding/fast.
      return seen ? '/onboarding/fast' : '/beginner-reassurance';
    } catch { return '/beginner-reassurance'; }
  }
  return '/dashboard';
}

// SSO popup helper (reused from existing V1 login)
const SSO_PROVIDERS_URL = '/api/auth/providers';
const SSO_BASE_URL = '/api/auth';

export default function FarmerWelcome() {
  const { isAuthenticated, authLoading, requestPhoneOtp, continueOffline } = useAuth();
  const { isOnline } = useNetwork();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  // Capture intent from FarmerEntry if present
  const incomingIntent = location.state?.intent;
  if (incomingIntent) persistIntent(incomingIntent);

  const [phone, setPhone] = useState('');
  const [countryCode] = useState(() => {
    try { return localStorage.getItem('farroway:country') || 'GH'; } catch { return 'GH'; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ssoAvailable, setSsoAvailable] = useState(null);
  const submittingRef = useRef(false);

  const dialCode = getDialCode(countryCode);

  // If already authenticated, go straight to Home
  if (authLoading) {
    return (
      <div style={S.page}>
        <div style={S.loadingWrap}>
          <div style={S.spinner} />
          <span style={S.brand}>Farroway</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={postAuthDestination()} replace />;
  }

  // ─── Phone submit → request OTP ─────────────────────────
  async function handlePhoneSubmit(e) {
    e.preventDefault();
    if (submittingRef.current || !phone.trim()) return;
    setError('');
    setLoading(true);
    submittingRef.current = true;

    const normalized = normalizePhone(phone.trim(), dialCode);
    try {
      await requestPhoneOtp(normalized);
      safeTrackEvent('auth.otp.requested', { method: 'phone' });
      // Navigate to OTP screen, pass phone
      navigate('/verify-otp', { state: { phone: normalized } });
    } catch (err) {
      setError(err.message || t('auth.otpRequestFailed'));
      safeTrackEvent('auth.otp.request_failed', {});
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  // ─── Google SSO ─────────────────────────────────────────
  function handleGoogleLogin() {
    safeTrackEvent('auth.sso.started', { provider: 'google' });
    const w = 500; const h = 600;
    const left = (screen.width - w) / 2;
    const top = (screen.height - h) / 2;
    const popup = window.open(
      `${SSO_BASE_URL}/google`,
      'farroway_sso',
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Listen for postMessage from popup
    function onMessage(event) {
      if (event.data?.type !== 'farroway-auth') return;
      window.removeEventListener('message', onMessage);
      if (event.data.user) {
        // SSO success — bootstrap will pick up the cookie session
        safeTrackEvent('auth.sso.success', { provider: 'google' });
        window.location.href = postAuthDestination();
      } else if (event.data.error) {
        setError(event.data.error);
      }
    }
    window.addEventListener('message', onMessage);

    // Detect popup close
    const check = setInterval(() => {
      if (popup?.closed) {
        clearInterval(check);
        window.removeEventListener('message', onMessage);
      }
    }, 500);
  }

  // ─── Continue offline ───────────────────────────────────
  function handleOffline() {
    safeTrackEvent('auth.offline.started', {});
    continueOffline();
    navigate(postAuthDestination(), { replace: true });
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Brand + greeting */}
        <div style={S.brandRow}>
          <span style={S.brandIcon}>{'\uD83C\uDF3E'}</span>
          <span style={S.brandName}>Farroway</span>
        </div>
        <h1 style={S.title}>{t('auth.welcomeFarmer')}</h1>
        <p style={S.subtitle}>{t('auth.welcomeSubtitle')}</p>

        {error && <div style={S.errorBox}>{error}</div>}

        {/* ═══ 1. PHONE + OTP (primary) ═══ */}
        <form onSubmit={handlePhoneSubmit} style={S.form}>
          <label style={S.label}>{t('auth.phoneLabel')}</label>
          <div style={S.phoneRow}>
            {dialCode && <span style={S.dialBadge}>{dialCode}</span>}
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('auth.phonePlaceholder')}
              style={S.phoneInput}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !phone.trim()}
            style={{
              ...S.primaryBtn,
              ...((loading || !phone.trim()) ? S.btnDisabled : {}),
            }}
          >
            {loading ? t('auth.sendingCode') : t('auth.continueWithPhone')}
          </button>
        </form>

        {/* Divider */}
        <div style={S.divider}>
          <span style={S.dividerLine} />
          <span style={S.dividerText}>{t('auth.or')}</span>
          <span style={S.dividerLine} />
        </div>

        {/* ═══ 2. GOOGLE (secondary) ═══ */}
        {isOnline && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            style={S.socialBtn}
          >
            <span style={S.googleIcon}>G</span>
            {t('auth.continueWithGoogle')}
          </button>
        )}

        {/* ═══ 3. OFFLINE (tertiary) ═══ */}
        <button
          type="button"
          onClick={handleOffline}
          style={S.offlineBtn}
        >
          {t('auth.continueOffline')}
        </button>

        {/* Existing account link */}
        <p style={S.footerText}>
          {t('auth.haveAccount')}{' '}
          <a href="/login" style={S.link}>{t('auth.signInEmail')}</a>
        </p>
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
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  brand: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
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
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    marginBottom: '1.25rem',
  },
  brandIcon: { fontSize: '2rem' },
  brandName: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#22C55E',
    letterSpacing: '0.01em',
  },
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  label: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    fontWeight: 600,
  },
  phoneRow: {
    display: 'flex',
    gap: '0.375rem',
    alignItems: 'stretch',
  },
  dialBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 0.75rem',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    fontSize: '0.875rem',
    color: '#EAF2FF',
    fontWeight: 600,
    flexShrink: 0,
  },
  phoneInput: {
    flex: 1,
    minWidth: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '0.875rem 1rem',
    color: '#EAF2FF',
    fontSize: '1.0625rem',
    fontWeight: 600,
    outline: 'none',
    boxSizing: 'border-box',
    letterSpacing: '0.02em',
  },
  primaryBtn: {
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
    marginTop: '0.375rem',
    WebkitTapHighlightColor: 'transparent',
  },
  btnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    margin: '1.25rem 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
  },
  dividerText: {
    fontSize: '0.75rem',
    color: '#6F8299',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  socialBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
  googleIcon: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#4285F4',
  },
  offlineBtn: {
    width: '100%',
    padding: '0.625rem 1rem',
    borderRadius: '14px',
    border: '1px dashed rgba(255,255,255,0.08)',
    background: 'transparent',
    color: '#6F8299',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.75rem',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  footerText: {
    textAlign: 'center',
    color: '#6F8299',
    fontSize: '0.8125rem',
    marginTop: '1.25rem',
  },
  link: {
    color: '#9FB3C8',
    textDecoration: 'none',
  },
};
