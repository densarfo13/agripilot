/**
 * mlTaskScoring.js — ML-ready scoring layer for task ranking.
 *
 *   import { scoreTaskCandidate } from './lib/mlTaskScoring.js';
 *
 *   const score = scoreTaskCandidate({
 *     task,            // candidate task envelope
 *     userType,        // 'farmer' | 'backyard'
 *     crop,            // string OR { name }
 *     cropStage,       // 'flowering' | 'harvest' | …
 *     region,          // freeform
 *     weather,         // { temp, rainChance, windSpeed, condition }
 *     userHistory,     // { completedSimilarTasksRecently,
 *                      //   missedYesterday, lowCompletionRate }
 *   });
 *
 * Architecture
 *   • Pure function — same input always returns the same score.
 *   • Bounded output — Math.max(0, Math.min(100, score)).
 *   • Never throws; treats missing fields as zero contribution.
 *   • NOT black-box ML — every adjustment is a hand-tuned rule
 *     so a regression can be diagnosed by reading the source.
 *
 * Why this lives next to (not inside) the rules engine
 *   The rules engine generates a SAFE list of candidate tasks.
 *   This scorer ranks them using the same context the engine
 *   already knows about, plus optional userHistory the rules
 *   engine doesn't read. Keeping them separate means we can
 *   swap the scorer for a real ML model later without
 *   disturbing the rules layer.
 */

export function scoreTaskCandidate(input) {
  const o = (input && typeof input === 'object') ? input : {};
  const task        = (o.task        && typeof o.task === 'object') ? o.task : {};
  const userType    = o.userType === 'farmer' ? 'farmer' : 'backyard';
  const cropStage   = o.cropStage    != null ? String(o.cropStage) : '';
  const weather     = (o.weather     && typeof o.weather === 'object') ? o.weather : {};
  const userHistory = (o.userHistory && typeof o.userHistory === 'object') ? o.userHistory : {};

  let score = 50;

  // ─── Weather risk scoring ───────────────────────────────
  const rainChance = Number(weather.rainChance ?? -1);
  const temp       = Number(weather.temp ?? NaN);
  const windSpeed  = Number(weather.windSpeed ?? NaN);

  if (task.category === 'watering' && rainChance >= 0 && rainChance <= 25) score += 20;
  if (task.category === 'weather'  && rainChance >= 60)                    score += 25;
  if (task.category === 'heat'     && Number.isFinite(temp)      && temp      >= 32) score += 30;
  if (task.category === 'wind'     && Number.isFinite(windSpeed) && windSpeed >= 25) score += 20;

  // ─── Crop stage scoring ─────────────────────────────────
  const stage = String(cropStage || '').toLowerCase();
  if (stage.includes('flower')     && task.category === 'flowering')   score += 25;
  if (stage.includes('harvest')    && task.category === 'harvest')     score += 25;
  if (stage.includes('vegetative') && task.category === 'weeding')     score += 15;
  if (stage.includes('seed')       && task.category === 'germination') score += 20;

  // ─── Crop-specific scoring ──────────────────────────────
  const cropName = String(
    (o.crop && typeof o.crop === 'object' && o.crop.name)
      ? o.crop.name
      : (o.crop || '')
  ).toLowerCase();

  if (cropName.includes('tomato') && task.category === 'pest-check')   score += 20;
  if (cropName.includes('okra')   && task.category === 'pest-check')   score += 15;
  if (cropName.includes('rice')   && task.category === 'water-level')  score += 25;
  if ((cropName.includes('maize') || cropName.includes('corn'))
      && task.category === 'watering')                                  score += 15;

  // ─── User behaviour scoring ─────────────────────────────
  if (userHistory.completedSimilarTasksRecently) score -= 10;
  if (userHistory.missedYesterday)               score += 10;
  if (userHistory.lowCompletionRate)             score -= 5;
  // Quick wins (≤ 5 minutes) get a small boost so a busy user
  // sees actionable copy at the top of the list.
  if (typeof task.time === 'string') {
    const mins = parseInt(task.time, 10);
    if (Number.isFinite(mins) && mins <= 5) score += 10;
  }

  // ─── User-type scoring ──────────────────────────────────
  if (userType === 'backyard') {
    if (['watering', 'plant-health', 'pest-check'].includes(task.category)) score += 10;
    // Spec rule: backyard users should NEVER see profitability /
    // market tasks ranked highly. The legacy "Start logging farm
    // costs" copy is gone from the engine, but we keep this guard
    // in case a future rule re-introduces a market category.
    if (task.category === 'market' || task.category === 'profitability') score -= 50;
  }

  if (userType === 'farmer') {
    if (['watering', 'weeding', 'pest-check', 'harvest', 'weather'].includes(task.category)) {
      score += 10;
    }
  }

  // Clamp to [0, 100].
  return Math.max(0, Math.min(100, score));
}

export default scoreTaskCandidate;
