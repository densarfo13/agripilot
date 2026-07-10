/**
 * imageQualityPreflight.js — client-side photo-quality scoring
 * before a scan is sent to the backend.
 *
 *   const report = await scoreImageQuality(file);
 *   if (!report.ok) showHint(report.hint);
 *
 * Why preflight (Stage 1 of the scan-intelligence pipeline)
 * ────────────────────────────────────────────────────────
 *   • A blurry or dark image produces a low-confidence verdict
 *     that the user can't trust. Catching it BEFORE the network
 *     call saves provider tokens + farmer waiting time.
 *   • The hint is shown inline so the farmer can retake without
 *     leaving the camera surface — exactly the iPhone-Camera
 *     idiom the spec calls for.
 *
 * Heuristics (pure JS, no extra dependencies)
 * ────────────────────────────────────────────
 *   The helper paints the captured blob into a tiny 80×80 canvas
 *   (~6400 pixels) and runs two cheap checks:
 *
 *   1. Mean luminance ∈ [0, 1]
 *        < 0.18 → too dark
 *        > 0.95 → washed out / overexposed
 *      Computed from per-pixel `0.299R + 0.587G + 0.114B`.
 *
 *   2. Laplacian-variance proxy ∈ [0, 255²]
 *        Low variance → blurry edges. Normalised to a
 *        `sharpness` score in [0, 1] via a soft tanh
 *        (variance / 1000), so a variance of ~1000+ is
 *        treated as "sharp enough."
 *
 *   We intentionally keep the canvas tiny (80×80) because:
 *   - Browser canvas operations on a multi-megapixel photo
 *     are slow (200–400ms on a mid-range Android).
 *   - Luminance + edge stats survive aggressive downscaling.
 *   - The whole preflight runs in < 30ms on the same hardware.
 *
 * Output contract
 * ────────────────
 *   { ok: boolean, hint: string | null,
 *     stats: { luminance, sharpness, width, height } }
 *
 *   ok          → all checks passed.
 *   hint        → one short calm sentence the UI can render.
 *                  Wording is intentionally non-judgmental —
 *                  no "BAD PHOTO!" / "FAILED!".
 *   stats       → diagnostic readout for tests + analytics.
 *
 * Strict-rule audit
 *   • Pure async function. Never throws — every step wrapped.
 *   • SSR-safe — returns `{ ok: true, hint: null }` when
 *     `document` / `Image` are unavailable so server-side
 *     callers (tests, prerender) never crash.
 *   • Zero new dependencies. Browser canvas + ImageData only.
 */

// Tunable thresholds — calibrated against test photos. Exposed
// for tests + future ops adjustment without code surgery.
export const PREFLIGHT_THRESHOLDS = Object.freeze({
  MIN_LUMINANCE: 0.18,
  MAX_LUMINANCE: 0.95,
  MIN_SHARPNESS: 0.30,
  CANVAS_SIDE:   80,
  // Minimum usable resolution (shortest side, px). A heavily-cropped thumbnail or
  // a tiny gallery upload has too few pixels for a reliable provider ID — it costs a
  // provider credit and returns a weak verdict. Real phone photos are far larger
  // even after the 2048px normalize downscale, so this only catches genuinely-small
  // images. Calibrated conservatively to avoid false rejects of legitimate photos.
  MIN_DIMENSION: 256,
});

/**
 * Pure resolution check — exported so it is unit-testable without a DOM. Returns
 * true when the image is large enough to scan, false when it is too small. Unknown
 * dimensions (null) are treated as OK so legacy/SSR paths never block.
 *
 * @param {number|null} width
 * @param {number|null} height
 * @returns {boolean}
 */
export function resolutionOk(width, height) {
  const w = Number(width), h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return true;
  return Math.min(w, h) >= PREFLIGHT_THRESHOLDS.MIN_DIMENSION;
}

/**
 * Score an image File / Blob / dataURL and return a quality
 * report. Never throws.
 *
 * @param {File|Blob|string} input  File, Blob, or `data:` URL string
 * @returns {Promise<{ok: boolean, hint: string|null, stats: object}>}
 */
export async function scoreImageQuality(input) {
  // SSR / unsupported environment — accept silently.
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { ok: true, hint: null, stats: _emptyStats() };
  }
  if (!input) return { ok: true, hint: null, stats: _emptyStats() };

  let url = null;
  let revoke = false;
  try {
    if (typeof input === 'string') {
      url = input;
    } else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      url = URL.createObjectURL(input);
      revoke = true;
    } else {
      return { ok: true, hint: null, stats: _emptyStats() };
    }

    const img = await _loadImage(url);
    if (!img) return { ok: true, hint: null, stats: _emptyStats() };

    const { side } = { side: PREFLIGHT_THRESHOLDS.CANVAS_SIDE };
    const canvas = document.createElement('canvas');
    canvas.width  = side;
    canvas.height = side;
    const ctx = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: true, hint: null, stats: _emptyStats() };

    try {
      ctx.drawImage(img, 0, 0, side, side);
    } catch { return { ok: true, hint: null, stats: _emptyStats() }; }

    let data;
    try { data = ctx.getImageData(0, 0, side, side).data; }
    catch { return { ok: true, hint: null, stats: _emptyStats() }; }

    const luminance = _meanLuminance(data);
    const sharpness = _laplacianSharpness(data, side);

    const stats = {
      luminance,
      sharpness,
      width:  img.naturalWidth  || side,
      height: img.naturalHeight || side,
    };

    // First failure wins — the UI only shows one hint at a time.
    if (luminance < PREFLIGHT_THRESHOLDS.MIN_LUMINANCE) {
      return {
        ok: false,
        hint: 'The photo looks dark. Try again with more light or move outdoors.',
        stats,
      };
    }
    if (luminance > PREFLIGHT_THRESHOLDS.MAX_LUMINANCE) {
      return {
        ok: false,
        hint: 'The photo is washed out. Try again with the sun behind you.',
        stats,
      };
    }
    if (sharpness < PREFLIGHT_THRESHOLDS.MIN_SHARPNESS) {
      return {
        ok: false,
        hint: 'The photo looks blurry. Hold the camera steady and try again.',
        stats,
      };
    }
    // Resolution — a too-small image (heavy crop / thumbnail) has too few pixels
    // for a reliable identification. Blocks BEFORE the provider call (saves a
    // credit + a weak verdict) and asks the farmer to move closer / use a larger
    // photo. Runs last so dark/blurry hints take priority.
    if (!resolutionOk(stats.width, stats.height)) {
      return {
        ok: false,
        hint: 'Move a little closer or use a larger photo — this one is too small to read clearly.',
        stats,
      };
    }
    return { ok: true, hint: null, stats };
  } catch {
    return { ok: true, hint: null, stats: _emptyStats() };
  } finally {
    if (revoke && url) {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function _emptyStats() {
  return { luminance: null, sharpness: null, width: null, height: null };
}

function _loadImage(url) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => resolve(null);
      img.decoding = 'async';
      img.src = url;
    } catch { resolve(null); }
  });
}

// Mean luminance ∈ [0, 1] using the Rec.601 coefficients.
function _meanLuminance(data) {
  let sum = 0;
  const len = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return (sum / len) / 255;
}

// Laplacian-variance proxy of edge sharpness, normalised to [0, 1].
// We don't allocate a second buffer — process the grayscale on the fly.
function _laplacianSharpness(data, side) {
  // Build a grayscale row-major view first; reusing the alpha
  // channel as scratch space would corrupt the next read.
  const gray = new Float32Array(side * side);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  // 3x3 Laplacian kernel (-1, -1, -1 / -1, 8, -1 / -1, -1, -1)
  // and accumulate sample mean + variance via Welford's algorithm
  // — single pass, O(n).
  let n = 0, mean = 0, m2 = 0;
  for (let y = 1; y < side - 1; y += 1) {
    for (let x = 1; x < side - 1; x += 1) {
      const i = y * side + x;
      const v = 8 * gray[i]
              - gray[i - 1]     - gray[i + 1]
              - gray[i - side]  - gray[i + side]
              - gray[i - side - 1] - gray[i - side + 1]
              - gray[i + side - 1] - gray[i + side + 1];
      n += 1;
      const delta = v - mean;
      mean += delta / n;
      m2 += delta * (v - mean);
    }
  }
  const variance = n > 0 ? m2 / n : 0;
  // Soft-saturating map to [0, 1]: tanh(variance / 1000).
  // A focused leaf photo on a phone typically lands ≥1500; very
  // blurry images come in well below 500.
  return Math.tanh(variance / 1000);
}

// ═══════════════════════════════════════════════════════════════
// Rich multi-metric analyzer — MEASURED photo quality for the Image
// Quality card. Extends the two-check preflight into the full metric
// set the card displays. Every value is COMPUTED from pixel data on a
// 128px canvas:
//   • brightness / exposure / focus  → DIRECT measurements.
//   • leafCoverage (Excess-Green index), shadows (dark-region +
//     regional luminance variance), framing (green-mass centering)
//     → honest statistical PROXIES, never ML segmentation, and only
//     reported when a green subject actually exists (a soil / insect
//     scan legitimately has ~0 green, so those rows are omitted rather
//     than flagged poor).
// Zero dependencies; ~<50ms on a mid-range Android.
//
// This does NOT change rejection: the hard pre-submission block stays
// on the proven direct signals in scoreImageQuality() above. The proxy
// metrics here are ADVISORY display only.
// ═══════════════════════════════════════════════════════════════

export const ANALYZER = Object.freeze({
  SIDE: 128,
  IDEAL_LUM_LO: 0.28, IDEAL_LUM_HI: 0.82,
  OVEREXPOSED: 0.96, UNDEREXPOSED: 0.05,
  EXG_VEG: 0.12,               // normalized Excess-Green vegetation cutoff
  DARK_LUM: 0.12,              // "in shadow" pixel cutoff
  GRID: 4,                     // regional grid for uneven-lighting
  SUBJECT_MIN: 0.04,           // green fraction below which coverage/framing are "not measurable"
  IDEAL_COVER_LO: 0.12, IDEAL_COVER_HI: 0.9,
});

const _clamp100 = (v) => Math.max(0, Math.min(100, Math.round(v)));

// 100 inside [lo,hi], falling off linearly outside over `span`.
function _bandScore(v, lo, hi, span) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= lo && v <= hi) return 100;
  const d = v < lo ? (lo - v) : (v - hi);
  return _clamp100(100 - (d / span) * 100);
}

// One luminance pass: mean, over/under-exposed fractions, dark
// fraction, and a GRID×GRID map of regional mean luminance (whose
// stddev is the uneven-lighting / shadow signal).
function _luminanceStats(data, side) {
  const G = ANALYZER.GRID;
  const cell = side / G;
  const rSum = new Float64Array(G * G);
  const rCnt = new Float64Array(G * G);
  let sum = 0, over = 0, under = 0, dark = 0;
  const total = side * side;
  for (let y = 0; y < side; y += 1) {
    const gy = Math.min(G - 1, Math.floor(y / cell));
    for (let x = 0; x < side; x += 1) {
      const i = (y * side + x) * 4;
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      sum += l;
      if (l >= ANALYZER.OVEREXPOSED) over += 1;
      else if (l <= ANALYZER.UNDEREXPOSED) under += 1;
      if (l < ANALYZER.DARK_LUM) dark += 1;
      const gi = gy * G + Math.min(G - 1, Math.floor(x / cell));
      rSum[gi] += l; rCnt[gi] += 1;
    }
  }
  let m = 0, k = 0;
  const means = [];
  for (let i = 0; i < G * G; i += 1) {
    if (rCnt[i] > 0) { const mv = rSum[i] / rCnt[i]; means.push(mv); m += mv; k += 1; }
  }
  m = k > 0 ? m / k : 0;
  let vv = 0;
  for (let i = 0; i < means.length; i += 1) vv += (means[i] - m) * (means[i] - m);
  const unevenness = means.length > 0 ? Math.sqrt(vv / means.length) : 0;
  return { meanLum: sum / total, overFrac: over / total, underFrac: under / total,
    darkFrac: dark / total, unevenness };
}

// One vegetation pass: Excess-Green fraction + green-mass centroid offset.
function _vegetationStats(data, side) {
  let veg = 0, cx = 0, cy = 0;
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const i = (y * side + x) * 4;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const exg = 2 * g - r - b;                 // Excess-Green index ∈ [-2, 2]
      if (exg > ANALYZER.EXG_VEG && g >= r && g >= b) { veg += 1; cx += x; cy += y; }
    }
  }
  const total = side * side;
  if (veg === 0) return { fraction: 0, centerOffset: null };
  const offX = Math.abs((cx / veg) / (side - 1) - 0.5) * 2;   // 0 centered .. 1 edge
  const offY = Math.abs((cy / veg) / (side - 1) - 0.5) * 2;
  return { fraction: veg / total, centerOffset: (offX + offY) / 2 };
}

/**
 * Measure the full photo-quality metric set from an image. Returns an
 * object in the envelope's imageQuality shape — all sub-scores are
 * 0..100 where HIGHER = better — plus honest raw `stats`. Never throws;
 * returns measured:false on SSR / unsupported / load failure.
 *
 * @param {File|Blob|string} input  File, Blob, or `data:`/`blob:` URL string
 * @returns {Promise<object>}
 */
export async function measureImageQuality(input) {
  const NA = Object.freeze({
    measured: false,
    brightness: null, exposure: null, focus: null, blur: null,
    shadow: null, leafCoverage: null, centered: null, resolution: null,
    distance: 'unknown', overall: 'unknown', retakeNeeded: false,
    worstKey: null, retakeGuidance: null, stats: null,
  });
  if (typeof document === 'undefined' || typeof Image === 'undefined' || !input) return NA;

  let url = null, revoke = false;
  try {
    if (typeof input === 'string') url = input;
    else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      url = URL.createObjectURL(input); revoke = true;
    } else return NA;

    const img = await _loadImage(url);
    if (!img) return NA;
    const side = ANALYZER.SIDE;
    const canvas = document.createElement('canvas');
    canvas.width = side; canvas.height = side;
    const ctx = canvas.getContext && canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return NA;
    try { ctx.drawImage(img, 0, 0, side, side); } catch { return NA; }
    let data;
    try { data = ctx.getImageData(0, 0, side, side).data; } catch { return NA; }

    const lum = _luminanceStats(data, side);
    const sharpness = _laplacianSharpness(data, side);        // 0..1
    const veg = _vegetationStats(data, side);
    const w = img.naturalWidth || side, h = img.naturalHeight || side;
    const minDim = Math.min(w, h);
    const hasSubject = veg.fraction >= ANALYZER.SUBJECT_MIN;

    // ── Map real measurements → 0..100 "goodness" sub-scores ──
    const brightness   = _bandScore(lum.meanLum, ANALYZER.IDEAL_LUM_LO, ANALYZER.IDEAL_LUM_HI, 0.28);
    const exposure     = _clamp100(100 - (lum.overFrac + lum.underFrac) * 320);
    const focus        = _clamp100(sharpness * 100);
    const shadow       = _clamp100(100 - (lum.darkFrac * 180 + lum.unevenness * 160));
    const resolution   = _clamp100((minDim / 512) * 100);
    // Plant-oriented proxies — only when a green subject is present.
    const leafCoverage = hasSubject ? _bandScore(veg.fraction, ANALYZER.IDEAL_COVER_LO, ANALYZER.IDEAL_COVER_HI, 0.5) : null;
    const centered     = (hasSubject && veg.centerOffset != null) ? _clamp100(100 - veg.centerOffset * 120) : null;
    const distance     = !hasSubject ? 'unknown' : veg.fraction > 0.94 ? 'too_close' : 'good';

    // Overall + retake are driven ONLY by the proven DIRECT signals so a
    // legitimate soil/insect photo (low green) is never forced to "poor".
    const critical = [
      { s: focus,      poor: 40, key: 'blurry' },
      { s: brightness, poor: 35, key: 'lighting' },
      { s: exposure,   poor: 35, key: 'exposure' },
      { s: resolution, poor: 45, key: 'resolution' },
    ].filter((c) => c.s != null);
    const worst = critical.slice().sort((a, b) => a.s - b.s)[0] || null;
    const retakeNeeded = !!(worst && worst.s < worst.poor);
    const anyWarn = critical.some((c) => c.s < 60)
      || [shadow, leafCoverage, centered].some((s) => s != null && s < 45);
    const overall = retakeNeeded ? 'poor' : anyWarn ? 'fair' : 'good';

    return Object.freeze({
      measured: true,
      brightness, exposure, focus,
      blur: focus,                       // blur is the same sharpness signal (its low end)
      shadow, leafCoverage, centered, resolution,
      distance, overall, retakeNeeded,
      worstKey: retakeNeeded && worst ? worst.key : null,
      retakeGuidance: null,              // card renders i18n from worstKey; raw field stays null
      stats: Object.freeze({
        meanLuminance:  Math.round(lum.meanLum * 1000) / 1000,
        sharpness:      Math.round(sharpness * 1000) / 1000,
        overExposedPct: Math.round(lum.overFrac * 1000) / 10,
        underExposedPct: Math.round(lum.underFrac * 1000) / 10,
        darkPct:        Math.round(lum.darkFrac * 1000) / 10,
        greenPct:       Math.round(veg.fraction * 1000) / 10,
        width: w, height: h,
      }),
    });
  } catch {
    return NA;
  } finally {
    if (revoke && url) { try { URL.revokeObjectURL(url); } catch { /* ignore */ } }
  }
}

// Pure metric helpers — exported so the CV math is unit-testable with
// synthetic pixel buffers (the full measureImageQuality needs a browser
// canvas; these run headless in node).
export const _internal = Object.freeze({
  _luminanceStats, _vegetationStats, _bandScore, _laplacianSharpness, _meanLuminance,
});

const _module = { scoreImageQuality, measureImageQuality, PREFLIGHT_THRESHOLDS, ANALYZER };
export default _module;
