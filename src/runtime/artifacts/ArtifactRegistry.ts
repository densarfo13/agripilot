/**
 * src/runtime/artifacts/ArtifactRegistry.ts — In-memory index
 * for the Artifacts Evidence Layer.
 *
 *   import {
 *     registerArtifact, getArtifact, listArtifactsByType,
 *     listArtifactsByPlant, listArtifactsByUser,
 *     ARTIFACT_REGISTRY_VERSION,
 *   } from 'src/runtime/artifacts/ArtifactRegistry';
 *
 * What this file owns
 * ───────────────────
 *   Memory-only append-only index. Engines emit artifacts here;
 *   the offline runtime + server writer own durable persistence.
 *   The registry never writes to localStorage / IndexedDB
 *   directly — wave-5 invariant.
 *
 *   PII drop-list from artifactContracts is applied at register
 *   time so callers can pass any metadata and we strip what's
 *   forbidden.
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. Never throws.
 *   • Append-only — existing entries are not mutated.
 *   • No persistence writes. No PII retained.
 */

import {
  ARTIFACT_TYPES, ARTIFACT_PII_DROP_LIST, DEFAULT_VISIBILITY,
  ARTIFACT_SOURCES,
} from './artifactContracts';

export const ARTIFACT_REGISTRY_VERSION = 'artifact-registry-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr  = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str  = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validTypes = new Set<string>(ARTIFACT_TYPES as readonly string[]);

export interface Artifact {
  id:                string;
  type:              string;
  userId:            string;
  farmId?:           string;
  gardenId?:         string;
  plantId?:          string;
  scanId?:           string;
  taskId?:           string;
  interventionId?:   string;
  buyerInterestId?:  string;
  photoUrl?:         string;
  /** Coarse region code; never exact GPS / device coordinates. */
  location?:         string;
  timestamp:         string;
  metadata?:         Record<string, any>;
  verified:          boolean;
  source:            string;
  visibility:        string;
}

const _byId:    Record<string, Artifact> = Object.create(null);
const _byType:  Record<string, string[]> = Object.create(null);
const _byUser:  Record<string, string[]> = Object.create(null);
const _byPlant: Record<string, string[]> = Object.create(null);
const _bySeen:  Set<string>              = new Set();

function _scrubMetadata(meta: any): Record<string, any> {
  if (!_isObj(meta)) return {};
  const out: Record<string, any> = {};
  for (const k of Object.keys(meta)) {
    if (ARTIFACT_PII_DROP_LIST.indexOf(k) >= 0) continue;
    out[k] = (meta as any)[k];
  }
  return out;
}

function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _index(a: Artifact) {
  _byId[a.id] = a;
  (_byType[a.type] = _byType[a.type] || []).push(a.id);
  if (a.userId)  (_byUser[a.userId]   = _byUser[a.userId]   || []).push(a.id);
  if (a.plantId) (_byPlant[a.plantId] = _byPlant[a.plantId] || []).push(a.id);
}

/** Per-spec idempotency-key shape. */
function _dedupKey(entry: Partial<Artifact>): string {
  const seed = _str(entry.type) + '|'
    + _str(entry.userId) + '|'
    + _str(entry.scanId  || entry.plantId || entry.taskId
            || entry.interventionId || entry.buyerInterestId || '')
    + '|' + _str(entry.timestamp || '');
  return _hash(seed);
}

/**
 * Append a new artifact. Idempotent — if the dedup key already
 * matches a registered entry, returns the existing record
 * unchanged.
 */
export function registerArtifact(entry: Partial<Artifact>): Artifact | null {
  return _safe(() => {
    if (!_isObj(entry)) return null;
    const type = _str(entry.type);
    if (!_validTypes.has(type)) return null;
    const userId = _str(entry.userId);
    if (!userId) return null;
    const timestamp = _str(entry.timestamp) || _now();

    const dk = _dedupKey({ ...entry, timestamp });
    if (_bySeen.has(dk) && entry.id && _byId[_str(entry.id)]) {
      return _byId[_str(entry.id)];
    }
    if (_bySeen.has(dk)) {
      // Same logical artifact, no caller id — find existing.
      for (const a of Object.values(_byId)) {
        if (_dedupKey(a) === dk) return a;
      }
    }

    const id = _str(entry.id)
                || ('artifact_' + type + '_' + _hash(dk + '|' + timestamp));
    const artifact: Artifact = Object.freeze({
      id, type, userId, timestamp,
      farmId:           _str(entry.farmId),
      gardenId:         _str(entry.gardenId),
      plantId:          _str(entry.plantId),
      scanId:           _str(entry.scanId),
      taskId:           _str(entry.taskId),
      interventionId:   _str(entry.interventionId),
      buyerInterestId:  _str(entry.buyerInterestId),
      photoUrl:         _str(entry.photoUrl),
      location:         _str(entry.location),
      metadata:         Object.freeze(_scrubMetadata(entry.metadata)),
      verified:         entry.verified === true,
      source:           _str(entry.source) || ARTIFACT_SOURCES.USER_MANUAL,
      visibility:       _str(entry.visibility)
                          || DEFAULT_VISIBILITY[type] || 'private',
    });
    _index(artifact);
    _bySeen.add(dk);
    return artifact;
  }, null);
}

export function getArtifact(id: string): Artifact | null {
  return _safe(() => _byId[_str(id)] || null, null);
}

export function listArtifactsByType(type: string): ReadonlyArray<Artifact> {
  return _safe(() => {
    const ids = _byType[_str(type)] || [];
    return Object.freeze(ids.map((id) => _byId[id]).filter(Boolean));
  }, Object.freeze([] as Artifact[]));
}

export function listArtifactsByUser(userId: string): ReadonlyArray<Artifact> {
  return _safe(() => {
    const ids = _byUser[_str(userId)] || [];
    return Object.freeze(ids.map((id) => _byId[id]).filter(Boolean));
  }, Object.freeze([] as Artifact[]));
}

export function listArtifactsByPlant(plantId: string): ReadonlyArray<Artifact> {
  return _safe(() => {
    const ids = _byPlant[_str(plantId)] || [];
    return Object.freeze(ids.map((id) => _byId[id]).filter(Boolean));
  }, Object.freeze([] as Artifact[]));
}

export function artifactRegistrySummary() {
  return _safe(() => {
    const counts: Record<string, number> = {};
    for (const t of ARTIFACT_TYPES) counts[t] = 0;
    for (const a of Object.values(_byId)) {
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return Object.freeze({
      runtimeVersion: ARTIFACT_REGISTRY_VERSION,
      total:  Object.keys(_byId).length,
      counts: Object.freeze(counts),
    });
  }, Object.freeze({
    runtimeVersion: ARTIFACT_REGISTRY_VERSION,
    total: 0, counts: Object.freeze({}),
  }));
}

/** Test-only — wipe everything. */
export function _resetArtifactRegistry() {
  for (const k of Object.keys(_byId))    delete _byId[k];
  for (const k of Object.keys(_byType))  delete _byType[k];
  for (const k of Object.keys(_byUser))  delete _byUser[k];
  for (const k of Object.keys(_byPlant)) delete _byPlant[k];
  _bySeen.clear();
}
