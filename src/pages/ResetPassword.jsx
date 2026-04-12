import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../lib/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Password is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({ token, password });
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Reset Password</h1>
        <p style={S.subtitle}>Enter your new password</p>

        {!token && (
          <div style={S.errorBox}>
            Invalid or missing reset token. Please request a new reset link.
          </div>
        )}

        {error && <div style={S.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <div>
            <label style={S.label}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              style={S.input}
              disabled={!token}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            style={{ ...S.button, ...(loading || !token ? S.buttonDisabled : {}) }}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

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
  link: { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  button: { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
};
