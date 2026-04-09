import React, { useState, useEffect, useCallback, useRef } from 'react';
import CropSelect from './CropSelect.jsx';
import LocationDetect from './LocationDetect.jsx';
import { useDraft } from '../utils/useDraft.js';
import { compressImage } from '../utils/imageCompress.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { UNIT_OPTIONS, computeLandSizeFields } from '../utils/landSize.js';

const STAGES = [
  { value: 'planting', label: 'Planting' },
  { value: 'growing', label: 'Growing' },
  { value: 'flowering', label: 'Flowering' },
  { value: 'harvest', label: 'Harvest' },
];

const STEP_KEYS = ['welcome', 'farm', 'crop', 'photo', 'processing'];
const STEP_LABELS = ['Welcome', 'Farm Details', 'Crop', 'Photo', 'Creating'];

// Inject spinner keyframe once
if (typeof document !== 'undefined' && !document.getElementById('farroway-spin')) {
  const style = document.createElement('style');
  style.id = 'farroway-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(style);
}

// ─── Operational logging (fire-and-forget) ───────────────
function logOnboarding(event, detail = {}) {
  try {
    const entry = { ts: new Date().toISOString(), event, ...detail };
    // Append to a small in-memory + localStorage ring buffer for debugging
    const LOG_KEY = 'farroway:onboarding_log';
    const prev = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    prev.push(entry);
    // Keep last 50 entries
    if (prev.length > 50) prev.splice(0, prev.length - 50);
    localStorage.setItem(LOG_KEY, JSON.stringify(prev));
  } catch { /* storage full or unavailable — ignore */ }
}

const INITIAL_FORM = {
  farmName: '', farmSizeAcres: '', landSizeUnit: 'ACRE', locationName: '',
  crop: '', stage: 'planting',
  latitude: null, longitude: null,
};

export default function OnboardingWizard({ userName, countryCode, onComplete }) {
  // ─── Draft persistence: form data survives refresh/navigation ───
  const { state: draft, setState: setDraft, clearDraft, draftRestored } = useDraft(
    'onboarding-wizard',
    { step: 0, form: INITIAL_FORM }
  );

  // Guard against stale/corrupt drafts: if draft step is beyond valid range, reset
  const safeDraftStep = (draft.step >= 0 && draft.step <= 3) ? draft.step : 0;
  const safeDraftForm = draft.form?.farmName !== undefined ? { ...INITIAL_FORM, ...draft.form } : INITIAL_FORM;

  const [step, setStepRaw] = useState(safeDraftStep);
  const [form, setFormRaw] = useState(safeDraftForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState(draftRestored ? 'restored' : null); // null | 'saving' | 'saved' | 'restored'
  const [networkError, setNetworkError] = useState(false);
  const submitGuardRef = useRef(false);

  const currentStep = STEP_KEYS[step];

  // ─── Sync step + form to draft on every change ───────────
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
      // Brief "saved" flash
      setSaveStatus('saving');
      return next;
    });
  }, [setDraft]);

  // Show "saved" status briefly after draft writes
  useEffect(() => {
    if (saveStatus === 'saving') {
      const t = setTimeout(() => setSaveStatus('saved'), 300);
      const t2 = setTimeout(() => setSaveStatus(null), 2000);
      return () => { clearTimeout(t); clearTimeout(t2); };
    }
  }, [saveStatus]);

  // Track onboarding started
  useEffect(() => {
    trackPilotEvent('onboarding_started', { restored: !!draftRestored, step: STEP_KEYS[safeDraftStep] });
  }, []);

  // Show draft-restored banner briefly
  useEffect(() => {
    if (draftRestored) {
      logOnboarding('draft_restored', { step: STEP_KEYS[draft.step], form: draft.form });
      const t = setTimeout(() => setSaveStatus(null), 4000);
      return () => clearTimeout(t);
    }
  }, []);

  // ─── Browser back button support ────────────────────────
  const prevStepRef = useRef(step);
  useEffect(() => {
    const handlePopState = (e) => {
      // Go back one step, but never below 0
      setStep(s => Math.max(0, s - 1));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Push history entry only when step increases (forward navigation)
  useEffect(() => {
    if (step > prevStepRef.current && step > 0 && step < 4) {
      window.history.pushState({ onboardingStep: step }, '');
    }
    prevStepRef.current = step;
  }, [step]);

  // ─── Validation ─────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (currentStep === 'farm') {
      if (!form.farmName.trim()) errs.farmName = 'Farm name is required.';
      if (form.farmSizeAcres && (isNaN(Number(form.farmSizeAcres)) || Number(form.farmSizeAcres) < 0)) {
        errs.farmSizeAcres = 'Enter a valid farm size.';
      }
    }
    if (currentStep === 'crop') {
      if (!form.crop) errs.crop = 'Please select a crop.';
      // If OTHER is selected, the CropSelect handles the custom name validation
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      logOnboarding('validation_failed', { step: currentStep, errors: errs });
      trackPilotEvent('validation_failed', { context: 'onboarding', step: currentStep, fields: Object.keys(errs) });
    }
    return Object.keys(errs).length === 0;
  };

  const canProceed = () => {
    if (currentStep === 'farm') return form.farmName.trim().length > 0;
    if (currentStep === 'crop') return form.crop.length > 0;
    return true;
  };

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
    // Compress before storing (reduces upload size on mobile)
    const compressed = await compressImage(f, { maxWidth: 800, quality: 0.8 });
    setPhotoFile(compressed);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(compressed);
  };

  const handleNext = async () => {
    setError('');
    logOnboarding('next_clicked', { step: currentStep });

    if (!validate()) return;

    if (currentStep === 'photo') {
      // Prevent double-submit
      if (submitGuardRef.current) return;
      submitGuardRef.current = true;

      setStep(4); // processing
      setSubmitting(true);
      setNetworkError(false);
      try {
        const ls = form.farmSizeAcres ? computeLandSizeFields(form.farmSizeAcres, form.landSizeUnit) : {};
        await onComplete({
          farmName: form.farmName.trim(),
          farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : null,
          landSizeValue: ls.landSizeValue ?? null,
          landSizeUnit: ls.landSizeUnit ?? null,
          landSizeHectares: ls.landSizeHectares ?? null,
          locationName: form.locationName.trim() || null,
          latitude: form.latitude || null,
          longitude: form.longitude || null,
          crop: form.crop,
          stage: form.stage,
          photoFile: photoFile || null,
        });
        // Success — clear the draft
        clearDraft();
        logOnboarding('onboarding_completed');
      } catch (err) {
        setStep(3); // go back to photo on error
        setSubmitting(false);
        submitGuardRef.current = false;
        const isNetwork = !err?.response && (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error' || !navigator.onLine);
        setNetworkError(isNetwork);
        const msg = isNetwork
          ? 'No internet connection. Your data is saved — tap "Retry" when you\'re back online.'
          : err?.response?.data?.error || err?.message || 'Something went wrong. Please try again.';
        setError(msg);
        logOnboarding('async_save_failed', { step: currentStep, error: msg, isNetwork });
      }
      return;
    }
    setStep(s => s + 1);
  };

  const handleReset = () => {
    setFormRaw({ ...INITIAL_FORM });
    setStepRaw(0);
    setPhotoFile(null);
    setPhotoPreview(null);
    setError('');
    setFieldErrors({});
    clearDraft();
    setShowResetConfirm(false);
    logOnboarding('onboarding_reset');
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Step indicator with labels */}
        <div style={styles.stepIndicator}>
          {STEP_KEYS.slice(0, 4).map((key, i) => (
            <div key={key} style={styles.stepDot}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: i < step ? '#22C55E' : i === step ? '#22C55E' : '#243041',
                color: i <= step ? '#fff' : '#71717A',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700,
                transition: 'all 0.3s',
              }}>
                {i < step ? '✓' : i + 1}
              </div>
              <div style={{
                fontSize: '0.65rem', color: i <= step ? '#A1A1AA' : '#4A5568',
                marginTop: 2, textAlign: 'center', fontWeight: i === step ? 600 : 400,
              }}>
                {STEP_LABELS[i]}
              </div>
            </div>
          ))}
        </div>

        {/* Draft restored banner */}
        {saveStatus === 'restored' && (
          <div style={styles.draftBanner}>
            ↻ Your previous progress was restored automatically.
          </div>
        )}

        {/* Save status indicator */}
        {saveStatus === 'saved' && step > 0 && step < 4 && (
          <div style={styles.savedIndicator}>✓ Draft saved</div>
        )}

        {currentStep === 'welcome' && (
          <div style={styles.stepContent}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</div>
            <h2 style={styles.title}>Welcome to Farroway</h2>
            <p style={styles.subtitle}>
              Hi {userName || 'there'}! Let's set up your farm in just a few steps so we can give you personalised recommendations.
            </p>
            <button onClick={handleNext} style={styles.primaryBtn}>Get Started</button>
          </div>
        )}

        {currentStep === 'farm' && (
          <div style={styles.stepContent}>
            <h2 style={styles.title}>Your Farm</h2>
            <p style={styles.subtitle}>Tell us about your farm — only the name is required</p>
            {error && <div style={styles.errorBox}>{error}</div>}
            <div style={styles.field}>
              <label style={styles.label}>Farm Name *</label>
              <input
                value={form.farmName}
                onChange={e => { setForm(f => ({ ...f, farmName: e.target.value })); setFieldErrors(fe => ({ ...fe, farmName: undefined })); }}
                placeholder="e.g. Sunrise Farm"
                style={{
                  ...styles.input,
                  borderColor: fieldErrors.farmName ? '#EF4444' : form.farmName.trim().length > 0 ? '#22C55E' : '#374151',
                }}
                autoFocus
              />
              {fieldErrors.farmName && (
                <div style={styles.fieldError}>{fieldErrors.farmName}</div>
              )}
              {!fieldErrors.farmName && form.farmName.trim().length === 0 && (
                <div style={{ fontSize: '0.72rem', color: '#F59E0B', marginTop: '0.25rem' }}>Required — give your farm a name</div>
              )}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Farm Size <span style={{ color: '#71717A', fontWeight: 400 }}>optional</span></label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={form.farmSizeAcres}
                  onChange={e => { setForm(f => ({ ...f, farmSizeAcres: e.target.value })); setFieldErrors(fe => ({ ...fe, farmSizeAcres: undefined })); }}
                  placeholder="e.g. 5"
                  type="number"
                  min="0"
                  step="0.1"
                  style={{
                    ...styles.input,
                    flex: 1,
                    borderColor: fieldErrors.farmSizeAcres ? '#EF4444' : '#243041',
                  }}
                />
                <select
                  value={form.landSizeUnit}
                  onChange={e => setForm(f => ({ ...f, landSizeUnit: e.target.value }))}
                  style={{ ...styles.input, flex: '0 0 auto', width: 'auto', minWidth: '7rem' }}
                >
                  {UNIT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {fieldErrors.farmSizeAcres && (
                <div style={styles.fieldError}>{fieldErrors.farmSizeAcres}</div>
              )}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Location <span style={{ color: '#71717A', fontWeight: 400 }}>optional</span></label>
              <LocationDetect
                compact
                label="Use current location"
                onDetected={(loc) => {
                  const name = [loc.locality, loc.region, loc.country].filter(Boolean).join(', ');
                  setForm(f => ({
                    ...f,
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                    locationName: name || f.locationName,
                  }));
                }}
                style={{ marginBottom: '0.4rem' }}
              />
              <input
                value={form.locationName}
                onChange={e => setForm(f => ({ ...f, locationName: e.target.value }))}
                placeholder="e.g. Nakuru, Kenya"
                style={styles.input}
              />
              {form.latitude && (
                <div style={{ fontSize: '0.68rem', color: '#22C55E', marginTop: '0.2rem' }}>
                  GPS: {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)} — edit the name above if needed
                </div>
              )}
            </div>
            <div style={styles.btnRow}>
              <button onClick={() => setStep(0)} style={styles.secondaryBtn}>Back</button>
              <button onClick={handleNext} disabled={!canProceed()} style={{
                ...styles.primaryBtn, opacity: canProceed() ? 1 : 0.5,
              }}>Next</button>
            </div>
          </div>
        )}

        {currentStep === 'crop' && (
          <div style={styles.stepContent}>
            <h2 style={styles.title}>What are you growing?</h2>
            <p style={styles.subtitle}>Search and select your primary crop</p>
            {error && <div style={styles.errorBox}>{error}</div>}
            <div style={styles.field}>
              <CropSelect
                value={form.crop}
                onChange={(v) => { setForm(f => ({ ...f, crop: v })); setFieldErrors(fe => ({ ...fe, crop: undefined })); }}
                countryCode={countryCode}
                placeholder="Search crops..."
                required
              />
              {fieldErrors.crop && (
                <div style={styles.fieldError}>{fieldErrors.crop}</div>
              )}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Current Stage</label>
              <select
                value={form.stage}
                onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
                style={styles.input}
              >
                {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div style={styles.btnRow}>
              <button onClick={() => setStep(1)} style={styles.secondaryBtn}>Back</button>
              <button onClick={handleNext} disabled={!canProceed()} style={{
                ...styles.primaryBtn, opacity: canProceed() ? 1 : 0.5,
              }}>Next</button>
            </div>
          </div>
        )}

        {currentStep === 'photo' && (
          <div style={styles.stepContent}>
            <h2 style={styles.title}>Add a Profile Photo</h2>
            <p style={styles.subtitle}>Optional — helps your field officer recognize you</p>
            {error && <div style={styles.errorBox}>{error}</div>}

            {/* Preview */}
            <div style={{ marginBottom: '1rem' }}>
              {photoPreview ? (
                <div style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '3px solid #22C55E', margin: '0 auto' }}>
                  <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ) : (
                <div style={{
                  width: 100, height: 100, borderRadius: '50%', margin: '0 auto',
                  background: '#1E293B', border: '2px dashed #374151',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2rem', color: '#374151',
                }}>
                  {'\uD83D\uDCF7'}
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              id="onboarding-photo-input"
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => document.getElementById('onboarding-photo-input')?.click()}
              style={{ ...styles.secondaryBtn, width: '100%', marginBottom: '0.5rem' }}
            >
              {photoFile ? 'Choose Different Photo' : 'Choose Photo'}
            </button>
            {photoFile && (
              <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginBottom: '0.5rem', textAlign: 'center' }}>
                {photoFile.name} ({(photoFile.size / 1024).toFixed(0)} KB)
              </div>
            )}

            <div style={styles.btnRow}>
              <button onClick={() => setStep(2)} style={styles.secondaryBtn}>Back</button>
              <button onClick={handleNext} disabled={submitting} style={{
                ...styles.primaryBtn,
                opacity: submitting ? 0.6 : 1,
              }}>
                {submitting ? 'Creating...' : networkError ? 'Retry' : photoFile ? 'Create My Farm' : 'Skip & Create Farm'}
              </button>
            </div>
          </div>
        )}

        {currentStep === 'processing' && (
          <div style={{ ...styles.stepContent, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
            <h2 style={styles.title}>Setting up your farm...</h2>
            <p style={styles.subtitle}>
              We're creating your farm profile and preparing your first recommendations.
            </p>
            <div style={styles.spinner} />
          </div>
        )}

        {/* Reset onboarding — deliberate user action only */}
        {step > 0 && step < 4 && !showResetConfirm && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button onClick={() => setShowResetConfirm(true)} style={styles.resetLink}>
              Start over
            </button>
          </div>
        )}
        {showResetConfirm && (
          <div style={styles.resetConfirm}>
            <span style={{ fontSize: '0.82rem', color: '#F59E0B' }}>This will clear all entered data. Are you sure?</span>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleReset} style={{ ...styles.secondaryBtn, color: '#EF4444', borderColor: '#EF4444', padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                Yes, start over
              </button>
              <button onClick={() => setShowResetConfirm(false)} style={{ ...styles.secondaryBtn, padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
  },
  modal: {
    background: '#162033', borderRadius: '12px', padding: '2rem',
    maxWidth: '420px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  stepIndicator: {
    display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem',
  },
  stepDot: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  stepContent: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  title: { margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' },
  subtitle: { color: '#A1A1AA', fontSize: '0.9rem', textAlign: 'center', margin: '0 0 1.5rem', lineHeight: 1.5 },
  field: { width: '100%', marginBottom: '1rem' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#A1A1AA', marginBottom: '0.3rem' },
  input: {
    width: '100%', padding: '0.6rem 0.75rem', background: '#1E293B', border: '1px solid #243041',
    borderRadius: '6px', color: '#FFFFFF', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  },
  btnRow: { display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' },
  primaryBtn: {
    flex: 1, padding: '0.7rem', background: '#22C55E', color: '#fff', border: 'none',
    borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '0.7rem 1.2rem', background: 'transparent', color: '#A1A1AA',
    border: '1px solid #243041', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
  },
  spinner: {
    width: '32px', height: '32px', border: '3px solid #243041', borderTop: '3px solid #22C55E',
    borderRadius: '50%', animation: 'spin 1s linear infinite', marginTop: '1rem',
  },
  errorBox: {
    width: '100%', background: 'rgba(239,68,68,0.12)', color: '#EF4444',
    border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
    padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem',
    textAlign: 'center', lineHeight: 1.4,
  },
  fieldError: {
    fontSize: '0.72rem', color: '#EF4444', marginTop: '0.25rem',
  },
  draftBanner: {
    background: 'rgba(34,197,94,0.12)', color: '#22C55E',
    border: '1px solid rgba(34,197,94,0.25)', borderRadius: '8px',
    padding: '0.5rem 0.75rem', fontSize: '0.8rem', textAlign: 'center',
    marginBottom: '1rem', lineHeight: 1.4,
  },
  savedIndicator: {
    textAlign: 'center', fontSize: '0.7rem', color: '#22C55E',
    marginBottom: '0.5rem', opacity: 0.7,
  },
  resetLink: {
    background: 'none', border: 'none', color: '#71717A', fontSize: '0.75rem',
    cursor: 'pointer', textDecoration: 'underline',
  },
  resetConfirm: {
    textAlign: 'center', marginTop: '0.75rem', padding: '0.75rem',
    background: 'rgba(245,158,11,0.08)', borderRadius: '8px',
    border: '1px solid rgba(245,158,11,0.2)',
  },
};
