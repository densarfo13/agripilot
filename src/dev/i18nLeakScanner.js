/**
 * i18nLeakScanner.js — dev-only, one-shot, phrase-list leak scanner.
 *
 * Companion to `src/i18n/scanRenderedTextForEnglish.js`. That earlier
 * scanner does generic Latin-character-ratio detection over every
 * text node on the page; this one is **focused** — it scans only for
 * a small list of known-leak phrases that have appeared in past
 * pilot screenshots, so it surfaces specific known regressions
 * without the noise of a full-page sweep.
 *
 * Behaviour
 * ─────────
 *   • Refuses to run unless `import.meta.env.DEV` is true (so the
 *     module body never reaches the production bundle when the
 *     caller dynamic-imports it).
 *   • Refuses to run when the active language is English — leaks
 *     against an English UI are not leaks.
 *   • One-shot: walks `document.body.innerText` once and returns.
 *     No MutationObserver, no interval polling.
 *
 * Output
 *   console.groupCollapsed(`[i18n-leak] route="…" lang="…" — N hit(s)`)
 *     for each match: `phrase` and the first 80 chars of context.
 *   console.groupEnd()
 *
 * Tree-shake guarantee
 *   `src/main.jsx` only dynamic-imports this file when
 *   `import.meta.env.DEV` is true, so Rollup tree-shakes the entire
 *   module out of the production build.
 */

const PHRASES = Object.freeze([
  'Your crop',
  'Sow today',
  'Scout',
  'Weed',
  'Check soil',
  'Mark done',
  'Skip',
  'Title',
  'Estimated',
  'All done',
  'Great work',
  'Cassava',
]);

function _isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) return true;
  } catch { /* SSR */ }
  return false;
}

/**
 * Scan the current document for known English leak phrases.
 *
 * @param {string} [lang]   short language code; defaults to <html lang>.
 * @param {string} [route]  route label for the report header.
 * @returns {Array<{phrase:string, context:string}>}
 */
export function scanForLeaks(lang, route) {
  if (!_isDev()) return [];
  if (typeof document === 'undefined' || !document.body) return [];

  let activeLang = lang;
  if (!activeLang) {
    try { activeLang = document.documentElement.getAttribute('lang') || 'en'; }
    catch { activeLang = 'en'; }
  }
  if (activeLang === 'en') {
    try { console.log('[i18n-leak] skipped (lang=en)'); } catch { /* ignore */ }
    return [];
  }

  let activeRoute = route;
  if (!activeRoute) {
    try { activeRoute = window.location?.pathname || '(unknown)'; }
    catch { activeRoute = '(unknown)'; }
  }

  let body = '';
  try { body = document.body.innerText || ''; }
  catch { return []; }
  if (!body) return [];

  const findings = [];
  for (const phrase of PHRASES) {
    const idx = body.indexOf(phrase);
    if (idx === -1) continue;
    const start = Math.max(0, idx - 16);
    const end   = Math.min(body.length, idx + phrase.length + 32);
    findings.push({
      phrase,
      context: body.slice(start, end).replace(/\s+/g, ' ').trim(),
    });
  }

  try {
    if (findings.length === 0) {
      console.log(`[i18n-leak] clean — route="${activeRoute}" lang="${activeLang}"`);
    } else {
      console.groupCollapsed(
        `[i18n-leak] route="${activeRoute}" lang="${activeLang}" — ${findings.length} hit(s)`
      );
      for (const f of findings) {
        console.warn(`"${f.phrase}" near: …${f.context}…`);
      }
      console.groupEnd();
    }
  } catch { /* never propagate from a dev tool */ }

  return findings;
}

// Expose on `window` for QA-from-DevTools convenience. Only in dev.
if (_isDev() && typeof window !== 'undefined') {
  try { window.__farrowayLeakScan = scanForLeaks; }
  catch { /* ignore */ }
}

export default scanForLeaks;
