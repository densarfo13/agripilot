/**
 * landProfile — local-first field/land profile store.
 *
 * V2 scope: one active field per farmer, but the data shape
 * (`LandProfile`) is keyed by fieldId so multi-field support can
 * land later without migration. All operations are synchronous
 * localStorage reads/writes so Home never blocks on it.
 *
 * LandProfile shape (spec §1):
 *   {
 *     fieldId, farmerId, name?,
 *     countryCode, regionOrState?,
 *     coordinates?: { lat, lng },
 *     approximateArea?, areaUnit?: 'acre' | 'hectare',
 *     cleared?, weedsPresent?,
 *     soilMoistureState?: 'dry' | 'moist' | 'wet' | 'unknown',
 *     slope?: 'flat' | 'gentle' | 'steep' | 'unknown',
 *     drainage?: 'good' | 'poor' | 'unknown',
 *     irrigationAvailable?,
 *     lastLandCheckAt?,
 *     landPhotoUri?,
 *   }
 *
 * Stored as `{ fields: { [fieldId]: LandProfile }, activeFieldId }`.
 */

const KEY = 'farroway:land_profiles';

// ─── Enums ────────────────────────────────────────────────

export const SOIL_MOISTURE = Object.freeze({
  DRY: 'dry',
  MOIST: 'moist',
  WET: 'wet',
  UNKNOWN: 'unknown',
});

export const SLOPE = Object.freeze({
  FLAT: 'flat',
  GENTLE: 'gentle',
  STEEP: 'steep',
  UNKNOWN: 'unknown',
});

export const DRAINAGE = Object.freeze({
  GOOD: 'good',
  POOR: 'poor',
  UNKNOWN: 'unknown',
});

export const AREA_UNIT = Object.freeze({
  ACRE: 'acre',
  HECTARE: 'hectare',
});

// ─── Storage ──────────────────────────────────────────────

function safeRead() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { fields: {}, activeFieldId: null };
    const parsed = JSON.parse(raw);
    return {
      fields: (parsed && parsed.fields && typeof parsed.fields === 'object') ? parsed.fields : {},
      activeFieldId: parsed?.activeFieldId || null,
    };
  } catch { return { fields: {}, activeFieldId: null }; }
}

function safeWrite(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { /* quota — drop silently */ }
}

function makeFieldId() {
  return `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Public API ───────────────────────────────────────────

/** Active field (most recently saved). Returns null if none exists. */
export function getActiveFieldProfile() {
  const s = safeRead();
  if (!s.activeFieldId) return null;
  return s.fields[s.activeFieldId] || null;
}

/** All fields on this device, active first. */
export function listFieldProfiles() {
  const s = safeRead();
  const list = Object.values(s.fields);
  const active = list.find(f => f.fieldId === s.activeFieldId);
  if (!active) return list;
  return [active, ...list.filter(f => f.fieldId !== s.activeFieldId)];
}

/** Look up a specific field. */
export function getFieldProfile(fieldId) {
  if (!fieldId) return null;
  return safeRead().fields[fieldId] || null;
}

/**
 * Create or update a field. If `fieldId` is omitted, a new field is
 * created and becomes the active one. Returns the saved profile.
 */
export function saveFieldProfile(patch = {}) {
  const s = safeRead();
  const id = patch.fieldId || s.activeFieldId || makeFieldId();
  const existing = s.fields[id] || { fieldId: id };
  const merged = {
    ...existing,
    ...patch,
    fieldId: id,
    lastLandCheckAt: patch.lastLandCheckAt || existing.lastLandCheckAt || Date.now(),
  };
  s.fields[id] = merged;
  if (!s.activeFieldId) s.activeFieldId = id;
  safeWrite(s);
  return merged;
}

/** Set an existing field as active. */
export function setActiveField(fieldId) {
  const s = safeRead();
  if (!s.fields[fieldId]) return null;
  s.activeFieldId = fieldId;
  safeWrite(s);
  return s.fields[fieldId];
}

/** Remove a field and clear activeFieldId if it pointed there. */
export function removeFieldProfile(fieldId) {
  const s = safeRead();
  if (!s.fields[fieldId]) return false;
  delete s.fields[fieldId];
  if (s.activeFieldId === fieldId) {
    const remaining = Object.keys(s.fields);
    s.activeFieldId = remaining[0] || null;
  }
  safeWrite(s);
  return true;
}

export function clearLandProfiles() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

// ─── Guided-check draft (spec §3 — save progress if interrupted) ──
const DRAFT_KEY = 'farroway:land_check_draft';
const DRAFT_TTL_MS = 60 * 60 * 1000;

export function saveLandCheckDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, ts: Date.now() }));
  } catch { /* quota */ }
}

export function loadLandCheckDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { draft, ts } = JSON.parse(raw) || {};
    if (!draft || !ts || Date.now() - ts > DRAFT_TTL_MS) return null;
    return draft;
  } catch { return null; }
}

export function clearLandCheckDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

export const _internal = { makeFieldId, KEY, DRAFT_KEY };
