/**
 * LocalCropMatcherEngine.ts — pins window.__cropMatcherHealth.
 *
 * HONEST IMPLEMENTATION: this engine performs ZERO visual analysis.
 * It surfaces the farmer's OWN farm-profile crop as a low-confidence
 * candidate so MultiPassIdentificationRuntime has at least one entry
 * to merge instead of returning NEEDS_CONFIGURATION.
 *
 * Rationale:
 *   When a farmer set crop = 'onion' on their farm, and they then
 *   scan something on that farm, it's overwhelmingly likely they're
 *   scanning the same crop. Returning it as a 40% candidate is
 *   honest decision support — NOT a vision claim.
 *
 * Confidence is HARD-CAPPED at 40 (FARM_PROFILE_CAP) so this engine
 * NEVER outranks a real vision-verified candidate when one exists.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const LOCAL_CROP_MATCHER_VERSION = 'local-crop-matcher-v1' as const;
export const FARM_PROFILE_CAP = 40;

interface LocalCandidate {
  key: string;
  label: string;
  confidencePct: number;
  source: 'farm-profile';
}

export interface CropMatcherHealthEnvelope {
  initialized: true;
  configured: boolean;
  hasCrop: boolean;
  candidates: ReadonlyArray<LocalCandidate>;
  source: 'farm-profile' | 'none';
  noVisionClaim: true;
  capAtFortyPct: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

function _readCommandCenterCrop(): { key: string; label: string } | null {
  return _safe(() => {
    const cc = _probe('__commandCenterHealth');
    if (!cc) return null;
    const v: any = (cc as any).value || cc;
    const state = v && v.state;
    if (!state) return null;
    const cropKey = (typeof state.crop === 'string' && state.crop.trim())
      ? state.crop.trim().toLowerCase() : null;
    if (!cropKey) return null;
    // Build label: capitalize first letter, replace underscores with spaces.
    const label = cropKey.charAt(0).toUpperCase()
      + cropKey.slice(1).replace(/_/g, ' ');
    return { key: cropKey, label };
  }, null);
}

export function cropMatcherHealth(): Readonly<CropMatcherHealthEnvelope> {
  return _safe(() => {
    const crop = _readCommandCenterCrop();
    const hasCrop = !!crop;
    const candidates: LocalCandidate[] = crop ? [{
      key: crop.key,
      label: crop.label,
      confidencePct: FARM_PROFILE_CAP,
      source: 'farm-profile' as const,
    }] : [];

    return Object.freeze<CropMatcherHealthEnvelope>({
      initialized: true,
      configured: true,
      hasCrop,
      candidates: Object.freeze(candidates) as ReadonlyArray<LocalCandidate>,
      source: hasCrop ? 'farm-profile' : 'none',
      noVisionClaim: true as const,
      capAtFortyPct: true as const,
      confidence: hasCrop ? ('medium' as Confidence) : ('low' as Confidence),
      explanation:
        'Local crop matcher reads the farmer\'s farm-profile crop and surfaces it as a ' +
        'low-confidence candidate (capped at ' + FARM_PROFILE_CAP + '%). NEVER performs visual ' +
        'analysis; the candidate exists only because the farmer told us what they grow. ' +
        'MultiPassIdentificationRuntime merges this with real vision engines when present; ' +
        'farm-profile alone never outranks a vision-verified candidate.',
      limitations:
        'Farm-profile candidate is a hint, not an identification. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<CropMatcherHealthEnvelope>({
    initialized: true,
    configured: false,
    hasCrop: false,
    candidates: Object.freeze([]) as ReadonlyArray<LocalCandidate>,
    source: 'none',
    noVisionClaim: true as const,
    capAtFortyPct: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Local crop matcher initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installLocalCropMatcherGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__cropMatcherHealth !== 'function') {
      w.__cropMatcherHealth = function () {
        const out = cropMatcherHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Local Crop Matcher]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
