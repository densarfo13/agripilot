/**
 * OfflineSyncGuardian.ts — sprint #215 §8.
 *
 * Idempotency for offline → online sync: prevents duplicate uploads,
 * conflicting updates, and double scans when a queued action replays.
 * Each action gets a stable idempotency key derived from its content;
 * a key seen before is rejected.
 *
 * Guarded localStorage. SSR-safe. Never throws. Pins
 * window.__offlineSyncHealth().
 */

export const OFFLINE_SYNC_GUARDIAN_VERSION = 'offline-sync-guardian-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');

const STORE_KEY = 'farroway:syncedIdempotencyKeys';
const MAX_KEYS = 500;

function _hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** Stable idempotency key for an action (type + entity + day + content). */
export function makeIdempotencyKey(input: {
  type?: string; entityId?: string; at?: string; content?: unknown;
}): string {
  return _safe(() => {
    const body = [
      _str(input.type),
      _str(input.entityId),
      _str(input.at).slice(0, 10),
      _hash(JSON.stringify(input.content == null ? '' : input.content)),
    ].join('|');
    return _hash(body);
  }, '');
}

function _seen(): string[] {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  }, []);
}

/** True if this key has already been synced (a duplicate). */
export function isDuplicateSync(key: string): boolean {
  return _safe(() => _seen().includes(_str(key)), false);
}

/** Record a key as synced. Returns false if it was already present. */
export function markSynced(key: string): boolean {
  return _safe(() => {
    const k = _str(key);
    if (!k) return false;
    const keys = _seen();
    if (keys.includes(k)) return false;
    keys.push(k);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORE_KEY, JSON.stringify(keys.slice(-MAX_KEYS)));
    }
    return true;
  }, false);
}

export function buildOfflineSyncHealth(): Readonly<{
  ok: boolean; runtimeVersion: string;
  offlineSyncGuardianReady: true; idempotencyEnabled: true; trackedKeys: number;
}> {
  return Object.freeze({
    ok: true, runtimeVersion: OFFLINE_SYNC_GUARDIAN_VERSION,
    offlineSyncGuardianReady: true as const,
    idempotencyEnabled: true as const,
    trackedKeys: _safe(() => _seen().length, 0),
  });
}

let _installed = false;
export function installOfflineSyncHealthGlobal(): void {
  if (_installed) return;
  if (_safe(() => typeof window === 'undefined', true)) return;
  _safe(() => {
    Object.defineProperty(window as any, '__offlineSyncHealth', {
      configurable: true, enumerable: false, writable: false,
      value: () => buildOfflineSyncHealth(),
    });
    _installed = true;
  }, undefined);
}

export const _internal = Object.freeze({
  makeIdempotencyKey, isDuplicateSync, markSynced,
  buildOfflineSyncHealth, installOfflineSyncHealthGlobal,
});
export default makeIdempotencyKey;
