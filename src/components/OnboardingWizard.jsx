import React, { useState, useEffect, useCallback, useRef } from 'react';
import CropSelect from './CropSelect.jsx';
import TapSelector from './TapSelector.jsx';
import CountrySelect from './CountrySelect.jsx';
import LocationDetect from './LocationDetect.jsx';
import { useDraft } from '../utils/useDraft.js';
import { compressImage } from '../utils/imageCompress.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { UNIT_OPTIONS, computeLandSizeFields } from '../utils/landSize.js';
import { getCountryRecommendedCodes } from '../utils/cropRecommendations.js';
import { speak, stopSpeech, isVoiceAvailable, VOICE_LANGUAGES } from '../utils/voiceGuide.js';
import { trackVoiceStepCompleted } from '../utils/voiceAnalytics.js';

// ─── Step definitions ────────────────────────────────────────
const STEP_KEYS = ['welcome', 'farmName', 'country', 'crop', 'farmSize', 'gender', 'age', 'location', 'photo', 'processing'];
const TOTAL_USER_STEPS = 8; // steps the user interacts with (excluding welcome + processing)

// ─── Tap option sets ─────────────────────────────────────────
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male', icon: '\uD83D\uDC68\u200D\uD83C\uDF3E' },
  { value: 'female', label: 'Female', icon: '\uD83D\uDC69\u200D\uD83C\uDF3E' },
  { value: 'other', label: 'Other', icon: '\uD83E\uDDD1' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say', icon: '\u2014' },
];

const AGE_OPTIONS = [
  { value: 'under_25', label: 'Under 25' },
  { value: '25_35', label: '25 \u2013 35' },
  { value: '36_50', label: '36 \u2013 50' },
  { value: 'over_50', label: 'Over 50' },
];

// Farm size categories — subtitles adapt to selected unit
const FARM_SIZE_DEFS = {
  small:  { label: 'Small', icon: '\uD83C\uDF31', acre: 'Under 2 acres', hectare: 'Under 1 hectare', defaultVal: 1 },
  medium: { label: 'Medium', icon: '\uD83C\uDF3E', acre: '2 \u2013 10 acres', hectare: '1 \u2013 4 hectares', defaultVal: 5 },
  large:  { label: 'Large', icon: '\uD83C\uDFE1', acre: 'Over 10 acres', hectare: 'Over 4 hectares', defaultVal: 15 },
};
const FARM_SIZE_KEYS = ['small', 'medium', 'large'];

const STAGE_OPTIONS = [
  { value: 'planting', label: 'Planting', icon: '\uD83C\uDF31' },
  { value: 'growing', label: 'Growing', icon: '\uD83C\uDF3F' },
  { value: 'flowering', label: 'Flowering', icon: '\uD83C\uDF3C' },
  { value: 'harvest', label: 'Harvest', icon: '\uD83C\uDF3E' },
];

// Top crops shown as quick-tap buttons before the full CropSelect
const TOP_CROPS = [
  { code: 'MAIZE', label: 'Maize', icon: '\uD83C\uDF3D' },
  { code: 'RICE', label: 'Rice', icon: '\uD83C\uDF3E' },
  { code: 'BEAN', label: 'Beans', icon: '\uD83E\uDED8' },
  { code: 'COFFEE', label: 'Coffee', icon: '\u2615' },
  { code: 'CASSAVA', label: 'Cassava', icon: '\uD83E\uDD54' },
  { code: 'BANANA', label: 'Banana', icon: '\uD83C\uDF4C' },
  { code: 'WHEAT', label: 'Wheat', icon: '\uD83C\uDF3E' },
  { code: 'SORGHUM', label: 'Sorghum', icon: '\uD83C\uDF3F' },
  { code: 'TOMATO', label: 'Tomato', icon: '\uD83C\uDF45' },
  { code: 'POTATO', label: 'Potato', icon: '\uD83E\uDD54' },
  { code: 'TEA', label: 'Tea', icon: '\uD83C\uDF3F' },
  { code: 'SWEET_POTATO', label: 'Sweet Potato', icon: '\uD83C\uDF60' },
  { code: 'MANGO', label: 'Mango', icon: '\uD83E\uDD6D' },
  { code: 'GROUNDNUT', label: 'Groundnut', icon: '\uD83E\uDD5C' },
  { code: 'SUGARCANE', label: 'Sugarcane', icon: '\uD83C\uDF3F' },
  { code: 'COTTON', label: 'Cotton', icon: '\u2601\uFE0F' },
];

// Inject spinner keyframe once
if (typeof document !== 'undefined' && !document.getElementById('farroway-spin')) {
  const style = document.createElement('style');
  style.id = 'farroway-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}

// ─── Operational logging (fire-and-forget) ───────────────────
function logOnboarding(event, detail = {}) {
  try {
    const entry = { ts: new Date().toISOString(), event, ...detail };
    const LOG_KEY = 'farroway:onboarding_log';
    const prev = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    prev.push(entry);
    if (prev.length > 50) prev.splice(0, prev.length - 50);
    localStorage.setItem(LOG_KEY, JSON.stringify(prev));
  } catch { /* storage full or unavailable */ }
}

const INITIAL_FORM = {
  farmName: '', farmSizeAcres: '', farmSizeCategory: '', landSizeUnit: 'ACRE',
  locationName: '', crop: '', stage: 'planting',
  latitude: null, longitude: null,
  countryCode: '', gender: '', ageGroup: '',
};

export default function OnboardingWizard({ userName, countryCode, onComplete }) {
  // ─── Draft persistence ─────────────────────────────────────
  const { state: draft, setState: setDraft, clearDraft, draftRestored } = useDraft(
    'onboarding-wizard',
    { step: 0, form: { ...INITIAL_FORM, countryCode: countryCode || '' } }
  );

  const maxInteractiveStep = STEP_KEYS.length - 2; // exclude processing
  const safeDraftStep = (draft.step >= 0 && draft.step <= maxInteractiveStep) ? draft.step : 0;
  const safeDraftForm = draft.form?.farmName !== undefined
    ? { ...INITIAL_FORM, countryCode: countryCode || '', ...draft.form }
    : { ...INITIAL_FORM, countryCode: countryCode || '' };

  const [step, setStepRaw] = useState(safeDraftStep);
  const [form, setFormRaw] = useState(safeDraftForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState(draftRestored ? 'restored' : null);
  const [networkError, setNetworkError] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showCropSearch, setShowCropSearch] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en');
  const [voiceEnabled, setVoiceEnabled] = useState(() => isVoiceAvailable());
  const voicePlayedRef = useRef({}); // track auto-played steps
  const submitGuardRef = useRef(false);
  const startTimeRef = useRef(Date.now());

  const currentStep = STEP_KEYS[step];

  // Map onboarding step names → dot-notation voice keys
  const ONBOARDING_VOICE_KEY = {
    welcome: 'onboarding.welcome',
    farmName: 'onboarding.farmName',
    country: 'onboarding.country',
    crop: 'onboarding.crop',
    farmSize: 'onboarding.landSize',
    gender: 'onboarding.gender',
    age: 'onboarding.ageGroup',
    location: 'onboarding.region',
    photo: 'onboarding.photoOptional',
    processing: 'onboarding.processing',
  };
  const currentVoiceKey = ONBOARDING_VOICE_KEY[currentStep] || null;

  // ─── Voice auto-play on step change ───────────────────────
  useEffect(() => {
    if (!voiceEnabled || !currentVoiceKey) return;
    // Stop previous speech on every step change
    stopSpeech();
    // Auto-play once per step per session
    if (!voicePlayedRef.current[currentVoiceKey]) {
      voicePlayedRef.current[currentVoiceKey] = true;
      // Small delay so the UI renders first
      const t = setTimeout(() => speak(currentVoiceKey, voiceLang), 400);
      return () => clearTimeout(t);
    }
  }, [currentVoiceKey, voiceEnabled, voiceLang]);

  // Stop speech on unmount (navigation away)
  useEffect(() => () => stopSpeech(), []);

  const handleReplay = () => {
    if (voiceEnabled && currentVoiceKey) speak(currentVoiceKey, voiceLang);
  };

  // ─── Step / form sync to draft ─────────────────────────────
  const setStep = useCallback((s) => {
    const nextStep = typeof s === 'function' ? s(step) : s;
    setStepRaw(nextStep);
    setDraft(prev => ({ ...prev, step: nextStep }));
    logOnboarding('step_entered', { step: STEP_KEYS[nextStep] });
  }, [step, setDraft]);

  const setForm = useCallback((updater) => {
    setFormRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setDraft(d => ({ ...d, form: next }));
      setSaveStatus('saving');
      return next;
    });
  }, [setDraft]);

  // Brief saved flash
  useEffect(() => {
    if (saveStatus === 'saving') {
      const t = setTimeout(() => setSaveStatus('saved'), 300);
      const t2 = setTimeout(() => setSaveStatus(null), 2000);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [saveStatus]);

  // Track start
  useEffect(() => {
    trackPilotEvent('onboarding_started', { restored: !!draftRestored, step: STEP_KEYS[safeDraftStep] });
  }, []);

  // Draft restored banner timeout
  useEffect(() => {
    if (draftRestored) {
      logOnboarding('draft_restored', { step: STEP_KEYS[draft.step], form: draft.form });
      const t = setTimeout(() => setSaveStatus(null), 8000);
      return () => clearTimeout(t);
    }
  }, []);

  // ─── Browser back button ───────────────────────────────────
  const prevStepRef = useRef(step);
  useEffect(() => {
    const handlePopState = () => setStep(s => Math.max(0, s - 1));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (step > prevStepRef.current && step > 0) {
      window.history.pushState({ onboardingStep: step }, '');
    }
    prevStepRef.current = step;
  }, [step]);

  // ─── Country auto-detect on mount ──────────────────────────
  useEffect(() => {
    if (form.countryCode) return; // already set via prop or draft
    // Try timezone-based detection as lightweight fallback
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const tzLower = tz.toLowerCase();
      if (tzLower.includes('nairobi')) setForm(f => ({ ...f, countryCode: 'KE' }));
      else if (tzLower.includes('dar_es_salaam')) setForm(f => ({ ...f, countryCode: 'TZ' }));
      else if (tzLower.includes('kampala')) setForm(f => ({ ...f, countryCode: 'UG' }));
      else if (tzLower.includes('lagos')) setForm(f => ({ ...f, countryCode: 'NG' }));
      else if (tzLower.includes('johannesburg') || tzLower.includes('harare')) setForm(f => ({ ...f, countryCode: 'ZA' }));
      else if (tzLower.includes('addis_ababa')) setForm(f => ({ ...f, countryCode: 'ET' }));
      else if (tzLower.includes('accra')) setForm(f => ({ ...f, countryCode: 'GH' }));
    } catch { /* timezone API unavailable */ }
  }, []);

  // ─── Computed helpers ──────────────────────────────────────
  const progressNum = Math.min(step, TOTAL_USER_STEPS); // 0-based, for dots
  const progressPercent = step <= 0 ? 0 : Math.round((progressNum / TOTAL_USER_STEPS) * 100);

  // Country-specific top crops — show 8 for better coverage
  const countryTopCodes = getCountryRecommendedCodes(form.countryCode);
  const topCropButtons = countryTopCodes.length > 0
    ? countryTopCodes.slice(0, 8).map(code => {
      const found = TOP_CROPS.find(c => c.code === code);
      return found || { code, label: code.charAt(0) + code.slice(1).toLowerCase(), icon: '\uD83C\uDF3F' };
    })
    : TOP_CROPS.slice(0, 8);

  // ─── Navigation helpers ────────────────────────────────────
  const goNext = () => {
    if (voiceEnabled && currentVoiceKey) trackVoiceStepCompleted(currentVoiceKey, voiceLang);
    setStep(s => s + 1);
  };
  const goBack = () => setStep(s => Math.max(0, s - 1));

  // ─── Photo handling ────────────────────────────────────────
  const handlePhotoSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setError('');
    const compressed = await compressImage(f, { maxWidth: 800, quality: 0.8 });
    setPhotoFile(compressed);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(compressed);
  };

  // ─── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (submitGuardRef.current) return;

    // ── Pre-submit validation — catch missing fields before network call ──
    const missing = [];
    if (!form.crop) missing.push('crop');
    if (!form.farmSizeAcres && !form.farmSizeCategory) missing.push('land size');
    if (!form.countryCode) missing.push('country');
    if (missing.length > 0) {
      setError(`Please complete: ${missing.join(', ')}. Go back to fill in missing fields.`);
      return;
    }

    submitGuardRef.current = true;

    const processingIdx = STEP_KEYS.indexOf('processing');
    setStep(processingIdx);
    setSubmitting(true);
    setNetworkError(false);
    setError('');

    try {
      // Derive numeric farm size from category if not entered explicitly
      let sizeValue = form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : null;
      let sizeUnit = form.landSizeUnit || 'ACRE';
      if (!sizeValue && form.farmSizeCategory) {
        const def = FARM_SIZE_DEFS[form.farmSizeCategory];
        if (def) {
          // Default values are in acres; convert if hectare is selected
          sizeValue = sizeUnit === 'HECTARE'
            ? Math.round(def.defaultVal * 0.404686 * 10) / 10
            : def.defaultVal;
        }
      }
      const ls = sizeValue ? computeLandSizeFields(sizeValue, sizeUnit) : {};
      const sizeAcres = ls.landSizeHectares != null ? Math.round(ls.landSizeHectares / 0.404686 * 10) / 10 : sizeValue;

      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);

      await onComplete({
        farmName: form.farmName.trim(),
        farmSizeAcres: sizeAcres,
        landSizeValue: ls.landSizeValue ?? null,
        landSizeUnit: ls.landSizeUnit ?? null,
        landSizeHectares: ls.landSizeHectares ?? null,
        locationName: form.locationName.trim() || null,
        latitude: form.latitude || null,
        longitude: form.longitude || null,
        crop: form.crop,
        stage: form.stage,
        photoFile: photoFile || null,
        gender: form.gender || null,
        ageGroup: form.ageGroup || null,
        countryCode: form.countryCode || null,
        farmSizeCategory: form.farmSizeCategory || null,
      });

      clearDraft();
      logOnboarding('onboarding_completed', { elapsed });
      trackPilotEvent('onboarding_completed', { farmName: form.farmName.trim(), crop: form.crop, elapsed });
      setSubmitting(false);
      setSubmitSuccess(true);
    } catch (err) {
      // Stay on processing step so ProcessingStep shows the error UI with retry/back
      setSubmitting(false);
      submitGuardRef.current = false;
      const isNetwork = !err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error' || !navigator.onLine);
      setNetworkError(isNetwork);
      const serverError = err?.response?.data?.error;
      const isValidation = err?.response?.status === 400;
      const msg = isNetwork
        ? 'No internet connection. Your data is saved \u2014 tap "Retry" when you\'re back online.'
        : isValidation && serverError
          ? `Validation error: ${serverError}`
          : serverError || err?.message || 'Something went wrong. Please try again.';
      setError(msg);
      logOnboarding('async_save_failed', { step: 'processing', error: msg, isNetwork });
    }
  };

  const handleReset = () => {
    setFormRaw({ ...INITIAL_FORM, countryCode: countryCode || '' });
    setStepRaw(0);
    setPhotoFile(null);
    setPhotoPreview(null);
    setError('');
    setFieldErrors({});
    clearDraft();
    setShowResetConfirm(false);
    setShowCropSearch(false);
    startTimeRef.current = Date.now();
    logOnboarding('onboarding_reset');
  };

  // ─── Render ────────────────────────────────────────────────
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        {/* ── Voice controls ── */}
        {voiceEnabled && (
          <div style={S.voiceBar}>
            <button
              type="button"
              onClick={handleReplay}
              style={S.listenBtn}
              aria-label="Listen again"
            >
              {'\uD83D\uDD0A'} Listen
            </button>
            <select
              value={voiceLang}
              onChange={e => { setVoiceLang(e.target.value); voicePlayedRef.current = {}; }}
              style={S.voiceLangSelect}
              aria-label="Voice language"
            >
              {VOICE_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { stopSpeech(); setVoiceEnabled(false); }}
              style={S.voiceMuteBtn}
              aria-label="Turn off voice"
            >
              {'\uD83D\uDD07'}
            </button>
          </div>
        )}
        {!voiceEnabled && isVoiceAvailable() && (
          <div style={S.voiceBar}>
            <button
              type="button"
              onClick={() => { setVoiceEnabled(true); voicePlayedRef.current = {}; }}
              style={S.listenBtn}
              aria-label="Turn on voice guide"
            >
              {'\uD83D\uDD08'} Enable Voice Guide
            </button>
          </div>
        )}

        {/* ── Progress bar + dots ── */}
        {step > 0 && step < STEP_KEYS.indexOf('processing') && (
          <div style={S.progressWrap}>
            <div style={S.progressBar}>
              <div style={{ ...S.progressFill, width: `${progressPercent}%` }} />
            </div>
            <div style={S.progressLabel}>
              Step {progressNum} of {TOTAL_USER_STEPS}
            </div>
          </div>
        )}

        {/* Draft restored banner */}
        {saveStatus === 'restored' && (
          <div style={S.draftBanner}>
            &#8635; <strong>Draft restored</strong> — your previous progress was saved.
            <button type="button" onClick={() => setSaveStatus(null)} style={S.dismissBtn}>Dismiss</button>
          </div>
        )}

        {/* Save status */}
        {saveStatus === 'saved' && step > 0 && step < STEP_KEYS.indexOf('processing') && (
          <div style={S.savedIndicator}>{'\u2713'} Draft saved</div>
        )}

        {/* ═══════════ STEP: Welcome ═══════════ */}
        {currentStep === 'welcome' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDC4B'}</div>
            <h2 style={S.title}>Welcome{userName ? `, ${userName}` : ''}!</h2>
            <p style={S.subtitle}>
              Set up your farm in under a minute.{'\n'}Just tap to answer each question.
            </p>
            <div style={S.timeEstimate}>
              <span style={S.timeIcon}>{'\u23F1\uFE0F'}</span> Takes about 60 seconds
            </div>
            <button onClick={goNext} style={S.primaryBtn}>Get Started</button>
          </div>
        )}

        {/* ═══════════ STEP: Farm Name ═══════════ */}
        {currentStep === 'farmName' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDFE1'}</div>
            <h2 style={S.title}>Name your farm</h2>
            <p style={S.subtitle}>What do you call your farm?</p>
            {error && <div style={S.errorBox}>{error}</div>}
            <div style={S.fieldWide}>
              <input
                value={form.farmName}
                onChange={e => { setForm(f => ({ ...f, farmName: e.target.value })); setFieldErrors(fe => ({ ...fe, farmName: undefined })); }}
                placeholder="e.g. Sunrise Farm"
                style={{
                  ...S.input,
                  borderColor: fieldErrors.farmName ? '#EF4444' : form.farmName.trim() ? '#22C55E' : '#374151',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                }}
                autoFocus
                autoComplete="off"
              />
              {fieldErrors.farmName && <div style={S.fieldError}>{fieldErrors.farmName}</div>}
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button
                onClick={() => {
                  if (!form.farmName.trim()) { setFieldErrors({ farmName: 'Give your farm a name' }); return; }
                  goNext();
                }}
                disabled={!form.farmName.trim()}
                style={{ ...S.primaryBtn, opacity: form.farmName.trim() ? 1 : 0.5 }}
              >Next</button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Country ═══════════ */}
        {currentStep === 'country' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF0D'}</div>
            <h2 style={S.title}>Where are you?</h2>
            <p style={S.subtitle}>Search or scroll to find your country</p>
            {form.countryCode && (
              <div style={S.autoDetectBadge} data-testid="country-auto-detected">
                {'\u2713'} Auto-detected — tap below to change
              </div>
            )}
            <div style={S.fieldWide}>
              <CountrySelect
                value={form.countryCode}
                onChange={(e) => setForm(f => ({ ...f, countryCode: e.target.value }))}
                className=""
                selectStyle={{
                  ...S.input,
                  fontSize: '1rem',
                  fontWeight: form.countryCode ? 600 : 400,
                  color: form.countryCode ? '#22C55E' : '#A1A1AA',
                }}
                inputStyle={{ ...S.input, marginBottom: '0.5rem', fontSize: '1rem' }}
                wrapperStyle={{ width: '100%' }}
              />
              {!form.countryCode && (
                <div style={{ fontSize: '0.75rem', color: '#71717A', textAlign: 'center', marginTop: '0.25rem' }}>
                  You can type to search, or tap the dropdown to scroll
                </div>
              )}
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.countryCode ? 'Next' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Crop ═══════════ */}
        {currentStep === 'crop' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF3E'}</div>
            <h2 style={S.title}>What do you grow?</h2>
            <p style={S.subtitle}>Tap your main crop</p>
            {error && <div style={S.errorBox}>{error}</div>}

            {/* Quick-tap top crops */}
            {!showCropSearch && (
              <div style={S.fieldWide}>
                <div style={S.topCropGrid}>
                  {topCropButtons.map(c => {
                    const isSelected = form.crop === c.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => { setForm(f => ({ ...f, crop: c.code })); setShowCropSearch(false); }}
                        style={{
                          ...S.topCropBtn,
                          borderColor: isSelected ? '#22C55E' : '#243041',
                          background: isSelected ? 'rgba(34,197,94,0.18)' : '#1E293B',
                        }}
                        aria-pressed={isSelected}
                      >
                        <span style={S.topCropIcon}>{c.icon}</span>
                        <span style={{ fontSize: '0.82rem', color: isSelected ? '#22C55E' : '#FFFFFF', fontWeight: isSelected ? 600 : 400 }}>
                          {c.label}
                        </span>
                        {isSelected && <span style={S.topCropCheck}>{'\u2713'}</span>}
                      </button>
                    );
                  })}
                  {/* "Other" quick-tap — always in the grid */}
                  <button
                    type="button"
                    onClick={() => setShowCropSearch(true)}
                    style={{
                      ...S.topCropBtn,
                      borderColor: '#374151',
                      background: '#1E293B',
                      borderStyle: 'dashed',
                    }}
                    data-testid="crop-other-tap"
                  >
                    <span style={S.topCropIcon}>{'\uD83C\uDF3F'}</span>
                    <span style={{ fontSize: '0.82rem', color: '#A1A1AA' }}>Other...</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCropSearch(true)}
                  style={S.searchAllBtn}
                  data-testid="crop-search-all"
                >
                  {'\uD83D\uDD0D'} Search all 60+ crops
                </button>
              </div>
            )}

            {/* Full searchable CropSelect */}
            {showCropSearch && (
              <div style={S.fieldWide}>
                <CropSelect
                  value={form.crop}
                  onChange={(v) => setForm(f => ({ ...f, crop: v }))}
                  countryCode={form.countryCode}
                  placeholder="Search crops..."
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCropSearch(false)}
                  style={{ ...S.showMoreBtn, marginTop: '0.5rem' }}
                >
                  Back to top crops {'\u25B4'}
                </button>
              </div>
            )}

            {/* Crop stage — only when crop is selected */}
            {form.crop && (
              <div style={{ ...S.fieldWide, marginTop: '0.75rem' }}>
                <TapSelector
                  label="Current stage"
                  options={STAGE_OPTIONS}
                  value={form.stage}
                  onChange={(v) => setForm(f => ({ ...f, stage: v }))}
                  columns={2}
                />
              </div>
            )}

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button
                onClick={() => {
                  if (!form.crop) { setFieldErrors({ crop: 'Select a crop' }); return; }
                  goNext();
                }}
                disabled={!form.crop}
                style={{ ...S.primaryBtn, opacity: form.crop ? 1 : 0.5 }}
              >Next</button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Farm Size ═══════════ */}
        {currentStep === 'farmSize' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDCCF'}</div>
            <h2 style={S.title}>How big is your farm?</h2>
            <p style={S.subtitle}>Choose your unit, then tap a size or enter exact</p>

            <div style={S.fieldWide}>
              {/* Unit selector — always visible */}
              <div style={S.unitRow} data-testid="land-unit-selector">
                <TapSelector
                  options={UNIT_OPTIONS.filter(o => o.value !== 'SQUARE_METER').map(o => ({ value: o.value, label: o.label }))}
                  value={form.landSizeUnit}
                  onChange={(v) => setForm(f => ({ ...f, landSizeUnit: v }))}
                  columns={2}
                  compact
                />
              </div>

              {/* Quick-tap size categories */}
              <div style={S.farmSizeGrid}>
                {FARM_SIZE_KEYS.map(key => {
                  const opt = FARM_SIZE_DEFS[key];
                  const isSelected = form.farmSizeCategory === key;
                  const subtitle = form.landSizeUnit === 'HECTARE' ? opt.hectare : opt.acre;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, farmSizeCategory: key }))}
                      style={{
                        ...S.farmSizeCard,
                        borderColor: isSelected ? '#22C55E' : '#243041',
                        background: isSelected ? 'rgba(34,197,94,0.15)' : '#1E293B',
                      }}
                      aria-pressed={isSelected}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#22C55E' : '#FFFFFF' }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{subtitle}</span>
                      {isSelected && <span style={{ color: '#22C55E', fontSize: '0.8rem', fontWeight: 700 }}>{'\u2713'}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Exact size — always visible, not hidden in details */}
              <div style={S.exactSizeRow} data-testid="exact-size-input">
                <span style={S.exactSizeLabel}>Or enter exact size:</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    value={form.farmSizeAcres}
                    onChange={e => setForm(f => ({ ...f, farmSizeAcres: e.target.value }))}
                    placeholder="e.g. 5"
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    style={{ ...S.input, flex: 1, textAlign: 'center', fontSize: '1.1rem' }}
                  />
                  <span style={{ color: '#A1A1AA', fontSize: '0.85rem', minWidth: '55px' }}>
                    {form.landSizeUnit === 'HECTARE' ? 'hectares' : 'acres'}
                  </span>
                </div>
              </div>
            </div>

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.farmSizeCategory || form.farmSizeAcres ? 'Next' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Gender ═══════════ */}
        {currentStep === 'gender' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83E\uDDD1\u200D\uD83C\uDF3E'}</div>
            <h2 style={S.title}>About you</h2>
            <p style={S.subtitle}>This helps us understand our farmers better</p>
            <div style={S.fieldWide}>
              <TapSelector
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={(v) => setForm(f => ({ ...f, gender: v }))}
                columns={2}
              />
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.gender ? 'Next' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Age Group ═══════════ */}
        {currentStep === 'age' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF82'}</div>
            <h2 style={S.title}>Your age group</h2>
            <p style={S.subtitle}>Tap your age range</p>
            <div style={S.fieldWide}>
              <TapSelector
                options={AGE_OPTIONS}
                value={form.ageGroup}
                onChange={(v) => setForm(f => ({ ...f, ageGroup: v }))}
                columns={2}
              />
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.ageGroup ? 'Next' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Location ═══════════ */}
        {currentStep === 'location' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDCCD'}</div>
            <h2 style={S.title}>Farm location</h2>
            <p style={S.subtitle}>Tap to detect or type your location</p>
            <div style={S.fieldWide}>
              <LocationDetect
                label={form.latitude ? '\u2713 Location detected \u2014 tap to update' : 'Detect my location'}
                onDetected={(loc) => {
                  const name = [loc.locality, loc.region, loc.country].filter(Boolean).join(', ');
                  setForm(f => ({
                    ...f,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    locationName: name || f.locationName,
                  }));
                }}
                style={{ marginBottom: '0.75rem' }}
              />
              {form.latitude && (
                <div style={S.gpsConfirm}>
                  {'\uD83D\uDCCC'} {form.locationName || `${form.latitude.toFixed(3)}, ${form.longitude.toFixed(3)}`}
                </div>
              )}
              <input
                value={form.locationName}
                onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
                placeholder="Or type: e.g. Nakuru, Kenya"
                style={{ ...S.input, marginTop: '0.5rem' }}
              />
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.locationName || form.latitude ? 'Next' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Photo ═══════════ */}
        {currentStep === 'photo' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDCF7'}</div>
            <h2 style={S.title}>Profile photo</h2>
            <p style={S.subtitle}>Optional — helps your field officer recognize you</p>
            {error && <div style={S.errorBox}>{error}</div>}

            <div style={{ marginBottom: '1rem' }}>
              {photoPreview ? (
                <div style={S.photoPreview}>
                  <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={S.photoPlaceholder}>
                  {'\uD83D\uDCF7'}
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              onChange={handlePhotoSelect}
              id="onboarding-photo-input"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => document.getElementById('onboarding-photo-input')?.click()}
              style={{ ...S.secondaryBtn, width: '100%', marginBottom: '0.5rem' }}
            >
              {photoFile ? 'Change Photo' : 'Take or Choose Photo'}
            </button>
            {photoFile && (
              <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginBottom: '0.5rem', textAlign: 'center' }}>
                {photoFile.name} ({(photoFile.size / 1024).toFixed(0)} KB)
              </div>
            )}

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>Back</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ ...S.primaryBtn, opacity: submitting ? 0.6 : 1, background: '#22C55E' }}
              >
                {submitting ? 'Creating...' : networkError ? 'Retry' : photoFile ? 'Create My Farm' : 'Skip & Create Farm'}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Processing ═══════════ */}
        {currentStep === 'processing' && !submitSuccess && (
          <ProcessingStep
            submitting={submitting}
            error={error}
            networkError={networkError}
            onRetry={() => { setError(''); setNetworkError(false); submitGuardRef.current = false; handleSubmit(); }}
            onBack={() => { setStep(STEP_KEYS.indexOf('photo')); setError(''); setNetworkError(false); submitGuardRef.current = false; }}
          />
        )}

        {/* ═══════════ Success ═══════════ */}
        {currentStep === 'processing' && submitSuccess && (
          <div style={{ ...S.stepContent, textAlign: 'center' }}>
            <div style={S.successIcon}>{'\u2713'}</div>
            <h2 style={S.title}>Farm created!</h2>
            <p style={S.subtitle}>
              <strong>{form.farmName.trim()}</strong> is ready.{'\n'}
              You'll start receiving personalised recommendations shortly.
            </p>
            <div style={S.completionTime}>
              Completed in {Math.round((Date.now() - startTimeRef.current) / 1000)}s
            </div>
            <button onClick={() => window.location.reload()} style={S.primaryBtn}>
              Continue to Dashboard
            </button>
          </div>
        )}

        {/* ── Reset link ── */}
        {step > 0 && step < STEP_KEYS.indexOf('processing') && !showResetConfirm && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button onClick={() => setShowResetConfirm(true)} style={S.resetLink}>
              Start over
            </button>
          </div>
        )}
        {showResetConfirm && (
          <div style={S.resetConfirm}>
            <span style={{ fontSize: '0.82rem', color: '#F59E0B' }}>Clear all data and start over?</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleReset} style={{ ...S.secondaryBtn, color: '#EF4444', borderColor: '#EF4444', fontSize: '0.8rem', minHeight: '44px' }}>
                Yes, start over
              </button>
              <button onClick={() => setShowResetConfirm(false)} style={{ ...S.secondaryBtn, fontSize: '0.8rem', minHeight: '44px' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step-based processing indicator with timeout + retry ────
const PROCESSING_STEPS = [
  { label: 'Creating your farm profile', icon: '\uD83C\uDFE1' },
  { label: 'Setting up crop tracking', icon: '\uD83C\uDF31' },
  { label: 'Preparing recommendations', icon: '\u2728' },
];
const PROCESSING_TIMEOUT_MS = 8000;

function ProcessingStep({ submitting, error, networkError, onRetry, onBack }) {
  const [activeStep, setActiveStep] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset animation and timeout each time submitting starts (including retries)
  useEffect(() => {
    if (!submitting) return;
    setActiveStep(0);
    setTimedOut(false);
    const t1 = setTimeout(() => setActiveStep(1), 1200);
    const t2 = setTimeout(() => setActiveStep(2), 3000);
    const tTimeout = setTimeout(() => setTimedOut(true), PROCESSING_TIMEOUT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(tTimeout); };
  }, [submitting, retryCount]);

  const handleRetry = () => {
    setRetryCount(c => c + 1);
    onRetry();
  };

  if (timedOut && submitting && !error) {
    return (
      <div style={{ ...S.stepContent, textAlign: 'center' }}>
        <div style={S.stepIcon}>{'\u23F3'}</div>
        <h2 style={S.title}>Taking longer than expected</h2>
        <p style={S.subtitle}>Your data is saved. You can wait or go back and try again.</p>
        <div style={S.btnRow}>
          <button onClick={onBack} style={S.secondaryBtn}>Go Back</button>
          <button onClick={handleRetry} style={S.primaryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  if (error && !submitting) {
    return (
      <div style={{ ...S.stepContent, textAlign: 'center' }}>
        <div style={S.stepIcon}>{networkError ? '\uD83D\uDCF6' : '\u26A0\uFE0F'}</div>
        <h2 style={S.title}>{networkError ? 'No connection' : 'Something went wrong'}</h2>
        <p style={{ ...S.subtitle, color: '#EF4444' }}>{error}</p>
        <div style={S.btnRow}>
          <button onClick={onBack} style={S.secondaryBtn}>Go Back</button>
          <button onClick={handleRetry} style={S.primaryBtn}>{networkError ? 'Retry When Online' : 'Retry'}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.stepContent, textAlign: 'center' }}>
      <div style={S.stepIcon}>{'\uD83C\uDF31'}</div>
      <h2 style={S.title}>Setting up your farm...</h2>
      <div style={{ width: '100%', margin: '0.75rem 0 1rem' }}>
        {PROCESSING_STEPS.map((ps, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.5rem 0.75rem', marginBottom: '0.25rem',
              borderRadius: '6px',
              background: i <= activeStep ? 'rgba(34,197,94,0.1)' : 'transparent',
              transition: 'all 0.3s ease',
            }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem',
              fontWeight: 700, flexShrink: 0,
              background: i < activeStep ? '#22C55E' : i === activeStep ? '#22C55E' : '#243041',
              color: i <= activeStep ? '#fff' : '#71717A',
              transition: 'all 0.3s ease',
            }}>
              {i < activeStep ? '\u2713' : ps.icon}
            </span>
            <span style={{
              fontSize: '0.85rem',
              color: i <= activeStep ? '#FFFFFF' : '#71717A',
              fontWeight: i === activeStep ? 600 : 400,
              transition: 'color 0.3s ease',
            }}>
              {ps.label}
            </span>
            {i === activeStep && submitting && (
              <div style={{ ...S.spinner, width: 16, height: 16, borderWidth: 2, marginLeft: 'auto', marginTop: 0 }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem',
    overflowY: 'auto',
  },
  modal: {
    background: '#162033', borderRadius: '16px', padding: '1.5rem',
    maxWidth: 'min(400px, 94vw)', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    maxHeight: '90vh', overflowY: 'auto',
  },
  // Progress
  progressWrap: { marginBottom: '1.25rem' },
  progressBar: {
    width: '100%', height: 4, background: '#243041', borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', background: '#22C55E', borderRadius: 2,
    transition: 'width 0.4s ease',
  },
  progressLabel: {
    fontSize: '0.7rem', color: '#71717A', marginTop: '0.3rem', textAlign: 'center',
  },
  // Content
  stepContent: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  stepIcon: {
    fontSize: '2.2rem', marginBottom: '0.4rem', lineHeight: 1,
  },
  title: {
    margin: '0 0 0.35rem', fontSize: '1.3rem', fontWeight: 700, textAlign: 'center',
    color: '#FFFFFF',
  },
  subtitle: {
    color: '#A1A1AA', fontSize: '0.9rem', textAlign: 'center', margin: '0 0 1.25rem',
    lineHeight: 1.5, whiteSpace: 'pre-line',
  },
  timeEstimate: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.4rem 1rem', borderRadius: 20, marginBottom: '1.5rem',
    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
    fontSize: '0.8rem', color: '#22C55E', fontWeight: 500,
  },
  timeIcon: { fontSize: '0.9rem' },
  completionTime: {
    fontSize: '0.78rem', color: '#22C55E', marginBottom: '1rem',
    background: 'rgba(34,197,94,0.1)', padding: '0.3rem 0.75rem', borderRadius: 12,
  },
  // Fields
  fieldWide: { width: '100%', marginBottom: '0.75rem' },
  input: {
    width: '100%', padding: '0.65rem 0.75rem', background: '#1E293B', border: '2px solid #243041',
    borderRadius: '8px', color: '#FFFFFF', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
    minHeight: '48px',
  },
  fieldError: {
    fontSize: '0.75rem', color: '#EF4444', marginTop: '0.3rem', textAlign: 'center',
  },
  errorBox: {
    width: '100%', background: 'rgba(239,68,68,0.12)', color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
    padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem',
    textAlign: 'center', lineHeight: 1.4,
  },
  autoDetectBadge: {
    fontSize: '0.78rem', color: '#22C55E', marginBottom: '0.75rem',
    background: 'rgba(34,197,94,0.1)', padding: '0.3rem 0.75rem', borderRadius: 12,
  },
  // Buttons
  btnRow: { display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' },
  primaryBtn: {
    flex: 1, padding: '0.75rem', background: '#22C55E', color: '#fff', border: 'none',
    borderRadius: '10px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
    minHeight: '52px', WebkitTapHighlightColor: 'transparent',
  },
  secondaryBtn: {
    padding: '0.75rem 1.2rem', background: 'transparent', color: '#A1A1AA',
    border: '2px solid #243041', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem',
    cursor: 'pointer', minHeight: '52px', WebkitTapHighlightColor: 'transparent',
  },
  // Top crops
  topCropGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  topCropBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
    padding: '0.7rem 0.4rem', minHeight: '72px',
    border: '2px solid #243041', borderRadius: '10px', cursor: 'pointer',
    background: '#1E293B', position: 'relative',
    WebkitTapHighlightColor: 'transparent',
  },
  topCropIcon: { fontSize: '1.4rem', lineHeight: 1 },
  topCropCheck: {
    position: 'absolute', top: 4, right: 6,
    fontSize: '0.7rem', color: '#22C55E', fontWeight: 700,
  },
  showMoreBtn: {
    width: '100%', padding: '0.5rem', background: 'transparent',
    border: '1px dashed #374151', borderRadius: '8px', color: '#71717A',
    fontSize: '0.82rem', cursor: 'pointer', minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  searchAllBtn: {
    width: '100%', padding: '0.65rem', background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px', color: '#22C55E',
    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', minHeight: '48px',
    WebkitTapHighlightColor: 'transparent', marginTop: '0.25rem',
  },
  // Farm size
  farmSizeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  farmSizeCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
    padding: '0.9rem 0.4rem', minHeight: '90px',
    border: '2px solid #243041', borderRadius: '10px', cursor: 'pointer',
    background: '#1E293B', WebkitTapHighlightColor: 'transparent',
  },
  unitRow: { marginBottom: '0.75rem' },
  exactSizeRow: { marginTop: '0.5rem', padding: '0.5rem 0' },
  exactSizeLabel: { fontSize: '0.78rem', color: '#A1A1AA', display: 'block', marginBottom: '0.4rem' },
  // Location
  gpsConfirm: {
    padding: '0.5rem 0.75rem', background: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px',
    fontSize: '0.82rem', color: '#22C55E', textAlign: 'center',
  },
  // Photo
  photoPreview: {
    width: 110, height: 110, borderRadius: '50%', overflow: 'hidden',
    border: '3px solid #22C55E', margin: '0 auto',
  },
  photoPlaceholder: {
    width: 110, height: 110, borderRadius: '50%', margin: '0 auto',
    background: '#1E293B', border: '2px dashed #374151',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '2.5rem', color: '#374151',
  },
  // Status
  draftBanner: {
    background: 'rgba(34,197,94,0.12)', color: '#22C55E',
    border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px',
    padding: '0.5rem 0.75rem', fontSize: '0.8rem', textAlign: 'center',
    marginBottom: '1rem', lineHeight: 1.4,
  },
  dismissBtn: {
    background: 'none', border: 'none', color: '#22C55E', cursor: 'pointer',
    fontSize: '0.75rem', marginLeft: '0.5rem', textDecoration: 'underline',
    padding: '0.5rem', minHeight: '44px', minWidth: '44px',
  },
  savedIndicator: {
    textAlign: 'center', fontSize: '0.7rem', color: '#22C55E',
    marginBottom: '0.5rem', opacity: 0.7,
  },
  resetLink: {
    background: 'none', border: 'none', color: '#71717A', fontSize: '0.75rem',
    cursor: 'pointer', textDecoration: 'underline', padding: '0.75rem 1rem',
    minHeight: '44px', display: 'inline-flex', alignItems: 'center',
  },
  resetConfirm: {
    textAlign: 'center', marginTop: '0.75rem', padding: '0.75rem',
    background: 'rgba(245,158,11,0.08)', borderRadius: '8px',
    border: '1px solid rgba(245,158,11,0.2)',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
    border: '3px solid #22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '2rem', color: '#22C55E', margin: '0 auto 0.75rem', fontWeight: 700,
  },
  spinner: {
    width: '32px', height: '32px', border: '3px solid #243041', borderTop: '3px solid #22C55E',
    borderRadius: '50%', animation: 'spin 1s linear infinite', marginTop: '1rem',
  },
  // Voice guide
  voiceBar: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    marginBottom: '0.75rem', padding: '0.4rem 0.5rem',
    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: '10px',
  },
  listenBtn: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.5rem 0.85rem', background: 'rgba(59,130,246,0.15)',
    border: '1.5px solid rgba(59,130,246,0.4)', borderRadius: '8px',
    color: '#60A5FA', fontWeight: 600, fontSize: '0.88rem',
    cursor: 'pointer', minHeight: '44px', minWidth: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  voiceLangSelect: {
    flex: 1, padding: '0.4rem 0.5rem', background: '#1E293B',
    border: '1.5px solid #374151', borderRadius: '6px',
    color: '#FFFFFF', fontSize: '0.82rem', minHeight: '44px',
    cursor: 'pointer',
  },
  voiceMuteBtn: {
    padding: '0.4rem', background: 'transparent', border: 'none',
    fontSize: '1.1rem', cursor: 'pointer', minHeight: '44px', minWidth: '44px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent', borderRadius: '6px',
  },
};
