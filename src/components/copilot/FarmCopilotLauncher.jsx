/**
 * FarmCopilotLauncher — the floating entry point for the
 * Conversational Farm Copilot Beta.
 *
 *   <FarmCopilotLauncher />   // mounted once in ProtectedLayout
 *
 * Behaviour (spec §3)
 *   • Renders NOTHING unless FEATURE_FARM_COPILOT_BETA is enabled.
 *     With the flag off (the default) this component returns null,
 *     so the app is byte-for-byte unchanged for every farmer.
 *   • Floating button, bottom-right, ABOVE the existing voice FAB
 *     (which sits at 64px) so the two never overlap — the copilot
 *     FAB stacks at ~124px.
 *   • Tapping opens the FarmCopilotSheet (lazy-loaded so the Beta
 *     code is not even parsed when the flag is off).
 *
 * Strict-rule audit
 *   • Flag-gated — zero footprint when disabled.
 *   • Inline styles only. Safe-area aware. Never throws.
 */

import React, { Suspense } from 'react';
import { isFeatureEnabled, isKilled } from '../../utils/featureFlags.js';
import { tSafe } from '../../i18n/tSafe.js';

// Lazy — the Beta sheet (and its engine graph) is only fetched the
// first time a flagged-in user actually opens the copilot.
const FarmCopilotSheet = React.lazy(() => import('./FarmCopilotSheet.jsx'));

export default function FarmCopilotLauncher() {
  const [open, setOpen] = React.useState(false);

  // Hard gate — Beta flag off, OR the emergency kill switch is
  // on, ⇒ nothing renders.
  if (!isFeatureEnabled('FEATURE_FARM_COPILOT_BETA') || isKilled('copilot')) return null;

  const label = tSafe('copilot.launch', 'Farm Copilot Beta');

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={S.fab}
        aria-label={label}
        data-testid="farm-copilot-launcher"
      >
        <span aria-hidden="true" style={S.icon}>{'🎤'}</span>
        <span style={S.beta}>{tSafe('copilot.betaTag', 'Beta')}</span>
      </button>
      {open && (
        <Suspense fallback={null}>
          <FarmCopilotSheet open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

const S = {
  fab: {
    position: 'fixed',
    right: '1rem',
    // Stacks ABOVE the voice launcher FAB (bottom 64px) so the
    // two Beta/voice affordances never overlap.
    bottom: 'calc(124px + env(safe-area-inset-bottom, 0px))',
    minWidth: 48,
    height: 48,
    padding: '0 0.75rem',
    borderRadius: 999,
    border: 'none',
    background: '#1F6F54',
    color: '#FFFFFF',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(0,0,0,0.30)',
    zIndex: 90,
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    WebkitTapHighlightColor: 'transparent',
  },
  icon: { fontSize: '1.25rem', lineHeight: 1 },
  beta: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
};
