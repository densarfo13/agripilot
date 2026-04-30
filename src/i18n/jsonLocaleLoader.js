/**
 * jsonLocaleLoader.js — flatten the namespaced JSON locale
 * files in src/i18n/locales/*.json into the dotted-key shape
 * the canonical T table uses, then merge them as empty-slot
 * fill so translator-authored values in translations.js still
 * win for keys both sources cover.
 *
 * Why this exists: the localization rollout spec (§1, §11)
 * mandates "Use translation JSON files, not hardcoded text".
 * The existing app already ships en/tw/ha/hi/sw/fr/es/pt JSON
 * files (with sections like `nav`, `dashboard`, `farm`, etc.)
 * but they were not wired into the live t() resolver. This
 * loader closes that gap WITHOUT migrating the existing T
 * table — the two sources coexist.
 *
 * Lazy-load: each JSON is imported via Vite's static import
 * (one bundle hit at boot, not a runtime fetch). The
 * structure is tiny (< 5 KB per locale) so no code-split.
 */

import en from './locales/en.json';
import tw from './locales/tw.json';
import ha from './locales/ha.json';
import hi from './locales/hi.json';
import sw from './locales/sw.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import pt from './locales/pt.json';

const RAW = { en, tw, ha, hi, sw, fr, es, pt };

/**
 * Flatten { nav: { home: 'Fie' } } → { 'nav.home': 'Fie' }.
 * Arrays are stringified verbatim (rare in our locales but
 * defensive). Non-string leaves are coerced via String().
 */
function flatten(obj, prefix = '', out = {}) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v, key, out);
    } else if (v != null) {
      out[key] = String(v);
    }
  }
  return out;
}

/**
 * Build the same `{ locale: { key: value } }` overlay shape
 * mergeOverlays.js expects, so existing infrastructure can
 * consume the JSON files without special-casing.
 */
export function buildJsonOverlay() {
  const overlay = Object.create(null);
  for (const [locale, raw] of Object.entries(RAW)) {
    overlay[locale] = flatten(raw);
  }
  return overlay;
}

/**
 * For ad-hoc callers that want a flat lookup table for one
 * locale (e.g. SSR rehydration tests).
 */
export function getFlatJsonLocale(locale) {
  if (!locale || !RAW[locale]) return {};
  return flatten(RAW[locale]);
}

export const JSON_LOCALE_OVERLAY = buildJsonOverlay();

export default JSON_LOCALE_OVERLAY;
