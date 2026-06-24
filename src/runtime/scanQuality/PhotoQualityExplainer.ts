/**
 * PhotoQualityExplainer.ts — sprint #214 §1/§9.
 *
 * Turns a PhotoQualityResult into the farmer-facing coach card content:
 * a "what went wrong" list + a single "do this" instruction, all as
 * i18n keys. Never names a provider, never blames the farmer.
 *
 * Pure. Never throws.
 */

import { COACHING_KEYS } from './PhotoQualityContracts';
import type { PhotoQualityResult } from './PhotoQualityContracts';

export const PHOTO_QUALITY_EXPLAINER_VERSION = 'photo-quality-explainer-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

// reason token → farmer-facing i18n key for the "what went wrong" list.
const REASON_KEY: Readonly<Record<string, string>> = Object.freeze({
  blurry:          'scanQuality.reason.blurry',
  too_dark:        'scanQuality.reason.tooDark',
  plant_too_small: 'scanQuality.reason.plantTooSmall',
  out_of_focus:    'scanQuality.reason.outOfFocus',
  not_centered:    'scanQuality.reason.notCentered',
  low_resolution:  'scanQuality.reason.lowResolution',
});

export function explainPhotoQuality(q: Readonly<PhotoQualityResult> | null | undefined): Readonly<{
  titleKey: string;
  qualityScore: number | null;
  whatWentWrong: ReadonlyArray<string>;   // i18n keys
  doThisKey: string;                       // single primary instruction
  retake: boolean;
}> {
  return _safe(() => {
    const reasons = (q && Array.isArray(q.reasons)) ? q.reasons : [];
    const whatWentWrong = reasons
      .map((r) => REASON_KEY[r])
      .filter((k): k is string => !!k);
    // Primary instruction = the first coaching key, else move-closer.
    const doThisKey = (q && q.coaching && q.coaching[0]) || COACHING_KEYS.focus;
    return Object.freeze({
      titleKey: 'scanQuality.photoNeedsClearerView',
      qualityScore: (q && typeof q.qualityScore === 'number') ? q.qualityScore : null,
      whatWentWrong: Object.freeze(whatWentWrong),
      doThisKey,
      retake: !!(q && q.recommendedRetake),
    });
  }, Object.freeze({
    titleKey: 'scanQuality.photoNeedsClearerView',
    qualityScore: null,
    whatWentWrong: Object.freeze([]),
    doThisKey: COACHING_KEYS.focus,
    retake: true,
  }));
}

export const _internal = Object.freeze({ explainPhotoQuality });
export default explainPhotoQuality;
