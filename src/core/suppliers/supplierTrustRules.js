/**
 * supplierTrustRules.js — verifies whether a supplier entry is
 * safe to surface, and what trust label the surface should attach.
 *
 *   import { trustLabelFor, isSafeToShow, TRUST_LABEL }
 *     from 'src/core/suppliers/supplierTrustRules.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A tiny rules engine that returns a hedged label envelope per
 *   supplier ("Verified supplier" / "Unverified listing" / etc.)
 *   and a boolean "ok to render" for the surface layer.
 *
 *   It does NOT call out to the network, does NOT decide WHICH
 *   suppliers a user sees (supplierMatcher does), and does NOT
 *   bake in any sponsorship. Sponsorship is an explicit per-entry
 *   field — never inferred.
 *
 * Strict-rule audit
 *   • Pure. Never throws. Every user-visible string is a localized
 *     `{ key, fallback }` envelope.
 */

import { SUPPLIER_STATUS } from './supplierRegistry.js';

export const TRUST_LABEL = Object.freeze({
  VERIFIED:     'verified',
  UNVERIFIED:   'unverified',
  GENERAL:      'general',
  EXPERT_REVIEW:'expert_review',
});

const _LABELS = Object.freeze({
  [TRUST_LABEL.VERIFIED]: Object.freeze({
    label: Object.freeze({ key: 'supplier.label.verified',     fallback: 'Verified supplier' }),
    tone:  'positive',
  }),
  [TRUST_LABEL.UNVERIFIED]: Object.freeze({
    label: Object.freeze({ key: 'supplier.label.unverified',   fallback: 'Unverified listing — check before purchasing' }),
    tone:  'caution',
  }),
  [TRUST_LABEL.GENERAL]: Object.freeze({
    label: Object.freeze({ key: 'supplier.label.general',      fallback: 'General suggestion' }),
    tone:  'neutral',
  }),
  [TRUST_LABEL.EXPERT_REVIEW]: Object.freeze({
    label: Object.freeze({ key: 'supplier.label.expertReview', fallback: 'Expert review recommended' }),
    tone:  'caution',
  }),
});

function _shape(tier) {
  const m = _LABELS[tier];
  return { tier, label: { ...m.label }, tone: m.tone };
}

/**
 * Pick the trust label for a normalised supplier entry.
 *
 * @param {object} supplier
 * @returns {{ tier: string, label: { key, fallback }, tone: string }}
 */
export function trustLabelFor(supplier) {
  try {
    if (!supplier || typeof supplier !== 'object') return _shape(TRUST_LABEL.GENERAL);
    if (supplier.verifiedStatus === SUPPLIER_STATUS.VERIFIED) return _shape(TRUST_LABEL.VERIFIED);
    // Pending = treated as unverified for label purposes; we
    // never imply endorsement on a supplier whose verification is
    // mid-review.
    return _shape(TRUST_LABEL.UNVERIFIED);
  } catch { return _shape(TRUST_LABEL.GENERAL); }
}

/**
 * Decide whether the surface should render this supplier card.
 * Returns false when the entry is missing core trust signals — in
 * that case the surface falls back to the "Check with a local
 * agricultural supplier" message instead of showing a blank /
 * misleading card.
 *
 * @param {object} supplier
 * @returns {boolean}
 */
export function isSafeToShow(supplier) {
  try {
    if (!supplier || typeof supplier !== 'object') return false;
    if (!supplier.name) return false;
    // Must have at least ONE way to reach them — a verified
    // contact channel OR a phone. Without either, the entry is
    // useless to the user.
    if (!supplier.contactUrl && !supplier.phone) return false;
    return true;
  } catch { return false; }
}

/**
 * The fallback envelope surfaces render when no safe supplier
 * exists. Single source of truth for the wording.
 */
export const FALLBACK_MESSAGE = Object.freeze({
  key:      'supplier.fallback.checkLocal',
  fallback: 'Check with a local agricultural supplier.',
});

/**
 * The hedged disclaimer envelope for restricted categories
 * (pesticides, herbicides, fungicides, chemical fertilizers).
 * Surfaces MUST render this whenever a product engine returns a
 * restricted category.
 */
export const RESTRICTED_DISCLAIMER = Object.freeze({
  key:      'product.restricted.consultExpert',
  fallback: 'Consult a local agricultural expert before applying chemical treatments.',
});

const _module = {
  TRUST_LABEL, trustLabelFor, isSafeToShow,
  FALLBACK_MESSAGE, RESTRICTED_DISCLAIMER,
};
export default _module;
