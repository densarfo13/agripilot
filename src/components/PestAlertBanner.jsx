/**
 * PestAlertBanner — farmer-side "pest activity nearby" prompt.
 *
 *   <PestAlertBanner location={`${region}, ${country}`} />
 *
 * Reads the local pest-report mirror, asks `shouldAlertForRegion`
 * whether the cluster threshold has been crossed in the last
 * `windowDays`, and renders a single dismissable banner when so.
 * On first mount also speaks the alert once for low-literacy
 * farmers (gated by a per-day fired-stamp so refreshes don't
 * re-fire the speech).
 *
 * Strict rules respected:
 *   * additive       - mount it anywhere; nothing else changes
 *   * works offline  - reads from the localStorage mirror
 *   * not punishing  - copy is informational, no blame
 */

import React, { useEffect, useState } from 'react';
import { getPestReports } from '../utils/pestReports.js';
import { shouldAlertForRegion, CLUSTER_TUNING } from '../utils/pestCluster.js';
import { speak } from '../core/farroway/voice.js';
import { tSafe } from '../i18n/tSafe.js';

const DISMISS_KEY = 'farroway_pest_banner_dismissed';
const VOICE_KEY   = 'farroway_pest_voice_fired';

function _today() { return new Date().toDateString(); }

function _dismissedToday() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === _today();
  } catch { return false; }
}

function _stampDismissed() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DISMISS_KEY, _today());
  } catch { /* swallow */ }
}

function _voiceFiredToday() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(VOICE_KEY) === _today();
  } catch { return false; }
}

function _stampVoice() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VOICE_KEY, _today());
  } catch { /* swallow */ }
}

export default function PestAlertBanner({
  location  = null,
  threshold = CLUSTER_TUNING.MIN_REPORTS_ALERT,
  windowDays = CLUSTER_TUNING.WINDOW_DAYS,
  onCheck    = null,
}) {
  const [hidden, setHidden] = useState(_dismissedToday());

  const reports = getPestReports();
  const result  = shouldAlertForRegion(reports, location, { threshold, windowDays });

  // One-shot voice on first surface in the day.
  useEffect(() => {
    if (hidden) return;
    if (!result.alert) return;
    if (_voiceFiredToday()) return;
    try { speak(tSafe('pest.alert.voice', 'Pest risk in your area. Check your crops.')); }
    catch { /* swallow */ }
    _stampVoice();
    // The location string drives the voice; re-firing on a
    // location prop change in the same day is intentional.
  }, [hidden, result.alert, location]);

  if (hidden || !result.alert) return null;

  function handleDismiss() {
    _stampDismissed();
    setHidden(true);
  }

  function handleCheck() {
    _stampDismissed();
    setHidden(true);
    if (typeof onCheck === 'function') {
      try { onCheck(); }
      catch { /* never propagate from a click handler */ }
    }
  }

  return (
    <section style={S.banner} role="alert" aria-live="polite" data-testid="pest-alert-banner">
      <span style={S.icon} aria-hidden="true">{'\u26A0\uFE0F'}</span>
      <div style={S.text}>
        <strong style={S.title}>
          {tSafe('pest.alert.title', 'Pest risk increasing in your area')}
        </strong>
        <span style={S.body}>
          {tSafe(
            'pest.alert.body',
            'Check your crops today \u2014 pest activity reported nearby.',
          )}
        </span>
      </div>
      <div style={S.actions}>
        <button
          type="button"
          onClick={handleCheck}
          style={S.primaryBtn}
          data-testid="pest-alert-check"
        >
          {tSafe('pest.alert.cta', 'Check crops')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          style={S.dismissBtn}
          aria-label={tSafe('common.dismiss', 'Dismiss')}
          data-testid="pest-alert-dismiss"
        >
          {'\u2715'}
        </button>
      </div>
    </section>
  );
}

const S = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.875rem 1rem',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, rgba(245,158,11,0.16) 0%, rgba(15,32,52,0.9) 100%)',
    border: '1px solid rgba(245,158,11,0.45)',
    color: '#FDE68A',
    flexWrap: 'wrap',
  },
  icon: { fontSize: '1.5rem', flexShrink: 0 },
  text: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  title: { fontSize: '0.9375rem', fontWeight: 800, color: '#FCD34D' },
  body:  { fontSize: '0.8125rem', color: 'rgba(253, 230, 138, 0.85)', lineHeight: 1.4 },
  actions: { display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 },
  primaryBtn: {
    background: '#F59E0B',
    color: '#0B1D34',
    border: 'none',
    borderRadius: '12px',
    padding: '0.5rem 0.875rem',
    fontSize: '0.875rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '44px',
    WebkitTapHighlightColor: 'transparent',
  },
  dismissBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: '1px solid rgba(253,230,138,0.4)',
    background: 'transparent',
    color: 'rgba(253,230,138,0.7)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 700,
    WebkitTapHighlightColor: 'transparent',
  },
};
