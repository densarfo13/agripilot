import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, microsoft: false, oidc: false });
  const [federatedLoading, setFederatedLoading] = useState(null);

  // MFA challenge state
  const [mfaStep, setMfaStep] = useState(null); // null | 'challenge' | 'setup_required'
  const [mfaToken, setMfaToken] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    api.get('/auth/providers')
      .then(({ data }) => setProviders(data))
      .catch(() => {});
  }, []);

  // Handle postMessage from federated auth popup
  const handleAuthMessage = useCallback((event) => {
    let data;
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    if (!data || data.type !== 'agripilot-auth') return;
    setFederatedLoading(null);

    if (data.error) { setError(data.error); return; }

    // Full login
    if (data.user && data.accessToken) {
      setAuth(data.user, data.accessToken);
      navigate('/');
      return;
    }
    // MFA required from SSO
    if (data.mfaChallengeRequired && data.mfaToken) {
      setMfaToken(data.mfaToken);
      setMfaStep('challenge');
      return;
    }
    if (data.mfaSetupRequired && data.mfaToken) {
      setAuth(data.user, data.mfaToken);
      navigate('/account');
    }
  }, [setAuth, navigate]);

  useEffect(() => {
    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [handleAuthMessage]);

  // Local login
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      if (data.mfaChallengeRequired) {
        setMfaToken(data.mfaToken);
        setMfaStep('challenge');
        return;
      }
      if (data.mfaSetupRequired) {
        // Log the user in with the temporary mfaToken so they can reach Account > Security
        // to enroll MFA. The token is valid but lacks mfaVerifiedAt, so protected admin
        // routes will still block until MFA is fully enrolled and verified.
        setAuth(data.user, data.mfaToken);
        navigate('/account');
        return;
      }
      setAuth(data.user, data.accessToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Submit MFA challenge code
  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMfaLoading(true);
    try {
      const { data } = await api.post('/auth/mfa/verify', { mfaToken, code: mfaCode });
      setAuth(data.user, data.accessToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  // Open SSO popup
  const openFederatedLogin = (provider) => {
    setError('');
    setFederatedLoading(provider);
    const width = 500, height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      `/api/auth/${provider}`,
      `agripilot-${provider}-login`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );
    const interval = setInterval(() => {
      if (!popup || popup.closed) { clearInterval(interval); setFederatedLoading(null); }
    }, 500);
  };

  const hasFederated = providers.google || providers.microsoft || providers.oidc;

  // ── MFA Setup Required screen ──
  if (mfaStep === 'setup_required') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>MFA Required</h1>
          <p style={{ ...styles.subtitle, marginBottom: '1.5rem' }}>
            Your role requires multi-factor authentication. Please set up MFA from your account settings after signing in, or contact your administrator.
          </p>
          <p style={{ fontSize: '0.8rem', color: '#71717A', textAlign: 'center' }}>
            A temporary session has been issued. Go to <strong>Account &gt; Security</strong> to enroll.
          </p>
          <button style={{ ...styles.button, marginTop: '1.5rem' }} onClick={() => { setMfaStep(null); setMfaToken(''); }}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // ── MFA Challenge screen ──
  if (mfaStep === 'challenge') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Two-Factor Authentication</h1>
          <p style={styles.subtitle}>Enter the 6-digit code from your authenticator app</p>
          <form onSubmit={handleMfaSubmit} style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9A-Fa-f]{6,10}"
              placeholder="000000"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\s/g, ''))}
              maxLength={10}
              style={{ ...styles.input, textAlign: 'center', letterSpacing: '0.25em', fontSize: '1.25rem' }}
              autoFocus
              required
            />
            <button type="submit" disabled={mfaLoading || mfaCode.length < 6} style={styles.button}>
              {mfaLoading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" onClick={() => { setMfaStep(null); setError(''); setMfaCode(''); }} style={styles.linkBtn}>
              Cancel — use a different account
            </button>
          </form>
          <p style={{ fontSize: '0.8rem', color: '#71717A', textAlign: 'center', marginTop: '1rem' }}>
            Lost access to your authenticator? Enter a backup code instead.
          </p>
        </div>
      </div>
    );
  }

  // ── Normal login screen ──
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Farroway</h1>
        <p style={styles.subtitle}>The smarter way to farm.</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
          />
          <button type="submit" disabled={loading || !!federatedLoading} style={styles.button}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <div style={{ textAlign: 'right' }}>
            <Link to="/forgot-password" style={{ fontSize: '0.8rem', color: '#22C55E' }}>
              Forgot password?
            </Link>
          </div>
        </form>

        {hasFederated && (
          <>
            <div style={styles.divider}><span style={styles.dividerText}>or</span></div>
            <div style={styles.federatedButtons}>
              {providers.google && (
                <button onClick={() => openFederatedLogin('google')} disabled={!!federatedLoading} style={styles.federatedBtn}>
                  <GoogleIcon />
                  <span>{federatedLoading === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
                </button>
              )}
              {providers.microsoft && (
                <button onClick={() => openFederatedLogin('microsoft')} disabled={!!federatedLoading} style={styles.federatedBtn}>
                  <MicrosoftIcon />
                  <span>{federatedLoading === 'microsoft' ? 'Connecting...' : 'Continue with Microsoft'}</span>
                </button>
              )}
              {providers.oidc && (
                <button onClick={() => openFederatedLogin('oidc')} disabled={!!federatedLoading} style={styles.federatedBtn}>
                  <SsoIcon />
                  <span>{federatedLoading === 'oidc' ? 'Connecting...' : `Continue with ${providers.oidc.displayName || 'SSO'}`}</span>
                </button>
              )}
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#A1A1AA', margin: '1rem 0 0' }}>
          Are you a farmer? <Link to="/farmer-register" style={{ color: '#22C55E', fontWeight: 600 }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" style={{ flexShrink: 0 }}>
      <rect fill="#f25022" x="1" y="1" width="9" height="9" />
      <rect fill="#00a4ef" x="1" y="11" width="9" height="9" />
      <rect fill="#7fba00" x="11" y="1" width="9" height="9" />
      <rect fill="#ffb900" x="11" y="11" width="9" height="9" />
    </svg>
  );
}

function SsoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' },
  card: { background: '#162033', borderRadius: '8px', padding: '2.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#FFFFFF', textAlign: 'center', marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.875rem', color: '#A1A1AA', textAlign: 'center', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '0.75rem 1rem', border: '1px solid #243041', borderRadius: '6px', fontSize: '0.9375rem', outline: 'none', background: '#1E293B', color: '#FFFFFF' },
  button: { padding: '0.75rem', background: '#22C55E', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#A1A1AA', fontSize: '0.85rem', cursor: 'pointer', textDecoration: 'underline', padding: '0.25rem 0' },
  error: { background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', textAlign: 'center' },
  divider: { display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '0.75rem' },
  dividerText: { color: '#71717A', fontSize: '0.8rem', flexShrink: 0, padding: '0 0.5rem', background: '#162033', position: 'relative', zIndex: 1, margin: '0 auto' },
  federatedButtons: { display: 'flex', flexDirection: 'column', gap: '0.625rem' },
  federatedBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', padding: '0.65rem 1rem', border: '1px solid #243041', borderRadius: '6px', background: '#162033', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, color: '#A1A1AA' },
};
