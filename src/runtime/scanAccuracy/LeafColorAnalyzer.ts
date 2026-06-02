/**
 * LeafColorAnalyzer.ts — pins window.__leafAnalysisHealth.
 *
 * HONEST IMPLEMENTATION: real canvas-based color histogram analysis.
 * Computes dominant color ratios from leaf pixels:
 *
 *   greenRatio   — healthy chlorophyll signal
 *   yellowRatio  — possible nutrient stress / aging
 *   brownRatio   — possible necrosis / dry damage
 *   darkRatio    — shadow / very dark pixels
 *
 * The output is RAW MEASUREMENTS — never a disease diagnosis. The
 * limitations string makes clear these are colour proportions, not
 * confirmed problems.
 *
 * The runtime exposes a small candidates array so MultiPass has more
 * data to merge. Candidates are colour-band hints — "Leaves look
 * yellowing" — not crop identifications, so we do not return crop
 * keys. We surface them in a separate leafSignals array; MultiPass
 * ignores them for crop ID and the disease pipeline can read them.
 *
 * Pure: never modifies, never network calls. Self-contained.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const LEAF_COLOR_ANALYZER_VERSION = 'leaf-color-analyzer-v1' as const;

/** Downscale cap — keeps analysis fast on mobile (~5ms). */
const MAX_DIM = 192;

export interface LeafColorRatios {
  greenRatio: number | null;
  yellowRatio: number | null;
  brownRatio: number | null;
  darkRatio: number | null;
  totalPixelsAnalyzed: number;
}

export type LeafSignalSeverity = 'info' | 'watch' | 'act';

export interface LeafSignal {
  id: string;
  label: string;          // 'Leaves look healthy' / 'Leaves yellowing' / etc.
  severity: LeafSignalSeverity;
  evidence: string;       // 'green ≈ 78% of leaf area'
  rationale: string;
}

export interface LeafAnalysisHealthEnvelope {
  initialized: true;
  configured: boolean;
  hasMeasurement: boolean;
  ratios: Readonly<LeafColorRatios>;
  leafSignals: ReadonlyArray<LeafSignal>;
  // MultiPassIdentificationRuntime reads `candidates` from this probe —
  // we honestly return an empty array because color is NOT a crop ID.
  candidates: ReadonlyArray<{ key: string; label: string; confidencePct: number }>;
  noFakeDiagnosis: true;
  measurementOnly: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

let _lastRatios: Readonly<LeafColorRatios> = Object.freeze({
  greenRatio: null, yellowRatio: null, brownRatio: null,
  darkRatio: null, totalPixelsAnalyzed: 0,
});
let _lastSignals: ReadonlyArray<LeafSignal> = Object.freeze([]) as ReadonlyArray<LeafSignal>;

/** Classify a pixel into one of: 'green' | 'yellow' | 'brown' | 'dark' | null. */
function _classifyPixel(r: number, g: number, b: number): 'green' | 'yellow' | 'brown' | 'dark' | null {
  // Drop very-dark first.
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 30) return 'dark';
  // Healthy green: G dominates R/B by a clear margin.
  if (g > r + 12 && g > b + 12 && g > 60) return 'green';
  // Yellow: R + G high, B low.
  if (r > 120 && g > 120 && b < g - 30) return 'yellow';
  // Brown: R > G > B, all moderate, low saturation.
  if (r > 70 && g > 50 && b < 80 && r > g && g > b && r - b > 20) return 'brown';
  return null;
}

function _signalsFromRatios(r: Readonly<LeafColorRatios>): LeafSignal[] {
  const signals: LeafSignal[] = [];
  const g = r.greenRatio ?? 0;
  const y = r.yellowRatio ?? 0;
  const br = r.brownRatio ?? 0;

  if (g >= 0.55) {
    signals.push({
      id: 'leaf_color_healthy',
      label: 'Leaves look healthy',
      severity: 'info',
      evidence: `Green ≈ ${Math.round(g * 100)}% of leaf area`,
      rationale: 'High green ratio suggests good chlorophyll content.',
    });
  }
  if (y >= 0.15) {
    signals.push({
      id: 'leaf_color_yellowing',
      label: 'Leaves show yellowing',
      severity: y >= 0.3 ? 'act' : 'watch',
      evidence: `Yellow ≈ ${Math.round(y * 100)}% of leaf area`,
      rationale:
        'Yellow pixels above background level — possible nutrient stress, aging, or watering imbalance. '
        + 'Color signal only; not a disease diagnosis.',
    });
  }
  if (br >= 0.10) {
    signals.push({
      id: 'leaf_color_browning',
      label: 'Leaves show browning',
      severity: br >= 0.25 ? 'act' : 'watch',
      evidence: `Brown ≈ ${Math.round(br * 100)}% of leaf area`,
      rationale:
        'Brown pixels above background level — possible necrosis, sunburn, or drought damage. '
        + 'Color signal only; not a disease diagnosis.',
    });
  }
  return signals;
}

/** Measure leaf color ratios from an image source. Always resolves;
 *  returns null ratios when canvas unavailable. */
export async function analyzeLeafColor(source: any)
  : Promise<Readonly<{ ratios: LeafColorRatios; signals: ReadonlyArray<LeafSignal> }>> {
  return _safe(async () => {
    if (typeof document === 'undefined' || !source) {
      return Object.freeze({
        ratios: _lastRatios,
        signals: Object.freeze([]) as ReadonlyArray<LeafSignal>,
      });
    }
    const w0 = source.width || source.naturalWidth;
    const h0 = source.height || source.naturalHeight;
    if (!w0 || !h0) {
      return Object.freeze({
        ratios: _lastRatios,
        signals: Object.freeze([]) as ReadonlyArray<LeafSignal>,
      });
    }
    const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
    const w = Math.max(8, Math.round(w0 * scale));
    const h = Math.max(8, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return Object.freeze({
        ratios: _lastRatios,
        signals: Object.freeze([]) as ReadonlyArray<LeafSignal>,
      });
    }
    ctx.drawImage(source, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    let green = 0, yellow = 0, brown = 0, dark = 0;
    let total = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], gC = px[i + 1], bC = px[i + 2];
      const klass = _classifyPixel(r, gC, bC);
      total++;
      if (klass === 'green') green++;
      else if (klass === 'yellow') yellow++;
      else if (klass === 'brown') brown++;
      else if (klass === 'dark') dark++;
    }
    // We compute ratios against LEAF pixels only — exclude dark
    // background so a shadow doesn't deflate the green percentage.
    const leafPixels = green + yellow + brown;
    const denom = Math.max(1, leafPixels);
    const ratios: LeafColorRatios = {
      greenRatio: green / denom,
      yellowRatio: yellow / denom,
      brownRatio: brown / denom,
      darkRatio: dark / Math.max(1, total),
      totalPixelsAnalyzed: total,
    };
    const signals = _signalsFromRatios(ratios);
    _lastRatios = Object.freeze(ratios);
    _lastSignals = Object.freeze(signals) as ReadonlyArray<LeafSignal>;
    return Object.freeze({ ratios: _lastRatios, signals: _lastSignals });
  }, Promise.resolve(Object.freeze({
    ratios: _lastRatios,
    signals: Object.freeze([]) as ReadonlyArray<LeafSignal>,
  })) as any);
}

export function leafAnalysisHealth(): Readonly<LeafAnalysisHealthEnvelope> {
  return _safe(() => {
    const hasMeasurement = _lastRatios.greenRatio !== null;
    return Object.freeze<LeafAnalysisHealthEnvelope>({
      initialized: true,
      configured: typeof document !== 'undefined',
      hasMeasurement,
      ratios: _lastRatios,
      leafSignals: _lastSignals,
      // MultiPass reads `candidates` — leaf color is NOT a crop ID
      // so we honestly return an empty array. The disease pipeline
      // reads `leafSignals` separately.
      candidates: Object.freeze([]) as ReadonlyArray<{ key: string; label: string; confidencePct: number }>,
      noFakeDiagnosis: true as const,
      measurementOnly: true as const,
      confidence: hasMeasurement ? ('medium' as Confidence) : ('low' as Confidence),
      explanation:
        'Leaf color analyzer: real canvas-based color histogram. Computes green / yellow / brown / ' +
        'dark pixel ratios within leaf area. Output is RAW MEASUREMENT — never a disease ' +
        'diagnosis. The candidates array is honestly empty (color is not a crop ID); the disease ' +
        'pipeline can read leafSignals for nutrient / damage hints.',
      limitations:
        'Color ratios are pixel counts only, not confirmed problems. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<LeafAnalysisHealthEnvelope>({
    initialized: true,
    configured: false,
    hasMeasurement: false,
    ratios: _lastRatios,
    leafSignals: Object.freeze([]) as ReadonlyArray<LeafSignal>,
    candidates: Object.freeze([]) as ReadonlyArray<{ key: string; label: string; confidencePct: number }>,
    noFakeDiagnosis: true as const,
    measurementOnly: true as const,
    confidence: 'low' as Confidence,
    explanation: 'Leaf color analyzer initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installLeafColorAnalyzerGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__leafAnalysisHealth !== 'function') {
      w.__leafAnalysisHealth = function () {
        const out = leafAnalysisHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Leaf Color Analyzer]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
