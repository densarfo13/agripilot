/**
 * HelpPage — minimal /help route the voice assistant routes to
 * for the "I need help" intent (rollout §6, §12).
 *
 * The page is a single column of action rows:
 *   • Common questions   (link / accordion)
 *   • Contact our team   (mailto fallback)
 *   • Voice assistant chip (rollout §1 — Help is one of the five
 *                            entry surfaces)
 *
 * Strict-rule audit
 *   • No backend / API calls
 *   • Mailto fallback when /contact route doesn't exist
 *   • Renders even when the user has no farm yet (the help page
 *     is unauthenticated-safe so support is always reachable)
 */

import { useNavigate } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';
import VoiceLauncher from '../components/voice/VoiceLauncher.jsx';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

const SUPPORT_EMAIL = FARROWAY_BRAND.supportEmail || 'support@farroway.app';

export default function HelpPage() {
  const navigate = useNavigate();

  function handleContact() {
    try {
      window.location.href = `mailto:${SUPPORT_EMAIL}`;
    } catch { /* never propagate */ }
  }

  return (
    <main style={S.page} data-testid="help-page">
      <div style={S.container}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={S.backBtn}
          aria-label={tSafe('common.back', 'Back')}
          data-testid="help-back"
        >
          {'\u2190 '}{tSafe('common.back', 'Back')}
        </button>

        <h1 style={S.title}>
          {tSafe('help.needHelp', 'Need help?')}
        </h1>
        <p style={S.subtitle}>
          {tSafe('help.subtitle',
            'Tap a question to get a quick answer, or contact our team directly.')}
        </p>

        {/* Voice assistant chip — guided questions cover the
            common ones (today's tasks, weather, watering,
            harvest, sell). Mounted here so the help surface
            also gets the rollout §1 voice entry point. */}
        <div style={S.voiceWrap}>
          <VoiceLauncher variant="chip" />
        </div>

        {/* Contact our team */}
        <button
          type="button"
          onClick={handleContact}
          style={S.row}
          data-testid="help-contact"
        >
          <span style={S.rowIcon} aria-hidden="true">{'\u2709\uFE0F'}</span>
          <span style={S.rowBody}>
            <span style={S.rowTitle}>
              {tSafe('help.contactTeam', 'Contact our team')}
            </span>
            <span style={S.rowSub}>{SUPPORT_EMAIL}</span>
          </span>
          <span style={S.rowArrow} aria-hidden="true">{'\u2192'}</span>
        </button>
      </div>
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1rem',
    paddingBottom: '5rem',
  },
  container: {
    maxWidth: '32rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: '0.5rem 0.75rem',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 40,
  },
  title: {
    margin: '0.25rem 0 0',
    fontSize: '1.5rem',
    fontWeight: 700,
  },
  subtitle: {
    margin: 0,
    color: '#9FB3C8',
    fontSize: '0.9375rem',
    lineHeight: 1.45,
  },
  voiceWrap: {
    marginTop: '0.5rem',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 64,
  },
  rowIcon: {
    fontSize: '1.25rem',
    lineHeight: 1,
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    background: 'rgba(34,197,94,0.14)',
  },
  rowBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  rowTitle: {
    fontSize: '0.9375rem',
    fontWeight: 700,
  },
  rowSub: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
  },
  rowArrow: {
    color: '#9FB3C8',
    fontSize: '1rem',
  },
};
