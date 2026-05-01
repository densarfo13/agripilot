/**
 * UserFeedbackPromptHost — global listener that mounts the
 * `UserFeedbackPrompt` card when a meaningful action emits
 * `farroway:request_feedback`.
 *
 *   <UserFeedbackPromptHost />
 *
 * Mounted once in `ProtectedLayout` so the prompt can appear
 * over any farmer-facing page without each surface needing
 * to render the component itself. Single source of truth for
 * the spec §8 rules:
 *
 *   * Show max once per session (sessionStorage flag).
 *   * Never on first app open — host is idle until a request
 *     event fires.
 *   * Skip the prompt while the user is in an onboarding /
 *     setup path so we never interrupt a setup flow.
 *
 * Strict-rule audit
 *   * No I/O on render.
 *   * Tear-down listener on unmount.
 *   * Wraps every store / analytics call in try/catch.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import UserFeedbackPrompt from './UserFeedbackPrompt.jsx';
import {
  REQUEST_EVENT,
  wasPromptShownThisSession, markPromptShown,
} from '../../analytics/userFeedbackStore.js';
import { trackEvent } from '../../analytics/analyticsStore.js';

// Spec §8 — never interrupt setup. These prefixes match the
// onboarding + first-time-setup paths used elsewhere in the app
// (BottomTabNav has the canonical list at `_isSetupPath`).
const SETUP_PATH_PREFIXES = [
  '/start',
  '/farmer-welcome',
  '/verify-otp',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/onboarding',
  '/farm/new',
  '/profile/setup',
  '/welcome',
  '/landing',
  '/beginner-reassurance',
];

function _isSetupPath(pathname) {
  if (!pathname) return false;
  for (const p of SETUP_PATH_PREFIXES) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

export default function UserFeedbackPromptHost() {
  const location = useLocation();
  const [active, setActive] = useState(null); // null | { screen }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function onRequest(ev) {
      try {
        if (active) return; // already rendered something
        if (wasPromptShownThisSession()) return;
        if (_isSetupPath(location?.pathname || '')) return;

        const detail = (ev && ev.detail) || {};
        const screen = String(detail.screen || '').trim();
        if (!screen) return;

        // Honor spec §8 "small delay so it doesn't overlap with
        // a success toast". 800ms is short enough to feel
        // intentional but long enough that the toast clears.
        const id = setTimeout(() => {
          try { markPromptShown(); } catch { /* swallow */ }
          try { trackEvent('feedback_prompt_shown', { screen }); }
          catch { /* swallow */ }
          setActive({ screen });
        }, 800);

        // Stash the timer on the host so a second event fired
        // while we're in the delay window can cancel it.
        onRequest._lastTimer = id;
      } catch { /* never propagate */ }
    }

    window.addEventListener(REQUEST_EVENT, onRequest);
    return () => {
      try { clearTimeout(onRequest._lastTimer); } catch { /* swallow */ }
      window.removeEventListener(REQUEST_EVENT, onRequest);
    };
    // location.pathname listed so a route change while the host
    // is mounted re-evaluates the setup-path guard for any new
    // request events that arrive afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, location?.pathname]);

  if (!active) return null;
  return (
    <UserFeedbackPrompt
      screen={active.screen}
      onClose={() => setActive(null)}
    />
  );
}
