/**
 * i18nAudit.js — runtime DOM-scan for English leaks under a
 * non-English locale.
 *
 *   import { runI18nAudit, installI18nAuditHook }
 *     from 'src/core/i18n/i18nAudit.js';
 *
 *   // Wire once at app boot (e.g. main.jsx):
 *   installI18nAuditHook();
 *   // Then from DevTools:
 *   window.__i18nAudit();
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A small read-only scanner that walks the live DOM and reports
 *   text nodes that look like English even though the active
 *   locale is not English. Useful as an in-app QA aid for the
 *   per-surface i18n audit the spec asks for.
 *
 *   It is NOT a translation system. It does NOT mutate the DOM.
 *   It does NOT make network calls. It does NOT report any
 *   personal content — only structural counts and the offending
 *   text snippets (truncated to 80 chars).
 *
 *   Detection heuristics — DELIBERATELY simple, prefer false
 *   positives the operator can dismiss over false negatives:
 *     • Any user-visible text that matches `[A-Za-z]{4,}` AND is
 *       NOT inside <script> / <style> / <code> / <pre> / elements
 *       marked `data-i18n-ignore="true"`.
 *     • Only when the active locale is not English.
 *
 *   The current locale is resolved from `document.documentElement.lang`
 *   first, then `window.__farrowayLocale`, then the `lang` query
 *   param.
 *
 * Strict-rule audit
 *   • Pure-ish — reads DOM, never writes. SSR-safe (returns a
 *     skipped report when window/document are missing).
 *   • Never throws — every branch falls back to a safe report.
 *   • No PII — the report carries truncated text snippets only,
 *     and operators see the same DOM in DevTools anyway.
 */

const _DEFAULT_MAX_SNIPPETS = 50;
const _MAX_SNIPPET_LEN = 80;

const _SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'KBD', 'SAMP',
  // Inputs render value attribute, not text content — different audit path.
  'INPUT', 'TEXTAREA', 'SELECT', 'OPTION',
]);

// English-only words that are commonly intentional brand / acronym /
// product-name leaks. Skipping these reduces noise — the operator
// can re-enable them by passing `strict: true`.
const _ALLOWLIST = new Set([
  'farroway', 'tomato', 'maize', 'pepper', // crop names that appear in many languages
  'json', 'http', 'https', 'url', 'app',   // technical tokens
  'ok', 'cancel',                          // tiny tokens that often appear in many translations
]);

function _resolveLocale() {
  try {
    if (typeof document !== 'undefined' && document.documentElement
        && document.documentElement.lang) {
      return String(document.documentElement.lang).toLowerCase().split('-')[0];
    }
    if (typeof window !== 'undefined' && window.__farrowayLocale) {
      return String(window.__farrowayLocale).toLowerCase().split('-')[0];
    }
    if (typeof location !== 'undefined' && location.search) {
      const m = /[?&]lang=([a-zA-Z-]+)/.exec(location.search);
      if (m) return m[1].toLowerCase().split('-')[0];
    }
  } catch { /* swallow */ }
  return 'en';
}

function _looksEnglish(text) {
  // Conservative: ≥ 4 consecutive Latin letters anywhere is a
  // strong English/Latin-script signal. Most African + Indic
  // languages our app supports contain mostly Latin characters
  // too, but specific words like "Continue", "Submit", "Loading",
  // "Tomorrow" rarely appear unchanged in other locales.
  if (!text) return false;
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return false;
  // Strip pure-numeric / pure-punctuation noise.
  if (!/[A-Za-z]/.test(trimmed)) return false;
  // Words ≥ 4 chars to avoid catching single letters / pure abbreviations.
  const words = trimmed.toLowerCase().match(/[a-z]{4,}/g) || [];
  if (words.length === 0) return false;
  // If EVERY long-token is allow-listed, skip.
  const interesting = words.filter((w) => !_ALLOWLIST.has(w));
  return interesting.length > 0;
}

function _isInsideSkipTag(node) {
  let cur = node && node.parentElement;
  while (cur) {
    if (_SKIP_TAGS.has(cur.tagName)) return true;
    if (cur.getAttribute && cur.getAttribute('data-i18n-ignore') === 'true') return true;
    cur = cur.parentElement;
  }
  return false;
}

/**
 * Scan the live DOM for English-looking text and produce a
 * structured report. Returns a safe stub when window/document
 * are unavailable.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.strict=false]   skip the allow-list
 * @param {number}  [opts.maxSnippets=50] cap on returned snippets
 * @returns {object}
 */
export function runI18nAudit(opts) {
  const o = opts || {};
  const maxSnippets = Number.isFinite(o.maxSnippets) && o.maxSnippets > 0
    ? o.maxSnippets
    : _DEFAULT_MAX_SNIPPETS;
  const strict = !!o.strict;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      ok: false, reason: 'ssr_context', locale: null,
      candidates: [], totalCandidates: 0, scannedTextNodes: 0,
    };
  }

  try {
    const locale = _resolveLocale();
    // English locale: report nothing — auditor is for NON-English.
    if (locale === 'en') {
      return {
        ok: true, locale, isEnglishLocale: true,
        candidates: [], totalCandidates: 0, scannedTextNodes: 0,
      };
    }

    const root = document.body || document.documentElement;
    if (!root) {
      return { ok: false, reason: 'no_root', locale,
               candidates: [], totalCandidates: 0, scannedTextNodes: 0 };
    }

    const seen = new Set();
    const candidates = [];
    let scannedTextNodes = 0;

    // NodeFilter.SHOW_TEXT === 4 — encoded as a constant so we
    // don't have to import the global.
    const SHOW_TEXT = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_TEXT) || 4;
    const walker = document.createTreeWalker(root, SHOW_TEXT, null);

    let node;
    // eslint-disable-next-line no-cond-assign
    while ((node = walker.nextNode())) {
      scannedTextNodes += 1;
      const text = node.nodeValue || '';
      const trimmed = text.replace(/\s+/g, ' ').trim();
      if (!trimmed) continue;
      if (_isInsideSkipTag(node)) continue;
      // Apply allow-list unless strict mode.
      if (!strict && !_looksEnglish(trimmed)) continue;
      if (strict && !/[A-Za-z]{2,}/.test(trimmed)) continue;
      // Deduplicate identical snippets.
      const snippet = trimmed.length > _MAX_SNIPPET_LEN
        ? trimmed.slice(0, _MAX_SNIPPET_LEN) + '…'
        : trimmed;
      if (seen.has(snippet)) continue;
      seen.add(snippet);
      candidates.push({
        snippet,
        parentTag: (node.parentElement && node.parentElement.tagName) || null,
        parentClass: (node.parentElement && node.parentElement.className) || null,
      });
      if (candidates.length >= maxSnippets) break;
    }

    return {
      ok:               true,
      locale,
      isEnglishLocale:  false,
      strict,
      candidates,
      totalCandidates:  candidates.length,
      scannedTextNodes,
      generatedAt:      new Date().toISOString(),
      hint: candidates.length === 0
        ? 'No English-looking text detected in the current view.'
        : `Found ${candidates.length} candidate snippet(s). Open Settings → Language to confirm the active locale, then verify each snippet has a translation key.`,
    };
  } catch (error) {
    return {
      ok: false, reason: 'exception',
      error: (error && error.message) || String(error),
      candidates: [], totalCandidates: 0, scannedTextNodes: 0,
    };
  }
}

/**
 * Expose `window.__i18nAudit()` so operators can run the audit
 * from DevTools without importing the module. Idempotent.
 */
export function installI18nAuditHook() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__i18nAudit) return true;
    window.__i18nAudit = (opts) => runI18nAudit(opts);
    return true;
  } catch { return false; }
}

const _module = { runI18nAudit, installI18nAuditHook };
export default _module;
