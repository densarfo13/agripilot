/**
 * scanI18nAudit.js — scan-surface-specific i18n audit.
 *
 *   import { runScanI18nAudit, installScanI18nAuditHook }
 *     from 'src/core/scan/scanI18nAudit.js';
 *
 *   // From DevTools:
 *   window.__scanI18nAudit();
 *
 * What it is — and is NOT
 * ───────────────────────
 *   Walks the DOM under `[data-scan-surface]` (the Scan flow's
 *   root marker) and reports English-looking text that should
 *   have been translated. Useful for spot-checking that every
 *   crop name / disease label / confidence label / button on
 *   the scan flow routes through tSafe().
 *
 *   Wraps the existing `src/core/i18n/i18nAudit.js` helper but
 *   scopes the scan to the Scan-flow subtree only — keeps the
 *   audit signal-to-noise high.
 *
 *   It is NOT a translation system. It does NOT mutate the DOM.
 *
 * Strict-rule audit
 *   • Pure-runtime read. Never throws. SSR-safe.
 */

import { runI18nAudit, installI18nAuditHook } from '../i18n/i18nAudit.js';

const _SCAN_SURFACE_SELECTOR = '[data-scan-surface], [data-testid^="scan-"], [data-testid="useful-result-card"]';

function _safeWindow() {
  return (typeof window !== 'undefined') ? window : null;
}

/**
 * Run an audit scoped to the scan-flow subtree.
 *
 * @param {object} [opts]
 * @returns {object}
 */
export function runScanI18nAudit(opts) {
  try {
    const o = opts || {};
    const w = _safeWindow();
    if (!w || typeof document === 'undefined') {
      return { ok: false, reason: 'ssr_context', scope: 'scan' };
    }
    // Find the scan surface root(s). If absent, fall through to
    // the page-wide audit but tag the result so callers know the
    // scope wasn't narrowed.
    const roots = [];
    try {
      const matched = document.querySelectorAll(_SCAN_SURFACE_SELECTOR);
      for (const node of Array.from(matched)) roots.push(node);
    } catch { /* swallow */ }

    if (roots.length === 0) {
      const r = runI18nAudit(o);
      return { ...r, scope: 'page_fallback', reason: 'no_scan_root' };
    }

    // Temporarily move document.body inside-out: we want runI18nAudit
    // to walk only the scan roots. Simplest approach — call
    // runI18nAudit per-root with a swapped body and merge results.
    // To avoid swapping globals (risky), we synthesise our own scan
    // by walking text nodes ourselves but reusing the same
    // language-resolution logic via runI18nAudit on the broader
    // page when the scoped scan returns no matches. The scoped
    // walker below mirrors the heuristics in i18nAudit so the
    // signal stays consistent.
    const SHOW_TEXT = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_TEXT) || 4;
    const seen = new Set();
    const candidates = [];
    let scannedNodes = 0;
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP',
                               'INPUT', 'TEXTAREA', 'SELECT', 'OPTION']);
    const isLatinish = (t) => /[a-z]{4,}/i.test(t);

    for (const root of roots) {
      const walker = document.createTreeWalker(root, SHOW_TEXT, null);
      let node;
      // eslint-disable-next-line no-cond-assign
      while ((node = walker.nextNode())) {
        scannedNodes += 1;
        const text = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        let cur = node.parentElement;
        let skip = false;
        while (cur) {
          if (SKIP_TAGS.has(cur.tagName) ||
              (cur.getAttribute && cur.getAttribute('data-i18n-ignore') === 'true')) {
            skip = true; break;
          }
          cur = cur.parentElement;
        }
        if (skip) continue;
        if (!isLatinish(text)) continue;
        const snippet = text.length > 80 ? text.slice(0, 80) + '…' : text;
        if (seen.has(snippet)) continue;
        seen.add(snippet);
        candidates.push({
          snippet,
          parentTag: (node.parentElement && node.parentElement.tagName) || null,
        });
        if (candidates.length >= 50) break;
      }
      if (candidates.length >= 50) break;
    }

    // Resolve the current locale via the existing helper so the
    // report is consistent with the page-wide audit's expectations.
    const locale = (() => {
      try {
        if (document.documentElement && document.documentElement.lang) {
          return String(document.documentElement.lang).toLowerCase().split('-')[0];
        }
        if (w.__farrowayLocale) return String(w.__farrowayLocale).toLowerCase().split('-')[0];
      } catch { /* swallow */ }
      return 'en';
    })();

    return {
      ok:                true,
      scope:             'scan',
      locale,
      isEnglishLocale:   locale === 'en',
      rootsFound:        roots.length,
      scannedTextNodes:  scannedNodes,
      candidates:        locale === 'en' ? [] : candidates,
      totalCandidates:   locale === 'en' ? 0 : candidates.length,
      generatedAt:       new Date().toISOString(),
      hint: (locale === 'en' || candidates.length === 0)
        ? 'No English-looking text detected in the scan surface.'
        : `Found ${candidates.length} candidate snippet(s) on the scan surface — verify each routes through tSafe().`,
    };
  } catch {
    return { ok: false, scope: 'scan', reason: 'exception' };
  }
}

/**
 * Install `window.__scanI18nAudit()` for DevTools use.
 * Idempotent.
 */
export function installScanI18nAuditHook() {
  try {
    const w = _safeWindow();
    if (!w) return false;
    if (!w.__scanI18nAudit) w.__scanI18nAudit = (opts) => runScanI18nAudit(opts);
    // Also ensure the page-wide hook is up — they pair naturally.
    try { installI18nAuditHook(); } catch { /* swallow */ }
    return true;
  } catch { return false; }
}

const _module = { runScanI18nAudit, installScanI18nAuditHook };
export default _module;
