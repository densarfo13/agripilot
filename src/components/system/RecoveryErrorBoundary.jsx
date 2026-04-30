/**
 * RecoveryErrorBoundary — wraps a subtree and renders a
 * three-button recovery card when anything throws (spec §8).
 *
 *   <RecoveryErrorBoundary>
 *     <App />
 *   </RecoveryErrorBoundary>
 *
 * Buttons:
 *   • Repair session         → repairFarrowaySession() + reload
 *   • Restart setup          → navigate to /onboarding/simple
 *   • Clear local app cache  → clearFarrowayCacheKeepingAuth() +
 *                              reload (auth token kept)
 *
 * Strict-rule audit
 *   • Never wipes data without the farmer's confirmation.
 *   • Repair pass is non-destructive (see repairSession.js).
 *   • Auth token is preserved by clear so the farmer stays
 *     signed in after the cache wipe.
 *   • Renders children unchanged when nothing has thrown so
 *     the boundary is a no-op on the happy path.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import {
  repairFarrowaySession,
  clearFarrowayCacheKeepingAuth,
} from '../../utils/repairSession.js';

const SETUP_PATH = '/onboarding/simple';

export default class RecoveryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleRepair  = this.handleRepair.bind(this);
    this.handleRestart = this.handleRestart.bind(this);
    this.handleClear   = this.handleClear.bind(this);
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
  }

  handleRepair() {
    try { repairFarrowaySession(); } catch { /* swallow */ }
    try { window.location.reload(); } catch { /* ignore */ }
  }

  handleRestart() {
    try { window.location.assign(SETUP_PATH); }
    catch { /* ignore */ }
  }

  handleClear() {
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(
        tSafe('recovery.clearConfirm',
          'Clear local Farroway cache on this device? Your sign-in stays.')
      );
      if (!ok) return;
    }
    try { clearFarrowayCacheKeepingAuth(); } catch { /* swallow */ }
    try { window.location.reload(); } catch { /* ignore */ }
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
          <p style={S.body}>
            {tSafe('recovery.errorBody',
              'Your farm data is safe. Try one of the recovery options below.')}
          </p>

          <button
            type="button"
            onClick={this.handleRepair}
            style={{ ...S.btn, ...S.btnPrimary }}
            data-testid="recovery-repair"
          >
            {tSafe('recovery.repair', 'Repair session')}
          </button>
          <button
            type="button"
            onClick={this.handleRestart}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="recovery-restart"
          >
            {tSafe('recovery.restart', 'Restart setup')}
          </button>
          <button
            type="button"
            onClick={this.handleClear}
            style={{ ...S.btn, ...S.btnGhost }}
            data-testid="recovery-clear"
          >
            {tSafe('recovery.clearCache', 'Clear local app cache')}
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
