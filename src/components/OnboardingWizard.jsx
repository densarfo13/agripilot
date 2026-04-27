import React, { useState, useEffect, useCallback, useRef } from 'react';
import CropSelect from './CropSelect.jsx';
import TapSelector from './TapSelector.jsx';
import CountrySelect from './CountrySelect.jsx';
import LocationDetect from './LocationDetect.jsx';
import COUNTRIES_REF from '../utils/countries.js';
import { useDraft } from '../utils/useDraft.js';
import { compressImage } from '../utils/imageCompress.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { UNIT_OPTIONS, computeLandSizeFields } from '../utils/landSize.js';
import { getCountryRecommendedCodes } from '../utils/cropRecommendations.js';
import { getLocalizedCropList } from '../data/cropRegionCatalog.js';
import { speak, stopSpeech, isVoiceAvailable, VOICE_LANGUAGES } from '../utils/voiceGuide.js';
import { trackVoiceStepCompleted } from '../utils/voiceAnalytics.js';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import NewFarmerRecommendation from './NewFarmerRecommendation.jsx';
import { assessSeasonProfit } from '../engine/seasonProfitRules.js';
import { detectCountryByIP } from '../utils/geolocation.js';
import { safeParse } from '../utils/safeParse.js';

// ─── Step definitions ────────────────────────────────────────
const STEP_KEYS = ['welcome', 'farmName', 'country', 'usFarmType', 'experience', 'recommendation', 'crop', 'farmSize', 'gender', 'age', 'location', 'photo', 'processing'];

// U.S. farm-type step is only shown when the selected country is the
// United States. Elsewhere it's transparently skipped in goNext/goBack.
function isUsCountry(code) {
  if (!code) return false;
  const up = String(code).toUpperCase();
  return up === 'US' || up === 'USA';
}

// 50 states + D.C., sorted alphabetically by name. Kept inline to
// avoid a network dependency during onboarding; matches the
// authoritative server-side list in server/src/domain/us/usStates.js.
const US_POSTAL_CODES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['DC','District of Columbia'],
  ['FL','Florida'],['GA','Georgia'],['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],
  ['IN','Indiana'],['IA','Iowa'],['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],
  ['ME','Maine'],['MD','Maryland'],['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],
  ['MS','Mississippi'],['MO','Missouri'],['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],
  ['NH','New Hampshire'],['NJ','New Jersey'],['NM','New Mexico'],['NY','New York'],
  ['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],['OK','Oklahoma'],['OR','Oregon'],
  ['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],['SD','South Dakota'],
  ['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],['VA','Virginia'],
  ['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
];
const TOTAL_USER_STEPS_NEW = 10;         // includes recommendation step
const TOTAL_USER_STEPS_EXPERIENCED = 9;  // skips recommendation step

// ─── Tap option sets (factory functions — accept t for localization) ──
function getGenderOptions(t) {
  return [
    { value: 'male', label: t('gender.male'), icon: '\uD83D\uDC68\u200D\uD83C\uDF3E' },
    { value: 'female', label: t('gender.female'), icon: '\uD83D\uDC69\u200D\uD83C\uDF3E' },
    { value: 'other', label: t('gender.other'), icon: '\uD83E\uDDD1' },
    { value: 'prefer_not_to_say', label: t('gender.preferNotToSay'), icon: '\u2014' },
  ];
}

function getAgeOptions(t) {
  return [
    { value: 'under_25', label: t('age.under25') },
    { value: '25_35', label: t('age.25to35') },
    { value: '36_50', label: t('age.36to50') },
    { value: 'over_50', label: t('age.over50') },
  ];
}

// Farm size categories — subtitles adapt to selected unit
function getFarmSizeDefs(t) {
  return {
    small:  { label: t('farmSize.small'), icon: '\uD83C\uDF31', acre: t('farmSize.under2acres'), hectare: t('farmSize.under1hectare'), defaultVal: 1 },
    medium: { label: t('farmSize.medium'), icon: '\uD83C\uDF3E', acre: t('farmSize.2to10acres'), hectare: t('farmSize.1to4hectares'), defaultVal: 5 },
    large:  { label: t('farmSize.large'), icon: '\uD83C\uDFE1', acre: t('farmSize.over10acres'), hectare: t('farmSize.over4hectares'), defaultVal: 15 },
  };
}
const FARM_SIZE_KEYS = ['small', 'medium', 'large'];

function getStageOptions(t) {
  return [
    { value: 'planting', label: t('cropStage.planting'), icon: '\uD83C\uDF31' },
    { value: 'growing', label: t('cropStage.growing'), icon: '\uD83C\uDF3F' },
    { value: 'flowering', label: t('cropStage.flowering'), icon: '\uD83C\uDF3C' },
    { value: 'harvest', label: t('cropStage.harvest'), icon: '\uD83C\uDF3E' },
  ];
}

// Top crops shown as quick-tap buttons before the full CropSelect
function getTopCrops(t) {
  return [
    { code: 'MAIZE', label: t('crop.maize'), icon: '\uD83C\uDF3D' },
    { code: 'RICE', label: t('crop.rice'), icon: '\uD83C\uDF3E' },
    { code: 'BEAN', label: t('crop.beans'), icon: '\uD83E\uDED8' },
    { code: 'COFFEE', label: t('crop.coffee'), icon: '\u2615' },
    { code: 'CASSAVA', label: t('crop.cassava'), icon: '\uD83E\uDD54' },
    { code: 'BANANA', label: t('crop.banana'), icon: '\uD83C\uDF4C' },
    { code: 'WHEAT', label: t('crop.wheat'), icon: '\uD83C\uDF3E' },
    { code: 'SORGHUM', label: t('crop.sorghum'), icon: '\uD83C\uDF3F' },
    { code: 'TOMATO', label: t('crop.tomato'), icon: '\uD83C\uDF45' },
    { code: 'POTATO', label: t('crop.potato'), icon: '\uD83E\uDD54' },
    { code: 'TEA', label: t('crop.tea'), icon: '\uD83C\uDF3F' },
    { code: 'SWEET_POTATO', label: t('crop.sweetPotato'), icon: '\uD83C\uDF60' },
    { code: 'MANGO', label: t('crop.mango'), icon: '\uD83E\uDD6D' },
    { code: 'GROUNDNUT', label: t('crop.groundnut'), icon: '\uD83E\uDD5C' },
    { code: 'SUGARCANE', label: t('crop.sugarcane'), icon: '\uD83C\uDF3F' },
    { code: 'COTTON', label: t('crop.cotton'), icon: '\u2601\uFE0F' },
  ];
}

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
    // safeParse instead of bare JSON.parse — corrupt log values
    // (interrupted writes, third-party storage cleaners) used to
    // throw here. The outer try/catch caught it but threw away
    // the new event silently; safeParse recovers with [] so the
    // event still lands and onboarding telemetry stays continuous.
    const prev = safeParse(localStorage.getItem(LOG_KEY), []);
    const list = Array.isArray(prev) ? prev : [];
    list.push(entry);
    if (list.length > 50) list.splice(0, list.length - 50);
    localStorage.setItem(LOG_KEY, JSON.stringify(list));
  } catch { /* storage full or unavailable */ }
}

const INITIAL_FORM = {
  farmName: '', farmSizeAcres: '', farmSizeCategory: '', landSizeUnit: 'ACRE',
  locationName: '', crop: '', stage: 'planting',
  latitude: null, longitude: null,
  countryCode: '', detectedRegion: '', locationMethod: '',
  gender: '', ageGroup: '', experienceLevel: '',
};

export default function OnboardingWizard({ userName, countryCode, onComplete }) {
  const { t } = useTranslation();

  // ─── Localized option sets (rebuilt on language change) ────
  const GENDER_OPTIONS = getGenderOptions(t);
  const AGE_OPTIONS = getAgeOptions(t);
  const FARM_SIZE_DEFS = getFarmSizeDefs(t);
  const STAGE_OPTIONS = getStageOptions(t);
  const TOP_CROPS = getTopCrops(t);

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
  // Location detection state
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [locationConfirmed, setLocationConfirmed] = useState(!!form.countryCode);

  const currentStep = STEP_KEYS[step];

  // Map onboarding step names → dot-notation voice keys
  const ONBOARDING_VOICE_KEY = {
    welcome: 'onboarding.welcome',
    farmName: 'onboarding.farmName',
    country: 'onboarding.country',
    experience: 'onboarding.experience',
    recommendation: 'onboarding.recommendation',
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

  // ─── Mobile keyboard overlap fix ──────────────────────────
  // When an input/select receives focus on mobile, the virtual keyboard
  // can cover it. Scroll the focused element into view after a short delay
  // (to let the keyboard finish animating).
  const modalRef = useRef(null);
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 350);
      }
    };
    el.addEventListener('focusin', handler);
    return () => el.removeEventListener('focusin', handler);
  }, []);

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

  // ─── Country auto-detect on mount: IP → timezone fallback ──
  useEffect(() => {
    if (form.countryCode) return; // already set via prop or draft
    let cancelled = false;

    (async () => {
      // 1. Try IP-based detection first (async, ~1-3s)
      try {
        const ip = await detectCountryByIP();
        if (!cancelled && ip.countryCode) {
          setForm(f => ({
            ...f,
            countryCode: ip.countryCode,
            detectedRegion: ip.region || '',
            locationMethod: 'ip',
          }));
          logOnboarding('country_auto_detected', { method: 'ip', country: ip.countryCode });
          return; // success — skip timezone fallback
        }
      } catch { /* IP detection failed, continue to timezone fallback */ }

      if (cancelled) return;

      // 2. Timezone fallback (synchronous, limited to known cities)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const tzLower = tz.toLowerCase();
        const TZ_MAP = {
          nairobi: 'KE', dar_es_salaam: 'TZ', kampala: 'UG', lagos: 'NG',
          johannesburg: 'ZA', harare: 'ZA', addis_ababa: 'ET', accra: 'GH',
          lusaka: 'ZM', maputo: 'MZ', kigali: 'RW', bamako: 'ML',
          dakar: 'SN', abidjan: 'CI', douala: 'CM', kinshasa: 'CD',
          lilongwe: 'MW', windhoek: 'NA', gaborone: 'BW',
        };
        for (const [city, code] of Object.entries(TZ_MAP)) {
          if (tzLower.includes(city)) {
            setForm(f => ({ ...f, countryCode: code, locationMethod: 'timezone' }));
            logOnboarding('country_auto_detected', { method: 'timezone', country: code });
            break;
          }
        }
      } catch { /* timezone API unavailable */ }
    })();

    return () => { cancelled = true; };
  }, []);

  // ─── Computed helpers ──────────────────────────────────────
  const isNewFarmer = form.experienceLevel === 'new';
  // U.S. farmers see one extra step (usFarmType); adjust the progress
  // denominator so the percentage stays accurate rather than pegging
  // short for U.S. users.
  const usStepAddition = isUsCountry(form.countryCode) ? 1 : 0;
  const TOTAL_USER_STEPS = (isNewFarmer ? TOTAL_USER_STEPS_NEW : TOTAL_USER_STEPS_EXPERIENCED) + usStepAddition;
  const progressNum = Math.min(step, TOTAL_USER_STEPS); // 0-based, for dots
  const progressPercent = step <= 0 ? 0 : Math.round((progressNum / TOTAL_USER_STEPS) * 100);

  // Country-specific crop grouping from catalog
  const cropGroups = form.countryCode ? getLocalizedCropList(form.countryCode) : null;
  const localCropButtons = cropGroups
    ? cropGroups.local.slice(0, 10).map(entry => {
        const found = TOP_CROPS.find(c => c.code === entry.code);
        return found || { code: entry.code, label: entry.code.charAt(0) + entry.code.slice(1).toLowerCase().replace(/_/g, ' '), icon: '\uD83C\uDF3F' };
      })
    : [];
  const moreCropButtons = cropGroups
    ? [...cropGroups.regional, ...cropGroups.global].slice(0, 6).map(entry => {
        const found = TOP_CROPS.find(c => c.code === entry.code);
        return found || { code: entry.code, label: entry.code.charAt(0) + entry.code.slice(1).toLowerCase().replace(/_/g, ' '), icon: '\uD83C\uDF3F' };
      })
    : [];
  // Fallback when no country is set
  const topCropButtons = localCropButtons.length > 0 ? localCropButtons : TOP_CROPS.slice(0, 8);

  // ─── Navigation helpers ────────────────────────────────────
  const goNext = () => {
    if (voiceEnabled && currentVoiceKey) trackVoiceStepCompleted(currentVoiceKey, voiceLang);
    const nextRaw = step + 1;
    const nextKey = STEP_KEYS[nextRaw];
    // Skip U.S. farm-type step when country isn't the U.S.
    if (nextKey === 'usFarmType' && !isUsCountry(form.countryCode)) {
      setStep(nextRaw + 1);
      return;
    }
    // Skip recommendation step for experienced farmers
    if (nextKey === 'recommendation' && form.experienceLevel !== 'new') {
      setStep(nextRaw + 1);
      return;
    }
    setStep(nextRaw);
  };
  const goBack = () => {
    const prevRaw = step - 1;
    const prevKey = STEP_KEYS[prevRaw];
    // Skip U.S. farm-type step going backwards when country isn't the U.S.
    if (prevKey === 'usFarmType' && !isUsCountry(form.countryCode)) {
      setStep(Math.max(0, prevRaw - 1));
      return;
    }
    // Skip recommendation step going backwards for experienced farmers
    if (prevKey === 'recommendation' && form.experienceLevel !== 'new') {
      setStep(Math.max(0, prevRaw - 1));
      return;
    }
    setStep(Math.max(0, prevRaw));
  };

  // ─── Photo handling ────────────────────────────────────────
  const handlePhotoSelect = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      setError(t('onboarding.selectImage'));
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError(t('onboarding.imageUnder5MB'));
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
      setError(t('wizard.pleaseComplete', { fields: missing.join(', ') }));
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
        detectedRegion: form.detectedRegion || null,
        locationMethod: form.locationMethod || null,
        farmSizeCategory: form.farmSizeCategory || null,
        experienceLevel: form.experienceLevel || null,
        // U.S. state-aware fields (only populated when country === US/USA;
        // nullable on the backend so non-U.S. flows are unaffected).
        stateCode: isUsCountry(form.countryCode) ? (form.stateCode || null) : null,
        farmType: isUsCountry(form.countryCode) ? (form.farmType || null) : null,
        beginnerLevel: isUsCountry(form.countryCode) ? (form.beginnerLevel || null) : null,
        growingStyle: isUsCountry(form.countryCode) && form.farmType === 'backyard'
          ? (form.growingStyle || null)
          : null,
        farmPurpose: isUsCountry(form.countryCode) && form.farmType === 'backyard'
          ? (form.farmPurpose || null)
          : null,
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
      trackPilotEvent('setup_failed', { error: msg, isNetwork });
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
      <div style={S.modal} ref={modalRef}>
        {/* ── Voice controls ── */}
        {voiceEnabled && (
          <div style={S.voiceBar}>
            <button
              type="button"
              onClick={handleReplay}
              style={S.listenBtn}
              aria-label="Listen again"
            >
              {'\uD83D\uDD0A'} {t('wizard.listen')}
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
              {'\uD83D\uDD08'} {t('common.enableVoice')}
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
              {t('wizard.stepOf', { step: progressNum, total: TOTAL_USER_STEPS })}
            </div>
          </div>
        )}

        {/* Draft restored banner */}
        {saveStatus === 'restored' && (
          <div style={S.draftBanner}>
            &#8635; <strong>{t('wizard.draftRestored')}</strong> — {t('wizard.prevProgressSaved')}
            <button type="button" onClick={() => setSaveStatus(null)} style={S.dismissBtn}>{t('wizard.dismiss')}</button>
          </div>
        )}

        {/* Save status */}
        {saveStatus === 'saved' && step > 0 && step < STEP_KEYS.indexOf('processing') && (
          <div style={S.savedIndicator}>{'\u2713'} {t('wizard.draftSaved')}</div>
        )}

        {/* ═══════════ STEP: Welcome ═══════════ */}
        {currentStep === 'welcome' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDC4B'}</div>
            <h2 style={S.title}>{t('wizard.welcomeUser')}{userName ? `, ${userName}` : ''}!</h2>
            <p style={S.subtitle}>
              {t('wizard.setUpFarm')}{'\n'}Just tap to answer each question.
            </p>
            <div style={S.timeEstimate}>
              <span style={S.timeIcon}>{'\u23F1\uFE0F'}</span> {t('wizard.takesAbout60s')}
            </div>
            <button onClick={goNext} style={S.primaryBtn}>{t('wizard.getStarted')}</button>
          </div>
        )}

        {/* ═══════════ STEP: Farm Name ═══════════ */}
        {currentStep === 'farmName' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDFE1'}</div>
            <h2 style={S.title}>{t('wizard.nameYourFarm')}</h2>
            <p style={S.subtitle}>{t('wizard.whatCallFarm')}</p>
            {error && <div style={S.errorBox}>{error}</div>}
            <div style={S.fieldWide}>
              <input
                value={form.farmName}
                onChange={e => { setForm(f => ({ ...f, farmName: e.target.value })); setFieldErrors(fe => ({ ...fe, farmName: undefined })); }}
                placeholder={t('wizard.egSunriseFarm')}
                style={{
                  ...S.input,
                  borderColor: fieldErrors.farmName ? '#EF4444' : form.farmName.trim() ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                  fontSize: '1.1rem',
                  textAlign: 'center',
                }}
                autoFocus
                autoComplete="off"
              />
              {fieldErrors.farmName && <div style={S.fieldError}>{fieldErrors.farmName}</div>}
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button
                onClick={() => {
                  if (!form.farmName.trim()) { setFieldErrors({ farmName: t('wizard.giveAName') }); return; }
                  goNext();
                }}
                disabled={!form.farmName.trim()}
                style={{ ...S.primaryBtn, opacity: form.farmName.trim() ? 1 : 0.5 }}
              >{t('common.next')}</button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Country (with detection + confirmation) ═══════════ */}
        {currentStep === 'country' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF0D'}</div>
            <h2 style={S.title}>{t('wizard.whereAreYou')}</h2>
            <p style={S.subtitle}>
              {form.countryCode ? t('wizard.confirmOrChange') : t('wizard.searchCountry')}
            </p>

            {/* ── Detected country confirmation card ── */}
            {form.countryCode && form.locationMethod && !locationConfirmed && (
              <div style={S.locationConfirmCard} data-testid="country-confirm-card">
                <div style={S.locationConfirmIcon}>{'\uD83D\uDCCD'}</div>
                <div style={S.locationConfirmText}>
                  <span style={{ fontWeight: 600, color: '#22C55E' }}>
                    {(() => { const c = COUNTRIES_REF.find(c => c.iso2 === form.countryCode); return c ? c.name : form.countryCode; })()}
                  </span>
                  {form.detectedRegion && (
                    <span style={{ color: '#A1A1AA', fontSize: '0.8rem', marginLeft: '0.3rem' }}>
                      ({form.detectedRegion})
                    </span>
                  )}
                  <div style={{ fontSize: '0.75rem', color: '#71717A', marginTop: '0.15rem' }}>
                    {form.locationMethod === 'gps' ? t('wizard.detectedViaGPS') :
                     form.locationMethod === 'ip' ? t('wizard.detectedViaNetwork') :
                     t('wizard.autoDetected')}
                  </div>
                </div>
                <div style={S.locationConfirmActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setLocationConfirmed(true);
                      logOnboarding('country_confirmed', { method: form.locationMethod, country: form.countryCode });
                    }}
                    style={S.confirmBtn}
                  >{t('wizard.confirmLocation')}</button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, countryCode: '', detectedRegion: '', locationMethod: '' }));
                      setLocationConfirmed(false);
                    }}
                    style={S.changeBtn}
                  >{t('wizard.changeLocation')}</button>
                </div>
              </div>
            )}

            {/* ── Confirmed badge ── */}
            {form.countryCode && locationConfirmed && (
              <div style={S.autoDetectBadge} data-testid="country-auto-detected">
                {'\u2713'} {form.locationMethod ? t('wizard.locationConfirmed') : t('wizard.autoDetected')}
                <button
                  type="button"
                  onClick={() => { setLocationConfirmed(false); setForm(f => ({ ...f, locationMethod: '' })); }}
                  style={{ background: 'none', border: 'none', color: '#3B82F6', fontSize: '0.78rem', cursor: 'pointer', marginLeft: '0.5rem', textDecoration: 'underline' }}
                >{t('common.change')}</button>
              </div>
            )}

            {/* ── GPS detect button (when no country or user wants to change) ── */}
            {(!form.countryCode || (!locationConfirmed && !form.locationMethod)) && (
              <div style={{ width: '100%', marginBottom: '0.75rem' }}>
                <button
                  type="button"
                  disabled={detecting}
                  onClick={async () => {
                    setDetecting(true);
                    setDetectError('');
                    try {
                      const { detectAndResolveLocation } = await import('../utils/geolocation.js');
                      const result = await detectAndResolveLocation();
                      if (result.countryCode) {
                        setForm(f => ({
                          ...f,
                          countryCode: result.countryCode,
                          detectedRegion: result.region || '',
                          locationMethod: 'gps',
                          latitude: result.latitude,
                          longitude: result.longitude,
                          locationName: [result.locality, result.region, result.country].filter(Boolean).join(', '),
                        }));
                        setLocationConfirmed(false); // show confirmation card
                        logOnboarding('country_gps_detected', { country: result.countryCode, region: result.region });
                      }
                    } catch (err) {
                      setDetectError(t('wizard.gpsDetectFailed'));
                    } finally {
                      setDetecting(false);
                    }
                  }}
                  style={{
                    ...S.primaryBtn,
                    width: '100%',
                    background: 'rgba(59,130,246,0.1)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: '#3B82F6',
                    opacity: detecting ? 0.6 : 1,
                  }}
                >
                  {detecting ? t('wizard.detectingLocation') : t('wizard.detectMyLocation')}
                </button>
                {detectError && (
                  <div style={{ fontSize: '0.78rem', color: '#F59E0B', textAlign: 'center', marginTop: '0.35rem' }}>
                    {detectError}
                  </div>
                )}
              </div>
            )}

            {/* ── Manual country selection (always available as fallback) ── */}
            {(!form.countryCode || (!locationConfirmed && !form.locationMethod)) && (
              <div style={S.fieldWide}>
                <div style={{ fontSize: '0.78rem', color: '#71717A', textAlign: 'center', marginBottom: '0.35rem' }}>
                  {t('wizard.orSelectManually')}
                </div>
                <CountrySelect
                  value={form.countryCode}
                  onChange={(e) => {
                    setForm(f => ({ ...f, countryCode: e.target.value, locationMethod: 'manual', detectedRegion: '' }));
                    setLocationConfirmed(true);
                  }}
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
              </div>
            )}

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button
                onClick={() => {
                  if (form.countryCode && !locationConfirmed) setLocationConfirmed(true);
                  goNext();
                }}
                disabled={form.countryCode && form.locationMethod && !locationConfirmed}
                style={{
                  ...S.primaryBtn,
                  opacity: (form.countryCode && form.locationMethod && !locationConfirmed) ? 0.5 : 1,
                }}
              >
                {form.countryCode ? t('common.next') : t('common.skip')}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: U.S. farm type (conditional) ═══════════ */}
        {currentStep === 'usFarmType' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF3D'}</div>
            <h2 style={S.title}>{t('wizard.usStep.title')}</h2>
            <p style={S.subtitle}>{t('wizard.usStep.subtitle')}</p>

            <div style={{ ...S.fieldWide, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <label style={S.usLabel}>
                <span style={S.usLabelText}>{t('usRec.form.state')}</span>
                <select
                  value={form.stateCode || ''}
                  onChange={(e) => setForm(f => ({ ...f, stateCode: e.target.value }))}
                  style={S.usSelect}
                  data-testid="wizard-us-state"
                >
                  <option value="">{t('wizard.usStep.chooseState')}</option>
                  {US_POSTAL_CODES.map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </label>

              <label style={S.usLabel}>
                <span style={S.usLabelText}>{t('usRec.form.farmType')}</span>
                <select
                  value={form.farmType || ''}
                  onChange={(e) => setForm(f => ({ ...f, farmType: e.target.value }))}
                  style={S.usSelect}
                  data-testid="wizard-us-farmtype"
                >
                  <option value="">{t('wizard.usStep.choose')}</option>
                  <option value="backyard">{t('usRec.farmType.backyard')}</option>
                  <option value="small_farm">{t('usRec.farmType.smallFarm')}</option>
                  <option value="commercial">{t('usRec.farmType.commercial')}</option>
                </select>
              </label>

              <label style={S.usLabel}>
                <span style={S.usLabelText}>{t('usRec.form.beginnerLevel')}</span>
                <select
                  value={form.beginnerLevel || ''}
                  onChange={(e) => setForm(f => ({ ...f, beginnerLevel: e.target.value }))}
                  style={S.usSelect}
                  data-testid="wizard-us-beginner"
                >
                  <option value="">{t('wizard.usStep.choose')}</option>
                  <option value="beginner">{t('usRec.beginner.beginner')}</option>
                  <option value="intermediate">{t('usRec.beginner.intermediate')}</option>
                  <option value="advanced">{t('usRec.beginner.advanced')}</option>
                </select>
              </label>

              {form.farmType === 'backyard' && (
                <>
                  <label style={S.usLabel}>
                    <span style={S.usLabelText}>{t('usRec.form.growingStyle')}</span>
                    <select
                      value={form.growingStyle || ''}
                      onChange={(e) => setForm(f => ({ ...f, growingStyle: e.target.value }))}
                      style={S.usSelect}
                      data-testid="wizard-us-style"
                    >
                      <option value="">{t('wizard.usStep.choose')}</option>
                      <option value="container">{t('usRec.style.container')}</option>
                      <option value="raised_bed">{t('usRec.style.raisedBed')}</option>
                      <option value="in_ground">{t('usRec.style.inGround')}</option>
                      <option value="mixed">{t('usRec.style.mixed')}</option>
                    </select>
                  </label>

                  <label style={S.usLabel}>
                    <span style={S.usLabelText}>{t('usRec.form.purpose')}</span>
                    <select
                      value={form.farmPurpose || ''}
                      onChange={(e) => setForm(f => ({ ...f, farmPurpose: e.target.value }))}
                      style={S.usSelect}
                      data-testid="wizard-us-purpose"
                    >
                      <option value="">{t('wizard.usStep.choose')}</option>
                      <option value="home_food">{t('usRec.purpose.homeFood')}</option>
                      <option value="sell_locally">{t('usRec.purpose.sellLocally')}</option>
                      <option value="learning">{t('usRec.purpose.learning')}</option>
                      <option value="mixed">{t('usRec.purpose.mixed')}</option>
                    </select>
                  </label>
                </>
              )}
            </div>

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button
                onClick={goNext}
                style={S.primaryBtn}
                disabled={!form.stateCode || !form.farmType}
                data-testid="wizard-us-next"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Experience Level ═══════════ */}
        {currentStep === 'experience' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF31'}</div>
            <h2 style={S.title}>{t('wizard.whatDescribesYou')}</h2>
            <p style={S.subtitle}>{t('wizard.experienceSubtitle')}</p>

            <div style={{ ...S.fieldWide, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setForm(f => ({ ...f, experienceLevel: 'new' }));
                  logOnboarding('experience_selected', { level: 'new' });
                  // Advance to recommendation step
                  goNext();
                }}
                style={{
                  ...S.experienceBtn,
                  borderColor: form.experienceLevel === 'new' ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                  background: form.experienceLevel === 'new' ? 'rgba(34,197,94,0.10)' : '#1E293B',
                }}
              >
                <span style={S.experienceBtnIcon}>{'\uD83C\uDF31'}</span>
                <div>
                  <div style={S.experienceBtnTitle}>{t('wizard.imNewToFarming')}</div>
                  <div style={S.experienceBtnDesc}>{t('wizard.imNewToFarmingDesc')}</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setForm(f => ({ ...f, experienceLevel: 'experienced' }));
                  logOnboarding('experience_selected', { level: 'experienced' });
                  // Skip recommendation → go directly to crop step
                  const cropIdx = STEP_KEYS.indexOf('crop');
                  setStep(cropIdx);
                }}
                style={{
                  ...S.experienceBtn,
                  borderColor: form.experienceLevel === 'experienced' ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                  background: form.experienceLevel === 'experienced' ? 'rgba(34,197,94,0.10)' : '#1E293B',
                }}
              >
                <span style={S.experienceBtnIcon}>{'\uD83D\uDCAA'}</span>
                <div>
                  <div style={S.experienceBtnTitle}>{t('wizard.iAlreadyFarm')}</div>
                  <div style={S.experienceBtnDesc}>{t('wizard.iAlreadyFarmDesc')}</div>
                </div>
              </button>
            </div>

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Recommendation (new farmers only) ═══════════ */}
        {currentStep === 'recommendation' && (
          <div style={S.stepContent}>
            <NewFarmerRecommendation
              t={t}
              countryCode={form.countryCode}
              onResult={({ crop, farmSizeCategory }) => {
                setForm(f => ({ ...f, crop: crop || f.crop, farmSizeCategory: farmSizeCategory || f.farmSizeCategory }));
                logOnboarding('recommendation_applied', { crop, farmSizeCategory });
                // Advance to crop step (shows prefilled, farmer can adjust)
                const cropIdx = STEP_KEYS.indexOf('crop');
                setStep(cropIdx);
              }}
              onSkip={() => {
                logOnboarding('recommendation_skipped');
                const cropIdx = STEP_KEYS.indexOf('crop');
                setStep(cropIdx);
              }}
            />
          </div>
        )}

        {/* ═══════════ STEP: Crop ═══════════ */}
        {currentStep === 'crop' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF3E'}</div>
            <h2 style={S.title}>{t('wizard.whatDoYouGrow')}</h2>
            <p style={S.subtitle}>{t('wizard.tapMainCrop')}</p>
            {error && <div style={S.errorBox}>{error}</div>}

            {/* Quick-tap top crops — grouped by locality when country is known */}
            {!showCropSearch && (
              <div style={S.fieldWide}>
                {/* Section: Popular in your area (only when country is set) */}
                {localCropButtons.length > 0 && (
                  <>
                    <div style={S.cropGroupLabel}>{t('wizard.popularInArea')}</div>
                    <div style={S.topCropGrid}>
                      {localCropButtons.map(c => {
                        const isSelected = form.crop === c.code;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => { setForm(f => ({ ...f, crop: c.code })); setShowCropSearch(false); }}
                            style={{
                              ...S.topCropBtn,
                              borderColor: isSelected ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                              background: isSelected ? 'rgba(34,197,94,0.10)' : '#1E293B',
                            }}
                            aria-pressed={isSelected}
                          >
                            <span style={S.topCropIcon}>{c.icon}</span>
                            <span style={{ fontSize: '0.82rem', color: isSelected ? '#86EFAC' : '#FFFFFF', fontWeight: isSelected ? 600 : 400 }}>
                              {c.label}
                            </span>
                            {isSelected && <span style={S.topCropCheck}>{'\u2713'}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Section: More crops (regional/global, or generic fallback) */}
                {moreCropButtons.length > 0 && (
                  <>
                    <div style={{ ...S.cropGroupLabel, marginTop: '0.75rem' }}>{t('wizard.moreCrops')}</div>
                    <div style={S.topCropGrid}>
                      {moreCropButtons.map(c => {
                        const isSelected = form.crop === c.code;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => { setForm(f => ({ ...f, crop: c.code })); setShowCropSearch(false); }}
                            style={{
                              ...S.topCropBtn,
                              borderColor: isSelected ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                              background: isSelected ? 'rgba(34,197,94,0.10)' : '#1E293B',
                            }}
                            aria-pressed={isSelected}
                          >
                            <span style={S.topCropIcon}>{c.icon}</span>
                            <span style={{ fontSize: '0.82rem', color: isSelected ? '#86EFAC' : '#FFFFFF', fontWeight: isSelected ? 600 : 400 }}>
                              {c.label}
                            </span>
                            {isSelected && <span style={S.topCropCheck}>{'\u2713'}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Generic fallback when no country is set */}
                {localCropButtons.length === 0 && (
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
                            borderColor: isSelected ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                            background: isSelected ? 'rgba(34,197,94,0.10)' : '#1E293B',
                          }}
                          aria-pressed={isSelected}
                        >
                          <span style={S.topCropIcon}>{c.icon}</span>
                          <span style={{ fontSize: '0.82rem', color: isSelected ? '#86EFAC' : '#FFFFFF', fontWeight: isSelected ? 600 : 400 }}>
                            {c.label}
                          </span>
                          {isSelected && <span style={S.topCropCheck}>{'\u2713'}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* "Other" quick-tap — always visible */}
                <div style={{ ...S.topCropGrid, marginTop: '0.5rem' }}>
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
                    <span style={{ fontSize: '0.82rem', color: '#A1A1AA' }}>{t('wizard.otherCrop')}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCropSearch(true)}
                  style={S.searchAllBtn}
                  data-testid="crop-search-all"
                >
                  {'\uD83D\uDD0D'} {t('wizard.searchAll60')}
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
                  placeholder={t('onboarding.searchCrops')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCropSearch(false)}
                  style={{ ...S.showMoreBtn, marginTop: '0.5rem' }}
                >
                  {t('wizard.backToTopCrops')} {'\u25B4'}
                </button>
              </div>
            )}

            {/* Season & profit advisory — shown for new farmers when crop is selected */}
            {form.crop && isNewFarmer && form.countryCode && !form.crop.startsWith('OTHER') && (() => {
              const sa = assessSeasonProfit({
                cropCode: form.crop,
                countryCode: form.countryCode,
                goal: form.experienceLevel === 'new' ? 'profit' : '',
                isNew: true,
              });
              // Only show the card when timing is suboptimal
              if (sa.seasonFit === 'good') return null;
              const isOkay = sa.seasonFit === 'okay';
              const accent = isOkay ? '#EAB308' : '#F97316';
              const bg = isOkay ? 'rgba(234,179,8,0.06)' : 'rgba(249,115,22,0.06)';
              const border = isOkay ? 'rgba(234,179,8,0.15)' : 'rgba(249,115,22,0.15)';
              const icon = isOkay ? '\uD83D\uDFE1' : '\uD83D\uDFE0';
              return (
                <div style={{ ...S.fieldWide, marginTop: '0.5rem' }}>
                  <div style={{ padding: '0.65rem 0.85rem', borderRadius: '10px', background: bg, border: `1px solid ${border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.9rem' }}>{icon}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {t('seasonGuide.timingLabel')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#E2E8F0', lineHeight: 1.4, marginBottom: '0.3rem' }}>
                      {t(sa.messageKey)}
                    </div>
                    {sa.alternatives.length > 0 && (
                      <div style={{ marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#F59E0B', marginBottom: '0.25rem' }}>
                          {t('seasonGuide.betterNow')}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                          {sa.alternatives.map(alt => (
                            <button
                              key={alt.code}
                              type="button"
                              onClick={() => { setForm(f => ({ ...f, crop: alt.code })); setShowCropSearch(false); }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px',
                                color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 500,
                                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                              }}
                            >
                              <span>{(TOP_CROPS.find(tc => tc.code === alt.code) || {}).label || alt.code.charAt(0) + alt.code.slice(1).toLowerCase().replace(/_/g, ' ')}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Crop stage — only when crop is selected */}
            {form.crop && (
              <div style={{ ...S.fieldWide, marginTop: '0.75rem' }}>
                <TapSelector
                  label={t('onboarding.currentStage')}
                  options={STAGE_OPTIONS}
                  value={form.stage}
                  onChange={(v) => setForm(f => ({ ...f, stage: v }))}
                  columns={2}
                />
              </div>
            )}

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button
                onClick={() => {
                  if (!form.crop) { setFieldErrors({ crop: t('wizard.selectCrop') }); return; }
                  goNext();
                }}
                disabled={!form.crop}
                style={{ ...S.primaryBtn, opacity: form.crop ? 1 : 0.5 }}
              >{t('common.next')}</button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Farm Size ═══════════ */}
        {currentStep === 'farmSize' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDCCF'}</div>
            <h2 style={S.title}>{t('wizard.howBigFarm')}</h2>
            <p style={S.subtitle}>{t('wizard.chooseUnitThenTap')}</p>

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
                        borderColor: isSelected ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.06)',
                        background: isSelected ? 'rgba(34,197,94,0.10)' : '#1E293B',
                      }}
                      aria-pressed={isSelected}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{opt.icon}</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#86EFAC' : '#FFFFFF' }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{subtitle}</span>
                      {isSelected && <span style={{ color: '#86EFAC', fontSize: '0.8rem', fontWeight: 700 }}>{'\u2713'}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Exact size — always visible, not hidden in details */}
              <div style={S.exactSizeRow} data-testid="exact-size-input">
                <span style={S.exactSizeLabel}>{t('wizard.orEnterExact')}</span>
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
                    {form.landSizeUnit === 'HECTARE' ? t('wizard.hectares') : t('wizard.acres')}
                  </span>
                </div>
              </div>
            </div>

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.farmSizeCategory || form.farmSizeAcres ? t('common.next') : t('common.skip')}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Gender ═══════════ */}
        {currentStep === 'gender' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83E\uDDD1\u200D\uD83C\uDF3E'}</div>
            <h2 style={S.title}>{t('wizard.aboutYou')}</h2>
            <p style={S.subtitle}>{t('wizard.helpUnderstand')}</p>
            <div style={S.fieldWide}>
              <TapSelector
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={(v) => setForm(f => ({ ...f, gender: v }))}
                columns={2}
              />
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.gender ? t('common.next') : t('common.skip')}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Age Group ═══════════ */}
        {currentStep === 'age' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83C\uDF82'}</div>
            <h2 style={S.title}>{t('wizard.yourAgeGroup')}</h2>
            <p style={S.subtitle}>{t('wizard.tapAgeRange')}</p>
            <div style={S.fieldWide}>
              <TapSelector
                options={AGE_OPTIONS}
                value={form.ageGroup}
                onChange={(v) => setForm(f => ({ ...f, ageGroup: v }))}
                columns={2}
              />
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.ageGroup ? t('common.next') : t('common.skip')}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Location ═══════════ */}
        {currentStep === 'location' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDCCD'}</div>
            <h2 style={S.title}>{t('wizard.farmLocation')}</h2>
            <p style={S.subtitle}>{t('wizard.tapDetectOrType')}</p>
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
                  {'\uD83D\uDCCC'} {form.locationName || t('location.captured')}
                </div>
              )}
              <input
                value={form.locationName}
                onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
                placeholder={t('onboarding.typeLocation')}
                style={{ ...S.input, marginTop: '0.5rem' }}
              />
            </div>
            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button onClick={goNext} style={S.primaryBtn}>
                {form.locationName || form.latitude ? t('common.next') : t('common.skip')}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════ STEP: Photo ═══════════ */}
        {currentStep === 'photo' && (
          <div style={S.stepContent}>
            <div style={S.stepIcon}>{'\uD83D\uDCF7'}</div>
            <h2 style={S.title}>{t('wizard.profilePhoto')}</h2>
            <p style={S.subtitle}>{t('wizard.optionalHelpsOfficer')}</p>
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
              {photoFile ? t('onboarding.changePhoto') : t('onboarding.takePhoto')}
            </button>
            {photoFile && (
              <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginBottom: '0.5rem', textAlign: 'center' }}>
                {photoFile.name} ({(photoFile.size / 1024).toFixed(0)} KB)
              </div>
            )}

            <div style={S.btnRow}>
              <button onClick={goBack} style={S.secondaryBtn}>{t('common.back')}</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{ ...S.primaryBtn, opacity: submitting ? 0.6 : 1, background: '#22C55E' }}
              >
                {submitting ? t('common.creating') : networkError ? t('common.retry') : photoFile ? t('wizard.createMyFarm') : t('wizard.skipCreateFarm')}
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
            <h2 style={S.title}>{t('wizard.farmCreated')}</h2>
            <p style={S.subtitle}>
              <strong>{form.farmName.trim()}</strong> {t('wizard.isReady')}{'\n'}
              {t('wizard.willReceiveRecs')}
            </p>
            <div style={S.completionTime}>
              {t('wizard.completedIn', { seconds: Math.round((Date.now() - startTimeRef.current) / 1000) })}
            </div>
            <button onClick={() => window.location.reload()} style={S.primaryBtn}>
              {t('wizard.continueToDashboard')}
            </button>
          </div>
        )}

        {/* ── Reset link ── */}
        {step > 0 && step < STEP_KEYS.indexOf('processing') && !showResetConfirm && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button onClick={() => setShowResetConfirm(true)} style={S.resetLink}>
              {t('wizard.startOver')}
            </button>
          </div>
        )}
        {showResetConfirm && (
          <div style={S.resetConfirm}>
            <span style={{ fontSize: '0.82rem', color: '#F59E0B' }}>{t('wizard.clearAllStartOver')}</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleReset} style={{ ...S.secondaryBtn, color: '#EF4444', borderColor: '#EF4444', fontSize: '0.8rem', minHeight: '44px' }}>
                {t('wizard.yesStartOver')}
              </button>
              <button onClick={() => setShowResetConfirm(false)} style={{ ...S.secondaryBtn, fontSize: '0.8rem', minHeight: '44px' }}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step-based processing indicator with timeout + retry ────
const PROCESSING_TIMEOUT_MS = 8000;

function ProcessingStep({ submitting, error, networkError, onRetry, onBack }) {
  const { t } = useTranslation();
  const PROCESSING_STEPS = [
    { label: t('processing.creatingProfile'), icon: '\uD83C\uDFE1' },
    { label: t('processing.settingUpCrop'), icon: '\uD83C\uDF31' },
    { label: t('processing.preparingRecs'), icon: '\u2728' },
  ];
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
        <h2 style={S.title}>{t('processing.takingLonger')}</h2>
        <p style={S.subtitle}>{t('processing.dataSavedWait')}</p>
        <div style={S.btnRow}>
          <button onClick={onBack} style={S.secondaryBtn}>{t('processing.goBack')}</button>
          <button onClick={handleRetry} style={S.primaryBtn}>{t('common.retry')}</button>
        </div>
      </div>
    );
  }

  if (error && !submitting) {
    return (
      <div style={{ ...S.stepContent, textAlign: 'center' }}>
        <div style={S.stepIcon}>{networkError ? '\uD83D\uDCF6' : '\u26A0\uFE0F'}</div>
        <h2 style={S.title}>{networkError ? t('processing.noConnection') : t('processing.somethingWrong')}</h2>
        <p style={{ ...S.subtitle, color: '#EF4444' }}>{error}</p>
        <div style={S.btnRow}>
          <button onClick={onBack} style={S.secondaryBtn}>{t('processing.goBack')}</button>
          <button onClick={handleRetry} style={S.primaryBtn}>{networkError ? t('processing.retryWhenOnline') : t('common.retry')}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...S.stepContent, textAlign: 'center' }}>
      <div style={S.stepIcon}>{'\uD83C\uDF31'}</div>
      <h2 style={S.title}>{t('processing.settingUp')}</h2>
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
    width: '100%', padding: '0.65rem 0.75rem', background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)',
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
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  // Location confirmation card
  locationConfirmCard: {
    width: '100%', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)',
    borderRadius: 12, padding: '1rem', marginBottom: '0.75rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
  },
  locationConfirmIcon: { fontSize: '1.5rem' },
  locationConfirmText: { textAlign: 'center', lineHeight: 1.4 },
  locationConfirmActions: {
    display: 'flex', gap: '0.5rem', marginTop: '0.25rem', width: '100%',
  },
  confirmBtn: {
    flex: 1, padding: '0.55rem 0.75rem', background: '#22C55E', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem',
    cursor: 'pointer', minHeight: 44,
  },
  changeBtn: {
    flex: 1, padding: '0.55rem 0.75rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontWeight: 600,
    fontSize: '0.85rem', cursor: 'pointer', minHeight: 44,
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
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem',
    cursor: 'pointer', minHeight: '52px', WebkitTapHighlightColor: 'transparent',
  },
  // U.S. farm-type step
  usLabel: { display: 'flex', flexDirection: 'column', gap: '0.375rem', width: '100%' },
  usLabelText: {
    fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  usSelect: {
    width: '100%', padding: '0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#1E293B', color: '#fff', fontSize: '0.9375rem',
    minHeight: '48px',
  },
  // Experience level
  experienceBtn: {
    display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
    padding: '1.1rem 1rem', minHeight: '72px', width: '100%', textAlign: 'left',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px',
    cursor: 'pointer', background: '#1E293B', color: '#fff',
    WebkitTapHighlightColor: 'transparent', transition: 'background 0.2s, border-color 0.2s',
  },
  experienceBtnIcon: { fontSize: '1.75rem', flexShrink: 0, marginTop: '0.1rem' },
  experienceBtnTitle: { fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.2rem' },
  experienceBtnDesc: { fontSize: '0.82rem', color: '#A1A1AA', lineHeight: 1.4 },
  // Crop group labels
  cropGroupLabel: {
    fontSize: '0.72rem', fontWeight: 700, color: '#22C55E', textTransform: 'uppercase',
    letterSpacing: '0.04em', marginBottom: '0.35rem', paddingLeft: '0.15rem',
  },
  // Top crops
  topCropGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
    marginBottom: '0.5rem',
  },
  topCropBtn: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
    padding: '0.7rem 0.4rem', minHeight: '72px',
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', cursor: 'pointer',
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
    border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', cursor: 'pointer',
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
