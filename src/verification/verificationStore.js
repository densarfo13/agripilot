/**
 * verificationStore.js — local-first store for
 * VerificationRecord rows.
 *
 * Storage key: farroway_verifications
 *
 * What this is for
 * ────────────────
 *   Verification is a BEST-EFFORT signal attached to a
 *   farmer action (task completion, listing, funding
 *   request). It carries whatever the device can witness
 *   automatically — timestamp, last-known location, an
 *   optional photo — and exposes a 0..3 quality level so
 *   admin/NGO surfaces can highlight high-trust records.
 *
 *   PER SPEC: never block the farmer if no verification is
 *   available. Every action keeps working with a level-0
 *   record (or no record at all).
 *
 * VerificationRecord shape
 *   {
 *     id, farmerId, actionType, actionId,
 *     photoUrl,                    // data: URL OR null
 *     timestamp,                   // ISO
 *     location: { lat, lng, region, country },
 *     verificationLevel,           // 0..3 (computed)
 *     createdAt,                   // ISO
 *   }
 *
 * Strict-rule audit (per spec § 9 + § 10)
 *   * Never throws — every storage call is try/catch wrapped
 *     and reads use safeParse.
 *   * Photo size cap: data URLs over 200 KB are dropped
 *     (the record is still saved without the photo). This
 *     keeps the 5 MB localStorage quota safe in long
 *     pilots; real photo persistence belongs in
 *     IndexedDB / S3 once a backend exists.
 *   * Idempotent on `id` so a retry doesn't write twice.
 *   * Emits VERIFICATION_CREATED via safeTrackEvent on
 *     every successful save.
 */

import { safeParse } from '../utils/safeParse.js';
import { safeTrackEvent } from '../lib/analytics.js';

export const STORAGE_KEY = 'farroway_verifications';
export const PHOTO_MAX_BYTES = 200 * 1024;   // 200 KB
const MAX_ROWS = 500;

export const VERIFICATION_EVENTS = Object.freeze({
  CREATED: 'VERIFICATION_CREATED',
});

export const ACTION_TYPES = Object.freeze({
  TASK_COMPLETE:     'TASK_COMPLETE',
  LISTING_CREATED:   'LISTING_CREATED',
  FUNDING_REQUEST:   'FUNDING_REQUEST',
  PROGRESS_UPDATE:   'PROGRESS_UPDATE',
});

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
    // QuotaExceededError most likely — drop oldest 50 rows
    // and retry once. If that still fails, no-op.
    try {
      const trimmed = (Array.isArray(rows) ? rows : []).slice(-50);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return true;
    } catch {
      return false;
    }
  }
}

function _now() {
  try { return new Date().toISOString(); } catch { return ''; }
}

function _uid() {
  try {
    return `vrf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  } catch {
    return `vrf_${Date.now()}`;
  }
}

function _isFiniteCoord(v) {
  return v !== null && v !== undefined && Number.isFinite(Number(v));
}

function _photoBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  // Rough byte estimate from the base64 payload length.
  const i = dataUrl.indexOf('base64,');
  const b64 = i >= 0 ? dataUrl.slice(i + 7) : dataUrl;
  return Math.floor(b64.length * 0.75);
}

// ─── Helper: computeVerificationLevel ────────────────────

/**
 * Per spec § 3:
 *   photo + location + timestamp → 3
 *   location + timestamp         → 2
 *   timestamp only               → 1
 *   none                         → 0
 *
 * "Location" here means a finite (lat, lng) pair. A
 * region-only string (no GPS) does NOT count toward the
 * level — region is metadata, not a witnessable fact.
 */
export function computeVerificationLevel(record) {
  if (!record || typeof record !== 'object') return 0;
  const hasTs = Boolean(record.timestamp);
  const loc   = record.location || {};
  const hasLoc = _isFiniteCoord(loc.lat) && _isFiniteCoord(loc.lng);
  const hasPhoto = Boolean(record.photoUrl);
  if (hasPhoto && hasLoc && hasTs) return 3;
  if (hasLoc && hasTs)              return 2;
  if (hasTs)                        return 1;
  return 0;
}

// ─── Reads ────────────────────────────────────────────────

export function getVerifications() {
  const rows = _read();
  return rows
    .filter((r) => r && typeof r === 'object' && r.id)
    .sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function getVerificationsByFarmer(farmerId) {
  if (!farmerId) return [];
  return getVerifications().filter(
    (r) => String(r.farmerId || '') === String(farmerId),
  );
}

export function getVerificationsByAction(actionId) {
  if (!actionId) return [];
  return getVerifications().filter(
    (r) => String(r.actionId || '') === String(actionId),
  );
}

/**
 * Best-effort lookup of the highest verification level for
 * a given action. Used by NGO panels that show a Verified-
 * only filter.
 */
export function getMaxLevelForAction(actionId) {
  const list = getVerificationsByAction(actionId);
  if (!list.length) return 0;
  let max = 0;
  for (const r of list) {
    const l = Number(r.verificationLevel) || 0;
    if (l > max) max = l;
  }
  return max;
}

// ─── Writes ───────────────────────────────────────────────

/**
 * saveVerification(record) — writes the record locally and
 * computes the level. Returns the stored row. Never throws.
 *
 * Drops photo when it exceeds PHOTO_MAX_BYTES so the
 * localStorage quota stays safe — the record is still
 * saved, just at a lower level. The caller (UI) is
 * responsible for providing a small enough payload (resize
 * client-side before passing in).
 */
export function saveVerification(record) {
  const safe = record && typeof record === 'object' ? record : {};
  const now  = _now();

  let photoUrl = safe.photoUrl || null;
  if (photoUrl && _photoBytes(photoUrl) > PHOTO_MAX_BYTES) {
    photoUrl = null;
  }

  const stored = {
    id:         safe.id || _uid(),
    farmerId:   safe.farmerId || null,
    actionType: String(safe.actionType || 'UNKNOWN'),
    actionId:   safe.actionId ? String(safe.actionId) : null,
    photoUrl,
    timestamp:  safe.timestamp || now,
    location: {
      lat:     _isFiniteCoord(safe.location?.lat) ? Number(safe.location.lat) : null,
      lng:     _isFiniteCoord(safe.location?.lng) ? Number(safe.location.lng) : null,
      region:  String(safe.location?.region  || '').trim(),
      country: String(safe.location?.country || '').trim(),
    },
    createdAt:  safe.createdAt || now,
    // computed below
    verificationLevel: 0,
  };
  stored.verificationLevel = computeVerificationLevel(stored);

  const rows = _read();
  // Idempotent on id.
  const idx = rows.findIndex((r) => r && r.id === stored.id);
  if (idx >= 0) rows[idx] = stored;
  else          rows.push(stored);
  _write(rows);

  try {
    safeTrackEvent(VERIFICATION_EVENTS.CREATED, {
      verificationId: stored.id,
      actionType:     stored.actionType,
      level:          stored.verificationLevel,
      hasPhoto:       Boolean(stored.photoUrl),
      hasLocation:    Boolean(stored.location.lat),
    });
  } catch { /* analytics never blocks */ }

  return stored;
}

// ─── Helpers for upstream pages ───────────────────────────

/**
 * Best-effort GPS read. Resolves quickly — never blocks.
 * Falls through to `null` on permission denied / timeout /
 * absent geolocation API. Pages call this in fire-and-forget
 * mode at action time so a slow GPS lock doesn't delay the
 * primary flow.
 */
export function tryReadGeolocation(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (val) => { if (!done) { done = true; resolve(val); } };
    setTimeout(() => finish(null), timeoutMs);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => finish({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
        () => finish(null),
        { timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
      );
    } catch {
      finish(null);
    }
  });
}

/**
 * Read an <input type="file"> File / Blob into a data URL.
 * Resolves null on any failure — caller treats null as
 * "no photo". Resolves with `{ dataUrl, bytes }` on success.
 */
export function readPhotoAsDataUrl(file) {
  return new Promise((resolve) => {
    if (!file || typeof FileReader === 'undefined') {
      resolve(null); return;
    }
    try {
      const reader = new FileReader();
      reader.onload  = () => {
        const dataUrl = String(reader.result || '');
        if (!dataUrl.startsWith('data:image/')) { resolve(null); return; }
        resolve({ dataUrl, bytes: _photoBytes(dataUrl) });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } catch {
      resolve(null);
    }
  });
}
