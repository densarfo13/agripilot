/**
 * adaptiveTaskEngine.js — Living Farm Continuity §4 + §5.
 *
 *   import { generateAdaptiveTask }
 *     from 'src/core/tasks/adaptiveTaskEngine.js';
 *
 *   const v = generateAdaptiveTask({
 *     crop, cropLifecycle, weather, scan,
 *     farmMemory, taskHistory, recurringIssues,
 *     locale,
 *   });
 *
 *   v = {
 *     primary: {
 *       id, title, why, urgency, bestTime, source,
 *     } | null,
 *     secondary: { ... } | null,
 *     suppressed: [{ id, reason }],
 *     engineVersion: 'adaptive-task-v1', generatedAt,
 *   }
 *
 * What this is
 * ────────────
 *   ONE primary task per call, plus an optional secondary task
 *   only when it's HIGH-CONFIDENCE + NON-CONFLICTING + operationally
 *   important. Every task carries a calm `why` envelope (§5).
 *
 *   Inputs feed a small priority ladder:
 *     1. crop survival (weather extremes)        — rank 1
 *     2. scan-driven follow-up                   — rank 2
 *     3. lifecycle-critical (stage-aware)        — rank 3
 *     4. weather-adapted routine (heat / rain)   — rank 4
 *     5. memory-driven recurrence check          — rank 5
 *     6. routine inspection                      — rank 6
 *
 *   The "why" line is always sourced from existing context — it
 *   does NOT generate new reasoning; it phrases existing signals
 *   in operational language ("Recent humidity increased fungal
 *   risk." / "Your last scan suggested continued monitoring.").
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is `{key, fallback, params}`.
 *   • No raw probabilities, no AI wording.
 */

const ENGINE_VERSION = 'adaptive-task-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const RANK = Object.freeze({
  SURVIVAL:    1,
  SCAN:        2,
  LIFECYCLE:   3,
  WEATHER:     4,
  MEMORY:      5,
  ROUTINE:     6,
});

// ─── Candidate factories ─────────────────────────────────────

function _survivalCandidate(input) {
  const w = input.weather;
  if (!_isObj(w)) return null;
  const temp = _num(w.temp);
  const wind = _num(w.windSpeedKph);
  if (temp != null && temp <= 4) {
    return Object.freeze({
      id:       'task.survival.frost',
      rank:     RANK.SURVIVAL,
      title: Object.freeze({
        key:      'task.survival.frost.title',
        fallback: 'Cover sensitive plants tonight',
      }),
      why: Object.freeze({
        key:      'task.survival.frost.why',
        fallback: 'Overnight temperatures look very low — a quick cover protects exposed plants.',
        params:   { temp },
      }),
      urgency:  'high',
      bestTime: Object.freeze({
        key: 'decision.bestTime.evening', fallback: 'This evening',
      }),
      source:   'weather',
    });
  }
  if (wind != null && wind >= 50) {
    return Object.freeze({
      id:       'task.survival.wind',
      rank:     RANK.SURVIVAL,
      title: Object.freeze({
        key:      'task.survival.wind.title',
        fallback: 'Stake or shelter tall plants',
      }),
      why: Object.freeze({
        key:      'task.survival.wind.why',
        fallback: 'Strong wind is expected — young plants can lodge or break.',
      }),
      urgency:  'high',
      bestTime: Object.freeze({
        key: 'decision.bestTime.beforeWind', fallback: 'Before the wind picks up',
      }),
      source:   'weather',
    });
  }
  return null;
}

function _scanCandidate(input) {
  if (!_isObj(input.scan)) return null;
  const sev = _str(input.scan.severity).toLowerCase();
  if (sev !== 'serious' && sev !== 'moderate'
      && input.scan.monitoringNeeded !== true) return null;
  return Object.freeze({
    id:       'task.scan.followup',
    rank:     RANK.SCAN,
    title: Object.freeze({
      key:      'task.scan.followup.title',
      fallback: 'Re-scan the affected plant',
    }),
    why: Object.freeze({
      key:      'task.scan.followup.why',
      fallback: 'Your last scan suggested continued monitoring.',
    }),
    urgency:  sev === 'serious' ? 'high' : 'medium',
    bestTime: Object.freeze({
      key: 'decision.bestTime.morning', fallback: 'Tomorrow morning',
    }),
    source:   'scan',
  });
}

function _lifecycleCandidate(input) {
  const cl = input.cropLifecycle;
  if (!_isObj(cl)) return null;
  const overdue = _num(cl.criticalTaskOverdueDays);
  if (overdue != null && overdue >= 2) {
    return Object.freeze({
      id:       'task.lifecycle.overdue',
      rank:     RANK.LIFECYCLE,
      title: Object.freeze({
        key:      'task.lifecycle.overdue.title',
        fallback: 'Catch up on this stage\'s overdue task',
      }),
      why: Object.freeze({
        key:      'task.lifecycle.overdue.why',
        fallback: 'A {days}-day overdue task can slow this growth stage.',
        params:   { days: overdue },
      }),
      urgency:  'medium',
      bestTime: Object.freeze({
        key: 'decision.bestTime.today', fallback: 'Today',
      }),
      source:   'lifecycle',
    });
  }
  return null;
}

function _weatherCandidate(input) {
  const w = input.weather;
  if (!_isObj(w)) return null;
  const temp = _num(w.temp);
  const humidity = _num(w.humidityPct);
  const rain = _num(w.rainProbability24hPct);

  if (humidity != null && humidity >= 80 && temp != null && temp >= 18 && temp <= 30) {
    return Object.freeze({
      id:       'task.weather.fungal',
      rank:     RANK.WEATHER,
      title: Object.freeze({
        key:      'task.weather.fungal.title',
        fallback: 'Inspect lower leaves tomorrow morning',
      }),
      why: Object.freeze({
        key:      'task.weather.fungal.why',
        fallback: 'Recent humidity increased fungal risk.',
      }),
      urgency:  'medium',
      bestTime: Object.freeze({
        key: 'decision.bestTime.morning', fallback: 'Tomorrow morning',
      }),
      source:   'weather',
    });
  }
  if (rain != null && rain < 30 && temp != null && temp >= 28) {
    return Object.freeze({
      id:       'task.weather.dryHeat',
      rank:     RANK.WEATHER,
      title: Object.freeze({
        key:      'task.weather.dryHeat.title',
        fallback: 'Water deeply in cooler hours',
      }),
      why: Object.freeze({
        key:      'task.weather.dryHeat.why',
        fallback: 'Warm temperatures may dry soil faster today.',
      }),
      urgency:  'medium',
      bestTime: Object.freeze({
        key: 'decision.bestTime.coolerHours', fallback: 'Cooler hours',
      }),
      source:   'weather',
    });
  }
  return null;
}

function _memoryCandidate(input) {
  const fm = input.farmMemory;
  if (!_isObj(fm)) return null;
  const flags = fm.activeFlags || {};
  if (flags.hasRecurringIssue) {
    return Object.freeze({
      id:       'task.memory.recurring',
      rank:     RANK.MEMORY,
      title: Object.freeze({
        key:      'task.memory.recurring.title',
        fallback: 'Check the area where this issue keeps appearing',
      }),
      why: Object.freeze({
        key:      'task.memory.recurring.why',
        fallback: 'This issue has appeared more than once recently.',
      }),
      urgency:  'medium',
      bestTime: null,
      source:   'memory',
    });
  }
  return null;
}

function _routineCandidate() {
  return Object.freeze({
    id:       'task.routine.inspection',
    rank:     RANK.ROUTINE,
    title: Object.freeze({
      key:      'task.routine.inspection.title',
      fallback: 'Walk your field and check crop health',
    }),
    why: Object.freeze({
      key:      'task.routine.inspection.why',
      fallback: 'A short daily walk catches small issues early.',
    }),
    urgency:  'low',
    bestTime: null,
    source:   'routine',
  });
}

const _FACTORIES = Object.freeze([
  _survivalCandidate, _scanCandidate, _lifecycleCandidate,
  _weatherCandidate, _memoryCandidate, _routineCandidate,
]);

// ─── Public ──────────────────────────────────────────────────

/**
 * Build the primary + optional secondary task envelope.
 */
export function generateAdaptiveTask(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const candidates = [];
    for (const fn of _FACTORIES) {
      const c = _safe(() => fn(safe), null);
      if (c) candidates.push(c);
    }
    if (candidates.length === 0) {
      return _emptyEnvelope();
    }
    candidates.sort((a, b) => a.rank - b.rank);

    const primary = candidates[0];
    let secondary = null;
    // Add a secondary task ONLY if it's at least one rank apart,
    // non-conflicting (different source), and not a routine.
    for (let i = 1; i < candidates.length; i++) {
      const c = candidates[i];
      if (c.source !== primary.source
          && c.rank !== RANK.ROUTINE
          && c.urgency !== 'low'
          && c.rank - primary.rank >= 1) {
        secondary = c;
        break;
      }
    }

    const suppressed = candidates
      .filter((c) => c !== primary && c !== secondary)
      .map((c) => Object.freeze({
        id:       c.id,
        reason:   c.rank === RANK.ROUTINE ? 'demoted_to_routine' : 'lower_priority',
      }));

    return Object.freeze({
      engineVersion: ENGINE_VERSION,
      primary,
      secondary,
      suppressed:    Object.freeze(suppressed),
      locale:        _str(safe.locale) || null,
      generatedAt:   Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion: ENGINE_VERSION,
    primary:       _routineCandidate(),
    secondary:     null,
    suppressed:    Object.freeze([]),
    locale:        null,
    generatedAt:   Date.now(),
  });
}

export const _internal = Object.freeze({
  _survivalCandidate, _scanCandidate, _lifecycleCandidate,
  _weatherCandidate, _memoryCandidate, _routineCandidate,
  RANK, ENGINE_VERSION,
});

const _module = { generateAdaptiveTask, _internal };
export default _module;
