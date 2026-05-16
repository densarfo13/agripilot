/**
 * scanHistoryStore.js — local-first scan history for the
 * FEATURE_SCAN_USEFULNESS layer.
 *
 * STORAGE KEY
 * ───────────
 *   farroway_scan_history_v1
 *
 * SHAPE (per entry)
 * ─────
 *   {
 *     id:          string   — scan id (from result.scanId or generated)
 *     category:    string   — one of the five safe categories
 *     noticed:     string   — "what we noticed" text
 *     createdAt:   string   — ISO datetime
 *     experience:  string   — 'farm' | 'backyard' | 'generic'
 *     taskAdded:   boolean  — true if the follow-up task was persisted
 *   }
 *
 * PURPOSE
 * ───────
 * Separate from the older `farroway_scan_history` (data/scanHistory.js)
 * which is per-farm and heavier. This slot is flat, fast, and keyed
 * only on the scan id — no farmId, no full result blob. History rows
 * link to the existing /scan/result/:scanId deep-link which reads from
 * the older store when a full result is needed.
 *
 * RULES
 * ─────
 *   • Never throws — corrupt JSON → safe empty list.
 *   • Bounded: max 50 entries; oldest dropped first.
 *   • No network. No React imports.
 *   • SSR-safe (localStorage guard).
 */

// Connected Intelligence Loop — saving a scan publishes SCAN_COMPLETED
// + JOURNAL_ENTRY_CREATED on the typed bus so the intelligence loop
// (memory, recommendations, copilot) can react. publish() never
// throws and the bus caps re-entrancy, so this can't destabilise the
// store's write path.
import { publish, FarmEvents } from '../farmEventBus.js';

export const SCAN_HISTORY_KEY = 'farroway_scan_history_v1';
// May 2026 final stabilization brief §14: cap the local history
// at 30 entries (down from 50) so an overflowing localStorage
// quota never disables saving on lower-end devices.
const MAX_KEPT = 30;

// ─── Private helpers ─────────────────────────────────────────────

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SCAN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(list) {
  try {
    if (typeof localStorage === 'undefined') return;
    // Keep only the most recent MAX_KEPT entries.
    const trimmed = list.length > MAX_KEPT ? list.slice(list.length - MAX_KEPT) : list;
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* quota / private mode — non-fatal */ }
}

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'scan_' + crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return 'scan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Persist a lightweight scan entry. Returns the stored entry.
 * Idempotent within the same scanId — a second call with the same id
 * is a no-op (returns the existing entry).
 *
 * Farm-intelligence loop §3
 * ─────────────────────────
 *   The journal entry now captures the four extra fields the spec
 *   calls out: severity, image thumbnail, recommendations, and the
 *   weather-caution one-liner. All four are optional — when the
 *   server hasn't populated them (older bundles, low-confidence
 *   fallback path) the entry still saves cleanly with `null` values
 *   so the timeline never silently drops a scan.
 *
 *   • severity        — pulled from decision.severityTone first
 *                       (low/medium/high) then result.severity.
 *   • thumbnail       — small dataURL string the timeline can render
 *                       inline. Passed in by the scan page since
 *                       only it has the captured File reference.
 *   • recommendations — top 3 action bullets from result.recommendedActions
 *                       or result.suggestedTasks[].title. The list
 *                       lets the journal show a one-line "do X, Y, Z"
 *                       summary without re-running the policy module.
 *   • weatherCaution  — verbatim line from decision.weatherCaution so
 *                       the journal can render "Weather likely
 *                       contributed to this issue" without re-querying.
 *
 * @param {object} result       — ScanResult from the engine
 * @param {object} [ctx]        — { experience, noticed, thumbnail }
 * @returns {{ id, category, noticed, createdAt, experience, taskAdded, severity, thumbnail, recommendations, weatherCaution, crop, scanId }}
 */
export function saveScanUseful(result, ctx = {}) {
  const safeResult = (result && typeof result === 'object') ? result : {};
  const id = String(safeResult.scanId || ctx.id || _makeId());

  // Idempotency: if this scanId already in history, return it.
  const list = _read();
  const existing = list.find((e) => e && e.id === id);
  if (existing) return existing;

  // §3 enrichment helpers — defensive on every read so a misshaped
  // server response can't put a non-string into the timeline.
  const _str = (v) => {
    const s = String(v == null ? '' : v).trim();
    return s ? s : null;
  };
  const decision = (safeResult.decision && typeof safeResult.decision === 'object')
    ? safeResult.decision
    : {};

  // Severity priority: decision.severityTone (low/medium/high) →
  // result.severity → null. The decision envelope is authoritative
  // when present because it ran through the policy normaliser.
  const severity = _str(decision.severityTone) || _str(safeResult.severity);

  // Recommendations: top 3 lines. Prefer result.recommendedActions
  // (already sanitised by scanResultPolicy) then suggestedTasks
  // titles as a fallback when the engine only emitted tasks.
  let recommendations = [];
  if (Array.isArray(safeResult.recommendedActions)) {
    recommendations = safeResult.recommendedActions
      .map(_str)
      .filter(Boolean)
      .slice(0, 3);
  }
  if (recommendations.length === 0 && Array.isArray(safeResult.suggestedTasks)) {
    recommendations = safeResult.suggestedTasks
      .map((t) => _str(t && t.title))
      .filter(Boolean)
      .slice(0, 3);
  }

  const plantType        = _str(decision.cropDetected) || _str(safeResult.cropName) || _str(safeResult.crop);
  const conditionCategory = String(safeResult.category  || 'needs_review');
  const noticed          = String(ctx.noticed || safeResult.possibleIssue || 'Needs closer inspection');
  const recommendation0  = recommendations.length > 0 ? recommendations[0] : null;
  const imageUrl         = _str(ctx.thumbnail) || _str(ctx.imageUrl);

  const entry = {
    id,
    // Legacy field names (kept for backward-compat with existing
    // history consumers).
    category:        conditionCategory,
    noticed,
    createdAt:       _isoNow(),
    experience:      String(ctx.experience        || 'generic'),
    taskAdded:       false,
    severity,
    thumbnail:       imageUrl,
    recommendations: recommendations.length > 0 ? recommendations : null,
    weatherCaution:  _str(decision.weatherCaution),
    crop:            plantType,
    scanId:          _str(safeResult.scanId) || id,

    // Scan-to-Platform Stabilization spec §4 — canonical field
    // names so Journal / Home / Progress can read the entry
    // shape verbatim without re-mapping. All aliases mirror the
    // legacy fields above; both names point at the same value.
    farmId:                _str(ctx.farmId) || _str(ctx.gardenId),
    imageUrl,
    timestamp:             _isoNow(),
    plantType,
    scanQuality:           _str(safeResult.scanQuality) || _str(ctx.scanQuality),
    conditionCategory,
    possibleDiseaseOrPest: noticed,
    confidenceTone:        _str(decision.confidenceTone) || _str(safeResult.confidence),
    urgency:               severity,
    recommendation:        recommendation0,
    weatherContext:        _str(decision.weatherCaution) || _str(ctx.weatherContext),
    soilContext:           _str(ctx.soilContext),
  };

  list.push(entry);
  _write(list);

  // Feed the intelligence loop — the scan is now journalled. Both
  // events carry only summary fields (no image bytes, no PII).
  try {
    publish(FarmEvents.SCAN_COMPLETED, {
      scanId:   entry.scanId,
      category: entry.category,
      severity: entry.severity,
      crop:     entry.crop,
      source:   _str(safeResult.source) || 'scan',
    });
    publish(FarmEvents.JOURNAL_ENTRY_CREATED, {
      id:       entry.id,
      kind:     'scan',
      category: entry.category,
    });
  } catch { /* bus is fire-and-forget — never affect the save */ }

  return entry;
}

/**
 * Mark a stored entry's task as added. Returns true when found.
 *
 * @param {string} id
 * @returns {boolean}
 */
export function markTaskAdded(id) {
  if (!id) return false;
  const list = _read();
  const idx = list.findIndex((e) => e && e.id === id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], taskAdded: true };
  _write(list);
  return true;
}

/**
 * All stored entries, newest-first. Never throws.
 *
 * @returns {Array<{ id, category, noticed, createdAt, experience, taskAdded }>}
 */
export function getScanUsefulHistory() {
  return _read().slice().reverse();
}

/**
 * Look up a single entry by id. Returns null when not found.
 *
 * @param {string} id
 * @returns {object|null}
 */
export function getScanUsefulEntry(id) {
  if (!id) return null;
  return _read().find((e) => e && e.id === id) || null;
}

/**
 * Total entry count on this device.
 *
 * @returns {number}
 */
export function getScanUsefulHistoryCount() {
  return _read().length;
}

/**
 * Remove all entries (sign-out / debug).
 */
export function clearScanUsefulHistory() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SCAN_HISTORY_KEY);
    }
  } catch { /* ignore */ }
}
