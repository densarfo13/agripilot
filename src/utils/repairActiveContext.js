/**
 * repairActiveContext.js — single boot-time entry that runs
 * the migration + every existing repair pass in the right
 * order.
 *
 *   import { repairActiveContext } from '.../utils/repairActiveContext.js';
 *   const actions = await repairActiveContext();
 *
 * Order (final architecture spec §14)
 *   1. migrateLegacyFarms()      — write the new dual stores
 *                                   from the legacy partition
 *                                   (idempotent, sentinel-guarded)
 *   2. repairExperience()        — repair active pin / pointer
 *                                   per the existing rules
 *   3. repairLandSizeBase()      — backfill sqft base unit + flip
 *                                   the >10k-acres heuristic
 *
 * Each step is self-bailing on the explicit-logout flag so
 * the whole chain becomes a no-op after Logout.
 *
 * Strict-rule audit
 *   * Never throws — each step is wrapped in its own try/catch.
 *   * Returns a flat list of action tags from every step so
 *     AuthContext.bootstrap can log a single line.
 *   * Idempotent — re-running on a healthy state is a no-op
 *     for every step.
 */

export async function repairActiveContext() {
  const actions = [];

  // 1. Migration — runs once, sentinel-guarded.
  try {
    const m = await import('./migrateLegacyFarms.js');
    const a = (m.migrateLegacyFarms || (() => []))();
    if (Array.isArray(a)) actions.push(...a.map((x) => `migrate:${x}`));
  } catch (err) {
    actions.push(`migrate:error:${err && err.message}`);
  }

  // 2. Experience repair — pointer + active-id heuristics.
  try {
    const m = await import('./repairExperience.js');
    const a = (m.repairExperience || (() => []))();
    if (Array.isArray(a)) actions.push(...a.map((x) => `experience:${x}`));
  } catch (err) {
    actions.push(`experience:error:${err && err.message}`);
  }

  // 3. Land-size base-unit repair.
  try {
    const m = await import('../lib/units/landSizeBase.js');
    const a = (m.repairLandSizeBase || (() => []))();
    if (Array.isArray(a)) actions.push(...a.map((x) => `landsize:${x}`));
  } catch (err) {
    actions.push(`landsize:error:${err && err.message}`);
  }

  return actions;
}

export default repairActiveContext;
