/**
 * logMissingTranslation.js — capture coverage gaps so the admin
 * dashboard can surface "where are we leaking English?".
 *
 * Three side-channels, in order of weight:
 *
 *   1. Console warn (dev only)
 *   2. window event   `farroway:missingTranslation` (live
 *      subscribers — admin dashboard, dev overlays)
 *   3. localStorage   `farroway:missingTranslations` queue
 *      (capped at 200 entries; older drop off the back).
 *
 * No network calls. No-op in SSR / locked-down browsers. Each
 * (key, lang) is logged AT MOST once per session to keep the
 * console + queue readable.
 */

const QUEUE_KEY = 'farroway:missingTranslations';
const MAX_QUEUE = 200;

const _seenInSession = new Set();

function safeStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch { return null; }
}

function isDev() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return !!import.meta.env.DEV;
    }
  } catch { /* SSR */ }
  return false;
}

function pushToQueue(entry) {
  const ls = safeStorage();
  if (!ls) return;
  try {
    const raw = ls.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return;
    list.push(entry);
    while (list.length > MAX_QUEUE) list.shift();
    ls.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch { /* parsing or storage quota — drop silently */ }
}

/**
 * logMissingTranslation — main entry.
 *
 * @param  {object} args
 * @param  {string} args.key       i18n key (or synthetic id)
 * @param  {string} args.lang      requested language
 * @param  {string} [args.surface] caller for triage
 *   ('getLocalizedCropName', 'task.title.weed_clearing', etc.)
 */
export function logMissingTranslation({ key, lang, surface = '' } = {}) {
  if (!key || !lang || lang === 'en') return;
  const dedupe = `${key}:${lang}`;
  if (_seenInSession.has(dedupe)) return;
  _seenInSession.add(dedupe);

  const entry = {
    key, lang, surface: String(surface || ''),
    at: (() => { try { return new Date().toISOString(); } catch { return ''; } })(),
  };

  // 1. Dev console.
  if (isDev()) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[i18n missing]', `${key} (lang=${lang})`,
        surface ? `via ${surface}` : '');
    } catch { /* swallow */ }
  }

  // 2. Window event for live subscribers.
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('farroway:missingTranslation', {
        detail: entry,
      }));
    }
  } catch { /* swallow */ }

  // 3. Persistent queue (admin dashboard reads on demand).
  pushToQueue(entry);
}

/**
 * readMissingTranslationQueue — admin tooling helper.
 * Returns up to MAX_QUEUE recorded misses, newest last.
 */
export function readMissingTranslationQueue() {
  const ls = safeStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(QUEUE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

/**
 * clearMissingTranslationQueue — useful in tests + an admin
 * "Mark all reviewed" button.
 */
export function clearMissingTranslationQueue() {
  const ls = safeStorage();
  if (!ls) return;
  try { ls.removeItem(QUEUE_KEY); } catch { /* ignore */ }
  _seenInSession.clear();
}

export const _internal = Object.freeze({
  QUEUE_KEY,
  MAX_QUEUE,
});
