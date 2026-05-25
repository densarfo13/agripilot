/**
 * soilAdapter.js — feature-flagged soil-data adapter.
 *
 *   import { fetchSoil, isSoilAdapterEnabled }
 *     from 'src/core/intelligence/adapters/soilAdapter.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A stub adapter that produces a soil snapshot for the orchestrator.
 *   With the flag OFF (default) it returns a SAFE empty record so
 *   the engines that consume it (`soilIntelligenceEngine`, etc.)
 *   degrade to "unknown" — no fake precision.
 *
 *   When the flag flips ON, this adapter is where the real
 *   integration (soil test API / sensor feed / user-entered form)
 *   lands behind the same interface.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { isFeatureEnabled, FEATURE } from '../../../config/featureFlags.js';

export function isSoilAdapterEnabled() {
  try { return isFeatureEnabled(FEATURE.SOIL_INTELLIGENCE); }
  catch { return false; }
}

/**
 * @param {object} [ctx]
 * @returns {Promise<object>}  always resolves
 */
export async function fetchSoil(ctx) {
  try {
    if (!isSoilAdapterEnabled()) {
      return { ok: false, reason: 'disabled', soil: null };
    }
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    // User-entered soil notes (the only path active today) flow
    // through here as-is so the engine treats them identically to
    // sensor data when sensors ship.
    if (c.userEntered && typeof c.userEntered === 'object') {
      return { ok: true, source: 'user', soil: c.userEntered };
    }
    return { ok: false, reason: 'no_data', soil: null };
  } catch {
    return { ok: false, reason: 'exception', soil: null };
  }
}

const _module = { fetchSoil, isSoilAdapterEnabled };
export default _module;
