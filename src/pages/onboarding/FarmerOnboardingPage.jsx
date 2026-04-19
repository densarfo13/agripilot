/**
 * FarmerOnboardingPage — smart, region-aware onboarding.
 *
 * Flow:
 *   1. Location          (country + state + optional city + GPS)
 *   2. Experience        (new vs experienced)
 *   3. Farm size         (small / medium / large)
 *   4. Farm type         (backyard / small_farm / commercial)
 *   5. Crop recommendation (filtered by everything above)
 *
 * Each step is its own component under /components/onboarding for
 * clean testing. This page owns the aggregate form state + nav.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import LocationStep from '../../components/onboarding/LocationStep.jsx';
import ExperienceStep from '../../components/onboarding/ExperienceStep.jsx';
import FarmSizeStep from '../../components/onboarding/FarmSizeStep.jsx';
import FarmTypeStep from '../../components/onboarding/FarmTypeStep.jsx';
import CropRecommendationStep from '../../components/onboarding/CropRecommendationStep.jsx';

const STEPS = ['location', 'experience', 'size', 'farmType', 'crops'];

// Pre-fill farmType from the size answer so the user can skip it
// when the mapping is obvious.
function defaultFarmType(size) {
  if (size === 'small') return 'backyard';
  if (size === 'medium') return 'small_farm';
  if (size === 'large') return 'commercial';
  return null;
}

export default function FarmerOnboardingPage({ onComplete }) {
  const { t, region, setRegion } = useAppSettings();
  const navigate = useNavigate();
  const [stepIdx, setStepIdx] = useState(0);
  const [form, setForm] = useState(() => ({
    location: { country: region?.country || 'US', stateCode: region?.stateCode || '', city: '' },
    experience: null,
    farmSize: null,
    farmType: null,
    pickedCrop: null,
  }));

  const step = STEPS[stepIdx];

  function back() { setStepIdx((i) => Math.max(0, i - 1)); }
  function next() { setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)); }

  function handleLocation(loc) {
    setForm((f) => ({ ...f, location: loc }));
  }
  function handleExperience(level) {
    setForm((f) => ({ ...f, experience: level }));
  }
  function handleSize(size) {
    setForm((f) => ({ ...f, farmSize: size, farmType: f.farmType || defaultFarmType(size?.size) }));
  }
  function handleFarmType(ft) {
    setForm((f) => ({ ...f, farmType: ft }));
  }
  function handlePickCrop(crop) {
    setForm((f) => ({ ...f, pickedCrop: crop }));
    // Persist the region choice so the rest of the app reads it.
    if (form.location?.country) {
      setRegion({ country: form.location.country, stateCode: form.location.stateCode || null });
    }
    onComplete?.({ ...form, pickedCrop: crop });
    navigate('/today');
  }

  const progressPct = useMemo(
    () => Math.round(((stepIdx + 1) / STEPS.length) * 100),
    [stepIdx],
  );

  return (
    <div style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <div style={S.progressBar}>
            <div style={{ ...S.progressFill, width: `${progressPct}%` }} />
          </div>
          <p style={S.progressLabel}>
            {t('onboarding.progress', { current: stepIdx + 1, total: STEPS.length })}
          </p>
        </header>

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
        {step === 'size' && (
          <FarmSizeStep
            value={form.farmSize}
            onChange={handleSize}
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
        {step === 'crops' && (
          <CropRecommendationStep
            onboarding={form}
            onPick={handlePickCrop}
            onBack={back}
          />
        )}
      </div>
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
};
