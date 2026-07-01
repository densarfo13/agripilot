/**
 * ScanResultErrorBoundary — a RESULT-scoped error boundary.
 *
 * The scan analysis can SUCCEED (a real diagnosis comes back) but the rich result
 * renderers (ScanResultCard / IntelligentScanResult) can still throw during render
 * if the result envelope has an unexpected shape — a partial/stale history entry
 * (`entry.raw`), a provider error envelope, or a field the guards missed. Without
 * this, that render throw bubbles to the page-level ScanErrorBoundary and the farmer
 * sees the dead-end "Scan temporarily unavailable".
 *
 * This boundary wraps ONLY the result renderer, so a result-render crash becomes an
 * explicit RECOVERABLE outcome (Scan spec): the scan is saved for review, the photo
 * is preserved and shown, and Try Again is offered — never a dead-end. The exact
 * reason (correlation id) is captured for engineers, not shown as a technical error.
 *
 * Strict-rule audit: pure React class · never throws in its own catch · farmer-safe copy.
 */
import React from 'react';
import { getScanCorrelationId } from '../../lib/scanCorrelationId.js';
import { tSafe } from '../../i18n/tSafe.js';

// tSafe is pure (always returns the English fallback if a key is missing), so it is
// safe to call from render even inside a boundary. Wrap defensively regardless.
const _tSafe = (k, fb) => { try { return tSafe(k, fb); } catch { return fb; } };

export default class ScanResultErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, correlationId: null };
  }

  static getDerivedStateFromError() {
    let correlationId = 'scan-unknown';
    try { correlationId = getScanCorrelationId(); } catch { /* keep default */ }
    return { hasError: true, correlationId };
  }

  componentDidCatch(error, info) {
    try {
      const cid = this.state.correlationId || (function () { try { return getScanCorrelationId(); } catch { return 'scan-unknown'; } })();
      console.error('[FARROWAY_CRASH][scan_result_render_error]', cid,
        error && error.message ? error.message : error,
        info && info.componentStack ? info.componentStack.slice(0, 400) : '');
      if (typeof window !== 'undefined') {
        window.__scanResultCrash = Object.freeze({
          correlationId: cid,
          message: error && error.message ? String(error.message).slice(0, 300) : 'unknown',
          componentStack: info && info.componentStack ? String(info.componentStack).slice(0, 800) : '',
          timestamp: new Date().toISOString(),
        });
      }
    } catch { /* never throw from a catch handler */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const previewUrl = this.props.previewUrl || null;
    const onRetry = typeof this.props.onRetry === 'function' ? this.props.onRetry : null;
    // Farmer-friendly RECOVERABLE state — never a dead-end. The scan is kept for review.
    return (
      <div data-testid="scan-result-saved-for-review"
        style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.045)', textAlign: 'center' }}>
        {previewUrl ? (
          <img src={previewUrl} alt="" data-testid="scan-result-saved-photo"
            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, margin: '0 auto 10px' }} />
        ) : null}
        <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#EAF2FF' }}>
          {_tSafe('scan.result.savedTitle', 'We saved your scan for review')}
        </h3>
        <p style={{ margin: '0 0 14px', fontSize: 14, color: 'rgba(234,242,255,0.72)', lineHeight: 1.45 }}>
          {_tSafe('scan.result.savedBody',
            'Your photo is safe. We could not show the full result this time — you can try again, and an expert can review it.')}
        </p>
        {onRetry ? (
          <button type="button" onClick={onRetry} data-primary-action="true" data-testid="scan-result-retry"
            style={{ minHeight: 48, width: '100%', borderRadius: 999, border: 'none',
              background: '#C8944D', color: '#08111A', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {_tSafe('scan.result.tryAgain', 'Try again')}
          </button>
        ) : null}
      </div>
    );
  }
}
