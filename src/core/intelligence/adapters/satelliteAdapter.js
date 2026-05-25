/**
 * satelliteAdapter.js — feature-flagged provider adapter for the
 * satellite intelligence layer.
 *
 *   import { fetchSatellite, isSatelliteAdapterEnabled }
 *     from 'src/core/intelligence/adapters/satelliteAdapter.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A stub adapter that the orchestrator can safely call today.
 *   Always returns `{ ok: false, reason: 'disabled' }` until the
 *   `ENABLE_SATELLITE_INTELLIGENCE` feature flag is on AND a real
 *   provider key is configured.
 *
 *   It is NOT a network client. The eventual real client lives
 *   behind this same interface — when it lands, callers don't
 *   change.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Returns the same shape regardless of disabled / unavailable
 *     so the orchestrator's branch logic stays simple.
 */

import { isFeatureEnabled, FEATURE } from '../../../config/featureFlags.js';
import { isSatelliteEnabled } from '../../satellite/satelliteProviderRegistry.js';

export function isSatelliteAdapterEnabled() {
  try {
    if (!isFeatureEnabled(FEATURE.SATELLITE_INTELLIGENCE)) return false;
    if (!isSatelliteEnabled()) return false;
    return true;
  } catch { return false; }
}

/**
 * @param {object} [ctx]  optional context (fieldId, region, etc.)
 * @returns {Promise<object>}  always resolves
 */
export async function fetchSatellite(ctx) {
  try {
    if (!isSatelliteAdapterEnabled()) {
      return { ok: false, reason: 'disabled', ndvi: null, asOf: null };
    }
    // Real provider call would go here. Until one is wired:
    return { ok: false, reason: 'no_provider', ndvi: null, asOf: null };
  } catch {
    return { ok: false, reason: 'exception', ndvi: null, asOf: null };
  }
}

const _module = { fetchSatellite, isSatelliteAdapterEnabled };
export default _module;
