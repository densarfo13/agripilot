/**
 * BeginnerReassurance — one calm screen between Welcome and Quick-Fit Intake.
 *
 * Spec §3: a totally new farmer who just chose "Start a new crop"
 * needs a moment of confidence — no form fields, one icon, one short
 * reassuring message, one Continue button.
 *
 * Seen flag is stored in sessionStorage so the screen does not re-appear
 * on resume-from-interrupt inside the same session.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';

const SEEN_KEY = 'farroway:reassurance_seen';

function markSeen() {
  try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
}

export function hasSeenReassurance() {
  try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; }
}

export default function BeginnerReassurance() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    safeTrackEvent('onboarding.reassurance_shown', {});
  }, []);

  function handleContinue() {
    markSeen();
    safeTrackEvent('onboarding.reassurance_continue', {});
    navigate('/crop-fit', { replace: true });
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Large calming icon */}
        <div style={S.iconWrap}>
          <span style={S.icon} aria-hidden="true">{'\uD83C\uDF31'}</span>
        </div>

        {/* Title */}
        <h1 style={S.title}>{t('reassurance.title')}</h1>

        {/* Two short lines */}
        <p style={S.body}>{t('reassurance.guide')}</p>
        <p style={S.bodyMuted}>{t('reassurance.noExperience')}</p>

        {/* Single CTA */}
        <button
          type="button"
          onClick={handleContinue}
          style={S.continueBtn}
          data-testid="reassurance-continue"
        >
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%',
    maxWidth: '24rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '2.5rem 1.75rem',
    boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
    animation: 'farroway-fade-in 0.3s ease-out',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  iconWrap: {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.18)',
    marginBottom: '0.5rem',
  },
  icon: { fontSize: '3rem', lineHeight: 1 },
  title: {
    fontSize: '1.375rem',
    fontWeight: 800,
    margin: 0,
    color: '#EAF2FF',
    lineHeight: 1.3,
  },
  body: {
    fontSize: '1rem',
    color: '#EAF2FF',
    lineHeight: 1.45,
    margin: 0,
    fontWeight: 600,
    maxWidth: '16rem',
  },
  bodyMuted: {
    fontSize: '0.875rem',
    color: '#9FB3C8',
    lineHeight: 1.45,
    margin: 0,
    maxWidth: '16rem',
  },
  continueBtn: {
    width: '100%',
    marginTop: '0.75rem',
    padding: '1rem',
    borderRadius: '16px',
    background: '#22C55E',
    color: '#fff',
    border: 'none',
    fontSize: '1.0625rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
};
