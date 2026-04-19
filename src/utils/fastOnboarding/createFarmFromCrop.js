/**
 * createFarmFromCrop.js — auto-creates a minimal farm from a
 * crop selection. NO user input required for farm size, soil,
 * or irrigation — the fast track deliberately defers those
 * decisions until the farmer has already seen their first task.
 *
 *   createFarmFromCrop(crop, ctx) → Farm
 *
 * Farm shape (intentionally small):
 *   {
 *     id,              — stable per (userId, crop, startDate)
 *     userId,
 *     crop,            — canonical crop id
 *     stage,           — always 'land_prep' at creation
 *     startDate,       — timestamp (ms)
 *     countryCode,
 *     locationSource,  — 'detect' | 'manual' | 'skipped' | null
 *     tasks,           — seeded via generateInitialTasks
 *     created,         — true (flag for persistence checks)
 *     createdVia,      — 'fast_onboarding'
 *   }
 *
 * This is intentionally a plain object — no class, no
 * mutation — so it serializes cleanly to localStorage and
 * round-trips through the analytics pipeline.
 */

import { generateInitialTasks } from './generateInitialTasks.js';

export function createFarmFromCrop(crop, ctx = {}) {
  if (!crop || typeof crop !== 'string') {
    throw new Error('createFarmFromCrop: crop id string required');
  }
  const now = Number.isFinite(ctx.now) ? ctx.now : Date.now();
  const userId = ctx.userId ? String(ctx.userId) : 'anon';
  const cropLower = crop.toLowerCase();

  return Object.freeze({
    id: `farm_${userId}_${cropLower}_${now.toString(36)}`,
    userId: ctx.userId || null,
    crop: cropLower,
    stage: 'land_prep',
    startDate: now,
    countryCode: ctx.countryCode || null,
    stateCode:   ctx.stateCode   || null,
    locationSource: ctx.locationSource || null,
    tasks: generateInitialTasks(cropLower, 'land_prep', { now }),
    created: true,
    createdVia: 'fast_onboarding',
  });
}
