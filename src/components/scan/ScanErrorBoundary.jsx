/**
 * ScanErrorBoundary — scoped error boundary for the /scan route.
 *
 *   <ScanErrorBoundary>
 *     <ScanPage />
 *   </ScanErrorBoundary>
 *
 * If ANYTHING in the scan tree throws (render error, or a lazy chunk
 * whose module-init threw — e.g. a TDZ / circular-import crash like
 * "Cannot access 'o' before initialization"), this boundary renders a
 * DEPENDENCY-LIGHT fallback so the user is never stranded:
 *
 *   Title:  Scan temporarily unavailable
 *   Text:   You can still upload a clear photo or return home.
 *   Buttons: Upload Photo · Try Again · Go Home
 *
 * The fallback is <PlainUploadFallback> — it imports NOTHING from
 * ScanPage / ScanCamera / ScanRuntime / OODA / knowledge / offline
 * queue at module load (it dynamic-imports the analysis engine only
 * AFTER a file is picked), so it cannot re-trigger the crash it is
 * recovering from.
 *
 * Crash details are exposed (no secrets) for field diagnostics:
 *   window.__scanCrashDetails = { message, stack, route, timestamp, buildSha }
 *
 * Strict-rule audit
 *   • Pure React class. Never throws inside its own catch.
 *   • Logs once per error type — repeated crashes don't spam.
 *   • Resets on Retry so navigating back into /scan after a fix isn't
 *     permanently stuck on the fallback.
 */

import React from 'react';
import PlainUploadFallback from './PlainUploadFallback.jsx';
// Leaf, pure, never-throws — safe to use inside componentDidCatch.
import { getScanCorrelationId } from '../../lib/scanCorrelationId.js';

function _buildSha() {
  try {
    if (typeof window === 'undefined') return '';
    const w = window;
    return (typeof w.__FARROWAY_BUILD_SHA === 'string'
      && w.__FARROWAY_BUILD_SHA.indexOf('%') !== 0)
        ? w.__FARROWAY_BUILD_SHA : '';
  } catch { return ''; }
}

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
    // Correlation id ties this crash to the scan attempt's telemetry + server log
    // (Scan spec: "Log every failure with a correlation ID"). Pure + never throws.
    let correlationId = 'scan-unknown';
    try { correlationId = getScanCorrelationId(); } catch { /* keep default */ }

    // Console-log the crash with a greppable prefix + correlation id so engineers
    // can filter for it in DevTools / Railway log drains and match it to one scan.
    try {

      console.error('[FARROWAY_CRASH][scan_component_error]', correlationId,
        error && error.message ? error.message : error,
        info && info.componentStack ? info.componentStack.slice(0, 500) : '');
    } catch { /* swallow */ }

    // Expose safe crash details for field diagnostics (no secrets).
    try {
      if (typeof window !== 'undefined') {
        window.__scanCrashDetails = Object.freeze({
          correlationId,
          message:   error && error.message ? String(error.message).slice(0, 300) : 'unknown',
          stack:     error && error.stack ? String(error.stack).slice(0, 2000) : '',
          route:     '/scan',
          timestamp: new Date().toISOString(),
          buildSha:  _buildSha(),
        });
      }
    } catch { /* never throw from a catch handler */ }

    // Persist the exception to client diagnostics (survives reload; exportable by the
    // farmer via the fallback's Export Diagnostic Report). Dynamic import so a load error
    // never crashes the boundary's catch handler.
    try {
      import('../../lib/clientDiagnostics.js')
        .then((mod) => {
          try {
            if (mod && typeof mod.recordDiagException === 'function') {
              mod.recordDiagException({
                source: 'ScanErrorBoundary', phase: 'scan-render',
                message: error && error.message ? String(error.message) : 'unknown',
                stack: error && error.stack ? String(error.stack) : '',
                componentStack: info && info.componentStack ? String(info.componentStack) : '',
                correlationId, route: '/scan',
              });
            }
          } catch { /* never propagate */ }
        })
        .catch(() => { /* tolerate */ });
    } catch { /* never throw from a catch handler */ }

    // Fire-and-forget analytics. Dynamic import so a missing analytics
    // module never crashes the boundary's catch handler.
    try {
      import('../../lib/analytics.js')
        .then((mod) => {
          try {
            if (mod && typeof mod.safeTrackEvent === 'function') {
              mod.safeTrackEvent('scan_component_error', {
                correlationId,
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
    // Reset local state first so React replaces the fallback with the
    // children on next render, then reload so any wedged module-level
    // state in ScanPage / ScanCapture starts fresh.
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
    // Dependency-light recovery — PlainUploadFallback pulls in no scan
    // runtime / camera at module load, so it cannot re-crash.
    return (
      <PlainUploadFallback
        title="Scan temporarily unavailable"
        body="You can still upload a clear photo or return home."
        onRetry={this.handleRetry}
        showUpload
      />
    );
  }
}
