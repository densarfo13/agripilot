/**
 * SignInPromptCard — gentle "save your progress" nudge shown
 * AFTER the user has captured value, never before.
 *
 * Spec coverage (Funnel optimisation §5)
 *   • Optional sign-in AFTER value.
 *
 * When it shows
 *   • The user has completed at least one meaningful action
 *     (`farroway_funnel_first_action` stamp set).
 *   • There is no auth user (token / session unknown — read
 *     defensively from existing auth keys).
 *   • Not session-dismissed.
 *   • `funnelOptimization` flag is on.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Pure presentational; never throws.
 *   • Routes to `/login`. The login page itself is unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import { getFunnelState } from '../../analytics/funnelEvents.js';

const DISMISS_KEY = 'farroway_signin_prompt_dismissed';

function _hasAuthUser() {
  try {
    if (typeof localStorage === 'undefined') return false;
    // Conservative: any of these keys present → assume signed in.
    const tok = localStorage.getItem('farroway_token');
    if (tok && String(tok).trim()) return true;
    const user = localStorage.getItem('farroway_user');
    if (user && String(user).trim()) return true;
    return false;
  } catch { return false; }
}

const S = {
  card: {
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.40)',
    borderRadius: 14,
    padding: '12px 14px',
    color: '#fff',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    margin: '0 0 12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  icon: { fontSize: 24, lineHeight: 1, flex: '0 0 auto' },
  body: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 800, color: '#7DD3FC' },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  rowBtns: { display: 'flex', gap: 8, marginTop: 6 },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#0EA5E9',
    color: '#0B1D34',
    padding: '8px 14px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghost: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function SignInPromptCard({ style }) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('funnelOptimization');
  const [dismissed, setDismissed] = useState(() => {
    try {
      if (typeof sessionStorage === 'undefined') return false;
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch { return false; }
  });
  const viewedRef = useRef(false);

  const eligible = useMemo(() => {
    if (!flagOn || dismissed) return false;
    if (_hasAuthUser()) return false;
    let state = null;
    try { state = getFunnelState(); } catch { state = null; }
    return !!(state && state.firstAction);
  }, [flagOn, dismissed]);

  useEffect(() => {
    if (!eligible) return;
    if (viewedRef.current) return;
    viewedRef.current = true;
    try { trackEvent('signin_prompt_view', {}); }
    catch { /* swallow */ }
  }, [eligible]);

  const handleSignIn = useCallback(() => {
    try { trackEvent('signin_prompt_click', {}); }
    catch { /* swallow */ }
    try { navigate('/login'); }
    catch { /* swallow */ }
  }, [navigate]);

  const handleDismiss = useCallback(() => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(DISMISS_KEY, 'true');
      }
    } catch { /* swallow */ }
    try { trackEvent('signin_prompt_dismiss', {}); }
    catch { /* swallow */ }
    setDismissed(true);
  }, []);

  if (!eligible) return null;

  return (
    <section
      style={{ ...S.card, ...(style || null) }}
      data-testid="signin-prompt-card"
    >
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDD12'}</span>
      <div style={S.body}>
        <span style={S.title}>
          {tStrict('home.signin.title', 'Save your progress')}
        </span>
        <span style={S.copy}>
          {tStrict('home.signin.copy',
            'Sign in so your streak, listings, and saved tips travel with you across devices.')}
        </span>
        <div style={S.rowBtns}>
          <button
            type="button"
            onClick={handleSignIn}
            style={S.primary}
            data-testid="signin-prompt-cta"
          >
            {tStrict('home.signin.cta', 'Sign in')}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            style={S.ghost}
            data-testid="signin-prompt-dismiss"
          >
            {tStrict('common.notNow', 'Not now')}
          </button>
        </div>
      </div>
    </section>
  );
}
