/**
 * farmerAnalytics.js — pure local-read helpers for Phase 7D
 * basic analytics cards.
 *
 * All functions are synchronous, side-effect-free, and safe to call
 * in SSR / locked-down browsers (each returns 0 or null on failure).
 * They read only from localStorage keys owned by existing stores
 * and never write.
 *
 * Spec: Phase 7D restore — read-only analytics, no ML, no charts.
 *
 * Farmer cards
 *   getTasksCompletedThisWeek() → number
 *   getListingsCreated()        → number
 *   getInterestsReceived()      → number
 *   getSavedFundingCount()      → number
 *   getCropProgressStatus()     → { crop, stage } | null
 *
 * Admin/NGO extras (also readable by the admin analytics page)
 *   getListingsCreated()   — device-total listing count
 *   getInterestsReceived() — device-total interest count scoped to
 *                            this farmer's listing IDs
 *
 * Strict-rule audit
 *   • No React imports.
 *   • Every function is try/catch wrapped and returns a safe default.
 *   • Storage keys mirror the canonical constants in each store file
 *     exactly — a single grep confirms they stay in sync.
 */

// ─── Storage key mirror ──────────────────────────────────────
// Keep in sync with:
//   homeTaskState.js  → HOME_TASK_STATE_KEY = 'farroway_home_task_state'
//   marketStore.js    → STORAGE_KEYS.LISTINGS / STORAGE_KEYS.INTERESTS
//   fundingBookmarks  → BOOKMARKS_KEY = 'farroway_funding_bookmarks'
//   storageSafe.js    → ACTIVE_FARM key
const _KEYS = Object.freeze({
  HOME_TASK_STATE: 'farroway_home_task_state',
  LISTINGS:        'farroway_market_listings',
  INTERESTS:       'farroway_buyer_interests',
  BOOKMARKS:       'farroway_funding_bookmarks',
  ACTIVE_FARM:     'farroway_active_farm',
});

function _safeRead(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

// ─── Exports ─────────────────────────────────────────────────

/**
 * Tasks marked "done" in the last 7 days.
 * Source: farroway_home_task_state (homeTaskState.js ring buffer).
 * Entries older than 24h expire on read in homeTaskState, but we
 * count the last 7 days here to give a weekly view.
 */
export function getTasksCompletedThisWeek() {
  try {
    const entries = _safeRead(_KEYS.HOME_TASK_STATE);
    if (!Array.isArray(entries)) return 0;
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return entries.filter(
      (e) => e
          && e.status === 'done'
          && e.stampedAt
          && Date.parse(e.stampedAt) >= cutoff,
    ).length;
  } catch { return 0; }
}

/**
 * Total listings stored on this device (all statuses: ACTIVE, DRAFT,
 * SOLD, EXPIRED). In the pilot, all device listings belong to the
 * current farmer — no cross-device mixing.
 * Source: farroway_market_listings (marketStore.js).
 */
export function getListingsCreated() {
  try {
    const rows = _safeRead(_KEYS.LISTINGS);
    return Array.isArray(rows) ? rows.length : 0;
  } catch { return 0; }
}

/**
 * Buyer interests for THIS farmer's listings, matched by listingId.
 * Falls back to the total interest count when no listings exist yet
 * (covers the first-interest-before-first-listing edge case).
 * Source: farroway_buyer_interests (marketStore.js).
 */
export function getInterestsReceived() {
  try {
    const listings  = _safeRead(_KEYS.LISTINGS);
    const myIds = new Set(
      (Array.isArray(listings) ? listings : [])
        .map((l) => l && l.id)
        .filter(Boolean),
    );
    const interests = _safeRead(_KEYS.INTERESTS);
    if (!Array.isArray(interests)) return 0;
    if (myIds.size === 0) return interests.length; // no listings yet → show all
    return interests.filter((i) => i && myIds.has(i.listingId)).length;
  } catch { return 0; }
}

/**
 * Number of bookmarked funding opportunities.
 * Source: farroway_funding_bookmarks (fundingBookmarks.js).
 */
export function getSavedFundingCount() {
  try {
    const rows = _safeRead(_KEYS.BOOKMARKS);
    return Array.isArray(rows) ? rows.length : 0;
  } catch { return 0; }
}

/**
 * Crop + stage snapshot from the active farm profile.
 * Returns { crop: string, stage: string|null } or null when no
 * farm data is on this device.
 * Source: farroway_active_farm (storageSafe / farmStore).
 */
export function getCropProgressStatus() {
  try {
    const farm = _safeRead(_KEYS.ACTIVE_FARM);
    if (!farm || typeof farm !== 'object') return null;
    const crop  = String(
      farm.crop || farm.cropName || farm.cropType || '',
    ).trim();
    const stage = String(
      farm.cropStage || farm.stage || farm.plantStage || '',
    ).trim();
    if (!crop) return null;
    return { crop, stage: stage || null };
  } catch { return null; }
}

// Test hook.
export const _internal = Object.freeze({ _KEYS, _safeRead });
