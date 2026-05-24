/**
 * marketplaceLinkGuard.js — gates external marketplace links
 * before any surface renders them.
 *
 *   import { guardMarketplaceLink, FALLBACK_MESSAGE }
 *     from 'src/core/marketplace/marketplaceLinkGuard.js';
 *
 *   const g = guardMarketplaceLink({
 *     url: 'https://example.com/listing/123',
 *     source: 'farroway_partner',          // trusted source id
 *   });
 *   // g.ok   → true  → render the link
 *   // g.ok   → false → render the FALLBACK_MESSAGE
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A thin trust filter on top of supplierLinkGuard. Where
 *   supplierLinkGuard answers "is this URL safely formed?", this
 *   guard answers "did this URL come from a configured trusted
 *   source?". Only URLs that pass BOTH layers reach the surface.
 *
 *   It does NOT make network requests. It does NOT verify the
 *   destination is in stock / available. It does NOT process
 *   payments or any transaction state.
 *
 *   The trusted-source list is hand-curated; an unknown source
 *   id is rejected by default — fail-closed.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 */

import { isSafeLink, BLOCKED_REASON } from '../suppliers/supplierLinkGuard.js';

// Trusted source IDs. Each represents a partner or first-party
// channel an operator has explicitly approved. Anything else is
// rejected as "untrusted_source" so we never silently surface
// a third-party link as if it carries our trust.
const _TRUSTED_SOURCES = Object.freeze(new Set([
  'farroway_partner',        // first-party Farroway listing
  'farroway_marketplace',    // our own marketplace produce listing
  'verified_supplier',       // SupplierRegistry verified entry
]));

export const REJECT_REASON = Object.freeze({
  ...BLOCKED_REASON,
  UNTRUSTED_SOURCE: 'untrusted_source',
  MISSING_SOURCE:   'missing_source',
});

export const FALLBACK_MESSAGE = Object.freeze({
  key:      'marketplace.fallback.checkLocal',
  fallback: 'Check with a local agricultural supplier.',
});

/**
 * Decide whether a marketplace link should be rendered.
 *
 * @param {{url: string, source: string}} input
 * @returns {{ ok: true, href: string, source: string, insecure: boolean }
 *          |{ ok: false, reason: string }}
 */
export function guardMarketplaceLink(input) {
  try {
    if (!input || typeof input !== 'object') {
      return { ok: false, reason: REJECT_REASON.EMPTY };
    }
    const source = String(input.source || '').trim();
    if (!source) return { ok: false, reason: REJECT_REASON.MISSING_SOURCE };
    if (!_TRUSTED_SOURCES.has(source)) return { ok: false, reason: REJECT_REASON.UNTRUSTED_SOURCE };

    const r = isSafeLink(input.url);
    if (!r.ok) return { ok: false, reason: r.reason };

    return { ok: true, href: r.href, source, insecure: !!r.insecure };
  } catch {
    return { ok: false, reason: REJECT_REASON.MALFORMED };
  }
}

/**
 * Convenience — returns the href or null. Surfaces can branch
 * on the null and render FALLBACK_MESSAGE.
 *
 * @param {object} input
 * @returns {string|null}
 */
export function safeMarketplaceHref(input) {
  const g = guardMarketplaceLink(input);
  return g.ok ? g.href : null;
}

/**
 * Read-only list of trusted source IDs — useful for admin UI
 * surfaces that need to render the dropdown of allowed values.
 */
export function listTrustedSources() {
  return Array.from(_TRUSTED_SOURCES);
}

const _module = {
  REJECT_REASON,
  FALLBACK_MESSAGE,
  guardMarketplaceLink,
  safeMarketplaceHref,
  listTrustedSources,
};
export default _module;
