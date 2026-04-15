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
import OnboardingSteps from '../components/OnboardingSteps.jsx';
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

// ─── Top crops for icon-first tap selection ─────────────────
const TOP_CROPS = [
  { code: 'MAIZE',   label: 'Maize',   icon: '\uD83C\uDF3D' },
  { code: 'RICE',    label: 'Rice',    icon: '\uD83C\uDF3E' },
  { code: 'BEAN',    label: 'Beans',   icon: '\uD83E\uDED8' },
  { code: 'COFFEE',  label: 'Coffee',  icon: '\u2615' },
  { code: 'CASSAVA', label: 'Cassava', icon: '\uD83E\uDD54' },
  { code: 'BANANA',  label: 'Banana',  icon: '\uD83C\uDF4C' },
  { code: 'WHEAT',   label: 'Wheat',   icon: '\uD83C\uDF3E' },
  { code: 'SORGHUM', label: 'Sorghum', icon: '\uD83C\uDF3F' },
  { code: 'COCOA',   label: 'Cocoa',   icon: '\uD83E\uDD65' },
  { code: 'TOMATO',  label: 'Tomato',  icon: '\uD83C\uDF45' },
  { code: 'POTATO',  label: 'Potato',  icon: '\uD83E\uDD54' },
  { code: 'ONION',   label: 'Onion',   icon: '\uD83E\uDDC5' },
];

// ─── Farm size presets (tap-based) ──────────────────────────
// Internal values for backend; display is icon + label only
const SIZE_PRESETS = [
  { label: 'Small',  icon: '\uD83C\uDF31', acres: 1,  desc: '< 2 acres' },
  { label: 'Medium', icon: '\uD83C\uDF3E', acres: 5,  desc: '2-10 acres' },
  { label: 'Large',  icon: '\uD83C\uDF33', acres: 20, desc: '10+ acres' },
];

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
  const [showMoreCrops, setShowMoreCrops] = useState(false);
  const [showCustomSize, setShowCustomSize] = useState(false);
  const [sizePreset, setSizePreset] = useState(null); // 'Small' | 'Medium' | 'Large' | null

  // Track whether initial population from profile has happened.
  const formInitializedRef = useRef(false);

  useEffect(() => {
    if (!loading && !formInitializedRef.current) {
      formInitializedRef.current = true;

      if (draftRestored && draftForm.farmerName?.trim()) {
        console.log('[ProfileSetup] Restored draft, skipping profile population');
        // Restore size preset state if possible
        const existingSize = Number(draftForm.size);
        const matchedPreset = SIZE_PRESETS.find(p => p.acres === existingSize);
        if (matchedPreset) setSizePreset(matchedPreset.label);
        else if (existingSize > 0) setShowCustomSize(true);
        return;
      }

      let populated;
      if (isNewFarmMode) {
        populated = {
          ...initialForm,
          farmerName: profile?.farmerName ?? '',
          country: profile?.country ?? 'Ghana',
          sizeUnit: defaultUnitForCountry(profile?.country ?? 'Ghana'),
        };
      } else {
        const country = profile?.country ?? 'Ghana';
        populated = {
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
        };
        // Restore size preset state
        const existingSize = Number(populated.size);
        const matchedPreset = SIZE_PRESETS.find(p => p.acres === existingSize);
        if (matchedPreset) setSizePreset(matchedPreset.label);
        else if (existingSize > 0) setShowCustomSize(true);
      }
      setForm(populated);
      setDraftForm(populated);
      setFieldErrors(initialErrors);
      setSaveError('');
    }
  }, [profile, loading, isNewFarmMode, draftRestored, draftForm, setDraftForm]);

  useEffect(() => {
    if (!loading && nameInputRef.current && !form.farmerName) {
      nameInputRef.current.focus();
    }
  }, [loading, form.farmerName]);

  useEffect(() => {
    if (autoVoice && !loading) {
      speakText(t('setup.voiceWelcome'), languageToVoiceCode(language));
    }
  }, [autoVoice, language, loading]);

  useEffect(() => {
    if (syncStatus === 'queued') setInfoMessage(t('setup.savedOffline'));
    else if (syncStatus === 'synced') setInfoMessage(t('setup.savedSuccess'));
    else if (syncStatus === 'failed') setInfoMessage(t('setup.syncRetry'));
  }, [syncStatus, language]);

  // ─── Shared field validity checks ─────────────────────────
  const fieldChecks = useMemo(() => {
    const sizeNum = Number(form.size);
    const cropParsed = parseCropValue(form.cropType);
    return {
      farmerName: !!form.farmerName.trim(),
      farmName:   !!form.farmName.trim(),
      country:    !!form.country.trim(),
      location:   !!form.location.trim(),
      size:       !!form.size.trim() && !Number.isNaN(sizeNum) && sizeNum > 0,
      cropType:   !!form.cropType && (form.cropType.toUpperCase() !== 'OTHER' || !!cropParsed.customCropName) &&
                  (!cropParsed.isCustomCrop || !cropParsed.customCropName || cropParsed.customCropName.length >= 2),
    };
  }, [form]);

  // Step-based progress: count completed steps out of total
  const completedSteps = useMemo(() => Object.values(fieldChecks).filter(Boolean).length, [fieldChecks]);
  const totalSteps = Object.keys(fieldChecks).length;

  const completion = useMemo(() => {
    const values = Object.values(fieldChecks);
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [fieldChecks]);

  function updateField(key, value) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      setDraftForm(next);
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
    setSaveError('');
  }

  // ─── GPS with auto-detect country ─────────────────────────
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
      updateField('gpsLat', String(result.latitude));
      updateField('gpsLng', String(result.longitude));
      const label = [result.locality, result.region, result.country].filter(Boolean).join(', ');
      if (label) updateField('locationLabel', label);

      // Auto-fill country from GPS if not already set or still default
      if (result.country && (!form.country || form.country === 'Ghana')) {
        // Match GPS country name to our COUNTRY_OPTIONS list
        const matched = COUNTRY_OPTIONS.find(
          (name) => name.toLowerCase() === result.country.toLowerCase()
        );
        if (matched) {
          updateField('country', matched);
          if (!form.size) updateField('sizeUnit', defaultUnitForCountry(matched));
        }
      }

      // Auto-fill location from GPS if empty
      if (!form.location.trim() && (result.locality || result.region)) {
        const locLabel = [result.locality, result.region].filter(Boolean).join(', ');
        if (locLabel) updateField('location', locLabel);
      }

      setGpsSlowMsg('');
      safeTrackEvent('gps.success', {});
    } catch (err) {
      clearTimeout(slowTimer);
      const code = err?.code;
      if (code === 'permission_denied') {
        setGpsError(t('setup.gpsPermissionDenied'));
      } else if (code === 'timeout') {
        setGpsError(t('setup.gpsTimeout'));
      } else if (code === 'unavailable') {
        setGpsError(t('setup.gpsSignalWeak'));
      } else {
        setGpsError(t('location.gpsFallback'));
      }
      setGpsSlowMsg('');
      safeTrackEvent('gps.failed', { code });
      console.warn('[ProfileSetup] GPS failed:', { code, message: err?.message });
    } finally {
      setLoadingGPS(false);
    }
  }

  // ─── Size preset handlers ─────────────────────────────────
  function selectSizePreset(preset) {
    setSizePreset(preset.label);
    setShowCustomSize(false);
    updateField('size', String(preset.acres));
    updateField('sizeUnit', 'ACRE');
  }

  function enableCustomSize() {
    setSizePreset(null);
    setShowCustomSize(true);
    // Keep current size value if any
  }

  // ─── Validation (only on submit) ──────────────────────────
  function validateBeforeSubmit() {
    const errors = { ...initialErrors };
    let hasError = false;

    if (!fieldChecks.farmerName) { errors.farmerName = t('setup.farmerNameRequired'); hasError = true; }
    if (!fieldChecks.farmName)   { errors.farmName = t('setup.farmNameRequired'); hasError = true; }
    if (!fieldChecks.country)    { errors.country = t('setup.countryRequired'); hasError = true; }
    if (!fieldChecks.location)   { errors.location = t('setup.locationRequired'); hasError = true; }
    if (!fieldChecks.size) {
      if (!form.size.trim()) { errors.size = t('setup.sizeRequired'); hasError = true; }
      else { errors.size = t('setup.sizeInvalid'); hasError = true; }
    }
    if (!fieldChecks.cropType) {
      if (!form.cropType) { errors.cropType = t('setup.cropRequired'); hasError = true; }
      else {
        const cropParsed = parseCropValue(form.cropType);
        if (cropParsed.isCustomCrop && !cropParsed.customCropName) {
          errors.cropType = t('crop.enterYourCrop'); hasError = true;
        } else if (cropParsed.isCustomCrop && cropParsed.customCropName && cropParsed.customCropName.length < 2) {
          errors.cropType = t('crop.enterYourCrop'); hasError = true;
        }
      }
    }

    console.log('[ProfileSetup] Validation:', { fieldChecks, hasError, errors: hasError ? errors : 'none' });
    return { errors, hasError };
  }

  // ─── Save ─────────────────────────────────────────────────
  async function handleSave() {
    if (submitGuardRef.current) return;

    console.log('Save Farm Profile clicked');
    console.log('Submitting farm profile:', JSON.stringify(form));
    console.log('[ProfileSetup] Field checks:', JSON.stringify(fieldChecks));

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

      if (result?.offline) {
        console.log('[ProfileSetup] Save queued for offline sync');
        setSaveError(t('setup.savedOffline') || 'Saved locally. Will sync when back online.');
        return;
      }

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
        const newProfile = result.profile || result;
        if (newProfile?.id) {
          try { await switchFarm(newProfile.id); } catch { /* non-blocking */ }
        }
        await refreshFarms();
        navigate('/dashboard');
      } else {
        if (!form.experienceLevel) {
          navigate('/onboarding/farmer-type');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('Farm profile submission error:', error.status, error.message, JSON.stringify(error.fieldErrors), 'form was:', JSON.stringify(form));
      if (error.message === '__SAVE_TIMEOUT__') {
        setSaveError(t('setup.saveTimeout') || 'Save timed out. Please try again.');
        trackPilotEvent('setup_failed', { reason: 'timeout' });
        safeTrackEvent('profile.save_timeout', {});
      } else {
        if (error.fieldErrors && Object.keys(error.fieldErrors).length) {
          setFieldErrors((prev) => ({ ...prev, ...error.fieldErrors }));
        }
        setSaveError(error.message || t('setup.saveFailed') || 'Failed to save. Please try again.');
        trackPilotEvent('setup_failed', { reason: error.message, status: error.status });
        safeTrackEvent('profile.save_failed', { error: error.message, status: error.status });
      }
    } finally {
      setSaving(false);
      setSubmitting(false);
      submitGuardRef.current = false;
    }
  }

  // ─── Step-based onboarding for first-time farmers ──────────
  // Show lightweight 5-step wizard when:
  // 1. Not loading
  // 2. No existing profile (truly first-time)
  // 3. Not in "add new farm" mode (which is for existing users)
  const [showStepFlow, setShowStepFlow] = useState(true);
  const isFirstTimeUser = !loading && !profile && !isNewFarmMode;

  async function handleOnboardingComplete(data) {
    // Map OnboardingSteps output → ProfileSetup form fields
    const mapped = {
      ...initialForm,
      farmerName: data.farmName || '', // farmName used as farmer name in step flow
      farmName: data.farmName || '',
      country: data.country || 'Ghana',
      location: data.locationName || '',
      size: String(data.farmSizeAcres || 5),
      sizeUnit: defaultUnitForCountry(data.country || 'Ghana'),
      cropType: (data.crop || '').toUpperCase(),
      gpsLat: data.gpsLat ? String(data.gpsLat) : '',
      gpsLng: data.gpsLng ? String(data.gpsLng) : '',
      locationLabel: data.locationName || '',
      experienceLevel: data.experienceLevel || '',
    };
    // Populate form and auto-submit
    setForm(mapped);
    setDraftForm(mapped);
    // Switch to form view briefly for submission
    setShowStepFlow(false);

    // Auto-save via createNewFarm
    try {
      setSubmitting(true);
      setSaving(true);
      const result = await createNewFarm(mapped);
      clearDraft();
      trackPilotEvent('setup_completed', { hasGps: !!mapped.gpsLat, flow: 'onboarding_steps' });
      safeTrackEvent('profile.onboarding_steps_completed', { crop: mapped.cropType });
      if (result?.profile?.id) {
        try { await switchFarm(result.profile.id); } catch {}
      }
      await refreshFarms();
      navigate('/dashboard');
    } catch (err) {
      // If auto-save fails, show the full form pre-populated so farmer can retry
      setSaveError(err.message || t('setup.saveFailed'));
    } finally {
      setSubmitting(false);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={S.page}>
        <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)' }}>{t('setup.loading')}</div>
      </div>
    );
  }

  // Show step-based onboarding for first-time users
  if (isFirstTimeUser && showStepFlow) {
    return (
      <OnboardingSteps
        onComplete={handleOnboardingComplete}
        onCancel={() => setShowStepFlow(false)}
      />
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Voice guide */}
        <VoiceBar voiceKey="setup.welcome" compact />

        {/* Header with step progress */}
        <div style={S.card}>
          <div style={S.headerRow}>
            <div>
              <h1 style={S.pageTitle}>{t('setup.title')}</h1>
              <p style={S.pageSubtitle}>{t('setup.subtitle')}</p>
            </div>
          </div>

          {/* Step-based progress */}
          <div style={S.stepRow}>
            {Object.entries(fieldChecks).map(([key, done], i) => (
              <div key={key} style={{ ...S.stepDot, background: done ? '#22C55E' : 'rgba(255,255,255,0.15)' }} />
            ))}
          </div>
          <p style={S.progressText}>{completedSteps} / {totalSteps} {t('setup.completed')}</p>

          {profile?.farmerUuid && (
            <p style={S.uuidText}>{t('farmerUuid')}: {profile.farmerUuid}</p>
          )}
          {infoMessage && <p style={S.infoMsg}>{infoMessage}</p>}
        </div>

        {/* ─── Location (GPS first) ───────────────────────── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={S.sectionIcon}>{'\uD83D\uDCCD'}</span>
            <span style={S.sectionTitle}>{t('location.farmLocation')}</span>
          </div>

          {form.gpsLat ? (
            <div style={S.gpsSuccess}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{'\u2705'}</span>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#22C55E' }}>
                    {t('location.captured')}
                  </div>
                  {form.locationLabel && (
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.15rem', margin: 0 }}>
                      {form.locationLabel}
                    </p>
                  )}
                </div>
              </div>
              <button type="button" onClick={handleGetGPS} disabled={loadingGPS} style={S.gpsUpdateBtn}>
                {loadingGPS ? t('location.updating') : t('location.update')}
              </button>
            </div>
          ) : (
            <button
              type="button" onClick={handleGetGPS} disabled={loadingGPS}
              style={{ ...S.gpsBtnLarge, ...(loadingGPS ? { opacity: 0.6 } : {}) }}
            >
              <span style={{ fontSize: '1.5rem' }}>{'\uD83D\uDCF1'}</span>
              <span>{loadingGPS ? t('location.detecting') : t('location.getMyLocation')}</span>
            </button>
          )}

          {gpsError && <p style={S.gpsSoftMsg}>{gpsError}</p>}
          {gpsSlowMsg && !gpsError && <p style={S.gpsSoftMsg}>{gpsSlowMsg}</p>}

          {/* Location text fallback */}
          <div style={{ marginTop: '0.75rem' }}>
            <label style={S.labelSmall}>{t('setup.location')}</label>
            <input
              value={form.location}
              onChange={(e) => updateField('location', e.target.value)}
              placeholder={t('setup.locationPlaceholder')}
              style={S.input}
            />
            {fieldErrors.location && <p style={S.fieldError}>{fieldErrors.location}</p>}
          </div>

          {/* Country — auto-detected, shown as small selector */}
          {form.country ? (
            <div style={S.countryPill}>
              <span style={{ fontSize: '0.85rem' }}>{'\uD83C\uDF0D'}</span>
              <span style={{ flex: 1, fontSize: '0.85rem' }}>{form.country}</span>
              <button
                type="button"
                onClick={() => updateField('country', '')}
                style={S.changeBtn}
              >
                Change
              </button>
            </div>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              <label style={S.labelSmall}>{t('setup.country')}</label>
              <select
                value={form.country}
                onChange={(e) => {
                  const newCountry = e.target.value;
                  updateField('country', newCountry);
                  if (!form.size) updateField('sizeUnit', defaultUnitForCountry(newCountry));
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
          )}
        </div>

        {/* ─── Farmer & Farm Name ─────────────────────────── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={S.sectionIcon}>{'\uD83D\uDE4B'}</span>
            <span style={S.sectionTitle}>{t('setup.yourName')}</span>
          </div>
          <input
            ref={nameInputRef}
            value={form.farmerName}
            onChange={(e) => updateField('farmerName', e.target.value)}
            placeholder={t('setup.yourName')}
            style={S.input}
          />
          {fieldErrors.farmerName && <p style={S.fieldError}>{fieldErrors.farmerName}</p>}

          <div style={{ marginTop: '0.75rem' }}>
            <label style={S.labelSmall}>{t('setup.farmName')}</label>
            <input
              value={form.farmName}
              onChange={(e) => updateField('farmName', e.target.value)}
              placeholder={t('setup.farmName')}
              style={S.input}
            />
            {fieldErrors.farmName && <p style={S.fieldError}>{fieldErrors.farmName}</p>}
          </div>
        </div>

        {/* ─── Crop Selection (icon grid) ─────────────────── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={S.sectionIcon}>{'\uD83C\uDF3E'}</span>
            <span style={S.sectionTitle}>{t('setup.mainCrop')}</span>
          </div>

          <div style={S.cropGrid}>
            {TOP_CROPS.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { updateField('cropType', c.code); setShowMoreCrops(false); }}
                style={{
                  ...S.cropChip,
                  ...(form.cropType === c.code ? S.cropChipActive : {}),
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{c.icon}</span>
                <span style={S.cropLabel}>{c.label}</span>
              </button>
            ))}
          </div>

          {/* Show more crops toggle */}
          {!showMoreCrops ? (
            <button
              type="button"
              onClick={() => setShowMoreCrops(true)}
              style={S.moreBtn}
            >
              {form.cropType && !TOP_CROPS.find(c => c.code === form.cropType)
                ? `Selected: ${parseCropValue(form.cropType).cropName || form.cropType} \u2014 Tap to change`
                : 'More crops...'}
            </button>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              <CropSelect
                value={form.cropType}
                onChange={(code) => { updateField('cropType', code); setShowMoreCrops(false); }}
                countryCode={form.country}
                placeholder={t('setup.selectCrop')}
                required
              />
              <button type="button" onClick={() => setShowMoreCrops(false)} style={S.collapseBtnSmall}>
                Close
              </button>
            </div>
          )}
          {fieldErrors.cropType && <p style={S.fieldError}>{fieldErrors.cropType}</p>}
        </div>

        {/* ─── Farm Size (tap presets + custom) ───────────── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={S.sectionIcon}>{'\uD83D\uDCCF'}</span>
            <span style={S.sectionTitle}>{t('setup.farmSize')}</span>
          </div>

          <div style={S.sizeGrid}>
            {SIZE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => selectSizePreset(p)}
                style={{
                  ...S.sizeChip,
                  ...(sizePreset === p.label ? S.sizeChipActive : {}),
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{p.icon}</span>
                <span style={S.sizeChipLabel}>{p.label}</span>
                <span style={S.sizeChipDesc}>{p.desc}</span>
              </button>
            ))}
          </div>

          {/* Custom size option */}
          {!showCustomSize && !sizePreset && (
            <button type="button" onClick={enableCustomSize} style={S.moreBtn}>
              Enter exact size
            </button>
          )}
          {!showCustomSize && sizePreset && (
            <button type="button" onClick={enableCustomSize} style={S.moreBtn}>
              Or enter exact size
            </button>
          )}

          {showCustomSize && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={S.sizeRow}>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.size}
                  onChange={(e) => { updateField('size', e.target.value); setSizePreset(null); }}
                  placeholder={t('setup.farmSizePlaceholder')}
                  style={{ ...S.input, flex: 1 }}
                />
                {/* Segmented unit toggle instead of dropdown */}
                <div style={S.unitToggle}>
                  {UNIT_OPTIONS.map((u) => (
                    <button
                      key={u.value}
                      type="button"
                      onClick={() => updateField('sizeUnit', u.value)}
                      style={{
                        ...S.unitToggleBtn,
                        ...(form.sizeUnit === u.value ? S.unitToggleBtnActive : {}),
                      }}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>
              {form.size && form.sizeUnit !== 'HECTARE' && (
                <p style={S.conversionHint}>
                  {'\u2248'} {toHectares(parseFloat(form.size), form.sizeUnit)?.toFixed(2) || '\u2014'} {t('setup.hectares')}
                </p>
              )}
            </div>
          )}
          {fieldErrors.size && <p style={S.fieldError}>{fieldErrors.size}</p>}
        </div>

        {/* ─── Experience Level ────────────────────────────── */}
        <div style={S.card}>
          <div style={S.sectionHeader}>
            <span style={S.sectionIcon}>{'\uD83E\uDDD1\u200D\uD83C\uDF3E'}</span>
            <span style={S.sectionTitle}>{t('guided.experienceQuestion')}</span>
          </div>
          <div style={S.experienceRow}>
            <button
              type="button"
              onClick={() => updateField('experienceLevel', 'new')}
              style={{
                ...S.experienceBtn,
                ...(form.experienceLevel === 'new' ? S.experienceBtnActive : {}),
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>{'\uD83C\uDF31'}</span>
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
              <span style={{ fontSize: '1.3rem' }}>{'\uD83E\uDDD1\u200D\uD83C\uDF3E'}</span>
              <span>{t('guided.experienced')}</span>
            </button>
          </div>
        </div>

        {/* ─── Save bar ───────────────────────────────────── */}
        {saveError && (
          <div style={S.saveErrorBox}>
            <p style={S.saveErrorText}>{saveError}</p>
          </div>
        )}

        <div style={S.btnRow}>
          <button type="button" onClick={() => navigate('/dashboard')} style={S.backBtn}>
            {t('common.back')}
          </button>
          <button
            type="button" onClick={handleSave} disabled={submitting}
            style={{ ...S.saveBtn, ...(submitting ? { opacity: 0.6 } : {}) }}
          >
            {submitting ? t('setup.saving') : t('setup.saveFarm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
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
    gap: '1rem',
    paddingTop: '0.5rem',
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
    gap: '0.75rem',
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
  // Step dots progress
  stepRow: {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.25rem',
  },
  stepDot: {
    flex: 1,
    height: '6px',
    borderRadius: '3px',
    transition: 'background 0.3s ease',
  },
  progressText: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    marginTop: '0.25rem',
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
  // Section headers
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sectionIcon: {
    fontSize: '1.2rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
  },
  labelSmall: {
    display: 'block',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '0.25rem',
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
    minHeight: '48px',
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
    minHeight: '48px',
    cursor: 'pointer',
    appearance: 'auto',
  },
  fieldError: {
    fontSize: '0.8rem',
    color: '#FCA5A5',
    marginTop: '0.25rem',
    margin: '0.25rem 0 0',
  },
  // Crop grid
  cropGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.5rem',
  },
  cropChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.75rem 0.25rem',
    borderRadius: '12px',
    background: '#111827',
    border: '2px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    minHeight: '64px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  cropChipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
    color: '#FFFFFF',
  },
  cropLabel: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textAlign: 'center',
    lineHeight: 1.2,
  },
  moreBtn: {
    marginTop: '0.25rem',
    padding: '0.6rem 1rem',
    background: 'transparent',
    border: '1px dashed rgba(255,255,255,0.15)',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    textAlign: 'center',
    minHeight: '40px',
    WebkitTapHighlightColor: 'transparent',
  },
  collapseBtnSmall: {
    marginTop: '0.5rem',
    padding: '0.4rem 0.75rem',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  // Size presets
  sizeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
  },
  sizeChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.2rem',
    padding: '0.75rem 0.5rem',
    borderRadius: '12px',
    background: '#111827',
    border: '2px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer',
    minHeight: '72px',
    WebkitTapHighlightColor: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  },
  sizeChipActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.12)',
    color: '#FFFFFF',
  },
  sizeChipLabel: {
    fontSize: '0.85rem',
    fontWeight: 700,
  },
  sizeChipDesc: {
    fontSize: '0.65rem',
    color: 'rgba(255,255,255,0.4)',
  },
  sizeRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'stretch',
  },
  unitToggle: {
    display: 'flex',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.1)',
    flexShrink: 0,
  },
  unitToggleBtn: {
    padding: '0.75rem 1rem',
    background: '#111827',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '48px',
    transition: 'background 0.15s, color 0.15s',
    WebkitTapHighlightColor: 'transparent',
  },
  unitToggleBtnActive: {
    background: '#22C55E',
    color: '#fff',
  },
  conversionHint: {
    fontSize: '0.75rem',
    color: '#86EFAC',
    marginTop: '0.35rem',
  },
  // Experience
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
    minHeight: '48px',
    transition: 'border-color 0.2s, background 0.2s',
    WebkitTapHighlightColor: 'transparent',
  },
  experienceBtnActive: {
    borderColor: '#22C55E',
    background: 'rgba(34,197,94,0.1)',
    color: '#FFFFFF',
  },
  // GPS
  gpsBtnLarge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.6rem',
    width: '100%',
    padding: '1rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    border: 'none',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
    WebkitTapHighlightColor: 'transparent',
  },
  gpsSuccess: {
    padding: '0.75rem',
    borderRadius: '12px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  gpsUpdateBtn: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#86EFAC',
    background: 'transparent',
    border: '1px solid rgba(134,239,172,0.3)',
    borderRadius: '8px',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    minHeight: '36px',
    flexShrink: 0,
  },
  gpsSoftMsg: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.55)',
    marginTop: '0.5rem',
    lineHeight: 1.5,
  },
  // Country pill
  countryPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 0.75rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    marginTop: '0.5rem',
  },
  changeBtn: {
    padding: '0.25rem 0.6rem',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    minHeight: '28px',
  },
  // Save
  saveErrorBox: {
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(252,165,165,0.08)',
    border: '1px solid rgba(252,165,165,0.2)',
  },
  saveErrorText: {
    fontSize: '0.875rem',
    color: '#FCA5A5',
    margin: 0,
  },
  btnRow: {
    display: 'flex',
    gap: '0.75rem',
    position: 'sticky',
    bottom: 0,
    background: '#0F172A',
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
    minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
  },
  saveBtn: {
    flex: 2,
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    padding: '1rem',
    fontWeight: 700,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    minHeight: '52px',
    boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
    WebkitTapHighlightColor: 'transparent',
  },
};
