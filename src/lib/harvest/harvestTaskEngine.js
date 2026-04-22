/**
 * harvestTaskEngine.js — emits harvest-specific task templates,
 * farmType-aware, ready to drop into the daily task pool.
 *
 *   getHarvestTasks({ farmType, harvestState }) → Template[]
 *
 * The templates match the shape expected by taskTemplates.js:
 *   { id, type, priority, title, description, why }
 *
 * Rules
 *   • Only emits anything when harvestState.cycleState is
 *     'harvest_ready' (not yet completed, not merely approaching —
 *     approaching gets handled via the notification-engine
 *     stage_transition card).
 *   • Wording adapts to farmType (backyard vs small_farm vs
 *     commercial). Backyard copy is shorter and softer; commercial
 *     copy is more operational.
 *   • Every task carries a short WHY line, matching the existing
 *     task library's contract.
 */

function canonicalFarmType(t) {
  const s = String(t || 'small_farm').toLowerCase().trim();
  if (s === 'backyard' || s === 'home' || s === 'home_food') return 'backyard';
  if (s === 'commercial' || s === 'large' || s === 'enterprise') return 'commercial';
  return 'small_farm';
}

const freeze = Object.freeze;

// ─── Template banks ──────────────────────────────────────────────
const BACKYARD = freeze([
  freeze({
    id: 'harvest.check_ready',
    type: 'harvest',
    priority: 'high',
    title: 'Check if your crop is ready',
    description: 'Pick one or two samples and see how they look and feel.',
    why: 'Picking at the right time gives the best taste and keeps the rest fresh longer.',
  }),
  freeze({
    id: 'harvest.gather_basics',
    type: 'harvest',
    priority: 'medium',
    title: 'Gather a basket and a clean cloth',
    description: 'Line a basket or bag so the harvest stays clean and undamaged.',
    why: 'Clean, soft containers mean less bruising and longer storage.',
  }),
  freeze({
    id: 'harvest.record_amount',
    type: 'harvest',
    priority: 'medium',
    title: 'Write down what you harvested',
    description: 'Note the amount so you know how this season went.',
    why: 'A simple number now makes next season\u2019s plan much smarter.',
  }),
]);

const SMALL_FARM = freeze([
  freeze({
    id: 'harvest.inspect_maturity',
    type: 'harvest',
    priority: 'high',
    title: 'Inspect crop maturity',
    description: 'Walk the rows and sample a few plants for maturity signs (colour, firmness, dryness).',
    why: 'Harvest at peak maturity locks in quality and price.',
  }),
  freeze({
    id: 'harvest.prepare_tools',
    type: 'harvest',
    priority: 'medium',
    title: 'Prepare harvest tools and containers',
    description: 'Clean baskets, bags, and cutting tools; stack them near the field.',
    why: 'Ready tools cut harvest time and reduce crop left in the sun.',
  }),
  freeze({
    id: 'harvest.clean_storage',
    type: 'harvest',
    priority: 'medium',
    title: 'Clean and prepare storage',
    description: 'Sweep out the store, check for pests, and line shelves or bags.',
    why: 'Clean storage is the #1 defence against post-harvest loss.',
  }),
  freeze({
    id: 'harvest.sort_healthy',
    type: 'harvest',
    priority: 'low',
    title: 'Sort healthy produce from damaged',
    description: 'Separate good quality from damaged or undersized produce before storing.',
    why: 'Sorting up front keeps one bad unit from spoiling the rest.',
  }),
  freeze({
    id: 'harvest.record_amount',
    type: 'harvest',
    priority: 'medium',
    title: 'Record the harvest amount',
    description: 'Note the total bags / kg harvested today.',
    why: 'Recording builds a real year-on-year picture of the farm.',
  }),
]);

const COMMERCIAL = freeze([
  freeze({
    id: 'harvest.field_assess',
    type: 'harvest',
    priority: 'high',
    title: 'Assess field-level maturity + yield',
    description: 'Sample across blocks; confirm maturity + expected bag count before crews mobilise.',
    why: 'A field-level read prevents a mis-timed harvest across a large operation.',
  }),
  freeze({
    id: 'harvest.mobilise_crew',
    type: 'harvest',
    priority: 'high',
    title: 'Mobilise harvest crew + logistics',
    description: 'Confirm team, transport and weigh-station availability for the next 48 hours.',
    why: 'Logistics drive harvest-day cost; confirming now avoids idle crops + trucks.',
  }),
  freeze({
    id: 'harvest.line_up_buyer',
    type: 'harvest',
    priority: 'medium',
    title: 'Confirm buyer + pickup window',
    description: 'Re-confirm price, grade requirements, and pickup schedule with each buyer.',
    why: 'Locked offtake turns a successful harvest into paid product.',
  }),
  freeze({
    id: 'harvest.storage_audit',
    type: 'harvest',
    priority: 'medium',
    title: 'Audit storage capacity + cleanliness',
    description: 'Clean + measure available space; flag any block that needs fumigation or repair.',
    why: 'Clean, measured storage prevents post-harvest loss at scale.',
  }),
  freeze({
    id: 'harvest.record_amount',
    type: 'harvest',
    priority: 'medium',
    title: 'Record total harvested + grade',
    description: 'Log weigh-station totals and any grade sorts at shift end.',
    why: 'Daily records feed the yield analysis for the next cycle.',
  }),
]);

const BANK_BY_TIER = freeze({
  backyard:   BACKYARD,
  small_farm: SMALL_FARM,
  commercial: COMMERCIAL,
});

export function getHarvestTasks({ farmType = 'small_farm', harvestState = null } = {}) {
  if (!harvestState || harvestState.cycleState !== 'harvest_ready') return [];
  const tier = canonicalFarmType(farmType);
  return BANK_BY_TIER[tier] || SMALL_FARM;
}

export const _internal = freeze({ BACKYARD, SMALL_FARM, COMMERCIAL, BANK_BY_TIER });
