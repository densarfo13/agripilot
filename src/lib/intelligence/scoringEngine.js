/**
 * scoringEngine.js — Farroway Weather AI + Crop Stage Intelligence
 * scoring layer (rules-first, ML-ready underneath).
 *
 * Sits between contextEngine.computeContextIntelligence() and the
 * UI. Generates multiple task candidates from the available signals,
 * scores each with a deterministic weighted formula, returns the
 * highest-scoring task plus the full ranked list for explainability.
 *
 * Why this exists when contextEngine already returns one task:
 *   • The spec calls for a "candidate generator + ML-style scorer"
 *     so future ML training data can replay the same shape.
 *   • Exposes per-signal scores so a /debug or admin surface can
 *     show "why this task" — explainability the spec mandates.
 *   • Lets future telemetry log scores alongside completion to
 *     build a feedback loop without changing the engine API.
 *
 * Strict-rule audit
 *   • Pure function. No I/O. Never throws.
 *   • Falls back to FALLBACK_TASK from contextEngine if no
 *     candidate scores positive.
 *   • Synchronous; safe inside useMemo.
 *   • No ML model load. No API. No async work.
 */

import { computeContextIntelligence, _internal as _ce } from './contextEngine.js';

// ─── Scoring weights (spec §7) ────────────────────────────────────
// All values match the spec's example weights (+30 weather, +25
// stage, +20 scan, +15 simplicity, -20 done-today, -15 mode-mismatch,
// +20 sell at harvest, +20 garden scan/watering bonus). Tweaking
// these here changes ranking without touching rule logic.

const WEIGHTS = Object.freeze({
  WEATHER_HIGH:        30,
  STAGE_RELEVANT:      25,
  SCAN_RELEVANT:       20,
  SIMPLE_TASK:         15,
  DONE_TODAY_PENALTY: -20,
  MODE_MISMATCH:      -15,
  HARVEST_SELL_BONUS:  20,
  GARDEN_CARE_BONUS:   20,
  CROP_SPECIFIC:       18,
  FALLBACK_FLOOR:       1,
});

// ─── Candidate signal helpers ─────────────────────────────────────

function _hasHighWeatherRisk(ctx) {
  const w = String(ctx.weatherType || '').toLowerCase();
  if (w === 'heat' || w === 'rain' || w === 'wind') return true;
  const t = Number(ctx.temp);
  if (Number.isFinite(t) && (t >= 35 || t >= 32)) return true;
  const r = Number(ctx.rainChance);
  if (Number.isFinite(r) && r >= 70) return true;
  return false;
}

function _stageRelevant(task, ctx) {
  if (!task || !ctx.cropStage) return false;
  const stage = String(ctx.cropStage).toLowerCase();
  const cat   = String(task.category || '').toLowerCase();
  if (stage.includes('harvest') || stage.includes('fruit')) {
    return cat === 'harvest' || cat === 'sell-prompt';
  }
  if (stage.includes('flower')) return cat === 'flowering' || cat === 'pest-check';
  if (stage.includes('vegetative') || stage.includes('growth')) {
    return cat === 'weeding' || cat === 'watering' || cat === 'pest-check';
  }
  if (stage.includes('seed') || stage.includes('germinat')) {
    return cat === 'germination' || cat === 'watering';
  }
  return false;
}

function _scanRelevant(task, ctx) {
  if (!ctx.recentScanCategory || !task) return false;
  const cat = String(task.category || '').toLowerCase();
  return cat === 'scan-followup' || cat === 'pest-check'
      || cat === 'disease-check' || cat === 'nutrition';
}

function _isSimple(task) {
  if (!task) return false;
  const cat = String(task.category || '').toLowerCase();
  // Light + watering + drainage tasks are usually under 5 mins.
  return cat === 'light' || cat === 'watering'
      || cat === 'drainage' || cat === 'crop-care';
}

function _isModeMismatch(task, mode) {
  if (!task) return true;
  const cat = String(task.category || '').toLowerCase();
  // Garden-mode users should not be steered to harvest/sell.
  if (mode === 'garden' && (cat === 'harvest' || cat === 'sell-prompt')) {
    return true;
  }
  return false;
}

// ─── Candidate generation ─────────────────────────────────────────
//
// Build candidates from each rule branch. The contextEngine's
// computeContextIntelligence already runs the priority chain and
// returns the top task — we use that as the primary candidate, then
// add explicit "what-if" candidates so ranking produces an
// explainable order.
//
// Future ML hook: each candidate carries its `signals` array so a
// model could replace the weighted formula with a learned score.

function _buildCandidates(ctx) {
  const intel = computeContextIntelligence(ctx);
  const candidates = [];

  // Primary candidate — the engine's deterministic top task.
  candidates.push({
    id:     'primary',
    task:   intel.todayTask,
    source: 'context-engine-primary',
    signals: ['primary'],
  });

  // Sell prompt as a sibling candidate when at harvest stage in
  // farm mode, so the scorer can ladder it above the harvest-check
  // task when the farmer has been completing crop-care for days.
  if (intel.sellPrompt && ctx.mode === 'farm') {
    candidates.push({
      id:     'sell-prompt',
      task:   {
        title:    intel.sellPrompt,
        reason:   'Listing while the crop is fresh reaches buyers earliest.',
        urgency:  'high',
        cta:      'Open Sell',
        category: 'sell-prompt',
      },
      source: 'context-engine-sell',
      signals: ['harvest', 'sell'],
    });
  }

  // Funding prompt as low-priority secondary in farm mode.
  if (intel.fundingPrompt && ctx.mode === 'farm') {
    candidates.push({
      id:     'funding-prompt',
      task:   {
        title:    intel.fundingPrompt,
        reason:   'Funding may help with irrigation, seed, or storage costs.',
        urgency:  'low',
        cta:      'Open Funding',
        category: 'funding-prompt',
      },
      source: 'context-engine-funding',
      signals: ['funding'],
    });
  }

  // Soil-moisture safety candidate — always available so the
  // scorer never picks "no candidate" if rules conflict.
  candidates.push({
    id:     'fallback',
    task:   {
      ..._ce.FALLBACK_TASK,
      title: ctx.crop
        ? `Check soil moisture around your ${ctx.crop}`
        : _ce.FALLBACK_TASK.title,
    },
    source: 'fallback',
    signals: ['fallback'],
  });

  return { intel, candidates };
}

// ─── Scoring (spec §7) ────────────────────────────────────────────

function _scoreCandidate(candidate, ctx, doneTodayCategories) {
  const t = candidate.task;
  if (!t) return { total: 0, breakdown: {} };

  const breakdown = {};
  let total = 0;

  // Weather risk bump.
  if (_hasHighWeatherRisk(ctx)) {
    const cat = String(t.category || '').toLowerCase();
    if (cat === 'weather' || cat === 'drainage' || cat === 'watering' || cat === 'wind') {
      breakdown.weather = WEIGHTS.WEATHER_HIGH;
      total += WEIGHTS.WEATHER_HIGH;
    }
  }

  // Stage relevance.
  if (_stageRelevant(t, ctx)) {
    breakdown.stage = WEIGHTS.STAGE_RELEVANT;
    total += WEIGHTS.STAGE_RELEVANT;
  }

  // Scan relevance.
  if (_scanRelevant(t, ctx)) {
    breakdown.scan = WEIGHTS.SCAN_RELEVANT;
    total += WEIGHTS.SCAN_RELEVANT;
  }

  // Crop-specific tuning fired (cropEngine attached cropSpecific tag).
  if (t.cropSpecific) {
    breakdown.cropSpecific = WEIGHTS.CROP_SPECIFIC;
    total += WEIGHTS.CROP_SPECIFIC;
  }

  // Simple task bonus.
  if (_isSimple(t)) {
    breakdown.simple = WEIGHTS.SIMPLE_TASK;
    total += WEIGHTS.SIMPLE_TASK;
  }

  // Already done today penalty.
  if (Array.isArray(doneTodayCategories)
      && doneTodayCategories.includes(String(t.category || '').toLowerCase())) {
    breakdown.doneToday = WEIGHTS.DONE_TODAY_PENALTY;
    total += WEIGHTS.DONE_TODAY_PENALTY;
  }

  // Mode mismatch penalty.
  if (_isModeMismatch(t, ctx.mode)) {
    breakdown.modeMismatch = WEIGHTS.MODE_MISMATCH;
    total += WEIGHTS.MODE_MISMATCH;
  }

  // Harvest/sell bonus in farm mode.
  if (ctx.mode === 'farm'
      && String(ctx.cropStage || '').toLowerCase().includes('harvest')
      && (t.category === 'sell-prompt' || t.category === 'harvest')) {
    breakdown.harvestSell = WEIGHTS.HARVEST_SELL_BONUS;
    total += WEIGHTS.HARVEST_SELL_BONUS;
  }

  // Garden mode care bonus for scan/watering tasks.
  if (ctx.mode === 'garden'
      && (t.category === 'watering' || t.category === 'scan-followup'
          || t.category === 'pest-check' || t.category === 'light')) {
    breakdown.gardenCare = WEIGHTS.GARDEN_CARE_BONUS;
    total += WEIGHTS.GARDEN_CARE_BONUS;
  }

  // Fallback never scores below 1 so ranking always has a winner.
  if (candidate.source === 'fallback' && total <= 0) {
    breakdown.floor = WEIGHTS.FALLBACK_FLOOR;
    total = WEIGHTS.FALLBACK_FLOOR;
  }

  return { total, breakdown };
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * scoreGuidance(ctx) → {
 *   topTask, urgency, reason, candidates, intel,
 *   confidence, source, explainability
 * }
 *
 * Picks the highest-scoring candidate; ties broken by ranking the
 * primary engine candidate above synthetic siblings (so behaviour
 * is identical to contextEngine when scores are equal).
 *
 * @param {object} ctx                  — same shape as computeContextIntelligence
 * @param {string[]} [doneToday=[]]     — categories the user already completed today
 *                                        (lowercase strings)
 */
export function scoreGuidance(ctx, doneToday = []) {
  try {
    const safeCtx = (ctx && typeof ctx === 'object') ? ctx : {};
    const { intel, candidates } = _buildCandidates(safeCtx);

    const ranked = candidates.map((c) => {
      const scored = _scoreCandidate(c, safeCtx, doneToday);
      return { ...c, score: scored.total, breakdown: scored.breakdown };
    });

    // Sort: highest score first. Stable on ties.
    ranked.sort((a, b) => b.score - a.score);

    const top      = ranked[0] || { task: _ce.FALLBACK_TASK, source: 'fallback', score: 0 };
    const topTask  = top.task || _ce.FALLBACK_TASK;
    const score    = top.score;

    // Confidence ladder: high if score ≥ 40, medium ≥ 20, else low.
    const confidence = score >= 40 ? 'high' : (score >= 20 ? 'medium' : 'low');

    return Object.freeze({
      topTask:        Object.freeze({ ...topTask }),
      urgency:        topTask.urgency || 'medium',
      reason:         topTask.reason  || '',
      candidates:     Object.freeze(ranked),
      intel,
      confidence,
      source:         top.source || 'context-engine-primary',
      explainability: Object.freeze({
        weights:    WEIGHTS,
        breakdown:  top.breakdown || {},
        signals:    top.signals   || [],
        candidates: ranked.length,
      }),
    });
  } catch {
    // Last-resort fallback — never throws.
    return Object.freeze({
      topTask:        _ce.FALLBACK_TASK,
      urgency:        _ce.FALLBACK_TASK.urgency,
      reason:         _ce.FALLBACK_TASK.reason,
      candidates:     [],
      intel:          null,
      confidence:     'low',
      source:         'scoring-engine-fallback',
      explainability: { weights: WEIGHTS, breakdown: {}, signals: [], candidates: 0 },
    });
  }
}

// ─── Test surface ─────────────────────────────────────────────────
export const _internal = Object.freeze({
  WEIGHTS,
  _buildCandidates,
  _scoreCandidate,
  _hasHighWeatherRisk,
  _stageRelevant,
  _scanRelevant,
  _isSimple,
  _isModeMismatch,
});
