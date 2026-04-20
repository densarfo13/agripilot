/**
 * CropRecommendations — shows top 3 crop recommendations.
 *
 * Receives intake answers from route state.
 * Each card shows: icon, name, difficulty, timing, harvest, fit reasons.
 * Tapping a card navigates to /crop-summary with the crop code.
 */
import { useMemo } from 'react';
import { useLocation, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { getRecommendedCrops } from '../engine/cropFit.js';
import { isBetaCrop } from '../engine/cropDefinitions.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { useProfile } from '../context/ProfileContext.jsx';
import {
  buildCropFitAnswersFromFarm, hasEnoughForRecommendations,
} from '../core/multiFarm/index.js';

export default function CropRecommendations() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const { profile, farms } = useProfile();

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

  const crops = useMemo(() => getRecommendedCrops(answers), [answers]);

  function handleSelect(crop) {
    safeTrackEvent('cropFit.crop_selected', { code: crop.code });
    navigate('/crop-summary', { state: { crop, answers } });
  }

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
                  <span style={S.featuredIcon}>{crops[0].icon}</span>
                  <div style={S.featuredInfo}>
                    <div style={S.featuredName}>
                      {crops[0].name}
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

                <div style={S.timing}>{t(crops[0].timingSignal)}</div>

                {crops[0].fitReasons.length > 0 && (
                  <div style={S.reasons}>
                    {crops[0].fitReasons.slice(0, 3).map((key, j) => (
                      <span key={j} style={S.reason}>{t(key)}</span>
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

                <button
                  type="button"
                  onClick={() => handleSelect(crops[0])}
                  style={S.viewPlanBtn}
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
                  key={crop.code}
                  type="button"
                  onClick={() => handleSelect(crop)}
                  style={S.compactCard}
                  data-testid="rec-compact"
                >
                  <span style={S.compactIcon}>{crop.icon}</span>
                  <div style={S.compactInfo}>
                    <div style={S.compactName}>
                      {crop.name}
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
