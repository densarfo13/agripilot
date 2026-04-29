/**
 * fundingStore.js — local-first store for funding /
 * support opportunities + matched-farmer records.
 *
 *   Storage key: farroway_funding_opportunities
 *
 * The store is the single source of truth for the v3
 * Funding Opportunities Layer when no backend exists. It
 * also seeds three DEMO entries on first read so the
 * /opportunities page is never empty in pilots/demos —
 * those carry `sample: true` and the UI renders a SAMPLE
 * pill so nobody can mistake them for real programs.
 *
 * Strict-rule audit (per spec § 13)
 *   * Never throws — every storage call is try/catch
 *     wrapped, every read uses safeParse with `[]` fallback.
 *   * Idempotent saves — saveFundingOpportunity(o) with an
 *     existing id UPDATES instead of duplicating.
 *   * Privacy + trust — opportunities never carry farmer
 *     PII. Matched-farmer records (FundingMatch) are
 *     in-memory only; we do not persist farmer-funding
 *     pairs to localStorage to avoid leaking a farmer's
 *     eligibility profile through a leaked browser dump.
 *   * Farmer view filter is hard-coded in
 *     getActiveFundingOpportunities — only `active &&
 *     verified` rows are returned. Inactive / unverified
 *     entries stay accessible to admins via the full
 *     getFundingOpportunities() reader.
 */

import { safeParse } from '../utils/safeParse.js';
import { safeTrackEvent } from '../lib/analytics.js';
import SAMPLE_FUNDING_OPPORTUNITIES from './sampleOpportunities.js';
import { matchFundingForFarm } from './fundingMatcher.js';

export const STORAGE_KEY = 'farroway_funding_opportunities';

export const FUNDING_EVENTS = Object.freeze({
  VIEWED:       'FUNDING_OPPORTUNITY_VIEWED',
  CLICKED:      'FUNDING_OPPORTUNITY_CLICKED',
  MATCH_SHOWN:  'FUNDING_MATCH_SHOWN',
  CREATED:      'FUNDING_ADMIN_CREATED',
  UPDATED:      'FUNDING_ADMIN_UPDATED',
  DEACTIVATED:  'FUNDING_ADMIN_DEACTIVATED',
  EXPORT_CLICK: 'FUNDING_EXPORT_CLICKED',
});

export const OPPORTUNITY_TYPES = Object.freeze([
  'grant', 'subsidy', 'loan', 'training', 'input_support',
]);

const MAX_ROWS = 200;
const SEEDED_FLAG = 'farroway_funding_seeded';

// ─── primitives ────────────────────────────────────────────

function _read() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = safeParse(raw, null);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
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
    return `fnd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `fnd_${Date.now()}`;
  }
}

/**
 * Seed sample opportunities ONCE, on first read. We respect
 * a user / admin who has explicitly cleared the store —
 * a SEEDED_FLAG sentinel in localStorage prevents the seeds
 * from re-appearing every page load. Admins who want to
 * remove the samples can deactivate them via FundingAdmin.
 */
function _ensureSeeded() {
  const existing = _read();
  if (Array.isArray(existing)) return existing;
  let seededBefore = false;
  try {
    if (typeof localStorage !== 'undefined') {
      seededBefore = localStorage.getItem(SEEDED_FLAG) === '1';
    }
  } catch { /* ignore */ }

  if (seededBefore) {
    // The user has explicitly cleared the store before. Honor
    // that intent — start with an empty array, no re-seed.
    _write([]);
    return [];
  }

  // First run: seed the demo entries and mark seeded.
  const seeds = SAMPLE_FUNDING_OPPORTUNITIES.map((o) => ({
    ...o,
    createdAt: _now(),
    updatedAt: _now(),
  }));
  _write(seeds);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SEEDED_FLAG, '1');
    }
  } catch { /* ignore */ }
  return seeds;
}

// ─── Reads ────────────────────────────────────────────────

/**
 * ALL opportunities (admin view). Newest first.
 */
export function getFundingOpportunities() {
  const rows = _ensureSeeded();
  return rows
    .filter((r) => r && typeof r === 'object' && r.id && r.title)
    .sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

/**
 * Farmer view: only `active === true && verified === true`.
 * Hard filter — never let an unverified or inactive entry
 * surface to a farmer. Sample (demo) entries are still
 * returned; the UI is responsible for showing the SAMPLE
 * pill.
 */
export function getActiveFundingOpportunities() {
  return getFundingOpportunities().filter(
    (o) => o.active === true && o.verified === true,
  );
}

// ─── Writes ───────────────────────────────────────────────

/**
 * saveFundingOpportunity(o) — idempotent insert/update
 * keyed on `id`. Emits FUNDING_ADMIN_CREATED on insert,
 * FUNDING_ADMIN_UPDATED on update.
 */
export function saveFundingOpportunity(opportunity) {
  const safe = opportunity && typeof opportunity === 'object'
    ? opportunity : {};
  const now  = _now();
  const id   = safe.id || _uid();

  const rows = _ensureSeeded();
  const idx  = rows.findIndex((r) => r && r.id === id);

  const stored = {
    id,
    title:           String(safe.title || '').trim(),
    description:     String(safe.description || '').trim(),
    country:         String(safe.country || '*').trim() || '*',
    regions:         Array.isArray(safe.regions)
                       ? safe.regions.map((r) => String(r).trim()).filter(Boolean)
                       : [],
    crops:           Array.isArray(safe.crops)
                       ? safe.crops.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
                       : [],
    opportunityType: OPPORTUNITY_TYPES.includes(safe.opportunityType)
                       ? safe.opportunityType
                       : 'grant',
    benefit:         String(safe.benefit || '').trim(),
    eligibilityText: String(safe.eligibilityText || '').trim(),
    minFarmSize:     Number.isFinite(Number(safe.minFarmSize))
                       ? Number(safe.minFarmSize) : 0,
    maxFarmSize:     Number.isFinite(Number(safe.maxFarmSize))
                       ? Number(safe.maxFarmSize) : 9999,
    deadline:        safe.deadline || null,
    sourceName:      String(safe.sourceName || '').trim(),
    sourceUrl:       String(safe.sourceUrl || '').trim(),
    contactEmail:    String(safe.contactEmail || '').trim(),
    // Defaults err on the SAFE side: a brand-new entry
    // starts inactive + unverified so an accidental save
    // never surfaces an unreviewed program to farmers.
    active:          safe.active === true,
    verified:        safe.verified === true,
    sample:          Boolean(safe.sample),
    createdAt:       safe.createdAt
                       || (idx >= 0 ? rows[idx].createdAt : now),
    updatedAt:       now,
  };

  if (idx >= 0) {
    rows[idx] = stored;
  } else {
    rows.push(stored);
  }
  _write(rows);

  try {
    safeTrackEvent(
      idx >= 0 ? FUNDING_EVENTS.UPDATED : FUNDING_EVENTS.CREATED,
      {
        opportunityId: stored.id,
        type:          stored.opportunityType,
        country:       stored.country,
        active:        stored.active,
        verified:      stored.verified,
      },
    );
  } catch { /* analytics never blocks */ }

  return stored;
}

/**
 * Partial update by id. No-op (returns null) if the
 * opportunity doesn't exist. Emits FUNDING_ADMIN_UPDATED.
 */
export function updateFundingOpportunity(id, updates) {
  if (!id) return null;
  const rows = _ensureSeeded();
  const idx  = rows.findIndex((r) => r && r.id === id);
  if (idx < 0) return null;
  const next = { ...rows[idx], ...(updates || {}), updatedAt: _now() };
  rows[idx] = next;
  _write(rows);
  try {
    safeTrackEvent(FUNDING_EVENTS.UPDATED, {
      opportunityId: id,
      active:   next.active,
      verified: next.verified,
    });
  } catch { /* ignore */ }
  return next;
}

/**
 * Convenience alias for the most common update — flips
 * `active=false`. Emits FUNDING_ADMIN_DEACTIVATED.
 */
export function deactivateFundingOpportunity(id) {
  const next = updateFundingOpportunity(id, { active: false });
  if (next) {
    try {
      safeTrackEvent(FUNDING_EVENTS.DEACTIVATED, { opportunityId: id });
    } catch { /* ignore */ }
  }
  return next;
}

/**
 * Convenience used by the matcher's "no input" case.
 * Returns the empty array on missing localStorage / corrupt
 * data — never throws.
 */
export function getFarmerFundingMatches(farm) {
  // Thin wrapper so pages can call one symbol from one
  // module. The matcher itself is pure and takes the
  // catalog as an input — no import cycle.
  try {
    return matchFundingForFarm(
      farm, getActiveFundingOpportunities(),
    );
  } catch {
    return [];
  }
}
