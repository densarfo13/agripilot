/**
 * StarterGuide — beginner onboarding landing page for new farmers.
 *
 * Shows a welcome message and guided overview of the 5-step farming process.
 * This is the entry point after a new farmer selects "New to farming" in FarmerType.
 *
 * From here the farmer proceeds to the dashboard where the decision engine
 * takes over with guided next-action cards.
 */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { GUIDED_STEPS } from '../utils/guidedFarmingSteps.js';

export default function StarterGuide() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  function handleContinue() {
    safeTrackEvent('onboarding.starter_guide_completed', {});
    navigate('/dashboard');
  }

  function handleFindCrop() {
    safeTrackEvent('onboarding.find_best_crop', {});
    navigate('/crop-fit');
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.card}>
          <div style={S.iconWrap}>🌱</div>
          <h1 style={S.title}>{t('starterGuide.title')}</h1>
          <p style={S.subtitle}>{t('starterGuide.subtitle')}</p>

          <div style={S.steps}>
            {GUIDED_STEPS.map((step, i) => (
              <div key={step.id} style={S.stepRow}>
                <div style={S.stepIcon}>{step.icon}</div>
                <div>
                  <div style={S.stepTitle}>
                    {i + 1}. {t(`guided.step.${step.id}`)}
                  </div>
                  <div style={S.stepDesc}>
                    {t(`guided.step.${step.id}.desc`)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleFindCrop}
            style={S.findCropBtn}
          >
            {'\uD83C\uDF3E'} {t('starterGuide.findBestCrop')}
          </button>

          <button
            type="button"
            onClick={handleContinue}
            style={S.continueBtn}
          >
            {t('starterGuide.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'center',
  },
  container: {
    maxWidth: '36rem',
    width: '100%',
    paddingTop: '2rem',
    paddingBottom: '100px',
  },
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.5rem',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  iconWrap: {
    fontSize: '3rem',
    textAlign: 'center',
    marginBottom: '0.5rem',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.5rem 0',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    margin: '0 0 1.5rem 0',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  stepRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem',
    borderRadius: '12px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  stepIcon: {
    fontSize: '1.5rem',
    flexShrink: 0,
    paddingTop: '0.1rem',
  },
  stepTitle: {
    fontWeight: 600,
    fontSize: '0.95rem',
    marginBottom: '0.2rem',
  },
  stepDesc: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.5,
  },
  findCropBtn: {
    width: '100%',
    borderRadius: '12px',
    background: '#22C55E',
    padding: '1rem',
    fontWeight: 600,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    minHeight: '48px',
    marginBottom: '0.5rem',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
  },
  continueBtn: {
    width: '100%',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    padding: '1rem',
    fontWeight: 600,
    color: '#9FB3C8',
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    fontSize: '0.95rem',
    minHeight: '48px',
  },
};
