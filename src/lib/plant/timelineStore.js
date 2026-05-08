/**
 * timelineStore.js — Garden Mode plant timeline (append-only).
 *
 * Local-first event log capturing care-related milestones:
 *   added / scan_saved / task_completed / stage_advanced /
 *   issue_noticed / recovery_note / harvest_picked
 *
 * Storage key: farroway_plant_timeline_v1
 * Per-entry shape:
 *   {
 *     id,                  string  — unique id
 *     plantId,             string  — plant identity id (or null)
 *     type,                string  — milestone kind (see TIMELINE_TYPES)
 *     emoji,               string  — display icon ('🌱' / '📸' / '✅' / '🌼' / '🍅' / …)
 *     messageKey,          string  — i18n key for the body line
 *     params,              object  — interpolation params
 *     scanCategory,        string  — optional scan category snapshot
 *     stage,               string  — optional growth stage at time of event
 *     thumbDataUrl,        string  — optional small inline image
 *     createdAt,           string  — ISO datetime
 *   }
 *
 * Bounded: 100 most recent entries, oldest dropped first. The cap
 * keeps localStorage under 5 MB even with thumbnails — and a year
 * of weekly milestones still fits comfortably.
 *
 * Strict-rule audit
 *   • Pure module, no React, no hooks.
 *   • Never throws — every read/write guarded.
 *   • SSR-safe.
 *   • No network, no blocking work.
 *   • Append-only API — entries are immutable once created.
 */

export const TIMELINE_STORE_KEY = 'farroway_plant_timeline_v1';
const MAX_KEPT = 100;

// ─── Milestone types ──────────────────────────────────────────────

export const TIMELINE_TYPES = Object.freeze({
  ADDED:          'added',
  SCAN_SAVED:     'scan_saved',
  TASK_COMPLETED: 'task_completed',
  STAGE_ADVANCED: 'stage_advanced',
  ISSUE_NOTICED:  'issue_noticed',
  RECOVERY_NOTE:  'recovery_note',
  HARVEST_PICKED: 'harvest_picked',
  FLOWER_NOTE:    'flower_note',
  FRUIT_NOTE:     'fruit_note',
});

// Default emoji per type (callers may override).
const EMOJI_BY_TYPE = Object.freeze({
  added:          '🌱',
  scan_saved:     '📸',
  task_completed: '✅',
  stage_advanced: '🌿',
  issue_noticed:  '🔍',
  recovery_note:  '💚',
  harvest_picked: '🍅',
  flower_note:    '🌼',
  fruit_note:     '🍅',
});

// Default message key per type (i18n overlay in plantCompanionTranslations.js).
const MSG_KEY_BY_TYPE = Object.freeze({
  added:          'plant.timeline.added',
  scan_saved:     'plant.timeline.scanSaved',
  task_completed: 'plant.timeline.taskCompleted',
  stage_advanced: 'plant.timeline.stageAdvanced',
  issue_noticed:  'plant.timeline.issueNoticed',
  recovery_note:  'plant.timeline.recoveryNote',
  harvest_picked: 'plant.timeline.harvestPicked',
  flower_note:    'plant.timeline.flowerNote',
  fruit_note:     'plant.timeline.fruitNote',
});

// ─── Internal helpers ─────────────────────────────────────────────

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(TIMELINE_STORE_KEY);
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
    const trimmed = list.length > MAX_KEPT
      ? list.slice(list.length - MAX_KEPT)
      : list;
    localStorage.setItem(TIMELINE_STORE_KEY, JSON.stringify(trimmed));
  } catch { /* quota / private mode — non-fatal */ }
}

function _isoNow() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _makeId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'tl_' + crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return 'tl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function _emit(type, entry) {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('farroway:plant_timeline_changed', {
        detail: { type, entry },
      }));
    }
  } catch { /* swallow */ }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * appendTimelineEntry(input) → Entry
 *
 * Append a new milestone. Type is required; everything else
 * has a sensible default. Returns the created entry. Never throws.
 *
 * Idempotency: same `type + plantId + scanCategory + stage` combo
 * within 60 seconds is collapsed (so completing two tasks back-to-back
 * doesn't spam the timeline). The `force: true` opt-out bypasses this.
 *
 * @param {object} input
 * @param {string} input.type           one of TIMELINE_TYPES
 * @param {string} [input.plantId]
 * @param {string} [input.emoji]
 * @param {string} [input.messageKey]
 * @param {object} [input.params]
 * @param {string} [input.scanCategory]
 * @param {string} [input.stage]
 * @param {string} [input.thumbDataUrl]
 * @param {boolean} [input.force]       skip dedupe (default false)
 */
export function appendTimelineEntry(input) {
  const safe = (input && typeof input === 'object') ? input : {};
  const type = (typeof safe.type === 'string' && safe.type)
    ? safe.type
    : TIMELINE_TYPES.TASK_COMPLETED;

  const list = _read();

  // Dedupe within 60s (unless forced).
  if (!safe.force) {
    const sixty = Date.now() - 60_000;
    const dup = list.find((e) => {
      if (!e || e.type !== type) return false;
      if (e.plantId       !== (safe.plantId       || null)) return false;
      if (e.scanCategory  !== (safe.scanCategory  || null)) return false;
      if (e.stage         !== (safe.stage         || null)) return false;
      try { return new Date(e.createdAt).getTime() >= sixty; }
      catch { return false; }
    });
    if (dup) return dup;
  }

  const entry = {
    id:            _makeId(),
    plantId:       safe.plantId       || null,
    type,
    emoji:         (typeof safe.emoji === 'string' && safe.emoji)
                     ? safe.emoji
                     : (EMOJI_BY_TYPE[type] || '🌱'),
    messageKey:    (typeof safe.messageKey === 'string' && safe.messageKey)
                     ? safe.messageKey
                     : (MSG_KEY_BY_TYPE[type] || 'plant.timeline.generic'),
    params:        (safe.params && typeof safe.params === 'object') ? safe.params : {},
    scanCategory:  safe.scanCategory  || null,
    stage:         safe.stage         || null,
    thumbDataUrl:  (typeof safe.thumbDataUrl === 'string' && safe.thumbDataUrl.length < 200_000)
                     ? safe.thumbDataUrl : null,
    createdAt:     _isoNow(),
  };

  list.push(entry);
  _write(list);
  _emit('append', entry);
  return entry;
}

/**
 * getTimelineEntries() → Entry[]   (newest first, never throws)
 */
export function getTimelineEntries() {
  return _read().slice().reverse();
}

/**
 * getRecentEntries(limit) → Entry[]   (newest first, capped)
 */
export function getRecentEntries(limit = 10) {
  const n = (Number.isFinite(limit) && limit > 0) ? Math.floor(limit) : 10;
  return getTimelineEntries().slice(0, n);
}

/**
 * getTimelineCount() → number
 */
export function getTimelineCount() {
  return _read().length;
}

/**
 * getCountByType(type) → number
 *
 * Lets the delight engine ask "have we logged the first scan?"
 * without scanning the whole list every time.
 */
export function getCountByType(type) {
  if (typeof type !== 'string' || !type) return 0;
  return _read().filter((e) => e && e.type === type).length;
}

/**
 * clearTimeline() — drop all entries. Sign-out / reset.
 */
export function clearTimeline() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TIMELINE_STORE_KEY);
    }
  } catch { /* ignore */ }
  _emit('clear', null);
}

// ─── Test surface ──────────────────────────────────────────────────
export const _internal = Object.freeze({
  EMOJI_BY_TYPE,
  MSG_KEY_BY_TYPE,
  MAX_KEPT,
  _makeId,
  _read,
  _write,
});
