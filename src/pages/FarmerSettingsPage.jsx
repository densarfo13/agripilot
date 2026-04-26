/**
 * FarmerSettingsPage — thin page wrapper around FarmerSettingsPanel.
 *
 * Reachable from the gear icon in FarmerHeader. Holds mode, voice,
 * and notification preferences. No new widgets — just exposes the
 * existing FarmerSettingsPanel as a routable destination.
 */
import { useNavigate } from 'react-router-dom';
// Strict no-leak alias — see useStrictTranslation.js.
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import FarmerSettingsPanel from '../components/FarmerSettingsPanel.jsx';
import NotificationSettingsPanel from '../components/NotificationSettingsPanel.jsx';

export default function FarmerSettingsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div style={S.page}>
      <div style={S.container}>
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>
        <h1 style={S.title}>{t('settings.title')}</h1>
        <FarmerSettingsPanel />
        <NotificationSettingsPanel />
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1rem 0 3rem',
  },
  container: {
    maxWidth: '28rem',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  backBtn: {
    alignSelf: 'flex-start',
    background: 'none',
    border: 'none',
    color: '#9FB3C8',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0.25rem 0',
    WebkitTapHighlightColor: 'transparent',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: 800,
    margin: 0,
    color: '#EAF2FF',
  },
};
