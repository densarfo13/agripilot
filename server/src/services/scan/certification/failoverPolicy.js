/**
 * failoverPolicy.js — PROVIDER RELIABILITY auto-failover.
 *
 * Codifies the failover rules so a provider problem NEVER crashes scanning:
 *   Plant.id fails        → switch to backup (PlantNet, already in the consensus)
 *   Crop.health unavailable → continue the recommendation without it
 *   Insect.id timeout     → retry (then degrade)
 *   Mushroom unavailable  → disable mushroom (optional)
 * Pure + total. Returns an action; the caller applies it. The scan never throws.
 */
export const FAILOVER_ACTION = Object.freeze({
  USE_BACKUP: 'use_backup',
  CONTINUE_WITHOUT: 'continue_without',
  RETRY: 'retry',
  DISABLE: 'disable',
  PROCEED: 'proceed',
});

/**
 * @param {string} provider
 * @param {object} failure  — { status, httpStatus, failureReason, attempt }
 * @returns {{ action:string, backup:string|null, blocking:boolean, reason:string }}
 */
export function decideFailover(provider, failure = {}) {
  try {
    const f = failure || {};
    const failed = f.status && !['READY'].includes(f.status) && f.httpStatus !== 200;
    if (!failed) return { action: FAILOVER_ACTION.PROCEED, backup: null, blocking: false, reason: 'ok' };

    const isTimeout = /timeout/i.test(f.status || '') || /timeout/i.test(f.failureReason || '');
    const attempt = typeof f.attempt === 'number' ? f.attempt : 0;

    switch (provider) {
      case 'plant.id':
        // REQUIRED identity provider → fail over to the backup (PlantNet).
        return { action: FAILOVER_ACTION.USE_BACKUP, backup: 'plantnet', blocking: false,
          reason: 'plant.id failed → backup' };
      case 'crop.health':
        // Health is enrichment → continue the recommendation without it.
        return { action: FAILOVER_ACTION.CONTINUE_WITHOUT, backup: null, blocking: false,
          reason: 'crop.health unavailable → continue without health' };
      case 'insect.id':
        if (isTimeout && attempt < 1) return { action: FAILOVER_ACTION.RETRY, backup: null, blocking: false, reason: 'insect.id timeout → retry once' };
        return { action: FAILOVER_ACTION.CONTINUE_WITHOUT, backup: null, blocking: false, reason: 'insect.id failed → continue' };
      case 'mushroom.id':
        // Optional → disable; never blocks (and never claims edible).
        return { action: FAILOVER_ACTION.DISABLE, backup: null, blocking: false,
          reason: 'mushroom.id unavailable → disabled' };
      default:
        // Soil / weather / anything else → continue without; never blocking.
        return { action: FAILOVER_ACTION.CONTINUE_WITHOUT, backup: null, blocking: false,
          reason: provider + ' unavailable → continue without' };
    }
  } catch {
    // Hard invariant: failover logic itself never blocks a scan.
    return { action: FAILOVER_ACTION.CONTINUE_WITHOUT, backup: null, blocking: false, reason: 'failover_error_safe' };
  }
}

/** Reliability invariant: NO provider failure is ever blocking. */
export function failoverNeverBlocks() {
  for (const p of ['plant.id', 'crop.health', 'insect.id', 'mushroom.id', 'soil', 'weather', 'sentinel_hub']) {
    const d = decideFailover(p, { status: 'TIMEOUT', failureReason: 'timeout' });
    if (d.blocking) return false;
  }
  return true;
}
