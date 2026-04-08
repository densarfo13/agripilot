import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/client.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Invalid Link</h1>
          <p style={{ ...styles.subtitle, color: '#EF4444' }}>
            This password reset link is missing a token. Please request a new link.
          </p>
          <Link to="/forgot-password" style={styles.backLink}>Request new link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired — please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Set New Password</h1>

        {success ? (
          <div style={styles.success}>
            Password reset successfully. Redirecting to sign in...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
              autoFocus
              minLength={8}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={styles.input}
              required
            />
            <p style={{ fontSize: '0.78rem', color: '#71717A', margin: '-0.25rem 0 0' }}>
              Minimum 8 characters, must include uppercase, lowercase, number, and symbol.
            </p>
            <button type="submit" disabled={loading} style={styles.button}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
        <Link to="/login" style={styles.backLink}>Back to Sign In</Link>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0F172A' },
  card: { background: '#162033', borderRadius: '8px', padding: '2.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#FFFFFF', textAlign: 'center', marginBottom: '0.5rem' },
  subtitle: { fontSize: '0.875rem', color: '#A1A1AA', textAlign: 'center', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '0.75rem 1rem', border: '1px solid #243041', borderRadius: '6px', fontSize: '0.9375rem', outline: 'none', background: '#1E293B', color: '#FFFFFF' },
  button: { padding: '0.75rem', background: '#22C55E', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' },
  error: { background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '0.75rem', borderRadius: '6px', fontSize: '0.875rem', textAlign: 'center' },
  success: { background: 'rgba(34,197,94,0.15)', color: '#22C55E', padding: '1rem', borderRadius: '6px', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' },
  backLink: { display: 'block', textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: '#22C55E' },
};
