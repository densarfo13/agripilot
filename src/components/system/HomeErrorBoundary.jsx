/**
 * HomeErrorBoundary — last-resort guard around the Home tree.
 *
 *   <HomeErrorBoundary>
 *     <Home />
 *   </HomeErrorBoundary>
 *
 * What it does
 *   • Catches any synchronous render error inside its children.
 *   • Logs `[FARROWAY_HOME_CRASH]` once with route + message
 *     (no PII, safe for production drains).
 *   • Renders <SafeHomeFallback /> in place of the crashed
 *     subtree, so the user sees real UI instead of a blank
 *     screen or the global ErrorBoundary's full-page card.
 *   • Stamps `farroway_last_home_crash_at` in localStorage so
 *     a follow-up tab open knows the previous render failed
 *     (the boot watchdog can read this if needed).
 *
 * Why dedicated, not the global ErrorBoundary
 *   The global ErrorBoundary unmounts the entire app and shows
 *   the recovery card with three buttons. That's the right UX
 *   for a fatal crash. For Home specifically — which the
 *   pilot needs to ALWAYS render — we want a softer landing:
 *   the user keeps their session, can navigate to /tasks /
 *   /dashboard, and only sees the global card when even the
 *   safe fallback fails to render.
 *
 * Strict-rule audit
 *   • Class component (required for componentDidCatch).
 *   • Render path is pure; no side effects.
 *   • Side effects (logging, localStorage stamp) are inside
 *     componentDidCatch only — never fire on the happy path.
 *   • Catches synchronously-thrown render errors. Does NOT
 *     catch async errors (those still bubble to the global
 *     ErrorBoundary or the user's onError listeners).
 */

import React from 'react';
import SafeHomeFallback from '../../pages/SafeHomeFallback.jsx';

function _currentPath() {
  try {
    return (typeof window !== 'undefined' && window.location)
      ? window.location.pathname
      : '';
  } catch { return ''; }
}

export default class HomeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Single greppable line. No PII; just route + message.
    try {
      // eslint-disable-next-line no-console
      console.error(
        '[FARROWAY_HOME_CRASH]',
        _currentPath(),
        (error && error.message) || error || 'unknown',
      );
    } catch { /* console missing in some sandboxes */ }
    // Stamp a marker so a follow-up boot can know the previous
    // render of Home crashed. Useful for the boot watchdog.
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          'farroway_last_home_crash_at',
          String(Date.now()),
        );
        if (info && typeof info.componentStack === 'string') {
          // 500-char cap — never log full stacks to disk.
          localStorage.setItem(
            'farroway_last_home_crash_stack',
            info.componentStack.slice(0, 500),
          );
        }
      }
    } catch { /* tolerate */ }
  }

  render() {
    if (this.state.hasError) {
      return <SafeHomeFallback />;
    }
    return this.props.children;
  }
}
