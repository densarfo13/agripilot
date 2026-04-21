/**
 * outcomeStore.js — canonical outcome capture for the "Did this help?"
 * feedback loop (spec §7).
 *
 *   localStorage["farroway.outcomes"] = [
 *     {
 *       id,
 *       farmId,
 *       farmerId?,
 *       sourceType,   // 'task' | 'issue' | 'alert' | 'harvest_action'
 *       sourceId,
 *       action,       // short human-safe string, e.g. "water_tomorrow"
 *       outcome,      // 'improved' | 'worse' | 'no_change'
 *       createdAt,
 *       metadata?,
 *     },
 *     ...
 *   ]
 *
 * Separate from the counter-oriented `src/utils/outcomeTracking.js`
 * (which tracks streaks and completion rate). This module is the
 * durable learning log — every row is one follow-up answer.
 *
 * Design rules (spec §7):
 *   • saving is best-effort — never throws, never blocks the user
 *   • 'Yes' maps to 'improved'; 'No' → 'worse'; 'Not sure' → 'no_change'
 *   • storage is capped to prevent quota issues on low-end devices
 *   • pure/local-first — no network side effects
 */

const STORAGE_KEY = 'farroway.outcomes';
const MAX_ROWS    = 1000;

export const OUTCOME = Object.freeze({
  IMPROVED:  'improved',
  WORSE:     'worse',
  NO_CHANGE: 'no_change',
});

export const SOURCE_TYPES = Object.freeze(['task', 'issue', 'alert', 'harvest_action']);

// Map the "Did this help?" button labels to canonical outcome codes.
// Callers may pass either the button value ('yes'/'no'/'not_sure') or
// the canonical code directly; we normalise here.
const ANSWER_MAP = Object.freeze({
  yes:        OUTCOME.IMPROVED,
  true:       OUTCOME.IMPROVED,
  improved:   OUTCOME.IMPROVED,
  no:         OUTCOME.WORSE,
  false:      OUTCOME.WORSE,
  worse:      OUTCOME.WORSE,
  not_sure:   OUTCOME.NO_CHANGE,
  notsure:    OUTCOME.NO_CHANGE,
  unsure:     OUTCOME.NO_CHANGE,
  no_change:  OUTCOME.NO_CHANGE,
});

export function mapAnswerToOutcome(answer) {
  const key = String(answer == null ? '' : answer).toLowerCase().trim();
  return ANSWER_MAP[key] || null;
}

// ─── Storage helpers ─────────────────────────────────────────────
function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}
function readRaw() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function writeRaw(list) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch { return false; }
}

function genId(prefix, ts) {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* ignore */ }
  return `${prefix}_${ts}_${Math.floor(Math.random() * 1e9)}`;
}

// ─── Main API ────────────────────────────────────────────────────
/**
 * recordOutcome — persist a single follow-up answer.
 *
 *   recordOutcome({
 *     farmId, farmerId?, sourceType, sourceId, action,
 *     outcome? | answer?,   // either canonical code or a 'yes'/'no'/'not_sure' shorthand
 *     metadata?,            // free-form object, default {}
 *     ts?,                  // test hook
 *   }) → row | null
 *
 * Returns null when inputs are invalid. Never throws. Never blocks.
 */
export function recordOutcome(input = {}) {
  const outcome = input.outcome
    ? (Object.values(OUTCOME).includes(input.outcome) ? input.outcome : mapAnswerToOutcome(input.outcome))
    : mapAnswerToOutcome(input.answer);
  if (!outcome) return null;

  const sourceType = String(input.sourceType || '').toLowerCase();
  if (!SOURCE_TYPES.includes(sourceType)) return null;

  const ts = Number.isFinite(input.ts) ? Number(input.ts) : Date.now();
  const row = {
    id:         input.id || genId('out', ts),
    farmId:     input.farmId ? String(input.farmId) : null,
    farmerId:   input.farmerId ? String(input.farmerId) : null,
    sourceType,
    sourceId:   input.sourceId ? String(input.sourceId) : null,
    action:     typeof input.action === 'string' ? input.action : null,
    outcome,
    createdAt:  ts,
    metadata:   (input.metadata && typeof input.metadata === 'object') ? input.metadata : {},
  };

  const list = readRaw();
  if (row.id && list.some((r) => r && r.id === row.id)) return null; // dedup
  list.push(row);
  // Cap so long-running devices don't blow past quota.
  const trimmed = list.length > MAX_ROWS ? list.slice(-MAX_ROWS) : list;
  writeRaw(trimmed);
  return Object.freeze(row);
}

/**
 * getOutcomes — read the log. Optional filters:
 *   - farmId:     restrict to one farm
 *   - sourceType: restrict to 'task' | 'issue' | 'alert' | 'harvest_action'
 *   - since:      ms timestamp, inclusive lower bound
 */
export function getOutcomes({ farmId = null, sourceType = null, since = null } = {}) {
  let rows = readRaw().slice();
  if (farmId)     rows = rows.filter((r) => r && r.farmId === String(farmId));
  if (sourceType) rows = rows.filter((r) => r && r.sourceType === String(sourceType).toLowerCase());
  if (Number.isFinite(since)) rows = rows.filter((r) => r && (r.createdAt || 0) >= Number(since));
  return rows;
}

/**
 * getOutcomeSummary — aggregate counts by outcome + source type. Used
 * by the admin / NGO view without forcing every dashboard to
 * re-aggregate.
 */
export function getOutcomeSummary({ farmId = null } = {}) {
  const rows = getOutcomes({ farmId });
  const byOutcome = { improved: 0, worse: 0, no_change: 0 };
  const bySource  = {};
  for (const r of rows) {
    if (!r) continue;
    if (byOutcome[r.outcome] != null) byOutcome[r.outcome] += 1;
    const s = r.sourceType || 'unknown';
    bySource[s] = bySource[s] || { improved: 0, worse: 0, no_change: 0, total: 0 };
    bySource[s].total += 1;
    if (bySource[s][r.outcome] != null) bySource[s][r.outcome] += 1;
  }
  const total = rows.length;
  return Object.freeze({
    total,
    byOutcome:      Object.freeze(byOutcome),
    bySource:       Object.freeze(bySource),
    helpfulRate:    total ? Math.round((byOutcome.improved / total) * 100) : 0,
  });
}

/** Clear — tests + "reset app" flows only. */
export function clearOutcomes() { writeRaw([]); }

export const _keys = Object.freeze({ STORAGE_KEY });
