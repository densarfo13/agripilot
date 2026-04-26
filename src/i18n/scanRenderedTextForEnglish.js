/**
 * scanRenderedTextForEnglish — dev-only one-shot route audit.
 *
 * Companion to `src/i18n/devTextAudit.js`. That earlier scanner runs
 * once at app idle and flags hardcoded literals across the page.
 * This one is **route-scoped + lang-scoped**: a developer or QA
 * tester invokes it after switching language and navigating to a
 * specific route, and it prints a focused report of any text node
 * that still looks predominantly Latin (i.e. an English leak) on
 * the current page.
 *
 * Why one-shot
 * ────────────
 * A continuous MutationObserver would fire on every render and
 * burn dev CPU for marginal benefit. The leaks we care about live
 * on first paint of the route. Run-and-forget gives a clear
 * report without the overhead.
 *
 * Production guard
 * ────────────────
 * The function refuses to run when:
 *   • `import.meta.env.DEV` is false (Vite tree-shakes the call
 *     site too — the function body never reaches the production
 *     bundle), or
 *   • `lang === 'en'` (English UI is allowed to be predominantly
 *     Latin; this audit is for non-English routes only).
 *
 * Usage
 * ─────
 *   // From dev console:
 *   import { scanRenderedTextForEnglish } from '/src/i18n/scanRenderedTextForEnglish.js';
 *   scanRenderedTextForEnglish('hi', '/progress');
 *
 *   // Or via the auto-exposed window helper:
 *   window.__farrowayLangAudit('hi', '/progress');
 *
 * Report shape
 *   console.groupCollapsed(`[lang-audit] route="/progress" lang="hi" — N candidate(s)`)
 *     for each finding:
 *       text:   the offending string (trimmed, capped)
 *       tag:    element tag name
 *       hint:   nearest data-testid / id / className / aria-label
 *       el:     the DOM node so the dev can click through in DevTools
 *   console.groupEnd()
 *
 * False-positive filters mirror devTextAudit:
 *   • numeric / date / time / currency strings
 *   • very short or very long strings
 *   • markers like `[MISSING:…]` / `[CROP_LEAK]`
 *   • subtree opt-outs: `[data-i18n-skip]`, `[data-i18n-key]`,
 *     `[data-testid]`, `[role="status"]`, `[aria-live]`
 *   • per-class skip on chip/badge/stat/pill/kpi/value
 */

const TARGET_TAGS = Object.freeze([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'span', 'label', 'a', 'li',
  'td', 'th', 'dt', 'dd',
]);

const SKIP_SELECTORS =
  '[data-i18n-skip],[data-i18n-key],[data-testid],[role="status"],[aria-live],input,select,textarea,code,pre';

const SKIP_CLASS_RE = /score|stat|count|number|metric|chip|badge|pill|kpi|tile|value|footer|currency/i;

const NUMERIC_RE  = /^\s*[-+]?\d{1,4}(?:[.,]\d+)?\s*(?:%|kg|t|tons?|GHS|KES|USD|EUR|hrs?|min|sec|days?|d)?\s*$/i;
const DATE_RE     = /^\s*\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}\s*$/;
const TIME_RE     = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\s*$/i;
const CURRENCY_RE = /^\s*[A-Z]{2,4}\s*[$£€]?\s*[\d,.]+\s*$/;
const MARKER_RE   = /\[MISSING(?:_CROP_LABEL)?:.+\]|\[CROP_LEAK\]|\[FALLBACK_USED\]/;

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
}

function _isLatinDominant(text) {
  const total = text.replace(/\s/g, '').length;
  if (total === 0) return false;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return latin / total > 0.6;
}

function _shouldFlag(rawText) {
  if (!rawText) return false;
  const text = rawText.trim();
  if (text.length < 12)  return false;
  if (text.length > 200) return false;
  if (NUMERIC_RE.test(text))  return false;
  if (DATE_RE.test(text))     return false;
  if (TIME_RE.test(text))     return false;
  if (CURRENCY_RE.test(text)) return false;
  if (MARKER_RE.test(text))   return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  return _isLatinDominant(text);
}

function _ancestorHint(el) {
  // Walk up to ~6 levels looking for an identifier worth printing.
  let n = el;
  for (let depth = 0; n && depth < 6; depth += 1) {
    if (n.dataset?.testid) return `data-testid="${n.dataset.testid}"`;
    if (n.id)              return `#${n.id}`;
    if (typeof n.className === 'string' && n.className.trim()) {
      return `.${n.className.trim().split(/\s+/)[0]}`;
    }
    if (n.getAttribute && n.getAttribute('aria-label')) {
      return `aria-label="${n.getAttribute('aria-label')}"`;
    }
    n = n.parentElement;
  }
  return '(unhinted)';
}

/**
 * @param {string} [lang]   short language code; defaults to <html lang>.
 * @param {string} [route]  route label for the report header; defaults to current pathname.
 * @param {object} [opts]
 * @param {number} [opts.cap]  max findings to print (default 25)
 * @returns {Array<{text:string,tag:string,hint:string,el:Element}>}
 *   Empty array on a clean route or when the audit refused to run.
 */
export function scanRenderedTextForEnglish(lang, route, opts = {}) {
  if (!_isDev()) return [];
  if (typeof document === 'undefined' || !document.body) return [];

  let activeLang = lang;
  if (!activeLang) {
    try { activeLang = document.documentElement.getAttribute('lang') || 'en'; }
    catch { activeLang = 'en'; }
  }
  if (activeLang === 'en') {
    try { console.log('[lang-audit] skipped (lang=en)'); } catch { /* ignore */ }
    return [];
  }

  let activeRoute = route;
  if (!activeRoute) {
    try { activeRoute = window.location?.pathname || '(unknown)'; }
    catch { activeRoute = '(unknown)'; }
  }

  const cap = Number.isFinite(opts.cap) ? opts.cap : 25;
  const selector = TARGET_TAGS.join(',');
  let candidates;
  try { candidates = document.querySelectorAll(selector); }
  catch { return []; }

  const findings = [];
  const seen = new Set();

  for (const el of candidates) {
    if (findings.length >= cap) break;
    if (el.childNodes.length !== 1) continue;
    if (el.childNodes[0].nodeType !== 3 /* TEXT_NODE */) continue;
    try {
      if (el.closest(SKIP_SELECTORS)) continue;
    } catch { continue; }
    let skipByClass = false;
    let n = el;
    while (n && n !== document.body) {
      const cls = n.className;
      if (typeof cls === 'string' && cls && SKIP_CLASS_RE.test(cls)) {
        skipByClass = true;
        break;
      }
      n = n.parentElement;
    }
    if (skipByClass) continue;
    const text = el.textContent || '';
    if (!_shouldFlag(text)) continue;
    const key = text.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      text: key,
      tag:  el.tagName.toLowerCase(),
      hint: _ancestorHint(el),
      el,
    });
  }

  try {
    if (findings.length === 0) {
      console.log(`[lang-audit] clean — route="${activeRoute}" lang="${activeLang}"`);
    } else {
      console.groupCollapsed(
        `[lang-audit] route="${activeRoute}" lang="${activeLang}" — ${findings.length} candidate(s)`
      );
      for (const f of findings) {
        console.log(`<${f.tag}> [${f.hint}]`, f.text, f.el);
      }
      if (findings.length === cap) {
        console.log(`… (capped at ${cap}; fix these and re-run)`);
      }
      console.groupEnd();
    }
  } catch { /* never propagate from a dev tool */ }

  return findings;
}

// Auto-expose on window in dev so QA can call it from DevTools
// without needing to import. Tree-shaken in production.
if (_isDev() && typeof window !== 'undefined') {
  try { window.__farrowayLangAudit = scanRenderedTextForEnglish; }
  catch { /* ignore */ }
}

export default scanRenderedTextForEnglish;
