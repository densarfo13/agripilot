/**
 * RC1RouteGate.jsx — release-blocker route hider.
 *
 *   <Route path="/buy" element={
 *     <RC1RouteGate flag="buyMarketplace">
 *       <Buy />
 *     </RC1RouteGate>
 *   } />
 *
 * What this is
 * ────────────
 *   For RC1 App Store submission we cannot expose transactional
 *   surfaces (marketplace/buy/sell, operator/metrics dashboards)
 *   while their backends are stubbed. The existing pages handle
 *   the "off" state by rendering a "Coming soon" notice — but the
 *   App Store review process flags reachable stubs under
 *   Guideline 4.3 (spam).
 *
 *   This gate REDIRECTS to /home when the flag is off, making the
 *   route effectively non-existent for the user. The component
 *   below stays in the codebase for the future when the flag flips.
 *
 * Strict-rule audit
 *   • Pure component. SSR-safe (Navigate is React Router primitive).
 *   • No new feature; pure governance.
 *   • Composes existing `isFeatureEnabled` + react-router Navigate.
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { isFeatureEnabled } from '../../config/features.js';

export default function RC1RouteGate({ flag, children, redirectTo }) {
  const on = (() => {
    try { return isFeatureEnabled(flag); } catch { return false; }
  })();
  if (on) return <>{children}</>;
  const fallback = typeof redirectTo === 'string' && redirectTo
    ? redirectTo : '/home';
  return <Navigate to={fallback} replace />;
}
