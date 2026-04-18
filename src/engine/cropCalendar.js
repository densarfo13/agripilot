/**
 * Crop Calendar — month-based windows per country per crop.
 *
 * Produces the canonical lifecycle stage for a given country + crop +
 * month (1–12). Downstream, `resolveCropStage()` output feeds:
 *   - `cropTaskMap.getContextAwareTaskList` to pick the right stage tasks
 *   - `cropDefinitions` to pull the richer task library when available
 *   - `regionProfiles` to pick the region-flavoured title
 *
 * Stage window shape (months are 1-indexed; wrap-around supported):
 *   { landPreparation: [2,3], planting: [4,5], earlyGrowth: [5,6], ... }
 *
 * Stages map to the canonical storage-form used by the decision engine:
 *   landPreparation  → 'land_preparation'
 *   planting         → 'planting'
 *   earlyGrowth      → 'germination'
 *   maintain         → 'vegetative'
 *   harvest          → 'harvest'
 *   postHarvest      → 'post_harvest'
 *
 * Calendars are approximate — they exist to pick a sensible starting
 * stage when a farmer starts a new crop, and to shift wording when
 * the current month overlaps a specific stage window. They are not a
 * substitute for farmer ground truth: once the farm records a stage,
 * the calendar is an override candidate but not the source of truth.
 */

const STAGE_KEY_MAP = Object.freeze({
  landPreparation: 'land_preparation',
  planting: 'planting',
  earlyGrowth: 'germination',
  maintain: 'vegetative',
  harvest: 'harvest',
  postHarvest: 'post_harvest',
});

const STAGE_ORDER = [
  'landPreparation', 'planting', 'earlyGrowth',
  'maintain', 'harvest', 'postHarvest',
];

// ─── Starter calendars ────────────────────────────────────
// Rough month windows for the launch-footprint countries. Times of
// year are broad by design — a single mismatched week should still
// produce the right stage. Extend by appending a new country or crop.

const CROP_CALENDARS = Object.freeze({
  GH: {
    // Ghana — bimodal rains; main season Mar–Sep
    MAIZE: {
      landPreparation: [2, 3],
      planting: [3, 4, 5],
      earlyGrowth: [4, 5, 6],
      maintain: [5, 6, 7, 8],
      harvest: [8, 9, 10],
      postHarvest: [10, 11],
    },
    CASSAVA: {
      landPreparation: [2, 3, 4],
      planting: [4, 5, 6],
      earlyGrowth: [6, 7, 8],
      maintain: [7, 8, 9, 10, 11, 12, 1, 2],
      harvest: [10, 11, 12, 1, 2, 3],
      postHarvest: [11, 12, 1, 2, 3, 4],
    },
  },
  NG: {
    // Nigeria — main season Apr–Oct, broadly similar to GH
    MAIZE: {
      landPreparation: [3, 4],
      planting: [4, 5, 6],
      earlyGrowth: [5, 6, 7],
      maintain: [6, 7, 8, 9],
      harvest: [9, 10, 11],
      postHarvest: [11, 12],
    },
  },
  IN: {
    // India — Kharif (monsoon) rice + rabi/summer onion
    RICE: {
      landPreparation: [5, 6],
      planting: [6, 7],
      earlyGrowth: [7, 8],
      maintain: [8, 9, 10],
      harvest: [10, 11],
      postHarvest: [11, 12],
    },
    ONION: {
      // Rabi planting
      landPreparation: [10, 11],
      planting: [11, 12],
      earlyGrowth: [12, 1],
      maintain: [1, 2, 3],
      harvest: [3, 4, 5],
      postHarvest: [4, 5, 6],
    },
  },
  US: {
    // United States — temperate Northern Hemisphere
    MAIZE: {
      landPreparation: [3, 4],
      planting: [4, 5],
      earlyGrowth: [5, 6],
      maintain: [6, 7, 8],
      harvest: [9, 10, 11],
      postHarvest: [10, 11, 12],
    },
    TOMATO: {
      landPreparation: [3, 4],
      planting: [5, 6],
      earlyGrowth: [6, 7],
      maintain: [7, 8],
      harvest: [8, 9, 10],
      postHarvest: [9, 10],
    },
    ONION: {
      landPreparation: [2, 3],
      planting: [3, 4],
      earlyGrowth: [4, 5],
      maintain: [5, 6, 7],
      harvest: [7, 8, 9],
      postHarvest: [8, 9],
    },
  },
});

// ─── Helpers ──────────────────────────────────────────────

function currentMonth(date = new Date()) {
  return date.getMonth() + 1; // 1..12
}

function normalizeCountry(code) {
  if (!code) return null;
  const up = String(code).trim().toUpperCase();
  if (up.length === 3) return up.slice(0, 2); // ISO-3 → ISO-2 best effort
  return up;
}

function normalizeCrop(code) {
  if (!code) return null;
  return String(code).trim().toUpperCase();
}

// ─── Public API ───────────────────────────────────────────

/**
 * Return the canonical storage-form stage for (country, crop, month).
 *
 *   resolveCropStage({ country: 'GH', crop: 'MAIZE', month: 3 })
 *     → 'land_preparation'
 *
 * Fallbacks:
 *   - unknown country / crop → 'planning' (safe no-op stage)
 *   - month outside all windows → nearest upcoming stage
 *
 * @param {Object} args
 * @param {string} args.country  ISO-2 / ISO-3 / name
 * @param {string} args.crop     crop code e.g. 'MAIZE'
 * @param {number|Date} [args.month]  1–12 or a Date; defaults to today
 * @returns {string} canonical stage
 */
export function resolveCropStage({ country, crop, month } = {}) {
  const c = normalizeCountry(country);
  const cr = normalizeCrop(crop);
  if (!c || !cr) return 'planning';

  const countryCal = CROP_CALENDARS[c];
  const cropCal = countryCal?.[cr];
  if (!cropCal) return 'planning';

  const m = month instanceof Date
    ? currentMonth(month)
    : (Number.isFinite(month) ? Math.max(1, Math.min(12, Math.round(month))) : currentMonth());

  // Direct hit — first stage in canonical order that includes the month.
  for (const key of STAGE_ORDER) {
    const window = cropCal[key];
    if (Array.isArray(window) && window.includes(m)) {
      return STAGE_KEY_MAP[key];
    }
  }

  // No window hit — pick the next upcoming window forward through the year.
  // This favours "prepare for next stage" over dropping the farmer back to planning.
  for (let offset = 1; offset <= 12; offset++) {
    const probe = ((m - 1 + offset) % 12) + 1;
    for (const key of STAGE_ORDER) {
      if (cropCal[key]?.includes(probe)) {
        return STAGE_KEY_MAP[key];
      }
    }
  }

  return 'planning';
}

/**
 * Get the full raw window set for a country + crop, useful for UIs
 * that want to show a calendar or for tests.
 */
export function getCropCalendar(country, crop) {
  const c = normalizeCountry(country);
  const cr = normalizeCrop(crop);
  if (!c || !cr) return null;
  return CROP_CALENDARS[c]?.[cr] || null;
}

/**
 * List the country codes that ship a calendar. Cheap to keep in sync
 * with countryProfiles — tests assert these two layers agree.
 */
export function listCalendarCountries() {
  return Object.keys(CROP_CALENDARS);
}

export const _internal = { STAGE_KEY_MAP, STAGE_ORDER, currentMonth };
