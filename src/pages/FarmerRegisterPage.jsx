import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import api from '../runtime/apiRuntime.js';
import CountrySelect from '../components/CountrySelect.jsx';
import CropSelect from '../components/CropSelect.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import LocationDetect from '../components/LocationDetect.jsx';
import { useDraft } from '../utils/useDraft.js';
import { UNIT_OPTIONS, computeLandSizeFields } from '../utils/landSize.js';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
];

const INITIAL_FORM = {
  fullName: '', phone: '', email: '', password: '', confirmPassword: '',
  countryCode: 'KE', region: '', district: '', village: '',
  preferredLanguage: 'en', primaryCrop: '', farmSizeAcres: '', landSizeUnit: 'ACRE',
  latitude: null, longitude: null, locationSource: null,
  geolocationAccuracy: null, geolocationCapturedAt: null,
};

export default function FarmerRegisterPage() {
  // Persist non-sensitive fields across refresh (passwords are never stored)
  const { state: savedForm, setState: setSavedForm, clearDraft, draftRestored } = useDraft('farmer-register', {
    fullName: '', phone: '', countryCode: 'KE', region: '', district: '', village: '',
    preferredLanguage: 'en', primaryCrop: '', farmSizeAcres: '', landSizeUnit: 'ACRE',
  });
  const [form, setForm] = useState({
    ...INITIAL_FORM,
    ...savedForm,
    // Never restore passwords from localStorage
    email: '', password: '', confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If URL has ?invite= token, redirect to the dedicated AcceptInvitePage
  // (the dedicated page handles token validation, expiry, and account creation cleanly)
  useEffect(() => {
    const token = searchParams.get('invite');
    if (token) {
      navigate(`/accept-invite?token=${token}`, { replace: true });
    }
  }, []);

  const set = (k) => (e) => {
    const val = e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    // Persist non-sensitive fields to draft (never store passwords/email)
    if (!['password', 'confirmPassword', 'email'].includes(k)) {
      setSavedForm(prev => ({ ...prev, [k]: val }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      return setError(tSafe('register.error.passwordMismatch', 'Passwords do not match'));
    }
    if (form.password.length < 8) {
      return setError(tSafe('register.error.passwordPolicy', 'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'));
    }

    setLoading(true);
    try {
      const ls = form.farmSizeAcres ? computeLandSizeFields(form.farmSizeAcres, form.landSizeUnit) : {};
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
        landSizeValue: ls.landSizeValue ?? undefined,
        landSizeUnit: ls.landSizeUnit ?? undefined,
        latitude: form.latitude || undefined,
        longitude: form.longitude || undefined,
        locationSource: form.locationSource || undefined,
        geolocationAccuracy: form.geolocationAccuracy || undefined,
        geolocationCapturedAt: form.geolocationCapturedAt || undefined,
      });
      clearDraft();
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || tSafe('register.error.generic', 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={styles.title}>{tSafe('register.success.title', 'Registration Received')}</h1>
          <p style={styles.successText}>
            {tSafe('register.success.body', 'Thank you for registering with Farroway. Your application is now pending review.')}
          </p>
          <div style={styles.nextSteps}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{tSafe('register.success.nextHeading', 'What happens next:')}</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#A1A1AA' }}>
              <li>{tSafe('register.success.step1', 'Our team will review your registration')}</li>
              <li>{tSafe('register.success.step2', 'A field officer may be assigned to verify your details')}</li>
              <li>{tSafe('register.success.step3', 'You will be notified once your account is approved')}</li>
              <li>{tSafe('register.success.step4', 'After approval, you can submit credit applications')}</li>
            </ul>
          </div>
          <button onClick={() => navigate('/login')} style={styles.button}>
            {tSafe('register.success.goToLogin', 'Go to Login')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={{ ...styles.card, maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
          <BrandLogo variant="light" size="md" />
        </div>
        <p style={styles.subtitle}>{tSafe('register.subtitle', 'Farmer Registration')}</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {draftRestored && (
            <div className="alert-inline alert-inline-success" style={{ fontSize: '0.8rem', textAlign: 'center', justifyContent: 'center' }}>
              ↻ {tSafe('register.draftRestored', 'Your previous entry was restored automatically.')}
            </div>
          )}
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.sectionLabel}>{tSafe('register.section.personal', 'Personal Information')}</div>

          <input style={styles.input} placeholder={tSafe('register.field.fullName', 'Full Name *')} required value={form.fullName} onChange={set('fullName')} />
          <PhoneInput
            style={styles.input}
            value={form.phone}
            onChange={set('phone')}
            countryCode={form.countryCode}
            required
          />
          <input style={styles.input} placeholder={tSafe('register.field.email', 'Email Address *')} required value={form.email} onChange={set('email')} type="email" />

          <div style={styles.row}>
            <PasswordInput
              wrapperStyle={{ flex: 1 }}
              style={{ ...styles.input, width: '100%' }}
              placeholder={tSafe('register.field.password', 'Password *')} required
              value={form.password} onChange={set('password')}
              minLength={8} autoComplete="new-password"
              testIdPrefix="farmer-register-password"
            />
            <PasswordInput
              wrapperStyle={{ flex: 1 }}
              style={{ ...styles.input, width: '100%' }}
              placeholder={tSafe('register.field.confirmPassword', 'Confirm Password *')} required
              value={form.confirmPassword} onChange={set('confirmPassword')}
              minLength={8} autoComplete="new-password"
              testIdPrefix="farmer-register-confirm"
            />
          </div>

          <div style={styles.sectionLabel}>{tSafe('register.section.location', 'Location')}</div>

          <LocationDetect
            onDetected={(loc) => {
              setForm(f => {
                const next = {
                  ...f,
                  latitude: loc.latitude, longitude: loc.longitude,
                  locationSource: 'gps', geolocationAccuracy: loc.accuracy,
                  geolocationCapturedAt: loc.capturedAt,
                };
                // Only auto-fill empty text fields — never overwrite what the user typed
                if (loc.region && !f.region) next.region = loc.region;
                if (loc.district && !f.district) next.district = loc.district;
                if (loc.locality && !f.village) next.village = loc.locality;
                if (loc.countryCode && loc.countryCode.length === 2) next.countryCode = loc.countryCode;
                return next;
              });
              // Persist filled fields to draft
              const filled = {};
              if (loc.region) filled.region = loc.region;
              if (loc.district) filled.district = loc.district;
              if (loc.locality) filled.village = loc.locality;
              if (loc.countryCode) filled.countryCode = loc.countryCode;
              if (Object.keys(filled).length) setSavedForm(prev => ({ ...prev, ...filled }));
            }}
            style={{ marginBottom: '0.25rem' }}
          />
          {form.latitude && (
            <div style={{ fontSize: '0.78rem', color: '#C8944D', marginBottom: '0.5rem' }}>
              {tSafe('register.locationFound', 'Location found — fields updated below.')}
            </div>
          )}

          <div style={styles.row}>
            <CountrySelect
              value={form.countryCode}
              onChange={set('countryCode')}
              selectStyle={{ ...styles.input, flex: 1 }}
              inputStyle={{ ...styles.input, flex: 1 }}
              wrapperStyle={{ flex: 1 }}
            />
            <select style={{ ...styles.input, flex: 1 }} value={form.preferredLanguage} onChange={set('preferredLanguage')}>
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>

          <input style={styles.input} placeholder={tSafe('register.field.region', 'Region / County *')} required value={form.region} onChange={set('region')} />
          <div style={styles.row}>
            <input style={{ ...styles.input, flex: 1 }} placeholder={tSafe('register.field.district', 'District (optional)')} value={form.district} onChange={set('district')} />
            <input style={{ ...styles.input, flex: 1 }} placeholder={tSafe('register.field.village', 'Village (optional)')} value={form.village} onChange={set('village')} />
          </div>

          <div style={styles.sectionLabel}>{tSafe('register.section.farmDetails', 'Farm Details (optional)')}</div>

          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <CropSelect
                value={form.primaryCrop}
                onChange={(v) => { setForm(f => ({ ...f, primaryCrop: v })); setSavedForm(prev => ({ ...prev, primaryCrop: v })); }}
                countryCode={form.countryCode}
                placeholder={tSafe('register.field.primaryCrop', 'Select crop (optional)')}
                optional
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
              <input style={{ ...styles.input, flex: 1 }} placeholder={tSafe('register.field.farmSize', 'Farm Size')} value={form.farmSizeAcres} onChange={set('farmSizeAcres')} type="number" step="0.1" min="0" />
              <select style={{ ...styles.input, width: 'auto', minWidth: '7rem' }} value={form.landSizeUnit} onChange={e => { setForm(f => ({ ...f, landSizeUnit: e.target.value })); setSavedForm(prev => ({ ...prev, landSizeUnit: e.target.value })); }}>
                {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? tSafe('register.submitting', 'Submitting...') : tSafe('register.submit', 'Register')}
          </button>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#A1A1AA', margin: '0.5rem 0 0' }}>
            {tSafe('register.haveAccount', 'Already have an account?')} <Link to="/login" style={{ color: '#C8944D' }}>{tSafe('register.signIn', 'Sign In')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0F172A', padding: '1rem',
  },
  card: {
    background: '#162033', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '400px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, color: '#FFFFFF', textAlign: 'center', marginBottom: '0.25rem' },
  subtitle: { fontSize: '0.875rem', color: '#A1A1AA', textAlign: 'center', marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  input: {
    padding: '0.65rem 0.85rem', border: '1px solid #243041', borderRadius: '6px',
    fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box',
    background: '#1E293B', color: '#FFFFFF',
  },
  row: { display: 'flex', gap: '0.5rem' },
  sectionLabel: {
    fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginTop: '0.25rem',
  },
  button: {
    padding: '0.75rem', background: '#C8944D', color: '#fff', border: 'none', borderRadius: '6px',
    fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.5rem',
  },
  error: {
    background: 'rgba(239,68,68,0.15)', color: '#EF4444', padding: '0.75rem', borderRadius: '6px',
    fontSize: '0.875rem', textAlign: 'center',
  },
  successIcon: {
    width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(200,148,77,0.2)', color: '#C8944D',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
    fontWeight: 700, margin: '0 auto 1rem',
  },
  successText: { textAlign: 'center', color: '#A1A1AA', fontSize: '0.95rem', lineHeight: 1.5 },
  nextSteps: {
    background: '#1E293B', borderRadius: '6px', padding: '1rem', margin: '1rem 0',
    lineHeight: 1.6,
  },
};
