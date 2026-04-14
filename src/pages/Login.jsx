import { useState, useRef } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { STAFF_ROLES } from '../utils/roles.js';

// ─── Remembered email ──────────────────────────────────────
function getRememberedEmail() {
  try { return localStorage.getItem('farroway:last_email') || ''; } catch { return ''; }
}

export default function Login() {
  const { login, completeMfaChallenge, isAuthenticated, authLoading } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();
  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState('');
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
  const redirectTo = location.state?.from || defaultRedirect;

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

  // ─── Password login (step 1) ────────────────────────────
  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = t('auth.emailRequired');
    if (!password) e.password = t('auth.passwordRequired');
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
      setMfaError('Enter your 6-digit code');
      return;
    }
    setMfaError('');
    setMfaLoading(true);
    try {
      await completeMfaChallenge(mfaToken, trimmed);
      safeTrackEvent('auth.mfa.verified', {});
    } catch (err) {
      setMfaError(err.message || 'Invalid code. Try again.');
      setMfaCode('');
      safeTrackEvent('auth.mfa.failed', {});
      setTimeout(() => mfaInputRef.current?.focus(), 50);
    } finally {
      setMfaLoading(false);
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

          {mfaError && <div style={S.errorBox}>{mfaError}</div>}

          <form onSubmit={handleMfaSubmit} style={S.form}>
            <div>
              <label style={S.label}>Verification Code</label>
              <input
                ref={mfaInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ''))}
                placeholder="000000"
                style={{ ...S.input, ...S.mfaInput }}
              />
              <p style={S.mfaHint}>
                You can also use a 10-character backup code.
              </p>
            </div>

            <button
              type="submit"
              disabled={mfaLoading}
              style={{ ...S.button, ...(mfaLoading ? S.buttonDisabled : {}) }}
            >
              {mfaLoading ? 'Verifying...' : 'Verify'}
            </button>
          </form>

          <button onClick={handleBackToLogin} style={S.backBtn}>
            Back to login
          </button>
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

        {generalError && <div style={S.errorBox}>{generalError}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <div>
            <label style={S.label}>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={S.input}
            />
            {errors.email && <span style={S.fieldError}>{errors.email}</span>}
          </div>

          <div>
            <label style={S.label}>{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={S.input}
            />
            {errors.password && <span style={S.fieldError}>{errors.password}</span>}
          </div>

          <div style={S.forgotRow}>
            <Link to="/forgot-password" style={S.link}>{t('auth.forgotPassword')}</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...S.button, ...(loading ? S.buttonDisabled : {}) }}
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <p style={S.footerText}>
          {t('auth.noAccount')}{' '}
          <Link to="/register" style={S.link}>{t('auth.createOne')}</Link>
        </p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  loadingInner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  spinner: { width: '2rem', height: '2rem', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite' },
  brand: { fontSize: '1.25rem', fontWeight: 700, color: '#22C55E', letterSpacing: '0.02em' },
  card: { width: '100%', maxWidth: '28rem', borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' },
  input: { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff', outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' },
  fieldError: { color: '#FCA5A5', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' },
  errorBox: { background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  forgotRow: { textAlign: 'right' },
  link: { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  button: { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
  // MFA-specific styles
  mfaIconRow: { textAlign: 'center', marginBottom: '0.5rem' },
  mfaIcon: { fontSize: '2.5rem' },
  mfaInput: { fontSize: '1.5rem', letterSpacing: '0.3em', textAlign: 'center', fontFamily: 'monospace' },
  mfaHint: { color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', marginTop: '0.5rem' },
  backBtn: { marginTop: '1rem', width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', padding: '0.6rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', cursor: 'pointer' },
};
