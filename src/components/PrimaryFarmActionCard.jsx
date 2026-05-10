/**
 * PrimaryFarmActionCard — main action card on the farmer dashboard.
 *
 * Shows the primary farm action the farmer should take, gated by farm
 * readiness. When the farm is not ready (!score.isReady), shows a
 * setup prompt instead of the start season button.
 *
 * Props:
 *   score       — farmScore object with isReady, value, missing fields
 *   season      — current active season or null
 *   onStartSeason — callback for starting the farming season
 *   onFinishSetup — callback for completing profile setup
 *   t           — translation function
 */
import React from 'react';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { useProfileOrNull } from '../context/ProfileContext.jsx';

export default function PrimaryFarmActionCard({ score, season, onStartSeason, onFinishSetup }) {
  const { t } = useTranslation();
  const profileCtx = useProfileOrNull();
  const profile = profileCtx?.profile || null;

  // Guard: if farm is not ready, show setup prompt (never show season start button)
  if (!score.isReady) {
    return (
      <div style={S.card} data-testid="primary-action-setup">
        <div style={S.icon}>🌱</div>
        <div style={S.content}>
          <div style={S.title}>{t('action.finishSetup') || 'Finish your farm setup'}</div>
          <div style={S.subtitle}>{t('dashboard.completeSetup') || 'Complete your profile to start farming.'}</div>
          <button
            style={S.btn}
            onClick={onFinishSetup}
            data-testid="primary-action-finish-setup"
          >
            {t('action.finishSetup') || 'Finish Setup'}
          </button>
        </div>
      </div>
    );
  }

  // Farm is ready — check for active season
  if (season) {
    return (
      <div style={S.card} data-testid="primary-action-active">
        <div style={S.icon}>🌾</div>
        <div style={S.content}>
          <div style={S.title}>{t('action.seasonActive') || 'Season active'}</div>
          <button
            style={S.btn}
            onClick={() => {}}
            data-testid="primary-action-continue"
          >
            {t('action.continueWork') || 'Continue Work'}
          </button>
        </div>
      </div>
    );
  }

  // Ready + no season: show start season button
  async function handleStartSeason() {
    try {
      await onStartSeason?.({ farmId: profile?.id });
      safeTrackEvent('season.started', { farmId: profile?.id });
    } catch (err) {
      safeTrackEvent('season.start_failed', { error: err?.message });
    }
  }

  return (
    <div style={S.card} data-testid="primary-action-start">
      <div style={S.icon}>🚀</div>
      <div style={S.content}>
        <div style={S.title}>{t('action.readyToStart') || 'Ready to start'}</div>
        <button
          style={{ ...S.btn, padding: '1rem 2rem', fontSize: '1rem', minHeight: '48px' }}
          onClick={handleStartSeason}
          data-testid="primary-action-start-season"
        >
          {t('action.startSeason') || 'Start Farming Season'}
        </button>
      </div>
    </div>
  );
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '20px',
    padding: '1.5rem 1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  icon: { fontSize: '2rem', flexShrink: 0 },
  content: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  title: { fontSize: '1.1rem', fontWeight: 700, color: '#EAF2FF' },
  subtitle: { fontSize: '0.875rem', color: '#9FB3C8', lineHeight: 1.5 },
  btn: {
    padding: '1rem 1.5rem',
    fontSize: '1rem',
    fontWeight: 700,
    background: '#C8944D',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    minHeight: '48px',
    alignSelf: 'flex-start',
    WebkitTapHighlightColor: 'transparent',
  },
};
