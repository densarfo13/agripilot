import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    if (!email.trim()) e.email = 'Email is required';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password must be at least 6 characters';
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
      await register({ fullName, email, password });
      navigate('/profile/setup');
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Create Account</h1>
        <p style={S.subtitle}>Join Farroway to manage your farm</p>

        {generalError && <div style={S.errorBox}>{generalError}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <div>
            <label style={S.label}>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              style={S.input}
            />
            {errors.fullName && <span style={S.fieldError}>{errors.fullName}</span>}
          </div>

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
              placeholder="At least 6 characters"
              style={S.input}
            />
            {errors.password && <span style={S.fieldError}>{errors.password}</span>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...S.button, ...(loading ? S.buttonDisabled : {}) }}
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={S.footerText}>
          Already have an account?{' '}
          <Link to="/login" style={S.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', color: '#EAF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card: { width: '100%', maxWidth: '28rem', borderRadius: '22px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '2.25rem', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#EAF2FF' },
  subtitle: { color: '#9FB3C8', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block', color: '#9FB3C8' },
  input: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#EAF2FF', outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box', transition: 'border-color 0.15s' },
  fieldError: { color: '#FCA5A5', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' },
  errorBox: { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)', borderRadius: '14px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  link: { color: '#9FB3C8', textDecoration: 'none', fontSize: '0.875rem' },
  button: { background: '#22C55E', color: '#fff', border: 'none', borderRadius: '14px', padding: '0.875rem 1rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', width: '100%', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: '#6F8299', fontSize: '0.875rem', marginTop: '1.5rem' },
};
