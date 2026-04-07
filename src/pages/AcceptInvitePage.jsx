/**
 * AcceptInvitePage — public page farmers use to activate their account via an invite link.
 *
 * Flow:
 * 1. Admin invites farmer → invite link generated: /accept-invite?token=xxx
 * 2. Admin copies link and shares manually (email, WhatsApp, SMS, etc.)
 * 3. Farmer visits link → this page validates the token and pre-fills form
 * 4. Farmer sets email + password → POST /api/invites/:token/accept
 * 5. Account created, farmer can log in immediately
 *
 * Security:
 * - Token is read-only in UI — farmer cannot modify it
 * - Token is consumed on acceptance (single-use)
 * - Expired tokens show a clear error with instructions
 * - Pre-filled fields (name, phone) are read-only — sourced from staff-created record
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client.js';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
];

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | valid | expired | invalid | done
  const [inviteData, setInviteData] = useState(null);
  const [tokenError, setTokenError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Validate the token on page load
  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      setTokenError('No invite token found in this link. Please use the full link provided by your administrator.');
      return;
    }

    api.get(`/invites/${token}/validate`)
      .then(r => {
        setInviteData(r.data);
        setStatus('valid');
      })
      .catch(err => {
        const data = err.response?.data;
        if (data?.expired) {
          setStatus('expired');
          setTokenError(data.error || 'Invite link has expired.');
        } else if (err.response?.status === 400) {
          // Already accepted
          setStatus('already_accepted');
          setTokenError(data?.error || 'This invite has already been used.');
        } else {
          setStatus('invalid');
          setTokenError(data?.error || 'This invite link is invalid or has already been used.');
        }
      });
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (password !== confirmPassword) {
      return setFormError('Passwords do not match');
    }
    if (password.length < 8) {
      return setFormError('Password must be at least 8 characters');
    }

    setSubmitting(true);
    try {
      await api.post(`/invites/${token}/accept`, { email, password });
      setStatus('done');
    } catch (err) {
      const data = err.response?.data;
      if (data?.expired) {
        setStatus('expired');
        setTokenError(data.error);
      } else {
        setFormError(data?.error || 'Failed to activate account. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>AgriPilot</div>
          <p style={{ textAlign: 'center', color: '#6b7280' }}>Validating your invite link…</p>
        </div>
      </div>
    );
  }

  // ─── Invalid / Expired ───────────────────────────────────
  if (status === 'invalid' || status === 'expired') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>AgriPilot</div>
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{status === 'expired' ? '⏰' : '🔗'}</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>
              {status === 'expired' ? 'Invite Link Expired' : 'Invalid Invite Link'}
            </h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5 }}>{tokenError}</p>
          </div>
          {status === 'expired' && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#92400e', marginBottom: '1rem' }}>
              <strong>What to do:</strong> Contact your field officer or institution and ask them to resend the invite. A new link will be generated for you.
            </div>
          )}
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280', marginBottom: 0 }}>
            Already have an account? <Link to="/login" style={{ color: '#2563eb' }}>Sign In</Link>
          </p>
        </div>
      </div>
    );
  }

  // ─── Already accepted ────────────────────────────────────
  if (status === 'already_accepted') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>AgriPilot</div>
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700 }}>Already Activated</h2>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5 }}>{tokenError}</p>
          </div>
          <button onClick={() => navigate('/login')} style={styles.button}>Go to Login</button>
        </div>
      </div>
    );
  }

  // ─── Success ─────────────────────────────────────────────
  if (status === 'done') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.logo}>AgriPilot</div>
          <div style={{ textAlign: 'center', margin: '1.5rem 0' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#d1fae5', color: '#065f46', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, margin: '0 auto 1rem' }}>✓</div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700, color: '#065f46' }}>Account Activated!</h2>
            <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Welcome to AgriPilot, <strong>{inviteData?.fullName}</strong>. Your account is ready. You can now sign in with your email and password.
            </p>
          </div>
          <button onClick={() => navigate('/login')} style={styles.button}>Sign In Now</button>
        </div>
      </div>
    );
  }

  // ─── Valid — show activation form ────────────────────────
  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: '460px' }}>
        <div style={styles.logo}>AgriPilot</div>
        <h1 style={styles.title}>Activate Your Account</h1>

        {inviteData && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.875rem', color: '#1e40af' }}>
            <strong>Welcome, {inviteData.fullName}!</strong><br />
            Your farmer profile has been set up. Choose an email and password to complete your account.
            {inviteData.expiresAt && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#3b82f6' }}>
                This link expires on {new Date(inviteData.expiresAt).toLocaleDateString()}.
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {formError && <div style={styles.error}>{formError}</div>}

          {/* Pre-filled, read-only fields from the farmer record */}
          <div style={styles.sectionLabel}>Your Profile (pre-filled by your institution)</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Full Name</label>
              <input style={{ ...styles.input, background: '#f9fafb', color: '#6b7280' }} value={inviteData?.fullName || ''} readOnly />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Phone</label>
              <input style={{ ...styles.input, background: '#f9fafb', color: '#6b7280' }} value={inviteData?.phone || ''} readOnly />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Region</label>
              <input style={{ ...styles.input, background: '#f9fafb', color: '#6b7280' }} value={inviteData?.region || ''} readOnly />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Language</label>
              <input style={{ ...styles.input, background: '#f9fafb', color: '#6b7280' }} value={LANGUAGES.find(l => l.code === inviteData?.preferredLanguage)?.label || inviteData?.preferredLanguage || ''} readOnly />
            </div>
          </div>

          <div style={styles.sectionLabel}>Create Login Credentials</div>
          <div>
            <label style={styles.fieldLabel}>Email Address *</label>
            <input
              style={styles.input}
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Password *</label>
              <input
                style={styles.input}
                type="password"
                required
                placeholder="Min 8 characters"
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.fieldLabel}>Confirm Password *</label>
              <input
                style={styles.input}
                type="password"
                required
                placeholder="Repeat password"
                minLength={8}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>

          <button type="submit" disabled={submitting} style={styles.button}>
            {submitting ? 'Activating…' : 'Activate Account'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#6b7280', margin: '0.5rem 0 0' }}>
            Already have an account? <Link to="/login" style={{ color: '#2563eb' }}>Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f0f2f5', padding: '1rem',
  },
  card: {
    background: '#fff', borderRadius: 8, padding: '2rem', width: '100%', maxWidth: 400,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  logo: {
    fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'center',
    marginBottom: '0.25rem',
  },
  title: {
    fontSize: '1.05rem', fontWeight: 600, color: '#111827', textAlign: 'center',
    marginBottom: '1rem', marginTop: '0.25rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },
  input: {
    display: 'block', width: '100%', padding: '0.6rem 0.75rem',
    border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem',
    outline: 'none', boxSizing: 'border-box',
  },
  fieldLabel: {
    display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '0.2rem',
  },
  sectionLabel: {
    fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginTop: '0.25rem',
  },
  button: {
    padding: '0.75rem', background: '#2E7D32', color: '#fff', border: 'none',
    borderRadius: 6, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
    marginTop: '0.25rem',
  },
  error: {
    background: '#fef2f2', color: '#dc2626', padding: '0.65rem 0.75rem',
    borderRadius: 6, fontSize: '0.875rem',
  },
};
