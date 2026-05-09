/**
 * security — verified-only funding-link safety lockdown
 * (May 2026 urgent fix).
 *
 *   import { isVerifiedFundingUrl, classifyFundingUrl,
 *            sanitizeFundingUrl, isWhitelistedFundingHost,
 *            VERIFIED_FUNDING_HOSTS } from 'src/security';
 *
 *   if (!isVerifiedFundingUrl(card.externalUrl)) {
 *     // Render "Verification pending" — never the raw link.
 *     trackSafeEvent('unsafe_funding_link_blocked',
 *       { reason: classifyFundingUrl(card.externalUrl).reason });
 *   }
 *
 * MODULES
 *   fundingWhitelist.js  — verified-domain allow-list (subdomain-aware)
 *   validateFundingUrl.js — URL-shape validator + classifier
 *
 * RULES
 *   • Pure / SSR-safe / never-throws.
 *   • Default-deny — anything not on the whitelist is blocked.
 *   • Defence-in-depth: scheme check + private-host check +
 *     shortener block + suspicious-TLD block + adult/gambling
 *     keyword block + whitelist gate.
 */

export {
  VERIFIED_FUNDING_HOSTS,
  isWhitelistedFundingHost,
  _verifiedHostsSnapshot,
} from './fundingWhitelist.js';

export {
  classifyFundingUrl,
  isVerifiedFundingUrl,
  sanitizeFundingUrl,
} from './validateFundingUrl.js';
