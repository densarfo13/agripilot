/**
 * RecommendationsStepV2 — step 6. The first big value moment.
 * Renders three sections:
 *   • Best for you      — 3 or 5 top cards (mode-aware)
 *   • Also possible     — collapsed list the user can browse
 *   • Not recommended   — collapsed by default, "Show more" toggle
 *
 * Caller supplies:
 *   getRecommendations(state) → Promise<crops[]>
 *   getCropLabelSafe(crop, language) → string
 *
 * The screen deliberately renders nothing beyond these sections —
 * no generic "all crops" grid per the spec.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../../i18n/index.js';
import OnboardingShell from '../../../components/onboarding/v2/OnboardingShell.jsx';
import RecommendationCropCard from '../../../components/onboarding/v2/RecommendationCropCard.jsx';
import { ONBOARDING_STEPS } from '../../../utils/onboardingV2/stepIds.js';
import { filterRecommendations } from '../../../utils/onboardingV2/filterRecommendations.js';
import { getCropLabelSafe } from '../../../utils/crops.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

export default function RecommendationsStepV2({
  state = {}, patch = () => {}, t = null,
  onBack = null, onNext = null,
  getRecommendations = null,
  getCropLabel = (crop) => crop,
  mode = null,
}) {
  const effectiveMode = mode || state.mode || 'farm';
  const [loading, setLoading] = useState(true);
  const [rawCrops, setRawCrops] = useState([]);
  const [showNotRec, setShowNotRec] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let result = [];
      try {
        if (typeof getRecommendations === 'function') {
          result = (await getRecommendations(state)) || [];
        }
      } catch { result = []; }
      if (!active) return;
      setRawCrops(Array.isArray(result) ? result : []);
      setLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buckets = useMemo(() => filterRecommendations(rawCrops, {
    mode: effectiveMode,
    experienced: state.experience === 'experienced',
  }), [rawCrops, effectiveMode, state.experience]);

  const title = resolve(t, 'onboardingV2.recommendations.title',
    'Best crops for your location');
  const subtitle = resolve(t, 'onboardingV2.recommendations.subtitle',
    'Based on your location, experience, and growing setup');
  const bestLabel = resolve(t, 'onboardingV2.recommendations.best',    'Best for you');
  const alsoLabel = resolve(t, 'onboardingV2.recommendations.also',    'Also possible');
  const notLabel  = resolve(t, 'onboardingV2.recommendations.notRecommended',
    'Not recommended');
  const showMoreLabel = resolve(t, 'onboardingV2.recommendations.showNotRecommended',
    'Show crops that fit less well');

  const select = (crop) => patch({ selectedCrop: crop });

  return (
    <OnboardingShell
      step={ONBOARDING_STEPS.RECOMMENDATIONS}
      t={t}
      title={title}
      helper={subtitle}
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!state.selectedCrop}
    >
      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: '#90a4ae' }}>…</div>
      )}

      {!loading && buckets.totals.all === 0 && (
        <p style={{ padding: 16, color: '#78909c', fontSize: 15 }}>
          {resolve(t, 'onboardingV2.recommendations.emptyState',
            'We need a little more info before we can suggest crops for your region.')}
        </p>
      )}

      {!loading && buckets.bestForYou.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h3 style={sectionH}>{bestLabel}</h3>
          {buckets.bestForYou.map((c) => (
            <RecommendationCropCard
              key={c.crop}
              crop={c.crop}
              label={getCropLabelSafe(c.crop, state.language)}
              tier="best"
              beginnerFriendly={c.beginnerFriendly}
              supportDepth={c.supportDepth}
              reasons={c.reasons}
              selected={state.selectedCrop === c.crop}
              onSelect={select}
              t={t}
            />
          ))}
        </section>
      )}

      {!loading && buckets.alsoPossible.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h3 style={sectionH}>{alsoLabel}</h3>
          {buckets.alsoPossible.map((c) => (
            <RecommendationCropCard
              key={c.crop}
              crop={c.crop}
              label={getCropLabelSafe(c.crop, state.language)}
              tier="also"
              beginnerFriendly={c.beginnerFriendly}
              supportDepth={c.supportDepth}
              reasons={c.reasons}
              selected={state.selectedCrop === c.crop}
              onSelect={select}
              t={t}
            />
          ))}
        </section>
      )}

      {!loading && buckets.notRecommended.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          {!showNotRec && (
            <button type="button" onClick={() => setShowNotRec(true)}
              style={{
                width: '100%', padding: '10px 12px',
                borderRadius: 8, border: '1px dashed #b0bec5',
                background: '#fafafa', color: '#607d8b', cursor: 'pointer',
                fontSize: 13,
              }}
            >
              ▸ {showMoreLabel}
            </button>
          )}
          {showNotRec && (
            <>
              <h3 style={{ ...sectionH, color: '#b71c1c' }}>{notLabel}</h3>
              {buckets.notRecommended.map((c) => (
                <RecommendationCropCard
                  key={c.crop}
                  crop={c.crop}
                  label={getCropLabelSafe(c.crop, state.language)}
                  tier="not"
                  reasons={c.reasons}
                  selected={state.selectedCrop === c.crop}
                  onSelect={select}
                  t={t}
                />
              ))}
            </>
          )}
        </section>
      )}
    </OnboardingShell>
  );
}

const sectionH = {
  margin: '4px 0 8px',
  fontSize: 13, fontWeight: 700,
  color: '#37474f', textTransform: 'uppercase', letterSpacing: 0.3,
};
