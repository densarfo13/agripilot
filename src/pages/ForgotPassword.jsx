import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../lib/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ email });
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Forgot Password</h1>
        <p style={S.subtitle}>Enter your email and we'll send a reset link</p>

        {sent ? (
          <div style={S.successBox}>
            If that email exists, a reset link has been sent.
          </div>
        ) : (
          <>
            {error && <div style={S.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit} style={S.form}>
              <div>
                <label style={S.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={S.input}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{ ...S.button, ...(loading ? S.buttonDisabled : {}) }}
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}

        <p style={S.footerText}>
          <Link to="/login" style={S.link}>Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card: { width: '100%', maxWidth: '28rem', borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' },
  input: { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff', outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' },
  errorBox: { background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  successBox: { background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#86EFAC', fontSize: '0.875rem', marginBottom: '0.5rem' },
  link: { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  button: { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
};
