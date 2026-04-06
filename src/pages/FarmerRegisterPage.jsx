import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client.js';

const COUNTRIES = [
  { code: 'KE', label: 'Kenya' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'UG', label: 'Uganda' },
  { code: 'GH', label: 'Ghana' },
  { code: 'NG', label: 'Nigeria' },
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
];

export default function FarmerRegisterPage() {
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', password: '', confirmPassword: '',
    countryCode: 'KE', region: '', district: '', village: '',
    preferredLanguage: 'en', primaryCrop: '', farmSizeAcres: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      await api.post('/auth/farmer-register', {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        password: form.password,
        countryCode: form.countryCode,
        region: form.region,
        district: form.district || undefined,
        village: form.village || undefined,
        preferredLanguage: form.preferredLanguage,
        primaryCrop: form.primaryCrop || undefined,
        farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={styles.title}>Registration Received</h1>
          <p style={styles.successText}>
            Thank you for registering with AgriPilot. Your application is now <strong>pending review</strong>.
          </p>
          <div style={styles.nextSteps}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>What happens next:</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#555' }}>
              <li>Our team will review your registration</li>
              <li>A field officer may be assigned to verify your details</li>
              <li>You will be notified once your account is approved</li>
              <li>After approval, you can submit credit applications</li>
            </ul>
          </div>
          <button onClick={() => navigate('/login')} style={styles.button}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: '480px' }}>
        <h1 style={styles.title}>AgriPilot</h1>
        <p style={styles.subtitle}>Farmer Registration</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.sectionLabel}>Personal Information</div>

          <input style={styles.input} placeholder="Full Name *" required value={form.fullName} onChange={set('fullName')} />
          <input style={styles.input} placeholder="Phone Number *" required value={form.phone} onChange={set('phone')} type="tel" />
          <input style={styles.input} placeholder="Email Address *" required value={form.email} onChange={set('email')} type="email" />

          <div style={styles.row}>
            <input style={{ ...styles.input, flex: 1 }} placeholder="Password *" required value={form.password} onChange={set('password')} type="password" minLength={6} />
            <input style={{ ...styles.input, flex: 1 }} placeholder="Confirm Password *" required value={form.confirmPassword} onChange={set('confirmPassword')} type="password" minLength={6} />
          </div>

          <div style={styles.sectionLabel}>Location</div>

          <div style={styles.row}>
            <select style={{ ...styles.input, flex: 1 }} value={form.countryCode} onChange={set('countryCode')}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
            <select style={{ ...styles.input, flex: 1 }} value={form.preferredLanguage} onChange={set('preferredLanguage')}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <input style={styles.input} placeholder="Region / County *" required value={form.region} onChange={set('region')} />
          <div style={styles.row}>
            <input style={{ ...styles.input, flex: 1 }} placeholder="District (optional)" value={form.district} onChange={set('district')} />
            <input style={{ ...styles.input, flex: 1 }} placeholder="Village (optional)" value={form.village} onChange={set('village')} />
          </div>

          <div style={styles.sectionLabel}>Farm Details (optional)</div>

          <div style={styles.row}>
            <input style={{ ...styles.input, flex: 1 }} placeholder="Primary Crop" value={form.primaryCrop} onChange={set('primaryCrop')} />
            <input style={{ ...styles.input, flex: 1 }} placeholder="Farm Size (acres)" value={form.farmSizeAcres} onChange={set('farmSizeAcres')} type="number" step="0.1" min="0" />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Submitting...' : 'Register'}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#666', margin: '0.5rem 0 0' }}>
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
    background: '#fff', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', textAlign: 'center', marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.875rem', color: '#666', textAlign: 'center', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  input: {
    padding: '0.65rem 0.85rem', border: '1px solid #d1d5db', borderRadius: '6px',
    fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  row: { display: 'flex', gap: '0.5rem' },
  sectionLabel: {
    fontSize: '0.8rem', fontWeight: 600, color: '#374151', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginTop: '0.25rem',
  },
  button: {
    padding: '0.75rem', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '6px',
    fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem',
  },
  error: {
    background: '#fef2f2', color: '#dc2626', padding: '0.75rem', borderRadius: '6px',
    fontSize: '0.875rem', textAlign: 'center',
  },
  successIcon: {
    width: '60px', height: '60px', borderRadius: '50%', background: '#d4edda', color: '#2E7D32',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
    fontWeight: 700, margin: '0 auto 1rem',
  },
  successText: { textAlign: 'center', color: '#555', fontSize: '0.95rem', lineHeight: 1.5 },
  nextSteps: {
    background: '#f8f9fa', borderRadius: '6px', padding: '1rem', margin: '1rem 0',
    lineHeight: 1.6,
  },
};
