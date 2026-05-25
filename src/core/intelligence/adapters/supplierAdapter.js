/**
 * supplierAdapter.js — feature-flagged supplier lookup adapter.
 *
 *   import { fetchSuppliers, isSupplierAdapterEnabled }
 *     from 'src/core/intelligence/adapters/supplierAdapter.js';
 *
 * Returns SafeToShow-filtered suppliers ranked for the current
 * context. With the flag OFF it returns an empty list so the
 * orchestrator's "no suppliers" branch fires.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { isFeatureEnabled, FEATURE } from '../../../config/featureFlags.js';
import { matchSuppliers } from '../../suppliers/supplierMatcher.js';

export function isSupplierAdapterEnabled() {
  try { return isFeatureEnabled(FEATURE.SUPPLIER_INTELLIGENCE); }
  catch { return false; }
}

/**
 * @param {object} [ctx]
 * @returns {Promise<object>}
 */
export async function fetchSuppliers(ctx) {
  try {
    if (!isSupplierAdapterEnabled()) {
      return { ok: false, reason: 'disabled', suppliers: [] };
    }
    const matched = matchSuppliers(ctx || {});
    return { ok: true, suppliers: matched || [] };
  } catch {
    return { ok: false, reason: 'exception', suppliers: [] };
  }
}

const _module = { fetchSuppliers, isSupplierAdapterEnabled };
export default _module;
