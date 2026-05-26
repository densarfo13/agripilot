/**
 * cropLocalization.ts — canonical crop-name resolver.
 *
 * Thin facade over `src/i18n/cropNames.js` (overlay + registry +
 * English-fallback resolver) and `src/utils/cropLabel.js` (UI
 * wrapper that adds the empty-cell sentinel). The spec mandates
 * a single import path for new code:
 *
 *   import { getLocalizedCropName } from 'src/core/crops/cropLocalization.ts';
 *
 * Why a facade and not move the impl
 * ──────────────────────────────────
 *   The existing `getLocalizedCropName` is wired into ~50
 *   render sites already. Re-exporting from the spec path lets
 *   new code converge on the canonical entry point without a
 *   sweeping rename. The eslint guard (npm run check:crop-imports)
 *   prevents fresh imports of the legacy path; old call sites
 *   migrate incrementally.
 *
 *   `cropLabel(value, lang)` stays the recommended call for UI
 *   render paths because it normalises aliases AND returns a
 *   neutral sentinel for empty values. `getLocalizedCropName`
 *   is what you want in business logic (task generators,
 *   notification builders, voice scripts) where an empty value
 *   should round-trip the input rather than show '—'.
 *
 * Strict-rule audit
 *   • Pure. Never throws (delegates wrap their impls in try/catch).
 *   • SSR-safe — no window, no DOM, no localStorage.
 *   • No I/O — all data is in-memory registries.
 */

// The downstream modules are .js + tolerate any string. Cast at
// the boundary so this facade keeps a strict TS signature.
// @ts-ignore — JS module without .d.ts
import {
  getLocalizedCropName as _getLocalizedCropName,
  CROP_NAMES as _CROP_NAMES_OVERLAY,
} from '../../i18n/cropNames.js';
// @ts-ignore — JS module without .d.ts
import { cropLabel as _cropLabel } from '../../utils/cropLabel.js';
// @ts-ignore — JS module without .d.ts
import { normalizeCropId } from '../../config/crops/index.js';

import {
  LOCALE_CODES, isSupportedLocale, normalizeLocale,
  type LocaleCode,
} from '../../i18n/supportedLocales.ts';

export type CropId = string;

/**
 * Resolve the localized display name for a crop.
 *
 *   getLocalizedCropName('maize', 'tw') → 'Aburo'
 *   getLocalizedCropName('cassava', 'ha') → 'Rogo'        (registry)
 *   getLocalizedCropName('UNKNOWN', 'tw') → 'UNKNOWN'     (round-trip)
 *   getLocalizedCropName('', 'tw')       → ''             (empty in → empty out)
 *
 * Resolution order (delegated to the underlying overlay impl):
 *   1. Overlay table (partner-supplied, narrow)
 *   2. Canonical registry (~50 crops × 6 langs)
 *   3. English column of the overlay (safety net)
 *   4. The raw crop id (so nothing ever blanks silently)
 *
 * @param cropId   — canonical id, alias, or display name; normalised internally
 * @param locale   — any locale code; coerced via normalizeLocale before lookup
 */
export function getLocalizedCropName(cropId: CropId | null | undefined, locale: string = 'en'): string {
  try {
    if (!cropId) return '';
    const normLocale: LocaleCode = normalizeLocale(locale);
    let normId: string = String(cropId);
    try {
      const n = normalizeCropId(normId);
      if (n) normId = n;
    } catch { /* keep raw */ }
    const name = _getLocalizedCropName(normId, normLocale);
    return typeof name === 'string' && name ? name : String(cropId);
  } catch {
    return String(cropId || '');
  }
}

/**
 * UI variant — returns '—' for empty/unknown values. Use this in
 * render paths so an empty table cell never looks broken.
 */
export function getCropDisplayLabel(cropId: CropId | null | undefined, locale: string = 'en'): string {
  try {
    const normLocale: LocaleCode = normalizeLocale(locale);
    return _cropLabel(cropId, normLocale);
  } catch {
    return '—';
  }
}

/**
 * Build the full localization table for a single crop. Useful for
 * the dev audit hook and for the offline-language QA dump.
 *
 *   getLocalizedCropNameTable('maize') → {
 *     en: 'Maize / Corn', tw: 'Aburo', ha: 'Masara',
 *     fr: 'Maïs', sw: 'Mahindi', hi: 'मक्का',
 *   }
 */
export function getLocalizedCropNameTable(cropId: CropId): Partial<Record<LocaleCode, string>> {
  const out: Partial<Record<LocaleCode, string>> = {};
  for (const code of LOCALE_CODES) {
    out[code] = getLocalizedCropName(cropId, code);
  }
  return out;
}

/**
 * Enumerate every crop id that has an overlay row (i.e. the
 * partner-supplied subset). The full registry is much larger; the
 * audit hook reports both counts.
 */
export function listOverlayCropIds(): readonly CropId[] {
  try {
    return Object.freeze(Object.keys(_CROP_NAMES_OVERLAY || {}));
  } catch {
    return Object.freeze([]) as readonly CropId[];
  }
}

/**
 * Quick narrowing helper for call sites that take an untrusted
 * locale string and want to fall back gracefully without writing
 * the same `if (isSupportedLocale…)` chain everywhere.
 */
export function resolveLocale(input: unknown): LocaleCode {
  return isSupportedLocale(input) ? input : normalizeLocale(input);
}

const _module = {
  getLocalizedCropName,
  getCropDisplayLabel,
  getLocalizedCropNameTable,
  listOverlayCropIds,
  resolveLocale,
};
export default _module;
