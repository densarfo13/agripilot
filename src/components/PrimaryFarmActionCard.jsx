import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { calculateFarmScore } from '../lib/farmScore.js';
import { useSeason } from '../context/SeasonContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';

export default function PrimaryFarmActionCard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { beginSeason, season, seasonLoading } = useSeason();
  const { language } = useAppPrefs();
  const { t } = useTranslation();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);

  const score = calculateFarmScore(profile || {});

  async function handleStartSeason() {
    if (starting) return;
    // Hard gate: block if no UUID (profile not saved / not assigned)
    if (!profile?.farmerUuid) {
      navigate('/profile/setup');
      return;
    }
    const cropType = profile?.cropType || '';
    if (!cropType) {
      navigate('/profile/setup');
      return;
    }
    setStarting(true);
    setStartError(null);
    try {
      await beginSeason({ cropType, stage: 'planting', farmId: profile?.id });
      safeTrackEvent('season.started', { cropType });
      navigate('/season/start');
    } catch (error) {
      console.error('Failed to start season:', error);
      safeTrackEvent('season.start_failed', { error: error.message });
      setStartError(t('season.startFailed'));
    } finally {
      setStarting(false);
    }
  }

  // Gate: Not ready — either missing fields or missing UUID
  if (!score.isReady) {
    // Distinguish: fields done but UUID missing vs fields still incomplete
    const fieldsComplete = score.score >= 75;
    return (
      <div style={S.cardWarning}>
        <div style={S.warningLabel}>
          {t('action.finishSetup')}
        </div>
        <p style={S.desc}>
          {fieldsComplete && !score.hasUuid
            ? t('action.uuidMissing')
            : t('action.finishSetupDesc')}
        </p>
        {!fieldsComplete && (
          <div style={S.benefitsList}>
            <div>{t('action.betterWeather')}</div>
            <div>{t('action.betterGuidance')}</div>
            <div>{t('action.betterPlanning')}</div>
          </div>
        )}
        <button onClick={() => navigate('/profile/setup')} style={S.ctaBtn}>
          {t('dashboard.completeSetup')}
        </button>
      </div>
    );
  }

  if (season) {
    return (
      <div style={S.card}>
        <div style={S.readyLabel}>{t('action.seasonActive')}</div>
        <p style={S.desc}>
          {t('action.seasonActiveDesc')}
        </p>
        <button onClick={() => navigate('/season/start')} style={S.ctaBtn}>
          {t('action.continueWork')}
        </button>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <div style={S.readyLabel}>{t('action.readyToStart')}</div>
      <p style={S.desc}>
        {t('action.readyToStartDesc')}
      </p>
      <button
        onClick={handleStartSeason}
        disabled={seasonLoading || starting}
        style={{ ...S.ctaBtn, ...((seasonLoading || starting) ? S.ctaBtnDisabled : {}) }}
      >
        {(seasonLoading || starting) ? t('season.starting') : t('action.startSeason')}
      </button>
      {startError && (
        <div style={S.errorMsg}>{startError}</div>
      )}
    </div>
  );
}

const S = {
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  cardWarning: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(250,204,21,0.2)',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  readyLabel: {
    fontSize: '0.875rem',
    color: '#86EFAC',
    fontWeight: 600,
  },
  warningLabel: {
    fontSize: '0.875rem',
    color: '#FDE68A',
    fontWeight: 600,
  },
  desc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.5rem',
  },
  benefitsList: {
    marginTop: '0.75rem',
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.8)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  ctaBtn: {
    marginTop: '1rem',
    width: '100%',
    borderRadius: '16px',
    background: '#22C55E',
    padding: '1rem',
    fontWeight: 700,
    color: '#000',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  ctaBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  errorMsg: {
    marginTop: '0.75rem',
    fontSize: '0.875rem',
    color: '#FCA5A5',
    background: 'rgba(239,68,68,0.1)',
    borderRadius: '8px',
    padding: '0.5rem 0.75rem',
  },
};
