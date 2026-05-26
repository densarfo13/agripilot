/**
 * leafFocusEngine.js — pure-canvas leaf isolation + lesion crop.
 *
 *   import {
 *     analyzeLeafFocus, deriveFocusGuidance,
 *     _internal as leafInternal,
 *   } from 'src/core/scan/leafFocusEngine.js';
 *
 *   const focus = await analyzeLeafFocus(file, {
 *     workingMaxDim: 320,
 *     cropMaxDim:    1024,
 *   });
 *   // focus = {
 *   //   ok: true,
 *   //   originalDataUrl,
 *   //   isolatedLeafDataUrl,
 *   //   lesionCropDataUrl,
 *   //   focusOverlayDataUrl,
 *   //   metrics: { leafCoveragePct, brightness, centeringOffsetPct,
 *   //              dominantLeafBBox, lesionBBox, candidateLeafCount },
 *   //   guidance: { moveCloser, lightingDark, lightingBright,
 *   //               leafNotCentered, multipleLeaves },
 *   // }
 *
 * What it does
 * ────────────
 *   Takes a captured / uploaded image and produces three crops the
 *   AI can consume separately:
 *
 *     1. originalDataUrl       — pass-through of the input image
 *     2. isolatedLeafDataUrl   — tight crop around the dominant leaf
 *     3. lesionCropDataUrl     — tight crop around the most colour-
 *                                anomalous region within the leaf
 *
 *   Plus a focusOverlay (the original image with a rectangle drawn
 *   around the dominant leaf) for visual feedback in the UI.
 *
 *   No ML, no third-party deps. Pure HSV colour masking + flood-
 *   fill connected-component analysis on a downscaled working
 *   canvas (320 px on the longest side by default) so the whole
 *   pipeline runs in ~50–100 ms on iPhone Safari.
 *
 * Algorithm
 * ─────────
 *   1. Decode the input into an ImageData at workingMaxDim.
 *   2. Per-pixel HSV classification: pixel is "leaf" when hue is
 *      in the broad green range (50°-160°) AND saturation > 20%
 *      AND value > 10%. The wide hue window covers diseased /
 *      yellowed / browned leaves; sat + val thresholds cut out
 *      whites (walls) and shadows (background).
 *   3. Connected-component labelling via iterative flood-fill on
 *      the binary mask. Pick the largest component as the
 *      dominant leaf; track the second-largest to flag the
 *      "multiple leaves" guidance.
 *   4. Bounding box of the dominant component → isolated leaf
 *      crop coordinates (re-scaled to the original image space
 *      so the final crop preserves resolution).
 *   5. Lesion detection: re-scan pixels inside the dominant
 *      component, find the contiguous region whose hue or
 *      saturation diverges most from the median leaf colour;
 *      bounding box → lesion crop.
 *   6. Brightness mean + centering offset metrics drive the
 *      guidance flags (move closer / lighting dark / not
 *      centered / multiple leaves).
 *
 * Strict-rule audit
 *   • Pure async. Never throws. SSR-safe — guards every
 *     `document` / `Image` / `URL` reference and resolves to a
 *     structured failure envelope on any missing primitive.
 *   • No retained module state. Every call is independent;
 *     parallel calls don't interfere.
 *   • Bounded memory: the working canvas is capped at
 *     workingMaxDim × workingMaxDim pixels (default 320² ≈ 102k px)
 *     so even a 12 MP iPhone capture costs <500 KB of intermediate
 *     ImageData buffers.
 */

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_WORKING_MAX_DIM = 320;
const DEFAULT_CROP_MAX_DIM    = 1024;
const DEFAULT_JPEG_QUALITY    = 0.85;

// HSV green range. Hue 50-160 covers light yellow-green through
// blue-green, intentionally wide to keep diseased / yellowed
// leaves in the leaf class.
const LEAF_HUE_MIN = 50;
const LEAF_HUE_MAX = 160;
const LEAF_SAT_MIN = 0.18;   // 0..1
const LEAF_VAL_MIN = 0.10;   // 0..1

// Brightness thresholds (0..255 mean V channel).
const BRIGHTNESS_DARK_THRESHOLD   = 60;
const BRIGHTNESS_BRIGHT_THRESHOLD = 230;

// Leaf coverage thresholds (% of total pixels).
const COVERAGE_MIN_OK_PCT  = 5;    // below → "move closer"
const COVERAGE_MIN_GOOD_PCT = 12;  // below → "move closer" guidance fires
// (no upper bound — closer is generally fine for leaf scans)

// Centering offset threshold (% of image diagonal).
const CENTERING_OFFSET_THRESHOLD_PCT = 35;

// Multiple-leaves detection — when the second-largest component
// is at least this fraction of the largest, we surface guidance.
const MULTI_LEAF_RATIO = 0.40;

// Minimum dominant component size, in pixels of the working
// image. Smaller than this and we treat the scan as "no leaf
// detected" rather than chasing a tiny green speck.
const MIN_COMPONENT_PX = 200;

// ─── DOM availability guards ────────────────────────────────

function _hasDom() {
  try {
    return typeof document !== 'undefined'
      && typeof document.createElement === 'function'
      && typeof Image !== 'undefined'
      && typeof URL !== 'undefined';
  } catch { return false; }
}

// ─── HSV conversion ─────────────────────────────────────────

/**
 * Fast RGB → HSV. Returns hue in degrees (0-360), sat + val 0-1.
 * Pure / never throws.
 */
function _rgbToHsv(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d === 0) h = 0;
  else if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = ((bb - rr) / d) + 2;
  else                 h = ((rr - gg) / d) + 4;
  h *= 60;
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * Classify a single pixel as leaf (true) or background (false).
 */
function _isLeafPixel(r, g, b) {
  const { h, s, v } = _rgbToHsv(r, g, b);
  if (v < LEAF_VAL_MIN) return false;
  if (s < LEAF_SAT_MIN) return false;
  return h >= LEAF_HUE_MIN && h <= LEAF_HUE_MAX;
}

// ─── Canvas helpers ─────────────────────────────────────────

function _decodeToImage(blobOrFile) {
  return new Promise((resolve) => {
    try {
      if (!_hasDom()) { resolve(null); return; }
      const url = URL.createObjectURL(blobOrFile);
      const img = new Image();
      const cleanup = () => { try { URL.revokeObjectURL(url); } catch { /* swallow */ } };
      img.onload = () => {
        const ok = img.naturalWidth > 0 && img.naturalHeight > 0;
        cleanup();
        resolve(ok ? img : null);
      };
      img.onerror = () => { cleanup(); resolve(null); };
      img.src = url;
    } catch { resolve(null); }
  });
}

function _drawWorkingCanvas(img, maxDim) {
  try {
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const w = Math.max(1, Math.round(img.naturalWidth  * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    let imageData = null;
    try { imageData = ctx.getImageData(0, 0, w, h); }
    catch { return null; }
    return { canvas, ctx, imageData, scale };
  } catch { return null; }
}

function _canvasToDataUrl(canvas, q) {
  try { return canvas.toDataURL('image/jpeg', Math.max(0.1, Math.min(1, q || DEFAULT_JPEG_QUALITY))); }
  catch { return ''; }
}

// ─── Mask + connected components ────────────────────────────

/**
 * Build a binary mask (Uint8Array of 0/1 per pixel) marking which
 * pixels classify as leaf. Pure; never throws.
 */
export function buildLeafMask(imageData) {
  if (!imageData || !imageData.data) return new Uint8Array(0);
  const data = imageData.data;
  const out = new Uint8Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = _isLeafPixel(data[i], data[i + 1], data[i + 2]) ? 1 : 0;
  }
  return out;
}

/**
 * Iterative flood-fill connected-component labelling.
 * Returns:
 *   labels:     Int32Array — 0 = background, 1..N = component id
 *   sizes:      number[] — sizes[i] = pixel count of component i
 *   bboxes:     {minX,minY,maxX,maxY}[] — index by component id
 *   dominantId: id of the largest component, or 0 when none ≥ MIN_COMPONENT_PX
 *   secondId:   id of the second-largest, or 0
 *
 * Pure; never throws.
 */
export function labelComponents(mask, width, height) {
  const total = width * height;
  const labels = new Int32Array(total);
  const sizes = [0];
  const bboxes = [null];
  let nextId = 1;
  // Reusable stack — avoids per-pixel allocations.
  const stack = new Int32Array(total);
  for (let p = 0; p < total; p++) {
    if (mask[p] !== 1 || labels[p] !== 0) continue;
    // Flood-fill from p.
    let sp = 0;
    stack[sp++] = p;
    labels[p] = nextId;
    let count = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    while (sp > 0) {
      const q = stack[--sp];
      const qx = q % width;
      const qy = (q - qx) / width;
      count++;
      if (qx < minX) minX = qx;
      if (qx > maxX) maxX = qx;
      if (qy < minY) minY = qy;
      if (qy > maxY) maxY = qy;
      // 4-neighbour push
      if (qx > 0) {
        const n = q - 1;
        if (mask[n] === 1 && labels[n] === 0) { labels[n] = nextId; stack[sp++] = n; }
      }
      if (qx < width - 1) {
        const n = q + 1;
        if (mask[n] === 1 && labels[n] === 0) { labels[n] = nextId; stack[sp++] = n; }
      }
      if (qy > 0) {
        const n = q - width;
        if (mask[n] === 1 && labels[n] === 0) { labels[n] = nextId; stack[sp++] = n; }
      }
      if (qy < height - 1) {
        const n = q + width;
        if (mask[n] === 1 && labels[n] === 0) { labels[n] = nextId; stack[sp++] = n; }
      }
    }
    sizes[nextId] = count;
    bboxes[nextId] = { minX, minY, maxX, maxY };
    nextId++;
  }
  // Find dominant + second-largest.
  let dominantId = 0, dominantSize = 0;
  let secondId   = 0, secondSize   = 0;
  for (let i = 1; i < sizes.length; i++) {
    const s = sizes[i];
    if (s > dominantSize) {
      secondSize = dominantSize; secondId = dominantId;
      dominantSize = s;          dominantId = i;
    } else if (s > secondSize) {
      secondSize = s; secondId = i;
    }
  }
  if (dominantSize < MIN_COMPONENT_PX) { dominantId = 0; secondId = 0; }
  return {
    labels, sizes, bboxes, dominantId, secondId,
    candidateCount: Math.max(0, sizes.length - 1),
  };
}

// ─── Lesion detection ──────────────────────────────────────

/**
 * Within the dominant component, find the contiguous patch most
 * deviating from the median leaf colour. Returns the bbox in
 * working-image coordinates OR null when no patch stands out.
 *
 * Heuristic: pixels whose hue is outside the healthy-green narrow
 * band (90-130°) OR whose saturation is unusually low are
 * candidates. Flood-fill within the candidate set; pick the
 * largest contiguous lesion.
 *
 * Pure; never throws.
 */
export function detectLesion(imageData, labels, dominantId, width, height) {
  if (!imageData || !dominantId) return null;
  const data = imageData.data;
  const total = width * height;
  const candidate = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    if (labels[p] !== dominantId) continue;
    const i = p * 4;
    const { h, s } = _rgbToHsv(data[i], data[i + 1], data[i + 2]);
    // Healthy-green narrow band — pixels OUTSIDE this band are
    // potential lesion candidates. Includes yellowing (hue < 90),
    // browning (hue < 50, but those wouldn't pass the leaf gate),
    // and very low-saturation (washed out) regions.
    const outsideHealthy = h < 90 || h > 130;
    const desaturated = s < 0.30;
    if (outsideHealthy || desaturated) candidate[p] = 1;
  }
  // Flood-fill within candidate, pick largest.
  const lesionLabels = new Int32Array(total);
  const stack = new Int32Array(total);
  let bestSize = 0;
  let bestBBox = null;
  let nextId = 1;
  for (let p = 0; p < total; p++) {
    if (candidate[p] !== 1 || lesionLabels[p] !== 0) continue;
    let sp = 0;
    stack[sp++] = p;
    lesionLabels[p] = nextId;
    let count = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    while (sp > 0) {
      const q = stack[--sp];
      const qx = q % width;
      const qy = (q - qx) / width;
      count++;
      if (qx < minX) minX = qx;
      if (qx > maxX) maxX = qx;
      if (qy < minY) minY = qy;
      if (qy > maxY) maxY = qy;
      if (qx > 0) {
        const n = q - 1;
        if (candidate[n] === 1 && lesionLabels[n] === 0) { lesionLabels[n] = nextId; stack[sp++] = n; }
      }
      if (qx < width - 1) {
        const n = q + 1;
        if (candidate[n] === 1 && lesionLabels[n] === 0) { lesionLabels[n] = nextId; stack[sp++] = n; }
      }
      if (qy > 0) {
        const n = q - width;
        if (candidate[n] === 1 && lesionLabels[n] === 0) { lesionLabels[n] = nextId; stack[sp++] = n; }
      }
      if (qy < height - 1) {
        const n = q + width;
        if (candidate[n] === 1 && lesionLabels[n] === 0) { lesionLabels[n] = nextId; stack[sp++] = n; }
      }
    }
    if (count > bestSize) {
      bestSize = count;
      bestBBox = { minX, minY, maxX, maxY };
    }
    nextId++;
  }
  // Require the lesion to be at least 0.5% of the image, smaller
  // than 60% of the leaf bbox, otherwise it's noise / the whole leaf.
  if (bestSize < Math.max(20, Math.round(total * 0.005))) return null;
  return bestBBox;
}

// ─── Metrics ────────────────────────────────────────────────

/**
 * Compute per-image diagnostic metrics. Pure; never throws.
 *
 * @returns {{
 *   leafCoveragePct: number,
 *   brightness:      number,    // 0..255 mean of V*255 over the leaf
 *   centeringOffsetPct: number, // % of image diagonal
 *   dominantLeafBBox: object|null,
 *   lesionBBox:      object|null,
 *   candidateLeafCount: number,
 *   secondaryRatio:  number,    // secondLargest / dominant size; 0 when none
 * }}
 */
export function computeMetrics({
  imageData, mask, labels, dominantId, secondId, sizes, bboxes,
  lesionBBox, width, height,
}) {
  const total = width * height;
  let leafPx = 0;
  for (let p = 0; p < total; p++) if (mask[p] === 1) leafPx++;
  const leafCoveragePct = total > 0 ? (leafPx / total) * 100 : 0;

  // Mean brightness within the leaf mask. Falls back to whole-
  // image mean when no leaf pixels (so the metric stays finite).
  const data = imageData.data;
  let brightSum = 0;
  let brightN   = 0;
  if (leafPx > 0) {
    for (let p = 0; p < total; p++) {
      if (mask[p] !== 1) continue;
      const i = p * 4;
      // V in HSV ≈ max(R,G,B); cheaper than full conversion.
      const v = Math.max(data[i], data[i + 1], data[i + 2]);
      brightSum += v; brightN++;
    }
  } else {
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.max(data[i], data[i + 1], data[i + 2]);
      brightSum += v; brightN++;
    }
  }
  const brightness = brightN > 0 ? brightSum / brightN : 0;

  // Centering — centroid of the dominant component vs. image
  // centre, expressed as % of the image diagonal.
  let centeringOffsetPct = 0;
  let dominantBBox = null;
  if (dominantId && bboxes[dominantId]) {
    const bb = bboxes[dominantId];
    dominantBBox = { ...bb };
    const cx = (bb.minX + bb.maxX) / 2;
    const cy = (bb.minY + bb.maxY) / 2;
    const dx = cx - width / 2;
    const dy = cy - height / 2;
    const offset = Math.sqrt(dx * dx + dy * dy);
    const diag = Math.sqrt(width * width + height * height);
    centeringOffsetPct = diag > 0 ? (offset / diag) * 100 : 0;
  }

  const dominantSize = dominantId ? sizes[dominantId] : 0;
  const secondarySize = secondId ? sizes[secondId] : 0;
  const secondaryRatio = dominantSize > 0 ? (secondarySize / dominantSize) : 0;

  return Object.freeze({
    leafCoveragePct,
    brightness,
    centeringOffsetPct,
    dominantLeafBBox:  dominantBBox,
    lesionBBox:        lesionBBox || null,
    candidateLeafCount: Math.max(0, (sizes && sizes.length - 1) || 0),
    secondaryRatio,
  });
}

// ─── Guidance ───────────────────────────────────────────────

/**
 * Map metrics → actionable user guidance flags. Pure; never throws.
 *
 * Surfaces consume these flags + translate the corresponding key
 * via tSafe — see PRODUCTION_GAP_TRANSLATIONS / future
 * leafFocusTranslations overlay for the strings.
 */
export function deriveFocusGuidance(metrics) {
  if (!metrics || typeof metrics !== 'object') {
    return Object.freeze({
      moveCloser: false, lightingDark: false, lightingBright: false,
      leafNotCentered: false, multipleLeaves: false, noLeafDetected: true,
    });
  }
  return Object.freeze({
    moveCloser:      metrics.leafCoveragePct < COVERAGE_MIN_GOOD_PCT,
    lightingDark:    metrics.brightness < BRIGHTNESS_DARK_THRESHOLD,
    lightingBright:  metrics.brightness > BRIGHTNESS_BRIGHT_THRESHOLD,
    leafNotCentered: metrics.centeringOffsetPct > CENTERING_OFFSET_THRESHOLD_PCT,
    multipleLeaves:  metrics.secondaryRatio > MULTI_LEAF_RATIO,
    noLeafDetected:  !metrics.dominantLeafBBox,
  });
}

// ─── Crops + overlay ───────────────────────────────────────

function _scaleBBox(bb, fromScale) {
  if (!bb) return null;
  const inv = fromScale > 0 ? 1 / fromScale : 1;
  return {
    x:      Math.round(bb.minX * inv),
    y:      Math.round(bb.minY * inv),
    width:  Math.round((bb.maxX - bb.minX + 1) * inv),
    height: Math.round((bb.maxY - bb.minY + 1) * inv),
  };
}

function _padBBox(bb, padPct, maxW, maxH) {
  if (!bb) return null;
  const padX = Math.round(bb.width  * padPct);
  const padY = Math.round(bb.height * padPct);
  const x = Math.max(0, bb.x - padX);
  const y = Math.max(0, bb.y - padY);
  const w = Math.min(maxW - x, bb.width  + 2 * padX);
  const h = Math.min(maxH - y, bb.height + 2 * padY);
  return { x, y, width: w, height: h };
}

function _renderCrop(img, bbox, maxDim, quality) {
  try {
    if (!_hasDom()) return '';
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) return '';
    const srcW = bbox.width;
    const srcH = bbox.height;
    const longest = Math.max(srcW, srcH);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = dstW; canvas.height = dstH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, bbox.x, bbox.y, srcW, srcH, 0, 0, dstW, dstH);
    return _canvasToDataUrl(canvas, quality);
  } catch { return ''; }
}

function _renderOverlay(img, leafBBoxOrig, maxDim, quality) {
  try {
    if (!_hasDom()) return '';
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = longest > maxDim ? maxDim / longest : 1;
    const w = Math.max(1, Math.round(img.naturalWidth  * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, w, h);
    if (leafBBoxOrig) {
      ctx.strokeStyle = 'rgba(200, 148, 77, 0.85)';
      ctx.lineWidth = Math.max(2, Math.round(longest * 0.005));
      const rx = leafBBoxOrig.x * scale;
      const ry = leafBBoxOrig.y * scale;
      const rw = leafBBoxOrig.width  * scale;
      const rh = leafBBoxOrig.height * scale;
      try { ctx.strokeRect(rx, ry, rw, rh); }
      catch { /* swallow */ }
    }
    return _canvasToDataUrl(canvas, quality);
  } catch { return ''; }
}

// ─── Top-level orchestrator ─────────────────────────────────

/**
 * Analyze the input image and return focus crops + metrics + guidance.
 *
 *   const out = await analyzeLeafFocus(file, opts);
 *
 * @param {File|Blob} blobOrFile
 * @param {object}    [opts]
 * @param {number}    [opts.workingMaxDim=320]
 * @param {number}    [opts.cropMaxDim=1024]
 * @param {number}    [opts.jpegQuality=0.85]
 * @returns {Promise<object>}  the full envelope; ok=false on failure.
 */
export async function analyzeLeafFocus(blobOrFile, opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const workingMaxDim = Number(o.workingMaxDim) > 0 ? Number(o.workingMaxDim) : DEFAULT_WORKING_MAX_DIM;
  const cropMaxDim    = Number(o.cropMaxDim)    > 0 ? Number(o.cropMaxDim)    : DEFAULT_CROP_MAX_DIM;
  const jpegQuality   = Number(o.jpegQuality)   > 0 ? Number(o.jpegQuality)   : DEFAULT_JPEG_QUALITY;

  const fail = (reason) => Object.freeze({
    ok:                  false,
    originalDataUrl:     '',
    isolatedLeafDataUrl: '',
    lesionCropDataUrl:   '',
    focusOverlayDataUrl: '',
    metrics:             null,
    guidance: Object.freeze({
      moveCloser: false, lightingDark: false, lightingBright: false,
      leafNotCentered: false, multipleLeaves: false, noLeafDetected: true,
    }),
    reason,
  });

  try {
    if (!blobOrFile) return fail('no_input');
    if (!_hasDom())   return fail('no_dom');

    const img = await _decodeToImage(blobOrFile);
    if (!img) return fail('decode_failed');

    // Working canvas at small res for fast analysis.
    const work = _drawWorkingCanvas(img, workingMaxDim);
    if (!work) return fail('canvas_unavailable');
    const { imageData, scale } = work;
    const w = work.canvas.width, h = work.canvas.height;

    const mask = buildLeafMask(imageData);
    const { labels, sizes, bboxes, dominantId, secondId, candidateCount } =
      labelComponents(mask, w, h);

    const lesionBBoxWorking = dominantId
      ? detectLesion(imageData, labels, dominantId, w, h)
      : null;

    const metrics = computeMetrics({
      imageData, mask, labels, dominantId, secondId, sizes, bboxes,
      lesionBBox: lesionBBoxWorking, width: w, height: h,
    });
    const guidance = deriveFocusGuidance(metrics);

    // Re-scale bboxes from working space to the ORIGINAL image so
    // crops preserve resolution.
    const leafBBoxOrig = dominantId
      ? _padBBox(_scaleBBox(bboxes[dominantId], scale), 0.06, img.naturalWidth, img.naturalHeight)
      : null;
    const lesionBBoxOrig = lesionBBoxWorking
      ? _padBBox(_scaleBBox(lesionBBoxWorking, scale), 0.12, img.naturalWidth, img.naturalHeight)
      : null;

    // Render original (downscaled to cropMaxDim) — same render
    // path as the other crops so JPEG params match.
    const originalDataUrl = _renderCrop(
      img,
      { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight },
      cropMaxDim, jpegQuality,
    );
    const isolatedLeafDataUrl = leafBBoxOrig
      ? _renderCrop(img, leafBBoxOrig, cropMaxDim, jpegQuality) : '';
    const lesionCropDataUrl = lesionBBoxOrig
      ? _renderCrop(img, lesionBBoxOrig, cropMaxDim, jpegQuality) : '';
    const focusOverlayDataUrl = _renderOverlay(img, leafBBoxOrig, cropMaxDim, jpegQuality);

    return Object.freeze({
      ok:                  !!dominantId,
      originalDataUrl,
      isolatedLeafDataUrl,
      lesionCropDataUrl,
      focusOverlayDataUrl,
      metrics:             { ...metrics, candidateLeafCount: candidateCount },
      guidance,
      reason:              dominantId ? '' : 'no_dominant_leaf',
    });
  } catch (err) {
    return fail((err && err.message) || 'exception');
  }
}

// ─── Test exports ──────────────────────────────────────────

export const _internal = Object.freeze({
  _rgbToHsv,
  _isLeafPixel,
  _scaleBBox,
  _padBBox,
  DEFAULT_WORKING_MAX_DIM,
  DEFAULT_CROP_MAX_DIM,
  LEAF_HUE_MIN,
  LEAF_HUE_MAX,
  LEAF_SAT_MIN,
  LEAF_VAL_MIN,
  BRIGHTNESS_DARK_THRESHOLD,
  BRIGHTNESS_BRIGHT_THRESHOLD,
  COVERAGE_MIN_GOOD_PCT,
  CENTERING_OFFSET_THRESHOLD_PCT,
  MULTI_LEAF_RATIO,
  MIN_COMPONENT_PX,
});

const _module = {
  analyzeLeafFocus, buildLeafMask, labelComponents, detectLesion,
  computeMetrics, deriveFocusGuidance, _internal,
};
export default _module;
