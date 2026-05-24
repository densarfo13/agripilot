/**
 * supplierLinkGuard.js — validates supplier / marketplace URLs
 * before they are handed to the surface.
 *
 *   import { isSafeLink, sanitizeLink, BLOCKED_REASON }
 *     from 'src/core/suppliers/supplierLinkGuard.js';
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A defense layer for any user-tappable external link the
 *   suppliers / marketplace / products engines hand to the UI.
 *
 *   Blocks:
 *     • non-http(s) schemes (javascript:, data:, file:, etc.)
 *     • obviously-malformed URLs
 *     • known-bad hosts (configurable)
 *     • IP-literal hosts (no DNS, likely C2)
 *     • empty / null / non-string values
 *
 *   Allows:
 *     • https:// preferred
 *     • http:// allowed but flagged as 'insecure'
 *     • tel: + mailto: + sms: (the supplier contact channels)
 *
 *   It does NOT make network requests, does NOT verify the link
 *   resolves to a working page, and does NOT make trust decisions
 *   (supplierTrustRules does). It only stops obviously-unsafe
 *   strings from reaching the renderer.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Defers raw `new URL()` construction to `safeUrl` per the
 *     Final Runtime Stabilization Pass §1 — no rogue URL
 *     construction outside the documented safe-wrappers.
 */

import { safeUrl } from '../../lib/safeUrl.js';

export const BLOCKED_REASON = Object.freeze({
  EMPTY:           'empty',
  NOT_STRING:      'not_string',
  BAD_SCHEME:      'bad_scheme',
  MALFORMED:       'malformed',
  IP_LITERAL:      'ip_literal',
  BLOCKED_HOST:    'blocked_host',
});

const _SAFE_SCHEMES = new Set(['https:', 'http:', 'tel:', 'mailto:', 'sms:']);
const _PREFERRED_SCHEME = 'https:';

// Conservative IP literal detector — IPv4 dotted-quad OR
// bracketed IPv6. We block any "host" that looks like a raw IP
// because legitimate supplier links almost always resolve through
// DNS; a raw IP is a strong signal for C2 / phishing.
const _IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
function _isIpLiteral(host) {
  if (!host) return false;
  if (host.startsWith('[') && host.endsWith(']')) return true; // IPv6
  return _IPV4.test(host);
}

const _BLOCKED_HOSTS = new Set([
  // Add known phishing / malicious hosts here as ops discovers
  // them. Starts empty — surfaces also defer to the trustLabel.
]);

/**
 * Run a candidate URL through the guard. Returns either
 * `{ ok: true, scheme, host, href, insecure }` or
 * `{ ok: false, reason }`.
 *
 * @param {string} candidate
 * @returns {object}
 */
export function isSafeLink(candidate) {
  try {
    if (candidate == null || candidate === '')   return { ok: false, reason: BLOCKED_REASON.EMPTY };
    if (typeof candidate !== 'string')           return { ok: false, reason: BLOCKED_REASON.NOT_STRING };
    const trimmed = candidate.trim();
    if (!trimmed)                                return { ok: false, reason: BLOCKED_REASON.EMPTY };

    // Allow tel:/mailto:/sms: with a simple shape check — no URL
    // constructor (it accepts garbage after the scheme).
    if (trimmed.startsWith('tel:') || trimmed.startsWith('mailto:') || trimmed.startsWith('sms:')) {
      const scheme = trimmed.split(':', 1)[0] + ':';
      const target = trimmed.slice(scheme.length).trim();
      if (!target) return { ok: false, reason: BLOCKED_REASON.MALFORMED };
      return { ok: true, scheme, host: null, href: trimmed, insecure: false };
    }

    const u = safeUrl(trimmed);
    if (!u) return { ok: false, reason: BLOCKED_REASON.MALFORMED };
    if (!_SAFE_SCHEMES.has(u.protocol)) return { ok: false, reason: BLOCKED_REASON.BAD_SCHEME };

    const host = u.hostname || '';
    if (_isIpLiteral(host))             return { ok: false, reason: BLOCKED_REASON.IP_LITERAL };
    if (_BLOCKED_HOSTS.has(host))       return { ok: false, reason: BLOCKED_REASON.BLOCKED_HOST };

    return {
      ok:       true,
      scheme:   u.protocol,
      host,
      href:     u.toString(),
      insecure: u.protocol !== _PREFERRED_SCHEME && u.protocol === 'http:',
    };
  } catch {
    return { ok: false, reason: BLOCKED_REASON.MALFORMED };
  }
}

/**
 * Convenience — return the safe href OR null. Surfaces can
 * branch on the null and fall back to the FALLBACK_MESSAGE.
 *
 * @param {string} candidate
 * @returns {string|null}
 */
export function sanitizeLink(candidate) {
  const r = isSafeLink(candidate);
  return r.ok ? r.href : null;
}

const _module = { BLOCKED_REASON, isSafeLink, sanitizeLink };
export default _module;
