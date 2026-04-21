/**
 * farmTypeBehavior.js — farm-type-aware adjustments for the task
 * engine, notification layer, and any other surface that should
 * scale detail to the farmer's operation.
 *
 * Three tiers:
 *   backyard   — home/backyard plot. Simpler tasks, fewer alerts,
 *                plain language. A weekend gardener shouldn't be
 *                bombarded with commercial-grade reminders.
 *   small_farm — default. Standard task + alert cadence.
 *   commercial — full detail. Every task surfaces, alerts carry
 *                stronger wording, and the recommendation layer
 *                can emit more granular next steps.
 *
 * All helpers are pure + frozen outputs. Call sites opt in — pass
 * the farmType you have, get a policy object back, apply.
 *
 *   normalizeFarmType(raw)                  → canonical tier string
 *   getFarmTypePolicy(farmType)             → policy object
 *   adjustTasksForFarmType({ tasks, farmType })
 *   shouldShowAlertForFarmType(alert, farmType)
 */

export const FARM_TYPES = Object.freeze(['backyard', 'small_farm', 'commercial']);
const VALID = new Set(FARM_TYPES);

/** Fallback per spec §4. */
export const DEFAULT_FARM_TYPE = 'small_farm';

/**
 * Canonicalise whatever the caller has into one of the three tiers.
 * Accepts historical values like 'home_food' → backyard and any
 * unknown/missing string → default tier.
 */
export function normalizeFarmType(raw) {
  if (!raw) return DEFAULT_FARM_TYPE;
  const s = String(raw).toLowerCase().trim();
  if (VALID.has(s)) return s;
  // Historical aliases used by the existing onboarding config.
  if (s === 'home_food' || s === 'backyard_home' || s === 'home')       return 'backyard';
  if (s === 'sell_locally' || s === 'mixed')                            return 'small_farm';
  if (s === 'commercial_farm' || s === 'large' || s === 'enterprise')   return 'commercial';
  return DEFAULT_FARM_TYPE;
}

/**
 * Per-tier policy object. This is the contract call sites consume.
 * The values are deliberately explicit so new behaviours can be
 * added without touching the call sites.
 */
const POLICIES = Object.freeze({
  backyard: Object.freeze({
    tier: 'backyard',
    maxDailyTasks:       2,
    maxSecondaryTasks:   1,
    allowAlerts:         Object.freeze(['high', 'critical']),
    recommendationDepth: 'basic',      // short copy, no deep agronomy
    copyRegister:        'plain',      // translate jargon away
    dropTaskIds: new Set([
      // Commercial-only maintenance tasks we can safely skip.
      'mid.manage_fertilizer_program',
      'mid.calibrate_sprayer',
      'pre_planting.soil_test_detailed',
    ]),
  }),
  small_farm: Object.freeze({
    tier: 'small_farm',
    maxDailyTasks:       3,
    maxSecondaryTasks:   2,
    allowAlerts:         Object.freeze(['medium', 'high', 'critical']),
    recommendationDepth: 'standard',
    copyRegister:        'standard',
    dropTaskIds: new Set(),
  }),
  commercial: Object.freeze({
    tier: 'commercial',
    maxDailyTasks:       6,
    maxSecondaryTasks:   4,
    allowAlerts:         Object.freeze(['low', 'medium', 'high', 'critical']),
    recommendationDepth: 'detailed',
    copyRegister:        'technical',
    dropTaskIds: new Set(),
  }),
});

export function getFarmTypePolicy(farmType) {
  return POLICIES[normalizeFarmType(farmType)] || POLICIES[DEFAULT_FARM_TYPE];
}

/**
 * adjustTasksForFarmType — trim a generated task list to the tier's
 * limits + drop commercial-only tasks for backyard. Keeps task
 * order intact.
 *
 *   tasks: [{ id, priority?, dueHint? }]
 *   returns the same shape, filtered + truncated.
 */
export function adjustTasksForFarmType({ tasks = [], farmType = DEFAULT_FARM_TYPE } = {}) {
  if (!Array.isArray(tasks)) return [];
  const policy = getFarmTypePolicy(farmType);
  const filtered = tasks.filter((t) => {
    if (!t || !t.id) return false;
    if (policy.dropTaskIds.has(String(t.id))) return false;
    return true;
  });
  return filtered.slice(0, policy.maxDailyTasks);
}

/**
 * shouldShowAlertForFarmType — gate the reminder / banner layer.
 * Accepts either `severity` as a string OR the raw alert object
 * (spec-aligned `severity`/`level` keys).
 */
export function shouldShowAlertForFarmType(alert, farmType) {
  if (!alert) return false;
  const sev = String(
    alert.severity || alert.level || (typeof alert === 'string' ? alert : ''),
  ).toLowerCase();
  const policy = getFarmTypePolicy(farmType);
  return policy.allowAlerts.includes(sev);
}

/**
 * simplifyCopyForFarmType — when backyard mode is on, swap the
 * provided rich copy for the plainer version (if caller supplied
 * one). Safe for any call site: rich copy wins when `plain` isn't
 * passed.
 */
export function simplifyCopyForFarmType({ rich, plain }, farmType) {
  const policy = getFarmTypePolicy(farmType);
  if (policy.copyRegister === 'plain' && plain) return plain;
  return rich;
}

export const _internal = Object.freeze({
  POLICIES, VALID, DEFAULT_FARM_TYPE,
});
