/**
 * ChartErrorBoundary — narrow error boundary that wraps a single
 * recharts mount.
 *
 * Why this exists
 * ───────────────
 * Recharts 2.15 + React 18 occasionally throws inside its layout
 * scheduler when a chart receives empty / NaN / fast-changing data
 * (the production stacks look like
 *
 *    at Jf at sd at Xw at Hw at aM at Ll at Pd at zw at S at MessagePort.D
 *
 * — minified internals all the way down). When that happens the
 * default behaviour is to unmount the entire React subtree above
 * the chart, which blows up the surrounding admin / analytics page.
 *
 * The global ErrorBoundary in src/components/ErrorBoundary.jsx is
 * intentionally aggressive — full-page recovery + reload button. A
 * single chart misfiring shouldn't trigger that. This component
 * catches errors only inside its subtree and renders an inline
 * "chart unavailable" placeholder, leaving everything else on the
 * page interactive.
 *
 * Pure presentational — no analytics dependency, no props beyond
 * children + an optional fallback message.
 */

import React from 'react';

export default class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Log with the same prefix the app-wide boundary uses — operators
    // grep [FARROWAY_CRASH] in Sentry / Railway. Tagged "chart" so a
    // chart misfire is distinguishable from a real page crash.
    try {
      console.error('[FARROWAY_CRASH][chart]', error, info?.componentStack);
    } catch { /* console missing — never propagate */ }
  }

  render() {
    if (this.state.hasError) {
      const msg = this.props.fallbackText || 'Chart unavailable';
      return (
        <div style={S.fallback} role="status" aria-live="polite">
          <span style={S.icon} aria-hidden="true">{'\uD83D\uDCCA'}</span>
          <span>{msg}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

const S = {
  fallback: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    minHeight: '120px',
    padding: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '0.875rem',
  },
  icon: { fontSize: '1.125rem', lineHeight: 1 },
};
