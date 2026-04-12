import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useFarmStore } from '../store/farmStore.js';
import { calculateFarmScore, getMissingProfileItems } from '../utils/farmScore.js';
import { computeLandSizeFields, UNIT_OPTIONS } from '../utils/landSize.js';
import { useTranslation } from '../i18n/index.js';
import CropSelect from '../components/CropSelect.jsx';
import CountrySelect from '../components/CountrySelect.jsx';
import InlineAlert from '../components/InlineAlert.jsx';
import FarmerUuidBadge from '../components/FarmerUuidBadge.jsx';

// Top crops for quick selection (same as OnboardingWizard)
const TOP_CROPS = [
  { code: 'MAIZE', label: 'Maize', icon: '\uD83C\uDF3D' },
  { code: 'RICE', label: 'Rice', icon: '\uD83C\uDF3E' },
  { code: 'BEAN', label: 'Beans', icon: '\uD83E\uDED8' },
  { code: 'COFFEE', label: 'Coffee', icon: '\u2615' },
  { code: 'CASSAVA', label: 'Cassava', icon: '\uD83E\uDD54' },
  { code: 'BANANA', label: 'Banana', icon: '\uD83C\uDF4C' },
  { code: 'WHEAT', label: 'Wheat', icon: '\uD83C\uDF3E' },
  { code: 'SORGHUM', label: 'Sorghum', icon: '\uD83C\uDF3F' },
];

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { fetchProfiles, createProfile, updateProfile, currentProfile } = useFarmStore();

  const [form, setForm] = useState({
    farmerName: '',
    farmName: '',
    countryCode: '',
    locationName: '',
    landSizeValue: '',
    landSizeUnit: 'ACRE',
    crop: '',
    latitude: null,
    longitude: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [farmerUuid, setFarmerUuid] = useState(null);

  // Load existing profile on mount
  useEffect(() => {
    (async () => {
      const profiles = await fetchProfiles();
      const existing = profiles?.[0] || currentProfile;
      if (existing) {
        setFarmerUuid(existing.farmerUuid || null);
        setForm({
          farmerName: existing.farmerName || user?.fullName || '',
          farmName: existing.farmName || '',
          countryCode: existing.countryCode || user?.countryCode || '',
          locationName: existing.locationName || existing.location || '',
          landSizeValue: existing.landSizeValue || existing.farmSizeAcres || '',
          landSizeUnit: existing.landSizeUnit || 'ACRE',
          crop: existing.crop || existing.cropType || '',
          latitude: existing.latitude ?? existing.gpsLat ?? null,
          longitude: existing.longitude ?? existing.gpsLng ?? null,
        });
      } else {
        // Pre-fill from auth user
        setForm((f) => ({
          ...f,
          farmerName: user?.fullName || '',
          countryCode: user?.countryCode || '',
        }));
      }
      setLoaded(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setError('');
  }, []);

  // GPS capture
  const captureGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? 'Location permission denied. Please enable GPS.'
            : 'Could not get location. Try again.'
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, []);

  // Compute score for display
  const { score, status } = calculateFarmScore(form, { countryCode: form.countryCode });
  const missingItems = getMissingProfileItems(form, { countryCode: form.countryCode });

  // Save
  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const sizeFields = computeLandSizeFields(form.landSizeValue, form.landSizeUnit);
      const payload = {
        farmerName: form.farmerName.trim(),
        farmName: form.farmName.trim(),
        countryCode: form.countryCode,
        locationName: form.locationName.trim(),
        crop: form.crop,
        latitude: form.latitude,
        longitude: form.longitude,
        ...sizeFields,
      };

      const existing = currentProfile || (await fetchProfiles())?.[0];
      if (existing?.id) {
        await updateProfile(existing.id, payload);
      } else {
        await createProfile(payload);
      }
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.card}><p style={{ color: '#A1A1AA' }}>Loading profile...</p></div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Farmer UUID badge */}
        {farmerUuid && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <FarmerUuidBadge profile={{ farmerUuid, farmerName: form.farmerName, farmName: form.farmName }} />
          </div>
        )}

        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>Complete Your Farm Profile</h1>
          <p style={S.subtitle}>Fill in the details below to unlock all features.</p>
        </div>

        {/* Progress bar */}
        <div style={S.progressSection}>
          <div style={S.progressBarBg}>
            <div style={{ ...S.progressBarFill, width: `${score}%` }} />
          </div>
          <div style={S.progressRow}>
            <span style={S.progressLabel}>{score}% complete</span>
            <span style={S.progressStatus}>{status}</span>
          </div>
          {missingItems.length > 0 && (
            <div style={S.missingList}>
              {missingItems.map((item) => (
                <span key={item} style={S.missingChip}>{item}</span>
              ))}
            </div>
          )}
        </div>

        {error && <InlineAlert type="error" message={error} />}

        {/* Form */}
        <div style={S.card}>
          {/* Farmer Name */}
          <div style={S.field}>
            <label style={S.label}>Farmer Name</label>
            <input
              style={S.input}
              value={form.farmerName}
              onChange={(e) => handleChange('farmerName', e.target.value)}
              placeholder="Your full name"
            />
          </div>

          {/* Farm Name */}
          <div style={S.field}>
            <label style={S.label}>Farm Name</label>
            <input
              style={S.input}
              value={form.farmName}
              onChange={(e) => handleChange('farmName', e.target.value)}
              placeholder="e.g. Green Valley Farm"
            />
          </div>

          {/* Country */}
          <div style={S.field}>
            <label style={S.label}>Country</label>
            <CountrySelect
              value={form.countryCode}
              onChange={(code) => handleChange('countryCode', code)}
            />
          </div>

          {/* Location */}
          <div style={S.field}>
            <label style={S.label}>Location / Village</label>
            <input
              style={S.input}
              value={form.locationName}
              onChange={(e) => handleChange('locationName', e.target.value)}
              placeholder="e.g. Kitale, Trans-Nzoia"
            />
          </div>

          {/* Farm Size */}
          <div style={S.field}>
            <label style={S.label}>Farm Size</label>
            <div style={S.sizeRow}>
              <input
                style={{ ...S.input, flex: 1 }}
                type="number"
                min="0"
                step="0.1"
                value={form.landSizeValue}
                onChange={(e) => handleChange('landSizeValue', e.target.value)}
                placeholder="e.g. 5"
              />
              <select
                style={S.unitSelect}
                value={form.landSizeUnit}
                onChange={(e) => handleChange('landSizeUnit', e.target.value)}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Crop Type */}
          <div style={S.field}>
            <label style={S.label}>Primary Crop</label>
            <div style={S.cropGrid}>
              {TOP_CROPS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  style={{
                    ...S.cropChip,
                    ...(form.crop === c.code ? S.cropChipActive : {}),
                  }}
                  onClick={() => handleChange('crop', c.code)}
                >
                  <span>{c.icon}</span>
                  <span style={{ fontSize: '0.8rem' }}>{c.label}</span>
                </button>
              ))}
            </div>
            <CropSelect
              value={form.crop}
              onChange={(code) => handleChange('crop', code)}
              style={{ marginTop: '0.5rem' }}
            />
          </div>

          {/* GPS Coordinates */}
          <div style={S.field}>
            <label style={S.label}>GPS Coordinates</label>
            {form.latitude != null && form.longitude != null ? (
              <div style={S.gpsDisplay}>
                <span style={{ color: '#22C55E', fontWeight: 600 }}>
                  {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                </span>
                <button
                  type="button"
                  style={S.gpsBtn}
                  onClick={captureGPS}
                  disabled={gpsLoading}
                >
                  {gpsLoading ? 'Updating...' : 'Update'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                style={S.gpsCaptureBtn}
                onClick={captureGPS}
                disabled={gpsLoading}
              >
                {gpsLoading ? 'Detecting location...' : 'Capture GPS Location'}
              </button>
            )}
            {gpsError && <p style={S.gpsErrorText}>{gpsError}</p>}
          </div>
        </div>

        {/* Save button */}
        <button
          style={{
            ...S.saveBtn,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>

        {/* Skip link */}
        <button
          style={S.skipLink}
          onClick={() => navigate('/', { replace: true })}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ─── Styles (matches existing dark theme) ──────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#FFFFFF',
  },
  container: {
    maxWidth: '540px',
    margin: '0 auto',
    padding: '1.5rem 1rem 3rem',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#FFFFFF',
    margin: '0 0 0.4rem',
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#A1A1AA',
    margin: 0,
  },
  // Progress
  progressSection: {
    marginBottom: '1.25rem',
  },
  progressBarBg: {
    height: '8px',
    borderRadius: '4px',
    background: '#1E293B',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, #22C55E, #16A34A)',
    transition: 'width 0.4s ease',
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#FFFFFF',
  },
  progressStatus: {
    fontSize: '0.8rem',
    color: '#A1A1AA',
  },
  missingList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginTop: '0.5rem',
  },
  missingChip: {
    display: 'inline-block',
    padding: '0.2rem 0.6rem',
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: 'rgba(245,158,11,0.12)',
    color: '#F59E0B',
  },
  // Card
  card: {
    background: '#162033',
    borderRadius: '12px',
    padding: '1.25rem',
    marginBottom: '1.25rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  // Form fields
  field: {
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#A1A1AA',
    marginBottom: '0.4rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: '#1E293B',
    border: '1px solid #243041',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '1rem',
    outline: 'none',
    boxSizing: 'border-box',
    minHeight: '48px',
  },
  sizeRow: {
    display: 'flex',
    gap: '0.5rem',
  },
  unitSelect: {
    padding: '0.75rem 0.5rem',
    background: '#1E293B',
    border: '1px solid #243041',
    borderRadius: '8px',
    color: '#FFFFFF',
    fontSize: '0.9rem',
    minHeight: '48px',
    minWidth: '110px',
  },
  // Crop chips
  cropGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  cropChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.5rem 0.7rem',
    background: '#1E293B',
    border: '2px solid #243041',
    borderRadius: '10px',
    color: '#FFFFFF',
    cursor: 'pointer',
    minWidth: '60px',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
  cropChipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
  },
  // GPS
  gpsDisplay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    background: '#1E293B',
    borderRadius: '8px',
    border: '1px solid #243041',
  },
  gpsCaptureBtn: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: '#1E293B',
    border: '2px dashed #243041',
    borderRadius: '8px',
    color: '#0EA5E9',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
  gpsBtn: {
    padding: '0.4rem 0.8rem',
    background: 'transparent',
    border: '1px solid #243041',
    borderRadius: '6px',
    color: '#0EA5E9',
    fontSize: '0.8rem',
    cursor: 'pointer',
    minHeight: '36px',
  },
  gpsErrorText: {
    fontSize: '0.8rem',
    color: '#EF4444',
    marginTop: '0.3rem',
  },
  // Save
  saveBtn: {
    display: 'block',
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '14px',
    fontWeight: 800,
    fontSize: '1.15rem',
    boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
    minHeight: '56px',
    WebkitTapHighlightColor: 'transparent',
  },
  skipLink: {
    display: 'block',
    width: '100%',
    padding: '0.75rem',
    background: 'transparent',
    border: 'none',
    color: '#A1A1AA',
    fontSize: '0.9rem',
    textAlign: 'center',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
};
