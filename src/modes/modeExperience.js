/**
 * modeExperience.js — single source of truth for the Farm vs Garden
 * emotional-experience split.
 *
 *   import { getModeExperience } from '../modes/modeExperience.js';
 *   const xp = getModeExperience('garden');
 *   // → { label, emotionalGoal, navItems, theme, priorities,
 *   //     tone, emptyStateStyle, primaryActions, taskVocabulary, ... }
 *
 * Why this exists when the surfaces already render correctly:
 *   The mode-specific contracts (nav items, theme tokens, task
 *   vocabulary, empty-state copy keys, scan placement) had been
 *   inlined across BottomTabNav, MyFarmPage, contextEngine,
 *   Home, the i18n overlays, and the theme CSS. The behaviour
 *   was right — the configuration was scattered. This module
 *   collects it into a single immutable record per mode so:
 *     • New surfaces opt in with one import (no scavenger hunt).
 *     • A future audit answers "what changes between modes?" in 30s.
 *     • Tests can assert mode behavior against a single shape.
 *
 * It does NOT replace the working code that already consumes these
 * values (BottomTabNav still owns FARMER_TABS / GARDEN_TABS;
 * contextEngine still owns _farmTask / _gardenTask). That code is
 * stable and any refactor would be risk without reward. Instead,
 * this module mirrors those contracts so future work has one place
 * to look.
 *
 * Strict-rule audit
 *   • Pure module — no React, no hooks, no I/O.
 *   • Outputs are frozen — callers cannot corrupt the registry.
 *   • Never throws — getModeExperience('xxx') falls back to FARM.
 *   • All visible strings are i18n keys + English fallbacks; the
 *     UI consumes via tSafe so missing-locale falls through to en.
 */

// ─── Mode experience records (frozen) ────────────────────────────

/**
 * @typedef {object} ModeExperience
 * @property {'farm'|'garden'} mode
 * @property {string}   label              i18n key for the mode label
 * @property {string}   labelFallback      English fallback for label
 * @property {string}   emotionalGoal      i18n key for "I know what matters today" / "My plants are doing better…"
 * @property {string}   emotionalGoalFallback English fallback
 * @property {string}   userLabel          i18n key for "Farmer" / "Gardener" greeting
 * @property {string}   userLabelFallback  English fallback for userLabel
 * @property {string}   themeClass         CSS class on the page shell
 * @property {string[]} navItems           tab keys, in display order
 * @property {string[]} priorities         signal weights — first = highest
 * @property {string}   tone               'operational' | 'caring'
 * @property {string[]} primaryActions     primary CTA categories
 * @property {string}   scanPlacement      'contextual-card' | 'bottom-nav'
 * @property {object}   taskVocabulary     { crop, field, task, … } i18n key map
 * @property {object}   emptyStates        { noProduce, noPlant, noProgress, noScan } key map
 * @property {object}   homeOrder          ordered list of Home sections
 * @property {boolean}  showSell
 * @property {boolean}  showFunding
 * @property {boolean}  showPlantCompanion
 */

const FARM = Object.freeze({
  mode: 'farm',

  label:                 'mode.farm.label',
  labelFallback:         'Farm',
  emotionalGoal:         'mode.farm.emotionalGoal',
  emotionalGoalFallback: 'I know what matters today.',
  userLabel:             'mode.farm.userLabel',
  userLabelFallback:     'Farmer',

  themeClass: 'ff-theme-farm',

  // Mirror of FARMER_TABS in src/components/farmer/BottomTabNav.jsx —
  // 6 tabs in the displayed order. BottomTabNav remains the
  // authoritative source for routing (paths / icons); this list is
  // the contract surface.
  navItems: Object.freeze([
    'home', 'farm', 'tasks', 'progress', 'funding', 'sell',
  ]),

  // Signal priorities consumed by the scoring engine. Order is
  // semantic — earlier signals dominate when scores tie.
  priorities: Object.freeze([
    'weather_risk',
    'crop_stage',
    'field_task',
    'harvest_readiness',
    'funding',
    'sell',
    'buyer_readiness',
  ]),

  tone: 'operational',

  primaryActions: Object.freeze([
    'mark_task_done',
    'view_buyers_at_harvest',
    'check_field_drainage_at_rain',
  ]),

  // Spec §6 — Farm Mode keeps Scan as a contextual card on My Farm,
  // never as a bottom-nav tab.
  scanPlacement: 'contextual-card',

  // Mirror of contextEngine task wording — the Farm chain leans
  // into operational vocab: crop / field / drainage / harvest /
  // buyers / funding / listing / yield.
  taskVocabulary: Object.freeze({
    subject:        'task.vocab.farm.crop',          // "crop"
    subjectFallback: 'crop',
    location:       'task.vocab.farm.field',         // "field"
    locationFallback: 'field',
    activity:       'task.vocab.farm.task',          // "task"
    activityFallback: 'task',
    irrigation:     'task.vocab.farm.drainage',      // "drainage"
    irrigationFallback: 'drainage',
    market:         'task.vocab.farm.buyers',        // "buyers"
    marketFallback: 'buyers',
    capital:        'task.vocab.farm.funding',
    capitalFallback: 'funding',
    listing:        'task.vocab.farm.listing',
    listingFallback: 'listing',
    output:         'task.vocab.farm.yield',
    outputFallback: 'yield',
  }),

  // Spec §7 — calm, actionable empty-state copy keys. Matches
  // gardenModeTranslations + plantCompanionTranslations (already
  // shipped); listed here so callers don't hand-pick keys.
  emptyStates: Object.freeze({
    noProduce:  'farm.empty.noProduce',     // "No produce listed yet…"
    noProgress: 'farm.empty.noProgress',
    noScan:     'farm.empty.noScan',
  }),
  emptyStateStyle: 'operational',

  // Spec §4 — Home section order. Mirrors Home's render
  // structure when ctxIntel.mode === 'farm'.
  homeOrder: Object.freeze([
    'morning_briefing',
    'weather_hero',
    'today_field_task',
    'progress',
    'funding_secondary',
    'sell_at_harvest',
  ]),

  showSell:           true,
  showFunding:        true,
  showPlantCompanion: false,
});

const GARDEN = Object.freeze({
  mode: 'garden',

  label:                 'mode.garden.label',
  labelFallback:         'Garden',
  emotionalGoal:         'mode.garden.emotionalGoal',
  emotionalGoalFallback: 'My plants are doing better because of this app.',
  userLabel:             'gardenMode.userLabel',
  userLabelFallback:     'Gardener',

  themeClass: 'ff-theme-garden',

  // Mirror of GARDEN_TABS in BottomTabNav — 5 tabs. Funding +
  // Sell are intentionally absent (spec §3, §6).
  navItems: Object.freeze([
    'home', 'grow', 'tasks', 'progress', 'scan',
  ]),

  priorities: Object.freeze([
    'watering',
    'sunlight',
    'plant_health',
    'scan',
    'container_care',
    'growth_memory',
    'reassurance',
  ]),

  tone: 'caring',

  primaryActions: Object.freeze([
    'check_plant',
    'scan_leaves',
    'mark_care_task_done',
    'edit_plant_identity',
  ]),

  // Spec §6 — Garden Mode promotes Scan to a bottom-nav tab.
  scanPlacement: 'bottom-nav',

  // Garden vocab leans into plant-care language: plant / pot /
  // container / leaves / watering / sunlight / care / growth.
  taskVocabulary: Object.freeze({
    subject:        'task.vocab.garden.plant',
    subjectFallback: 'plant',
    location:       'task.vocab.garden.pot',
    locationFallback: 'pot',
    activity:       'task.vocab.garden.care',
    activityFallback: 'care',
    irrigation:     'task.vocab.garden.watering',
    irrigationFallback: 'watering',
    market:         'task.vocab.garden.share',          // garden has no buyers; share is the equivalent surface
    marketFallback: 'share',
    capital:        'task.vocab.garden.tools',
    capitalFallback: 'tools',
    listing:        'task.vocab.garden.note',
    listingFallback: 'note',
    output:         'task.vocab.garden.growth',
    outputFallback: 'growth',
  }),

  emptyStates: Object.freeze({
    noPlant:    'gardenMode.empty.noPlant',
    noProgress: 'gardenMode.empty.noProgress',
    noScan:     'gardenMode.empty.noScan',
    noWeather:  'gardenMode.empty.noWeather',
  }),
  emptyStateStyle: 'caring',

  // Spec §4 — Garden Home section order.
  homeOrder: Object.freeze([
    'plant_companion_card',
    'garden_morning_briefing',
    'today_care_task',
    'scan_plant_action',
    'growth_timeline_snapshot',
    'reassurance_note',
  ]),

  showSell:           false,   // hidden in garden (spec §3)
  showFunding:        false,   // hidden in garden (spec §3)
  showPlantCompanion: true,
});

const REGISTRY = Object.freeze({ farm: FARM, garden: GARDEN });

// ─── Public API ──────────────────────────────────────────────────

/**
 * getModeExperience(mode) → ModeExperience
 *
 * @param {'farm'|'garden'|string|null|undefined} mode
 *   Anything else falls back to FARM (the canonical default and
 *   the spec's "Default: farmer" rule).
 */
export function getModeExperience(mode) {
  if (mode === 'garden' || (typeof mode === 'string' && mode.toLowerCase() === 'garden')) {
    return GARDEN;
  }
  return FARM;
}

/**
 * isGardenMode(mode) — quick boolean check.
 */
export function isGardenMode(mode) {
  return getModeExperience(mode).mode === 'garden';
}

/**
 * compareModes() → diff summary { only_in_farm, only_in_garden, both }
 *
 * Useful for tests / docs — auto-derives the spec's "what's
 * different between modes?" matrix from the records above.
 */
export function compareModes() {
  const farmKeys   = new Set(FARM.priorities);
  const gardenKeys = new Set(GARDEN.priorities);
  return Object.freeze({
    onlyInFarm:    Object.freeze([...farmKeys].filter((k) => !gardenKeys.has(k))),
    onlyInGarden:  Object.freeze([...gardenKeys].filter((k) => !farmKeys.has(k))),
    both:          Object.freeze([...farmKeys].filter((k) => gardenKeys.has(k))),
    farmShowsSell:        FARM.showSell,
    gardenShowsSell:      GARDEN.showSell,
    farmShowsFunding:     FARM.showFunding,
    gardenShowsFunding:   GARDEN.showFunding,
    farmScanPlacement:    FARM.scanPlacement,
    gardenScanPlacement:  GARDEN.scanPlacement,
  });
}

// ─── Test surface ────────────────────────────────────────────────
export const MODE_EXPERIENCES = REGISTRY;
export { FARM, GARDEN };
export default getModeExperience;
