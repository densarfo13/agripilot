/**
 * supplierTrustEngine.js — spec-named alias at the suppliers/ path.
 *
 *   import {
 *     trustLabelFor, isSafeToShow, TRUST_LABEL,
 *     FALLBACK_MESSAGE, RESTRICTED_DISCLAIMER,
 *   } from 'src/core/suppliers/supplierTrustEngine.js';
 *
 * The Phase 2 spec names this file `supplierTrustEngine.js`. The
 * Phase 1 rollout shipped the same surface as
 * `supplierTrustRules.js` (one implementation, two paths). This
 * file is a pure re-export — no duplicate state, no duplicate
 * logic.
 *
 * Strict-rule audit
 *   • Pure facade. Never throws.
 */

export {
  TRUST_LABEL,
  trustLabelFor,
  isSafeToShow,
  FALLBACK_MESSAGE,
  RESTRICTED_DISCLAIMER,
} from './supplierTrustRules.js';

import _impl from './supplierTrustRules.js';
export default _impl;
