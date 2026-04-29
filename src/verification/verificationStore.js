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
import { putPhoto, getPhoto, deletePhoto } from './verificationDB.js';

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
 * computes the level. Returns a Promise resolving with the
 * stored row. Never throws.
 *
 * Photo handling:
 *   * `photoBlob` (Blob/File) — PREFERRED. Persisted in
 *     IndexedDB at full resolution; the record stores an
 *     `idb:<id>` sentinel in `photoUrl`. No size cap.
 *   * `photoUrl` (data URL) — fallback for private-mode
 *     browsers without IDB. Capped at 200 KB; over-cap
 *     URLs are dropped (record still saves at a lower
 *     level).
 *
 * Callers should pass `photoBlob` when they have the raw
 * File from a `<input type="file">`; the store handles
 * conversion to data URL automatically when IDB is offline.
 */
export async function saveVerification(record) {
  const safe = record && typeof record === 'object' ? record : {};
  const now  = _now();
  const id   = safe.id || _uid();

  // Photo path — try IDB first when a Blob is supplied.
  let photoUrl = null;
  if (safe.photoBlob && safe.photoBlob instanceof Blob) {
    try {
      const sentinel = await putPhoto(id, safe.photoBlob);
      if (sentinel) {
        photoUrl = sentinel;       // 'idb:<id>' — full-res
      } else if (typeof FileReader !== 'undefined'
                 && safe.photoBlob.size <= PHOTO_MAX_BYTES) {
        // IDB unavailable; degrade to a data URL ONLY if
        // the original blob is under the localStorage cap.
        photoUrl = await new Promise((resolve) => {
          try {
            const fr = new FileReader();
            fr.onload  = () => resolve(String(fr.result || ''));
            fr.onerror = () => resolve(null);
            fr.readAsDataURL(safe.photoBlob);
          } catch { resolve(null); }
        });
      }
    } catch { /* swallow → photoUrl stays null */ }
  } else if (safe.photoUrl) {
    // Caller already produced a data URL — accept only if
    // it fits the localStorage cap. Otherwise drop the
    // photo and keep the record at a lower level.
    photoUrl = _photoBytes(safe.photoUrl) <= PHOTO_MAX_BYTES
      ? safe.photoUrl : null;
  }

  const stored = {
    id,
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
    verificationLevel: 0,
  };
  stored.verificationLevel = computeVerificationLevel(stored);

  const rows = _read();
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
      photoStore:     stored.photoUrl
                       ? (String(stored.photoUrl).startsWith('idb:') ? 'idb' : 'data')
                       : 'none',
      hasLocation:    Boolean(stored.location.lat),
    });
  } catch { /* analytics never blocks */ }

  return stored;
}

/**
 * resolveVerificationPhoto(record) — returns a Blob (from
 * IDB) or a data URL (from the record itself). Used by any
 * future viewer surface; today nothing reads it but the
 * wiring is here so a photo viewer can land without
 * touching this module again.
 */
export async function resolveVerificationPhoto(record) {
  if (!record || !record.photoUrl) return null;
  const u = String(record.photoUrl);
  if (u.startsWith('idb:')) {
    try { return await getPhoto(u); }
    catch { return null; }
  }
  // Data URL or http(s) URL — return as-is.
  return u;
}

/**
 * bumpVerificationWithLocation(actionId, farmerId) —
 * upgrades the latest verification record for an action
 * by attaching a fresh GPS read. Used by the opt-in
 * "Add location" affordance on the task-complete surface
 * so a farmer who didn't grant location at the start of
 * the day can still witness a higher level after they
 * tap the action card.
 *
 * Idempotent — re-runs are safe; the existing record's
 * timestamp is preserved.
 */
export async function bumpVerificationWithLocation(actionId, farmerId) {
  if (!actionId) return null;
  // Find the most recent matching record. If none exists,
  // create a new one — the helper is robust to missing
  // history.
  const all = _read();
  const match = all
    .filter((r) => r && r.actionId === String(actionId)
                && (!farmerId || String(r.farmerId || '') === String(farmerId)))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    [0] || null;

  // Best-effort GPS — the helper resolves null on denial
  // / timeout / no API. Never throws.
  // eslint-disable-next-line global-require
  const gps = await tryReadGeolocation(4000);
  if (!gps) {
    // Caller can decide whether to surface a hint; we just
    // return the record unchanged.
    return match;
  }

  return saveVerification({
    id:         match ? match.id : undefined,
    farmerId:   farmerId || (match && match.farmerId) || null,
    actionType: (match && match.actionType) || 'UNKNOWN',
    actionId:   String(actionId),
    photoUrl:   match ? match.photoUrl : null,
    timestamp:  match ? match.timestamp : _now(),
    createdAt:  match ? match.createdAt : _now(),
    location:   {
      lat: gps.lat, lng: gps.lng,
      region:  match ? (match.location?.region  || '') : '',
      country: match ? (match.location?.country || '') : '',
    },
  });
}

/**
 * removeVerification(id) — clears both the row and any
 * IDB-backed photo. Best-effort; never throws.
 */
export async function removeVerification(id) {
  if (!id) return false;
  try { await deletePhoto(id); } catch { /* ignore */ }
  const rows = _read();
  const next = rows.filter((r) => r && r.id !== id);
  _write(next);
  return true;
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
