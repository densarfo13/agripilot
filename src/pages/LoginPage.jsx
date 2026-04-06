import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState({ google: false, microsoft: false });
  const [federatedLoading, setFederatedLoading] = useState(null); // 'google' | 'microsoft' | null
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Fetch available federated providers on mount
  useEffect(() => {
    api.get('/auth/providers')
      .then(({ data }) => setProviders(data))
      .catch(() => {}); // silently fail — buttons just won't show
  }, []);

  // Listen for postMessage from federated auth popup
  const handleAuthMessage = useCallback((event) => {
    // Parse the message — it arrives as a JSON string
    let data;
    try {
      data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    } catch {
      return; // not our message
    }

    if (!data || data.type !== 'agripilot-auth') return;

    setFederatedLoading(null);

    if (data.error) {
      setError(data.error);
      return;
    }

    if (data.user && data.accessToken) {
      setAuth(data.user, data.accessToken);
      navigate('/');
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
      setAuth(data.user, data.accessToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Federated login via popup
  const openFederatedLogin = (provider) => {
    setError('');
    setFederatedLoading(provider);

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      `/api/auth/${provider}`,
      `agripilot-${provider}-login`,
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Monitor popup closure (user may close without completing)
    const interval = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(interval);
        setFederatedLoading(null);
      }
    }, 500);
  };

  const hasFederated = providers.google || providers.microsoft;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>AgriPilot</h1>
        <p style={styles.subtitle}>Institutional Credit Platform</p>
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
        </form>

        {hasFederated && (
          <>
            <div style={styles.divider}>
              <span style={styles.dividerText}>or</span>
            </div>
            <div style={styles.federatedButtons}>
              {providers.google && (
                <button
                  onClick={() => openFederatedLogin('google')}
                  disabled={!!federatedLoading}
                  style={styles.federatedBtn}
                >
                  <GoogleIcon />
                  <span>{federatedLoading === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
                </button>
              )}
              {providers.microsoft && (
                <button
                  onClick={() => openFederatedLogin('microsoft')}
                  disabled={!!federatedLoading}
                  style={styles.federatedBtn}
                >
                  <MicrosoftIcon />
                  <span>{federatedLoading === 'microsoft' ? 'Connecting...' : 'Continue with Microsoft'}</span>
                </button>
              )}
            </div>
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#666', margin: '1rem 0 0' }}>
          Are you a farmer? <Link to="/farmer-register" style={{ color: '#2E7D32', fontWeight: 600 }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}

// Inline SVG icons (no external dependencies)
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

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    borderRadius: '8px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#666',
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  input: {
    padding: '0.75rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.9375rem',
    outline: 'none',
  },
  button: {
    padding: '0.75rem',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '0.75rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '1.25rem 0',
    gap: '0.75rem',
  },
  dividerText: {
    color: '#9ca3af',
    fontSize: '0.8rem',
    flexShrink: 0,
    padding: '0 0.5rem',
    background: '#fff',
    position: 'relative',
    zIndex: 1,
    margin: '0 auto',
  },
  federatedButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  federatedBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    padding: '0.65rem 1rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    color: '#374151',
    transition: 'background 0.15s',
  },
};
