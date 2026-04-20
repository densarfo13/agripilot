/**
 * plantingCalendar.js — v1 rules-based planting calendar.
 *
 * Shape:
 *   CALENDAR[country][crop] = {
 *     windows: [[startMonth, endMonth], ...]    // months are 1..12
 *   }
 *
 *   CALENDAR_STATES[country][stateCode][crop] = { windows: [...] }
 *
 * Rules:
 *   • Months are inclusive and can wrap (e.g. [11, 2] = Nov..Feb).
 *   • Multiple windows per crop (kharif + rabi, major + minor, etc).
 *   • When a state has no override, country defaults are used.
 *   • Unsupported country → the caller gets 'unknown' and v1 UI
 *     falls back to a safe generic message (spec §3).
 *
 * Stays in sync with src/config/cropRecommendationRules.js so the
 * two layers agree on which crops are worth calendaring.
 */

const freeze = Object.freeze;

// ─── United States ────────────────────────────────────────────────
const US = freeze({
  maize:     freeze({ windows: freeze([[4, 6]]) }),             // Apr–Jun
  soybean:   freeze({ windows: freeze([[5, 6]]) }),             // May–Jun
  wheat:     freeze({ windows: freeze([[9, 10], [3, 4]]) }),    // winter + spring
  tomato:    freeze({ windows: freeze([[4, 5]]) }),             // Apr–May
  beans:     freeze({ windows: freeze([[5, 6]]) }),             // May–Jun
  cotton:    freeze({ windows: freeze([[3, 5]]) }),             // Mar–May
  sorghum:   freeze({ windows: freeze([[3, 5]]) }),             // Mar–May
  sunflower: freeze({ windows: freeze([[4, 5]]) }),             // Apr–May
});

// ─── Ghana (two rainy seasons in the south) ───────────────────────
const GH = freeze({
  maize:     freeze({ windows: freeze([[3, 5], [8, 9]]) }),     // major + minor
  cassava:   freeze({ windows: freeze([[3, 6]]) }),
  yam:       freeze({ windows: freeze([[11, 12], [1, 4]]) }),
  groundnut: freeze({ windows: freeze([[4, 6]]) }),
  cocoa:     freeze({ windows: freeze([[4, 7]]) }),
  sorghum:   freeze({ windows: freeze([[5, 7]]) }),
  millet:    freeze({ windows: freeze([[5, 6]]) }),
  plantain:  freeze({ windows: freeze([[4, 6]]) }),
  tomato:    freeze({ windows: freeze([[2, 4], [8, 10]]) }),
  okra:      freeze({ windows: freeze([[3, 6]]) }),
});

// ─── Nigeria ──────────────────────────────────────────────────────
const NG = freeze({
  maize:   freeze({ windows: freeze([[4, 6]]) }),
  cassava: freeze({ windows: freeze([[3, 6]]) }),
  yam:     freeze({ windows: freeze([[11, 12], [1, 3]]) }),
  sorghum: freeze({ windows: freeze([[6, 7]]) }),
  rice:    freeze({ windows: freeze([[5, 7]]) }),
  tomato:  freeze({ windows: freeze([[8, 11]]) }),
  okra:    freeze({ windows: freeze([[3, 6]]) }),
  cowpea:  freeze({ windows: freeze([[7, 8]]) }),
});

// ─── Kenya ────────────────────────────────────────────────────────
const KE = freeze({
  maize:   freeze({ windows: freeze([[3, 5], [10, 11]]) }),     // long + short rains
  beans:   freeze({ windows: freeze([[3, 5]]) }),
  tomato:  freeze({ windows: freeze([[2, 4], [8, 10]]) }),
  potato:  freeze({ windows: freeze([[3, 4], [9, 10]]) }),
  cassava: freeze({ windows: freeze([[3, 5]]) }),
  kale:    freeze({ windows: freeze([[1, 12]]) }),              // year-round w/ water
  tea:     freeze({ windows: freeze([[3, 5]]) }),
  coffee:  freeze({ windows: freeze([[3, 5]]) }),
});

// ─── India (kharif / rabi / zaid) ─────────────────────────────────
const IN_CAL = freeze({
  rice:      freeze({ windows: freeze([[6, 7]]) }),             // kharif
  wheat:     freeze({ windows: freeze([[10, 11]]) }),           // rabi
  cotton:    freeze({ windows: freeze([[5, 7]]) }),
  sugarcane: freeze({ windows: freeze([[2, 3], [10, 11]]) }),
  pulses:    freeze({ windows: freeze([[6, 7], [10, 11]]) }),
  soybean:   freeze({ windows: freeze([[6, 7]]) }),
});

// ─── Per-state overrides (subset — mirrors the recommender) ───────
const US_STATES = freeze({
  CA: freeze({
    tomato: freeze({ windows: freeze([[2, 4]]) }),
    maize:  freeze({ windows: freeze([[4, 5]]) }),
    wheat:  freeze({ windows: freeze([[11, 12]]) }),
  }),
  TX: freeze({
    cotton:  freeze({ windows: freeze([[3, 5]]) }),
    sorghum: freeze({ windows: freeze([[3, 5]]) }),
    maize:   freeze({ windows: freeze([[3, 4]]) }),
    wheat:   freeze({ windows: freeze([[9, 10]]) }),
  }),
  IA: freeze({
    maize:   freeze({ windows: freeze([[4, 5]]) }),
    soybean: freeze({ windows: freeze([[5, 5]]) }),
  }),
  MN: freeze({
    maize:   freeze({ windows: freeze([[4, 5]]) }),
    soybean: freeze({ windows: freeze([[5, 5]]) }),
    wheat:   freeze({ windows: freeze([[4, 4]]) }),
  }),
});

const GH_STATES = freeze({
  AS: freeze({
    cocoa:    freeze({ windows: freeze([[4, 7]]) }),
    cassava:  freeze({ windows: freeze([[3, 6]]) }),
    plantain: freeze({ windows: freeze([[4, 6]]) }),
    maize:    freeze({ windows: freeze([[3, 5], [8, 9]]) }),
  }),
  NP: freeze({
    maize:     freeze({ windows: freeze([[5, 7]]) }),
    sorghum:   freeze({ windows: freeze([[5, 7]]) }),
    millet:    freeze({ windows: freeze([[5, 6]]) }),
    groundnut: freeze({ windows: freeze([[5, 7]]) }),
    yam:       freeze({ windows: freeze([[11, 12], [1, 4]]) }),
  }),
  AA: freeze({
    cassava: freeze({ windows: freeze([[3, 5]]) }),
    maize:   freeze({ windows: freeze([[3, 5], [8, 9]]) }),
    tomato:  freeze({ windows: freeze([[2, 4], [8, 10]]) }),
    okra:    freeze({ windows: freeze([[3, 6]]) }),
  }),
});

const NG_STATES = freeze({
  KD: freeze({
    maize:   freeze({ windows: freeze([[4, 6]]) }),
    sorghum: freeze({ windows: freeze([[6, 7]]) }),
    yam:     freeze({ windows: freeze([[11, 12], [1, 3]]) }),
    cowpea:  freeze({ windows: freeze([[7, 8]]) }),
  }),
  LA: freeze({
    cassava: freeze({ windows: freeze([[3, 6]]) }),
    tomato:  freeze({ windows: freeze([[8, 11]]) }),
    maize:   freeze({ windows: freeze([[3, 5]]) }),
    okra:    freeze({ windows: freeze([[3, 6]]) }),
  }),
});

const KE_STATES = freeze({
  NRB: freeze({
    tomato: freeze({ windows: freeze([[2, 4], [8, 10]]) }),
    kale:   freeze({ windows: freeze([[1, 12]]) }),
    maize:  freeze({ windows: freeze([[3, 5]]) }),
    beans:  freeze({ windows: freeze([[3, 5]]) }),
  }),
  MUR: freeze({
    tea:    freeze({ windows: freeze([[3, 5]]) }),
    coffee: freeze({ windows: freeze([[3, 5]]) }),
    potato: freeze({ windows: freeze([[3, 4], [9, 10]]) }),
    maize:  freeze({ windows: freeze([[3, 5]]) }),
    beans:  freeze({ windows: freeze([[3, 5]]) }),
  }),
});

const IN_STATES = freeze({
  PB: freeze({
    wheat:     freeze({ windows: freeze([[10, 11]]) }),
    rice:      freeze({ windows: freeze([[6, 7]]) }),
    cotton:    freeze({ windows: freeze([[4, 5]]) }),
    sugarcane: freeze({ windows: freeze([[2, 3]]) }),
  }),
  MH: freeze({
    cotton:    freeze({ windows: freeze([[5, 7]]) }),
    sugarcane: freeze({ windows: freeze([[10, 11], [2, 3]]) }),
    soybean:   freeze({ windows: freeze([[6, 7]]) }),
    pulses:    freeze({ windows: freeze([[6, 7], [10, 11]]) }),
  }),
  TN: freeze({
    rice:      freeze({ windows: freeze([[6, 7], [10, 11], [1, 2]]) }),
    sugarcane: freeze({ windows: freeze([[12, 12], [1, 2]]) }),
    cotton:    freeze({ windows: freeze([[7, 10]]) }),
    pulses:    freeze({ windows: freeze([[6, 7], [9, 10]]) }),
  }),
});

export const CALENDAR = freeze({
  US, GH, NG, KE, IN: IN_CAL,
});

export const CALENDAR_STATES = freeze({
  US: US_STATES, GH: GH_STATES, NG: NG_STATES, KE: KE_STATES, IN: IN_STATES,
});

export const SUPPORTED_CALENDAR_COUNTRIES = freeze(Object.keys(CALENDAR));

export const _internal = freeze({ US, GH, NG, KE, IN: IN_CAL });
