/**
 * FarmerOnboardingPage — smart, region-aware onboarding.
 *
 * Flow (canonical, enforced by onboardingFlow.ONBOARDING_STEPS):
 *   1. Location           (country + state + optional city + GPS)
 *   2. Experience         (new vs experienced)
 *   3. Farm type          (backyard / small_farm / commercial)
 *   4. Farm size          (small / medium / large + optional exact)
 *   5. Crop recommendation (filtered by everything above)
 *
 * Progress is driven by `onboardingFlow.isStepValid`, not by the raw
 * step index — so the progress bar only moves when the farmer's
 * actually filled in real data. On a valid save the router is handed
 * a `state` blob carrying the full recommendation context so the
 * crop-plan page can show the "why" without re-fetching.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import LocationStep from '../../components/onboarding/LocationStep.jsx';
import ExperienceStep from '../../components/onboarding/ExperienceStep.jsx';
import FarmSizeStep from '../../components/onboarding/FarmSizeStep.jsx';
import FarmTypeStep from '../../components/onboarding/FarmTypeStep.jsx';
import CropRecommendationStep from '../../components/onboarding/CropRecommendationStep.jsx';
import {
  ONBOARDING_STEPS,
  getOnboardingProgress,
  buildPostSaveRoute,
  buildProfileForValidation,
} from '../../utils/onboardingFlow.js';
import { validateFarmProfile, VALIDATION_I18N_KEYS } from '../../utils/validateFarmProfile.js';
import { tSafe } from '../../i18n/tSafe.js';

// Pre-fill farmType from the size answer when the mapping is obvious
// (only used as a fallback — users answer farmType first now).
function defaultFarmTypeFromSize(size) {
  if (size === 'small') return 'backyard';
  if (size === 'medium') return 'small_farm';
  if (size === 'large') return 'commercial';
  return null;
}

async function saveFarmProfileToServer(profile) {
  try {
    const r = await fetch('/api/v2/farm-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profile),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export default function FarmerOnboardingPage({ onComplete }) {
  const { t, region, setRegion } = useAppSettings();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [saveState, setSaveState] = useState({ saving: false, errors: null });
  const [form, setForm] = useState(() => ({
    location: { country: region?.country || 'US', stateCode: region?.stateCode || '', city: '' },
    experience: null,
    farmType: null,
    farmSize: null,
    pickedCrop: null,
  }));

  const step = ONBOARDING_STEPS[stepIdx];
  const progress = useMemo(() => getOnboardingProgress(form), [form]);

  function back() { setStepIdx((i) => Math.max(0, i - 1)); }
  function next() { setStepIdx((i) => Math.min(ONBOARDING_STEPS.length - 1, i + 1)); }

  function handleLocation(loc) { setForm((f) => ({ ...f, location: loc })); }
  function handleExperience(level) { setForm((f) => ({ ...f, experience: level })); }
  function handleFarmType(ft) { setForm((f) => ({ ...f, farmType: ft })); }
  function handleSize(size) {
    setForm((f) => ({
      ...f,
      farmSize: size,
      // only auto-fill farmType if the user hasn't picked one (they
      // should have by this point since farmType now comes first).
      farmType: f.farmType || defaultFarmTypeFromSize(size?.size),
    }));
  }

  async function handlePickCrop(crop) {
    const nextForm = { ...form, pickedCrop: crop };
    setForm(nextForm);

    // Validate before saving — give the user a clear error if
    // something critical is missing.
    const profile = buildProfileForValidation(nextForm);
    const validation = validateFarmProfile(profile);
    if (!validation.isValid) {
      setSaveState({ saving: false, errors: validation.errors });
      return;
    }

    setSaveState({ saving: true, errors: null });

    // Persist the region choice so the rest of the app reads it.
    const loc = nextForm.location;
    if (loc?.country) {
      setRegion({ country: loc.country, stateCode: loc.stateCode || null });
    }

    // Fire-and-forget server save — a failure doesn't block the
    // user from moving on (local storage still has their data).
    await saveFarmProfileToServer(profile);

    onComplete?.(nextForm);
    setSaveState({ saving: false, errors: null });

    const route = buildPostSaveRoute(nextForm);
    if (route) navigate(route.path, { state: route.state });
    else navigate('/today');
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progress.percent}%` }} />
          </div>
          <p style={S.progressLabel}>
            {t('onboarding.progress', { current: progress.completed, total: progress.total })}
          </p>
        </header>

        {saveState.errors && <ValidationSummary errors={saveState.errors} t={t} />}

        {step === 'location' && (
          <LocationStep value={form.location} onChange={handleLocation} onNext={next} />
        )}
        {step === 'experience' && (
          <ExperienceStep
            value={form.experience}
            onChange={handleExperience}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 'farmType' && (
          <FarmTypeStep
            value={form.farmType}
            onChange={handleFarmType}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 'farmSize' && (
          <FarmSizeStep
            value={form.farmSize}
            onChange={handleSize}
            onNext={next}
            onBack={back}
          />
        )}
        {step === 'crops' && (
          <CropRecommendationStep
            onboarding={form}
            onPick={handlePickCrop}
            onBack={back}
            saving={saveState.saving}
          />
        )}
      </div>
    </div>
  );
}

function ValidationSummary({ errors, t }) {
  const items = Object.entries(errors || {});
  if (!items.length) return null;
  return (
    <div style={S.errBox} role="alert" data-testid="onboarding-validation-errors">
      <div style={S.errTitle}>{tSafe('onboarding.validation.title', '')}</div>
      <ul style={S.errList}>
        {items.map(([field, code]) => {
          const key = VALIDATION_I18N_KEYS[code] || 'validation.required';
          return (
            <li key={field} style={S.errItem}>
              <strong>{t(`onboarding.fields.${field}`) || field}</strong>: {t(key) || code}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '32rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '1rem' },
  header: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  progressBar: {
    width: '100%', height: '6px', borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
  },
  progressFill: { height: '100%', background: '#22C55E', transition: 'width 0.25s' },
  progressLabel: { fontSize: '0.75rem', color: '#9FB3C8', margin: 0 },
  errBox: {
    padding: '0.75rem 1rem', borderRadius: '12px',
    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
    color: '#EAF2FF',
  },
  errTitle: { fontSize: '0.875rem', fontWeight: 700, color: '#FCA5A5', marginBottom: '0.375rem' },
  errList: { margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem' },
  errItem: { color: '#EAF2FF', lineHeight: 1.4 },
};
