import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    if (!password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Welcome Back</h1>
        <p style={S.subtitle}>Sign in to your AgriPilot account</p>

        {generalError && <div style={S.errorBox}>{generalError}</div>}

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
            {errors.email && <span style={S.fieldError}>{errors.email}</span>}
          </div>

          <div>
            <label style={S.label}>Password</label>
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
            <Link to="/forgot-password" style={S.link}>Forgot password?</Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...S.button, ...(loading ? S.buttonDisabled : {}) }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={S.footerText}>
          Don't have an account?{' '}
          <Link to="/register" style={S.link}>Create one</Link>
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
  fieldError: { color: '#FCA5A5', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' },
  errorBox: { background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  forgotRow: { textAlign: 'right' },
  link: { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  button: { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
};
