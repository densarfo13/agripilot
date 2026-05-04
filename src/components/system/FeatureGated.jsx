/**
 * FeatureGated — wraps a route element and shows a friendly
 * "Feature temporarily disabled for pilot." surface when the
 * named feature flag is off.
 *
 *   <Route path="/sell" element={
 *     <FeatureGated flag="FEATURE_SELL" feature="sell">
 *       <Sell />
 *     </FeatureGated>
 *   } />
 *
 * Why this exists
 *   The pilot stability spec calls for hidden routes to render
 *   a calm placeholder rather than 404 OR mounting an unstable
 *   surface. This wrapper is the canonical hook — feature_flag
 *   off → DisabledFeatureFallback; on → render children
 *   normally.
 *
 *   The flag is checked via the existing isFeatureEnabled()
 *   helper which already supports admin overrides + per-device
 *   localStorage opt-in (`farroway:flag:<NAME> = 1`). So a
 *   product owner can flip a gate on for their own device for
 *   testing without redeploying.
 *
 * Strict-rule audit
 *   • Pure presentational. Never throws.
 *   • Falls open (renders children) if the flag system itself
 *     errors — better to show the live page than a static
 *     placeholder when the gate is broken.
 */

import React from 'react';
import { isFeatureEnabled } from '../../utils/featureFlags.js';
import DisabledFeatureFallback from './DisabledFeatureFallback.jsx';

export default function FeatureGated({ flag, feature, message, children }) {
  let enabled = true;
  try {
    enabled = isFeatureEnabled(flag);
  } catch {
    enabled = true;  // fall open on any flag-system error
  }
  if (enabled) return children;
  return <DisabledFeatureFallback feature={feature || flag} message={message} />;
}
