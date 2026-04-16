/**
 * CropRecommendations — shows top 3 crop recommendations.
 *
 * Receives intake answers from route state.
 * Each card shows: icon, name, difficulty, timing, harvest, fit reasons.
 * Tapping a card navigates to /crop-summary with the crop code.
 */
import { useMemo } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { getRecommendedCrops } from '../engine/cropFit.js';
import { safeTrackEvent } from '../lib/analytics.js';

export default function CropRecommendations() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const answers = location.state;

  if (!answers) return <Navigate to="/crop-fit" replace />;

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

        {/* Recommendation cards */}
        <div style={S.cards}>
          {crops.map((crop, i) => (
            <button
              key={crop.code}
              type="button"
              onClick={() => handleSelect(crop)}
              style={{
                ...S.card,
                ...(i === 0 ? S.cardTop : {}),
              }}
            >
              {/* Rank badge */}
              {i === 0 && (
                <div style={S.topBadge}>{t('cropFit.results.bestFit')}</div>
              )}

              <div style={S.cardHeader}>
                <span style={S.cropIcon}>{crop.icon}</span>
                <div style={S.cropInfo}>
                  <div style={S.cropName}>{crop.name}</div>
                  <div style={{ ...S.diffBadge, color: difficultyColors[crop.difficulty] }}>
                    {t(`cropFit.diff.${crop.difficulty}`)}
                  </div>
                </div>
                <span style={S.arrow}>{'\u203A'}</span>
              </div>

              {/* Quick stats */}
              <div style={S.stats}>
                <div style={S.stat}>
                  <span style={S.statIcon}>{'\u23F1\uFE0F'}</span>
                  <span style={S.statText}>{crop.harvestWeeks} {t('cropFit.weeks')}</span>
                </div>
                <div style={S.stat}>
                  <span style={S.statIcon}>{'\uD83D\uDCA7'}</span>
                  <span style={S.statText}>{t(`cropFit.level.${crop.waterNeed}`)}</span>
                </div>
                <div style={S.stat}>
                  <span style={S.statIcon}>{'\uD83D\uDCB0'}</span>
                  <span style={S.statText}>{t(`cropFit.level.${crop.costLevel}`)}</span>
                </div>
              </div>

              {/* Timing signal */}
              <div style={S.timing}>
                {t(crop.timingSignal)}
              </div>

              {/* Fit reasons */}
              {crop.fitReasons.length > 0 && (
                <div style={S.reasons}>
                  {crop.fitReasons.map((key, j) => (
                    <span key={j} style={S.reason}>{t(key)}</span>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {crop.warnings.length > 0 && (
                <div style={S.warnings}>
                  {crop.warnings.map((key, j) => (
                    <span key={j} style={S.warning}>{t(key)}</span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>

        {crops.length === 0 && (
          <div style={S.empty}>
            <p style={S.emptyText}>{t('cropFit.results.noResults')}</p>
            <button type="button" onClick={() => navigate('/crop-fit')} style={S.retryBtn}>
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
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  card: {
    width: '100%', textAlign: 'left', cursor: 'pointer',
    borderRadius: '20px', padding: '1.25rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex', flexDirection: 'column', gap: '0.625rem',
    WebkitTapHighlightColor: 'transparent',
    animation: 'farroway-fade-in 0.3s ease-out',
    position: 'relative',
    color: '#EAF2FF',
  },
  cardTop: {
    border: '1px solid rgba(34,197,94,0.2)',
    background: 'rgba(34,197,94,0.04)',
  },
  topBadge: {
    position: 'absolute', top: '-0.5rem', right: '1rem',
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    background: '#22C55E', color: '#fff',
    fontSize: '0.625rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  cardHeader: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
  },
  cropIcon: { fontSize: '2rem', flexShrink: 0 },
  cropInfo: { flex: 1, minWidth: 0 },
  cropName: { fontSize: '1.125rem', fontWeight: 700, color: '#EAF2FF' },
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
