import { useNavigate } from 'react-router-dom';
import { useSeason } from '../context/SeasonContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import SeasonTasksCard from '../components/SeasonTasksCard.jsx';

export default function SeasonStart() {
  const navigate = useNavigate();
  const { season, finishSeason } = useSeason();
  const { t, lang } = useTranslation();

  async function handleCompleteSeason() {
    try {
      await finishSeason();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete season:', error);
    }
  }

  if (!season) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loadingWrap}>
            <div style={S.spinner} />
            <div style={S.loadingText}>{t('common.loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.card}>
          <h1 style={S.heading}>{t('season.title')}</h1>
          <p style={S.desc}>{t('season.description')}</p>

          {season && (
            <div style={S.detailGrid}>
              <div style={S.label}>{t('season.crop')}:</div>
              {/* BUG-1 fix — language-aware crop label instead of raw enum */}
              <div>{getCropLabelSafe(season.cropType, lang) || season.cropType}</div>

              <div style={S.label}>{t('season.stage')}:</div>
              {/* BUG-2 fix — translated stage. t() falls back to humanized
                  English when the stage key isn't in translations.js, which
                  is strictly better than raw "vegetative" / "harvest_ready". */}
              <div>{season.stage ? t(`stage.${season.stage}`) : ''}</div>

              <div style={S.label}>{t('season.startDate')}:</div>
              <div>{new Date(season.startDate).toLocaleDateString()}</div>

              <div style={S.label}>{t('season.status')}:</div>
              <div>{season.isActive ? t('season.active') : t('season.completed')}</div>
            </div>
          )}

          {season?.isActive && (
            <button onClick={handleCompleteSeason} style={S.completeBtn}>
              {t('season.completeSeason')}
            </button>
          )}
        </div>

        <SeasonTasksCard />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0F172A',
    color: '#fff',
    padding: '1rem 1rem 2rem',
  },
  container: {
    maxWidth: '48rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.1)',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: 0,
  },
  desc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.7)',
    marginTop: '0.5rem',
  },
  detailGrid: {
    marginTop: '1rem',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    rowGap: '0.75rem',
    fontSize: '0.875rem',
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
  },
  completeBtn: {
    marginTop: '1rem',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.15)',
    padding: '0.75rem 1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    minHeight: '48px',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
    gap: '0.75rem',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
  },
};
