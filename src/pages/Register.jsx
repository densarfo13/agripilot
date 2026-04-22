import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  // Keep the minimum password length in sync with ResetPassword and
  // FarmerRegister (both require 8). Showing a different threshold
  // on the registration page made the first reset feel like a policy
  // change from behind the scenes.
  const MIN_PASSWORD = 8;

  const validate = () => {
    const e = {};
    if (!fullName.trim()) e.fullName = 'Please enter your full name.';
    if (!email.trim())    e.email    = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = 'That email address does not look right.';
    if (!password)        e.password = 'Please choose a password.';
    else if (password.length < MIN_PASSWORD)
      e.password = `Please use at least ${MIN_PASSWORD} characters.`;
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
      // Fresh registration → the user has no farm yet, which makes
      // them a first-time farmer. resolveProfileCompletionRoute
      // sends them into the canonical 3-step onboarding. Legacy
      // /onboarding/fast is kept reachable for users who started
      // the old flow, but every new signup lands on v3 first.
      navigate('/onboarding');
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors);
      } else {
        setGeneralError(friendlyRegisterError(err));
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
              placeholder="Full name"
              autoComplete="name"
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
              placeholder="Email address"
              autoComplete="email"
              inputMode="email"
              style={S.input}
            />
            {errors.email && <span style={S.fieldError}>{errors.email}</span>}
          </div>

          <div>
            <label style={S.label}>Password</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD} characters`}
              autoComplete="new-password"
              style={S.input}
              aria-describedby="register-password-hint"
              testIdPrefix="register-password"
            />
            <p id="register-password-hint" style={S.hintText}>
              Use at least {MIN_PASSWORD} characters. A mix of letters and numbers is safer.
            </p>
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

// Translate a raw server / network error into a short, calm line we
// can put in front of the user. Anything we don't recognise falls
// back to a generic message — never the raw "Request failed with
// status 500" string.
function friendlyRegisterError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (msg.includes('already') || msg.includes('exists') || msg.includes('conflict') || msg.includes('409')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return 'That email address does not look right. Please check and try again.';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  if (msg.includes('password')) {
    return 'Please choose a longer password (at least 8 characters).';
  }
  return 'We could not create your account. Please try again in a moment.';
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
  hintText: { color: '#6F8299', fontSize: '0.75rem', marginTop: '0.35rem', marginBottom: 0, lineHeight: 1.45 },
  errorBox: { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.14)', borderRadius: '14px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  link: { color: '#9FB3C8', textDecoration: 'none', fontSize: '0.875rem' },
  button: { background: '#22C55E', color: '#fff', border: 'none', borderRadius: '14px', padding: '0.875rem 1rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', width: '100%', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', color: '#6F8299', fontSize: '0.875rem', marginTop: '1.5rem' },
};
