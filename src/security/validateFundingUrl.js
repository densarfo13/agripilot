/**
 * validateFundingUrl — URL-shape validator for funding links
 * (May 2026 funding-link safety lockdown).
 *
 *   import { isVerifiedFundingUrl, classifyFundingUrl } from
 *     'src/security/validateFundingUrl.js';
 *
 *   if (!isVerifiedFundingUrl(card.externalUrl)) {
 *     // Render "Verification pending" — never the raw link.
 *     // Log unsafe_funding_link_blocked.
 *   }
 *
 * VALIDATION LADDER (spec §5)
 *   1. Must be a parsable URL.
 *   2. Must be HTTPS — `http:` rejected (man-in-the-middle risk).
 *   3. No `javascript:`, `data:`, `vbscript:`, `file:`, etc.
 *   4. No IP-literal hostnames (raw IPs, IPv6 literals).
 *   5. No localhost / 127.* / 0.0.0.0 / 192.168.* / 10.* / 172.16.*
 *      style internal hosts.
 *   6. No known link-shortener / ad-redirect domains.
 *   7. No suspicious TLD (`.zip`, `.mov`, `.tk`, `.ml`, `.ga`,
 *      `.cf`, etc. — ICANN-flagged abuse haven set).
 *   8. No adult / gambling keywords in URL.
 *   9. Hostname must be on the verified whitelist
 *      (fundingWhitelist.js).
 *  10. `mailto:` is allowed ONLY when the address ends in a
 *      whitelisted host (so partnerships@farroway.app passes;
 *      partnerships@porn.example fails).
 *
 * Pure / SSR-safe / never-throws — every helper returns a
 * boolean or a typed reason string, never throws.
 */

import { isWhitelistedFundingHost } from './fundingWhitelist.js';

// ─── Denylists (spec §11 content-security guard) ────────────────

const SHORTENER_HOSTS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd',
  'ow.ly', 'buff.ly', 'lnkd.in', 'rebrand.ly', 'cutt.ly',
  'shorturl.at', 'rb.gy', 'tiny.cc', 'soo.gd', 'tny.im',
  'short.io', 'bl.ink', 's.id', 'mcaf.ee', 'snip.ly',
]);

const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'tk', 'ml', 'ga', 'cf', 'gq',
  'top', 'click', 'work', 'support',
  'xyz',  // overrepresented in phishing campaigns; a verified
          //   org would be on its own domain anyway.
]);

const ADULT_KEYWORDS = [
  'porn', 'xxx', 'sex', 'adult', 'nsfw', 'erotic',
  'onlyfans', 'pornhub', 'xvideos', 'xnxx', 'redtube',
  'youporn', 'tube8', 'spankbang', 'brazzers', 'cam4',
  'chaturbate', 'stripchat',
];

const GAMBLING_KEYWORDS = [
  'casino', 'poker', 'bet365', 'betfair', 'pokerstars',
  'sportsbook', 'roulette', 'slots', 'blackjack',
  'wagering', 'gambling',
];

// Suspicious URL-shape patterns: hex IPs, raw octets, port
// directives that aren't 80/443, etc.
const IPV4_LITERAL_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const IPV6_LITERAL_RE = /^\[[0-9a-fA-F:]+\]$/;

// Internal / private hosts — never legitimate for an external
// funding link.
function _isPrivateHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h === '0.0.0.0') return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (IPV4_LITERAL_RE.test(h)) {
    const o = h.split('.').map(Number);
    if (o[0] === 10) return true;                     // 10/8
    if (o[0] === 127) return true;                    // loopback
    if (o[0] === 169 && o[1] === 254) return true;    // link-local
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
    if (o[0] === 192 && o[1] === 168) return true;
    return true; // any IP-literal — funding hosts must use a domain.
  }
  if (IPV6_LITERAL_RE.test(h)) return true;
  return false;
}

function _hasAdultKeyword(s) {
  const lower = String(s || '').toLowerCase();
  for (const k of ADULT_KEYWORDS) {
    if (lower.includes(k)) return true;
  }
  return false;
}
function _hasGamblingKeyword(s) {
  const lower = String(s || '').toLowerCase();
  for (const k of GAMBLING_KEYWORDS) {
    if (lower.includes(k)) return true;
  }
  return false;
}

function _tld(host) {
  const parts = String(host || '').toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Classify a URL and return a structured envelope. Used by
 * the runtime guard + analytics ("unsafe_funding_link_blocked"
 * event includes the typed reason).
 *
 * @param {string} url
 * @returns {{ok: boolean, reason: string, host: string|null, blocked: boolean}}
 */
export function classifyFundingUrl(url) {
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, reason: 'empty', host: null, blocked: true };
  }
  const trimmed = url.trim();

  // Special-case: mailto: links to verified hosts (the
  // partnerships@farroway.app pattern in fundingConfig.js).
  if (/^mailto:/i.test(trimmed)) {
    const addr = trimmed.replace(/^mailto:/i, '').split('?')[0];
    const at = addr.lastIndexOf('@');
    if (at < 0) return { ok: false, reason: 'malformed_mailto', host: null, blocked: true };
    const host = addr.slice(at + 1).toLowerCase();
    if (!isWhitelistedFundingHost(host)) {
      return { ok: false, reason: 'mailto_host_not_whitelisted', host, blocked: true };
    }
    return { ok: true, reason: 'mailto_whitelisted', host, blocked: false };
  }

  // Forbidden URL schemes — javascript:, data:, vbscript:, file:,
  // etc. Each one is a known XSS / phishing vector.
  if (/^(javascript|data|vbscript|file|blob|about):/i.test(trimmed)) {
    return { ok: false, reason: 'forbidden_scheme', host: null, blocked: true };
  }

  // HTTPS only — http: rejected.
  if (!/^https:\/\//i.test(trimmed)) {
    return { ok: false, reason: 'not_https', host: null, blocked: true };
  }

  // Parse via the URL constructor — catches malformed inputs
  // without us writing a parser. Wrapped in try/catch because
  // older runtimes throw on invalid input.
  let parsed;
  try { parsed = new URL(trimmed); }
  catch { return { ok: false, reason: 'malformed_url', host: null, blocked: true }; }

  const host = (parsed.hostname || '').toLowerCase();
  if (!host) return { ok: false, reason: 'missing_host', host: null, blocked: true };

  // No IP literals / private hosts / loopback.
  if (_isPrivateHost(host)) {
    return { ok: false, reason: 'private_or_ip_host', host, blocked: true };
  }

  // Non-standard ports are suspicious for a public funding
  // link (legitimate sites all use 443).
  if (parsed.port && parsed.port !== '443' && parsed.port !== '') {
    return { ok: false, reason: 'non_standard_port', host, blocked: true };
  }

  // Userinfo in the URL is a known phishing trick
  // (e.g. https://usda.gov@evil.example/grant).
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'userinfo_in_url', host, blocked: true };
  }

  // Suspicious TLDs.
  if (SUSPICIOUS_TLDS.has(_tld(host))) {
    return { ok: false, reason: 'suspicious_tld', host, blocked: true };
  }

  // Link shorteners are forbidden — funding links must point
  // directly to the verified host.
  if (SHORTENER_HOSTS.has(host) || SHORTENER_HOSTS.has(host.replace(/^www\./, ''))) {
    return { ok: false, reason: 'shortener_host', host, blocked: true };
  }

  // Adult / gambling keywords — match ONLY against host + path
  // (query + hash carry arbitrary user-controlled strings; e.g.
  // `fbclid=xxx` shouldn't trigger the `xxx` keyword). Matching
  // host + path catches the real attack surface — domain names
  // like `pornhub.com` and path segments like `/casino/`.
  const matchSurface = host + (parsed.pathname || '');
  if (_hasAdultKeyword(matchSurface)) {
    return { ok: false, reason: 'adult_content_keyword', host, blocked: true };
  }
  if (_hasGamblingKeyword(matchSurface)) {
    return { ok: false, reason: 'gambling_keyword', host, blocked: true };
  }

  // Final gate — verified-host whitelist.
  if (!isWhitelistedFundingHost(host)) {
    return { ok: false, reason: 'host_not_whitelisted', host, blocked: true };
  }

  return { ok: true, reason: 'verified', host, blocked: false };
}

/**
 * Boolean shortcut for the render guard (spec §14):
 *
 *   if (!isVerifiedFundingUrl(url)) blockRender();
 */
export function isVerifiedFundingUrl(url) {
  return classifyFundingUrl(url).ok === true;
}

/**
 * Sanitise a verified URL for render. Strips tracking-style
 * query params (`utm_*`, `gclid`, `fbclid`, etc.). Returns
 * the original input if it was already safe to render.
 *
 * Pure — never throws. Returns `''` when input is unsafe so
 * a careless caller never accidentally renders a bad value.
 *
 * @param {string} url
 * @returns {string}
 */
export function sanitizeFundingUrl(url) {
  const r = classifyFundingUrl(url);
  if (!r.ok) return '';
  if (r.reason === 'mailto_whitelisted') return String(url).trim();
  try {
    const parsed = new URL(String(url).trim());
    const banned = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
                    'gclid','fbclid','msclkid','dclid','yclid','wbraid','gbraid','ref'];
    for (const k of banned) parsed.searchParams.delete(k);
    return parsed.toString();
  } catch { return ''; }
}

const _module = {
  classifyFundingUrl,
  isVerifiedFundingUrl,
  sanitizeFundingUrl,
};
export default _module;
