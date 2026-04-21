/**
 * clusterStore.js — local-first cluster state (status, assignments,
 * notes) keyed off the ids emitted by `outbreakEngine`.
 *
 * localStorage key:  farroway.clusters
 * Record shape:
 *   {
 *     id,                      // deterministic from outbreakEngine
 *     status,                  // monitoring | under_review |
 *                              //  confirmed_risk | contained | closed
 *     assignedOfficerIds: [],
 *     linkedIssueIds:     [],
 *     notes: [{ id, authorRole, authorId, text, createdAt }],
 *     lastReviewedAt: number | null,
 *     lastReviewedBy: string | null,
 *     createdAt, updatedAt,
 *   }
 *
 * Safety contract:
 *   • `confirmed_risk` requires a human call to `confirmCluster`.
 *     `setClusterStatus` explicitly rejects that target (no
 *     drive-by auto-confirmation).
 *   • SSR-safe: no window → all reads return null/[], writes
 *     silently no-op.
 *   • Frozen output so callers can't mutate the stored shape.
 */

const STORAGE_KEY = 'farroway.clusters';

const STATUSES = Object.freeze([
  'monitoring', 'under_review', 'confirmed_risk', 'contained', 'closed',
]);

const STATUS_SET = new Set(STATUSES);

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readMap() {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function writeMap(map) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch { return false; }
}

function genNoteId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `cnote_${crypto.randomUUID()}`;
    }
  } catch { /* ignore */ }
  return `cnote_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

function freezeRecord(r) {
  if (!r) return null;
  return Object.freeze({
    ...r,
    assignedOfficerIds: Object.freeze(r.assignedOfficerIds || []),
    linkedIssueIds:     Object.freeze(r.linkedIssueIds     || []),
    notes:              Object.freeze((r.notes || []).map((n) => Object.freeze({ ...n }))),
  });
}

// ─── Public API ──────────────────────────────────────────────────

export function getClusterRecord(clusterId) {
  if (!clusterId) return null;
  const map = readMap();
  const r = map[String(clusterId)];
  return r ? freezeRecord(r) : null;
}

export function listClusterRecords() {
  const map = readMap();
  return Object.values(map)
    .map(freezeRecord)
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * upsertClusterState — called whenever the outbreak engine emits a
 * cluster so its baseline state (status, linkedIssueIds) is
 * persisted. Human-driven fields (assignments, notes, lastReview)
 * are preserved across upserts.
 */
export function upsertClusterState({
  clusterId, linkedIssueIds = [], now = null,
} = {}) {
  if (!clusterId) return null;
  const ts = Number.isFinite(now) ? now : Date.now();
  const map = readMap();
  const id = String(clusterId);
  const before = map[id];
  const next = {
    id,
    status:             (before && before.status) || 'monitoring',
    assignedOfficerIds: (before && before.assignedOfficerIds) || [],
    linkedIssueIds:     Array.isArray(linkedIssueIds)
                         ? linkedIssueIds.slice()
                         : (before && before.linkedIssueIds) || [],
    notes:              (before && before.notes) || [],
    lastReviewedAt:     before && before.lastReviewedAt || null,
    lastReviewedBy:     before && before.lastReviewedBy || null,
    createdAt:          (before && before.createdAt) || ts,
    updatedAt:          ts,
  };
  map[id] = next;
  writeMap(map);
  return freezeRecord(next);
}

/**
 * setClusterStatus — human-driven state transitions. Explicitly
 * REJECTS `confirmed_risk` — that target is reserved for
 * `confirmCluster`, which enforces the human-confirmation contract.
 */
export function setClusterStatus(clusterId, nextStatus, { actor = null, now = null } = {}) {
  if (!clusterId || !STATUS_SET.has(String(nextStatus))) return null;
  if (String(nextStatus) === 'confirmed_risk') return null;
  const ts = Number.isFinite(now) ? now : Date.now();
  const map = readMap();
  const id = String(clusterId);
  const before = map[id];
  if (!before) return null;

  const next = {
    ...before,
    status:          String(nextStatus),
    updatedAt:       ts,
    lastReviewedAt:  ts,
    lastReviewedBy:  actor && actor.id ? String(actor.id) : before.lastReviewedBy,
  };
  map[id] = next;
  writeMap(map);
  return freezeRecord(next);
}

/**
 * confirmCluster — the ONLY path to `confirmed_risk`. Requires an
 * actor + optional diagnosis note. Adds a system note capturing
 * the confirmation.
 */
export function confirmCluster(clusterId, {
  actor, note = null, now = null,
} = {}) {
  if (!clusterId || !actor || !actor.id) return null;
  const ts = Number.isFinite(now) ? now : Date.now();
  const map = readMap();
  const id = String(clusterId);
  const before = map[id];
  if (!before) return null;
  const next = {
    ...before,
    status:          'confirmed_risk',
    updatedAt:       ts,
    lastReviewedAt:  ts,
    lastReviewedBy:  String(actor.id),
    notes: (before.notes || []).concat([{
      id:         genNoteId(),
      authorRole: actor.role || 'admin',
      authorId:   String(actor.id),
      text:       note ? String(note) : 'Confirmed as active risk',
      system:     true,
      createdAt:  ts,
    }]),
  };
  map[id] = next;
  writeMap(map);
  return freezeRecord(next);
}

/**
 * assignOfficerToCluster — append (no dupes) to assignedOfficerIds.
 */
export function assignOfficerToCluster(clusterId, officerId, { actor = null, now = null } = {}) {
  if (!clusterId || !officerId) return null;
  const ts = Number.isFinite(now) ? now : Date.now();
  const map = readMap();
  const id = String(clusterId);
  const before = map[id];
  if (!before) return null;
  const existing = Array.isArray(before.assignedOfficerIds) ? before.assignedOfficerIds : [];
  if (existing.includes(String(officerId))) return freezeRecord(before);
  const next = {
    ...before,
    assignedOfficerIds: existing.concat([String(officerId)]),
    updatedAt:          ts,
    notes: (before.notes || []).concat([{
      id:         genNoteId(),
      authorRole: actor ? (actor.role || 'admin') : 'admin',
      authorId:   actor && actor.id ? String(actor.id) : null,
      text:       `Assigned officer ${officerId}`,
      system:     true,
      createdAt:  ts,
    }]),
  };
  map[id] = next;
  writeMap(map);
  return freezeRecord(next);
}

/**
 * addClusterNote — free-text note from officer/admin. Visible in
 * the cluster detail view; not directly shown to farmers.
 */
export function addClusterNote(clusterId, { text, actor, now = null } = {}) {
  if (!clusterId || !text) return null;
  const ts = Number.isFinite(now) ? now : Date.now();
  const map = readMap();
  const id = String(clusterId);
  const before = map[id];
  if (!before) return null;
  const next = {
    ...before,
    updatedAt: ts,
    notes: (before.notes || []).concat([{
      id:         genNoteId(),
      authorRole: actor ? (actor.role || 'officer') : 'officer',
      authorId:   actor && actor.id ? String(actor.id) : null,
      text:       String(text),
      system:     false,
      createdAt:  ts,
    }]),
  };
  map[id] = next;
  writeMap(map);
  return freezeRecord(next);
}

export const _internal = Object.freeze({
  STORAGE_KEY, STATUSES,
  clear: () => {
    if (!hasStorage()) return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },
});
