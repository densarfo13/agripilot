/**
 * BeginnerPrompt — entry point for the beginner crop-fit flow.
 *
 * Shows a "New to farming?" card with CTA to start the crop-fit intake.
 * Displayed on dashboard when:
 *   - farmer has no crop selected, OR
 *   - farmer type is 'new' and crop stage is 'planning'
 *
 * Dismissible — once dismissed, stays hidden for the session.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStrictTranslation as useTranslation } from '../../i18n/useStrictTranslation.js';
import { safeTrackEvent } from '../../lib/analytics.js';

export default function BeginnerPrompt({ variant = 'card' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function handleStart() {
    safeTrackEvent('beginner.find_crop_clicked', { source: 'dashboard' });
    // Fast onboarding owns the new-farmer flow. /crop-fit was the
    // legacy intake that mixed setup + recommendation in one form.
    navigate('/onboarding/fast');
  }

  function handleDismiss() {
    setDismissed(true);
    safeTrackEvent('beginner.prompt_dismissed', {});
  }

  if (variant === 'inline') {
    return (
      <button type="button" onClick={handleStart} style={S.inlineBtn}>
        {'\uD83C\uDF3E'} {t('beginner.findCrop')}
      </button>
    );
  }

  return (
    <div style={S.card}>
      <button type="button" onClick={handleDismiss} style={S.dismissBtn}>
        {'\u2715'}
      </button>
      <div style={S.iconWrap}>
        <span style={S.icon}>{'\uD83C\uDF31'}</span>
      </div>
      <h3 style={S.title}>{t('beginner.title')}</h3>
      <p style={S.subtitle}>{t('beginner.subtitle')}</p>
      <button type="button" onClick={handleStart} style={S.cta}>
        {'\uD83C\uDF3E'} {t('beginner.cta')}
      </button>
    </div>
  );
}

const S = {
  card: {
    position: 'relative',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.02) 100%)',
    border: '1px solid rgba(34,197,94,0.15)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  dismissBtn: {
    position: 'absolute',
    top: '0.625rem',
    right: '0.75rem',
    background: 'none',
    border: 'none',
    color: '#6F8299',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: '0.25rem',
    lineHeight: 1,
    WebkitTapHighlightColor: 'transparent',
  },
  iconWrap: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: '1.5rem' },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '0.8125rem',
    color: '#6F8299',
    margin: 0,
    textAlign: 'center',
    lineHeight: 1.4,
    maxWidth: '18rem',
  },
  cta: {
    width: '100%',
    padding: '0.875rem',
    borderRadius: '14px',
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '0.25rem',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  inlineBtn: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.15)',
    color: '#22C55E',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
};
