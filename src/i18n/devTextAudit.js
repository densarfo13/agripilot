/**
 * devTextAudit.js — one-shot, dev-only DOM text audit.
 *
 * Runs ONCE on first idle after the SPA mounts, walks a curated set
 * of text-bearing elements, and reports likely hardcoded English
 * literals to the console as a single grouped block. Never runs in
 * production — `src/main.jsx` only dynamic-imports this file when
 * `import.meta.env.DEV` is true, so the bundler tree-shakes it out
 * of the prod build.
 *
 * Why a one-shot scan (and NOT a MutationObserver)
 *   • A MutationObserver fires on every React render. On a typical
 *     Farroway page that's hundreds of mutations per minute. The
 *     observer would burn dev CPU and slow Vite HMR for marginal
 *     value (the same hardcoded literal stays detectable on first
 *     mount).
 *   • One scan after `requestIdleCallback` catches the literals
 *     present on the first paint of whatever page the developer
 *     is working on. That's where ~95% of leaks live.
 *
 * False-positive minimisation
 *   We skip the entire subtree of any node carrying:
 *     • [data-i18n-skip]   ← author opt-out
 *     • [data-i18n-key]    ← already i18n'd via a `t()` wrapper
 *     • [data-testid]      ← test markers (not user-visible copy)
 *     • [role="status"]    ← live-regions (counters, alerts, KPIs)
 *     • [aria-live]        ← same
 *     • input/select/textarea/code/pre — author content / form data
 *
 *   Per-element class-name guard skips anything in a chip / badge /
 *   stat / pill / kpi / tile / value / count / metric / number /
 *   score / footer container.
 *
 *   Per-text-node skip when the trimmed text matches:
 *     • pure number with optional unit suffix
 *     • date / time / currency
 *     • shorter than 12 chars OR longer than 200
 *     • fewer than 3 words (button labels stay quiet)
 *     • already a debug marker (`[MISSING:…]` / `[CROP_LEAK]` / `[FALLBACK_USED]`)
 *
 *   Language-aware: when the active UI language is NON-English,
 *   ONLY predominantly-Latin strings get flagged — that's the
 *   "English is leaking into Hindi/Twi UI" case. In English UI
 *   the filter still flags long un-i18n'd literals (translators
 *   can't override what doesn't go through `t()`).
 *
 * Output
 *   `console.groupCollapsed('[i18n-audit] N hardcoded-text candidates (lang="X")')`
 *   with up to 25 entries. Each entry shows tag + text + the
 *   element node so the dev can click through to it in DevTools.
 *
 *   Capped at 25 to avoid drowning the console — fix the visible
 *   ones, reload, and the next batch surfaces.
 */

import { getLanguage } from './index.js';

// ─── Filter constants ───────────────────────────────────────

const TARGET_TAGS = Object.freeze([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'button', 'span', 'label', 'a', 'li',
  'td', 'th', 'dt', 'dd',
]);

// Selectors that opt the entire subtree out of the audit. The
// `closest()` check below walks ancestors, so flagging the wrapper
// silences every leaf inside it.
const SKIP_SELECTORS =
  '[data-i18n-skip],[data-i18n-key],[data-testid],[role="status"],[aria-live],input,select,textarea,code,pre';

// Class names that signal a numerical / status pill where short
// English-looking text is intentional (e.g. "73 / 100 Good",
// "127 farmers", "GHS 12,400"). Walking ancestors so a child
// `<span>` inside a `<div class="stat-card">` is exempted too.
const SKIP_CLASS_RE = /score|stat|count|number|metric|chip|badge|pill|kpi|tile|value|footer|currency/i;

const NUMERIC_RE  = /^\s*[-+]?\d{1,4}(?:[.,]\d+)?\s*(?:%|kg|t|tons?|GHS|KES|USD|EUR|hrs?|min|sec|days?|d)?\s*$/i;
const DATE_RE     = /^\s*\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}\s*$/;
const TIME_RE     = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\s*$/i;
const CURRENCY_RE = /^\s*[A-Z]{2,4}\s*[$£€]?\s*[\d,.]+\s*$/;
const MARKER_RE   = /\[MISSING(?:_CROP_LABEL)?:.+\]|\[CROP_LEAK\]|\[FALLBACK_USED\]/;

// ─── Helpers ────────────────────────────────────────────────

function isLatinDominant(text) {
  const total = text.replace(/\s/g, '').length;
  if (total === 0) return false;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return latin / total > 0.6;
}

function shouldFlag(rawText, lang) {
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

  // Non-English UI: only flag predominantly-Latin strings (the
  // "English literal leaked into a non-English UI" case).
  if (lang && lang !== 'en' && !isLatinDominant(text)) return false;

  return true;
}

function ancestorMatches(el, selector) {
  try { return el.closest(selector); }
  catch { return null; }
}

function ancestorClassMatches(el, regex) {
  let n = el;
  while (n && n !== document.body) {
    const cls = n.className;
    if (typeof cls === 'string' && cls && regex.test(cls)) return true;
    n = n.parentElement;
  }
  return false;
}

// ─── Main audit ────────────────────────────────────────────

function runAudit() {
  if (typeof document === 'undefined' || !document.body) return;

  let lang = 'en';
  try { lang = getLanguage() || 'en'; } catch { /* keep en */ }

  const selector = TARGET_TAGS.join(',');
  let candidates;
  try { candidates = document.querySelectorAll(selector); }
  catch { return; }

  const findings = [];
  const seen = new Set();
  const CAP = 25;

  for (const el of candidates) {
    if (findings.length >= CAP) break;

    // Only score elements whose direct content is one text node —
    // skips composite headers / wrappers full of children. Catches
    // the typical leak shape `<p>Long English string</p>`.
    if (el.childNodes.length !== 1) continue;
    if (el.childNodes[0].nodeType !== 3 /* Node.TEXT_NODE */) continue;

    if (ancestorMatches(el, SKIP_SELECTORS)) continue;
    if (ancestorClassMatches(el, SKIP_CLASS_RE)) continue;

    const text = el.textContent || '';
    if (!shouldFlag(text, lang)) continue;

    const key = text.trim();
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ text: key, tag: el.tagName.toLowerCase(), el });
  }

  if (findings.length === 0) {
    try { console.log(`[i18n-audit] clean — no hardcoded-text candidates (lang="${lang}")`); }
    catch { /* ignore */ }
    return;
  }

  try {
    console.groupCollapsed(`[i18n-audit] ${findings.length} hardcoded-text candidate(s) (lang="${lang}")`);
    for (const f of findings) {
      console.log(`<${f.tag}>`, f.text, f.el);
    }
    if (findings.length === CAP) {
      console.log(`… (capped at ${CAP}; fix these and reload to see the next batch)`);
    }
    console.log('Tips:');
    console.log('  • Mark intentional literals with data-i18n-skip on the wrapper.');
    console.log('  • Wrap copy via t(\'key\', ...) or tSafe(\'key\', \'fallback\').');
    console.log('  • For crop labels, use getCropLabelSafe(value, lang).');
    console.groupEnd();
  } catch { /* never propagate from a dev tool */ }
}

// ─── Schedule ──────────────────────────────────────────────

function schedule() {
  if (typeof window === 'undefined') return;
  const fn = () => {
    try { runAudit(); }
    catch (err) {
      try { console.warn('[i18n-audit] scanner threw:', err && err.message); }
      catch { /* ignore */ }
    }
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 1000);
  }
}

schedule();

// Exposed for tests + manual re-run from the dev console.
export const _internal = Object.freeze({
  TARGET_TAGS,
  SKIP_SELECTORS,
  SKIP_CLASS_RE,
  NUMERIC_RE, DATE_RE, TIME_RE, CURRENCY_RE, MARKER_RE,
  shouldFlag, isLatinDominant, runAudit,
});
