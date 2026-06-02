/**
 * ImageQualityGate.ts — §PHASE 1.
 *
 * REAL client-side image-quality analysis using a 2D canvas. Computes
 * five metrics from pixel data and returns a verdict that the scan
 * pipeline uses to BLOCK identification on poor images. No ML, no
 * server call — just honest pixel math.
 *
 *   blurVariance       — Laplacian variance (higher = sharper)
 *   brightnessMean     — mean luminance 0..255
 *   shadowRatio        — fraction of very-dark pixels
 *   leafCoverageRatio  — fraction of pixels where G dominates R/B
 *   focusEdgeDensity   — fraction of pixels with strong edge gradient
 *
 * The gate is intentionally conservative: if we cannot analyze the
 * image (no canvas, no ImageBitmap, etc.) we return 'unknown' and let
 * the caller proceed rather than blocking the scan. Better to allow a
 * possibly-low-quality scan than to lock the farmer out.
 */

import type {
  ImageQualityReport, ImageQualityMetrics, ImageQualityVerdict, Confidence,
} from './ScanAccuracyContracts';
import { IMAGE_QUALITY_THRESHOLDS, GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Downscale dimension cap — keep analysis fast on mobile (~10ms). */
const MAX_DIM = 256;

/** Compute all 5 metrics from an HTMLImageElement / ImageBitmap.
 *  Returns null when canvas is unavailable. */
async function _measure(source: any): Promise<Readonly<ImageQualityMetrics> | null> {
  return _safe(async () => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Source can be HTMLImageElement (has width/height) or ImageBitmap.
    const w0 = source.width || source.naturalWidth;
    const h0 = source.height || source.naturalHeight;
    if (!w0 || !h0) return null;

    const scale = Math.min(1, MAX_DIM / Math.max(w0, h0));
    const w = Math.max(2, Math.round(w0 * scale));
    const h = Math.max(2, Math.round(h0 * scale));
    canvas.width = w; canvas.height = h;
    ctx.drawImage(source, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const px = imgData.data;

    // Luminance buffer.
    const lum = new Float32Array(w * h);
    let totalLum = 0;
    let darkCount = 0;
    let greenCount = 0;
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      lum[j] = Y;
      totalLum += Y;
      if (Y < 40) darkCount++;
      // "Green dominant" heuristic — G > R+10 AND G > B+10. Robust to
      // exposure shifts; not a real segmenter but cheap.
      if (g > r + 10 && g > b + 10 && g > 60) greenCount++;
    }
    const brightnessMean = totalLum / lum.length;
    const shadowRatio = darkCount / lum.length;
    const leafCoverageRatio = greenCount / lum.length;

    // Laplacian variance (blur proxy).
    let lapMean = 0;
    let lapCount = 0;
    const laps = new Float32Array((w - 2) * (h - 2));
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const c = lum[y * w + x];
        const u = lum[(y - 1) * w + x];
        const d = lum[(y + 1) * w + x];
        const l = lum[y * w + (x - 1)];
        const r = lum[y * w + (x + 1)];
        const L = (u + d + l + r) - 4 * c;
        laps[lapCount++] = L;
        lapMean += L;
      }
    }
    lapMean /= Math.max(1, lapCount);
    let lapVar = 0;
    for (let k = 0; k < lapCount; k++) {
      const diff = laps[k] - lapMean;
      lapVar += diff * diff;
    }
    const blurVariance = lapVar / Math.max(1, lapCount);

    // Sobel-style edge density (focus proxy).
    let strongEdges = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx = lum[y * w + (x + 1)] - lum[y * w + (x - 1)];
        const gy = lum[(y + 1) * w + x] - lum[(y - 1) * w + x];
        const mag = Math.sqrt(gx * gx + gy * gy);
        if (mag > 30) strongEdges++;
      }
    }
    const focusEdgeDensity = strongEdges / Math.max(1, (w - 2) * (h - 2));

    return Object.freeze<ImageQualityMetrics>({
      blurVariance, brightnessMean, shadowRatio,
      leafCoverageRatio, focusEdgeDensity,
    });
  }, Promise.resolve(null) as any);
}

const TIPS = Object.freeze([
  'Move closer to the leaf.',
  'Use daylight.',
  'Focus on one leaf.',
  'Fill most of the frame.',
]);

function _verdictFromMetrics(m: Readonly<ImageQualityMetrics>): {
  verdict: ImageQualityVerdict;
  reasons: string[];
} {
  const reasons: string[] = [];
  const T = IMAGE_QUALITY_THRESHOLDS;
  if (m.blurVariance !== null && m.blurVariance < T.blurVarianceMin)
    reasons.push('Image looks blurry.');
  if (m.brightnessMean !== null && m.brightnessMean < T.brightnessMin)
    reasons.push('Image is too dark.');
  if (m.brightnessMean !== null && m.brightnessMean > T.brightnessMax)
    reasons.push('Image is too bright.');
  if (m.shadowRatio !== null && m.shadowRatio > T.shadowRatioMax)
    reasons.push('Heavy shadows on the leaf.');
  if (m.leafCoverageRatio !== null && m.leafCoverageRatio < T.leafCoverageMin)
    reasons.push('Leaf does not fill enough of the frame.');
  if (m.focusEdgeDensity !== null && m.focusEdgeDensity < T.focusEdgeDensityMin)
    reasons.push('Photo looks soft — focus on one leaf.');
  return { verdict: reasons.length > 0 ? 'poor' : 'good', reasons };
}

/** Public API — analyze an image source and return a quality report.
 *  Always resolves (never throws); returns 'unknown' verdict when
 *  canvas is unavailable. */
export async function analyzeImageQuality(source: any)
  : Promise<Readonly<ImageQualityReport>> {
  return _safe(async () => {
    const metrics = await _measure(source);
    if (!metrics) {
      const fallbackMetrics: Readonly<ImageQualityMetrics> = Object.freeze({
        blurVariance: null, brightnessMean: null, shadowRatio: null,
        leafCoverageRatio: null, focusEdgeDensity: null,
      });
      return Object.freeze<ImageQualityReport>({
        verdict: 'unknown',
        reasons: Object.freeze([]) as ReadonlyArray<string>,
        tips: TIPS,
        metrics: fallbackMetrics,
        confidence: 'low' as Confidence,
        limitations:
          'Canvas not available — quality not analyzed. Caller may proceed. '
          + GUIDANCE_TAIL,
      });
    }
    const { verdict, reasons } = _verdictFromMetrics(metrics);
    return Object.freeze<ImageQualityReport>({
      verdict,
      reasons: Object.freeze(reasons) as ReadonlyArray<string>,
      tips: TIPS,
      metrics,
      confidence: verdict === 'good' ? 'high' : verdict === 'poor' ? 'medium' : 'low',
      limitations:
        'Quality is estimated from pixel statistics only — not a definitive verdict. '
        + GUIDANCE_TAIL,
    });
  }, Promise.resolve(Object.freeze<ImageQualityReport>({
    verdict: 'unknown',
    reasons: Object.freeze([]) as ReadonlyArray<string>,
    tips: TIPS,
    metrics: Object.freeze({
      blurVariance: null, brightnessMean: null, shadowRatio: null,
      leafCoverageRatio: null, focusEdgeDensity: null,
    }),
    confidence: 'low' as Confidence,
    limitations: 'Quality analyzer threw. ' + GUIDANCE_TAIL,
  })) as any);
}

/** Pure helper — given a quality report, should we block identification?
 *  Block ONLY on verdict === 'poor'. 'unknown' is permissive so the
 *  farmer is never trapped by a quality-analyzer failure. */
export function shouldBlockIdentification(report: Readonly<ImageQualityReport>): boolean {
  return _safe(() => report && report.verdict === 'poor', false);
}

export function imageQualityGateReady(): boolean {
  return _safe(() => typeof document !== 'undefined'
    && typeof document.createElement === 'function', false);
}
