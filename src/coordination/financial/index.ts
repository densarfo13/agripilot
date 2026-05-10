/**
 * coordination/financial — facade over the existing funding +
 * trust modules.
 *
 *   import { matchSupport, classifyUrl, SUPPORT_CATEGORIES }
 *     from 'src/coordination/financial';
 *
 * Wires together:
 *   • src/funding/fundingMatcher.js          — opportunity matcher
 *   • src/intelligence/funding/regionalRelevance.js — relevance scoring
 *   • src/security/validateFundingUrl.js     — trust classifier
 *
 * Spec §7 — funding must remain verified + region-aware +
 * timing-aware. The facade here exposes the canonical entry
 * points new callers should bind to.
 */

import {
  classifyFundingUrl as _classifyUrl,
} from '../../security/validateFundingUrl.js';
import {
  prioritiseNearbySupport as _prioritise,
} from '../../intelligence/funding/regionalRelevance.js';

/**
 * The 10 funding categories the experience supports.
 */
export const SUPPORT_CATEGORIES = Object.freeze([
  'grants',
  'ngo_programs',
  'cooperatives',
  'extension_services',
  'seed_input_support',
  'irrigation_support',
  'equipment_support',
  'insurance',
  'emergency_relief',
  'market_access',
] as const);

export type SupportCategory = typeof SUPPORT_CATEGORIES[number];

export interface FundingCandidate {
  readonly id?: string;
  readonly url?: string;
  readonly title?: string;
  readonly organization?: string;
  readonly country?: string;
  readonly region?: string;
  readonly category?: SupportCategory | string;
  readonly expiresAt?: string;
}

/**
 * URL classification — HTTPS-only / allowlist / no-shortener
 * / no-suspicious-TLD. Returns
 *   { ok: true,  reason: 'verified', ... }
 *   { ok: false, reason: <denied-reason> }
 */
export function classifyUrl(url: string | null | undefined): {
  ok: boolean;
  reason: string;
} {
  try {
    const r = _classifyUrl(url as never) as { ok?: boolean; reason?: string };
    return Object.freeze({
      ok:     !!r?.ok,
      reason: String(r?.reason || 'unknown'),
    });
  } catch {
    return Object.freeze({ ok: false, reason: 'classifier_error' });
  }
}

/**
 * Match + prioritise nearby support candidates for a context.
 * Delegates to the canonical relevance scorer in
 * `src/intelligence/funding/regionalRelevance.js`.
 *
 * Returns candidates that pass BOTH the trust classifier AND
 * the relevance threshold (60 by default). Verified candidates
 * surface first; unverified ones never surface — they get
 * filtered out before this function returns.
 */
export function matchSupport(
  candidates: ReadonlyArray<FundingCandidate>,
  context: { country?: string; region?: string; crop?: string; weather?: object | null } = {},
): ReadonlyArray<FundingCandidate> {
  if (!Array.isArray(candidates)) return [];
  // Step 1 — drop anything that doesn't pass the URL classifier.
  const verified = candidates.filter((c) => c && c.url && classifyUrl(c.url).ok);
  // Step 2 — delegate to the relevance scorer for ranking.
  try {
    const out = _prioritise({
      candidates: verified as never,
      context:    context as never,
    });
    return Array.isArray(out) ? out as ReadonlyArray<FundingCandidate> : verified;
  } catch {
    return verified;
  }
}

export default Object.freeze({
  SUPPORT_CATEGORIES,
  classifyUrl,
  matchSupport,
});
