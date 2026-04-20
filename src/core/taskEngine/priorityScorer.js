/**
 * priorityScorer.js — scores tasks against current context.
 *
 * Final score = base priority + weather adjustment + land
 * adjustment + freshness adjustment, clamped to [0, 200].
 *
 * Land > Weather > Calendar is enforced by magnitude:
 *   • land-blocker reroute is the biggest single jump (+80)
 *   • weather reroute is smaller (+25 / -20)
 *   • stage/calendar alignment is the smallest (+5)
 *
 * The function is PURE — no React, no mutation of inputs.
 */

import { FLAG, STAGE } from './stageTaskMap.js';

const CLAMP_MIN = 0;
const CLAMP_MAX = 200;

/** Clamp helper. */
function clamp(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(CLAMP_MAX, Math.max(CLAMP_MIN, n));
}

/**
 * weatherAdjustment — returns a delta (positive or negative)
 * based on whether a weather-sensitive task aligns with the
 * current forecast.
 */
function weatherAdjustment(task, weather) {
  if (!task || !weather) return 0;
  const flags = task.flags || [];
  if (!flags.includes(FLAG.WEATHER_SENSITIVE) && !flags.includes(FLAG.PROTECTIVE)) {
    return 0;
  }
  const rainSoon   = !!weather.rainExpectedSoon;
  const heavyRain  = !!weather.heavyRainExpected;
  const dry        = !!weather.dry;
  const tempHigh   = !!weather.tempHigh;

  switch (task.code) {
    case 'check_drainage':
      // Rain-soon is the "Prepare drainage now" trigger per spec
      // §1 example — boost enough to clearly outrank general prep.
      if (heavyRain) return +55;
      if (rainSoon)  return +45;
      return 0;
    case 'protect_harvest_if_rain':
      return heavyRain ? +40 : rainSoon ? +25 : 0;
    case 'plant_crop':
      // Good when soil is right (caller handles wet-soil block
      // via land adjustment). Rain soon = mild boost.
      if (heavyRain) return -20;
      if (rainSoon) return +10;
      return 0;
    case 'verify_soil_ready':
      // Always relevant during planting when rain is in play.
      return (rainSoon || heavyRain) ? +20 : 0;
    case 'apply_fertilizer_if_due':
      // Don't fertilize when heavy rain expected — it washes.
      return heavyRain ? -25 : 0;
    case 'monitor_moisture':
      if (tempHigh && dry) return +20;
      if (tempHigh) return +10;
      return 0;
    default:
      if (heavyRain && flags.includes(FLAG.PROTECTIVE)) return +20;
      return 0;
  }
}

/**
 * landAdjustment — Land > Weather > Calendar rule. Blockers
 * reroute the user to land-prep tasks even during planting /
 * later stages.
 */
function landAdjustment(task, landProfile, currentStage) {
  if (!task || !landProfile) return 0;
  const landCleared = !!landProfile.landCleared;
  const wetSoil     = !!landProfile.wetSoil;
  const poorDrain   = !!landProfile.poorDrainage;

  // If land isn't cleared and we're at or past planting, clear_land
  // becomes a hard blocker — pull it to the top, push planting down.
  if (!landCleared && currentStage !== STAGE.LAND_PREP) {
    if (task.code === 'clear_land')  return +80;
    if (task.code === 'plant_crop')  return -60;
  }

  // Wet soil blocks planting. verify_soil_ready rises; plant_crop falls.
  if (wetSoil) {
    if (task.code === 'verify_soil_ready') return +30;
    if (task.code === 'plant_crop')         return -40;
  }

  // Poor drainage + PROTECTIVE class task → bump (drainage becomes
  // even more important than weather alone suggests).
  if (poorDrain && (task.flags || []).includes(FLAG.PROTECTIVE)) {
    return +20;
  }

  return 0;
}

/**
 * freshnessAdjustment — stale/very-stale data softens priority
 * a bit so we don't make strong claims on old info.
 */
function freshnessAdjustment(_task, freshness) {
  if (!freshness) return 0;
  switch (freshness.state || freshness) {
    case 'very_stale': return -15;
    case 'stale':      return -7;
    default:           return 0;
  }
}

/**
 * Stage alignment — small bonus to tasks belonging to the
 * current stage; small penalty to tasks outside it.
 */
function stageAlignment(task, currentStage) {
  if (!task || !currentStage) return 0;
  if (task.stage === currentStage) return +5;
  return -5;
}

/**
 * scoreTaskPriority — the single public entry point.
 *   context: { weather?, landProfile?, currentStage?, freshness? }
 */
export function scoreTaskPriority(task, context = {}) {
  if (!task) return 0;
  const base = Number(task.priority) || 0;
  const w = weatherAdjustment(task, context.weather);
  const l = landAdjustment(task, context.landProfile, context.currentStage);
  const f = freshnessAdjustment(task, context.freshness);
  const s = stageAlignment(task, context.currentStage);
  return clamp(base + w + l + f + s);
}

/**
 * scoreAll — return a new array of tasks each with `score`
 * attached. Stable; does not mutate inputs.
 */
export function scoreAll(tasks = [], context = {}) {
  if (!Array.isArray(tasks)) return [];
  return tasks.map((t) => ({ ...t, score: scoreTaskPriority(t, context) }));
}

export const _internal = {
  weatherAdjustment, landAdjustment, freshnessAdjustment, stageAlignment,
};
