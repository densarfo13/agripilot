/**
 * src/runtime/plants/media/PlantMediaRegistry.ts — Verified
 * Plant Media System · Registry tier.
 *
 *   import {
 *     registerPlantMedia, getPlantMedia,
 *     listPlantMedia, listMediaByType,
 *     listMediaByPlant, PLANT_MEDIA_TYPES,
 *     PLANT_MEDIA_REGISTRY_VERSION,
 *   } from 'src/runtime/plants/media/PlantMediaRegistry';
 *
 * What this is
 * ────────────
 *   Source of truth for verified plant photography. Holds the
 *   `PlantMedia` records the rest of the runtime queries. Records
 *   are appended (libraries seed at module-import), and verified
 *   user uploads are appended via the Verification engine.
 *
 *   The registry is module-state — engines and UI hold references
 *   to the registry, never persist into it from outside the
 *   wave-5 single-writer flow. Bridge function
 *   `bridgeToImageRegistry()` mirrors verified entries into the
 *   older PlantImageRegistry so the existing 4-tier resolver
 *   keeps working without UI changes.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch. No localStorage writes. No PII.
 *   • Composition-only — does not modify the older registry
 *     beyond calling the public registerVerifiedImage(...) API.
 */

import {
  registerVerifiedImage,
} from '../images/PlantImageRegistry';

export const PLANT_MEDIA_REGISTRY_VERSION = 'plant-media-registry-v1';

/** Spec-defined media types. The CI gate verifies all 10 are present. */
export const PLANT_MEDIA_TYPES = Object.freeze([
  'plant',
  'flower',
  'fruit',
  'vegetable',
  'herb',
  'houseplant',
  'crop',
  'tree',
  'disease',
  'pest',
] as const);

export type PlantMediaType = (typeof PLANT_MEDIA_TYPES)[number];

export interface PlantMedia {
  id:             string;
  plantId:        string;
  type:           PlantMediaType;
  imageUrl:       string;
  thumbnailUrl:   string;
  verified:       boolean;
  source:         string;       // 'farroway-curated' | 'user-verified' | …
  attribution?:   string;
  regionTags?:    ReadonlyArray<string>;
  lifecycleStage?: string;      // e.g. 'flowering', 'fruiting'
  createdAt:      string;
}

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _now = () => _safe(() => new Date().toISOString(), '');

const _validTypes = new Set<string>(PLANT_MEDIA_TYPES as readonly string[]);

/**
 * Internal store keyed by media id. Append-only at runtime — the
 * verification engine writes new entries; nothing mutates existing
 * ones.
 */
const _byId:       Record<string, PlantMedia> = Object.create(null);
const _byPlant:    Record<string, string[]>   = Object.create(null);
const _byType:     Record<string, string[]>   = Object.create(null);

function _index(media: PlantMedia) {
  _byId[media.id] = media;
  (_byPlant[media.plantId] = _byPlant[media.plantId] || []).push(media.id);
  (_byType[media.type]    = _byType[media.type]    || []).push(media.id);
}

/**
 * Append a single media entry. Returns the frozen record on
 * success, or null on validation failure. Idempotent on `id`.
 */
export function registerPlantMedia(entry: Partial<PlantMedia>) {
  return _safe(() => {
    if (!_isObj(entry)) return null;
    const plantId = _str(entry.plantId);
    const type    = _str(entry.type);
    const url     = _str(entry.imageUrl);
    if (!plantId || !url || !_validTypes.has(type)) return null;
    const id = _str(entry.id) || ('media_' + type + '_' + plantId);
    if (_byId[id]) return _byId[id]; // idempotent
    const media: PlantMedia = Object.freeze({
      id,
      plantId,
      type: type as PlantMediaType,
      imageUrl:      url,
      thumbnailUrl:  _str(entry.thumbnailUrl) || url,
      verified:      entry.verified !== false,
      source:        _str(entry.source) || 'farroway-curated',
      attribution:   _str(entry.attribution),
      regionTags:    Object.freeze(_arr(entry.regionTags).map(_str)
                       .filter((t: string) => t.length > 0)),
      lifecycleStage: _str(entry.lifecycleStage),
      createdAt:     _str(entry.createdAt) || _now(),
    });
    _index(media);
    return media;
  }, null);
}

/** Bulk register helper used by the library seeders. */
export function registerPlantMediaBulk(entries: Array<Partial<PlantMedia>>) {
  return _safe(() => {
    const out: PlantMedia[] = [];
    for (const e of _arr(entries)) {
      const m = registerPlantMedia(e);
      if (m) out.push(m);
    }
    return Object.freeze(out);
  }, Object.freeze([] as PlantMedia[]));
}

export function getPlantMedia(id: string): PlantMedia | null {
  return _safe(() => _byId[_str(id)] || null, null);
}

export function listPlantMedia(): ReadonlyArray<PlantMedia> {
  return _safe(() => Object.freeze(Object.values(_byId)),
    Object.freeze([] as PlantMedia[]));
}

export function listMediaByType(type: string): ReadonlyArray<PlantMedia> {
  return _safe(() => {
    const ids = _byType[_str(type)] || [];
    return Object.freeze(ids.map((id) => _byId[id]).filter(Boolean));
  }, Object.freeze([] as PlantMedia[]));
}

export function listMediaByPlant(plantId: string): ReadonlyArray<PlantMedia> {
  return _safe(() => {
    const ids = _byPlant[_str(plantId)] || [];
    return Object.freeze(ids.map((id) => _byId[id]).filter(Boolean));
  }, Object.freeze([] as PlantMedia[]));
}

/**
 * Mirror every verified `plant`-typed media entry into the older
 * PlantImageRegistry so the 4-tier resolver in <PlantImage>
 * surfaces them as VERIFIED automatically. Disease + pest entries
 * are NOT mirrored — they belong on diagnostic surfaces, not the
 * default hero image. Returns the count mirrored.
 */
export function bridgeToImageRegistry(): number {
  return _safe(() => {
    let count = 0;
    const seen = new Set<string>();
    for (const m of listPlantMedia()) {
      if (!m.verified) continue;
      if (m.type === 'disease' || m.type === 'pest') continue;
      if (seen.has(m.plantId)) continue;
      seen.add(m.plantId);
      const gallery = listMediaByPlant(m.plantId)
        .filter((x) => x.id !== m.id)
        .map((x) => x.imageUrl);
      const out = registerVerifiedImage(m.plantId, {
        imageUrl:      m.imageUrl,
        thumbnailUrl:  m.thumbnailUrl,
        galleryImages: gallery,
      });
      if (out) count++;
    }
    return count;
  }, 0);
}

/**
 * Diagnostic summary — used by __plantMediaHealth and the CI
 * verifier. Returns counts per type + total verified.
 */
export function plantMediaSummary() {
  return _safe(() => {
    const counts: Record<string, number> = {};
    let verified = 0;
    for (const t of PLANT_MEDIA_TYPES) counts[t] = 0;
    for (const m of listPlantMedia()) {
      counts[m.type] = (counts[m.type] || 0) + 1;
      if (m.verified) verified++;
    }
    return Object.freeze({
      runtimeVersion: PLANT_MEDIA_REGISTRY_VERSION,
      counts:         Object.freeze(counts),
      verified,
      total:          listPlantMedia().length,
    });
  }, Object.freeze({
    runtimeVersion: PLANT_MEDIA_REGISTRY_VERSION,
    counts: Object.freeze({}), verified: 0, total: 0,
  }));
}

/** Test-only — wipe everything. */
export function _resetPlantMediaRegistry() {
  for (const k of Object.keys(_byId))    delete _byId[k];
  for (const k of Object.keys(_byPlant)) delete _byPlant[k];
  for (const k of Object.keys(_byType))  delete _byType[k];
}
