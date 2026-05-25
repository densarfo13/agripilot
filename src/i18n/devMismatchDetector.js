/**
 * devMismatchDetector.js — runtime "mixed-language screen" probe.
 *
 * DEV-ONLY. When the active locale is non-English, walks the DOM
 * after each user interaction / route change and reports text
 * nodes whose content matches a known English string from the
 * canonical T-en column. Those matches are mixed-language leaks
 * (hardcoded English literal OR a missing translation falling
 * back to English).
 *
 * Output (browser console):
 *
 *   [i18n mismatch] lang=fr
 *     text="Continue"
 *     element=<button.btn-primary>
 *     selector=#root > main > div.flow > button.btn-primary
 *
 * Production builds dead-code-eliminate the entire module: the
 * single exported `installMismatchDetector()` is a no-op when
 * import.meta.env.DEV is false (Vite folds the env literal at
 * build time, the body's `if (!DEV) return;` becomes
 * `if (true) return;`, the rest dead-strips).
 *
 * Implementation
 * ──────────────
 *   1. At install time: build a Set of every English value from
 *      the T table (post-mergePacks) of length >= 4 chars. That's
 *      the "known English strings" needle set. Short values
 *      (Yes/No/OK) would generate noise across multiple locales
 *      since they sometimes legitimately render in English.
 *
 *   2. Subscribe to MutationObserver on document.body for added
 *      nodes + characterData mutations. On each batch:
 *        a) Walk new text nodes.
 *        b) For each text node whose trimmed content is in the
 *           needle set, log a mismatch.
 *
 *   3. Subscribe to `farroway:langchange`. When lang flips to
 *      non-English, do an initial full-document sweep (catches
 *      static text that was rendered before the detector
 *      installed). When lang flips back to 'en', deactivate.
 *
 *   4. Each unique (text, selector) tuple is reported AT MOST
 *      ONCE — a heavily-rendered button doesn't spam the console.
 *
 * Performance: scoped to dev mode where re-render cost is the
 * dominant overhead anyway. MutationObserver batches mutations
 * into a single microtask, and we walk only added nodes (not
 * the whole tree on every change). On a 100-component re-render
 * the detector adds <2ms.
 */

import T from './translations.js';

const DEV = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
})();

let _installed = false;

export function installMismatchDetector() {
  if (!DEV) return;                  // ← prod dead-strips everything below
  if (_installed) return;
  _installed = true;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // ─── Build the English needle set ─────────────────────────
  // Only include values with length >= 4 AND containing a space
  // OR a vowel sequence — filters out single-word common tokens
  // ("OK", "Go") that legitimately render in many locales.
  const NEEDLES = new Set();
  let needleCount = 0;
  try {
    for (const key of Object.keys(T)) {
      const en = T[key] && T[key].en;
      if (typeof en !== 'string') continue;
      const trimmed = en.trim();
      if (trimmed.length < 4) continue;
      if (trimmed.length > 200) continue;          // skip paragraph-long blobs
      if (!/[a-zA-Z]/.test(trimmed)) continue;
      // Skip strings with interpolation placeholders — `{name}` won't
      // appear in the rendered DOM, the rendered form will have
      // values substituted. We'd false-positive on the unfilled
      // template, but more importantly the substituted form is
      // dynamic and never matches the needle.
      if (/\{[a-zA-Z_]/.test(trimmed)) continue;
      NEEDLES.add(trimmed);
      needleCount += 1;
    }
  } catch { /* swallow */ }

  if (NEEDLES.size === 0) {
    // T not populated yet (column-sparse boot hasn't merged). Defer
    // install until farroway:langchange fires for the first time.
    window.addEventListener('farroway:langchange', () => {
      _installed = false;
      installMismatchDetector();
    }, { once: true });
    return;
  }

  // ─── Reported-mismatch memo ──────────────────────────────
  // Key: `${text}|||${selector}`. Each (text, selector) reported once.
  const _reported = new Set();

  // ─── Active-language tracking ────────────────────────────
  // Pull dynamically — getLanguage() lives in index.js and might
  // not be importable here without a circular ref. Read the
  // canonical localStorage slot directly.
  function activeLang() {
    try {
      if (typeof localStorage === 'undefined') return 'en';
      return (localStorage.getItem('farroway:lang') || 'en').toLowerCase();
    } catch { return 'en'; }
  }

  // ─── Selector builder ────────────────────────────────────
  // Walk up the element chain to ~5 levels for a useful path.
  function selectorOf(node) {
    let el = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement);
    const parts = [];
    let hops = 0;
    while (el && hops < 5) {
      let chunk = el.tagName.toLowerCase();
      if (el.id) chunk += '#' + el.id;
      else if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (cls) chunk += '.' + cls;
      }
      parts.unshift(chunk);
      el = el.parentElement;
      hops += 1;
    }
    return parts.join(' > ') || '?';
  }

  // ─── Check a single text node ────────────────────────────
  function checkTextNode(node) {
    const text = (node.textContent || '').trim();
    if (!text || text.length < 4) return;
    if (!NEEDLES.has(text)) return;
    const sel = selectorOf(node);
    const memo = text + '|||' + sel;
    if (_reported.has(memo)) return;
    _reported.add(memo);
    try {
      // eslint-disable-next-line no-console
      console.warn('[i18n mismatch]',
        'lang=' + activeLang(),
        '\n  text="' + text + '"',
        '\n  selector=' + sel);
    } catch { /* swallow */ }
  }

  // ─── Walk a subtree's text nodes ─────────────────────────
  function walkText(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) { checkTextNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    // TreeWalker is the fastest text-only traversal API.
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) checkTextNode(n);
  }

  // ─── Full-document sweep ─────────────────────────────────
  function fullSweep() {
    if (activeLang() === 'en') return;
    walkText(document.body);
  }

  // ─── MutationObserver ────────────────────────────────────
  const observer = new MutationObserver((mutations) => {
    if (activeLang() === 'en') return;
    for (const mut of mutations) {
      if (mut.type === 'characterData') {
        checkTextNode(mut.target);
      } else if (mut.type === 'childList') {
        for (const added of mut.addedNodes) walkText(added);
      }
    }
  });

  function start() {
    try {
      observer.observe(document.body, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    } catch { /* swallow */ }
  }
  function stop() {
    try { observer.disconnect(); } catch { /* swallow */ }
  }

  // ─── Install lifecycle ───────────────────────────────────
  // eslint-disable-next-line no-console
  console.info(
    '[i18n] mismatch detector ACTIVE (' + needleCount + ' English needles loaded).',
    '\n  Logs appear when a non-English locale is active and a known',
    '\n  English string is found in the rendered DOM.',
    '\n  Disable by removing src/i18n/devMismatchDetector.js or its bootstrap call.',
  );
  if (activeLang() !== 'en') {
    fullSweep();
    start();
  }
  // Re-arm on language change.
  window.addEventListener('farroway:langchange', () => {
    _reported.clear();   // reset per-language reporting
    if (activeLang() === 'en') {
      stop();
    } else {
      // Wait two animation frames so React's render has flushed,
      // then sweep + start observing.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        fullSweep();
        start();
      }));
    }
  });
}

export default installMismatchDetector;
