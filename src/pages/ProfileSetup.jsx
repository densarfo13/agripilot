import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { t } from '../lib/i18n.js';
import { speakText, languageToVoiceCode } from '../lib/voice.js';
import VoicePromptButton from '../components/VoicePromptButton.jsx';

const CROP_OPTIONS = ['maize', 'cassava', 'rice', 'tomato', 'pepper', 'cocoa', 'yam', 'plantain'];

function computeCompletion(form) {
  const fields = ['farmerName', 'farmName', 'country', 'location', 'size', 'cropType', 'gpsLat', 'gpsLng'];
  let filled = 0;
  fields.forEach((f) => {
    const v = form[f];
    if (v !== '' && v !== null && v !== undefined) filled++;
  });
  return Math.round((filled / fields.length) * 100);
}

export default function ProfileSetup() {
  const navigate = useNavigate();
  const { profile, saveProfile, syncStatus, loading: profileLoading } = useProfile();
  const { language, autoVoice } = useAppPrefs();

  const [form, setForm] = useState({
    farmerName: '',
    farmName: '',
    country: 'Ghana',
    location: '',
    size: '',
    cropType: '',
    gpsLat: '',
    gpsLng: '',
  });
  const [error, setError] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        farmerName: profile.farmerName || '',
        farmName: profile.farmName || '',
        country: profile.country || 'Ghana',
        location: profile.location || '',
        size: profile.size != null ? String(profile.size) : '',
        cropType: profile.cropType || '',
        gpsLat: profile.gpsLat != null ? String(profile.gpsLat) : '',
        gpsLng: profile.gpsLng != null ? String(profile.gpsLng) : '',
      });
    }
  }, [profile]);

  // Auto-voice welcome on first load
  useEffect(() => {
    if (autoVoice && !profileLoading) {
      const voiceCode = languageToVoiceCode(language);
      speakText(t(language, 'voiceWelcomeProfile'), voiceCode);
    }
  }, [autoVoice, profileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleGps = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          gpsLat: String(pos.coords.latitude),
          gpsLng: String(pos.coords.longitude),
        }));
        setGpsLoading(false);
      },
      (err) => {
        setError('Could not get your location: ' + err.message);
        setGpsLoading(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.farmerName.trim()) { setError('Farmer name is required'); return; }
    if (!form.farmName.trim()) { setError('Farm name is required'); return; }

    setSaving(true);
    setSyncMsg('');
    try {
      const payload = {
        ...form,
        size: form.size ? Number(form.size) : null,
        gpsLat: form.gpsLat ? Number(form.gpsLat) : null,
        gpsLng: form.gpsLng ? Number(form.gpsLng) : null,
      };
      const result = await saveProfile(payload);
      if (result?.offline) {
        setSyncMsg(t(language, 'profileSavedOffline'));
      } else {
        setSyncMsg(t(language, 'profileSynced'));
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const completion = computeCompletion(form);

  if (profileLoading) {
    return (
      <div style={S.page}>
        <div style={S.card}>
          <p style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.headerRow}>
          <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>&larr; Back</button>
          <h1 style={S.title}>Farm Profile Setup</h1>
          <VoicePromptButton text={t(language, 'voiceWelcomeProfile')} />
        </div>

        {profile?.farmerUuid && (
          <div style={S.uuidBox}>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>Farmer ID:</span>{' '}
            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>{profile.farmerUuid}</span>
          </div>
        )}

        <div style={S.progressWrap}>
          <div style={S.progressLabel}>
            <span>Profile Completion</span>
            <span>{completion}%</span>
          </div>
          <div style={S.progressTrack}>
            <div style={{ ...S.progressBar, width: `${completion}%` }} />
          </div>
        </div>

        {syncMsg && <div style={S.syncBox}>{syncMsg}</div>}
        {error && <div style={S.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <div>
            <label style={S.label}>Farmer Name *</label>
            <input type="text" value={form.farmerName} onChange={handleChange('farmerName')} placeholder="Your name" style={S.input} />
          </div>

          <div>
            <label style={S.label}>Farm Name *</label>
            <input type="text" value={form.farmName} onChange={handleChange('farmName')} placeholder="Name of your farm" style={S.input} />
          </div>

          <div>
            <label style={S.label}>Country</label>
            <input type="text" value={form.country} onChange={handleChange('country')} placeholder="Country" style={S.input} />
          </div>

          <div>
            <label style={S.label}>Location</label>
            <input type="text" value={form.location} onChange={handleChange('location')} placeholder="Town, Region" style={S.input} />
          </div>

          <div>
            <label style={S.label}>Farm Size (acres)</label>
            <input type="number" value={form.size} onChange={handleChange('size')} placeholder="0" min="0" step="0.1" style={S.input} />
          </div>

          <div>
            <label style={S.label}>Crop Type</label>
            <select value={form.cropType} onChange={handleChange('cropType')} style={S.input}>
              <option value="">Select a crop</option>
              {CROP_OPTIONS.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>

          <div style={S.gpsRow}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>GPS Latitude</label>
              <input type="text" value={form.gpsLat} onChange={handleChange('gpsLat')} placeholder="e.g. 5.6037" style={S.input} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>GPS Longitude</label>
              <input type="text" value={form.gpsLng} onChange={handleChange('gpsLng')} placeholder="e.g. -0.1870" style={S.input} />
            </div>
          </div>

          <button
            type="button"
            onClick={handleGps}
            disabled={gpsLoading}
            style={{ ...S.gpsBtn, ...(gpsLoading ? { opacity: 0.6 } : {}) }}
          >
            {gpsLoading ? t(language, 'gettingGPS') : t(language, 'useMyLocation')}
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{ ...S.button, ...(saving ? S.buttonDisabled : {}) }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card: { width: '100%', maxWidth: '32rem', borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)' },
  headerRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' },
  backBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', padding: '0.4rem 0.75rem', cursor: 'pointer', fontSize: '0.875rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: 0 },
  uuidBox: { background: '#111827', borderRadius: '8px', padding: '0.5rem 0.75rem', marginBottom: '1rem' },
  progressWrap: { marginBottom: '1rem' },
  progressLabel: { display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.35rem' },
  progressTrack: { height: '8px', background: '#111827', borderRadius: '4px', overflow: 'hidden' },
  progressBar: { height: '100%', background: '#22C55E', borderRadius: '4px', transition: 'width 0.3s ease' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  label: { fontSize: '0.875rem', marginBottom: '0.25rem', display: 'block' },
  input: { background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#fff', outline: 'none', width: '100%', fontSize: '0.875rem', boxSizing: 'border-box' },
  gpsRow: { display: 'flex', gap: '0.75rem' },
  gpsBtn: { background: 'none', border: '1px solid #22C55E', borderRadius: '12px', color: '#22C55E', padding: '0.65rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' },
  syncBox: { background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#86EFAC', fontSize: '0.875rem', marginBottom: '0.5rem' },
  errorBox: { background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '12px', padding: '0.75rem 1rem', color: '#FCA5A5', fontSize: '0.875rem', marginBottom: '0.5rem' },
  button: { background: '#22C55E', color: '#000', border: 'none', borderRadius: '12px', padding: '0.75rem 1rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', width: '100%' },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
};
