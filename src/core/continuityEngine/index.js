/**
 * continuityEngine — the farm's evolving story.
 *
 *   import { getNextBestAction, getRecentMemory, recordEvent }
 *     from '../core/continuityEngine';
 *
 *   const action = getNextBestAction();
 *   //   { title, reason, urgency, bestTime, confidenceTone, cta, source }
 *
 *   const memory = getRecentMemory();
 *   //   { lastScan, lastTask, lastWeatherChange, lastRecommendation }
 *
 * Why this module exists
 *   The Continuity + Memory + Orchestration spec asks Farroway to
 *   stop feeling like disconnected screens. Every action should
 *   update the farm's evolving story — Home should remember the
 *   last scan, suggest the right follow-up, surface only the most
 *   urgent action, and let routine updates fade into the journal.
 *
 *   This engine is the facade that ties together the modules that
 *   were already shipping:
 *     • farmEventBus           — pub/sub for FarmEvents
 *     • farmContextEngine      — canonical farm snapshot
 *     • scanHistoryStore       — persisted scan timeline + follow-up dates
 *     • getPrimaryGuidance     — recommendation orchestrator (priority ladder)
 *     • dailyBriefing          — "today's plan" composer
 *     • farmHealthStatus       — Healthy / Needs attention / High risk
 *     • offlineScanQueue       — pending scan upload queue
 *   It adds a short-term memory layer on top so Home can say
 *   "You checked your tomatoes yesterday" instead of "Good morning."
 *
 * Spec mapping
 *   §1  ContinuityEngine          ← this module
 *   §2  Home memory               ← getRecentMemory()
 *   §3  Recommendation orchestrator ← getNextBestAction() wraps
 *                                    getPrimaryGuidance with the
 *                                    priority ladder + memory
 *   §4  Task feedback loop        ← recordEvent('task.completed')
 *                                    triggers a memory update
 *   §5  Scan follow-up memory     ← recordEvent('scan.completed')
 *                                    stamps a follow-up date
 *   §6  Weather context           ← weather translation lives in
 *                                    weatherTaskEngine; this engine
 *                                    layers it via getPrimaryGuidance
 *   §7  Farm health score         ← farmHealthStatus (existing)
 *   §8  Journal timeline          ← scanHistoryStore + progressStore
 *                                    (existing)
 *   §9  Event bus                 ← farmEventBus (existing)
 *   §10 Notification intelligence ← out of scope here — handled by
 *                                    src/intelligence/notifications/
 *   §11 Offline memory            ← recent-memory uses localStorage,
 *                                    survives offline reloads
 *
 * Strict-rule audit
 *   • Pure / synchronous reads / SSR-safe.
 *   • Never throws — every entry point catches.
 *   • No React imports — hook consumers wrap in useMemo.
 *   • No network calls.
 *   • Auto-subscribes to farmEventBus on first import — idempotent.
 */

import { FarmEvents, subscribe, publish } from '../../lib/farmEventBus.js';
import { getFarmContext } from '../../lib/farmContextEngine.js';
import { getPrimaryGuidance } from '../../intelligence/recommendations/getPrimaryGuidance.js';
import { getFarmHealthStatus } from '../../lib/farmHealthStatus.js';

// ─── Memory storage ────────────────────────────────────────────
//
// The memory layer is persisted to localStorage so a page reload
// (or offline session) preserves "you checked your tomatoes
// yesterday." Single JSON blob keeps the storage footprint
// minimal — ~1 KB even with a year of history.
//
// PER-FARM SCOPE (Operational Trust + Farm Memory spec §1):
//   The blob is keyed by `farroway.continuity.memory.v1::<farmId>`
//   when an active farm exists. A user juggling multiple farms
//   keeps a separate memory for each. The global key (no suffix)
//   is preserved for callers without farm context — pre-onboarding
//   state stays where it was.

const MEMORY_KEY_BASE = 'farroway.continuity.memory.v1';
const MAX_RECENT_EVENTS = 20;

function _memoryKey() {
  try {
    const ctx = getFarmContext();
    const id  = ctx && ctx.activeFarmId;
    if (id && typeof id === 'string' && id.length < 80) {
      return `${MEMORY_KEY_BASE}::${id}`;
    }
  } catch { /* fall through */ }
  return MEMORY_KEY_BASE;
}

function _safeReadMemory() {
  try {
    if (typeof localStorage === 'undefined') return _emptyMemory();
    const raw = localStorage.getItem(_memoryKey());
    if (!raw) return _emptyMemory();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return _emptyMemory();
    return {
      lastScan:           parsed.lastScan           || null,
      lastTask:           parsed.lastTask           || null,
      lastWeatherChange:  parsed.lastWeatherChange  || null,
      lastRecommendation: parsed.lastRecommendation || null,
      followUps:          Array.isArray(parsed.followUps) ? parsed.followUps : [],
      recentEvents:       Array.isArray(parsed.recentEvents) ? parsed.recentEvents.slice(-MAX_RECENT_EVENTS) : [],
    };
  } catch { return _emptyMemory(); }
}

function _emptyMemory() {
  return {
    lastScan:           null,
    lastTask:           null,
    lastWeatherChange:  null,
    lastRecommendation: null,
    followUps:          [],
    recentEvents:       [],
  };
}

function _safeWriteMemory(memory) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(_memoryKey(), JSON.stringify(memory));
  } catch { /* swallow — quota exceeded etc. */ }
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Get the canonical short-term memory snapshot. Synchronous +
 * SSR-safe. Returns the empty shape (all nulls) when storage is
 * unavailable.
 */
export function getRecentMemory() {
  return _safeReadMemory();
}

/**
 * Record a domain event. Updates the appropriate memory slot +
 * persists. The farmEventBus listener wired below calls this
 * automatically; callers can also invoke it directly for events
 * that don't flow through the bus (e.g. ad-hoc journal entries).
 *
 * @param {string} eventType — one of FarmEvents.*
 * @param {object} payload   — event-specific data
 */
export function recordEvent(eventType, payload) {
  try {
    if (!eventType || typeof eventType !== 'string') return;
    const memory = _safeReadMemory();
    const now    = Date.now();
    const entry  = {
      type:      eventType,
      at:        now,
      payload:   _slim(payload),
    };
    // Append to recent events ring buffer.
    memory.recentEvents = [...memory.recentEvents, entry].slice(-MAX_RECENT_EVENTS);
    // Type-specific memory updates.
    switch (eventType) {
      case FarmEvents.SCAN_COMPLETED:
        memory.lastScan = {
          at:        now,
          scanId:    payload && payload.scanId    || null,
          category:  payload && payload.category  || null,
          confidence: payload && payload.confidence || null,
          followUpAt: payload && payload.followUpAt || _stampTomorrow(now),
        };
        // Auto-add a follow-up reminder if the scan flagged an issue.
        if (payload && payload.category && payload.category !== 'healthy') {
          memory.followUps = [
            ...memory.followUps,
            {
              source:    'scan',
              scanId:    payload.scanId || null,
              dueAt:     payload.followUpAt || _stampTomorrow(now),
              note:      payload.followUpNote || 'Recheck after scan',
            },
          ].slice(-MAX_RECENT_EVENTS);
        }
        break;
      case FarmEvents.TASK_COMPLETED:
        memory.lastTask = {
          at:       now,
          taskId:   payload && payload.taskId   || null,
          title:    payload && payload.title    || null,
        };
        // Clear any follow-up tied to this task.
        if (payload && payload.taskId) {
          memory.followUps = memory.followUps.filter(
            (f) => !(f.source === 'task' && f.taskId === payload.taskId),
          );
        }
        break;
      case FarmEvents.WEATHER_UPDATED:
        memory.lastWeatherChange = {
          at:        now,
          condition: payload && payload.condition || null,
          temp:      payload && Number.isFinite(payload.temp) ? payload.temp : null,
        };
        break;
      case FarmEvents.TASK_OVERDUE:
        // A missed task is itself a follow-up.
        if (payload && payload.taskId) {
          memory.followUps = [
            ...memory.followUps.filter(
              (f) => !(f.source === 'task' && f.taskId === payload.taskId),
            ),
            {
              source:  'task',
              taskId:  payload.taskId,
              dueAt:   payload.dueAt || now,
              note:    payload.title || 'Missed task',
            },
          ].slice(-MAX_RECENT_EVENTS);
        }
        break;
      case FarmEvents.FOLLOW_UP_DUE:
        // Surfaced by the ticker. Already in memory.followUps — we
        // bump the recentEvents buffer so the journal/timeline can
        // render it without re-reading the follow-up list.
        break;
      case FarmEvents.PRODUCE_LISTED:
      case FarmEvents.FARM_CREATED:
      case FarmEvents.LOCATION_UPDATED:
      case FarmEvents.CROP_ADDED:
        // Contribute only to the ring buffer. The journal timeline
        // composer (farmTimeline.buildFarmTimeline) reads
        // recentEvents to surface them.
        break;
      default:
        // Other events (OUTBREAK_DETECTED, HARVEST_READY, etc.)
        // contribute to the ring buffer but don't get their own
        // slot. Consumers that need them can read recentEvents.
        break;
    }
    _safeWriteMemory(memory);
  } catch { /* swallow */ }
}

/**
 * Get the SINGLE highest-priority recommendation the user should
 * act on right now. Wraps getPrimaryGuidance with the spec's
 * priority ladder:
 *   1. urgent scan follow-up        (scan flagged a real issue)
 *   2. severe weather risk          (frost / heat / wind warning)
 *   3. overdue task                 (deadline passed)
 *   4. crop-stage action            (flowering / fruiting window)
 *   5. routine maintenance          (the calm default)
 *
 * Returns the spec-shaped envelope:
 *   { title, reason, urgency, bestTime, confidenceTone, cta, source }
 *
 * `source` indicates which ladder rung fired:
 *   'scan_followup' | 'weather' | 'overdue_task' | 'crop_stage' |
 *   'routine' | 'fallback'
 */
export function getNextBestAction(options = {}) {
  try {
    const ctx = getFarmContext();
    const memory = _safeReadMemory();
    const now = Date.now();

    // ── 1. Urgent scan follow-up ────────────────────────────
    // If the last scan flagged an issue + its follow-up date is
    // due, that's the most important thing to surface.
    if (memory.lastScan && memory.lastScan.category && memory.lastScan.category !== 'healthy') {
      const dueAt = memory.lastScan.followUpAt || 0;
      if (dueAt && dueAt <= now + 1000 * 60 * 60 * 6) {
        return _shapeAction({
          title:          'Recheck your last scan',
          reason:         _reasonForScanFollowup(memory.lastScan),
          urgency:        'high',
          bestTime:       'morning',
          confidenceTone: memory.lastScan.confidence || 'limited-data',
          cta:            'Open scan',
          source:         'scan_followup',
        });
      }
    }

    // ── 2. Severe weather risk ──────────────────────────────
    if (memory.lastWeatherChange) {
      const cond = String(memory.lastWeatherChange.condition || '').toLowerCase();
      if (cond.includes('storm') || cond.includes('frost') || cond.includes('hail')) {
        return _shapeAction({
          title:          'Protect crops from severe weather',
          reason:         'Severe weather is in the forecast — check covers, drainage, and supports today.',
          urgency:        'high',
          bestTime:       'as soon as possible',
          confidenceTone: 'likely',
          cta:            'Protect now',
          source:         'weather',
        });
      }
    }

    // ── 3. Overdue follow-up ────────────────────────────────
    const overdue = memory.followUps.find((f) => f && f.dueAt && f.dueAt < now);
    if (overdue) {
      return _shapeAction({
        title:          overdue.note || 'Follow up on a recent action',
        reason:         'A follow-up from your last check is due.',
        urgency:        'medium',
        bestTime:       'today',
        confidenceTone: 'limited-data',
        cta:            'View follow-up',
        source:         'overdue_task',
      });
    }

    // ── 4 + 5. Crop-stage / routine via getPrimaryGuidance ──
    // The recommendation orchestrator already handles the crop-
    // stage ladder and routine fallback. Layer our memory on top
    // so the surfaced action isn't a repeat of the last one.
    const primary = getPrimaryGuidance({
      mode:        ctx.experience,
      weather:     options.weather  || null,
      farm:        ctx.farm,
      crop:        ctx.crop,
      cropStage:   ctx.cropStage,
      country:     ctx.farm && ctx.farm.country  || null,
      region:      ctx.farm && ctx.farm.region   || null,
    });
    if (primary && primary.title && !_isDuplicate(primary, memory.lastRecommendation)) {
      // Cache for dedupe.
      try {
        memory.lastRecommendation = {
          id:     primary.id,
          title:  primary.title,
          at:     now,
        };
        _safeWriteMemory(memory);
      } catch { /* swallow */ }
      return _shapeAction({
        title:          primary.title,
        reason:         primary.message || primary.reason || '',
        urgency:        primary.priority || 'medium',
        bestTime:       'today',
        confidenceTone: primary.confidenceTone || 'limited-data',
        cta:            primary.actionLabel    || 'View',
        source:         primary.id && primary.id.includes('fallback') ? 'routine' : 'crop_stage',
      });
    }

    // ── 6. Fallback ──────────────────────────────────────────
    return _shapeAction({
      title:          'Walk your farm and check crop health',
      reason:         'A quick check helps catch problems early.',
      urgency:        'low',
      bestTime:       'today',
      confidenceTone: 'limited-data',
      cta:            'Start check',
      source:         'fallback',
    });
  } catch {
    return _shapeAction({
      title:          'Walk your farm and check crop health',
      reason:         'A quick check helps catch problems early.',
      urgency:        'low',
      bestTime:       'today',
      confidenceTone: 'limited-data',
      cta:            'Start check',
      source:         'fallback',
    });
  }
}

// ─── Subscription wiring ───────────────────────────────────────
//
// Auto-subscribe on first import so any module that publishes to
// farmEventBus automatically updates continuity memory.
// Idempotent — subscribe() returns an unsubscribe function which
// we store but don't expose (the bus subscription lives for the
// lifetime of the app).

let _subscribed = false;
function _wireEventBus() {
  if (_subscribed) return;
  _subscribed = true;
  try {
    subscribe(FarmEvents.SCAN_COMPLETED,    (p) => recordEvent(FarmEvents.SCAN_COMPLETED, p));
    subscribe(FarmEvents.TASK_COMPLETED,    (p) => recordEvent(FarmEvents.TASK_COMPLETED, p));
    subscribe(FarmEvents.TASK_CREATED,      (p) => recordEvent(FarmEvents.TASK_CREATED, p));
    subscribe(FarmEvents.TASK_OVERDUE,      (p) => recordEvent(FarmEvents.TASK_OVERDUE, p));
    subscribe(FarmEvents.WEATHER_UPDATED,   (p) => recordEvent(FarmEvents.WEATHER_UPDATED, p));
    subscribe(FarmEvents.FARM_CREATED,      (p) => recordEvent(FarmEvents.FARM_CREATED, p));
    subscribe(FarmEvents.FARM_UPDATED,      (p) => recordEvent(FarmEvents.FARM_UPDATED, p));
    subscribe(FarmEvents.LOCATION_UPDATED,  (p) => recordEvent(FarmEvents.LOCATION_UPDATED, p));
    subscribe(FarmEvents.CROP_ADDED,        (p) => recordEvent(FarmEvents.CROP_ADDED, p));
    subscribe(FarmEvents.PRODUCE_LISTED,    (p) => recordEvent(FarmEvents.PRODUCE_LISTED, p));
    subscribe(FarmEvents.FOLLOW_UP_DUE,     (p) => recordEvent(FarmEvents.FOLLOW_UP_DUE, p));
    subscribe(FarmEvents.OUTBREAK_DETECTED, (p) => recordEvent(FarmEvents.OUTBREAK_DETECTED, p));
    subscribe(FarmEvents.HARVEST_READY,     (p) => recordEvent(FarmEvents.HARVEST_READY, p));
  } catch { /* swallow — bus init failures don't break callers */ }
}

// Fire on module load.
_wireEventBus();

// Test seam — flush memory so unit tests start from a clean slate.
// Clears BOTH the per-farm key (if a farm is active) and the global
// fallback key, so tests don't have to know which one was written.
export function _resetContinuityMemory() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(_memoryKey());
      localStorage.removeItem(MEMORY_KEY_BASE);
    }
  } catch { /* swallow */ }
  _stopFollowUpTicker();
}

/**
 * Calm 3-tone farm health state derived from the current memory +
 * follow-ups (Operational Trust spec §6).
 *
 *   STABLE          — no overdue follow-ups, last scan healthy or
 *                     stale, no severe weather.
 *   WATCH           — one signal worth noticing: a non-healthy scan
 *                     with a future follow-up, or moderate weather.
 *   NEEDS_ATTENTION — multiple inputs: overdue follow-ups, severe
 *                     weather, or repeat issues.
 *
 * Returns the same envelope shape as farmHealthStatus.getFarmHealthStatus
 * so callers can swap in either source.
 */
export function getFarmHealthState() {
  try {
    const memory = _safeReadMemory();
    const now    = Date.now();

    let attentionPoints = 0;
    let watchPoints     = 0;

    // ── Overdue follow-ups ────────────────────────────────────
    const overdueCount = (memory.followUps || []).filter(
      (f) => f && f.dueAt && f.dueAt < now,
    ).length;
    if (overdueCount >= 2) attentionPoints += 2;
    else if (overdueCount === 1) watchPoints += 1;

    // ── Last scan signal ──────────────────────────────────────
    if (memory.lastScan && memory.lastScan.category && memory.lastScan.category !== 'healthy') {
      const dueAt = memory.lastScan.followUpAt || 0;
      if (dueAt && dueAt < now) attentionPoints += 1;
      else watchPoints += 1;
    }

    // ── Weather signal ────────────────────────────────────────
    if (memory.lastWeatherChange) {
      const cond = String(memory.lastWeatherChange.condition || '').toLowerCase();
      if (cond.includes('storm') || cond.includes('frost') || cond.includes('hail')) {
        attentionPoints += 1;
      } else if (cond.includes('heat') || cond.includes('rain')) {
        watchPoints += 1;
      }
    }

    let band = 'good';
    if (attentionPoints >= 2)      band = 'urgent';
    else if (attentionPoints === 1) band = 'needs_care';
    else if (watchPoints >= 1)      band = 'needs_care';

    return getFarmHealthStatus({ band });
  } catch {
    return getFarmHealthStatus({ band: 'good' });
  }
}

// ─── Follow-up ticker ─────────────────────────────────────────
//
// Periodically scans memory.followUps and publishes FOLLOW_UP_DUE
// for entries whose dueAt has crossed `now`. Idempotent — each
// follow-up is fired exactly once per session (tracked via the
// `firedFollowUps` Set). Cleared on _resetContinuityMemory().

const TICKER_INTERVAL_MS = 60 * 1000; // 1 minute
let _tickerHandle = null;
const _firedFollowUps = new Set();

function _firedKey(f) {
  return `${f.source || ''}::${f.taskId || f.scanId || ''}::${f.dueAt || 0}`;
}

function _runFollowUpTick() {
  try {
    const memory = _safeReadMemory();
    const now    = Date.now();
    for (const f of (memory.followUps || [])) {
      if (!f || !f.dueAt) continue;
      if (f.dueAt > now) continue;
      const k = _firedKey(f);
      if (_firedFollowUps.has(k)) continue;
      _firedFollowUps.add(k);
      try {
        publish(FarmEvents.FOLLOW_UP_DUE, {
          source:  f.source || null,
          taskId:  f.taskId || null,
          scanId:  f.scanId || null,
          dueAt:   f.dueAt,
          note:    f.note   || null,
        });
      } catch { /* swallow */ }
    }
  } catch { /* swallow */ }
}

export function startFollowUpTicker(intervalMs) {
  try {
    if (_tickerHandle) return; // already running — idempotent
    if (typeof setInterval !== 'function') return;
    const ms = Number.isFinite(intervalMs) && intervalMs > 0
      ? intervalMs
      : TICKER_INTERVAL_MS;
    // Fire once immediately so a freshly-due item doesn't wait the
    // full interval before surfacing.
    _runFollowUpTick();
    _tickerHandle = setInterval(_runFollowUpTick, ms);
  } catch { /* swallow */ }
}

function _stopFollowUpTicker() {
  try {
    if (_tickerHandle) {
      clearInterval(_tickerHandle);
      _tickerHandle = null;
    }
    _firedFollowUps.clear();
  } catch { /* swallow */ }
}

export function stopFollowUpTicker() {
  _stopFollowUpTicker();
}

// Test seam — manually trigger a tick + reset the fired-set.
export function _runFollowUpTickerOnce() {
  _firedFollowUps.clear();
  _runFollowUpTick();
}

// ─── Internal helpers ─────────────────────────────────────────

function _shapeAction(p) {
  return Object.freeze({
    title:          String(p.title          || ''),
    reason:         String(p.reason         || ''),
    urgency:        String(p.urgency        || 'medium'),
    bestTime:       String(p.bestTime       || 'today'),
    confidenceTone: String(p.confidenceTone || 'limited-data'),
    cta:            String(p.cta            || 'View'),
    source:         String(p.source         || 'routine'),
  });
}

function _slim(payload) {
  // Bound the payload size so the memory blob never bloats. Keep
  // small primitives + small objects; drop large nested objects.
  try {
    if (!payload || typeof payload !== 'object') return null;
    const out = {};
    for (const k of Object.keys(payload)) {
      const v = payload[k];
      if (v == null) continue;
      const t = typeof v;
      if (t === 'string') out[k] = v.length > 200 ? v.slice(0, 200) : v;
      else if (t === 'number' || t === 'boolean') out[k] = v;
    }
    return out;
  } catch { return null; }
}

function _stampTomorrow(nowMs) {
  return nowMs + 1000 * 60 * 60 * 24;
}

function _reasonForScanFollowup(scan) {
  const cat = String(scan.category || '').toLowerCase();
  if (cat.includes('yellow')) return 'Your last scan saw yellowing leaves. Check whether the spots have spread.';
  if (cat.includes('pest') || cat.includes('hole')) return 'Your last scan flagged possible pest damage. Inspect under leaves.';
  if (cat.includes('disease') || cat.includes('spot')) return 'Your last scan flagged a possible disease. Check whether it has spread.';
  if (cat.includes('wilt')) return 'Your last scan saw wilting. Check soil moisture and roots.';
  return 'Your last scan flagged something to revisit. A second look will tell you if it has changed.';
}

function _isDuplicate(primary, lastRec) {
  if (!lastRec) return false;
  if (lastRec.id && primary.id && lastRec.id === primary.id) {
    // Same recommendation re-shown within 6 hours = duplicate.
    return Date.now() - (lastRec.at || 0) < 1000 * 60 * 60 * 6;
  }
  return false;
}

const _module = {
  getNextBestAction,
  getRecentMemory,
  recordEvent,
  getFarmHealthState,
  startFollowUpTicker,
  stopFollowUpTicker,
  _resetContinuityMemory,
  _runFollowUpTickerOnce,
};
export default _module;
