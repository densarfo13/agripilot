/**
 * Economics Signal — simple cost/labor/market signals per crop stage.
 *
 * NOT a finance dashboard. Simple farmer-readable signals only (spec §6).
 * Outputs: cost level, labor level, market potential, optional task-level tip.
 *
 * All text uses translation keys.
 */

/**
 * Stage-level economics profiles.
 * These are generalizations — good enough for guidance, not accounting.
 */
const STAGE_ECONOMICS = {
  planning: {
    costLevel: 'low',
    laborLevel: 'low',
    marketPotential: null,
    tipKey: 'economics.tip.planAhead',
  },
  land_preparation: {
    costLevel: 'medium',
    laborLevel: 'high',
    marketPotential: null,
    tipKey: 'economics.tip.clearingInvestment',
  },
  planting: {
    costLevel: 'high',
    laborLevel: 'high',
    marketPotential: null,
    tipKey: 'economics.tip.seedInvestment',
  },
  germination: {
    costLevel: 'low',
    laborLevel: 'low',
    marketPotential: null,
    tipKey: null,
  },
  vegetative: {
    costLevel: 'medium',
    laborLevel: 'medium',
    marketPotential: null,
    tipKey: 'economics.tip.fertilizeForYield',
  },
  flowering: {
    costLevel: 'medium',
    laborLevel: 'medium',
    marketPotential: null,
    tipKey: 'economics.tip.protectForQuality',
  },
  fruiting: {
    costLevel: 'low',
    laborLevel: 'medium',
    marketPotential: 'moderate',
    tipKey: 'economics.tip.nearHarvest',
  },
  harvest: {
    costLevel: 'medium',
    laborLevel: 'high',
    marketPotential: 'good',
    tipKey: 'economics.tip.harvestCarefully',
  },
  post_harvest: {
    costLevel: 'low',
    laborLevel: 'medium',
    marketPotential: 'good',
    tipKey: 'economics.tip.dryAndStoreWell',
  },
};

/**
 * Task-level economic tips — maps task keywords to economic context.
 * Only shown when it adds decision value.
 */
const TASK_ECONOMICS = [
  { pattern: /clear|weed|prep/i,  tipKey: 'economics.task.clearReducesLoss' },
  { pattern: /dry/i,              tipKey: 'economics.task.dryProtectsQuality' },
  { pattern: /harvest|pick/i,     tipKey: 'economics.task.harvestTracksProfit' },
  { pattern: /store|storage/i,    tipKey: 'economics.task.storeReducesWaste' },
  { pattern: /spray|pest/i,       tipKey: 'economics.task.protectInvestment' },
  { pattern: /fertil/i,           tipKey: 'economics.task.nutrientsBoostYield' },
  { pattern: /plant|sow/i,        tipKey: 'economics.task.qualitySeedMatters' },
  { pattern: /sort|grade/i,       tipKey: 'economics.task.sortingRaisesPrice' },
];

/**
 * Get economics signal for a crop stage.
 *
 * @param {string} cropStage - Current crop stage
 * @returns {Object|null} Economics signal or null if no data
 */
export function getStageEconomics(cropStage) {
  const econ = STAGE_ECONOMICS[cropStage];
  if (!econ) return null;

  return {
    costLevel: econ.costLevel,
    laborLevel: econ.laborLevel,
    marketPotential: econ.marketPotential,
    tipKey: econ.tipKey,
    costLevelKey: `economics.cost.${econ.costLevel}`,
    laborLevelKey: `economics.labor.${econ.laborLevel}`,
    marketPotentialKey: econ.marketPotential ? `economics.market.${econ.marketPotential}` : null,
  };
}

/**
 * Get an economic tip for a specific task (if one adds value).
 *
 * @param {string} taskTitle - Task title
 * @param {string} actionType - Task action type
 * @returns {string|null} Translation key or null
 */
export function getTaskEconomicTip(taskTitle, actionType) {
  const haystack = `${taskTitle || ''} ${actionType || ''}`;
  for (const { pattern, tipKey } of TASK_ECONOMICS) {
    if (pattern.test(haystack)) return tipKey;
  }
  return null;
}
