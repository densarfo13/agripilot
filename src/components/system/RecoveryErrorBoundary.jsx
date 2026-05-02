/**
 * RecoveryErrorBoundary \u2014 wraps a subtree and renders a
 * recovery card when anything throws (spec \u00a78).
 *
 *   <RecoveryErrorBoundary>
 *     <App />
 *   </RecoveryErrorBoundary>
 *
 * Buttons (production-hardening spec \u00a74\u2013\u00a75)
 *   \u2022 Try again         \u2192 reload the current route. Most
 *                          render-time exceptions are transient
 *                          and reloading clears them without
 *                          touching any data.
 *   \u2022 Fix setup issue   \u2192 clearAllOnboardingDrafts() (only
 *                          wipes the onboarding-draft slots; the
 *                          user's farms / gardens / scans /
 *                          language / sign-in are kept) + reload.
 *                          Replaces the old "Clear local app
 *                          cache" wording, which was technical
 *                          and scared non-technical users.
 *   \u2022 Restart setup     \u2192 clear onboarding drafts + navigate
 *                          to /onboarding/start (the canonical
 *                          post-rewrite entry).
 *
 * Strict-rule audit
 *   \u2022 Never wipes farms / gardens / scans / language / sign-in.
 *   \u2022 No window.confirm() prompts \u2014 the recovery copy already
 *     reassures the user that data is safe.
 *   \u2022 Renders children unchanged when nothing has thrown so
 *     the boundary is a no-op on the happy path.
 *   \u2022 componentDidCatch fires onboarding_recovery_shown +
 *     each handler fires onboarding_recovery_used so the launch
 *     dashboard can attribute recovery rates per action.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { clearAllOnboardingDrafts } from '../../core/onboardingDraft.js';
// We keep the legacy session-repair pass available for any
// future "deep clean" path, but the standard recovery card no
// longer surfaces it \u2014 the three new buttons cover the
// realistic failure modes without scaring a farmer with words
// like "session" or "cache".
// eslint-disable-next-line no-unused-vars
import { repairFarrowaySession } from '../../utils/repairSession.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

// Canonical post-rewrite onboarding entry. The legacy
// /onboarding/simple path stays reachable but isn't where
// a farmer who just hit an error should land.
const SETUP_PATH = '/onboarding/start';

export default class RecoveryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleTryAgain = this.handleTryAgain.bind(this);
    this.handleFix      = this.handleFix.bind(this);
    this.handleRestart  = this.handleRestart.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Dev-only console trace; production swallows so we never
    // surface raw stack traces to a farmer.
    try {
      if (typeof import.meta !== 'undefined'
          && import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error('[RecoveryErrorBoundary]', error, info);
      }
    } catch { /* swallow */ }
    // Production-hardening spec \u00a71 \u2014 telemetry. Captures the
    // error message + the surface that crashed so the launch
    // dashboard can spot a regression spike. componentStack is
    // truncated to keep the payload reasonable.
    try {
      const errorReason = (error && (error.message || String(error))) || 'unknown';
      const componentStack = info && typeof info.componentStack === 'string'
        ? info.componentStack.slice(0, 240) : '';
      trackEvent('onboarding_recovery_shown', {
        errorReason,
        componentStack,
      });
    } catch { /* never let telemetry cascade */ }
  }

  // \u00a75 \u2014 Try again: reload the current route. Most render-
  // time crashes are transient and reloading clears them.
  handleTryAgain() {
    try { trackEvent('onboarding_recovery_used', { action: 'try_again' }); }
    catch { /* swallow */ }
    try { window.location.reload(); } catch { /* ignore */ }
  }

  // \u00a75 \u2014 Fix setup issue: wipe ONLY onboarding-draft slots
  // (farms / gardens / scans / language / sign-in are kept) +
  // reload. Replaces the legacy "Clear local app cache" button,
  // which used technical wording that scared non-technical users.
  handleFix() {
    try { trackEvent('onboarding_recovery_used', { action: 'fix_setup' }); }
    catch { /* swallow */ }
    try { clearAllOnboardingDrafts(); } catch { /* swallow */ }
    try { window.location.reload(); } catch { /* ignore */ }
  }

  // \u00a75 \u2014 Restart setup: wipe onboarding drafts + send the
  // farmer to the canonical onboarding entry. User account
  // (auth token, profile) is NOT touched.
  handleRestart() {
    try { trackEvent('onboarding_recovery_used', { action: 'restart_setup' }); }
    catch { /* swallow */ }
    try { clearAllOnboardingDrafts(); } catch { /* swallow */ }
    try { window.location.assign(SETUP_PATH); }
    catch { /* ignore */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children || null;

    return (
      <main style={S.page} data-testid="recovery-error-boundary">
        <div style={S.card}>
          <span style={S.eyebrow}>
            {tSafe('recovery.errorEyebrow', 'Something went wrong')}
          </span>
          <h1 style={S.title}>
            {tSafe('recovery.errorTitle',
              'We hit a problem rendering this page')}
          </h1>
          {/* Spec \u00a74 \u2014 user-friendly recovery copy. Reassures
              the farmer their saved data is safe so they can
              tap a recovery action without anxiety. */}
          <p style={S.body}>
            {tSafe('recovery.errorBody',
              'Something didn\u2019t load correctly. Your saved farm or garden is safe. Tap below to fix setup and continue.')}
          </p>

          <button
            type="button"
            onClick={this.handleTryAgain}
            style={{ ...S.btn, ...S.btnPrimary }}
            data-testid="recovery-try-again"
          >
            {tSafe('recovery.tryAgain', 'Try again')}
          </button>
          <button
            type="button"
            onClick={this.handleFix}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="recovery-fix-setup"
          >
            {tSafe('recovery.fixSetup', 'Fix setup issue')}
          </button>
          <button
            type="button"
            onClick={this.handleRestart}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="recovery-restart"
          >
            {tSafe('recovery.restart', 'Restart setup')}
          </button>
        </div>
      </main>
    );
  }
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1.5rem 1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '32rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  eyebrow: {
    fontSize: '0.6875rem',
    color: '#FCA5A5',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  title: { margin: 0, fontSize: '1.375rem', fontWeight: 700 },
  body: { margin: '0 0 0.5rem', color: '#9FB3C8', fontSize: '0.9375rem', lineHeight: 1.5 },
  btn: {
    padding: '0.75rem 1rem',
    borderRadius: 12,
    border: 'none',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
  },
  btnPrimary: { background: '#22C55E', color: '#062714' },
  btnGhost: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.16)',
    color: '#EAF2FF',
  },
};
