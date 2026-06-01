/**
 * LocationDisplayNormalizer.ts — display-side dedup + normalization for
 * location strings. Fixes the "Maryland, United States, United States"
 * bug by collapsing duplicate / case-insensitive duplicate parts while
 * preserving order.
 *
 * Self-contained — zero imports. Frozen. Never throws.
 *
 * Public:
 *   normalizeLocationDisplay(parts: any) → string
 *   locationDisplayHealth() → frozen envelope
 *   installLocationDisplayGlobal() → pins __locationDisplayHealth
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const LOCATION_DISPLAY_NORMALIZER_VERSION = 'location-display-normalizer-v1' as const;

const FALLBACK = 'Location not set';

// US-shaped aliases collapse to a single label so we never render
// "United States, USA, US" in the same string.
const US_RE = /^(united\s+states(\s+of\s+america)?|u\.?\s*s\.?\s*a\.?|u\.?\s*s\.?)$/i;
function _canonicalize(part: string): string {
  if (US_RE.test(part)) return 'United States';
  return part;
}

/**
 * Accepts any of:
 *   - string: "Maryland, United States, United States"
 *   - array:  ['Maryland', 'United States', 'United States']
 *   - object: { city, region, state, country }
 *
 * Returns a clean comma-joined string with empty + duplicate parts
 * removed (case-insensitive). Order preserved. Falls back to
 * "Location not set" when everything resolves to empty.
 */
export function normalizeLocationDisplay(input: any): string {
  return _safe(() => {
    let parts: string[] = [];
    if (typeof input === 'string') {
      parts = input.split(',');
    } else if (Array.isArray(input)) {
      parts = input.map((p) => (typeof p === 'string' ? p : ''));
    } else if (input && typeof input === 'object') {
      const o = input as any;
      parts = [
        o.city, o.locality, o.principalSubdivisionCity,
        o.region, o.state, o.principalSubdivision,
        o.country, o.countryName,
      ].filter((p) => typeof p === 'string');
    }
    // Trim + drop empties + canonicalize.
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const raw of parts) {
      const trimmed = String(raw || '').trim();
      if (!trimmed) continue;
      const canonical = _canonicalize(trimmed);
      const key = canonical.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cleaned.push(canonical);
    }
    if (cleaned.length === 0) return FALLBACK;
    return cleaned.join(', ');
  }, FALLBACK);
}

export interface LocationDisplayHealthEnvelope {
  runtimeVersion: typeof LOCATION_DISPLAY_NORMALIZER_VERSION;
  initialized: true;
  duplicateSuppressionReady: true;
  emptyPartSuppressionReady: true;
  safeFallbackReady: true;
  fallbackText: string;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export function locationDisplayHealth(): Readonly<LocationDisplayHealthEnvelope> {
  return _safe(() => Object.freeze({
    runtimeVersion: LOCATION_DISPLAY_NORMALIZER_VERSION,
    initialized: true,
    duplicateSuppressionReady: true as const,
    emptyPartSuppressionReady: true as const,
    safeFallbackReady: true as const,
    fallbackText: FALLBACK,
    confidence: 'high' as Confidence,
    explanation:
      'Location display strings are deduplicated case-insensitively while preserving order. ' +
      'US-shaped aliases (US/USA/United States) collapse to "United States". ' +
      'Empty inputs render as "' + FALLBACK + '".',
    limitations:
      'Display-only normalization; does not alter stored location data. ' + GUIDANCE_TAIL,
  }), Object.freeze({
    runtimeVersion: LOCATION_DISPLAY_NORMALIZER_VERSION,
    initialized: true,
    duplicateSuppressionReady: true as const,
    emptyPartSuppressionReady: true as const,
    safeFallbackReady: true as const,
    fallbackText: FALLBACK,
    confidence: 'low' as Confidence,
    explanation: 'Location display normalizer initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as LocationDisplayHealthEnvelope);
}

export function installLocationDisplayGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__locationDisplayHealth !== 'function') {
      w.__locationDisplayHealth = function () {
        const out = locationDisplayHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Location Display]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
