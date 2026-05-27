/**
 * trustExplanationEngine.js — Farmer Trust Engine v1.
 *
 *   import {
 *     buildTrustExplanation, CONFIDENCE, TRUST_ACTION,
 *     recordTrustAction, getTrustMemory, getTrustHistoryFor,
 *     deriveTrustTone, applyTrustNoiseSuppression,
 *   } from 'src/core/trust/trustExplanationEngine.js';
 *
 *   const explanation = buildTrustExplanation({
 *     recommendation,                  // { id, type, action, reason, urgency, ... }
 *     signals: {
 *       weather, scan, cropLifecycle, region,
 *       farmMemory, taskHistory,
 *     },
 *     memory:  getTrustMemory(),
 *     locale:  'en',
 *   });
 *
 *   explanation = {
 *     recommendationId,
 *     confidenceTone:  'high_confidence' | 'medium_confidence' | 'needs_review',
 *     confidenceLabel: { key, fallback },
 *     whyAppeared:     { key, fallback, params },
 *     signals: [{ kind, key, fallback, params }],   // 1..N human-friendly sources
 *     whatToMonitor:   { key, fallback, params } | null,
 *     urgencyLabel:    { key, fallback },
 *     toneStyle:       'calm' | 'supportive' | 'operational' | 'gentle_followup',
 *     acknowledged:    boolean,
 *     suppressedBy:    'acknowledged' | 'repeatedly_ignored' | null,
 *     engineVersion:   'trust-explanation-v1',
 *     generatedAt:     number,
 *   }
 *
 * What this is
 * ────────────
 *   The user-FACING "why am I seeing this?" surface. Every
 *   recommendation that reaches the UI now ships with a calm,
 *   plain-language explanation envelope built from:
 *
 *     • weather signals           (rain, heat, frost, wind)
 *     • scan results              (severity, recurrence)
 *     • crop lifecycle stage      (flowering, harvest, etc.)
 *     • region intelligence       (regional outbreaks, soil)
 *     • farm memory               (past recurrences, recovery wins)
 *     • task completion history   (recent watering, treatments)
 *     • recurrence flags          (this issue has happened before)
 *
 *   The engine HEDGES — no raw probabilities, no AI talk, no
 *   alarmism. Confidence is a tone (HIGH / MEDIUM / NEEDS_REVIEW),
 *   not a number.
 *
 *   Composes — never replaces:
 *     • recommendationSuppression for noise suppression
 *     • recommendationLearning   for accept/ignore history
 *     • farmMemorySnapshot       for active flags
 *     • scanOutcomeTracker       for resolved/worsened history
 *
 *   Multilingual: every visible string is a `{key, fallback, params}`
 *   envelope. tSafe resolves at render time. Cultural tone is preserved
 *   through the translator-authored locale columns + the
 *   productionGapTranslations overlay.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • localStorage wrapped in try/catch — quota / private mode
 *     silent-degrades to memory-only.
 *   • Rolling buffer (cap 200 actions) so trust memory never grows
 *     unbounded.
 */

const ENGINE_VERSION = 'trust-explanation-v1';
const STORAGE_KEY    = 'farroway:trustActions:v1';
const MAX_ACTIONS    = 200;

// ─── Constants ───────────────────────────────────────────────

export const CONFIDENCE = Object.freeze({
  HIGH:         'high_confidence',
  MEDIUM:       'medium_confidence',
  NEEDS_REVIEW: 'needs_review',
});

export const TRUST_ACTION = Object.freeze({
  ACCEPTED:    'accepted',
  IGNORED:     'ignored',
  SUCCESSFUL:  'successful',
  DISPUTED:    'disputed',
  ACKNOWLEDGED:'acknowledged',
});

export const TONE = Object.freeze({
  CALM:             'calm',
  SUPPORTIVE:       'supportive',
  OPERATIONAL:      'operational',
  GENTLE_FOLLOWUP:  'gentle_followup',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// ─── localStorage helpers ────────────────────────────────────

function _safeGet() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function _safeSet(arr) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch { /* quota / private mode — degrade silently */ }
}

function _isValidAction(v) {
  return typeof v === 'string' && Object.values(TRUST_ACTION).includes(v);
}

// ─── Trust memory persistence ────────────────────────────────

/**
 * Record a farmer action against a specific recommendation. Used
 * to adapt the trust tone over time:
 *   • repeated IGNORED → "you may have already addressed this"
 *   • SUCCESSFUL       → "your past care worked — try the same"
 *   • DISPUTED         → "we may have read this wrong"
 *
 * @param {string} recommendationId
 * @param {string} action  — TRUST_ACTION.*
 * @param {object} [meta]
 * @returns {object|null} the persisted row, or null on garbage input
 */
export function recordTrustAction(recommendationId, action, meta) {
  return _safe(() => {
    if (!recommendationId || typeof recommendationId !== 'string') return null;
    if (!_isValidAction(action)) return null;
    const safeMeta = (_isObj(meta)) ? meta : {};
    const row = Object.freeze({
      recommendationId,
      action,
      recordedAt:    Date.now(),
      type:          _str(safeMeta.type) || null,
      crop:          _str(safeMeta.crop) || null,
      region:        _str(safeMeta.region) || null,
      urgency:       _str(safeMeta.urgency) || null,
      reasonKey:     _str(safeMeta.reasonKey) || null,
      notes: (typeof safeMeta.notes === 'string' && safeMeta.notes)
        ? safeMeta.notes.slice(0, 240) : null,
    });
    const log = _safeGet();
    log.push(row);
    if (log.length > MAX_ACTIONS) log.splice(0, log.length - MAX_ACTIONS);
    _safeSet(log);
    return row;
  }, null);
}

/** Read every recorded action. Latest-last. */
export function getTrustMemory() {
  return _safeGet();
}

/** All actions for a recommendation, newest-first. */
export function getTrustHistoryFor(recommendationId) {
  return _safe(() => {
    if (!recommendationId || typeof recommendationId !== 'string') return [];
    const log = _safeGet();
    const out = [];
    for (let i = log.length - 1; i >= 0; i--) {
      const r = log[i];
      if (r && r.recommendationId === recommendationId) out.push(r);
    }
    return out;
  }, []);
}

/** Drop the entire log — used by recovery hooks + tests. */
export function clearTrustMemory() {
  _safeSet([]);
}

// ─── Tone derivation ─────────────────────────────────────────

/**
 * Roll up the trust log into a per-recommendation tone hint.
 *
 *   { ignoredCount, acceptedCount, successfulCount, disputedCount,
 *     acknowledgedCount, lastActionMs, dominantTone }
 *
 * The dominant tone tells future explanation builders which voice
 * to use:
 *   - GENTLE_FOLLOWUP : repeatedly ignored / acknowledged
 *   - SUPPORTIVE      : successful in the past
 *   - OPERATIONAL     : disputed (we got it wrong before — be plain)
 *   - CALM            : default
 */
export function deriveTrustTone(memory, recommendationId) {
  return _safe(() => {
    const list = Array.isArray(memory) ? memory : _safeGet();
    let ignored = 0, accepted = 0, successful = 0, disputed = 0, acknowledged = 0;
    let lastActionMs = null;
    for (const r of list) {
      if (!r) continue;
      if (recommendationId && r.recommendationId !== recommendationId) continue;
      if (r.action === TRUST_ACTION.IGNORED)     ignored++;
      if (r.action === TRUST_ACTION.ACCEPTED)    accepted++;
      if (r.action === TRUST_ACTION.SUCCESSFUL)  successful++;
      if (r.action === TRUST_ACTION.DISPUTED)    disputed++;
      if (r.action === TRUST_ACTION.ACKNOWLEDGED) acknowledged++;
      const t = _num(r.recordedAt);
      if (t != null && (lastActionMs == null || t > lastActionMs)) lastActionMs = t;
    }
    let dominantTone = TONE.CALM;
    if (disputed >= 1)            dominantTone = TONE.OPERATIONAL;
    else if (ignored >= 2 || acknowledged >= 1) dominantTone = TONE.GENTLE_FOLLOWUP;
    else if (successful >= 1)     dominantTone = TONE.SUPPORTIVE;
    return Object.freeze({
      ignoredCount:      ignored,
      acceptedCount:     accepted,
      successfulCount:   successful,
      disputedCount:     disputed,
      acknowledgedCount: acknowledged,
      lastActionMs,
      dominantTone,
    });
  }, Object.freeze({
    ignoredCount: 0, acceptedCount: 0, successfulCount: 0,
    disputedCount: 0, acknowledgedCount: 0,
    lastActionMs: null, dominantTone: TONE.CALM,
  }));
}

// ─── Signal aggregator ───────────────────────────────────────

/**
 * Turn raw signal objects into a small ordered list of human-friendly
 * `{kind, key, fallback, params}` envelopes. Cap at 4 — surfaces
 * stay calm.
 */
function _aggregateSignals(signals) {
  if (!_isObj(signals)) return [];
  const out = [];

  // Weather
  const w = signals.weather;
  if (_isObj(w)) {
    const temp = _num(w.temp);
    const rainPct = _num(w.rainProbability24hPct);
    const wind = _num(w.windSpeedKph);
    const humidity = _num(w.humidityPct);
    if (temp != null && temp <= 4) {
      out.push(Object.freeze({
        kind: 'weather',
        key:  'trust.signal.weather.frost',
        fallback: 'Overnight temperatures look very low.',
        params: { temp },
      }));
    } else if (temp != null && temp >= 34) {
      out.push(Object.freeze({
        kind: 'weather',
        key:  'trust.signal.weather.heat',
        fallback: 'The day is expected to be very warm.',
        params: { temp },
      }));
    } else if (rainPct != null && rainPct >= 60) {
      out.push(Object.freeze({
        kind: 'weather',
        key:  'trust.signal.weather.rain',
        fallback: 'Rain is likely soon.',
        params: { pct: rainPct },
      }));
    } else if (wind != null && wind >= 35) {
      out.push(Object.freeze({
        kind: 'weather',
        key:  'trust.signal.weather.wind',
        fallback: 'Wind is forecast to be strong.',
        params: { wind },
      }));
    } else if (humidity != null && humidity >= 80) {
      out.push(Object.freeze({
        kind: 'weather',
        key:  'trust.signal.weather.humidity',
        fallback: 'Humidity is high enough to keep leaves wet.',
        params: { humidity },
      }));
    }
  }

  // Scan
  const sc = signals.scan;
  if (_isObj(sc)) {
    const sev = _str(sc.severity).toLowerCase();
    if (sev === 'serious' || sev === 'moderate') {
      out.push(Object.freeze({
        kind: 'scan',
        key:  'trust.signal.scan.severity.' + sev,
        fallback: sev === 'serious'
          ? 'Your latest scan flagged a serious issue.'
          : 'Your latest scan flagged a moderate issue.',
      }));
    } else if (sc.monitoringNeeded === true) {
      out.push(Object.freeze({
        kind: 'scan',
        key:  'trust.signal.scan.monitor',
        fallback: 'Your latest scan suggested keeping a closer eye on this plant.',
      }));
    }
  }

  // Crop lifecycle
  const cl = signals.cropLifecycle;
  if (_isObj(cl)) {
    const stage = _str(cl.currentStage).toLowerCase();
    if (stage === 'flowering' || stage === 'fruiting' || stage === 'harvest') {
      out.push(Object.freeze({
        kind: 'lifecycle',
        key:  'trust.signal.lifecycle.' + stage,
        fallback: stage === 'harvest'
          ? 'Your crop is at harvest stage.'
          : stage === 'fruiting'
            ? 'Your crop is in the fruiting stage — a sensitive window.'
            : 'Your crop is flowering — a sensitive stage.',
      }));
    }
  }

  // Region intelligence
  const rg = signals.region;
  if (_isObj(rg)) {
    if (Array.isArray(rg.activeOutbreaks) && rg.activeOutbreaks.length > 0) {
      out.push(Object.freeze({
        kind: 'region',
        key:  'trust.signal.region.outbreak',
        fallback: 'Other farms nearby have reported the same issue recently.',
        params: { count: rg.activeOutbreaks.length },
      }));
    }
  }

  // Farm memory
  const fm = signals.farmMemory;
  if (_isObj(fm) && _isObj(fm.activeFlags)) {
    if (fm.activeFlags.hasRecurringIssue) {
      out.push(Object.freeze({
        kind: 'memory',
        key:  'trust.signal.memory.recurring',
        fallback: 'You have scanned this same issue on your farm before.',
      }));
    } else if (fm.activeFlags.hasWorseningTrend) {
      out.push(Object.freeze({
        kind: 'memory',
        key:  'trust.signal.memory.worsening',
        fallback: 'Recent scans suggest this is getting worse, not better.',
      }));
    } else if (fm.activeFlags.hasSuccessfulInterventions) {
      out.push(Object.freeze({
        kind: 'memory',
        key:  'trust.signal.memory.priorWins',
        fallback: 'Past care on this farm has worked before — the same approach can help here.',
      }));
    }
  }

  // Task history
  const th = signals.taskHistory;
  if (_isObj(th)) {
    const daysSince = _num(th.daysSinceLastWatering);
    if (daysSince != null && daysSince >= 3) {
      out.push(Object.freeze({
        kind: 'task',
        key:  'trust.signal.task.lastWatering',
        fallback: 'It has been {days} days since the last watering you logged.',
        params: { days: daysSince },
      }));
    }
  }

  return out.slice(0, 4);
}

// ─── Confidence assessment ───────────────────────────────────

/**
 * Decide the confidence tone from how many independent signals
 * back the recommendation + how strong each was.
 *
 *   ≥ 3 distinct sources, no disputed-memory → HIGH
 *   2 sources, OR memory says disputed       → MEDIUM
 *   1 source, OR memory says ignored often   → NEEDS_REVIEW
 */
function _confidenceFor(signalList, toneInfo, recommendation) {
  const sourceKinds = new Set(signalList.map((s) => s.kind));
  const sources = sourceKinds.size;

  // Disputed past → don't pretend high confidence
  if (toneInfo && toneInfo.disputedCount >= 1) return CONFIDENCE.NEEDS_REVIEW;
  // Ignored repeatedly → calmly mark needs-review so we adapt
  if (toneInfo && toneInfo.ignoredCount >= 3) return CONFIDENCE.NEEDS_REVIEW;
  // High-urgency + 2+ sources → high confidence
  const urgency = _str(recommendation && recommendation.urgency).toLowerCase();
  if (sources >= 3) return CONFIDENCE.HIGH;
  if (sources >= 2 || urgency === 'high') return CONFIDENCE.MEDIUM;
  if (sources >= 1) return CONFIDENCE.MEDIUM;
  return CONFIDENCE.NEEDS_REVIEW;
}

function _confidenceLabel(conf) {
  switch (conf) {
    case CONFIDENCE.HIGH:
      return Object.freeze({ key: 'trust.confidence.high', fallback: 'High confidence' });
    case CONFIDENCE.MEDIUM:
      return Object.freeze({ key: 'trust.confidence.medium', fallback: 'Medium confidence' });
    case CONFIDENCE.NEEDS_REVIEW:
    default:
      return Object.freeze({ key: 'trust.confidence.needsReview', fallback: 'Needs review' });
  }
}

function _urgencyLabel(urgency) {
  const u = _str(urgency).toLowerCase();
  if (u === 'high') return Object.freeze({ key: 'trust.urgency.high', fallback: 'Act today' });
  if (u === 'medium') return Object.freeze({ key: 'trust.urgency.medium', fallback: 'Worth checking soon' });
  return Object.freeze({ key: 'trust.urgency.low', fallback: 'Whenever you next walk the field' });
}

function _whyAppearedFor(recommendation, signalList, toneInfo) {
  // Prefer explicit reason from the recommendation if it has one
  // (decisionPriorityEngine always emits one).
  if (recommendation && _isObj(recommendation.reason)) {
    return Object.freeze({
      key:      _str(recommendation.reason.key) || 'trust.why.fallback',
      fallback: _str(recommendation.reason.fallback) || 'A combination of recent signals suggested this action.',
      params:   recommendation.reason.params,
    });
  }
  if (signalList.length === 0) {
    return Object.freeze({
      key:      'trust.why.fallback',
      fallback: 'A combination of recent signals suggested this action.',
    });
  }
  if (toneInfo && toneInfo.successfulCount >= 1) {
    return Object.freeze({
      key:      'trust.why.successful',
      fallback: 'This worked before on your farm — the same approach can help here.',
    });
  }
  return Object.freeze({
    key:      'trust.why.signalsCombined',
    fallback: 'Recent signals from your farm point to this action.',
    params:   { count: signalList.length },
  });
}

function _whatToMonitorFor(recommendation, signalList) {
  // Lifecycle / scan signals deserve a monitor hint.
  const hasScan = signalList.some((s) => s.kind === 'scan');
  const hasMemory = signalList.some((s) => s.kind === 'memory');
  if (hasScan) {
    return Object.freeze({
      key:      'trust.monitor.scan',
      fallback: 'Re-scan the same plant in 2–4 days to see if it is improving.',
    });
  }
  if (hasMemory) {
    return Object.freeze({
      key:      'trust.monitor.memory',
      fallback: 'Walk the field once a day for the next few days to catch early signs.',
    });
  }
  // Pass-through if the recommendation provided its own followUp.
  if (recommendation && _isObj(recommendation.followUp)) {
    return Object.freeze({
      key:      _str(recommendation.followUp.key),
      fallback: _str(recommendation.followUp.fallback),
      params:   recommendation.followUp.params,
    });
  }
  return null;
}

// ─── Public — main explanation builder ───────────────────────

/**
 * Build the explanation envelope for ONE recommendation. Always
 * returns an envelope, never throws.
 *
 * @param {object} input
 * @param {object} input.recommendation — the recommendation to explain
 * @param {object} [input.signals]      — { weather, scan, cropLifecycle, region, farmMemory, taskHistory }
 * @param {Array}  [input.memory]       — getTrustMemory() output
 * @param {string} [input.locale]
 * @returns {object}
 */
export function buildTrustExplanation(input) {
  return _safe(() => {
    const safe = _isObj(input) ? input : {};
    const rec = _isObj(safe.recommendation) ? safe.recommendation : null;
    const recId = _str(rec && (rec.id || rec.candidateId || rec.type))
      || 'unknown';

    const signals = _isObj(safe.signals) ? safe.signals : {};
    const signalList = _aggregateSignals(signals);
    const memory = Array.isArray(safe.memory) ? safe.memory : _safeGet();
    const toneInfo = deriveTrustTone(memory, recId);
    const acknowledged = toneInfo.acknowledgedCount >= 1
      && (_num(toneInfo.lastActionMs) != null
          && (Date.now() - toneInfo.lastActionMs) < (24 * 60 * 60 * 1000));

    const suppressedBy = acknowledged
      ? 'acknowledged'
      : toneInfo.ignoredCount >= 3
        ? 'repeatedly_ignored'
        : null;

    const conf = _confidenceFor(signalList, toneInfo, rec);
    const whyAppeared = _whyAppearedFor(rec, signalList, toneInfo);
    const whatToMonitor = _whatToMonitorFor(rec, signalList);

    return Object.freeze({
      engineVersion:    ENGINE_VERSION,
      recommendationId: recId,
      confidenceTone:   conf,
      confidenceLabel:  _confidenceLabel(conf),
      whyAppeared,
      signals:          Object.freeze(signalList),
      whatToMonitor,
      urgencyLabel:     _urgencyLabel(rec && rec.urgency),
      toneStyle:        toneInfo.dominantTone,
      acknowledged,
      suppressedBy,
      generatedAt:      Date.now(),
    });
  }, _emptyExplanation(input));
}

function _emptyExplanation(input) {
  const recId = _str(_isObj(input)
    && _isObj(input.recommendation)
    && (input.recommendation.id || input.recommendation.candidateId)) || 'unknown';
  return Object.freeze({
    engineVersion:    ENGINE_VERSION,
    recommendationId: recId,
    confidenceTone:   CONFIDENCE.NEEDS_REVIEW,
    confidenceLabel:  _confidenceLabel(CONFIDENCE.NEEDS_REVIEW),
    whyAppeared:      Object.freeze({
      key:      'trust.why.fallback',
      fallback: 'A combination of recent signals suggested this action.',
    }),
    signals:          Object.freeze([]),
    whatToMonitor:    null,
    urgencyLabel:     _urgencyLabel('low'),
    toneStyle:        TONE.CALM,
    acknowledged:     false,
    suppressedBy:     null,
    generatedAt:      Date.now(),
  });
}

// ─── Noise suppression ───────────────────────────────────────

/**
 * Filter a list of candidate recommendations by:
 *   • already-acknowledged within the last 24h
 *   • repeatedly-ignored across a longer window
 *
 * Returns `{ kept, suppressed }`. Composes with the existing
 * `recommendationSuppression.suppressRecommendations` — that filter
 * handles rain conflicts / staleness / dupes; THIS layer adds the
 * trust-memory dimension (don't nag a farmer who acknowledged).
 *
 * @param {Array<object>} candidates
 * @param {object} [opts]
 * @param {Array} [opts.memory]     — getTrustMemory() output
 * @param {number} [opts.maxIgnores] — default 3
 * @param {number} [opts.ackWindowMs] — default 24h
 * @param {number} [opts.nowMs]
 * @returns {{kept:Array, suppressed:Array}}
 */
export function applyTrustNoiseSuppression(candidates, opts) {
  return _safe(() => {
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    const o = _isObj(opts) ? opts : {};
    const memory = Array.isArray(o.memory) ? o.memory : _safeGet();
    const maxIgnores = _num(o.maxIgnores) != null ? o.maxIgnores : 3;
    const ackWindowMs = _num(o.ackWindowMs) != null ? o.ackWindowMs : 24 * 60 * 60 * 1000;
    const nowMs = _num(o.nowMs) != null ? o.nowMs : Date.now();

    const kept = [];
    const suppressed = [];
    for (const rec of list) {
      if (!_isObj(rec)) continue;
      const id = _str(rec.id || rec.candidateId || rec.type) || 'unknown';
      const tone = deriveTrustTone(memory, id);
      // 1. Acknowledged in the ack window → drop.
      if (tone.acknowledgedCount >= 1
          && tone.lastActionMs != null
          && (nowMs - tone.lastActionMs) < ackWindowMs) {
        suppressed.push(Object.freeze({
          candidate: rec,
          reason: 'acknowledged',
          reasonLabel: Object.freeze({
            key: 'trust.suppressed.acknowledged',
            fallback: 'You already acknowledged this — we will stay quiet for a day.',
          }),
        }));
        continue;
      }
      // 2. Repeatedly ignored → drop.
      if (tone.ignoredCount >= maxIgnores) {
        suppressed.push(Object.freeze({
          candidate: rec,
          reason: 'repeatedly_ignored',
          reasonLabel: Object.freeze({
            key: 'trust.suppressed.repeatedlyIgnored',
            fallback: 'You have skipped this several times — we will hold off unless things change.',
          }),
        }));
        continue;
      }
      kept.push(rec);
    }
    return Object.freeze({
      kept:       Object.freeze(kept),
      suppressed: Object.freeze(suppressed),
    });
  }, Object.freeze({ kept: Object.freeze([]), suppressed: Object.freeze([]) }));
}

// ─── _internal handle for tests ──────────────────────────────

export const _internal = Object.freeze({
  _aggregateSignals,
  _confidenceFor,
  _confidenceLabel,
  _urgencyLabel,
  _whyAppearedFor,
  _whatToMonitorFor,
  ENGINE_VERSION,
});

const _module = {
  buildTrustExplanation,
  CONFIDENCE, TRUST_ACTION, TONE,
  recordTrustAction, getTrustMemory, getTrustHistoryFor,
  clearTrustMemory, deriveTrustTone,
  applyTrustNoiseSuppression,
  _internal,
};
export default _module;
