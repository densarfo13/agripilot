/**
 * fundingApplicationStore.js — local-first store for
 * `FundingApplicationInterest` records.
 *
 * Storage key: farroway_funding_interests
 *
 * What this is for
 * ────────────────
 *   Farroway does NOT own the application — applications go
 *   through each program's official channel. This store
 *   captures the farmer's INTEREST + STATUS so:
 *     * NGOs can see who clicked through to a source
 *     * NGOs can see who asked for assistance
 *     * Farmers can self-track what they've engaged with
 *
 * Status taxonomy (per spec § 1)
 *   INTERESTED            — farmer clicked Apply Now (we
 *                           opened the source URL)
 *   ASSISTANCE_REQUESTED  — farmer submitted a help request
 *   APPLIED               — farmer self-reports they applied
 *                           through the source
 *   CONTACTED             — admin marked that they followed
 *                           up (admin-set only)
 *
 * Strict-rule audit (per spec § 12 trust rules)
 *   * Local-first — no backend required.
 *   * Never throws — every storage call try/catch wrapped.
 *   * Idempotent — saveFundingInterest with same id UPDATES.
 *   * Uniqueness key (farmerId, opportunityId) — calling
 *     `markStatus(opportunityId, farmerId, status)` finds
 *     the existing row and updates it instead of writing
 *     duplicates.
 *   * No sensitive document storage. Records carry farmer
 *     name + phone + free-text message only — never docs,
 *     ID numbers, or banking details.
 */

import { safeParse } from '../utils/safeParse.js';
import { safeTrackEvent } from '../lib/analytics.js';

export const STORAGE_KEY = 'farroway_funding_interests';

export const INTEREST_STATUS = Object.freeze({
  INTERESTED:           'INTERESTED',
  ASSISTANCE_REQUESTED: 'ASSISTANCE_REQUESTED',
  APPLIED:              'APPLIED',
  CONTACTED:            'CONTACTED',
});

export const INTEREST_EVENTS = Object.freeze({
  APPLY_CLICKED:    'FUNDING_APPLY_CLICKED',
  HELP_REQUESTED:   'FUNDING_HELP_REQUESTED',
  STATUS_UPDATED:   'FUNDING_STATUS_UPDATED',
});

const MAX_ROWS = 500;

// ─── primitives ───────────────────────────────────────────

function _read() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function _write(rows) {
  try {
    if (typeof localStorage === 'undefined') return false;
    const safe = Array.isArray(rows) ? rows.slice(-MAX_ROWS) : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}

function _now() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _uid() {
  try {
    return `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `int_${Date.now()}`;
  }
}

function _validStatus(s) {
  const u = String(s || '').toUpperCase();
  return Object.values(INTEREST_STATUS).includes(u) ? u : null;
}

// ─── Reads ────────────────────────────────────────────────

/**
 * All interests on this device, newest first.
 */
export function getFundingInterests() {
  const rows = _read();
  return rows
    .filter((r) => r && typeof r === 'object' && r.id && r.opportunityId)
    .sort((a, b) =>
      String(b.updatedAt || b.createdAt || '')
        .localeCompare(String(a.updatedAt || a.createdAt || '')));
}

export function getInterestsByOpportunity(opportunityId) {
  if (!opportunityId) return [];
  return getFundingInterests().filter(
    (i) => i.opportunityId === opportunityId,
  );
}

/**
 * Interests already recorded for this farmer. Used by the
 * detail page to know whether to show "Apply Now" vs
 * "Already applied" hints — never blocks the farmer from
 * acting again, just changes the surface.
 */
export function getFarmerInterests(farmerId) {
  if (!farmerId) return [];
  return getFundingInterests().filter(
    (i) => String(i.farmerId || '') === String(farmerId),
  );
}

/**
 * Finds the existing (farmerId, opportunityId) row, if any.
 * Used so a farmer who clicks Apply Now twice doesn't
 * generate two INTERESTED rows.
 */
export function findInterest({ farmerId, opportunityId }) {
  if (!farmerId || !opportunityId) return null;
  const all = _read();
  return all.find((r) =>
    r && r.farmerId === farmerId && r.opportunityId === opportunityId,
  ) || null;
}

// ─── Writes ───────────────────────────────────────────────

/**
 * saveFundingInterest(interest) — idempotent on either:
 *   * `interest.id` (existing row), or
 *   * `(farmerId, opportunityId)` pair
 *
 * Returns the stored record (with id, createdAt, updatedAt).
 * Emits INTEREST_EVENTS.HELP_REQUESTED for ASSISTANCE_REQUESTED,
 * INTEREST_EVENTS.STATUS_UPDATED otherwise.
 */
export function saveFundingInterest(interest) {
  const safe = interest && typeof interest === 'object' ? interest : {};
  const status = _validStatus(safe.status) || INTEREST_STATUS.INTERESTED;
  const now    = _now();

  const rows = _read();

  // Find existing row by id first, then by (farmer, opp) pair.
  let idx = -1;
  if (safe.id) {
    idx = rows.findIndex((r) => r && r.id === safe.id);
  }
  if (idx < 0 && safe.farmerId && safe.opportunityId) {
    idx = rows.findIndex((r) =>
      r && r.farmerId === safe.farmerId
        && r.opportunityId === safe.opportunityId);
  }

  const id = (idx >= 0) ? rows[idx].id : (safe.id || _uid());

  // Privacy: only store name + phone + free text. NEVER any
  // sensitive document, ID number, or bank detail.
  const stored = {
    id,
    farmerId:      safe.farmerId      || null,
    farmId:        safe.farmId        || null,
    opportunityId: String(safe.opportunityId || ''),
    status,
    farmerName:    String(safe.farmerName  || '').trim(),
    farmerPhone:   String(safe.farmerPhone || '').trim(),
    message:       String(safe.message     || '').trim(),
    createdAt:     safe.createdAt
                     || (idx >= 0 ? rows[idx].createdAt : now),
    updatedAt:     now,
    synced:        Boolean(safe.synced),
  };

  if (idx >= 0) rows[idx] = stored;
  else          rows.push(stored);
  _write(rows);

  try {
    const evt = status === INTEREST_STATUS.ASSISTANCE_REQUESTED
      ? INTEREST_EVENTS.HELP_REQUESTED
      : INTEREST_EVENTS.STATUS_UPDATED;
    safeTrackEvent(evt, {
      interestId:    stored.id,
      opportunityId: stored.opportunityId,
      status:        stored.status,
    });
  } catch { /* analytics never blocks */ }

  return stored;
}

/**
 * updateFundingInterest(id, updates) — partial merge by id.
 * Returns the next row, or null if id doesn't match. Emits
 * INTEREST_EVENTS.STATUS_UPDATED on every successful write.
 */
export function updateFundingInterest(id, updates) {
  if (!id) return null;
  const rows = _read();
  const idx  = rows.findIndex((r) => r && r.id === id);
  if (idx < 0) return null;
  const merged = { ...rows[idx], ...(updates || {}) };
  // Validate / normalise status if it was supplied.
  if (updates && updates.status) {
    const v = _validStatus(updates.status);
    if (v) merged.status = v;
    else   merged.status = rows[idx].status;
  }
  merged.updatedAt = _now();
  rows[idx] = merged;
  _write(rows);
  try {
    safeTrackEvent(INTEREST_EVENTS.STATUS_UPDATED, {
      interestId:    id,
      opportunityId: merged.opportunityId,
      status:        merged.status,
    });
  } catch { /* ignore */ }
  return merged;
}

/**
 * Convenience: log Apply-Now click + save / upsert
 * an INTERESTED row. Called by the detail page after
 * opening the source URL in a new tab.
 */
export function recordApplyClick({ farmerId, farmId, opportunityId, farmerName, farmerPhone }) {
  if (!opportunityId) return null;
  try {
    safeTrackEvent(INTEREST_EVENTS.APPLY_CLICKED, {
      opportunityId, farmerId: farmerId || null,
    });
  } catch { /* ignore */ }
  return saveFundingInterest({
    farmerId, farmId, opportunityId,
    farmerName, farmerPhone,
    status: INTEREST_STATUS.INTERESTED,
  });
}

/**
 * Aggregate counts used by the NGO panels. Pure: reads the
 * current store and returns a snapshot.
 */
export function interestSummary() {
  const all = getFundingInterests();
  const byOpportunity = new Map();
  for (const r of all) {
    if (!byOpportunity.has(r.opportunityId)) {
      byOpportunity.set(r.opportunityId, {
        opportunityId: r.opportunityId,
        total: 0, interested: 0,
        assistanceRequested: 0, applied: 0, contacted: 0,
      });
    }
    const b = byOpportunity.get(r.opportunityId);
    b.total += 1;
    switch (r.status) {
      case INTEREST_STATUS.INTERESTED:           b.interested += 1; break;
      case INTEREST_STATUS.ASSISTANCE_REQUESTED: b.assistanceRequested += 1; break;
      case INTEREST_STATUS.APPLIED:              b.applied += 1; break;
      case INTEREST_STATUS.CONTACTED:            b.contacted += 1; break;
      default: /* unknown — ignore */ break;
    }
  }
  return {
    total:                all.length,
    interested:           all.filter((r) => r.status === INTEREST_STATUS.INTERESTED).length,
    assistanceRequested:  all.filter((r) => r.status === INTEREST_STATUS.ASSISTANCE_REQUESTED).length,
    applied:              all.filter((r) => r.status === INTEREST_STATUS.APPLIED).length,
    contacted:            all.filter((r) => r.status === INTEREST_STATUS.CONTACTED).length,
    byOpportunity:        Array.from(byOpportunity.values()),
  };
}
