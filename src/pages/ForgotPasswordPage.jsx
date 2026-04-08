import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      // Server always returns 200 for anti-enumeration; only show errors for bad input
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Reset Password</h1>

        {submitted ? (
          <>
            <div style={styles.success}>
              If that email address is registered, you'll receive a password reset link shortly.
              Check your spam folder if you don't see it within a few minutes.
            </div>
            <Link to="/login" style={styles.backLink}>Back to Sign In</Link>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} style={styles.form}>
              {error && <div style={styles.error}>{error}</div>}
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
                autoFocus
              />
              <button type="submit" disabled={loading} style={styles.button}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <Link to="/login" style={styles.backLink}>Back to Sign In</Link>
          </>
        )}
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
