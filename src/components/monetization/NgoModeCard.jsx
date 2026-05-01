/**
 * NgoModeCard — "NGO mode" toggle + shortcuts to existing
 * organisation-facing surfaces.
 *
 * Spec coverage (Monetization §5)
 *   • enable dashboard features
 *   • enable reporting
 *   • enable multi-user tracking
 *
 * Position
 *   The dashboard / reporting / multi-user pages already exist
 *   under STAFF_ROLES (`/admin/funding`, `/ngo/impact`,
 *   `/ngo/programs`, `/ngo/funding-readiness`). Role-based access
 *   for those routes still flows through the existing auth layer —
 *   this toggle does not grant access. It is a *user preference*
 *   that decides whether to surface the entry points.
 *
 * Visibility
 *   • Self-hides when the `ngoMode` flag is off.
 *   • Renders the toggle UI to every flag-on user; clicking the
 *     shortcut buttons routes to the existing pages, where the
 *     route guard decides what the user actually sees.
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Inline styles only.
 *   • Reads the existing route paths verbatim — does not introduce
 *     any new navigation entry, never breaks current navigation.
 *   • Never throws.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { isFeatureEnabled } from '../../config/features.js';
import { trackEvent } from '../../analytics/analyticsStore.js';
import {
  isNgoMode,
  setNgoMode,
  NGO_MODE_CHANGED_EVENT,
} from '../../monetization/ngoMode.js';

const SHORTCUTS = [
  {
    id: 'dashboard',
    icon: '\uD83D\uDCCA',
    titleKey: 'monetization.ngo.shortcut.dashboard',
    titleFallback: 'Dashboard',
    bodyKey: 'monetization.ngo.shortcut.dashboard.body',
    bodyFallback: 'Funding programs + farmer engagement.',
    path: '/admin/funding',
  },
  {
    id: 'reporting',
    icon: '\uD83D\uDCC8',
    titleKey: 'monetization.ngo.shortcut.reporting',
    titleFallback: 'Reporting',
    bodyKey: 'monetization.ngo.shortcut.reporting.body',
    bodyFallback: 'Impact metrics for your organisation.',
    path: '/ngo/impact',
  },
  {
    id: 'multiUser',
    icon: '\uD83D\uDC65',
    titleKey: 'monetization.ngo.shortcut.multiUser',
    titleFallback: 'Multi-user tracking',
    bodyKey: 'monetization.ngo.shortcut.multiUser.body',
    bodyFallback: 'Programs distributed to farmer cohorts.',
    path: '/ngo/programs',
  },
];

const S = {
  card: {
    background: 'rgba(168,85,247,0.08)',
    border: '1px solid rgba(168,85,247,0.32)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  title:    { margin: 0, fontSize: 15, fontWeight: 800, color: '#fff' },
  copy:     { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 },
  toggle: {
    appearance: 'none',
    border: '1px solid rgba(168,85,247,0.55)',
    background: 'rgba(168,85,247,0.18)',
    color: '#E9D5FF',
    fontSize: 13,
    fontWeight: 700,
    padding: '6px 12px',
    borderRadius: 999,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  toggleOn: {
    background: '#A855F7',
    color: '#0B1D34',
  },
  shortcuts: { display: 'flex', flexDirection: 'column', gap: 8 },
  shortcut: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#fff',
    fontFamily: 'inherit',
    padding: '12px 14px',
    borderRadius: 12,
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  scIcon: { fontSize: 22, lineHeight: 1, flex: '0 0 auto' },
  scBody: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  scTitle: { fontSize: 14, fontWeight: 700 },
  scCopy:  { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
};

export default function NgoModeCard({ style }) {
  useTranslation();
  const navigate = useNavigate();
  const flagOn = isFeatureEnabled('ngoMode');

  const [enabled, setEnabled] = useState(() => {
    try { return isNgoMode(); } catch { return false; }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onChange = () => {
      try { setEnabled(isNgoMode()); } catch { /* swallow */ }
    };
    try {
      window.addEventListener(NGO_MODE_CHANGED_EVENT, onChange);
      window.addEventListener('storage', onChange);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(NGO_MODE_CHANGED_EVENT, onChange);
        window.removeEventListener('storage', onChange);
      } catch { /* swallow */ }
    };
  }, []);

  const handleToggle = useCallback(() => {
    const next = !enabled;
    try { setNgoMode(next); } catch { /* swallow */ }
    setEnabled(next);
    try { trackEvent('monetization_ngo_mode_toggled', { enabled: next }); }
    catch { /* swallow */ }
  }, [enabled]);

  const handleShortcut = useCallback((sc) => {
    try { trackEvent('monetization_ngo_shortcut_clicked', { id: sc.id }); }
    catch { /* swallow */ }
    try { navigate(sc.path); }
    catch { /* swallow */ }
  }, [navigate]);

  if (!flagOn) return null;

  return (
    <section style={{ ...S.card, ...(style || null) }} data-testid="monetization-ngo-mode-card">
      <div style={S.headRow}>
        <div style={S.headLeft}>
          <span aria-hidden="true" style={{ fontSize: 22 }}>{'\uD83C\uDFE2'}</span>
          <h3 style={S.title}>
            {tStrict('monetization.ngo.title', 'NGO mode')}
          </h3>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          style={{ ...S.toggle, ...(enabled ? S.toggleOn : null) }}
          data-testid="monetization-ngo-toggle"
          aria-pressed={enabled ? 'true' : 'false'}
        >
          {enabled
            ? tStrict('monetization.ngo.toggle.on',  'On')
            : tStrict('monetization.ngo.toggle.off', 'Turn on')}
        </button>
      </div>

      <p style={S.copy}>
        {tStrict(
          'monetization.ngo.copy',
          'Surface dashboard, reporting, and multi-user tracking shortcuts.'
        )}
      </p>

      {enabled ? (
        <div style={S.shortcuts} data-testid="monetization-ngo-shortcuts">
          {SHORTCUTS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleShortcut(sc)}
              style={S.shortcut}
              data-testid={`monetization-ngo-shortcut-${sc.id}`}
            >
              <span style={S.scIcon} aria-hidden="true">{sc.icon}</span>
              <span style={S.scBody}>
                <span style={S.scTitle}>{tStrict(sc.titleKey, sc.titleFallback)}</span>
                <span style={S.scCopy}>{tStrict(sc.bodyKey,  sc.bodyFallback)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
