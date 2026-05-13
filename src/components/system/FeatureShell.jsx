/**
 * FeatureShell — isolated error boundary for discrete feature modules.
 *
 * Wraps a self-contained feature (weather card, funding panel, scan
 * widget, marketplace tile, analytics chart) so that if it crashes:
 *   • The rest of the page continues working.
 *   • A minimal inline fallback replaces the feature widget.
 *   • An analytics event records the feature name and error.
 *   • No full-page crash or redirect.
 *
 * USAGE
 * ─────
 *   <FeatureShell name="weather">
 *     <WeatherHeroCard weather={weather} />
 *   </FeatureShell>
 *
 *   <FeatureShell name="funding" silent>
 *     <FundingWidget />
 *   </FeatureShell>
 *
 *   <FeatureShell name="analytics" fallback={<div>Stats unavailable</div>}>
 *     <RevenueChart />
 *   </FeatureShell>
 *
 * PROPS
 * ─────
 *   name     {string}    — feature identifier (appears in logs + test ids)
 *   children {ReactNode}
 *   fallback {ReactNode} — custom fallback (default: inline "unavailable" card)
 *   silent   {boolean}   — if true, hide even the fallback card on error
 *                          (use for non-critical decorative widgets)
 *
 * ISOLATION GUARANTEE
 * ───────────────────
 *   Any render error that escapes this boundary is caught here and
 *   never propagates to the parent route. Weather crashing never
 *   crashes Tasks. Funding crashing never crashes the map.
 *
 * STRICT-RULE AUDIT
 * ─────────────────
 *   • Class component — required for getDerivedStateFromError.
 *   • No hooks — class component constraint.
 *   • Inline styles only — zero stylesheet dependency.
 *   • Analytics via dynamic import — never re-throws.
 */

import { Component } from 'react';

// ─── Default inline fallback ──────────────────────────────────────
function DefaultFeatureFallback({ name, onRetry }) {
  return (
    <div style={S.card} data-testid={`feature-fallback-${name}`} role="status">
      <span style={S.icon} aria-hidden="true">⚠️</span>
      <span style={S.label}>{name} unavailable</span>
      {onRetry && (
        <button type="button" style={S.retry} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────
export class FeatureShell extends Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false, errorMsg: '' };
    this._handleRetry = this._handleRetry.bind(this);
  }

  static getDerivedStateFromError(err) {
    return {
      crashed:  true,
      errorMsg: err?.message ? String(err.message) : String(err),
    };
  }

  componentDidCatch(err, info) {
    try {
      const featureName = this.props.name || 'unknown';
      import('../../lib/analytics.js')
        .then((m) => {
          try {
            m.safeTrackEvent?.('feature_error', {
              feature:   featureName,
              message:   err?.message ?? String(err),
              component: info?.componentStack?.trim().split('\n')[1]?.trim() || 'unknown',
              source:    'FeatureShell',
            });
          } catch { /* ignore */ }
        })
        .catch(() => { /* never re-throw */ });

      // Warn in dev — no-op in production.
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
         
        console.warn(`[FeatureShell:${featureName}] Feature crashed:`, err?.message);
      }
    } catch { /* never block */ }
  }

  _handleRetry() {
    this.setState({ crashed: false, errorMsg: '' });
  }

  render() {
    const { name = 'feature', children, fallback, silent } = this.props;

    if (!this.state.crashed) return children;

    // Silent mode — render nothing so a decorative widget doesn't
    // leave an ugly error card in its place.
    if (silent) return null;

    // Custom fallback supplied by the caller.
    if (fallback !== undefined) return fallback;

    // Default inline fallback.
    return <DefaultFeatureFallback name={name} onRetry={this._handleRetry} />;
  }
}

// ─── Styles ───────────────────────────────────────────────────────
const S = {
  card: {
    display:     'flex',
    alignItems:  'center',
    gap:         '8px',
    padding:     '10px 14px',
    borderRadius:'12px',
    background:  'rgba(245,158,11,0.06)',
    border:      '1px dashed rgba(245,158,11,0.30)',
    fontSize:    '13px',
    color:       'rgba(255,255,255,0.55)',
    fontFamily:  'Inter, system-ui, sans-serif',
  },
  icon:  { fontSize: '14px', flexShrink: 0 },
  label: { flex: 1 },
  retry: {
    flexShrink:   0,
    padding:      '4px 12px',
    borderRadius: '999px',
    border:       '1px solid rgba(255,255,255,0.2)',
    background:   'transparent',
    color:        'rgba(255,255,255,0.75)',
    fontSize:     '12px',
    fontWeight:   700,
    cursor:       'pointer',
  },
};

export default FeatureShell;
