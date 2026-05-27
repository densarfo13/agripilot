/**
 * confidenceLoopEngine.js — Farmer Confidence Loop Engine v1.
 *
 *   import {
 *     recordLoopEvent, getLoopEvents, getLoopFor, clearLoopEvents,
 *     LOOP_EVENT, LOOP_STAGE,
 *     buildLoopRecord, summariseLoopHealth,
 *     deriveLoopAdaptation,
 *   } from 'src/core/trust/confidenceLoopEngine.js';
 *
 *   recordLoopEvent('rec_42', LOOP_EVENT.SHOWN);
 *   recordLoopEvent('rec_42', LOOP_EVENT.ACKNOWLEDGED);
 *   recordLoopEvent('rec_42', LOOP_EVENT.ACTION_TAKEN, { kind: 'watered' });
 *   recordLoopEvent('rec_42', LOOP_EVENT.FOLLOWUP_SCAN);
 *   recordLoopEvent('rec_42', LOOP_EVENT.IMPROVED);  // → outcome confirmation
 *
 *   const record = buildLoopRecord('rec_42');   // full lifecycle envelope
 *   const health = summariseLoopHealth();       // global rollup
 *   const adapt  = deriveLoopAdaptation('rec_42'); // adaptation hints
 *
 * What this is
 * ────────────
 *   The closed-loop tracker that records every meaningful moment
 *   in a recommendation's life on a farm:
 *
 *     SHOWN → ACKNOWLEDGED → ACTION_TAKEN → FOLLOWUP_SCAN
 *           → IMPROVED | WORSENED | UNCHANGED | IGNORED
 *
 *   Each event is a row in a small rolling buffer. From the rows
 *   we derive:
 *     • per-recommendation lifecycle records (`buildLoopRecord`)
 *     • global trust health (`summariseLoopHealth`)
 *     • adaptation hints (`deriveLoopAdaptation`) that feed the
 *       Trust Explanation Engine + tone selection back into the UI
 *
 *   This composes — never replaces — three existing systems:
 *     • trustExplanationEngine.recordTrustAction (ACCEPTED / IGNORED / SUCCESSFUL / DISPUTED)
 *     • recommendationLearning.recordTaskAction  (priority-boost learner)
 *     • scanOutcomeTracker.recordScanOutcome     (per-scan confirmation)
 *
 *   recordLoopEvent ALSO forwards the appropriate signal into
 *   those stores when it makes sense (e.g. IMPROVED → trust action
 *   SUCCESSFUL; IGNORED → trust action IGNORED). The forwarders
 *   are wrapped in try/catch so a failure in one store never
 *   breaks the loop tracker.
 *
 * Strict-rule audit
 *   • Pure runtime. Never throws. SSR-safe.
 *   • localStorage wrapped in try/catch — quota / private mode
 *     silent-degrades to memory-only.
 *   • Rolling buffer (cap 500 events) so the log never grows
 *     unbounded on a long-tenure farmer.
 *   • Outcome confirmation prompts are envelopes — no surface logic.
 */

import {
  TRUST_ACTION, recordTrustAction,
} from './trustExplanationEngine.js';

const ENGINE_VERSION = 'confidence-loop-v1';
const STORAGE_KEY    = 'farroway:confidenceLoop:v1';
const MAX_EVENTS     = 500;

// ─── Constants ───────────────────────────────────────────────

export const LOOP_EVENT = Object.freeze({
  SHOWN:         'shown',
  ACKNOWLEDGED:  'acknowledged',
  ACTION_TAKEN:  'action_taken',
  FOLLOWUP_SCAN: 'followup_scan',
  IMPROVED:      'improved',
  WORSENED:      'worsened',
  UNCHANGED:     'unchanged',
  IGNORED:       'ignored',
  HELPFUL:       'marked_helpful',
  NOT_HELPFUL:   'marked_not_helpful',
});

export const LOOP_STAGE = Object.freeze({
  AWAITING_ACK:    'awaiting_ack',
  AWAITING_ACTION: 'awaiting_action',
  AWAITING_FOLLOWUP:'awaiting_followup',
  AWAITING_OUTCOME:'awaiting_outcome',
  COMPLETED:       'completed',
  IGNORED:         'ignored',
});

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const _VALID_EVENTS = new Set(Object.values(LOOP_EVENT));

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

// ─── Forwarders to existing stores ───────────────────────────

function _forwardTrustAction(recommendationId, event, meta) {
  // Map loop events → trust memory actions where appropriate.
  // Wrapped so forwarder failures cannot break the tracker.
  try {
    if (event === LOOP_EVENT.IMPROVED) {
      recordTrustAction(recommendationId, TRUST_ACTION.SUCCESSFUL, meta);
    } else if (event === LOOP_EVENT.WORSENED) {
      recordTrustAction(recommendationId, TRUST_ACTION.DISPUTED, meta);
    } else if (event === LOOP_EVENT.IGNORED) {
      recordTrustAction(recommendationId, TRUST_ACTION.IGNORED, meta);
    } else if (event === LOOP_EVENT.ACTION_TAKEN) {
      recordTrustAction(recommendationId, TRUST_ACTION.ACCEPTED, meta);
    } else if (event === LOOP_EVENT.ACKNOWLEDGED) {
      recordTrustAction(recommendationId, TRUST_ACTION.ACKNOWLEDGED, meta);
    }
  } catch { /* never break the tracker */ }
}

// ─── Public — event recording ────────────────────────────────

/**
 * Record one loop event for a recommendation. Idempotent on
 * (recommendationId, event) within a 30-second window — surfaces
 * that re-emit the same event twice in quick succession only get
 * one row.
 *
 * Returns the persisted row, or null on garbage input.
 */
export function recordLoopEvent(recommendationId, event, meta) {
  return _safe(() => {
    if (!recommendationId || typeof recommendationId !== 'string') return null;
    if (!_VALID_EVENTS.has(event)) return null;
    const safeMeta = _isObj(meta) ? meta : {};

    const row = Object.freeze({
      recommendationId,
      event,
      recordedAt:    Date.now(),
      type:          _str(safeMeta.type) || null,
      crop:          _str(safeMeta.crop) || null,
      region:        _str(safeMeta.region) || null,
      country:       _str(safeMeta.country) || null,
      severity:      _str(safeMeta.severity) || null,
      kind:          _str(safeMeta.kind) || null,
      scanId:        _str(safeMeta.scanId) || null,
      notes: (typeof safeMeta.notes === 'string' && safeMeta.notes)
        ? safeMeta.notes.slice(0, 240) : null,
    });

    const log = _safeGet();
    // Dedupe: same (id,event) within 30s.
    const last = log.length > 0 ? log[log.length - 1] : null;
    if (last && last.recommendationId === recommendationId
        && last.event === event
        && (row.recordedAt - last.recordedAt) < 30000) {
      return last;
    }

    log.push(row);
    if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
    _safeSet(log);

    // Forward to existing trust/learning stores.
    _forwardTrustAction(recommendationId, event, safeMeta);

    return row;
  }, null);
}

/** Read every recorded loop event. Latest-last. */
export function getLoopEvents() {
  return _safeGet();
}

/** All events for one recommendation, oldest-first. */
export function getLoopFor(recommendationId) {
  return _safe(() => {
    if (!recommendationId || typeof recommendationId !== 'string') return [];
    return _safeGet().filter((r) => r && r.recommendationId === recommendationId);
  }, []);
}

/** Drop the entire log — used by recovery hooks + tests. */
export function clearLoopEvents() {
  _safeSet([]);
}

// ─── Lifecycle record builder ────────────────────────────────

/**
 * Derive the current stage of a single recommendation from its
 * event history.
 */
function _stageFor(events) {
  if (!events || events.length === 0) return null;
  const has = (e) => events.some((r) => r.event === e);
  if (has(LOOP_EVENT.IMPROVED)
   || has(LOOP_EVENT.WORSENED)
   || has(LOOP_EVENT.UNCHANGED)
   || has(LOOP_EVENT.HELPFUL)
   || has(LOOP_EVENT.NOT_HELPFUL)) {
    return LOOP_STAGE.COMPLETED;
  }
  if (has(LOOP_EVENT.IGNORED)) return LOOP_STAGE.IGNORED;
  if (has(LOOP_EVENT.FOLLOWUP_SCAN)) return LOOP_STAGE.AWAITING_OUTCOME;
  if (has(LOOP_EVENT.ACTION_TAKEN)) return LOOP_STAGE.AWAITING_FOLLOWUP;
  if (has(LOOP_EVENT.ACKNOWLEDGED)) return LOOP_STAGE.AWAITING_ACTION;
  if (has(LOOP_EVENT.SHOWN))        return LOOP_STAGE.AWAITING_ACK;
  return null;
}

/**
 * Build the full lifecycle envelope for one recommendation.
 *   { recommendationId, stage, events, firstShownAt, lastEventAt,
 *     outcome, durationMs,
 *     outcomePromptNeeded, outcomePrompt: {key, fallback, options} | null }
 */
export function buildLoopRecord(recommendationId) {
  return _safe(() => {
    if (!recommendationId || typeof recommendationId !== 'string') {
      return _emptyRecord(recommendationId);
    }
    const events = getLoopFor(recommendationId);
    if (events.length === 0) return _emptyRecord(recommendationId);

    const stage = _stageFor(events);
    const firstShownAt = events[0].recordedAt;
    const lastEventAt  = events[events.length - 1].recordedAt;

    let outcome = null;
    for (const r of events) {
      if (r.event === LOOP_EVENT.IMPROVED)  outcome = 'improved';
      else if (r.event === LOOP_EVENT.WORSENED)  outcome = 'worsened';
      else if (r.event === LOOP_EVENT.UNCHANGED) outcome = 'unchanged';
    }

    // Outcome prompt: ready to ask only when we have a follow-up
    // scan but no outcome yet AND it's been at least 6 hours since
    // the follow-up.
    const followUpEvt = events.find((r) => r.event === LOOP_EVENT.FOLLOWUP_SCAN);
    const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
    const outcomePromptNeeded = !outcome
      && followUpEvt != null
      && followUpEvt.recordedAt <= sixHoursAgo;

    const outcomePrompt = outcomePromptNeeded
      ? Object.freeze({
          key:      'confidenceLoop.outcome.prompt',
          fallback: 'How did the plant respond?',
          options:  Object.freeze([
            Object.freeze({
              event: LOOP_EVENT.IMPROVED,
              key:   'confidenceLoop.outcome.improved',
              fallback: 'It is improving',
            }),
            Object.freeze({
              event: LOOP_EVENT.UNCHANGED,
              key:   'confidenceLoop.outcome.unchanged',
              fallback: 'About the same',
            }),
            Object.freeze({
              event: LOOP_EVENT.WORSENED,
              key:   'confidenceLoop.outcome.worsened',
              fallback: 'It is getting worse',
            }),
          ]),
        })
      : null;

    return Object.freeze({
      engineVersion:       ENGINE_VERSION,
      recommendationId,
      stage,
      events:              Object.freeze(events),
      firstShownAt,
      lastEventAt,
      durationMs:          lastEventAt - firstShownAt,
      outcome,
      outcomePromptNeeded,
      outcomePrompt,
    });
  }, _emptyRecord(recommendationId));
}

function _emptyRecord(recommendationId) {
  return Object.freeze({
    engineVersion:       ENGINE_VERSION,
    recommendationId:    _str(recommendationId) || 'unknown',
    stage:               null,
    events:              Object.freeze([]),
    firstShownAt:        null,
    lastEventAt:         null,
    durationMs:          0,
    outcome:             null,
    outcomePromptNeeded: false,
    outcomePrompt:       null,
  });
}

// ─── Global loop-health summary ──────────────────────────────

/**
 * Roll up the entire loop log into a summary the surfaces use to
 * decide the daily Farm Trust State.
 *
 *   { totalRecommendations, completedCount, improvedCount,
 *     worsenedCount, unchangedCount, ignoredCount,
 *     acknowledgmentRate, actionRate, followThroughRate,
 *     improvementRate, engagementScore,
 *     activeWindowDays, lastEventAt }
 *
 * Rates are 0..1 floats. engagementScore is a composite 0..100
 * intended for internal use; surfaces should NOT display it raw.
 */
export function summariseLoopHealth(opts) {
  return _safe(() => {
    const o = _isObj(opts) ? opts : {};
    const windowDays = _num(o.windowDays) || 30;
    const cutoff = Date.now() - (windowDays * 24 * 60 * 60 * 1000);

    const events = _safeGet().filter((r) => r && r.recordedAt >= cutoff);
    if (events.length === 0) return _emptyHealth(windowDays);

    // Group events by recommendationId.
    const byRec = new Map();
    for (const r of events) {
      if (!byRec.has(r.recommendationId)) byRec.set(r.recommendationId, []);
      byRec.get(r.recommendationId).push(r);
    }

    let total = 0;
    let shown = 0, acked = 0, acted = 0, followed = 0;
    let improved = 0, worsened = 0, unchanged = 0, ignored = 0;
    let completed = 0;
    let lastEventAt = null;

    for (const [, list] of byRec) {
      total += 1;
      const has = (e) => list.some((r) => r.event === e);
      if (has(LOOP_EVENT.SHOWN))         shown += 1;
      if (has(LOOP_EVENT.ACKNOWLEDGED))  acked += 1;
      if (has(LOOP_EVENT.ACTION_TAKEN))  acted += 1;
      if (has(LOOP_EVENT.FOLLOWUP_SCAN)) followed += 1;
      if (has(LOOP_EVENT.IMPROVED))      improved += 1;
      if (has(LOOP_EVENT.WORSENED))      worsened += 1;
      if (has(LOOP_EVENT.UNCHANGED))     unchanged += 1;
      if (has(LOOP_EVENT.IGNORED))       ignored += 1;
      if (has(LOOP_EVENT.IMPROVED)
       || has(LOOP_EVENT.WORSENED)
       || has(LOOP_EVENT.UNCHANGED)) completed += 1;
      const lst = list[list.length - 1];
      if (lst && (lastEventAt == null || lst.recordedAt > lastEventAt)) {
        lastEventAt = lst.recordedAt;
      }
    }

    const safeDiv = (a, b) => (b > 0 ? a / b : 0);
    const ackRate          = safeDiv(acked, shown || total);
    const actionRate       = safeDiv(acted, acked || shown || total);
    const followThroughRate= safeDiv(followed, acted || shown || total);
    const improvementRate  = safeDiv(improved, completed || 0);

    // Engagement score 0..100. Weighted blend of the four rates +
    // raw activity volume. Cap at 100.
    const engagementScore = Math.min(100, Math.round(
      ackRate * 25
      + actionRate * 25
      + followThroughRate * 20
      + improvementRate * 25
      + Math.min(1, total / 10) * 5,
    ));

    return Object.freeze({
      engineVersion:       ENGINE_VERSION,
      totalRecommendations:total,
      completedCount:      completed,
      improvedCount:       improved,
      worsenedCount:       worsened,
      unchangedCount:      unchanged,
      ignoredCount:        ignored,
      acknowledgmentRate:  ackRate,
      actionRate,
      followThroughRate,
      improvementRate,
      engagementScore,
      activeWindowDays:    windowDays,
      lastEventAt,
    });
  }, _emptyHealth(30));
}

function _emptyHealth(windowDays) {
  return Object.freeze({
    engineVersion:       ENGINE_VERSION,
    totalRecommendations:0,
    completedCount:      0,
    improvedCount:       0,
    worsenedCount:       0,
    unchangedCount:      0,
    ignoredCount:        0,
    acknowledgmentRate:  0,
    actionRate:          0,
    followThroughRate:   0,
    improvementRate:     0,
    engagementScore:     0,
    activeWindowDays:    windowDays,
    lastEventAt:         null,
  });
}

// ─── Per-recommendation adaptation hints ─────────────────────

/**
 * Decide how a future surface should adapt its tone, timing, and
 * wording for ONE recommendation based on its event history.
 *
 *   {
 *     shouldSuppressRepetition,  — true if shown too often without ack
 *     shouldRewordSofter,        — true if ignored repeatedly
 *     shouldDelayTiming,         — true if shown at the wrong time
 *     shouldReinforceWording,    — true if followed successfully
 *     toneHint:                  'calm' | 'supportive' | 'operational' | 'gentle_followup',
 *     timingHint:                'sooner' | 'normal' | 'later' | 'pause',
 *     copyBoost:                 'reinforce' | 'reword_softer' | 'normal',
 *   }
 */
export function deriveLoopAdaptation(recommendationId) {
  return _safe(() => {
    if (!recommendationId || typeof recommendationId !== 'string') {
      return _defaultAdaptation();
    }
    const events = getLoopFor(recommendationId);
    if (events.length === 0) return _defaultAdaptation();

    const has = (e) => events.some((r) => r.event === e);
    const count = (e) => events.filter((r) => r.event === e).length;

    const shown      = count(LOOP_EVENT.SHOWN);
    const acked      = count(LOOP_EVENT.ACKNOWLEDGED);
    const ignored    = count(LOOP_EVENT.IGNORED);
    const improved   = has(LOOP_EVENT.IMPROVED);
    const worsened   = has(LOOP_EVENT.WORSENED);
    const notHelpful = has(LOOP_EVENT.NOT_HELPFUL);

    const shouldSuppressRepetition = (shown >= 3 && acked === 0);
    const shouldRewordSofter       = (ignored >= 2 || notHelpful);
    const shouldDelayTiming        = (shown >= 4 && (ignored >= 1 || acked === 0));
    const shouldReinforceWording   = improved && !worsened;

    let toneHint = 'calm';
    if (worsened || notHelpful)             toneHint = 'operational';
    else if (improved)                      toneHint = 'supportive';
    else if (ignored >= 2 || shown >= 3)    toneHint = 'gentle_followup';

    let timingHint = 'normal';
    if (shouldDelayTiming)              timingHint = 'later';
    else if (shown >= 5 && ignored >= 3) timingHint = 'pause';
    else if (improved)                  timingHint = 'normal';

    let copyBoost = 'normal';
    if (shouldReinforceWording) copyBoost = 'reinforce';
    else if (shouldRewordSofter) copyBoost = 'reword_softer';

    return Object.freeze({
      shouldSuppressRepetition,
      shouldRewordSofter,
      shouldDelayTiming,
      shouldReinforceWording,
      toneHint,
      timingHint,
      copyBoost,
    });
  }, _defaultAdaptation());
}

function _defaultAdaptation() {
  return Object.freeze({
    shouldSuppressRepetition: false,
    shouldRewordSofter:       false,
    shouldDelayTiming:        false,
    shouldReinforceWording:   false,
    toneHint:                 'calm',
    timingHint:               'normal',
    copyBoost:                'normal',
  });
}

// ─── _internal handle for tests ──────────────────────────────

export const _internal = Object.freeze({
  _stageFor, _forwardTrustAction, _emptyHealth, _emptyRecord, _defaultAdaptation,
  ENGINE_VERSION,
});

const _module = {
  LOOP_EVENT, LOOP_STAGE,
  recordLoopEvent, getLoopEvents, getLoopFor, clearLoopEvents,
  buildLoopRecord, summariseLoopHealth, deriveLoopAdaptation,
  _internal,
};
export default _module;
