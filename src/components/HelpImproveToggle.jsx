/**
 * HelpImproveToggle — settings tile for the Global Insights
 * Layer privacy switch (data moat §8).
 *
 * Wraps `setInsightsOptIn` / `isInsightsOptIn` from
 * `src/core/insightsPrivacy.js`. Default state: ON. When
 * the user toggles OFF the helper proactively clears the
 * pending sync queue + 24h cache so the change takes effect
 * immediately, not on the next tick.
 *
 * Mounted in FarmerSettingsPage alongside the existing
 * FarmerSettingsPanel + NotificationSettingsPanel.
 *
 * Visible text routes through tStrict (strict no-English-leak).
 * Non-English UIs that don't yet ship the keys fall back to
 * the caller's localized fallback strings — never the bare
 * English value.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tStrict } from '../i18n/strictT.js';
import { isInsightsOptIn, setInsightsOptIn } from '../core/insightsPrivacy.js';

export default function HelpImproveToggle() {
  // Subscribe to language change so the labels refresh on flip.
  useTranslation();
  const [enabled, setEnabled] = useState(isInsightsOptIn);

  // Sync across tabs / settings panels so toggling here
  // immediately reflects everywhere else (the privacy module
  // dispatches `farroway:insightsOptInChange`).
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = (e) => setEnabled(typeof e?.detail === 'boolean' ? e.detail : isInsightsOptIn());
    window.addEventListener('farroway:insightsOptInChange', handler);
    return () => window.removeEventListener('farroway:insightsOptInChange', handler);
  }, []);

  const toggle = useCallback(() => {
    const next = !enabled;
    setInsightsOptIn(next);
    setEnabled(next);
  }, [enabled]);

  const title = tStrict('settings.helpImprove.title', 'Help improve recommendations');
  const desc  = tStrict('settings.helpImprove.description',
    'Share anonymous usage counts to help us improve tips for your area.');
  const stateLabel = enabled
    ? tStrict('settings.helpImprove.on',  'On')
    : tStrict('settings.helpImprove.off', 'Off');

  return (
    <section style={S.card} data-testid="help-improve-toggle">
      <div style={S.row}>
        <div style={S.text}>
          <div style={S.title}>{title}</div>
          {desc ? <div style={S.desc}>{desc}</div> : null}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={enabled}
          style={{ ...S.toggle, ...(enabled ? S.toggleOn : S.toggleOff) }}
        >
          <span aria-hidden="true" style={{ ...S.knob, ...(enabled ? S.knobOn : S.knobOff) }} />
          <span style={S.stateLabel}>{stateLabel}</span>
        </button>
      </div>
    </section>
  );
}

const S = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '1rem',
  },
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#EAF2FF',
    marginBottom: '0.25rem',
  },
  desc: {
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.62)',
    lineHeight: 1.4,
  },
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px 6px 6px',
    borderRadius: 999,
    border: '1px solid rgba(255,255,255,0.18)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    minHeight: 36,
    flex: '0 0 auto',
    WebkitTapHighlightColor: 'transparent',
    transition: 'background 160ms ease, border-color 160ms ease',
  },
  toggleOn: {
    background: 'rgba(200,148,77,0.20)',
    borderColor: 'rgba(200,148,77,0.55)',
  },
  toggleOff: {
    background: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  knob: {
    display: 'inline-block',
    width: 20,
    height: 20,
    borderRadius: 999,
    transition: 'background 160ms ease, transform 160ms ease',
  },
  knobOn:  { background: '#C8944D', transform: 'translateX(0)' },
  knobOff: { background: '#6F8299', transform: 'translateX(0)' },
  stateLabel: { letterSpacing: '0.04em', textTransform: 'uppercase' },
};
