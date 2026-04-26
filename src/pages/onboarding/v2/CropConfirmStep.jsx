/**
 * CropConfirmStep — step 7. A small confirmation surface that
 * summarises the farmer's choice before they see the first value.
 * Caller supplies:
 *   getCropLabelSafe(crop, language)   → string
 *   getPlantingStatus(crop, state) → { stage, label }  (optional)
 *   getReasons(crop, state)        → string[]          (optional)
 */

import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import { useTranslation } from '../../../i18n/index.js';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function CropConfirmStep({
  state = {}, patch = () => {}, t = null,
  onBack = null, onNext = null,
  getCropLabel = (c) => c,
  getPlantingStatus = null,
  getReasons = null,
}) {
  const crop = state.selectedCrop;
  const cropLabel = crop ? getCropLabelSafe(crop, state.language) : '';
  const status = crop && typeof getPlantingStatus === 'function'
    ? getPlantingStatus(crop, state) : null;
  const reasons = crop && typeof getReasons === 'function'
    ? (getReasons(crop, state) || []) : [];

  const titleTemplate = resolve(t, 'onboardingV2.cropConfirm.title', 'Start with {crop}');
  const title = titleTemplate.replace('{crop}', cropLabel);

  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.CROP_CONFIRM}
      t={t}
      title={title}
      onBack={onBack}
      onNext={onNext}
      nextLabel={resolve(t, 'onboardingV2.cropConfirm.startBtn', 'Start my plan')}
      nextDisabled={!crop}
    >
      {!crop && (
        <p style={{ color: '#607d8b' }}>
          {resolve(t, 'onboardingV2.recommendations.emptyState',
            'We need a little more info before we can suggest crops for your region.')}
        </p>
      )}

      {crop && (
        <div
          style={{
            border: '1px solid #cfd8dc', borderRadius: 12,
            padding: 16, background: '#fff',
          }}
        >
          <div style={{ fontSize: 13, color: '#78909c', fontWeight: 600 }}>
            {resolve(t, 'onboardingV2.cropConfirm.statusLabel', 'Current planting status')}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#263238', margin: '4px 0 10px' }}>
            {status?.label || '—'}
          </div>
          {reasons.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, color: '#546e7a', fontSize: 14, lineHeight: 1.5 }}>
              {reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}

      {crop && (
        <button
          type="button"
          onClick={() => patch({ selectedCrop: null })}
          style={{
            marginTop: 12, background: 'transparent', border: 0,
            color: '#607d8b', cursor: 'pointer', fontSize: 13,
          }}
        >
          ← {resolve(t, 'onboardingV2.cropConfirm.changeBtn', 'Change crop')}
        </button>
      )}
    </OnboardingShell>
  );
}
