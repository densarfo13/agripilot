/**
 * dailyActionEngine.js — focused daily-action recommendation engine.
 *
 * Mission: generate ONE clear daily action.
 *          Avoid complexity.
 *
 * Distinct from recommendationPriorityEngine.js (the unified V1
 * engine) — this engine:
 *   - Applies the spec weight model 40/30/20/10
 *     (weather / scan / growth stage / previous outcomes)
 *   - ALWAYS returns exactly 1 action (never null)
 *   - Emits the spec-canonical shape
 *     { action, priority, reason, confidence, estimatedTime, followUpDate }
 *   - Computes followUpDate from priority + category
 *
 * Pure / never throws / frozen.
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const _arr = (v) => (Array.isArray(v) ? v : []);

// Spec weights (gate-locked literal).
const WEIGHTS = Object.freeze({
  weather:         40,
  scan:            30,
  growthStage:     20,
  previousOutcome: 10,
});

// 4-tuple component computers. Each returns 0..1.

function _weatherSignal(weather) {
  if (!weather || typeof weather !== 'object') return { score: 0, note: null };
  const rain24 = _num(weather.rainMmNext24h);
  const highC  = _num(weather.tempHighC) || _num(weather.currentTempC);
  const humid  = _num(weather.humidityPct);
  let score = 0;
  let note = null;
  if (rain24 != null && rain24 >= 10) {
    score = 0.9;
    note = 'Heavy rainfall in next 24h (' + Math.round(rain24) + ' mm)';
  } else if (rain24 != null && rain24 >= 3) {
    score = 0.6;
    note = 'Moderate rainfall in next 24h';
  } else if (highC != null && highC >= 32) {
    score = 0.7;
    note = 'High temperature stress (' + Math.round(highC) + '°C)';
  } else if (humid != null && humid >= 80) {
    score = 0.55;
    note = 'High humidity — elevated disease pressure';
  } else if (highC != null && highC <= 5) {
    score = 0.7;
    note = 'Frost risk';
  } else {
    score = 0.2;
    note = 'Stable weather conditions';
  }
  return { score, note };
}

function _scanSignal(scan) {
  if (!scan || typeof scan !== 'object') return { score: 0, note: null, severity: null };
  const severityRaw = _str(scan.severity).toLowerCase();
  const severity = ['high', 'medium', 'low'].includes(severityRaw)
    ? severityRaw : null;
  const diseases = _arr(scan.diseaseCandidates);
  const topDisease = diseases[0] || null;
  const pest = scan.pest && scan.pest.pest ? scan.pest : null;
  if (!topDisease && !pest) {
    return { score: 0.15, note: 'No disease or pest flagged on last scan',
      severity: null };
  }
  let score;
  if (severity === 'high')        score = 0.9;
  else if (severity === 'medium') score = 0.65;
  else                            score = 0.4;
  const note = topDisease && topDisease.name
    ? topDisease.name + ' detected (' + (severity || 'low') + ' severity)'
    : pest && pest.pest
      ? pest.pest + ' detected (' + (pest.severity || 'low') + ' severity)'
      : 'Scan flagged an issue';
  return { score, note, severity };
}

function _growthStageSignal(growthStage) {
  // Stages with active interventions score higher — those windows
  // are short and time-sensitive. Dormant / unknown stages are flat.
  if (!growthStage || typeof growthStage !== 'object') {
    return { score: 0.3, note: null };
  }
  const s = _str(growthStage.stage);
  const SCORES = {
    seeded:          0.55,
    germination:     0.7,
    early_growth:    0.6,
    vegetative:      0.4,
    flowering:       0.8,
    fruiting:        0.8,
    harvest_ready:   0.95,
    unknown:         0.3,
  };
  const score = SCORES[s] != null ? SCORES[s] : 0.3;
  const note = s !== 'unknown' && s
    ? 'Crop is in ' + s.replace(/_/g, ' ') + ' stage'
    : null;
  return { score, note };
}

function _previousOutcomeSignal(outcomeHistory) {
  // Successful past actions raise priority slightly (we want to
  // repeat what works); failed past actions also raise priority
  // (worth re-inspecting). Neutral when no history.
  if (!Array.isArray(outcomeHistory) || outcomeHistory.length === 0) {
    return { score: 0.3, note: null };
  }
  const successful = outcomeHistory.filter((r) =>
    r.successRate != null && r.successRate >= 70).length;
  const recent = outcomeHistory.length;
  if (recent === 0) return { score: 0.3, note: null };
  const successRatio = successful / recent;
  const score = 0.4 + Math.min(0.5, successRatio * 0.5);
  const note = successful > 0
    ? 'Past similar actions worked ' + successful + '/' + recent + ' times'
    : 'Limited history; building outcome record';
  return { score, note };
}

function _priorityBand(score) {
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

// Pick the dominant action source based on the strongest signal.
function _pickAction(signals, scan, growthStage, openTasks) {
  // openTasks is an array of pending tasks; if present, dedupe
  // against them so we don't suggest something already on the list.
  const pendingTitles = new Set(
    _arr(openTasks).map((t) => _str(t && t.title).toLowerCase().trim())
  );

  // Pre-built action templates per dominant signal.
  const candidates = [];

  // Weather-dominant action
  if (signals.weather.score >= 0.6) {
    const rain = signals.weather.note && signals.weather.note.includes('rainfall');
    candidates.push({
      action: rain
        ? 'Cover or shelter sensitive crops; check drainage before the rain.'
        : 'Irrigate at dawn or dusk; mulch to retain soil moisture.',
      category: 'weather',
      reasonParts: [signals.weather.note].filter(Boolean),
      estimatedMinutes: 15,
      sourceScore: signals.weather.score,
    });
  }

  // Scan-dominant action — most actionable
  if (signals.scan.score >= 0.6 && scan) {
    const issue = (scan.diseaseCandidates && scan.diseaseCandidates[0]
      && scan.diseaseCandidates[0].name)
      || (scan.pest && scan.pest.pest)
      || 'recent finding';
    candidates.push({
      action: 'Inspect the affected ' + (scan.plantName || 'plant')
        + ' for ' + issue + ' spread.',
      category: scan.pest && scan.pest.pest ? 'pest' : 'disease',
      reasonParts: [
        signals.scan.note,
        signals.weather.note && signals.weather.note.includes('rainfall')
          ? 'Rain favours rapid spread' : null,
      ].filter(Boolean),
      estimatedMinutes: 5,
      sourceScore: signals.scan.score,
    });
  }

  // Growth-stage-dominant action
  if (signals.growthStage.score >= 0.7 && growthStage) {
    const stageActions = {
      germination:   'Keep seed beds moist; check for emergence gaps.',
      flowering:     'Scout for flower-stage pests; avoid disturbing pollinators.',
      fruiting:      'Check fruit set; thin if overcrowded.',
      harvest_ready: 'Plan harvest within the next 7 days.',
      seeded:        'Mark planting date so growth-stage tracking stays accurate.',
      early_growth:  'Check for early-stage pest pressure on tender leaves.',
      vegetative:    'Apply side-dressing fertilizer if soil tests indicate need.',
    };
    candidates.push({
      action: stageActions[growthStage.stage] || 'Check on the crop.',
      category: 'growth',
      reasonParts: [signals.growthStage.note].filter(Boolean),
      estimatedMinutes: 10,
      sourceScore: signals.growthStage.score,
    });
  }

  // Fallback — always emit at least one action so the contract
  // "always returns 1 action" holds. Conservative copy.
  if (candidates.length === 0) {
    candidates.push({
      action: 'Walk the field for 5 minutes and note anything unusual.',
      category: 'general',
      reasonParts: ['No urgent signal today — a routine check stays ahead of surprises.'],
      estimatedMinutes: 5,
      sourceScore: 0.3,
    });
  }

  // Filter out actions whose title duplicates an open task.
  const fresh = candidates.filter((c) =>
    !pendingTitles.has(c.action.toLowerCase().trim()));
  return (fresh.length > 0 ? fresh : candidates)
    .sort((a, b) => b.sourceScore - a.sourceScore);
}

function _followUpDateFor(priority, category, nowMs) {
  // Spec-aligned follow-up windows: high = 3 days, medium = 7,
  // low = 14. Matches the V3 follow-up engine's 3/7/14 cadence.
  const days = priority === 'high' ? 3
             : priority === 'medium' ? 7 : 14;
  const d = new Date(nowMs);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);    // YYYY-MM-DD
}

/**
 * Main entry. ALWAYS returns exactly 1 top action (gate-enforced).
 *
 * @param {object} input
 * @param {object} [input.weather]
 * @param {object} [input.scan]
 * @param {string} [input.crop]
 * @param {object} [input.growthStage]
 * @param {Array}  [input.openTasks]
 * @param {Array}  [input.outcomeHistory]
 * @param {number} [input.nowMs]
 */
export function computeDailyAction(input = {}) {
  try {
    const signals = {
      weather:         _weatherSignal(input.weather),
      scan:            _scanSignal(input.scan),
      growthStage:     _growthStageSignal(input.growthStage),
      previousOutcome: _previousOutcomeSignal(input.outcomeHistory),
    };

    // Weighted priority score 0..100.
    const weighted =
      (signals.weather.score         * WEIGHTS.weather) +
      (signals.scan.score            * WEIGHTS.scan) +
      (signals.growthStage.score     * WEIGHTS.growthStage) +
      (signals.previousOutcome.score * WEIGHTS.previousOutcome);
    const priorityScore = Math.round(weighted);
    const priority = _priorityBand(priorityScore);

    // Confidence is the AVG of the three signal scores that
    // actually contributed (drop the 0-score ones).
    const contributing = [signals.weather, signals.scan,
      signals.growthStage, signals.previousOutcome]
      .filter((s) => s.score > 0.2);
    const confidenceRaw = contributing.length > 0
      ? contributing.reduce((a, s) => a + s.score, 0) / contributing.length
      : 0.3;
    const confidence = Math.round(confidenceRaw * 100);

    const candidates = _pickAction(signals, input.scan,
      input.growthStage, input.openTasks);
    const top = candidates[0];

    // Reason — flatten the contributing notes (max 3 lines).
    const reason = top.reasonParts.slice(0, 3).join(' ');

    const nowMs = _num(input.nowMs) || Date.now();
    const followUpDate = _followUpDateFor(priority, top.category, nowMs);

    return Object.freeze({
      ok: true,
      action:        top.action,
      priority,
      priorityScore,
      reason,
      confidence,
      estimatedTime: (top.estimatedMinutes < 60)
        ? top.estimatedMinutes + ' minutes'
        : Math.round(top.estimatedMinutes / 60) + ' hours',
      estimatedMinutes: top.estimatedMinutes,
      followUpDate,
      category:      top.category,
      sourceWeights: WEIGHTS,
      sources: Object.freeze({
        weather:         !!input.weather,
        scan:            !!input.scan,
        crop:            !!input.crop,
        growthStage:     !!input.growthStage,
        openTasks:       _arr(input.openTasks).length,
        previousOutcome: _arr(input.outcomeHistory).length,
      }),
      // Top 3 cap — gate enforces no more than 3 are returned.
      topThree: Object.freeze(candidates.slice(0, 3).map((c) =>
        Object.freeze({ action: c.action, category: c.category,
          reason: c.reasonParts.join(' '),
          estimatedMinutes: c.estimatedMinutes,
          priorityScore: Math.round(c.sourceScore * 100) }))),
      generatedAt: new Date().toISOString(),
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    // Even on internal failure we still return exactly 1 action
    // (the conservative fallback) so the gate's "always 1 action"
    // invariant holds.
    const fallback = {
      action:        'Walk the field for 5 minutes and note anything unusual.',
      priority:      'low',
      priorityScore: 25,
      reason:        'Unable to compute prioritized signals — running on safe fallback.',
      confidence:    30,
      estimatedTime: '5 minutes',
      estimatedMinutes: 5,
      followUpDate:  _followUpDateFor('low', 'general', Date.now()),
      category:      'general',
    };
    return Object.freeze({
      ok: false, reason_internal: 'exception',
      message: err && err.message,
      ...fallback,
      sourceWeights: WEIGHTS,
      sources: Object.freeze({
        weather: false, scan: false, crop: false,
        growthStage: false, openTasks: 0, previousOutcome: 0,
      }),
      topThree: Object.freeze([Object.freeze({ action: fallback.action,
        category: fallback.category, reason: fallback.reason,
        estimatedMinutes: fallback.estimatedMinutes,
        priorityScore: fallback.priorityScore })]),
      generatedAt: new Date().toISOString(),
      limitations: 'Decision support, not a guarantee.',
    });
  }
}

export function dailyActionEngineInfo() {
  return Object.freeze({
    name:        'daily-action-engine',
    weights:     WEIGHTS,
    alwaysReturnsOneAction: true,
    maxTopThree: 3,
    spec:        'one clear daily action; avoid complexity',
  });
}

export const _internal = Object.freeze({
  _weatherSignal, _scanSignal, _growthStageSignal,
  _previousOutcomeSignal, _priorityBand, _pickAction,
  _followUpDateFor, WEIGHTS,
});

export default computeDailyAction;
