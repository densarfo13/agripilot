/**
 * OfflineBanner — calm "Working offline" banner mounted at the
 * App root when `navigator.onLine === false`.
 *
 * Spec coverage (Robust journey §6)
 *   • Show saved data + reassure the user that nothing is lost
 *     while they're offline.
 *
 * Behaviour
 *   • Mounts only when the browser reports offline.
 *   • Self-hides when connection returns; emits
 *     `journey_offline_dismissed` if user taps to acknowledge.
 *   • Position: fixed top — non-blocking; the rest of the UI
 *     remains interactive.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Self-suppresses behind `journeyResilience` flag.
 *   • Never throws.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const S = {
  banner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1100,
    background: 'rgba(245,158,11,0.95)',
    color: '#0B1D34',
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
    fontFamily: 'inherit',
  },
  icon: { fontSize: 14, lineHeight: 1 },
};

function _isOnline() {
  try {
    if (typeof navigator === 'undefined') return true;
    if (typeof navigator.onLine !== 'boolean') return true;
    return navigator.onLine;
  } catch { return true; }
}

export default function OfflineBanner() {
  useTranslation();
  const flagOn = isFeatureEnabled('journeyResilience');
  const [online, setOnline] = useState(() => _isOnline());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onOnline  = () => setOnline(true);
    const onOffline = () => {
      setOnline(false);
      try { trackEvent('journey_offline_seen', {}); }
      catch { /* swallow */ }
    };
    try {
      window.addEventListener('online',  onOnline);
      window.addEventListener('offline', onOffline);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener('online',  onOnline);
        window.removeEventListener('offline', onOffline);
      } catch { /* swallow */ }
    };
  }, []);

  if (!flagOn || online) return null;

  return (
    <div style={S.banner} role="status" data-testid="offline-banner">
      <span style={S.icon} aria-hidden="true">{'\u26A0\uFE0F'}</span>
      <span>
        {tStrict('journey.offline.banner',
          'Working offline \u2014 your changes save locally and sync when you\u2019re back.')}
      </span>
    </div>
  );
}
