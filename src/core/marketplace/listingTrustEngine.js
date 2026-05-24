/**
 * listingTrustEngine.js — spec-named alias for listingTrustSignals.
 *
 *   import { scoreListingTrust, LISTING_TRUST_TIER }
 *     from 'src/core/marketplace/listingTrustEngine.js';
 *
 * Pure re-export so spec-named import paths work without
 * duplicating logic.
 *
 * Strict-rule audit
 *   • Pure facade. Never throws.
 */

export * from './listingTrustSignals.js';
import _impl from './listingTrustSignals.js';
export default _impl;
