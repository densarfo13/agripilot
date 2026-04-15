/**
 * FarmerType — onboarding step after farm profile save.
 *
 * Asks: "What best describes you?"
 * Two options:
 *   🌱 New to farming  → saves "new", routes to /onboarding/starter-guide
 *   🌾 Existing farmer → saves "experienced", routes to /dashboard
 *
 * Saves experienceLevel to backend via ProfileContext.saveProfile().
 * Loading state, error handling, double-click prevention, console logging.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { saveFarmerType as apiFarmerType } from '../lib/api.js';

export default function FarmerType() {
  const navigate = useNavigate();
  const { refreshProfile } = useProfile();
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSelect(farmerType) {
    if (saving) return;

    try {
      setSaving(true);
      setError('');

      console.log('Saving farmer type:', farmerType);

      await apiFarmerType(farmerType);
      // Refresh profile context so dashboard sees the updated experienceLevel
      await refreshProfile();

      console.log('Farmer type saved:', farmerType);
      safeTrackEvent('onboarding.farmer_type_selected', { farmerType });

      if (farmerType === 'new') {
        navigate('/onboarding/starter-guide');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Farmer type save error:', err);
      setError(err?.message || t('farmerType.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.card}>
          <h1 style={S.title}>{t('farmerType.question')}</h1>
          <p style={S.subtitle}>{t('farmerType.subtitle')}</p>

          <div style={S.options}>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSelect('new')}
              style={{ ...S.optionBtn, ...(saving ? { opacity: 0.6 } : {}) }}
            >
              <div style={S.optionIcon}>🌱</div>
              <div>
                <div style={S.optionTitle}>{t('farmerType.new')}</div>
                <div style={S.optionDesc}>{t('farmerType.newDesc')}</div>
              </div>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => handleSelect('experienced')}
              style={{ ...S.optionBtn, ...(saving ? { opacity: 0.6 } : {}) }}
            >
              <div style={S.optionIcon}>🌾</div>
              <div>
                <div style={S.optionTitle}>{t('farmerType.experienced')}</div>
                <div style={S.optionDesc}>{t('farmerType.experiencedDesc')}</div>
              </div>
            </button>
          </div>

          {error && <p style={S.error}>{error}</p>}
          {saving && <p style={S.saving}>{t('farmerType.saving')}</p>}
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
    paddingTop: '4rem',
  },
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.75rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.5rem 0',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.6)',
    margin: '0 0 1.5rem 0',
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginTop: '0.25rem',
  },
  optionBtn: {
    width: '100%',
    borderRadius: '16px',
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '1.25rem',
    textAlign: 'left',
    cursor: 'pointer',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '1rem',
    transition: 'background 0.2s, border-color 0.2s',
    fontSize: '0.875rem',
    minHeight: '44px',
  },
  optionIcon: {
    fontSize: '1.75rem',
    flexShrink: 0,
  },
  optionTitle: {
    fontWeight: 600,
    fontSize: '1rem',
    marginBottom: '0.25rem',
  },
  optionDesc: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.5,
  },
  error: {
    marginTop: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5',
    fontSize: '0.875rem',
  },
  saving: {
    marginTop: '1rem',
    fontSize: '0.875rem',
    color: '#86EFAC',
  },
};
