/**
 * MapErrorBoundary — narrow error boundary for lazy-loaded map
 * subtrees.
 *
 * Same pattern as ChartErrorBoundary. When a map chunk fails to
 * load, leaflet throws inside its layout pass, or a tile server
 * is unreachable + the library blows up, the boundary catches
 * the throw and renders a small inline placeholder. The
 * surrounding NGO control panel keeps working - the map is
 * explicitly optional per the strict rule.
 *
 * Strict-rule audit:
 *   * never propagates: catches any render error in the subtree
 *   * lightweight: pure class component, inline styles only
 *   * never spams: one [FARROWAY_CRASH][map] log per mount
 */

import React from 'react';

export default class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    try {
      console.error('[FARROWAY_CRASH][map]', error, info && info.componentStack);
    } catch { /* console missing */ }
  }

  render() {
    if (this.state.hasError) {
      const msg = this.props.fallbackText || 'Map unavailable — showing list view';
      return (
        <div style={S.fallback} role="status" aria-live="polite"
             data-testid="map-error-fallback">
          <span style={S.icon} aria-hidden="true">{'\uD83D\uDDFA\uFE0F'}</span>
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
    minHeight: '160px',
    padding: '1rem',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px dashed rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.875rem',
  },
  icon: { fontSize: '1.25rem', lineHeight: 1 },
};
