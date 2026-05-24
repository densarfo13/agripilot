/**
 * marketReadinessEngine.js — spec-named alias at marketplace/.
 *
 *   import { computeMarketReadiness, MARKET_READINESS }
 *     from 'src/core/marketplace/marketReadinessEngine.js';
 *
 * The Phase 2 spec names this file at the marketplace/ path. The
 * earlier implementation lives at `src/core/market/`. Pure
 * re-export — one implementation, two paths.
 *
 * Strict-rule audit
 *   • Pure facade. Never throws.
 */

export * from '../market/marketReadinessEngine.js';
import _impl from '../market/marketReadinessEngine.js';
export default _impl;
