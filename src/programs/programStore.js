/**
 * programStore.js — local-first store for the v3 NGO
 * Program Distribution System.
 *
 * Storage keys:
 *   farroway_programs            (Program rows)
 *   farroway_program_deliveries  (ProgramDelivery rows)
 *
 * Spec contract (NGO Programs, § 1–9)
 *   * Program targets: { crops, regions, farmerIds } —
 *     empty array = match all on that dimension.
 *   * createDeliveries(program, farmers) — idempotent on
 *     (programId, farmerId).
 *   * Status taxonomy: SENT → OPENED → ACTED.
 *   * Anti-spam: getProgramsForFarmer(farmer) returns at
 *     most ACTIVE_LIMIT programs, sorted newest first, so
 *     the Today screen never shows more than 1–2 cards.
 *   * Never blocks the farmer flow.
 *
 * Strict-rule audit
 *   * Never throws — every storage call wrapped, reads use
 *     safeParse with a `[]` fallback.
 *   * Idempotent saves on `id` for programs and on
 *     `(programId, farmerId)` for deliveries.
 *   * Events: PROGRAM_CREATED, PROGRAM_SENT,
 *     PROGRAM_OPENED, PROGRAM_ACTED — emitted via
 *     safeTrackEvent.
 *   * Privacy: program rows carry only target rules + the
 *     operator's id (createdBy). No farmer PII.
 *     ProgramDelivery rows carry farmerId only — no name /
 *     phone / email.
 */

import { safeParse } from '../utils/safeParse.js';
import { safeTrackEvent } from '../lib/analytics.js';

export const STORAGE_KEYS = Object.freeze({
  PROGRAMS:   'farroway_programs',
  DELIVERIES: 'farroway_program_deliveries',
});

export const PROGRAM_STATUS = Object.freeze({
  SENT:   'SENT',
  OPENED: 'OPENED',
  ACTED:  'ACTED',
});

export const PROGRAM_EVENTS = Object.freeze({
  CREATED: 'PROGRAM_CREATED',
  SENT:    'PROGRAM_SENT',
  OPENED:  'PROGRAM_OPENED',
  ACTED:   'PROGRAM_ACTED',
});

export const PROGRAM_TYPES = Object.freeze([
  'alert', 'training', 'input_support', 'subsidy', 'announcement',
]);

// Per spec § 9: never show more than 1–2 active programs at
// once. Sorted newest-first then capped here so the Today
// screen UI doesn't have to enforce it again.
export const ACTIVE_LIMIT = 2;
const MAX_PROGRAMS = 200;
const MAX_DELIVERIES = 5000;

// ─── primitives ───────────────────────────────────────────

function _read(key) {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(key);
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(key, rows, cap) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const safe = Array.isArray(rows) ? rows.slice(-cap) : [];
    localStorage.setItem(key, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

function _now() {
  try { return new Date().toISOString(); } catch { return ''; }
}
function _uid(prefix) {
  try {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `${prefix}_${Date.now()}`;
  }
}
function _norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function _safeArr(x) { return Array.isArray(x) ? x : []; }

// ─── Programs ─────────────────────────────────────────────

/**
 * createProgram(input) — idempotent on `id`. Returns the
 * stored row.
 */
export function createProgram(input) {
  const safe = input && typeof input === 'object' ? input : {};
  const now  = _now();
  const id   = safe.id || _uid('prg');

  const stored = {
    id,
    title:        String(safe.title || '').trim(),
    type:         PROGRAM_TYPES.includes(safe.type) ? safe.type : 'announcement',
    message:      String(safe.message || '').trim(),
    target: {
      crops:     _safeArr(safe.target?.crops).map((c) => _norm(c)).filter(Boolean),
      regions:   _safeArr(safe.target?.regions).map((r) => String(r).trim()).filter(Boolean),
      farmerIds: _safeArr(safe.target?.farmerIds).map(String).filter(Boolean),
    },
    deadline:    safe.deadline || null,
    createdBy:   safe.createdBy || null,
    createdAt:   safe.createdAt || now,
    updatedAt:   now,
  };

  const rows = _read(STORAGE_KEYS.PROGRAMS);
  const idx  = rows.findIndex((r) => r && r.id === id);
  if (idx >= 0) rows[idx] = stored;
  else          rows.push(stored);
  _write(STORAGE_KEYS.PROGRAMS, rows, MAX_PROGRAMS);

  try {
    safeTrackEvent(PROGRAM_EVENTS.CREATED, {
      programId: stored.id,
      type:      stored.type,
      hasCrops:    stored.target.crops.length > 0,
      hasRegions:  stored.target.regions.length > 0,
      hasFarmers:  stored.target.farmerIds.length > 0,
    });
  } catch { /* analytics never blocks */ }

  return stored;
}

export function getPrograms() {
  return _read(STORAGE_KEYS.PROGRAMS)
    .filter((p) => p && p.id && p.title)
    .sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function getProgramById(id) {
  if (!id) return null;
  return getPrograms().find((p) => p.id === id) || null;
}

// ─── Matching ─────────────────────────────────────────────

/**
 * Does this farmer match the given program's target?
 *
 * Rules (per spec § 1):
 *   * `target.farmerIds` — explicit allow-list. If set AND
 *     this farmer's id is included, MATCH (overrides
 *     crops/regions filters).
 *   * `target.crops` — empty = any crop. Otherwise farmer
 *     must grow at least one of them.
 *   * `target.regions` — empty = any region. Otherwise
 *     farmer's region must match (case-insensitive).
 *   * Both crops + regions are AND-combined when present.
 *   * Inactive programs (deadline past) never match.
 */
export function programMatchesFarmer(program, farmer) {
  if (!program || !program.target) return false;
  if (_isExpired(program)) return false;

  const t = program.target;
  const farmerId = String(farmer?.id || farmer?.farmerId || '');

  // Explicit allow-list — short-circuit MATCH.
  if (t.farmerIds && t.farmerIds.length > 0) {
    if (farmerId && t.farmerIds.includes(farmerId)) return true;
    // If allow-list is set and we're not in it, AND no
    // crop/region rules exist, we don't match. If crop/
    // region rules exist alongside, fall through and
    // evaluate them — most generous interpretation.
    if (t.crops.length === 0 && t.regions.length === 0) return false;
  }

  // Crop check
  if (t.crops && t.crops.length > 0) {
    const farmCrops = _farmerCrops(farmer);
    const cropOk = farmCrops.some((c) => t.crops.includes(c));
    if (!cropOk) return false;
  }

  // Region check
  if (t.regions && t.regions.length > 0) {
    const farmerRegion = _norm(farmer?.region
                            || (farmer?.location && farmer.location.region)
                            || farmer?.state);
    const targetRegions = t.regions.map(_norm);
    if (!farmerRegion || !targetRegions.includes(farmerRegion)) {
      return false;
    }
  }

  return true;
}

function _farmerCrops(farmer) {
  if (!farmer) return [];
  const out = [];
  const single = farmer.crop || farmer.cropType || farmer.primaryCrop;
  if (single) out.push(_norm(single));
  if (Array.isArray(farmer.crops))     out.push(...farmer.crops.map(_norm));
  if (Array.isArray(farmer.cropTypes)) out.push(...farmer.cropTypes.map(_norm));
  return out.filter(Boolean);
}

function _isExpired(program) {
  if (!program || !program.deadline) return false;
  const t = Date.parse(program.deadline);
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
}

/**
 * resolveMatchingFarmers(program, farmers) — pure helper
 * used by the Create Program page to find all farmers that
 * a freshly-saved program would target. The farmers list
 * comes from the host (NGOMapDashboard's getFarms() or
 * similar) — the store doesn't fetch farmers itself.
 */
export function resolveMatchingFarmers(program, farmers) {
  return _safeArr(farmers).filter(
    (f) => f && programMatchesFarmer(program, f),
  );
}

// ─── Deliveries ───────────────────────────────────────────

/**
 * createDeliveries(program, farmers) — upserts a SENT
 * delivery row for each matched farmer. Idempotent on
 * (programId, farmerId). Returns the array of deliveries
 * that were INSERTED OR REVIVED (not the no-op skips).
 */
export function createDeliveries(program, farmers) {
  if (!program || !program.id) return [];
  const targets = resolveMatchingFarmers(program, farmers);
  if (!targets.length) return [];

  const now = _now();
  const rows = _read(STORAGE_KEYS.DELIVERIES);
  const out = [];

  for (const f of targets) {
    const farmerId = String(f.id || f.farmerId || '');
    if (!farmerId) continue;
    const idx = rows.findIndex(
      (d) => d && d.programId === program.id
                && d.farmerId === farmerId,
    );
    if (idx >= 0) {
      // Already delivered. Only refresh updatedAt; never
      // demote OPENED / ACTED back to SENT.
      rows[idx].updatedAt = now;
    } else {
      const stored = {
        id:         _uid('dlv'),
        programId:  program.id,
        farmerId,
        status:     PROGRAM_STATUS.SENT,
        createdAt:  now,
        updatedAt:  now,
      };
      rows.push(stored);
      out.push(stored);
    }
  }
  _write(STORAGE_KEYS.DELIVERIES, rows, MAX_DELIVERIES);

  try {
    safeTrackEvent(PROGRAM_EVENTS.SENT, {
      programId: program.id,
      newSent:   out.length,
      total:     targets.length,
    });
  } catch { /* ignore */ }

  return out;
}

export function getDeliveries() {
  return _read(STORAGE_KEYS.DELIVERIES)
    .filter((d) => d && d.id && d.programId && d.farmerId);
}

export function getDeliveriesByProgram(programId) {
  if (!programId) return [];
  return getDeliveries().filter((d) => d.programId === programId);
}

export function getDeliveriesByFarmer(farmerId) {
  if (!farmerId) return [];
  return getDeliveries().filter(
    (d) => String(d.farmerId) === String(farmerId),
  );
}

/**
 * updateDeliveryStatus(programId, farmerId, status) —
 * forward-only state machine: SENT → OPENED → ACTED. We
 * never demote (OPENED never reverts to SENT, ACTED never
 * reverts to OPENED). Returns the next row or null.
 *
 * Emits PROGRAM_OPENED / PROGRAM_ACTED on the first
 * transition into each state.
 */
export function updateDeliveryStatus(programId, farmerId, status) {
  if (!programId || !farmerId) return null;
  const target = String(status || '').toUpperCase();
  if (!Object.values(PROGRAM_STATUS).includes(target)) return null;

  const rows = _read(STORAGE_KEYS.DELIVERIES);
  const idx = rows.findIndex(
    (d) => d && d.programId === programId
              && String(d.farmerId) === String(farmerId),
  );
  if (idx < 0) return null;

  const cur = rows[idx];
  const order = { SENT: 0, OPENED: 1, ACTED: 2 };
  const curRank    = order[cur.status]  ?? 0;
  const nextRank   = order[target]      ?? 0;
  if (nextRank <= curRank) return cur;     // no-op (forward-only)

  const next = { ...cur, status: target, updatedAt: _now() };
  rows[idx] = next;
  _write(STORAGE_KEYS.DELIVERIES, rows, MAX_DELIVERIES);

  try {
    if (target === PROGRAM_STATUS.OPENED) {
      safeTrackEvent(PROGRAM_EVENTS.OPENED, {
        programId, farmerId,
      });
    } else if (target === PROGRAM_STATUS.ACTED) {
      safeTrackEvent(PROGRAM_EVENTS.ACTED, {
        programId, farmerId,
      });
    }
  } catch { /* ignore */ }

  return next;
}

// ─── Farmer-side ──────────────────────────────────────────

/**
 * getProgramsForFarmer(farmer) — returns the FRESHEST
 * delivered programs for this farmer that are still active
 * (deadline not past). Capped to ACTIVE_LIMIT (anti-spam
 * per spec § 8 + § 9).
 *
 * Each entry is `{ program, delivery }` so the Today card
 * can show metadata + drive markOpened/markActed.
 */
export function getProgramsForFarmer(farmer) {
  if (!farmer) return [];
  const farmerId = String(farmer.id || farmer.farmerId || farmer.userId || '');
  if (!farmerId) return [];

  const programs = getPrograms();
  const deliveriesById = new Map();
  for (const d of getDeliveriesByFarmer(farmerId)) {
    deliveriesById.set(d.programId, d);
  }

  const out = [];
  for (const p of programs) {
    if (_isExpired(p)) continue;
    const d = deliveriesById.get(p.id);
    if (!d) continue;
    out.push({ program: p, delivery: d });
  }

  // Newest first. Sort by program.createdAt desc.
  out.sort((a, b) =>
    String(b.program.createdAt || '').localeCompare(
      String(a.program.createdAt || '')));

  return out.slice(0, ACTIVE_LIMIT);
}

/**
 * Convenience for the Today card click:
 *   markOpened(programId, farmerId)
 *   markActed (programId, farmerId)
 *
 * Both forward-only via updateDeliveryStatus.
 */
export function markOpened(programId, farmerId) {
  return updateDeliveryStatus(programId, farmerId, PROGRAM_STATUS.OPENED);
}
export function markActed(programId, farmerId) {
  return updateDeliveryStatus(programId, farmerId, PROGRAM_STATUS.ACTED);
}

/**
 * programPerformanceSummary() — aggregate counts per
 * program for the NGO dashboard performance table.
 *
 *   [{ programId, title, sent, opened, acted }, …]
 */
export function programPerformanceSummary() {
  const programs   = getPrograms();
  const deliveries = getDeliveries();
  const byProgram  = new Map();
  for (const p of programs) {
    byProgram.set(p.id, {
      programId: p.id,
      title:     p.title,
      type:      p.type,
      deadline:  p.deadline || null,
      sent: 0, opened: 0, acted: 0,
    });
  }
  for (const d of deliveries) {
    const row = byProgram.get(d.programId);
    if (!row) continue;
    row.sent += 1;                                            // every delivery counts as sent
    if (d.status === PROGRAM_STATUS.OPENED) row.opened += 1;
    if (d.status === PROGRAM_STATUS.ACTED)  { row.opened += 1; row.acted += 1; }
  }
  // ACTED implies OPENED for the funnel, so the count above
  // bumps opened too. This keeps the dashboard's funnel
  // honest: opened ≥ acted, sent ≥ opened.

  return Array.from(byProgram.values()).sort(
    (a, b) => b.sent - a.sent,
  );
}
