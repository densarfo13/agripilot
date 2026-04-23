/**
 * CropRecommendations — shows top 3 crop recommendations.
 *
 * Receives intake answers from route state.
 * Each card shows: icon, name, difficulty, timing, harvest, fit reasons.
 * Tapping a card navigates to /crop-summary with the crop code.
 */
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { getRecommendedCrops } from '../engine/cropFit.js';
import { isBetaCrop } from '../engine/cropDefinitions.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { useProfile } from '../context/ProfileContext.jsx';
import {
  buildCropFitAnswersFromFarm, hasEnoughForRecommendations,
  recomputeFarmContext,
} from '../core/multiFarm/index.js';
import { showToast } from '../core/farm/unified.js';
// Crop Intelligence Engine — every label/image/duration/trait now
// comes from the registry so language + image stay in sync with
// canonical ids. See src/config/crops/cropRegistry.js.
import {
  normalizeCropId, getCropLabel, getCropImage,
} from '../config/crops/index.js';
import { recommendTopCrops } from '../lib/recommendations/topCropEngine.js';

/**
 * deriveWeatherSummary(farmCtx, answers)
 *   Maps whatever lightweight weather/climate field the farm or
 *   onboarding answers carry into the coarse pattern the seasonal
 *   engine understands. Returns null when we genuinely have nothing
 *   — the engine treats missing weather as "no adjustment", so
 *   returning null is safer than guessing.
 */
function deriveWeatherSummary(farmCtx = {}, answers = null) {
  const src = (answers && answers.weather)
           || (farmCtx && (farmCtx.weather || farmCtx.currentWeather))
           || null;
  if (!src || typeof src !== 'object') return null;
  // Direct pass-through when the caller already speaks our vocab.
  if (src.pattern) return { pattern: String(src.pattern).toLowerCase() };
  // Fallback: map rainfall mm / temp °C to a coarse pattern.
  const rain = Number(src.rain3d || src.rainMm || src.precipitation || 0);
  const temp = Number(src.temp   || src.tempC  || src.temperature  || NaN);
  if (Number.isFinite(rain)) {
    if (rain >= 50) return { pattern: 'high_rain' };
    if (rain >= 10) return { pattern: 'moderate_rain' };
    if (rain <  2 && Number.isFinite(temp) && temp >= 30) {
      return { pattern: 'heat_stress' };
    }
    if (rain <  2) return { pattern: 'dry_conditions' };
  }
  if (Number.isFinite(temp)) {
    if (temp >= 35) return { pattern: 'heat_stress' };
    if (temp <= 10) return { pattern: 'cool_conditions' };
  }
  return null;
}

export default function CropRecommendations() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t, lang } = useTranslation();
  const { profile, farms, editFarm, refreshProfile, refreshFarms } = useProfile();
  // Tracks which crop (if any) is currently being applied so we can
  // disable its button and surface a spinner without blocking the
  // whole page.
  const [applyingCode, setApplyingCode] = useState(null);

  // Two entry paths:
  //   1. legacy wizard → answers passed in location.state
  //   2. existing user via "Find My Best Crop" → ?farmId=X
  //      build answers from that farm's profile so the page
  //      actually renders something (prior behavior: silently
  //      redirect back to /my-farm because state was empty).
  const farmIdFromQuery = searchParams.get('farmId');
  const farmFromId = useMemo(() => {
    if (!farmIdFromQuery) return null;
    if (profile?.id === farmIdFromQuery) return profile;
    return (farms || []).find((f) => f && f.id === farmIdFromQuery) || null;
  }, [farmIdFromQuery, profile, farms]);

  const answers = useMemo(() => {
    // 1. Wizard state wins if present (legacy path).
    if (location.state) return location.state;
    // 2. Build from farmId.
    if (farmFromId && hasEnoughForRecommendations(farmFromId)) {
      return buildCropFitAnswersFromFarm(farmFromId);
    }
    // 3. Fall back to the active profile when no farmId query.
    if (!farmIdFromQuery && profile && hasEnoughForRecommendations(profile)) {
      return buildCropFitAnswersFromFarm(profile);
    }
    return null;
  }, [location.state, farmFromId, farmIdFromQuery, profile]);

  // Without answers we still can't render; but now we route the
  // user to complete their farm details instead of silently bouncing.
  if (!answers) {
    const farmId = farmIdFromQuery || profile?.id;
    const dest = farmId
      ? `/edit-farm?mode=complete_for_recommendation&farmId=${encodeURIComponent(farmId)}`
      : '/my-farm';
    return <Navigate to={dest} replace />;
  }

  /**
   * Crop recommendations. Two-layer strategy so we keep the existing
   * goal/water/difficulty scoring from cropFit.js while also applying
   * the registry-aware region / farm-type / experience boosts from
   * topCropEngine. The legacy engine still returns crop cards (keeps
   * the existing `code`/`icon`/`harvestWeeks` shape used by the
   * layout); the new engine's scores top-up the ranking so cards
   * relevant to the farmer's country + profile rise to the top.
   */
  const crops = useMemo(() => {
    const legacy = getRecommendedCrops(answers) || [];
    // Collect context for the registry engine.
    const farmCtx = farmFromId || profile || {};
    // Pull a lightweight weather pattern from whatever shape the
    // profile or answers carries. The engine only cares about a
    // coarse label so this mapping is intentionally shallow.
    const weather = deriveWeatherSummary(farmCtx, answers);
    const recs = recommendTopCrops({
      country:  answers && (answers.country || farmCtx.country),
      state:    answers && (answers.state   || farmCtx.state),
      farmType: farmCtx.farmType || 'small_farm',
      farmerExperienceLevel:
        (answers && answers.experience)
        || (farmCtx.farmerExperience || 'beginner'),
      preferredCrop:
        (answers && answers.preferredCrop)
        || farmCtx.cropType || farmCtx.cropId || null,
      seasonContext:     answers && answers.seasonContext,
      waterAvailability: (answers && answers.waterAccess)
                          || farmCtx.waterAccess || 'rain_only',
      budgetSensitivity: answers && answers.budget,
      language: lang,
      // Explicit month + weather open the seasonal intelligence
      // layer. Engine falls back to Date.now() + no-weather when
      // these are null.
      month:   new Date().getMonth() + 1,
      weather: weather || null,
    });
    const registryScores = new Map();
    if (recs && recs.all) {
      for (const r of recs.all) registryScores.set(r.cropId, r);
    }
    // Enrich every legacy card with canonical id + registry label/image
    // + merged registry reasons/badges. Also re-score using a blend so
    // the top pick respects both engines.
    const merged = legacy.map((c) => {
      const canonicalId = normalizeCropId(c.code) || String(c.code).toLowerCase();
      const reg = registryScores.get(canonicalId);
      // Prefer the registry label for the current language; fall back
      // to the legacy English name so the screen never goes blank.
      const label = getCropLabel(canonicalId, lang) || c.name || canonicalId;
      const image = getCropImage(canonicalId);
      const mergedReasons = Array.from(new Set([
        ...(c.fitReasons || []),
        ...((reg && reg.reasons) || []),
      ]));
      const mergedBadges = (reg && reg.badges) || [];
      const registryScore = reg ? reg.score : 0;
      return {
        ...c,
        cropId: canonicalId,
        label, image,
        badges: mergedBadges,
        fitReasons: mergedReasons,
        // Blend scores: legacy carries goal/experience/water, registry
        // adds regional + farm-type + beginner boosts.
        score: (c.score || 0) + registryScore,
        // Promote the registry's dynamic planting message over the
        // generic legacy timingSignal. Falls through to the legacy
        // signal when the seasonal engine has no entry for the crop.
        plantingMessage: (reg && reg.plantingMessage) || c.timingSignal || null,
        seasonFit:       reg && reg.seasonFit,
        weatherAdjusted: Boolean(reg && reg.weatherAdjusted),
      };
    });
    // If the registry surfaced a strong candidate the legacy engine
    // didn't know about, splice it in so the user sees the best
    // recommendation, not just what the legacy pool happens to carry.
    if (recs && recs.best && !merged.some((m) => m.cropId === recs.best.cropId)) {
      merged.push({
        code: recs.best.cropId.toUpperCase(),
        cropId: recs.best.cropId,
        name: getCropLabel(recs.best.cropId, 'en'),
        label: getCropLabel(recs.best.cropId, lang),
        image: getCropImage(recs.best.cropId),
        icon: '',
        difficulty: recs.best.difficulty,
        harvestWeeks: recs.best.durationText,
        waterNeed: recs.best.waterNeed,
        costLevel: recs.best.costLevel,
        marketPotential: null,
        timingSignal: recs.best.plantingMessage || '',
        plantingMessage: recs.best.plantingMessage,
        seasonFit:       recs.best.seasonFit,
        weatherAdjusted: recs.best.weatherAdjusted,
        fitReasons: recs.best.reasons,
        badges: recs.best.badges,
        warnings: recs.best.warnings,
        score: recs.best.score,
      });
    }
    merged.sort((a, b) => (b.score || 0) - (a.score || 0));
    return merged.slice(0, 3);
  }, [answers, profile, farmFromId, lang]);

  function handleSelect(crop) {
    const cropId = crop.cropId || normalizeCropId(crop.code) || null;
    safeTrackEvent('cropFit.crop_selected', { code: crop.code, cropId });
    // Pass the canonical id alongside the legacy crop object so the
    // next screen can move off the uppercase code when ready.
    navigate('/crop-summary', { state: { crop, cropId, answers } });
  }

  /**
   * handleUseThisCrop — §3 decision action. Update the active
   * farm's cropType, recompute derived context, toast success,
   * then go to Home. Does NOT create a new farm, does NOT touch
   * onboarding state.
   */
  async function handleUseThisCrop(crop) {
    const farmId = answers?.farmId || profile?.id;
    const canonicalId = crop?.cropId || normalizeCropId(crop?.code) || null;
    const legacyCode = crop?.code
      || (canonicalId ? canonicalId.toUpperCase().replace(/-/g, '_') : null);
    if (!farmId || !legacyCode) {
      showToast(t('cropFit.results.useCropFailed') && t('cropFit.results.useCropFailed') !== 'cropFit.results.useCropFailed'
        ? t('cropFit.results.useCropFailed')
        : 'Could not update your farm.');
      return;
    }
    setApplyingCode(legacyCode);
    try {
      // Keep storing the uppercase code on the farm (that's still the
      // canonical storage format for the rest of the app); the
      // canonical id rides along on analytics so the new engine can
      // observe what the farmer actually picked.
      await editFarm(farmId, { cropType: String(legacyCode).toUpperCase() });
      safeTrackEvent('cropFit.crop_applied',
        { farmId, code: legacyCode, cropId: canonicalId });
      // Explicit refresh chain — belt-and-braces post-save recompute.
      await recomputeFarmContext({
        currentFarmId: farmId,
        intent: { cropSwitched: true },
        deps: { refreshProfile, refreshFarms },
      });
      const msg = t('cropFit.results.farmUpdated') && t('cropFit.results.farmUpdated') !== 'cropFit.results.farmUpdated'
        ? t('cropFit.results.farmUpdated')
        : 'Farm updated successfully';
      showToast(msg);
      navigate('/dashboard');
    } catch (err) {
      const msg = t('cropFit.results.useCropFailed') && t('cropFit.results.useCropFailed') !== 'cropFit.results.useCropFailed'
        ? t('cropFit.results.useCropFailed')
        : (err?.message || 'Could not update your farm.');
      showToast(msg);
    } finally {
      setApplyingCode(null);
    }
  }

  // Tracks `applyingCode` by legacy uppercase code; derive the same
  // disabled flag for the featured card regardless of which shape
  // the crop card is carrying.
  const featuredLegacyCode = crops[0]
    ? (crops[0].code
        || (crops[0].cropId
            ? crops[0].cropId.toUpperCase().replace(/-/g, '_') : null))
    : null;

  const difficultyColors = {
    beginner: '#22C55E',
    moderate: '#F59E0B',
    advanced: '#EF4444',
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>

        <h1 style={S.title}>{t('cropFit.results.title')}</h1>
        <p style={S.subtitle}>{t('cropFit.results.subtitle')}</p>

        {/* Recommendation cards — spec §5: one featured + two compact */}
        {crops.length > 0 && (
          <div style={S.cards}>
            {/* ─── Featured (Best for you) ──────────────────── */}
            <div style={S.featuredWrap}>
              <div style={S.topBadge}>{t('cropFit.results.bestForYou')}</div>
              <div style={S.featuredCard}>
                <div style={S.featuredHeader}>
                  {crops[0].image
                    ? <img src={crops[0].image}
                           alt=""
                           aria-hidden="true"
                           loading="lazy"
                           style={S.featuredImage} />
                    : <span style={S.featuredIcon}>{crops[0].icon}</span>}
                  <div style={S.featuredInfo}>
                    <div style={S.featuredName}>
                      {crops[0].label || crops[0].name}
                      {isBetaCrop(crops[0].code) && (
                        <span style={S.betaChip}>{t('beta.label')}</span>
                      )}
                    </div>
                    <div style={{ ...S.diffBadge, color: difficultyColors[crops[0].difficulty] }}>
                      {t(`cropFit.diff.${crops[0].difficulty}`)}
                    </div>
                  </div>
                </div>

                <div style={S.stats}>
                  <div style={S.stat}>
                    <span style={S.statIcon}>{'\u23F1\uFE0F'}</span>
                    <span style={S.statText}>{crops[0].harvestWeeks} {t('cropFit.weeks')}</span>
                  </div>
                  <div style={S.stat}>
                    <span style={S.statIcon}>{'\uD83D\uDCA7'}</span>
                    <span style={S.statText}>{t(`cropFit.level.${crops[0].waterNeed}`)}</span>
                  </div>
                  <div style={S.stat}>
                    <span style={S.statIcon}>{'\uD83D\uDCB0'}</span>
                    <span style={S.statText}>{t(`cropFit.level.${crops[0].costLevel}`)}</span>
                  </div>
                </div>

                {(crops[0].plantingMessage || crops[0].timingSignal) && (
                  <div
                    style={{
                      ...S.timing,
                      ...(crops[0].seasonFit === 'low'
                        ? S.timingCaution : null),
                    }}
                    data-testid="planting-message"
                    data-season-fit={crops[0].seasonFit || 'unknown'}>
                    {t(crops[0].plantingMessage || crops[0].timingSignal)}
                  </div>
                )}

                {(crops[0].fitReasons || []).length > 0 && (
                  <div style={S.reasons}>
                    {crops[0].fitReasons.slice(0, 3).map((key, j) => (
                      <span key={j} style={S.reason}>{t(key)}</span>
                    ))}
                  </div>
                )}
                {(crops[0].badges || []).length > 0 && (
                  <div style={S.reasons} data-testid="rec-badges">
                    {crops[0].badges.slice(0, 3).map((key, j) => (
                      <span key={`b-${j}`} style={S.reason}>{t(key)}</span>
                    ))}
                  </div>
                )}

                {crops[0].warnings.length > 0 && (
                  <div style={S.warnings}>
                    {crops[0].warnings.map((key, j) => (
                      <span key={j} style={S.warning}>{t(key)}</span>
                    ))}
                  </div>
                )}

                {/* §3 decision: apply this crop to the active farm */}
                <button
                  type="button"
                  onClick={() => handleUseThisCrop(crops[0])}
                  disabled={applyingCode === featuredLegacyCode}
                  data-crop-id={crops[0].cropId}
                  style={S.viewPlanBtn}
                  data-testid="rec-use-this-crop"
                >
                  {applyingCode === featuredLegacyCode
                    ? (t('common.saving') || 'Saving\u2026')
                    : (t('cropFit.results.useThisCrop') && t('cropFit.results.useThisCrop') !== 'cropFit.results.useThisCrop'
                        ? t('cropFit.results.useThisCrop')
                        : 'Use this crop')}
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect(crops[0])}
                  data-crop-id={crops[0].cropId}
                  style={{ ...S.viewPlanBtn, marginTop: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
                  data-testid="rec-view-plan"
                >
                  {t('cropFit.results.viewPlan')}
                </button>
              </div>
            </div>

            {/* ─── Alternatives (compact) ──────────────────── */}
            {crops.length > 1 && (
              <div style={S.altHeader}>{t('cropFit.results.alsoConsider')}</div>
            )}
            <div style={S.altList}>
              {crops.slice(1, 3).map((crop) => (
                <button
                  key={crop.cropId || crop.code}
                  type="button"
                  data-crop-id={crop.cropId}
                  onClick={() => handleSelect(crop)}
                  style={S.compactCard}
                  data-testid="rec-compact"
                >
                  {crop.image
                    ? <img src={crop.image}
                           alt=""
                           aria-hidden="true"
                           loading="lazy"
                           style={S.compactImage} />
                    : <span style={S.compactIcon}>{crop.icon}</span>}
                  <div style={S.compactInfo}>
                    <div style={S.compactName}>
                      {crop.label || crop.name}
                      {isBetaCrop(crop.code) && (
                        <span style={S.betaChipSmall}>{t('beta.label')}</span>
                      )}
                    </div>
                    <div style={S.compactMeta}>
                      <span style={{ color: difficultyColors[crop.difficulty] }}>
                        {t(`cropFit.diff.${crop.difficulty}`)}
                      </span>
                      <span style={S.compactDot}>•</span>
                      <span>{crop.harvestWeeks} {t('cropFit.weeks')}</span>
                    </div>
                  </div>
                  <span style={S.arrow}>{'\u203A'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {crops.length === 0 && (
          <div style={S.empty}>
            <p style={S.emptyText}>{t('cropFit.results.noResults')}</p>
            <button type="button" onClick={() => navigate('/my-farm')} style={S.retryBtn}>
              {t('cropFit.results.tryAgain')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '0 0 2rem',
  },
  container: {
    maxWidth: '28rem',
    margin: '0 auto',
    padding: '1rem 1rem 0',
  },
  backBtn: {
    background: 'none', border: 'none', color: '#9FB3C8',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    padding: '0.25rem 0', marginBottom: '1rem',
    WebkitTapHighlightColor: 'transparent',
  },
  title: {
    fontSize: '1.375rem', fontWeight: 800, margin: '0 0 0.25rem',
    color: '#EAF2FF', lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '0.875rem', color: '#6F8299', margin: '0 0 1.25rem',
  },
  cards: {
    display: 'flex', flexDirection: 'column', gap: '1rem',
  },

  // ─── Featured (top) recommendation ──────────────────────
  featuredWrap: {
    position: 'relative',
    paddingTop: '0.5rem',
  },
  featuredCard: {
    width: '100%', textAlign: 'left',
    borderRadius: '22px', padding: '1.5rem 1.25rem',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.28)',
    boxShadow: '0 14px 36px rgba(0,0,0,0.35)',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
    animation: 'farroway-fade-in 0.3s ease-out',
    color: '#EAF2FF',
  },
  featuredHeader: {
    display: 'flex', alignItems: 'center', gap: '0.875rem',
  },
  featuredIcon: { fontSize: '2.75rem', flexShrink: 0, lineHeight: 1 },
  featuredImage: {
    width: '3.5rem', height: '3.5rem', flexShrink: 0,
    borderRadius: '14px', objectFit: 'cover',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  featuredInfo: { flex: 1, minWidth: 0 },
  featuredName: { fontSize: '1.375rem', fontWeight: 800, color: '#EAF2FF', lineHeight: 1.2 },
  viewPlanBtn: {
    width: '100%',
    marginTop: '0.5rem',
    padding: '0.9375rem',
    borderRadius: '14px',
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '52px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },

  // ─── Alternatives (compact) ─────────────────────────────
  altHeader: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: '0.5rem',
    marginLeft: '0.25rem',
  },
  altList: {
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  compactCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    textAlign: 'left',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer',
    color: '#EAF2FF',
    WebkitTapHighlightColor: 'transparent',
  },
  compactIcon: { fontSize: '1.5rem', flexShrink: 0, lineHeight: 1 },
  compactImage: {
    width: '2rem', height: '2rem', flexShrink: 0,
    borderRadius: '10px', objectFit: 'cover',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  compactInfo: { flex: 1, minWidth: 0 },
  compactName: { fontSize: '1rem', fontWeight: 700, color: '#EAF2FF', lineHeight: 1.2 },
  compactMeta: {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    marginTop: '0.125rem',
    fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600,
  },
  compactDot: { color: '#4B5C70' },

  // Beta/testing chip — amber, subtle, inline with crop name
  betaChip: {
    display: 'inline-block',
    marginLeft: '0.5rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    background: 'rgba(251,191,36,0.12)',
    border: '1px solid rgba(251,191,36,0.35)',
    color: '#FCD34D',
    fontSize: '0.625rem', fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    verticalAlign: 'middle',
  },
  betaChipSmall: {
    display: 'inline-block',
    marginLeft: '0.375rem',
    padding: '0.0625rem 0.375rem',
    borderRadius: '999px',
    background: 'rgba(251,191,36,0.12)',
    border: '1px solid rgba(251,191,36,0.35)',
    color: '#FCD34D',
    fontSize: '0.5625rem', fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    verticalAlign: 'middle',
  },

  topBadge: {
    position: 'absolute', top: 0, left: '1rem',
    padding: '0.25rem 0.75rem', borderRadius: '999px',
    background: '#22C55E', color: '#fff',
    fontSize: '0.625rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    zIndex: 1,
    boxShadow: '0 6px 14px rgba(34,197,94,0.35)',
  },
  diffBadge: {
    fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em', marginTop: '0.125rem',
  },
  arrow: {
    fontSize: '1.5rem', color: '#6F8299', flexShrink: 0,
  },
  stats: {
    display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
  },
  stat: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
  },
  statIcon: { fontSize: '0.75rem' },
  statText: { fontSize: '0.75rem', color: '#9FB3C8', fontWeight: 600 },
  timing: {
    fontSize: '0.75rem', fontWeight: 700, color: '#22C55E',
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.08)', alignSelf: 'flex-start',
  },
  // When the seasonal engine reports 'low' fit, the pill switches to
  // a warmer amber so the farmer reads it as advisory, not urgent.
  timingCaution: {
    color: '#FCD34D',
    background: 'rgba(251,191,36,0.08)',
  },
  reasons: {
    display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
  },
  reason: {
    fontSize: '0.6875rem', fontWeight: 600, color: '#9FB3C8',
    padding: '0.25rem 0.5rem', borderRadius: '8px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  warnings: {
    display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
  },
  warning: {
    fontSize: '0.6875rem', fontWeight: 600, color: '#F59E0B',
    padding: '0.25rem 0.5rem', borderRadius: '8px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.1)',
  },
  empty: {
    textAlign: 'center', padding: '3rem 1rem',
  },
  emptyText: { fontSize: '0.9375rem', color: '#6F8299', marginBottom: '1rem' },
  retryBtn: {
    padding: '0.875rem 1.5rem', borderRadius: '14px', border: 'none',
    background: '#22C55E', color: '#fff', fontSize: '0.9375rem',
    fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
};
