/**
 * fundingWhitelist — verified-domain allow-list for the
 * Funding Hub (May 2026 funding-link safety lockdown).
 *
 *   import { isWhitelistedFundingHost } from
 *     'src/security/fundingWhitelist.js';
 *
 *   if (!isWhitelistedFundingHost(host)) {
 *     // Render "Verification pending" — never the raw link.
 *   }
 *
 * SCOPE
 *   Only domains on this list may surface in the Funding UI as
 *   clickable external links. Anything else is rendered as a
 *   non-link "Verification pending" pill, regardless of where
 *   it came from (admin upload, seed data, cached payload,
 *   external feed, malicious injection).
 *
 *   This is the LAST LINE OF DEFENCE — see also
 *   `validateFundingUrl.js` (URL-shape rules) and the runtime
 *   guard wired into FundingCard / ApplicationPreviewModal /
 *   FundingOpportunityDetail.
 *
 * UPDATE RULES
 *   • Add only domains the legal/compliance team has reviewed.
 *   • One canonical hostname per organisation; the matcher
 *     covers `*.example.org` automatically (any subdomain).
 *   • Prefer `.gov`, `.org`, country-government TLDs
 *     (`.gov.gh`, `.go.ke`, `.gov.ng`).
 *   • NEVER add link shorteners, ad networks, or generic
 *     redirectors (bit.ly, t.co, lnkd.in, etc.).
 *   • NEVER add a domain on the basis of "user submitted it" —
 *     a verified human review is the only source of truth.
 */

/**
 * Verified funding hosts. Subdomain matching is automatic — adding
 * `usda.gov` covers `www.usda.gov`, `nifa.usda.gov`, `nrcs.usda.gov`.
 *
 * @type {ReadonlyArray<string>}
 */
export const VERIFIED_FUNDING_HOSTS = Object.freeze([
  // ─── United States — federal ────────────────────────────────
  'grants.gov',
  'usaid.gov',
  'usda.gov',
  'nifa.usda.gov',
  'nrcs.usda.gov',
  'fsa.usda.gov',
  'rd.usda.gov',
  'ams.usda.gov',
  'extension.org',
  'mastergardener.extension.org',
  'communitygarden.org',
  'foundationcenter.org',

  // ─── Multilateral / UN system ───────────────────────────────
  'worldbank.org',
  'ifad.org',
  'fao.org',
  'undp.org',
  'unicef.org',
  'wfp.org',
  'unep.org',
  'ilo.org',
  'iom.int',

  // ─── EU + regional development banks ────────────────────────
  'europa.eu',
  'ec.europa.eu',
  'eib.org',
  'afdb.org',
  'afd.fr',
  'kfw-entwicklungsbank.de',

  // ─── Foundations + private grant-makers ─────────────────────
  'gatesfoundation.org',
  'mastercardfdn.org',
  'rockefellerfoundation.org',
  'fordfoundation.org',
  'ffar.org',
  'cgiar.org',

  // ─── Mobile / agritech industry bodies ──────────────────────
  'gsma.com',
  'acreafrica.com',
  'ica.coop',

  // ─── Africa — country governments + national programmes ─────
  'mofa.gov.gh',          // Ghana — Ministry of Food + Agriculture
  'gawu.org',             // Ghana Agricultural Workers Union
  'ghanaagrihub.com',
  'cbn.gov.ng',           // Nigeria — Central Bank
  'fmard.gov.ng',         // Nigeria — Federal Ministry of Agriculture
  'kilimo.go.ke',         // Kenya — Ministry of Agriculture
  'agra.org',
  'agrilinks.org',

  // ─── Farroway-owned domains (sample / placeholder cards) ────
  'farroway.app',
]);

const _HOSTS_SET = new Set(VERIFIED_FUNDING_HOSTS.map((h) => h.toLowerCase()));

/**
 * Normalise a hostname for comparison. Strips a leading `www.`
 * (so `www.usda.gov` matches `usda.gov`) and lowercases.
 */
function _normaliseHost(host) {
  if (!host || typeof host !== 'string') return '';
  let h = host.trim().toLowerCase();
  if (h.startsWith('www.')) h = h.slice(4);
  return h;
}

/**
 * True when the supplied hostname (or one of its parents) is on
 * the verified list.
 *
 *   isWhitelistedFundingHost('nifa.usda.gov') → true   (subdomain of usda.gov)
 *   isWhitelistedFundingHost('grants.gov')   → true   (exact match)
 *   isWhitelistedFundingHost('grants.gov.evil.example') → false
 *
 * @param {string} host
 * @returns {boolean}
 */
export function isWhitelistedFundingHost(host) {
  const h = _normaliseHost(host);
  if (!h) return false;
  // Exact match first.
  if (_HOSTS_SET.has(h)) return true;
  // Subdomain match — walk parent labels: `nifa.usda.gov` →
  // `usda.gov` → `gov`. Stop at the first match. Single-label
  // hosts can never match.
  const parts = h.split('.');
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.');
    if (_HOSTS_SET.has(parent)) return true;
  }
  return false;
}

/**
 * Test helper — returns the frozen set so suites can assert
 * specific hosts without exposing the internal ref.
 */
export function _verifiedHostsSnapshot() {
  return Array.from(_HOSTS_SET);
}

const _module = {
  VERIFIED_FUNDING_HOSTS,
  isWhitelistedFundingHost,
  _verifiedHostsSnapshot,
};
export default _module;
