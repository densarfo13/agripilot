import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { safeTrackEvent } from '../lib/analytics.js';
import { languageToVoiceCode, speakText } from '../lib/voice.js';
import { useTranslation } from '../i18n/index.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useDraft } from '../utils/useDraft.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { UNIT_OPTIONS, toHectares } from '../utils/landSize.js';
import { parseCropValue } from '../utils/crops.js';
import { createNewFarm } from '../lib/api.js';
import CropSelect from '../components/CropSelect.jsx';
import VoicePromptButton from '../components/VoicePromptButton.jsx';
import VoiceBar from '../components/VoiceBar.jsx';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale for country names
countries.registerLocale(enLocale);

// Sorted list of all country names for the dropdown
const COUNTRY_OPTIONS = Object.values(
  countries.getNames('en', { select: 'official' })
).sort((a, b) => a.localeCompare(b));

// Countries where acres are the common unit; everyone else defaults to hectares
const ACRE_COUNTRIES = ['ghana', 'nigeria', 'kenya', 'uganda', 'tanzania', 'usa', 'uk', 'liberia', 'sierra leone', 'gambia'];

function defaultUnitForCountry(country) {
  if (!country) return 'HECTARE';
  return ACRE_COUNTRIES.includes(country.toLowerCase().trim()) ? 'ACRE' : 'HECTARE';
}

const initialForm = {
  farmerName: '', farmName: '', country: 'Ghana', location: '',
  size: '', sizeUnit: 'ACRE', cropType: '', gpsLat: '', gpsLng: '',
  locationLabel: '', experienceLevel: '',
};

const initialErrors = {
  farmerName: '', farmName: '', country: '', location: '',
  size: '', cropType: '', gpsLat: '', gpsLng: '',
};

export default function ProfileSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNewFarmMode = searchParams.get('newFarm') === '1';
  const { profile, loading, saveProfile, switchFarm, refreshFarms, syncStatus } = useProfile();
  const { language, autoVoice } = useAppPrefs();
  const { t } = useTranslation();
  const nameInputRef = useRef(null);
  const submitGuardRef = useRef(false);

  const { state: draftForm, setState: setDraftForm, clearDraft, draftRestored } = useDraft('profile-setup', initialForm);
  const [form, setForm] = useState(draftForm);
  const [fieldErrors, setFieldErrors] = useState(initialErrors);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [gpsSlowMsg, setGpsSlowMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    if (!loading) {
      // In newFarm mode, start with a blank form (keep farmer name from existing profile)
      if (isNewFarmMode) {
        setForm({
          ...initialForm,
          farmerName: profile?.farmerName ?? '',
          country: profile?.country ?? 'Ghana',
          sizeUnit: defaultUnitForCountry(profile?.country ?? 'Ghana'),
        });
      } else {
        const country = profile?.country ?? 'Ghana';
        setForm({
          farmerName: profile?.farmerName ?? '',
          farmName: profile?.farmName ?? '',
          country,
          location: profile?.location ?? '',
          size: profile?.size?.toString() ?? '',
          sizeUnit: profile?.sizeUnit || defaultUnitForCountry(country),
          cropType: profile?.cropType ?? '',
          gpsLat: profile?.gpsLat !== null && profile?.gpsLat !== undefined ? String(profile.gpsLat) : '',
          gpsLng: profile?.gpsLng !== null && profile?.gpsLng !== undefined ? String(profile.gpsLng) : '',
          locationLabel: profile?.locationLabel ?? '',
          experienceLevel: profile?.experienceLevel ?? '',
        });
      }
    }
  }, [profile, loading, isNewFarmMode]);

  useEffect(() => {
    if (!loading && nameInputRef.current && !form.farmerName) {
      nameInputRef.current.focus();
    }
  }, [loading, form.farmerName]);

  useEffect(() => {
    if (autoVoice && !loading) {
      speakText(
        t('setup.voiceWelcome'),
        languageToVoiceCode(language),
      );
    }
  }, [autoVoice, language, loading]);

  useEffect(() => {
    if (syncStatus === 'queued') setInfoMessage(t('setup.savedOffline'));
    else if (syncStatus === 'synced') setInfoMessage(t('setup.savedSuccess'));
    else if (syncStatus === 'failed') setInfoMessage(t('setup.syncRetry'));
  }, [syncStatus, language]);

  const completion = useMemo(() => {
    const checks = [
      form.farmerName.trim(),
      form.farmName.trim(),
      form.country.trim(),
      form.location.trim(),
      form.size.trim(),
      form.cropType && (form.cropType !== 'OTHER' || parseCropValue(form.cropType).customCropName),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setDraftForm(next);
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    setSaveError('');
  }

  async function handleGetGPS() {
    setGpsError('');
    setGpsSlowMsg('');
    setLoadingGPS(true);

    if (!navigator.geolocation) {
      setGpsError(t('location.gpsFallback'));
      setLoadingGPS(false);
      safeTrackEvent('gps.unsupported', {});
      return;
    }

    let slowTimer = setTimeout(() => {
      setGpsSlowMsg(t('location.gpsSlow'));
    }, 10000);

    try {
      const { detectAndResolveLocation } = await import('../utils/geolocation.js');
      const result = await detectAndResolveLocation();
      clearTimeout(slowTimer);
      // GPS only populates coordinates — never overwrites user-entered country or location fields
      updateField('gpsLat', String(result.latitude));
      updateField('gpsLng', String(result.longitude));
      // Store reverse-geocoded label for optional display (e.g. FarmSnapshotCard)
      const label = [result.locality, result.region, result.country].filter(Boolean).join(', ');
      if (label) updateField('locationLabel', label);
      setGpsSlowMsg('');
      safeTrackEvent('gps.success', {});
    } catch {
      clearTimeout(slowTimer);
      setGpsError(t('location.gpsFallback'));
      setGpsSlowMsg('');
      safeTrackEvent('gps.failed', {});
    } finally {
      setLoadingGPS(false);
    }
  }

  function validateBeforeSubmit() {
    const errors = { ...initialErrors };
    let hasError = false;

    if (!form.farmerName.trim()) { errors.farmerName = t('setup.farmerNameRequired'); hasError = true; }
    if (!form.farmName.trim()) { errors.farmName = t('setup.farmNameRequired'); hasError = true; }
    if (!form.country.trim()) { errors.country = t('setup.countryRequired'); hasError = true; }
    if (!form.location.trim()) { errors.location = t('setup.locationRequired'); hasError = true; }
    if (!form.size.trim()) { errors.size = t('setup.sizeRequired'); hasError = true; }
    else {
      const sizeNum = Number(form.size);
      if (Number.isNaN(sizeNum) || sizeNum <= 0) { errors.size = t('setup.sizeInvalid'); hasError = true; }
    }
    if (!form.cropType) { errors.cropType = t('setup.cropRequired'); hasError = true; }
    else {
      const cropParsed = parseCropValue(form.cropType);
      if (cropParsed.isCustomCrop && !cropParsed.customCropName) {
        errors.cropType = t('crop.enterYourCrop'); hasError = true;
      }
    }

    return { errors, hasError };
  }

  async function handleSave() {
    if (submitGuardRef.current) return;

    console.log('Save Farm Profile clicked');
    console.log('Submitting farm profile:', form);

    // Client-side validation — show all field errors at once
    const { errors: validationErrors, hasError } = validateBeforeSubmit();
    if (hasError) {
      setFieldErrors(validationErrors);
      console.warn('Validation failed:', validationErrors);
      return;
    }

    submitGuardRef.current = true;
    setSubmitting(true);
    setSaving(true);
    setSaveError('');
    setFieldErrors(initialErrors);

    let timeoutId;
    try {
      const savePromise = isNewFarmMode ? createNewFarm(form) : saveProfile(form);
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('__SAVE_TIMEOUT__')), 15000);
      });

      const result = await Promise.race([savePromise, timeoutPromise]);
      clearTimeout(timeoutId);
      clearDraft();

      console.log('Farm profile saved:', result);

      trackPilotEvent('setup_completed', {
        hasGps: !!form.gpsLat && !!form.gpsLng,
        hasLocation: !!form.location,
        hasCrop: !!form.cropType,
        isNewFarm: isNewFarmMode,
      });
      safeTrackEvent('profile.form_saved', {
        hasGps: !!form.gpsLat && !!form.gpsLng,
        hasLocation: !!form.location,
        isNewFarm: isNewFarmMode,
      });

      if (isNewFarmMode) {
        // New farm created — switch to it and go back to dashboard
        const newProfile = result.profile || result;
        if (newProfile?.id) {
          try {
            await switchFarm(newProfile.id);
          } catch { /* switch is non-blocking — dashboard will show the new farm */ }
        }
        await refreshFarms();
        navigate('/dashboard');
      } else {
        // Route to farmer-type selection if not yet classified, otherwise dashboard
        if (!form.experienceLevel) {
          navigate('/onboarding/farmer-type');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Farm profile submission error:', error);
      if (error.message === '__SAVE_TIMEOUT__') {
        setSaveError(t('setup.saveTimeout'));
        trackPilotEvent('setup_failed', { reason: 'timeout' });
        safeTrackEvent('profile.save_timeout', {});
      } else {
        setFieldErrors((prev) => ({ ...prev, ...(error.fieldErrors || {}) }));
        setSaveError(error.message || t('setup.saveFailed'));
        trackPilotEvent('setup_failed', { reason: error.message });
        safeTrackEvent('profile.save_failed', { error: error.message });
      }
    } finally {
      setSaving(false);
      setSubmitting(false);
      submitGuardRef.current = false;
    }
  }

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>{t('setup.loading')}</div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Voice guide */}
        <VoiceBar voiceKey="setup.welcome" compact />

        {/* Header card */}
        <div style={S.card}>
          <div style={S.headerRow}>
            <div>
              <h1 style={S.pageTitle}>{t('setup.title')}</h1>
              <p style={S.pageSubtitle}>
                {t('setup.subtitle')}
              </p>
            </div>
          </div>

          <div style={S.progressWrap}>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressBar, width: `${completion}%` }} />
            </div>
            <p style={S.progressText}>{completion}% {t('setup.completed')}</p>
          </div>

          {profile?.farmerUuid && (
            <p style={S.uuidText}>{t('farmerUuid')}: {profile.farmerUuid}</p>
          )}

          {infoMessage && <p style={S.infoMsg}>{infoMessage}</p>}
        </div>

        {/* Form card */}
        <div style={S.card}>
          <div style={S.formGroup}>
            <label style={S.label}>{t('setup.yourName')}</label>
            <input
              ref={nameInputRef}
              value={form.farmerName}
              onChange={(e) => updateField('farmerName', e.target.value)}
              placeholder={t('setup.yourName')}
              style={S.input}
            />
            {fieldErrors.farmerName && <p style={S.fieldError}>{fieldErrors.farmerName}</p>}
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>{t('setup.farmName')}</label>
            <input
              value={form.farmName}
              onChange={(e) => updateField('farmName', e.target.value)}
              placeholder={t('setup.farmName')}
              style={S.input}
            />
            {fieldErrors.farmName && <p style={S.fieldError}>{fieldErrors.farmName}</p>}
          </div>

          {/* Experience Level — "Are you new to farming?" */}
          <div style={S.formGroup}>
            <label style={S.label}>{t('guided.experienceQuestion')}</label>
            <div style={S.experienceRow}>
              <button
                type="button"
                onClick={() => updateField('experienceLevel', 'new')}
                style={{
                  ...S.experienceBtn,
                  ...(form.experienceLevel === 'new' ? S.experienceBtnActive : {}),
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🌱</span>
                <span>{t('guided.newFarmer')}</span>
              </button>
              <button
                type="button"
                onClick={() => updateField('experienceLevel', 'experienced')}
                style={{
                  ...S.experienceBtn,
                  ...(form.experienceLevel === 'experienced' ? S.experienceBtnActive : {}),
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>🧑‍🌾</span>
                <span>{t('guided.experienced')}</span>
              </button>
            </div>
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>{t('setup.country')}</label>
            <select
              value={form.country}
              onChange={(e) => {
                const newCountry = e.target.value;
                updateField('country', newCountry);
                // Auto-switch unit when country changes and user hasn't typed a size yet
                if (!form.size) {
                  updateField('sizeUnit', defaultUnitForCountry(newCountry));
                }
              }}
              style={S.select}
            >
              <option value="">{t('setup.selectCountry')}</option>
              {COUNTRY_OPTIONS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {fieldErrors.country && <p style={S.fieldError}>{fieldErrors.country}</p>}
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>{t('setup.location')}</label>
            <input
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder={t('setup.locationPlaceholder')}
              style={S.input}
            />
            {fieldErrors.location && <p style={S.fieldError}>{fieldErrors.location}</p>}
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>{t('setup.farmSize')}</label>
            <div style={S.sizeRow}>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.size}
                onChange={(e) => updateField('size', e.target.value)}
                placeholder={t('setup.farmSizePlaceholder')}
                style={{ ...S.input, flex: 1 }}
              />
              <select
                value={form.sizeUnit}
                onChange={(e) => updateField('sizeUnit', e.target.value)}
                style={S.unitSelect}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            {form.size && form.sizeUnit !== 'HECTARE' && (
              <p style={S.conversionHint}>
                ≈ {toHectares(parseFloat(form.size), form.sizeUnit)?.toFixed(2) || '—'} {t('setup.hectares')}
              </p>
            )}
            {fieldErrors.size && <p style={S.fieldError}>{fieldErrors.size}</p>}
          </div>

          <div style={S.formGroup}>
            <label style={S.label}>{t('setup.mainCrop')}</label>
            <CropSelect
              value={form.cropType}
              onChange={(code) => updateField('cropType', code)}
              countryCode={form.country}
              placeholder={t('setup.selectCrop')}
              required
            />
            {fieldErrors.cropType && <p style={S.fieldError}>{fieldErrors.cropType}</p>}
          </div>

          {/* GPS — optional, improves weather & recommendations */}
          <div style={S.gpsBox}>
            <p style={S.gpsDesc}>{t('setup.gpsOptional')}</p>

            {form.gpsLat ? (
              <div style={S.gpsSuccess}>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#22C55E' }}>
                  {t('location.captured')}
                </div>
                {form.locationLabel && (
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem' }}>
                    {form.locationLabel}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleGetGPS}
                  disabled={loadingGPS}
                  style={S.gpsUpdateBtn}
                >
                  {loadingGPS ? t('location.updating') : t('location.update')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGetGPS}
                disabled={loadingGPS}
                style={{ ...S.gpsBtn, ...(loadingGPS ? { opacity: 0.6 } : {}) }}
              >
                {loadingGPS ? t('location.detecting') : t('location.getMyLocation')}
              </button>
            )}

            {gpsError && <p style={S.gpsSoftMsg}>{gpsError}</p>}
            {gpsSlowMsg && !gpsError && <p style={S.gpsSoftMsg}>{gpsSlowMsg}</p>}
          </div>

          {saveError && <p style={S.saveError}>{saveError}</p>}

          <div style={S.btnRow}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={S.backBtn}
            >
              {t('common.back')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              style={{ ...S.saveBtn, ...(submitting ? { opacity: 0.6 } : {}) }}
            >
              {submitting ? t('setup.saving') : t('setup.saveFarm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'center',
  },
  container: {
    maxWidth: '42rem',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    paddingTop: '1rem',
    paddingBottom: '100px',
  },
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  pageSubtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
  },
  progressWrap: {
    marginTop: '0.5rem',
  },
  progressTrack: {
    width: '100%',
    height: '0.75rem',
    borderRadius: '9999px',
    background: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: '#22C55E',
    borderRadius: '9999px',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.5rem',
  },
  uuidText: {
    fontSize: '0.75rem',
    color: '#86EFAC',
    marginTop: '0.25rem',
  },
  infoMsg: {
    fontSize: '0.875rem',
    color: '#86EFAC',
    marginTop: '0.25rem',
  },
  formGroup: {},
  experienceRow: {
    display: 'flex',
    gap: '0.75rem',
  },
  experienceBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '1rem 0.5rem',
    borderRadius: '12px',
    background: '#111827',
    border: '2px solid rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    minHeight: '44px',
    transition: 'border-color 0.2s, background 0.2s',
  },
  experienceBtnActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.1)',
    color: '#FFFFFF',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    marginBottom: '0.25rem',
  },
  sizeRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'stretch',
  },
  unitSelect: {
    width: '8.5rem',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0.75rem',
    outline: 'none',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box',
    minHeight: '44px',
    cursor: 'pointer',
    appearance: 'auto',
  },
  conversionHint: {
    fontSize: '0.75rem',
    color: '#86EFAC',
    marginTop: '0.35rem',
  },
  input: {
    width: '100%',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1rem',
    outline: 'none',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box',
    minHeight: '44px',
  },
  select: {
    width: '100%',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '0.75rem 1rem',
    outline: 'none',
    color: '#fff',
    fontSize: '16px',
    boxSizing: 'border-box',
    minHeight: '44px',
    cursor: 'pointer',
    appearance: 'auto',
  },
  fieldError: {
    fontSize: '0.875rem',
    color: '#FCA5A5',
    marginTop: '0.25rem',
  },
  gpsBox: {
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1rem',
  },
  gpsTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  gpsHeading: {
    fontWeight: 600,
    margin: 0,
    fontSize: '1rem',
  },
  gpsDesc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
  },
  gpsBtn: {
    borderRadius: '12px',
    background: '#22C55E',
    padding: '0.75rem 1rem',
    fontWeight: 600,
    color: '#000',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
    whiteSpace: 'nowrap',
  },
  gpsSoftMsg: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.55)',
    marginTop: '0.75rem',
    lineHeight: 1.5,
  },
  gpsSuccess: {
    marginTop: '0.75rem',
    padding: '0.75rem',
    borderRadius: '12px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
  },
  gpsUpdateBtn: {
    marginTop: '0.5rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#86EFAC',
    background: 'transparent',
    border: '1px solid rgba(134,239,172,0.3)',
    borderRadius: '8px',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    minHeight: '36px',
  },
  saveError: {
    fontSize: '0.875rem',
    color: '#FCA5A5',
  },
  btnRow: {
    display: 'flex',
    gap: '0.75rem',
    paddingTop: '0.5rem',
    position: 'sticky',
    bottom: 0,
    background: '#1B2330',
    padding: '0.75rem 0',
    zIndex: 10,
  },
  backBtn: {
    flex: 1,
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  saveBtn: {
    flex: 1,
    borderRadius: '12px',
    background: '#22C55E',
    padding: '1rem',
    fontWeight: 600,
    color: '#000',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};
