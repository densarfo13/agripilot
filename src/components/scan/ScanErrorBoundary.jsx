/**
 * ScanErrorBoundary — scoped error boundary for the /scan route.
 *
 *   <ScanErrorBoundary>
 *     <ScanPage />
 *   </ScanErrorBoundary>
 *
 * Why scoped (not the global ErrorBoundary)
 *   The global boundary in main.jsx surfaces the calm-recovery
 *   card with "Reload page" / "Fix setup issue" / "Restart
 *   setup" buttons. That's the right surface for an unexpected
 *   crash on most pages. For /scan we'd rather degrade
 *   gracefully into a still-useful fallback (Upload photo +
 *   Retry) so the user can keep going. This boundary catches
 *   render throws inside the scan tree and renders ScanFallback
 *   in their place, then logs `scan_component_error` so the
 *   crash is greppable in DevTools / analytics.
 *
 * Strict-rule audit
 *   • Pure React class. Never throws inside its own catch.
 *   • Logs once per error type — repeated crashes don't spam.
 *   • Resets on prop change so navigating back into /scan after
 *     a fix isn't permanently stuck on the fallback.
 */

import React from 'react';
import ScanFallback from './ScanFallback.jsx';

export default class ScanErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error && error.message ? String(error.message).slice(0, 200) : 'unknown',
    };
  }

  componentDidCatch(error, info) {
    // Console-log the crash with a greppable prefix so engineers
    // can filter for it in Chrome DevTools / Railway log drains.
    try {
       
      console.error('[FARROWAY_CRASH][scan_component_error]',
        error && error.message ? error.message : error,
        info && info.componentStack ? info.componentStack.slice(0, 500) : '');
    } catch { /* swallow */ }

    // Fire-and-forget analytics. Dynamic import so a missing
    // analytics module never crashes the boundary's catch handler.
    try {
      import('../../lib/analytics.js')
        .then((mod) => {
          try {
            if (mod && typeof mod.safeTrackEvent === 'function') {
              mod.safeTrackEvent('scan_component_error', {
                message: error && error.message
                  ? String(error.message).slice(0, 200) : 'unknown',
                componentStack: info && info.componentStack
                  ? String(info.componentStack).slice(0, 500) : null,
                page: '/scan',
              });
            }
          } catch { /* never propagate */ }
        })
        .catch(() => { /* tolerate */ });
    } catch { /* never throw from a catch handler */ }
  }

  handleRetry = () => {
    // Reset local state first so React replaces the fallback
    // with the children on next render, then reload so any
    // wedged module-level state in ScanPage / ScanCapture starts
    // fresh.
    this.setState({ hasError: false, errorMessage: null });
    try {
      if (typeof window !== 'undefined'
          && window.location
          && typeof window.location.reload === 'function') {
        window.location.reload();
      }
    } catch { /* never throw */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <ScanFallback
        reason="crash"
        onRetry={this.handleRetry}
      />
    );
  }
}
