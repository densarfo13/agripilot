/**
 * importHardening — NGO-grade safety layer on top of the V2 import
 * services (spec §1–§7).
 *
 * Everything here is a pure function so the same logic serves:
 *   - the manual admin upload page
 *   - a future programmatic API ingestion path
 *   - dev assertions in test harnesses
 *
 * Nothing in this module writes to storage or calls APIs.
 */

// ─── Enums ─────────────────────────────────────────────────

export const CONFIDENCE_LEVEL = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const FARMER_STATE = Object.freeze({
  PENDING_ACTIVATION: 'imported_pending_activation',
  READY_NO_CROP: 'imported_ready_no_crop',
  READY_WITH_CROP: 'imported_ready_with_crop',
  ACTIVE: 'active_farmer',
});

// Status a matcher may attach on top of the existing NEW / UPDATE_EXISTING
// values. POSSIBLE_DUPLICATE is never auto-merged — the operator resolves.
export const IMPORT_STATUS_EXT = Object.freeze({
  POSSIBLE_DUPLICATE: 'POSSIBLE_DUPLICATE',
});

// ─── Confidence scoring (spec §2) ──────────────────────────

/**
 * Score a normalized row's data quality. Higher confidence = safer to
 * import and onboard. Written to the farmer record as `import_confidence`.
 *
 * HIGH    → phone ≥ 9 digits AND country AND region
 * MEDIUM  → phone present + (country OR region) but something soft is missing
 * LOW     → missing / short phone, or no country + no region
 */
export function computeImportConfidence(row) {
  if (!row) return CONFIDENCE_LEVEL.LOW;

  const phoneDigits = String(row.phone_number || '').replace(/\D/g, '').length;
  const hasPhone = phoneDigits >= 9;
  const shortPhone = phoneDigits >= 7 && phoneDigits < 9;
  const hasCountry = !!row.country;
  const hasRegion = !!row.region_or_state;
  const hasName = !!row.full_name;

  if (!hasName) return CONFIDENCE_LEVEL.LOW;
  if (shortPhone || !phoneDigits) return CONFIDENCE_LEVEL.LOW;
  if (!hasCountry && !hasRegion) return CONFIDENCE_LEVEL.LOW;

  if (hasPhone && hasCountry && hasRegion) return CONFIDENCE_LEVEL.HIGH;
  return CONFIDENCE_LEVEL.MEDIUM;
}

// ─── Farmer state (spec §3) ────────────────────────────────

/**
 * Derive the lifecycle state for a just-created or updated farmer.
 */
export function deriveFarmerState({
  consentState,
  hasCrop,
  hasLoggedIn,
  lastActivityAt,
} = {}) {
  if (hasLoggedIn || lastActivityAt) return FARMER_STATE.ACTIVE;
  if (consentState === 'imported_pending_activation' || !consentState) {
    return FARMER_STATE.PENDING_ACTIVATION;
  }
  return hasCrop ? FARMER_STATE.READY_WITH_CROP : FARMER_STATE.READY_NO_CROP;
}

// ─── Safe-merge with conflict detection (spec §5) ──────────

/**
 * Protected fields — never overwrite an existing non-empty value
 * silently. If the incoming row disagrees, surface a conflict so the
 * operator can decide.
 */
const PROTECTED_FIELDS = ['phone_number', 'region_or_state', 'country', 'crop'];

/**
 * Fields safe to fill in when blank on the existing record.
 */
const FILLABLE_FIELDS = [
  'full_name', 'district', 'village', 'preferred_language',
  'land_size', 'gender', 'age_range', 'external_farmer_id',
];

/**
 * Build a safe patch for an existing farmer.
 *   - protected fields: only fill when existing is blank; otherwise flag conflict
 *   - fillable fields: only fill when existing is blank
 *
 * Returns { patch, conflicts: [{ field, existing, incoming }] }.
 */
export function buildSafeUpdatePayload(incoming, existing = {}) {
  const patch = {};
  const conflicts = [];

  const existingValue = (f) =>
    existing[f] ?? existing[f.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];

  const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

  for (const field of PROTECTED_FIELDS) {
    const inc = incoming[field];
    if (isBlank(inc)) continue;
    const cur = existingValue(field);
    if (isBlank(cur)) {
      patch[field] = inc; // safe fill
    } else if (String(cur).trim() !== String(inc).trim()) {
      conflicts.push({ field, existing: cur, incoming: inc });
      // DO NOT add to patch — spec §5 forbids silent overwrite
    }
  }

  for (const field of FILLABLE_FIELDS) {
    const inc = incoming[field];
    if (isBlank(inc)) continue;
    const cur = existingValue(field);
    if (isBlank(cur)) patch[field] = inc;
  }

  return { patch, conflicts };
}

// ─── Fuzzy name+region scoring (spec §1) ───────────────────

/**
 * Normalised token set for a string. Used for fuzzy comparison that
 * tolerates casing, whitespace, and simple re-ordering.
 */
function tokens(str) {
  return new Set(
    String(str || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Score two records on full_name + region_or_state. Returns 0..1.
 * ≥ 0.75 is a confident candidate (flag, do not auto-merge).
 */
export function fuzzyNameRegionScore(a, b) {
  if (!a || !b) return 0;
  const nameA = tokens(a.full_name || a.fullName || '');
  const nameB = tokens(b.full_name || b.fullName || '');
  const regA = tokens(a.region_or_state || a.region || '');
  const regB = tokens(b.region_or_state || b.region || '');
  const nameScore = jaccard(nameA, nameB);
  const regScore = jaccard(regA, regB);
  // Name dominates, region acts as a consistency gate.
  return nameScore * 0.7 + regScore * 0.3;
}

export const FUZZY_MATCH_THRESHOLD = 0.75;

// ─── Safe fallback task (spec §4) ──────────────────────────

/**
 * A deterministic fallback task surface. Rendered when the decision
 * engine cannot produce a valid task (crop missing, stage unknown,
 * catastrophic data issue). Never empty, never wrong.
 */
export function fallbackTaskViewModel({ t }) {
  if (typeof t !== 'function') {
    // Still return structure; consumer can t() the keys later.
    return {
      id: 'fallback_tell_us_about_farm',
      type: 'fallback_setup',
      titleKey: 'fallback.tellUs.title',
      whyKey: 'fallback.tellUs.why',
      ctaKey: 'fallback.tellUs.cta',
      deeplinkTarget: '/profile/setup',
      isFallback: true,
    };
  }
  return {
    id: 'fallback_tell_us_about_farm',
    type: 'fallback_setup',
    title: t('fallback.tellUs.title'),
    descriptionShort: t('fallback.tellUs.why'),
    ctaLabel: t('fallback.tellUs.cta'),
    deeplinkTarget: '/profile/setup',
    isFallback: true,
    whyText: t('fallback.tellUs.why'),
    urgency: 'optional',
  };
}

// ─── Smart crop suggestion (spec §7) ───────────────────────

/**
 * Very small, explainable region → default crop map. When the partner
 * didn't send a crop we pick the launch-standard crop for that region
 * and mark the record `needs_confirmation` so the farmer can confirm
 * or replace it on first open. Never silently commit an uncertain crop.
 */
const REGION_DEFAULT_CROP = {
  tropical_manual: 'MAIZE',
  tropical_mixed: 'MAIZE',
  monsoon_mixed: 'RICE',
  dry_irrigated: 'ONION',
  temperate_mechanized: 'MAIZE',
  default: null,
};

export function suggestCropForRegion(regionId) {
  if (!regionId) return null;
  return REGION_DEFAULT_CROP[regionId] || null;
}

/**
 * Given a payload, decide the crop to store alongside a
 * `crop_needs_confirmation` flag. Pure.
 */
export function resolveCropForImport({ incomingCrop, regionId }) {
  if (incomingCrop) {
    // Partner-provided crop is used as-is; other layers (validate) already
    // warned if the crop code wasn't recognised.
    return { crop: incomingCrop, needsConfirmation: false, source: 'partner' };
  }
  const suggested = suggestCropForRegion(regionId);
  if (suggested) {
    return { crop: suggested, needsConfirmation: true, source: 'region_default' };
  }
  return { crop: null, needsConfirmation: false, source: 'none' };
}

// ─── Dev assertions (spec §15) ─────────────────────────────

function isDev() {
  try { if (typeof import.meta !== 'undefined') return !!import.meta.env?.DEV; } catch { /* ignore */ }
  return typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
}

export function assertNoSilentMerge(conflicts) {
  if (isDev() && conflicts?.length > 0) {
    console.warn('[import] suppressed', conflicts.length, 'field conflict(s) — operator must resolve', conflicts);
  }
}

export function assertFarmerStateValid(state) {
  if (!isDev() || !state) return;
  if (!Object.values(FARMER_STATE).includes(state)) {
    console.warn('[import] invalid farmer state:', state);
  }
}

export function assertTaskNotEmpty(vm) {
  if (!isDev()) return;
  if (!vm || (!vm.title && !vm.titleKey)) {
    console.warn('[import] task view model is empty — caller should show the fallback task');
  }
}
