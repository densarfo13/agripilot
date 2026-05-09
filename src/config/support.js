/**
 * support.js — single source of truth for support / contact / FAQ.
 *
 * EVERY support button, "Need help?" link, "Contact our team" CTA,
 * and mailto: across the app reads from this file. Hardcoded
 * literals are forbidden — they cause the exact email-mismatch
 * drift the May 2026 support-system unification fixes (brand had
 * `support@farroways.com`, pages used `support@farroway.app`,
 * Landing footer used `hello@farroway.app`).
 *
 * USAGE
 * ─────
 *   import { SUPPORT_CONFIG, mailtoSupport, openSupportEmail }
 *     from '../config/support.js';
 *
 *   <a href={mailtoSupport('Help with my farm')}>
 *     {SUPPORT_CONFIG.email}
 *   </a>
 *
 *   <button onClick={() => openSupportEmail()}>Email support</button>
 *
 * RULES
 * ─────
 *   • Pure constants + tiny helpers. No React, no DOM-on-import.
 *   • Frozen — mutation can't drift across components.
 *   • SSR-safe — every navigator/window access is guarded.
 *   • Helpers tolerate every failure path (mail client missing,
 *     clipboard denied, popup blocker, etc.) and never throw.
 */

// ─── Canonical config ─────────────────────────────────────────────
//
// Per spec §1: this is the ONLY place these values are declared.
// Tests + lint can grep for hardcoded `support@farroway.app` or
// `mailto:` literals and route them back to this constant.
export const SUPPORT_CONFIG = Object.freeze({
  // Primary support inbox — staffed mailbox.
  email:            'support@farroway.app',
  // Alias kept distinct so future routing (e.g. self-serve help
  // articles vs. ticketed support) can split traffic without
  // breaking call sites.
  helpEmail:        'help@farroway.app',
  // Partnership / NGO / pilot inquiries.
  partnershipEmail: 'partnerships@farroway.app',
  // Optional channels — empty string disables the surface.
  // Tests assert these are STRINGS so a truthy check works
  // (`SUPPORT_CONFIG.whatsapp ? <Chip /> : null`).
  supportPhone:     '',
  whatsapp:         '',
  // In-app routes. Components MUST navigate through these so
  // route renames stay one-line changes here.
  supportUrl:       '/support',
  faqUrl:           '/support/faq',
  contactUrl:       '/support/contact',
  // Reply-window copy used in the contact card subtitle.
  replyWindow:      'within two business days',
});

// ─── Helpers ──────────────────────────────────────────────────────

/**
 * Build a `mailto:` link with optional subject + body. Returns
 * a string the caller can drop into <a href>; the helper does NOT
 * call window.location itself so the same value works for both
 * navigation AND copy-to-clipboard.
 *
 * @param {string} [subject]
 * @param {string} [body]
 * @param {string} [to=SUPPORT_CONFIG.email]
 * @returns {string}
 */
export function mailtoSupport(subject = 'Farroway support', body = '', to = SUPPORT_CONFIG.email) {
  try {
    const params = [];
    if (subject) params.push('subject=' + encodeURIComponent(subject));
    if (body)    params.push('body=' + encodeURIComponent(body));
    const tail = params.length ? '?' + params.join('&') : '';
    return 'mailto:' + to + tail;
  } catch {
    return 'mailto:' + (to || SUPPORT_CONFIG.email);
  }
}

/**
 * Best-effort: open the user's mail client. If `window.location`
 * is unavailable (SSR, locked iframe, etc.) the helper returns
 * `false` so the caller can fall back to copying the address.
 *
 * @param {object} [opts]
 * @param {string} [opts.subject]
 * @param {string} [opts.body]
 * @param {string} [opts.to]
 * @returns {boolean} true when the navigation was attempted.
 */
export function openSupportEmail(opts = {}) {
  try {
    if (typeof window === 'undefined' || !window.location) return false;
    window.location.href = mailtoSupport(opts.subject, opts.body, opts.to);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort copy-to-clipboard fallback for environments where
 * `mailto:` is blocked (kiosk browsers, in-app webviews without
 * a mail client). Returns a Promise<boolean> so the caller can
 * show a calm toast either way.
 *
 * @param {string} [value=SUPPORT_CONFIG.email]
 * @returns {Promise<boolean>}
 */
export async function copySupportEmail(value = SUPPORT_CONFIG.email) {
  try {
    if (typeof navigator !== 'undefined'
        && navigator.clipboard
        && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  // Legacy fallback — `document.execCommand('copy')` still works
  // in older webviews where the async clipboard API is gated.
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity  = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    try { document.body.removeChild(ta); } catch { /* ignore */ }
    return !!ok;
  } catch {
    return false;
  }
}

/**
 * High-level "Email support" button handler. Tries to open the
 * mail client; if that fails OR the user is offline, copies the
 * address to the clipboard so the calling component can surface
 * a "Support email copied." toast.
 *
 * @param {object} [opts]
 * @returns {Promise<{action:'opened'|'copied'|'failed', email:string}>}
 */
export async function emailSupportSafe(opts = {}) {
  const target = opts.to || SUPPORT_CONFIG.email;
  // If the runtime is offline, jump straight to clipboard — the
  // mail app on most mobiles will queue the draft, but copy is
  // a more obvious affordance offline.
  const offline = (typeof navigator !== 'undefined' && navigator.onLine === false);
  if (!offline) {
    const opened = openSupportEmail(opts);
    if (opened) return { action: 'opened', email: target };
  }
  const copied = await copySupportEmail(target);
  return { action: copied ? 'copied' : 'failed', email: target };
}

export default SUPPORT_CONFIG;
