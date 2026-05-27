/**
 * homeContinuityEngine.js — Living Farm Continuity §1.
 *
 *   import { buildHomeContinuity }
 *     from 'src/core/home/homeContinuityEngine.js';
 *
 *   const v = buildHomeContinuity({
 *     governance,   // runRecommendationGovernance() output
 *     farmMemory,   // getFarmMemorySnapshot() output
 *     scanHistory,  // recent scans
 *     weather,
 *     cropLifecycle,
 *     locale,
 *   });
 *
 *   v = {
 *     todayFocus,           — { key, fallback, params }
 *     continuityInsight,    — { key, fallback, params } | null
 *     recoveryInsight,      — { key, fallback, params } | null
 *     weatherAwareness,     — { key, fallback, params } | null
 *     growthMomentum,       — { key, fallback, params } | null
 *     recommendationReason, — { key, fallback, params } | null
 *     oneBestAction,        — passthrough from governance
 *     urgency, confidenceTone,
 *     engineVersion:'home-continuity-v1', generatedAt: number,
 *   }
 *
 * What this is
 * ────────────
 *   The composer behind the spec's "Pepper plants recovered well
 *   after yesterday's watering." / "Humidity may increase fungal
 *   pressure tonight." Home surface. It does NOT generate raw
 *   insights — every signal comes from an engine already shipped:
 *
 *     • recommendationGovernanceEngine → oneBestAction + reason
 *     • farmMemorySnapshot             → recovery + recurrence
 *     • weather snapshot               → pressure framing
 *     • scanHistory                    → progression
 *
 *   ONE primary insight, calm operational tone, every visible
 *   string is a tSafe envelope.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • Every visible string is `{key, fallback, params}`.
 *   • No raw probabilities, no AI wording, no panic verbs.
 */

const ENGINE_VERSION = 'home-continuity-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── Sub-builders ────────────────────────────────────────────

function _todayFocusFor(governance) {
  if (governance && _isObj(governance.oneBestAction)) {
    return Object.freeze({
      key:      _str(governance.oneBestAction.key) || 'home.continuity.focus.calm',
      fallback: _str(governance.oneBestAction.fallback)
        || 'Walk your field and check crop health.',
      params:   governance.oneBestAction.params,
    });
  }
  return Object.freeze({
    key:      'home.continuity.focus.calm',
    fallback: 'Walk your field and check crop health.',
  });
}

function _recoveryInsightFor(farmMemory) {
  if (!_isObj(farmMemory)) return null;
  const flags = farmMemory.activeFlags || {};
  if (flags.hasSuccessfulInterventions && !flags.hasWorseningTrend) {
    return Object.freeze({
      key:      'home.continuity.recovery.successful',
      fallback: 'Your plants recovered well after recent care — keep the routine going.',
      params:   { count: _num(farmMemory.resolvedCount) || 0 },
    });
  }
  if (flags.hasWorseningTrend) {
    return Object.freeze({
      key:      'home.continuity.recovery.watch',
      fallback: 'A recent issue is still progressing — a quick check today will help.',
    });
  }
  return null;
}

function _continuityInsightFor(scanHistory, farmMemory) {
  // Healthy streak signal
  const recent = Array.isArray(scanHistory) ? scanHistory.slice(0, 4) : [];
  if (recent.length >= 3) {
    const healthyish = recent.every((s) => {
      const sev = _str(s && s.severity).toLowerCase();
      return sev === 'mild' || sev === '' || sev === 'healthy';
    });
    if (healthyish) {
      return Object.freeze({
        key:      'home.continuity.streak.healthy',
        fallback: 'Your scans this week have looked healthy.',
        params:   { count: recent.length },
      });
    }
  }
  // Recurrence-based continuity
  if (_isObj(farmMemory) && Array.isArray(farmMemory.recurringIssues)
      && farmMemory.recurringIssues.length > 0) {
    const top = farmMemory.recurringIssues[0];
    return Object.freeze({
      key:      'home.continuity.recurring',
      fallback: 'You have scanned this issue {count} times — let us try a different approach.',
      params:   { count: top.count || 2, category: top.category || '' },
    });
  }
  // Last scan signal
  const days = _num(farmMemory && farmMemory.daysSinceLastScan);
  if (days != null && days >= 7) {
    return Object.freeze({
      key:      'home.continuity.longGap',
      fallback: 'It has been {days} days since your last scan. A quick check helps catch issues early.',
      params:   { days },
    });
  }
  return null;
}

function _weatherAwarenessFor(weather) {
  if (!_isObj(weather)) return null;
  const temp = _num(weather.temp);
  const humidity = _num(weather.humidityPct);
  const rain = _num(weather.rainProbability24hPct);
  const wind = _num(weather.windSpeedKph);

  if (temp != null && temp <= 4) {
    return Object.freeze({
      key:      'home.continuity.weather.frost',
      fallback: 'Cold night ahead — protect sensitive plants.',
    });
  }
  if (temp != null && temp >= 34) {
    return Object.freeze({
      key:      'home.continuity.weather.heat',
      fallback: 'Warm temperatures may dry soil faster today.',
    });
  }
  if (humidity != null && humidity >= 80 && temp != null && temp >= 18 && temp <= 30) {
    return Object.freeze({
      key:      'home.continuity.weather.fungal',
      fallback: 'Humidity may increase fungal pressure tonight.',
    });
  }
  if (rain != null && rain >= 60) {
    return Object.freeze({
      key:      'home.continuity.weather.rain',
      fallback: 'Rain is likely soon — hold off on watering and check drainage.',
    });
  }
  if (wind != null && wind >= 35) {
    return Object.freeze({
      key:      'home.continuity.weather.wind',
      fallback: 'Strong wind expected — secure tall or young plants.',
    });
  }
  return null;
}

function _growthMomentumFor(cropLifecycle, farmMemory) {
  const stage = _str(cropLifecycle && cropLifecycle.currentStage).toLowerCase();
  if (stage === 'harvest') {
    return Object.freeze({
      key:      'home.continuity.momentum.harvest',
      fallback: 'Your crop is at harvest stage — perfect time to plan picking.',
    });
  }
  if (stage === 'fruiting' || stage === 'flowering') {
    return Object.freeze({
      key:      'home.continuity.momentum.activeStage',
      fallback: 'Your crop is in an active growth stage — stay close to the routine.',
    });
  }
  if (_isObj(farmMemory) && _num(farmMemory.resolvedCount) >= 2) {
    return Object.freeze({
      key:      'home.continuity.momentum.steady',
      fallback: 'Your farm is progressing steadily this week.',
    });
  }
  return null;
}

function _recommendationReasonFor(governance) {
  if (governance && _isObj(governance.reason)) {
    return Object.freeze({
      key:      _str(governance.reason.key) || 'home.continuity.reason.calm',
      fallback: _str(governance.reason.fallback) || 'A combination of recent signals suggested this action.',
      params:   governance.reason.params,
    });
  }
  return null;
}

// ─── Public ──────────────────────────────────────────────────

/**
 * Build the living-continuity envelope for the Home surface.
 * Always returns an envelope.
 */
export function buildHomeContinuity(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const governance     = safe.governance;
    const farmMemory     = safe.farmMemory;
    const scanHistory    = safe.scanHistory;
    const weather        = safe.weather;
    const cropLifecycle  = safe.cropLifecycle;
    const locale         = _str(safe.locale) || null;

    return Object.freeze({
      engineVersion:       ENGINE_VERSION,
      todayFocus:          _todayFocusFor(governance),
      continuityInsight:   _continuityInsightFor(scanHistory, farmMemory),
      recoveryInsight:     _recoveryInsightFor(farmMemory),
      weatherAwareness:    _weatherAwarenessFor(weather),
      growthMomentum:      _growthMomentumFor(cropLifecycle, farmMemory),
      recommendationReason: _recommendationReasonFor(governance),
      oneBestAction:       governance && governance.oneBestAction || null,
      urgency:             (governance && _str(governance.urgency)) || 'low',
      confidenceTone:      (governance && _str(governance.confidenceTone)) || 'medium_confidence',
      locale,
      generatedAt:         Date.now(),
    });
  }, _emptyEnvelope());
}

function _emptyEnvelope() {
  return Object.freeze({
    engineVersion:       ENGINE_VERSION,
    todayFocus:          _todayFocusFor(null),
    continuityInsight:   null,
    recoveryInsight:     null,
    weatherAwareness:    null,
    growthMomentum:      null,
    recommendationReason:null,
    oneBestAction:       null,
    urgency:             'low',
    confidenceTone:      'medium_confidence',
    locale:              null,
    generatedAt:         Date.now(),
  });
}

export const _internal = Object.freeze({
  _todayFocusFor, _continuityInsightFor, _recoveryInsightFor,
  _weatherAwarenessFor, _growthMomentumFor, _recommendationReasonFor,
  ENGINE_VERSION,
});

const _module = { buildHomeContinuity, _internal };
export default _module;
