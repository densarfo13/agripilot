/**
 * src/runtime/satellite/FarmBoundarySignalEngine.ts — validates
 * farm boundary or GPS-point context before any satellite call.
 *
 * Pure. Never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

export interface BoundaryInput {
  farmBoundary?: ReadonlyArray<{ lat: number; lng: number }>;
  gpsPoint?:     { lat: number; lng: number };
  region?:       string;
}

export interface BoundaryOutput {
  hasBoundary:  boolean;
  hasGpsPoint:  boolean;
  hasContext:   boolean;
  approxAreaHa?: number;     // approximate area in hectares
}

/** Shoelace formula for polygon area in m². Pure. */
function _polygonAreaHa(pts: ReadonlyArray<{ lat: number; lng: number }>): number {
  return _safe(() => {
    if (!Array.isArray(pts) || pts.length < 3) return 0;
    // Convert lat/lng to a planar approximation (m).
    // Acceptable for fields <10km wide; gross approximation.
    const R = 6371000;
    const radius = R;
    const lat0 = pts[0].lat * Math.PI / 180;
    const cosLat0 = Math.cos(lat0);
    const xy = pts.map((p) => ({
      x: radius * (p.lng * Math.PI / 180) * cosLat0,
      y: radius * (p.lat * Math.PI / 180),
    }));
    let area2 = 0;
    for (let i = 0; i < xy.length; i++) {
      const a = xy[i];
      const b = xy[(i + 1) % xy.length];
      area2 += a.x * b.y - b.x * a.y;
    }
    const m2 = Math.abs(area2 / 2);
    return m2 / 10000; // → hectares
  }, 0);
}

export function evaluateBoundary(input: BoundaryInput): BoundaryOutput {
  return _safe(() => {
    const hasB = Array.isArray(input.farmBoundary)
                 && input.farmBoundary.length >= 3;
    const hasG = !!(input.gpsPoint
                    && typeof input.gpsPoint.lat === 'number'
                    && typeof input.gpsPoint.lng === 'number');
    const hasContext = hasB || hasG;
    let approxAreaHa: number | undefined;
    if (hasB) approxAreaHa = _polygonAreaHa(input.farmBoundary!);
    return Object.freeze({
      hasBoundary:  hasB,
      hasGpsPoint:  hasG,
      hasContext,
      approxAreaHa,
    });
  }, Object.freeze({
    hasBoundary:  false,
    hasGpsPoint:  false,
    hasContext:   false,
  }));
}

export const BOUNDARY_ENGINE_VERSION = 'farm-boundary-engine-v1';
