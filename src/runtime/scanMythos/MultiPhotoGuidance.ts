/**
 * MultiPhotoGuidance.ts — optional multi-photo flow (sprint #200,
 * spec §5). NO photo is required; when confidence is low the engine
 * suggests the single most useful next photo.
 *
 * Pure. Never throws.
 */

import { PHOTO_TYPES } from './ScanMythosContracts';
import type { PhotoType, MultiPhotoStatus } from './ScanMythosContracts';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export const MULTI_PHOTO_GUIDANCE_VERSION = 'multi-photo-guidance-v1';

// The order in which an extra photo most helps an uncertain ID.
const HELPFUL_ORDER: ReadonlyArray<PhotoType> =
  ['leaf', 'whole_plant', 'fruit', 'stem'];

const GUIDANCE_COPY: Readonly<Record<PhotoType, string>> = Object.freeze({
  leaf:        'Take a closer leaf photo.',
  whole_plant: 'Add a whole plant photo.',
  fruit:       'Add a fruit photo if visible.',
  stem:        'Add a stem photo.',
  field:       'Add a wider field photo.',
});

export function getMultiPhotoStatus(input: {
  photosUsed?: ReadonlyArray<string>;
  confidencePct?: number | null;
  objectType?: string;
} = {}): Readonly<MultiPhotoStatus> {
  return _safe(() => {
    const used = _arr(input.photosUsed)
      .filter((p): p is PhotoType => (PHOTO_TYPES as ReadonlyArray<string>).includes(p));
    const usedSet = new Set(used);
    const conf = _num(input.confidencePct);

    // Houseplants / pots etc. still benefit from leaf+whole; field
    // photo is only suggested for actual crops.
    const isIndoor = input.objectType === 'houseplant';
    const helpful = HELPFUL_ORDER.filter((p) => !usedSet.has(p));
    const missing = isIndoor ? helpful.filter((p) => p !== 'field') : helpful;

    // Improvement potential is only meaningful when confidence is low.
    let potential: 'high' | 'medium' | 'low' | 'none';
    if (conf == null || conf < 60) potential = missing.length > 0 ? 'high' : 'low';
    else if (conf < 80) potential = missing.length > 0 ? 'medium' : 'low';
    else potential = 'none';

    const guidance = (potential === 'high' || potential === 'medium')
      && missing.length > 0
      ? GUIDANCE_COPY[missing[0]]
      : null;

    return Object.freeze({
      photosUsed: Object.freeze(used),
      missingHelpfulPhotos: Object.freeze(missing),
      confidenceImprovementPotential: potential,
      guidance,
    });
  }, Object.freeze({
    photosUsed: Object.freeze([]),
    missingHelpfulPhotos: Object.freeze([]),
    confidenceImprovementPotential: 'none' as const,
    guidance: null,
  }));
}

export const _internal = Object.freeze({ getMultiPhotoStatus });
export default getMultiPhotoStatus;
