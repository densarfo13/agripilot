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

import { FarmEvents, subscribe } from '../../lib/farmEventBus.js';
import { getFarmContext } from '../../lib/farmContextEngine.js';
import { getPrimaryGuidance } from '../../intelligence/recommendations/getPrimaryGuidance.js';

// ─── Memory storage ────────────────────────────────────────────
//
// The memory layer is persisted to localStorage so a page reload
// (or offline session) preserves "you checked your tomatoes
// yesterday." Single JSON blob keeps the storage footprint
// minimal — ~1 KB even with a year of history.

const MEMORY_KEY = 'farroway.continuity.memory.v1';
const MAX_RECENT_EVENTS = 20;

function _safeReadMemory() {
  try {
    if (typeof localStorage === 'undefined') return _emptyMemory();
    const raw = localStorage.getItem(MEMORY_KEY);
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
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
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
      default:
        // Other events (FARM_CREATED, OUTBREAK_DETECTED, etc.)
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
    subscribe(FarmEvents.WEATHER_UPDATED,   (p) => recordEvent(FarmEvents.WEATHER_UPDATED, p));
    subscribe(FarmEvents.FARM_CREATED,      (p) => recordEvent(FarmEvents.FARM_CREATED, p));
    subscribe(FarmEvents.FARM_UPDATED,      (p) => recordEvent(FarmEvents.FARM_UPDATED, p));
    subscribe(FarmEvents.OUTBREAK_DETECTED, (p) => recordEvent(FarmEvents.OUTBREAK_DETECTED, p));
    subscribe(FarmEvents.HARVEST_READY,     (p) => recordEvent(FarmEvents.HARVEST_READY, p));
  } catch { /* swallow — bus init failures don't break callers */ }
}

// Fire on module load.
_wireEventBus();

// Test seam — flush memory so unit tests start from a clean slate.
export function _resetContinuityMemory() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(MEMORY_KEY);
    }
  } catch { /* swallow */ }
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
  _resetContinuityMemory,
};
export default _module;
