/**
 * cropSeasonality.js — structured per-crop planting windows by
 * country, used by the seasonal intelligence engine.
 *
 * Shape:
 *   CROP_SEASONALITY[canonicalKey] = {
 *     globalDefault: {
 *       preferredPlantingMonths:   [1-12],
 *       acceptablePlantingMonths:  [1-12],
 *       prefersRain?:              boolean,
 *       dislikesHeavyRain?:        boolean,
 *       sensitiveToHeatStress?:    boolean,
 *       notes?:                    string,
 *     },
 *     regions: {
 *       GH: { preferredPlantingMonths, acceptablePlantingMonths, ... },
 *       IN: { ... },
 *     },
 *   }
 *
 * Month numbers are 1–12 (not 0-indexed), matching how farmers talk.
 * Regions listed with preferred AND acceptable; a month in neither
 * list is treated as "low fit" by the engine. Missing crop → the
 * engine returns `unknown` fit (neutral, never penalising).
 *
 * Adding a new crop
 *   1. Start with globalDefault — conservative widest-useful range.
 *   2. Only add country overrides when the pattern genuinely differs
 *      from the global default (northern vs southern hemisphere,
 *      monsoon pattern, altitude).
 */

const f = Object.freeze;
const m = (arr) => f(arr.slice().sort((a, b) => a - b));

// Helper shorthand so entries read cleanly.
function seas({ pref, ok, prefersRain, dislikesHeavyRain, sensitiveToHeatStress, notes }) {
  return f({
    preferredPlantingMonths:  m(pref || []),
    acceptablePlantingMonths: m(ok   || []),
    prefersRain:              Boolean(prefersRain),
    dislikesHeavyRain:        Boolean(dislikesHeavyRain),
    sensitiveToHeatStress:    Boolean(sensitiveToHeatStress),
    notes:                    notes || null,
  });
}

export const CROP_SEASONALITY = f({
  // ─── Cassava ─────────────────────────────────────────────────
  cassava: f({
    globalDefault: seas({
      pref: [3, 4, 5, 6], ok: [2, 7], prefersRain: true,
      notes: 'Start of the main rainy season.',
    }),
    regions: f({
      GH: seas({ pref: [3, 4, 5, 6], ok: [2, 7, 8], prefersRain: true }),
      NG: seas({ pref: [3, 4, 5, 6], ok: [2, 7, 8, 9], prefersRain: true }),
      KE: seas({ pref: [3, 4, 5], ok: [10, 11], prefersRain: true }),
      TZ: seas({ pref: [3, 4, 5], ok: [10, 11], prefersRain: true }),
      IN: seas({ pref: [6, 7, 8], ok: [5, 9], prefersRain: true }),
      BR: seas({ pref: [9, 10, 11, 12], ok: [1, 2, 8] }),
      US: seas({ pref: [4, 5], ok: [3, 6], sensitiveToHeatStress: true,
                 notes: 'Very limited US range — tropical/sub-tropical only.' }),
    }),
  }),

  // ─── Maize ───────────────────────────────────────────────────
  maize: f({
    globalDefault: seas({
      pref: [3, 4, 5], ok: [2, 6, 10], prefersRain: true,
      sensitiveToHeatStress: true,
      notes: 'Warm soil + steady rain through tasseling is critical.',
    }),
    regions: f({
      GH: seas({ pref: [3, 4, 5], ok: [2, 6, 8, 9], prefersRain: true }),
      NG: seas({ pref: [4, 5, 6], ok: [3, 7, 8, 9], prefersRain: true }),
      KE: seas({ pref: [3, 4, 5], ok: [10, 11], prefersRain: true }),
      TZ: seas({ pref: [3, 4, 5], ok: [11, 12], prefersRain: true }),
      IN: seas({ pref: [6, 7], ok: [5, 8, 9], prefersRain: true }),
      BR: seas({ pref: [9, 10, 11], ok: [1, 2, 8] }),
      US: seas({ pref: [4, 5], ok: [3, 6], sensitiveToHeatStress: true,
                 notes: 'Corn belt: plant once soil hits 10 \u00b0C.' }),
    }),
  }),

  // ─── Rice ────────────────────────────────────────────────────
  rice: f({
    globalDefault: seas({
      pref: [5, 6, 7], ok: [4, 8], prefersRain: true,
    }),
    regions: f({
      IN: seas({ pref: [6, 7, 8], ok: [5, 9], prefersRain: true,
                 notes: 'Kharif rice aligns with the southwest monsoon.' }),
      BD: seas({ pref: [6, 7, 8], ok: [5, 9, 11, 12], prefersRain: true }),
      TH: seas({ pref: [5, 6, 7, 8], ok: [4, 9] }),
      VN: seas({ pref: [5, 6, 7], ok: [4, 8] }),
      PH: seas({ pref: [6, 7], ok: [5, 8] }),
      GH: seas({ pref: [4, 5, 6, 7], ok: [3, 8] }),
      NG: seas({ pref: [5, 6, 7], ok: [4, 8] }),
      US: seas({ pref: [4, 5], ok: [3, 6], notes: 'US rice: Gulf Coast + California.' }),
    }),
  }),

  // ─── Tomato ──────────────────────────────────────────────────
  tomato: f({
    globalDefault: seas({
      pref: [2, 3, 9, 10], ok: [1, 4, 8, 11], dislikesHeavyRain: true,
      sensitiveToHeatStress: true,
      notes: 'Dry cool starts; avoids the wettest months (blight).',
    }),
    regions: f({
      GH: seas({ pref: [9, 10, 11], ok: [1, 2, 8, 12], dislikesHeavyRain: true }),
      NG: seas({ pref: [10, 11, 12], ok: [1, 2, 9], dislikesHeavyRain: true }),
      KE: seas({ pref: [1, 2, 7, 8], ok: [3, 9] }),
      IN: seas({ pref: [10, 11], ok: [6, 7, 12, 1] }),
      US: seas({ pref: [3, 4, 5], ok: [2, 6], sensitiveToHeatStress: true,
                 notes: 'Transplant after last frost — late spring.' }),
    }),
  }),

  // ─── Onion ───────────────────────────────────────────────────
  onion: f({
    globalDefault: seas({
      pref: [10, 11, 12], ok: [1, 9], dislikesHeavyRain: true,
      notes: 'Cool start; bulbing under drying weather.',
    }),
    regions: f({
      GH: seas({ pref: [10, 11], ok: [9, 12] }),
      NG: seas({ pref: [10, 11], ok: [9, 12] }),
      IN: seas({ pref: [10, 11, 12], ok: [1, 9],
                 notes: 'Rabi onion is the main commercial window.' }),
      US: seas({ pref: [2, 3], ok: [4], notes: 'Long-day varieties spring-planted.' }),
    }),
  }),

  // ─── Pepper ──────────────────────────────────────────────────
  pepper: f({
    globalDefault: seas({
      pref: [3, 4, 5, 9, 10], ok: [2, 6, 8, 11],
      sensitiveToHeatStress: true, dislikesHeavyRain: true,
    }),
    regions: f({
      GH: seas({ pref: [3, 4, 9, 10], ok: [2, 5, 8, 11] }),
      NG: seas({ pref: [4, 5, 9, 10], ok: [3, 6, 8, 11] }),
      IN: seas({ pref: [6, 7, 10, 11], ok: [5, 8, 12] }),
      US: seas({ pref: [4, 5, 6], ok: [3, 7] }),
    }),
  }),

  // ─── Groundnut ───────────────────────────────────────────────
  groundnut: f({
    globalDefault: seas({
      pref: [4, 5, 6], ok: [3, 7], prefersRain: true,
    }),
    regions: f({
      GH: seas({ pref: [4, 5, 6], ok: [3, 7, 8], prefersRain: true }),
      NG: seas({ pref: [5, 6, 7], ok: [4, 8], prefersRain: true }),
      SN: seas({ pref: [6, 7, 8], ok: [5, 9], prefersRain: true }),
      IN: seas({ pref: [6, 7], ok: [5, 8], prefersRain: true }),
      US: seas({ pref: [4, 5, 6], ok: [3, 7] }),
    }),
  }),

  // ─── Sweet potato ────────────────────────────────────────────
  'sweet-potato': f({
    globalDefault: seas({
      pref: [3, 4, 5, 9, 10], ok: [2, 6, 8, 11], prefersRain: true,
    }),
    regions: f({
      GH: seas({ pref: [3, 4, 5, 9, 10], ok: [2, 6, 8, 11], prefersRain: true }),
      KE: seas({ pref: [3, 4, 10, 11], ok: [2, 5, 9, 12], prefersRain: true }),
      IN: seas({ pref: [6, 7, 8], ok: [5, 9], prefersRain: true }),
      US: seas({ pref: [4, 5, 6], ok: [3, 7], sensitiveToHeatStress: false }),
    }),
  }),

  // ─── Banana ──────────────────────────────────────────────────
  banana: f({
    globalDefault: seas({
      pref: [3, 4, 5, 9, 10], ok: [2, 6, 8, 11], prefersRain: true,
      notes: 'Plant at the start of a sustained rainy window.',
    }),
    regions: f({
      GH: seas({ pref: [3, 4, 5, 9, 10], ok: [2, 6, 8, 11], prefersRain: true }),
      NG: seas({ pref: [4, 5, 9, 10], ok: [3, 6, 8, 11], prefersRain: true }),
      IN: seas({ pref: [6, 7, 10, 11], ok: [5, 8, 12], prefersRain: true }),
      EC: seas({ pref: [2, 3, 10, 11], ok: [1, 4, 9, 12], prefersRain: true }),
    }),
  }),

  // ─── Cocoa ───────────────────────────────────────────────────
  cocoa: f({
    globalDefault: seas({
      pref: [3, 4, 5, 6], ok: [2, 7, 9, 10], prefersRain: true,
      dislikesHeavyRain: false,
      notes: 'Plant under shade at the start of the main rains.',
    }),
    regions: f({
      GH: seas({ pref: [4, 5, 6], ok: [3, 7, 9, 10], prefersRain: true }),
      CI: seas({ pref: [4, 5, 6], ok: [3, 7, 9, 10], prefersRain: true }),
      NG: seas({ pref: [4, 5, 6], ok: [3, 7, 9, 10], prefersRain: true }),
      EC: seas({ pref: [2, 3, 10, 11], ok: [1, 4, 12], prefersRain: true }),
    }),
  }),

  // ─── Wheat (safe defaults) ──────────────────────────────────
  wheat: f({
    globalDefault: seas({
      pref: [10, 11], ok: [9, 12, 2, 3],
      notes: 'Cool-season grain; rabi in South Asia, spring/fall in temperate.',
    }),
    regions: f({
      IN: seas({ pref: [11, 12], ok: [10, 1] }),
      PK: seas({ pref: [11, 12], ok: [10, 1] }),
      US: seas({ pref: [9, 10, 3, 4], ok: [5, 8] }),
    }),
  }),

  // ─── Okra ────────────────────────────────────────────────────
  okra: f({
    globalDefault: seas({
      pref: [4, 5, 6], ok: [3, 7, 8], prefersRain: true,
    }),
    regions: f({
      GH: seas({ pref: [4, 5, 6], ok: [3, 7, 8], prefersRain: true }),
      NG: seas({ pref: [4, 5, 6], ok: [3, 7, 8], prefersRain: true }),
      IN: seas({ pref: [6, 7], ok: [5, 8] }),
    }),
  }),

  // ─── Yam ─────────────────────────────────────────────────────
  yam: f({
    globalDefault: seas({
      pref: [2, 3, 4], ok: [1, 5], prefersRain: true,
    }),
    regions: f({
      GH: seas({ pref: [2, 3, 4], ok: [1, 5], prefersRain: true }),
      NG: seas({ pref: [2, 3, 4], ok: [1, 5], prefersRain: true }),
    }),
  }),

  // ─── Potato ──────────────────────────────────────────────────
  potato: f({
    globalDefault: seas({
      pref: [3, 4, 9, 10], ok: [2, 5, 8, 11],
      sensitiveToHeatStress: true,
    }),
    regions: f({
      KE: seas({ pref: [3, 4, 10, 11], ok: [2, 5, 9, 12] }),
      IN: seas({ pref: [10, 11], ok: [9, 12] }),
      US: seas({ pref: [3, 4, 5], ok: [2, 6] }),
    }),
  }),

  // ─── Beans ───────────────────────────────────────────────────
  beans: f({
    globalDefault: seas({
      pref: [3, 4, 10, 11], ok: [2, 5, 9], prefersRain: true,
    }),
    regions: f({
      GH: seas({ pref: [3, 4, 9, 10], ok: [2, 5, 8, 11] }),
      KE: seas({ pref: [3, 4, 10, 11], ok: [2, 5, 9, 12] }),
      IN: seas({ pref: [6, 7], ok: [5, 8] }),
    }),
  }),

  // ─── Soybean ─────────────────────────────────────────────────
  soybean: f({
    globalDefault: seas({
      pref: [5, 6], ok: [4, 7], prefersRain: true,
    }),
    regions: f({
      IN: seas({ pref: [6, 7], ok: [5, 8] }),
      BR: seas({ pref: [10, 11], ok: [9, 12] }),
      US: seas({ pref: [5, 6], ok: [4, 7] }),
    }),
  }),

  // ─── Sorghum / Millet (drought-tolerant, wide window) ───────
  sorghum: f({
    globalDefault: seas({ pref: [4, 5, 6], ok: [3, 7] }),
    regions: f({
      NG: seas({ pref: [5, 6, 7], ok: [4, 8] }),
      IN: seas({ pref: [6, 7], ok: [5, 8] }),
    }),
  }),
  millet: f({
    globalDefault: seas({ pref: [5, 6, 7], ok: [4, 8] }),
    regions: f({
      NE: seas({ pref: [6, 7], ok: [5, 8] }),
      IN: seas({ pref: [6, 7], ok: [5, 8] }),
    }),
  }),
});

/**
 * getCropSeasonality(canonicalKey, countryCode?)
 *   Returns the regional override (merged over globalDefault) or the
 *   globalDefault. Returns null when the crop has no seasonality
 *   data so the engine can fall back to neutral scoring.
 */
export function getCropSeasonality(canonicalKey, countryCode = null) {
  if (!canonicalKey) return null;
  const entry = CROP_SEASONALITY[canonicalKey];
  if (!entry) return null;
  const cc = countryCode ? String(countryCode).toUpperCase() : null;
  if (cc && entry.regions && entry.regions[cc]) {
    return Object.freeze({ ...entry.globalDefault, ...entry.regions[cc] });
  }
  return entry.globalDefault || null;
}

/**
 * hasCropSeasonality — true when the crop has a structured entry
 * (regional or global). Used by the UI to decide whether to show
 * a "check local conditions" fallback message.
 */
export function hasCropSeasonality(canonicalKey) {
  return Boolean(canonicalKey && CROP_SEASONALITY[canonicalKey]);
}

export const _internal = Object.freeze({ CROP_SEASONALITY });
