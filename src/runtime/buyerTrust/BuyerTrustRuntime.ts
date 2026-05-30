/**
 * src/runtime/buyerTrust/BuyerTrustRuntime.ts — Buyer Trust
 * Signals v1. Pure read-only composition over the existing
 * scan-history + managed-plants localStorage stores. Surfaces
 * a frozen envelope a buyer-facing card can render WITHOUT
 * ever touching server routes, ratings, reviews, payments, or
 * identity verification.
 *
 *   import {
 *     getTrustSignals,
 *     buyerTrustHealth,
 *     installBuyerTrustGlobal,
 *     BUYER_TRUST_RUNTIME_VERSION,
 *   } from 'src/runtime/buyerTrust/BuyerTrustRuntime';
 *
 *   window.__buyerTrustHealth()
 *
 * Signals composed (no server, no PII)
 * ────────────────────────────────────
 *   • lastScanDate         — most recent scan timestamp from
 *                            the canonical scan history store
 *                            (farroway_scan_history_v1).
 *   • recentPlantPhoto     — most recent managed-plant photo
 *                            URL from farroway_managed_plants
 *                            (tolerates imageUrl / photoUrl /
 *                            image / photo field names).
 *   • activeGrowerBadge    — true if >=1 scan in the last
 *                            ACTIVE_GROWER_WINDOW_DAYS (14) days.
 *   • verifiedGrowerBadge  — reserved future slot; always false
 *                            in v1. verifiedBadgeReserved=true
 *                            tells the UI to paint the slot.
 *
 * Strict-rule audit
 *   • Composition over architecture — reads two existing stores,
 *     adds no engine state, no schema, no route.
 *   • Read-only — never mutates localStorage from this module.
 *     The managedPlantsStore + scanHistoryStore remain single
 *     writers of their respective keys.
 *   • SSR-safe — every localStorage access is typeof-guarded
 *     and wrapped in _safe.
 *   • Pure runtime — never throws. Public functions return a
 *     frozen fallback envelope on any error path.
 *   • Frozen envelopes — Object.freeze on every return.
 *   • No PII — growerRef is OPAQUE; never resolved to a farmer
 *     id, name, phone, email, or coords. Envelope carries only
 *     booleans + a timestamp + an opaque photo ref. No PII is
 *     written to localStorage (this module writes nothing).
 *   • Single window global — installBuyerTrustGlobal pins
 *     exactly one: window.__buyerTrustHealth.
 */

import {
  BUYER_TRUST_RUNTIME_VERSION,
  TRUST_STORAGE_KEYS,
  ACTIVE_GROWER_WINDOW_DAYS,
  type TrustSignal,
} from './buyerTrustContracts';

export { BUYER_TRUST_RUNTIME_VERSION };

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === 'object';

const _str = (v: unknown): string =>
  typeof v === 'string' ? v : '';

/** SSR-safe localStorage read. Returns null on the server or
 *  when the key is absent / unreadable. */
function _read(key: string): string | null {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  }, null);
}

/** Parse a JSON localStorage payload into an array. Always
 *  returns an array (corrupt JSON / wrong type → []). */
function _readArray(key: string): unknown[] {
  return _safe(() => {
    const raw = _read(key);
    if (!raw) return [] as unknown[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ([] as unknown[]);
  }, [] as unknown[]);
}

/** Coerce a value to a finite epoch-millis timestamp.
 *  Accepts ISO strings, numeric strings, numbers. NaN → null. */
function _toEpoch(v: unknown): number | null {
  return _safe(() => {
    if (v == null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const s = _str(v);
    if (!s) return null;
    // Numeric string?
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    }
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }, null);
}

/** Pull the most-recent scan timestamp (ISO string) from the
 *  canonical scan history store. Returns null when empty. */
function _lastScanIso(): string | null {
  return _safe(() => {
    const list = _readArray(TRUST_STORAGE_KEYS.SCAN_HISTORY);
    let bestEpoch: number | null = null;
    let bestIso:   string | null = null;
    for (const entry of list) {
      if (!_isObj(entry)) continue;
      // Canonical field is createdAt; tolerate common aliases.
      const candidate =
           (entry as any).createdAt
        ?? (entry as any).timestamp
        ?? (entry as any).scannedAt
        ?? (entry as any).date;
      const epoch = _toEpoch(candidate);
      if (epoch == null) continue;
      if (bestEpoch == null || epoch > bestEpoch) {
        bestEpoch = epoch;
        bestIso   = _safe(
          () => new Date(epoch).toISOString(),
          _str(candidate) || null,
        );
      }
    }
    return bestIso;
  }, null);
}

/** Pull a photo reference from a managed-plant record,
 *  tolerating the several historical field names. Returns null
 *  when the record carries no usable photo URL. */
function _plantPhoto(plant: Record<string, unknown>): string | null {
  return _safe(() => {
    const candidates: unknown[] = [
      plant.photoUrl,
      plant.imageUrl,
      plant.photo,
      plant.image,
      plant.thumbnail,
      plant.thumbUrl,
    ];
    for (const c of candidates) {
      const s = _str(c);
      if (s) return s;
    }
    return null;
  }, null);
}

/** Pull the most-recent managed-plant photo URL. Returns null
 *  when no managed plant carries a photo. */
function _recentPlantPhoto(): string | null {
  return _safe(() => {
    const list = _readArray(TRUST_STORAGE_KEYS.MANAGED_PLANTS);
    let bestEpoch: number | null = null;
    let bestPhoto: string | null = null;
    for (const entry of list) {
      if (!_isObj(entry)) continue;
      const photo = _plantPhoto(entry);
      if (!photo) continue;
      // Prefer the most recently updated/created plant when
      // multiple records carry photos.
      const ts =
           (entry as any).updatedAt
        ?? (entry as any).createdAt
        ?? (entry as any).addedAt;
      const epoch = _toEpoch(ts);
      if (bestEpoch == null
          || (epoch != null && epoch > bestEpoch)) {
        bestEpoch = epoch;
        bestPhoto = photo;
      }
    }
    return bestPhoto;
  }, null);
}

/** True when at least one scan exists within the rolling
 *  ACTIVE_GROWER_WINDOW_DAYS window. */
function _hasRecentScan(lastIso: string | null): boolean {
  return _safe(() => {
    if (!lastIso) return false;
    const lastEpoch = _toEpoch(lastIso);
    if (lastEpoch == null) return false;
    const now    = Date.now();
    const window = ACTIVE_GROWER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return (now - lastEpoch) <= window && (now - lastEpoch) >= 0;
  }, false);
}

/** Frozen fallback envelope — returned when the runtime fails
 *  catastrophically. Carries no PII, no timestamps, no photos.
 *  ready=false signals to the caller that the envelope is the
 *  fallback shape rather than a real read. */
function _fallback(): TrustSignal {
  return Object.freeze({
    runtimeVersion:        BUYER_TRUST_RUNTIME_VERSION,
    ready:                 false,
    lastScanDate:          null,
    recentPlantPhoto:      null,
    activeGrowerBadge:     false,
    verifiedGrowerBadge:   false,
    verifiedBadgeReserved: true,
  });
}

/**
 * getTrustSignals — composition entry point for buyer-facing
 * trust badges. The growerRef parameter is OPAQUE; this runtime
 * NEVER resolves it to a real farmer id, never logs it, never
 * persists it. It is accepted purely so future versions can
 * branch per-grower without an API surface change.
 *
 * Returns a frozen TrustSignal envelope. Pure. Never throws.
 * SSR-safe (every storage access is typeof-guarded).
 */
export function getTrustSignals(
  _growerRef?: unknown,
): TrustSignal {
  return _safe(() => {
    const lastScanDate     = _lastScanIso();
    const recentPlantPhoto = _recentPlantPhoto();
    const activeGrower     = _hasRecentScan(lastScanDate);
    return Object.freeze({
      runtimeVersion:        BUYER_TRUST_RUNTIME_VERSION,
      ready:                 true,
      lastScanDate,
      recentPlantPhoto,
      activeGrowerBadge:     activeGrower,
      // v1: verified flow is not wired. Reserved for a later
      // wave that may add a non-PII verification claim. Slot
      // is surfaced so the UI can paint a greyed badge today
      // and "light it up" later without a contract change.
      verifiedGrowerBadge:   false,
      verifiedBadgeReserved: true,
    });
  }, _fallback());
}

/**
 * buyerTrustHealth — diagnostic envelope for the launch-lock
 * dashboard and ad-hoc DevTools probes. Mirrors the shape of
 * peer runtimes (onboardingGuardHealth, etc). Pure, frozen,
 * SSR-safe, never throws.
 */
export function buyerTrustHealth() {
  return _safe(() => {
    const sig = getTrustSignals();
    return Object.freeze({
      runtimeVersion:         BUYER_TRUST_RUNTIME_VERSION,
      buyerTrustReady:        true,
      hasLastScan:            !!sig.lastScanDate,
      hasRecentPhoto:         !!sig.recentPlantPhoto,
      activeGrowerBadgeShown: !!sig.activeGrowerBadge,
      verifiedBadgeReserved:  true,
    });
  }, Object.freeze({
    runtimeVersion:         BUYER_TRUST_RUNTIME_VERSION,
    buyerTrustReady:        false,
    hasLastScan:            false,
    hasRecentPhoto:         false,
    activeGrowerBadgeShown: false,
    verifiedBadgeReserved:  true,
  }));
}

/**
 * installBuyerTrustGlobal — pins exactly ONE window global:
 * window.__buyerTrustHealth. Idempotent — re-running on hot
 * reload is a no-op once the function is already pinned.
 *
 * Returns true on success, false on SSR or installation
 * failure. Never throws.
 */
export function installBuyerTrustGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__buyerTrustHealth !== 'function') {
      w.__buyerTrustHealth = function () {
        const out = buyerTrustHealth();
        try { console.log('[Farroway · Buyer Trust]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
