/**
 * SWUpdateBanner — "New version available — Reload" banner that
 * surfaces when the service worker has a fresh build ready.
 *
 * Spec coverage (Final audit §4.1.4)
 *   • Service-worker production update cycle — without this
 *     listener the `farroway:sw_new_version` event fired by
 *     `registerServiceWorker` had no UI surface, so users
 *     wouldn't pick up new builds without a hard refresh.
 *
 * Behaviour
 *   • Subscribes to the `farroway:sw_new_version` window event.
 *   • Reload button calls `window.__farrowayReloadForUpdate()`
 *     (set by `main.jsx` SW registration), which activates the
 *     waiting SW and reloads the page.
 *   • "Later" button hides the banner for the session.
 *   • Position: fixed bottom — does not block the active surface.
 *
 * Strict-rule audit
 *   • All visible strings via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 *   • Self-suppresses until a real update event fires.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

const S = {
  banner: {
    position: 'fixed',
    left: 12,
    right: 12,
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    zIndex: 1100,
    background: '#0F1B2D',
    color: '#fff',
    border: '1px solid #22C55E',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
    fontFamily: 'inherit',
    maxWidth: 520,
    margin: '0 auto',
  },
  body: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: 800, color: '#86EFAC' },
  copy:  { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.45 },
  rowBtns: { display: 'flex', gap: 6, flex: '0 0 auto' },
  primary: {
    appearance: 'none',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    padding: '8px 12px',
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
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

export default function SWUpdateBanner() {
  useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onNew = () => {
      setVisible(true);
      try { trackEvent('sw_update_available', {}); }
      catch { /* swallow */ }
    };
    try {
      window.addEventListener('farroway:sw_new_version', onNew);
    } catch { /* swallow */ }
    return () => {
      try { window.removeEventListener('farroway:sw_new_version', onNew); }
      catch { /* swallow */ }
    };
  }, []);

  const handleReload = useCallback(() => {
    try { trackEvent('sw_update_reload', {}); }
    catch { /* swallow */ }
    try {
      if (typeof window !== 'undefined' && typeof window.__farrowayReloadForUpdate === 'function') {
        window.__farrowayReloadForUpdate();
        return;
      }
    } catch { /* swallow */ }
    // Fallback: hard reload if the activator helper is missing.
    try { if (typeof window !== 'undefined') window.location.reload(); }
    catch { /* swallow */ }
  }, []);

  const handleLater = useCallback(() => {
    try { trackEvent('sw_update_later', {}); }
    catch { /* swallow */ }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div style={S.banner} role="alert" data-testid="sw-update-banner">
      <span aria-hidden="true">{'\u2728'}</span>
      <div style={S.body}>
        <span style={S.title}>
          {tStrict('system.swUpdate.title', 'New version available')}
        </span>
        <span style={S.copy}>
          {tStrict('system.swUpdate.copy',
            'Reload to get the latest improvements.')}
        </span>
      </div>
      <div style={S.rowBtns}>
        <button
          type="button"
          onClick={handleReload}
          style={S.primary}
          data-testid="sw-update-reload"
        >
          {tStrict('system.swUpdate.reload', 'Reload')}
        </button>
        <button
          type="button"
          onClick={handleLater}
          style={S.ghost}
          data-testid="sw-update-later"
        >
          {tStrict('common.later', 'Later')}
        </button>
      </div>
    </div>
  );
}
