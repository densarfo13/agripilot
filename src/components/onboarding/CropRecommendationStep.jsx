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
import { getRecommendationReasons } from '../../utils/getRecommendationReasons.js';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';
import { getCountrySupportTier, TIER_I18N_KEY, SUPPORT_TIER } from '../../utils/countrySupport.js';
import { getCropSupportDepth, DEPTH_I18N_KEY, CROP_SUPPORT_DEPTH } from '../../utils/cropSupport.js';
import { getRecommendationConfidence, CONFIDENCE_I18N_KEY } from '../../utils/getRecommendationConfidence.js';

const CONFIDENCE_COLOR = { high: '#22C55E', medium: '#F59E0B', low: '#9FB3C8' };
const DEPTH_COLOR = {
  FULLY_GUIDED:     '#22C55E',
  PARTIAL_GUIDANCE: '#0EA5E9',
  BROWSE_ONLY:      '#9FB3C8',
};

const BEGINNER_FRIENDLY = new Set([
  'tomato', 'pepper', 'lettuce', 'beans', 'bush_beans',
  'herbs', 'cucumber', 'radish', 'carrot', 'kale', 'zucchini',
  'green_onion', 'collards', 'swiss_chard',
]);

const BADGE_COLOR = { high: '#22C55E', medium: '#F59E0B', low: '#9FB3C8' };
// Shared-namespace keys so the same "High fit" label resolves on
// the crop-plan page, NGO dashboard, and Today-screen chips without
// needing per-screen duplicates.
const BADGE_LABEL_KEY = { high: 'fit.high', medium: 'fit.medium', low: 'fit.low' };

const STATUS_LABEL_KEY = {
  plant_now:  'status.plantNow',
  plant_soon: 'status.plantSoon',
  wait:       'status.wait',
  avoid:      'status.avoid',
};

export default function CropRecommendationStep({ onboarding, onPick, onBack }) {
  const { t, language } = useAppSettings();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNotRecommended, setShowNotRecommended] = useState(false);
  const [showAllCrops, setShowAllCrops] = useState(false);

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

  function handlePick(crop) {
    // Carry the full onboarding + scoring context alongside the crop
    // so downstream screens (crop plan, etc.) can show "why" without
    // re-fetching.
    onPick?.({
      ...crop,
      onboardingContext: {
        location: onboarding?.location,
        farmSize: onboarding?.farmSize,
        farmType,
        beginnerLevel: isBeginner ? 'beginner' : 'intermediate',
        language,
      },
    });
  }
  function pickBestForMe() {
    const top = pickTopCrop(best.length ? best : possible);
    if (top) handlePick(top);
  }

  // Derive overall recommendation confidence from the farmer's
  // context + the top-scored crop. Single source of truth — the
  // Best and Also-consider sections both read from this so their
  // wording stays consistent.
  const overallConfidence = useMemo(() => {
    const countrySupportTier = getCountrySupportTier(onboarding?.location?.country);
    const locationCompleteness =
      (onboarding?.location?.country ? 0.5 : 0) +
      (onboarding?.location?.stateCode ? 0.4 : 0) +
      (onboarding?.location?.city ? 0.1 : 0);
    const topCrop = best[0] || possible[0] || null;
    return getRecommendationConfidence({
      countrySupportTier,
      stateSupported: !!onboarding?.location?.stateCode,
      cropSupportDepth: getCropSupportDepth(topCrop?.crop),
      locationCompleteness,
      fitLevel: topCrop?.fitLevel,
    });
  }, [onboarding?.location?.country, onboarding?.location?.stateCode, onboarding?.location?.city, best, possible]);

  const bestTitleKey =
    overallConfidence.level === 'high'   ? 'onboarding.crops.best' :
    overallConfidence.level === 'medium' ? 'recConfidence.wording.suggested' :
                                           'recConfidence.wording.limited';

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

          {/* Low-confidence fallback — when nothing's "best" and
              the server didn't surface much either, tell the farmer
              honestly instead of faking a top pick. */}
          {best.length === 0 && possible.length === 0 && (
            <div style={S.fallback} data-testid="onboarding-low-confidence">
              <div style={S.fallbackTitle}>{t('onboarding.crops.lowConfidence')}</div>
              <p style={S.fallbackBody}>{t('onboarding.crops.lowConfidenceHint')}</p>
            </div>
          )}

          {overallConfidence.level !== 'high' && (
            <div style={S.confidenceBanner} data-testid="confidence-banner">
              <span style={S.confidenceIcon}>{'\u2139\uFE0F'}</span>
              <span>{t('recConfidence.bannerBody')}</span>
            </div>
          )}
          <Section
            title={t(bestTitleKey)}
            crops={visibleBest}
            isBeginner={isBeginner}
            onboarding={onboarding}
            language={language}
            confidence={overallConfidence}
            onPick={handlePick}
            t={t}
            accent={CONFIDENCE_COLOR[overallConfidence.level]}
          />
          {hasMoreAdvanced && (
            <button type="button" onClick={() => setShowAdvanced(true)} style={S.seeMore}>
              {t('onboarding.crops.seeMore')}
            </button>
          )}

          <Section
            title={t('onboarding.crops.possible')}
            crops={possible}
            isBeginner={isBeginner}
            onboarding={onboarding}
            language={language}
            confidence={overallConfidence}
            onPick={handlePick}
            t={t}
            accent="#F59E0B"
          />

          {/* Advanced override — reveal low-fit / experimental crops. */}
          <label style={S.overrideRow}>
            <input
              type="checkbox"
              checked={showAllCrops}
              onChange={(e) => setShowAllCrops(e.target.checked)}
              data-testid="onboarding-show-all-crops"
            />
            <span style={S.overrideLabel}>{t('onboarding.crops.showAll')}</span>
          </label>

          {(showAllCrops || notRecommended.length > 0) && notRecommended.length > 0 && (
            <details open={showAllCrops || showNotRecommended}
                     onToggle={(e) => setShowNotRecommended(e.currentTarget.open)}>
              <summary style={S.notRecSummary}>{t('onboarding.crops.notRecommended')}</summary>
              <Section crops={notRecommended} isBeginner={isBeginner}
                       onboarding={onboarding} language={language}
                       onPick={handlePick} t={t} accent="#6F8299" muted />
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

function Section({ title, crops, isBeginner, onboarding, language, confidence, onPick, t, accent, muted }) {
  if (!crops || crops.length === 0) return null;
  return (
    <section style={S.section}>
      {title && <h3 style={{ ...S.sectionTitle, color: accent }}>{title}</h3>}
      <div style={S.grid}>
        {crops.map((c) => (
          <CropCard
            key={c.crop}
            crop={c}
            isBeginner={isBeginner}
            onboarding={onboarding}
            language={language}
            confidence={confidence}
            onPick={onPick}
            t={t}
            muted={muted}
          />
        ))}
      </div>
    </section>
  );
}

function CropCard({ crop, isBeginner, onboarding, language, confidence, onPick, t, muted }) {
  const beginnerFriendly = BEGINNER_FRIENDLY.has(crop.crop);
  const badge = BADGE_LABEL_KEY[crop.fitLevel] || BADGE_LABEL_KEY.low;
  const statusLabel = crop.plantingStatus && STATUS_LABEL_KEY[crop.plantingStatus]
    ? t(STATUS_LABEL_KEY[crop.plantingStatus]) : null;
  // 'auto' → Hindi UI shows Hindi name only for familiar crops and
  // "कसावा (Cassava)" for less-familiar ones (see BILINGUAL_HINTED).
  const displayName = getCropDisplayName(crop.crop, language, { bilingual: 'auto' });
  const supportDepth = getCropSupportDepth(crop.crop);
  const depthKey = DEPTH_I18N_KEY[supportDepth];
  const confidenceKey = confidence ? CONFIDENCE_I18N_KEY[confidence.level] : null;
  const reasons = getRecommendationReasons({
    crop,
    region: {
      regionLabel: onboarding?.location?.stateCode,
      country: onboarding?.location?.country,
    },
    season: { currentMonth: new Date().getMonth() + 1, plantingStatus: crop.plantingStatus },
    farmSize: onboarding?.farmSize?.size,
    beginnerLevel: isBeginner ? 'beginner' : 'intermediate',
    farmType: onboarding?.farmType,
  }, t);

  return (
    <button
      type="button"
      onClick={() => onPick?.(crop)}
      style={{ ...S.card, ...(muted ? S.cardMuted : null) }}
      data-testid={`onboarding-crop-${crop.crop}`}
    >
      <div style={S.cardHead}>
        <span style={S.cardName}>{displayName}</span>
        <span style={{ ...S.badge, background: BADGE_COLOR[crop.fitLevel] || '#9FB3C8' }}>
          {t(badge)}
        </span>
      </div>
      <div style={S.meta}>
        {isBeginner && beginnerFriendly && (
          <span style={S.beginnerTag}>{t('cropTraits.beginnerFriendly')}</span>
        )}
        {statusLabel && <span style={S.status}>{statusLabel}</span>}
        {crop.fitLevel === 'low' && (
          <span style={S.lowFitTag}>{t('fit.low')}</span>
        )}
        {supportDepth !== CROP_SUPPORT_DEPTH.FULLY_GUIDED && (
          <span style={{ ...S.depthTag, color: DEPTH_COLOR[supportDepth], borderColor: DEPTH_COLOR[supportDepth] }}>
            {t(depthKey)}
          </span>
        )}
        {confidence && confidence.level !== 'high' && confidenceKey && (
          <span style={{ ...S.confidenceTag, color: CONFIDENCE_COLOR[confidence.level], borderColor: CONFIDENCE_COLOR[confidence.level] }}>
            {t(confidenceKey)}
          </span>
        )}
      </div>
      {reasons.length > 0 ? (
        <ul style={S.reasonList}>
          {reasons.map((r, i) => <li key={i} style={S.reasonItem}>{r}</li>)}
        </ul>
      ) : null}
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
  reasonList: { margin: '0.25rem 0 0', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  reasonItem: { fontSize: '0.8125rem', color: '#9FB3C8', lineHeight: 1.4 },
  lowFitTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700,
    background: 'rgba(239,68,68,0.12)', color: '#FCA5A5',
  },
  depthTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.625rem', fontWeight: 700,
    border: '1px solid', background: 'rgba(255,255,255,0.02)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  confidenceTag: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.625rem', fontWeight: 700,
    border: '1px solid', background: 'rgba(255,255,255,0.02)',
  },
  confidenceBanner: {
    display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
    padding: '0.625rem 0.75rem', borderRadius: '12px',
    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
    color: '#EAF2FF', fontSize: '0.8125rem', lineHeight: 1.4,
  },
  confidenceIcon: { fontSize: '1rem' },
  fallback: {
    padding: '0.875rem 1rem', borderRadius: '14px',
    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
    color: '#EAF2FF',
  },
  fallbackTitle: { fontSize: '0.9375rem', fontWeight: 700, color: '#F59E0B' },
  fallbackBody: { fontSize: '0.8125rem', color: '#9FB3C8', margin: '0.25rem 0 0', lineHeight: 1.4 },
  overrideRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0', fontSize: '0.8125rem', color: '#9FB3C8',
    cursor: 'pointer',
  },
  overrideLabel: { userSelect: 'none' },
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
