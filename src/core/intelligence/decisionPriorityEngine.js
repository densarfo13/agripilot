/**
 * decisionPriorityEngine.js — Decision Priority Engine v1.
 *
 *   import { runDecisionEngine }
 *     from 'src/core/intelligence/decisionPriorityEngine.js';
 *
 *   const verdict = runDecisionEngine({
 *     scan, focus, weather, cropLifecycle, farmMemory,
 *     soil, marketplace, supplier, regional, ngo,
 *     followUpTasks, wateringHistory,
 *     mode: 'farm' | 'garden',
 *   });
 *
 *   verdict = {
 *     oneBestAction:     { key, fallback, params, rank, candidateId },
 *     urgency:           'high' | 'medium' | 'low',
 *     reason:            { key, fallback, params },
 *     bestTime:          { key, fallback, params } | null,
 *     expectedImpact:    { key, fallback, params } | null,
 *     followUp:          { key, fallback, params } | null,
 *     suppressedActions: [{ candidateId, label, rank, suppressedReason }],
 *     engineVersion:     'decision-priority-v1',
 *     generatedAt:       number,
 *   }
 *
 * What this is
 * ────────────
 *   The unified arbiter that takes every intelligence-layer
 *   signal Farroway has (scan + weather + lifecycle + farm
 *   memory + soil + marketplace + supplier + regional + NGO +
 *   tasks + watering) and produces ONE best action. Every other
 *   candidate is suppressed with an explicit reason — the
 *   surface can show "+3 other suggestions" but the calm
 *   default is a single tile.
 *
 *   This is NOT a replacement for `getPrimaryGuidance` (the
 *   home-tile single-call entry point) or the existing 7-rank
 *   `RECOMMENDATION_PRIORITY` ladder in governance/. It's the
 *   spec-shaped layer that consumes the SAME engines via a
 *   wider input bag and a finer 9-rank ladder, producing the
 *   `oneBestAction + suppressedActions` envelope the spec
 *   documents.
 *
 *   Compose-only design:
 *     • Each input is optional; missing ones degrade to a lower
 *       confidence rather than crash.
 *     • Candidate generation is purely additive — each adapter
 *       maps a domain into 0..N candidates with rank + payload.
 *     • Suppression is explicit and surfaces in the output, so
 *       the user can ask "what else might I do?" via a
 *       follow-up surface.
 *
 * Priority ladder (Decision Priority Engine v1 spec)
 *   1. crop survival risk        — frost, flood, severe wind
 *   2. disease escalation        — serious / worsening scan verdict
 *   3. weather protection        — rain pooling, heat irrigation,
 *                                   wind staking, glare
 *   4. watering stress           — soil dryness, missed watering
 *   5. lifecycle-critical task   — stage-locked task overdue
 *   6. harvest timing            — ready-to-pick window
 *   7. marketplace opportunity   — buyer match for active listing
 *   8. supplier recommendation   — seed / input restock prompts
 *   9. funding / NGO prompt      — eligible programmes
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is a `{key, fallback, params}` envelope.
 *   • Self-consistency: if a higher-ranked candidate fires, all
 *     lower-ranked ones are suppressed automatically — no
 *     "20 disconnected insights" leak.
 *   • Garden-mode aware: hides marketplace + supplier + NGO ranks
 *     (matches the existing priorityForMode contract).
 */

const ENGINE_VERSION = 'decision-priority-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _num   = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const _str   = (v) => (typeof v === 'string' ? v : '');

function _safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

// ─── Ranks ──────────────────────────────────────────────────

export const RANK = Object.freeze({
  CROP_SURVIVAL:   1,
  DISEASE_ESCAL:   2,
  WEATHER_PROTECT: 3,
  WATERING_STRESS: 4,
  LIFECYCLE_CRIT:  5,
  HARVEST_TIMING:  6,
  MARKETPLACE:     7,
  SUPPLIER:        8,
  NGO_FUNDING:     9,
});

const _GARDEN_HIDE_RANKS = new Set([
  RANK.MARKETPLACE, RANK.SUPPLIER, RANK.NGO_FUNDING,
]);

// ─── Candidate factories ────────────────────────────────────

/**
 * Each `_makeXxxCandidate` function returns a single candidate
 * `{ candidateId, rank, urgency, action, reason, bestTime,
 *    expectedImpact, followUp, severity, source }`
 * or `null` if the signal isn't strong enough to fire.
 *
 * Adapters are intentionally narrow + pure so the cascade below
 * stays easy to reason about.
 */

function _makeCropSurvivalCandidate(input) {
  const w = input.weather || {};
  const temp = _num(w.temp);
  const wind = _num(w.windSpeedKph);
  const rainProb = _num(w.rainProbability24hPct);
  // Frost — temperate / highland farms care about ≤4°C nights.
  if (temp != null && temp <= 4) {
    return Object.freeze({
      candidateId: 'crop_survival_frost',
      rank:        RANK.CROP_SURVIVAL,
      urgency:     'high',
      action: Object.freeze({
        key:      'decision.action.cropSurvival.frost',
        fallback: 'Cover or shelter your crop tonight — frost is likely.',
      }),
      reason: Object.freeze({
        key:      'decision.reason.cropSurvival.frost',
        fallback: 'Overnight temperatures are forecast at or below 4°C.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.evening', fallback: 'This evening',
      }),
      expectedImpact: Object.freeze({
        key:      'decision.impact.cropSurvival',
        fallback: 'Could prevent total loss of exposed plants.',
      }),
      followUp: Object.freeze({
        key:      'decision.followUp.checkInTheMorning',
        fallback: 'Check the crop in the morning and uncover if the sun is out.',
      }),
      severity: 'serious',
      source:   'weather',
    });
  }
  // Severe wind — outdoor crop with no shelter at 50 km/h+.
  if (wind != null && wind >= 50) {
    return Object.freeze({
      candidateId: 'crop_survival_wind',
      rank:        RANK.CROP_SURVIVAL,
      urgency:     'high',
      action: Object.freeze({
        key:      'decision.action.cropSurvival.wind',
        fallback: 'Stake young plants and secure structures — severe wind expected.',
      }),
      reason: Object.freeze({
        key:      'decision.reason.cropSurvival.wind',
        fallback: 'Forecast wind speed is at or above 50 km/h.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.beforeWind', fallback: 'Before the wind picks up',
      }),
      expectedImpact: Object.freeze({
        key:      'decision.impact.cropSurvival',
        fallback: 'Could prevent serious physical damage.',
      }),
      followUp: null,
      severity: 'serious',
      source:   'weather',
    });
  }
  // Flood risk — >85% rain probability AND no drainage signal
  // from soil. Use crude soil-risk hint if present.
  if (rainProb != null && rainProb >= 85
      && _str(input.soil && input.soil.risk).toLowerCase() === 'high') {
    return Object.freeze({
      candidateId: 'crop_survival_flood',
      rank:        RANK.CROP_SURVIVAL,
      urgency:     'high',
      action: Object.freeze({
        key:      'decision.action.cropSurvival.flood',
        fallback: 'Clear drainage channels — heavy rain expected and soil is saturated.',
      }),
      reason: Object.freeze({
        key:      'decision.reason.cropSurvival.flood',
        fallback: 'Rain probability is very high and soil already shows poor drainage risk.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.beforeRain', fallback: 'Before the rain starts',
      }),
      expectedImpact: Object.freeze({
        key:      'decision.impact.cropSurvival',
        fallback: 'Could prevent root rot and crop loss.',
      }),
      followUp: null,
      severity: 'serious',
      source:   'weather+soil',
    });
  }
  return null;
}

function _makeDiseaseEscalationCandidate(input) {
  const scan = input.scan;
  if (!_isObj(scan)) return null;
  const severity = _str(scan.severity).toLowerCase();
  const monitoringNeeded = scan.monitoringNeeded === true;
  const recurring = !!(input.farmMemory
    && input.farmMemory.activeFlags
    && input.farmMemory.activeFlags.hasRecurringIssue);
  const worsening = !!(input.farmMemory
    && input.farmMemory.activeFlags
    && input.farmMemory.activeFlags.hasWorseningTrend);
  // Only fire when severity is moderate+ or monitoring is needed,
  // OR when the memory flags say this is a worsening recurring.
  const fires = severity === 'serious'
             || severity === 'moderate'
             || monitoringNeeded
             || worsening
             || recurring;
  if (!fires) return null;
  const escalation = scan.escalationRecommendation;
  return Object.freeze({
    candidateId: 'disease_escalation',
    rank:        RANK.DISEASE_ESCAL,
    urgency:     severity === 'serious' ? 'high' : 'medium',
    action: escalation || Object.freeze({
      key:      'decision.action.disease.treatNow',
      fallback: 'Treat the affected leaves today and check neighbouring plants.',
    }),
    reason: Object.freeze({
      key:      worsening ? 'decision.reason.disease.worsening'
              : recurring ? 'decision.reason.disease.recurring'
              : 'decision.reason.disease.detected',
      fallback: worsening
        ? 'Recent scans suggest this issue is getting worse.'
        : recurring
          ? 'You’ve scanned this same issue before — let’s break the cycle.'
          : 'Your latest scan flagged a possible issue.',
    }),
    bestTime: Object.freeze({
      key: 'decision.bestTime.today', fallback: 'Today',
    }),
    expectedImpact: Object.freeze({
      key:      'decision.impact.disease',
      fallback: 'Earlier treatment usually means a faster recovery.',
    }),
    followUp: scan.followUpWindowDays
      ? Object.freeze({
          key:      'decision.followUp.rescan',
          fallback: 'Re-scan in {days} days to confirm recovery.',
          params:   { days: scan.followUpWindowDays },
        })
      : null,
    severity: severity || 'moderate',
    source:   'scan',
  });
}

function _makeWeatherProtectCandidate(input) {
  const w = input.weather || {};
  const temp = _num(w.temp);
  const rainProb = _num(w.rainProbability24hPct);
  const wind = _num(w.windSpeedKph);
  if (rainProb != null && rainProb >= 60) {
    return Object.freeze({
      candidateId: 'weather_protect_rain',
      rank:        RANK.WEATHER_PROTECT,
      urgency:     'medium',
      action: Object.freeze({
        key: 'decision.action.weather.checkDrainage',
        fallback: 'Check drainage around your crop — rain is likely.',
      }),
      reason: Object.freeze({
        key: 'decision.reason.weather.rain',
        fallback: 'Heavy rain is in the forecast.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.beforeRain', fallback: 'Before the rain starts',
      }),
      expectedImpact: Object.freeze({
        key: 'decision.impact.weather.rain',
        fallback: 'Reduces the chance of waterlogging and root rot.',
      }),
      followUp: null, severity: 'mild', source: 'weather',
    });
  }
  if (temp != null && temp >= 32) {
    return Object.freeze({
      candidateId: 'weather_protect_heat',
      rank:        RANK.WEATHER_PROTECT,
      urgency:     'medium',
      action: Object.freeze({
        key: 'decision.action.weather.irrigateEarly',
        fallback: 'Water early morning or late evening — heat is high.',
      }),
      reason: Object.freeze({
        key: 'decision.reason.weather.heat',
        fallback: 'Forecast highs are at or above 32°C.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.coolerHours', fallback: 'Cooler hours',
      }),
      expectedImpact: Object.freeze({
        key: 'decision.impact.weather.heat',
        fallback: 'Protects roots from midday heat stress.',
      }),
      followUp: null, severity: 'mild', source: 'weather',
    });
  }
  if (wind != null && wind >= 25 && wind < 50) {
    return Object.freeze({
      candidateId: 'weather_protect_wind',
      rank:        RANK.WEATHER_PROTECT,
      urgency:     'medium',
      action: Object.freeze({
        key: 'decision.action.weather.stakePlants',
        fallback: 'Stake or shelter young plants — strong wind expected.',
      }),
      reason: Object.freeze({
        key: 'decision.reason.weather.wind',
        fallback: 'Forecast wind speed is moderate-to-strong.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.beforeWind', fallback: 'Before the wind picks up',
      }),
      expectedImpact: Object.freeze({
        key: 'decision.impact.weather.wind',
        fallback: 'Prevents bending and snapped stems.',
      }),
      followUp: null, severity: 'mild', source: 'weather',
    });
  }
  return null;
}

function _makeWateringStressCandidate(input) {
  const w = input.weather || {};
  const rainProb = _num(w.rainProbability24hPct);
  const watering = input.wateringHistory;
  // Fire when no rain expected AND last watering > 2 days ago.
  const lastDays = _num(watering && watering.daysSinceLastWatering);
  if (lastDays != null && lastDays >= 2
      && (rainProb == null || rainProb < 30)) {
    return Object.freeze({
      candidateId: 'watering_stress',
      rank:        RANK.WATERING_STRESS,
      urgency:     lastDays >= 4 ? 'high' : 'medium',
      action: Object.freeze({
        key: 'decision.action.watering.now',
        fallback: 'Water the crop today — it’s been {days} days since the last watering.',
        params:   { days: lastDays },
      }),
      reason: Object.freeze({
        key: 'decision.reason.watering.dry',
        fallback: 'No rain expected and soil is likely getting dry.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.morning', fallback: 'This morning',
      }),
      expectedImpact: Object.freeze({
        key: 'decision.impact.watering',
        fallback: 'Keeps roots hydrated and prevents wilting.',
      }),
      followUp: null, severity: 'mild', source: 'wateringHistory',
    });
  }
  return null;
}

function _makeLifecycleCriticalCandidate(input) {
  const lc = input.cropLifecycle;
  if (!_isObj(lc)) return null;
  const stage = _str(lc.currentStage).toLowerCase();
  const taskOverdueDays = _num(lc.criticalTaskOverdueDays);
  if (taskOverdueDays != null && taskOverdueDays >= 2 && stage) {
    return Object.freeze({
      candidateId: 'lifecycle_critical',
      rank:        RANK.LIFECYCLE_CRIT,
      urgency:     'medium',
      action: Object.freeze({
        key: 'decision.action.lifecycle.task',
        fallback: 'Catch up on the {stage}-stage task — it has been overdue for {days} days.',
        params:   { stage, days: taskOverdueDays },
      }),
      reason: Object.freeze({
        key: 'decision.reason.lifecycle.stage',
        fallback: 'This task is critical for the current growth stage.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.today', fallback: 'Today',
      }),
      expectedImpact: Object.freeze({
        key: 'decision.impact.lifecycle',
        fallback: 'Stage-aligned care keeps the crop on track.',
      }),
      followUp: null, severity: 'mild', source: 'cropLifecycle',
    });
  }
  return null;
}

function _makeHarvestTimingCandidate(input) {
  const lc = input.cropLifecycle;
  if (!_isObj(lc)) return null;
  const stage = _str(lc.currentStage).toLowerCase();
  const harvestReady = lc.harvestReady === true
    || stage === 'harvest' || stage.includes('ripe');
  if (harvestReady) {
    return Object.freeze({
      candidateId: 'harvest_timing',
      rank:        RANK.HARVEST_TIMING,
      urgency:     'medium',
      action: Object.freeze({
        key: 'decision.action.harvest.ready',
        fallback: 'Check the crop for harvest readiness today.',
      }),
      reason: Object.freeze({
        key: 'decision.reason.harvest.window',
        fallback: 'The crop has entered its harvest window.',
      }),
      bestTime: Object.freeze({
        key: 'decision.bestTime.today', fallback: 'Today',
      }),
      expectedImpact: Object.freeze({
        key: 'decision.impact.harvest',
        fallback: 'Better quality and market price when picked on time.',
      }),
      followUp: null, severity: 'mild', source: 'cropLifecycle',
    });
  }
  return null;
}

function _makeMarketplaceCandidate(input) {
  const m = input.marketplace;
  if (!_isObj(m)) return null;
  if (!m.hasActiveListing) return null;
  const matchCount = _num(m.buyerMatchCount);
  if (matchCount == null || matchCount < 1) return null;
  return Object.freeze({
    candidateId: 'marketplace_match',
    rank:        RANK.MARKETPLACE,
    urgency:     'low',
    action: Object.freeze({
      key: 'decision.action.marketplace.openMatch',
      fallback: 'Check the marketplace — {count} buyers match your listing.',
      params:   { count: matchCount },
    }),
    reason: Object.freeze({
      key: 'decision.reason.marketplace.match',
      fallback: 'Active buyers are interested in what you’re selling.',
    }),
    bestTime: null,
    expectedImpact: Object.freeze({
      key: 'decision.impact.marketplace',
      fallback: 'Faster sales when you respond promptly.',
    }),
    followUp: null, severity: 'mild', source: 'marketplace',
  });
}

function _makeSupplierCandidate(input) {
  const s = input.supplier;
  if (!_isObj(s)) return null;
  if (!s.lowStockOnInput) return null;
  return Object.freeze({
    candidateId: 'supplier_restock',
    rank:        RANK.SUPPLIER,
    urgency:     'low',
    action: Object.freeze({
      key: 'decision.action.supplier.restock',
      fallback: 'Restock {input} — your supply is running low for the season ahead.',
      params:   { input: _str(s.lowStockOnInput) || 'inputs' },
    }),
    reason: Object.freeze({
      key: 'decision.reason.supplier.lowStock',
      fallback: 'Supplier intelligence shows local stock is limited.',
    }),
    bestTime: null,
    expectedImpact: Object.freeze({
      key: 'decision.impact.supplier',
      fallback: 'Avoids planting delays.',
    }),
    followUp: null, severity: 'mild', source: 'supplier',
  });
}

function _makeNgoFundingCandidate(input) {
  const n = input.ngo;
  if (!_isObj(n)) return null;
  if (!Array.isArray(n.eligiblePrograms) || n.eligiblePrograms.length === 0) return null;
  return Object.freeze({
    candidateId: 'ngo_funding',
    rank:        RANK.NGO_FUNDING,
    urgency:     'low',
    action: Object.freeze({
      key: 'decision.action.ngo.eligible',
      fallback: 'Check {count} funding program(s) you may qualify for.',
      params:   { count: n.eligiblePrograms.length },
    }),
    reason: Object.freeze({
      key: 'decision.reason.ngo.eligible',
      fallback: 'Your farm profile matches programs accepting applications.',
    }),
    bestTime: null,
    expectedImpact: Object.freeze({
      key: 'decision.impact.ngo',
      fallback: 'Could provide inputs or financing for the season.',
    }),
    followUp: null, severity: 'mild', source: 'ngo',
  });
}

const _FACTORIES = Object.freeze([
  _makeCropSurvivalCandidate,
  _makeDiseaseEscalationCandidate,
  _makeWeatherProtectCandidate,
  _makeWateringStressCandidate,
  _makeLifecycleCriticalCandidate,
  _makeHarvestTimingCandidate,
  _makeMarketplaceCandidate,
  _makeSupplierCandidate,
  _makeNgoFundingCandidate,
]);

// ─── Orchestrator ──────────────────────────────────────────

/**
 * Build the full candidate list, apply mode filter, pick the
 * top-rank candidate, suppress the rest with reasons.
 */
export function runDecisionEngine(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const mode = _str(safe.mode).toLowerCase() === 'garden' ? 'garden' : 'farm';

    // Build candidates.
    const candidates = [];
    for (const fn of _FACTORIES) {
      const c = _safe(() => fn(safe), null);
      if (c) candidates.push(c);
    }

    // Garden mode filter.
    const filtered = candidates.filter((c) =>
      !(mode === 'garden' && _GARDEN_HIDE_RANKS.has(c.rank)));

    // Sort by rank ascending — lowest rank wins.
    filtered.sort((a, b) => a.rank - b.rank);

    if (filtered.length === 0) {
      return _emptyEnvelope();
    }

    const winner = filtered[0];
    const suppressed = filtered.slice(1).map((c) => Object.freeze({
      candidateId:      c.candidateId,
      label:            c.action,
      rank:             c.rank,
      source:           c.source,
      suppressedReason: Object.freeze({
        key:      'decision.suppressed.rankedLower',
        fallback: 'A higher-priority action is showing first.',
      }),
    }));

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      oneBestAction: Object.freeze({
        ...winner.action,
        rank:        winner.rank,
        candidateId: winner.candidateId,
      }),
      urgency:        winner.urgency,
      reason:         winner.reason,
      bestTime:       winner.bestTime || null,
      expectedImpact: winner.expectedImpact || null,
      followUp:       winner.followUp || null,
      suppressedActions: Object.freeze(suppressed),
      generatedAt:    Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    oneBestAction: Object.freeze({
      key:      'decision.action.calm',
      fallback: 'Walk your field and check crop health.',
      rank:     null, candidateId: null,
    }),
    urgency:        'low',
    reason: Object.freeze({
      key: 'decision.reason.calm', fallback: 'No urgent signals today.',
    }),
    bestTime:       null,
    expectedImpact: null,
    followUp:       null,
    suppressedActions: Object.freeze([]),
    generatedAt:    Date.now(),
  });
}

export const _internal = Object.freeze({
  RANK, ENGINE_VERSION,
  _makeCropSurvivalCandidate, _makeDiseaseEscalationCandidate,
  _makeWeatherProtectCandidate, _makeWateringStressCandidate,
  _makeLifecycleCriticalCandidate, _makeHarvestTimingCandidate,
  _makeMarketplaceCandidate, _makeSupplierCandidate,
  _makeNgoFundingCandidate,
});

const _module = { runDecisionEngine, RANK, _internal };
export default _module;
