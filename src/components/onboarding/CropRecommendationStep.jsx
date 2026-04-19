/**
 * CropRecommendationStep — the heart of smart onboarding.
 *
 *   - Calls getRecommendedCropsForOnboarding() with the collected
 *     inputs, groups into Best / Possible / Not recommended.
 *   - Applies beginner + farm-size filters client-side.
 *   - Renders crop cards with fit badge, beginner-friendly flag,
 *     planting status, and a short reason.
 *   - Offers "Pick the best crop for me" to skip manual choice.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import {
  getRecommendedCropsForOnboarding,
  filterCropsByBeginnerStatus, filterCropsByFarmSize,
  categorizeCropsByFit, pickTopCrop,
} from '../../utils/onboardingCropFilter.js';

const BEGINNER_FRIENDLY = new Set([
  'tomato', 'pepper', 'lettuce', 'beans', 'bush_beans',
  'herbs', 'cucumber', 'radish', 'carrot', 'kale', 'zucchini',
  'green_onion', 'collards', 'swiss_chard',
]);

const BADGE_COLOR = { high: '#22C55E', medium: '#F59E0B', low: '#9FB3C8' };
const BADGE_LABEL_KEY = { high: 'onboarding.fit.high', medium: 'onboarding.fit.medium', low: 'onboarding.fit.low' };

const STATUS_LABEL_KEY = {
  plant_now: 'onboarding.status.plantNow',
  plant_soon: 'onboarding.status.plantSoon',
  wait: 'onboarding.status.wait',
  avoid: 'onboarding.status.avoid',
};

export default function CropRecommendationStep({ onboarding, onPick, onBack }) {
  const { t } = useAppSettings();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNotRecommended, setShowNotRecommended] = useState(false);

  const isBeginner = onboarding?.experience === 'new';
  const size = onboarding?.farmSize?.size;
  const farmType = onboarding?.farmType
    || (size === 'small' ? 'backyard' : size === 'large' ? 'commercial' : 'small_farm');
  const locationLabel = buildLocationLabel(onboarding?.location);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ loading: true, error: null, data: null });
      try {
        const data = await getRecommendedCropsForOnboarding({
          country: onboarding?.location?.country,
          state: onboarding?.location?.stateCode,
          farmType,
          beginnerLevel: isBeginner ? 'beginner' : 'intermediate',
          growingStyle: size === 'small' ? 'raised_bed' : 'in_ground',
        });
        if (!cancelled) setState({ loading: false, error: null, data });
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err?.message || 'error', data: null });
      }
    })();
    return () => { cancelled = true; };
  }, [onboarding?.location?.country, onboarding?.location?.stateCode, farmType, isBeginner, size]);

  const { best, possible, notRecommended } = useMemo(() => {
    if (!state.data) return { best: [], possible: [], notRecommended: [] };
    const flat = [
      ...(state.data.bestMatch || []),
      ...(state.data.alsoConsider || []),
      ...(state.data.notRecommendedNow || []),
    ];
    let sorted = filterCropsByBeginnerStatus(flat, isBeginner);
    sorted = filterCropsByFarmSize(sorted, size);
    return categorizeCropsByFit(sorted);
  }, [state.data, isBeginner, size]);

  // Beginner-gated advanced picks — in the best bucket, beginners
  // only see the first ~4 unless they ask for more.
  const visibleBest = isBeginner && !showAdvanced
    ? best.slice(0, 4)
    : best;
  const hasMoreAdvanced = isBeginner && best.length > 4 && !showAdvanced;

  function pickBestForMe() {
    const top = pickTopCrop(best.length ? best : possible);
    if (top) onPick?.(top);
  }

  return (
    <div style={S.step}>
      <h2 style={S.title}>{t('onboarding.crops.title')}</h2>
      <p style={S.subtitle}>{t('onboarding.crops.helper')}</p>

      {locationLabel && (
        <div style={S.locationChip} data-testid="onboarding-location-chip">
          <span style={S.locationIcon}>{'\uD83D\uDCCD'}</span>
          <span>{locationLabel}</span>
        </div>
      )}

      {state.loading && <p style={S.muted}>{t('common.loading')}</p>}
      {state.error && <p style={S.err}>{t('onboarding.crops.error')}</p>}
      {state.data?.warnings?.isFallback && (
        <p style={S.warn}>{t('onboarding.crops.offlineFallback')}</p>
      )}

      {!state.loading && !state.error && state.data && (
        <>
          <button type="button" onClick={pickBestForMe} style={S.autoBtn} data-testid="onboarding-pick-best">
            {t('onboarding.crops.pickBest')}
          </button>

          <Section title={t('onboarding.crops.best')} crops={visibleBest} isBeginner={isBeginner} onPick={onPick} t={t} accent="#22C55E" />
          {hasMoreAdvanced && (
            <button type="button" onClick={() => setShowAdvanced(true)} style={S.seeMore}>
              {t('onboarding.crops.seeMore')}
            </button>
          )}

          <Section title={t('onboarding.crops.possible')} crops={possible} isBeginner={isBeginner} onPick={onPick} t={t} accent="#F59E0B" />

          {notRecommended.length > 0 && (
            <details open={showNotRecommended} onToggle={(e) => setShowNotRecommended(e.currentTarget.open)}>
              <summary style={S.notRecSummary}>{t('onboarding.crops.notRecommended')}</summary>
              <Section crops={notRecommended} isBeginner={isBeginner} onPick={onPick} t={t} accent="#6F8299" muted />
            </details>
          )}
        </>
      )}

      <div style={S.row}>
        <button type="button" onClick={onBack} style={S.back}>{t('common.back')}</button>
      </div>
    </div>
  );
}

function Section({ title, crops, isBeginner, onPick, t, accent, muted }) {
  if (!crops || crops.length === 0) return null;
  return (
    <section style={S.section}>
      {title && <h3 style={{ ...S.sectionTitle, color: accent }}>{title}</h3>}
      <div style={S.grid}>
        {crops.map((c) => (
          <CropCard key={c.crop} crop={c} isBeginner={isBeginner} onPick={onPick} t={t} muted={muted} />
        ))}
      </div>
    </section>
  );
}

function CropCard({ crop, isBeginner, onPick, t, muted }) {
  const beginnerFriendly = BEGINNER_FRIENDLY.has(crop.crop);
  const badge = BADGE_LABEL_KEY[crop.fitLevel] || BADGE_LABEL_KEY.low;
  const statusLabel = crop.plantingStatus && STATUS_LABEL_KEY[crop.plantingStatus]
    ? t(STATUS_LABEL_KEY[crop.plantingStatus]) : null;
  const primaryReason = Array.isArray(crop.reasons) && crop.reasons.length
    ? crop.reasons[0]
    : (Array.isArray(crop.riskNotes) && crop.riskNotes.length ? crop.riskNotes[0] : null);

  return (
    <button
      type="button"
      onClick={() => onPick?.(crop)}
      style={{ ...S.card, ...(muted ? S.cardMuted : null) }}
      data-testid={`onboarding-crop-${crop.crop}`}
    >
      <div style={S.cardHead}>
        <span style={S.cardName}>{crop.cropName || crop.crop}</span>
        <span style={{ ...S.badge, background: BADGE_COLOR[crop.fitLevel] || '#9FB3C8' }}>
          {t(badge)}
        </span>
      </div>
      <div style={S.meta}>
        {isBeginner && beginnerFriendly && (
          <span style={S.beginnerTag}>{t('onboarding.fit.beginnerFriendly')}</span>
        )}
        {statusLabel && <span style={S.status}>{statusLabel}</span>}
      </div>
      {primaryReason && <p style={S.reason}>{primaryReason}</p>}
    </button>
  );
}

function buildLocationLabel(location) {
  if (!location) return null;
  const parts = [location.city, location.stateName || location.stateCode, countryName(location.country)].filter(Boolean);
  return parts.join(', ');
}
function countryName(code) {
  const map = { US: 'USA', GH: 'Ghana', NG: 'Nigeria', IN: 'India', KE: 'Kenya' };
  return map[code] || code;
}

const S = {
  step: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title: { fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem', color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', margin: '0 0 0.5rem' },
  locationChip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.10)', color: '#22C55E',
    fontSize: '0.75rem', fontWeight: 700, alignSelf: 'flex-start',
  },
  locationIcon: { fontSize: '0.875rem' },
  muted: { color: '#9FB3C8', fontSize: '0.875rem' },
  err: { color: '#FCA5A5', fontSize: '0.875rem' },
  warn: { color: '#F59E0B', fontSize: '0.8125rem' },
  autoBtn: {
    padding: '0.75rem', borderRadius: '12px',
    border: '1px solid rgba(14,165,233,0.25)', background: 'rgba(14,165,233,0.08)',
    color: '#0EA5E9', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer',
  },
  section: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  sectionTitle: { fontSize: '0.9375rem', fontWeight: 700, margin: '0.25rem 0 0.25rem' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' },
  card: {
    display: 'flex', flexDirection: 'column', gap: '0.375rem',
    padding: '0.875rem 1rem', borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF', cursor: 'pointer', textAlign: 'left',
  },
  cardMuted: { opacity: 0.7 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: '1rem', fontWeight: 700 },
  badge: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700, color: '#0B1D34',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  meta: { display: 'flex', flexWrap: 'wrap', gap: '0.375rem' },
  beginnerTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700,
    background: 'rgba(14,165,233,0.12)', color: '#0EA5E9',
  },
  status: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 600,
    background: 'rgba(255,255,255,0.04)', color: '#9FB3C8',
  },
  reason: { fontSize: '0.8125rem', color: '#9FB3C8', margin: '0.125rem 0 0', lineHeight: 1.4 },
  seeMore: {
    alignSelf: 'center', padding: '0.5rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  },
  notRecSummary: {
    cursor: 'pointer', fontSize: '0.8125rem', color: '#9FB3C8',
    padding: '0.5rem 0',
  },
  row: { display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' },
  back: {
    padding: '0.625rem 0.875rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
    color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  },
};
