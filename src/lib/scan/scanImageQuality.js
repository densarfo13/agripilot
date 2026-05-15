/**
 * scanImageQuality — pre-upload heuristic analyzer.
 *
 *   import { analyzeImageQuality, buildQualityGuidance,
 *            classifyByQualityIssues } from
 *     '../lib/scan/scanImageQuality.js';
 *
 *   const report = await analyzeImageQuality(file);
 *   //   { score: 'good'|'fair'|'poor'|'unknown',
 *   //     issues: ['too_dark', 'blurry'],
 *   //     guidance: ['Move closer...', 'Take photo in daylight.'],
 *   //     metrics: { brightness, blurVariance, ... } }
 *
 *   if (report.score === 'poor') {
 *     // skip upload, show guidance, let user retry
 *   }
 *
 * Why a pre-upload check
 *   Half the "low confidence" results we surface are caused by
 *   the photo itself — too dark, too blurry, framed wrong. Running
 *   the inference on a poor photo wastes the user's time + leaves
 *   them with a vague "couldn't tell" answer. Catching the photo
 *   quality BEFORE the upload lets us nudge:
 *     "Move closer to the leaf."
 *     "Take photo in daylight."
 *     "Avoid shadows."
 *     "Fill more of the frame with the affected area."
 *
 * What "good / fair / poor" means
 *   good       - no quality issues detected; safe to upload
 *   fair       - one minor issue; user can proceed with a warning
 *   poor       - >=2 issues OR severe issue; recommend retake
 *   unknown    - SSR / no canvas / unsupported source — proceed
 *                without blocking the user
 *
 * Issue catalog (spec §3 + §5 wording):
 *   too_dark           - brightness < 0.30
 *   too_bright         - brightness > 0.95 (washed out)
 *   blurry             - Laplacian variance < 60
 *   too_small          - dimension < 600px on the long edge
 *   tiny_payload       - file < 30KB (almost certainly bad)
 *   multiple_leaves    - heuristic: dimension high but blur+brightness
 *                        both indicate framing too wide (cannot
 *                        actually detect leaves in pure JS; we
 *                        surface this as a guidance hint only)
 *   shadow_detected    - high contrast variance + low brightness
 *
 * Strict-rule audit
 *   * SSR-safe — returns score:'unknown' when no canvas / no
 *     ImageBitmap support. Never throws.
 *   * Async because canvas decoding is async. Always resolves.
 *   * No PII / image bytes / network. Output is only the small
 *     numeric metric bundle + the categorical envelope.
 */

export const QUALITY_SCORES = Object.freeze({
  GOOD:    'good',
  FAIR:    'fair',
  POOR:    'poor',
  UNKNOWN: 'unknown',
});

export const QUALITY_ISSUES = Object.freeze({
  TOO_DARK:        'too_dark',
  TOO_BRIGHT:      'too_bright',
  BLURRY:          'blurry',
  TOO_SMALL:       'too_small',
  TINY_PAYLOAD:    'tiny_payload',
  MULTIPLE_LEAVES: 'multiple_leaves',
  SHADOW_DETECTED: 'shadow_detected',
});

const _GUIDANCE_COPY = Object.freeze({
  too_dark:        'Take photo in daylight or move to a brighter spot.',
  too_bright:      'Move to softer light — direct sun is washing out the photo.',
  blurry:          'Hold steady and tap to focus before capturing.',
  too_small:       'Move closer to the leaf so it fills more of the frame.',
  tiny_payload:    'Photo is too small to analyze — retake at full quality.',
  multiple_leaves: 'Frame ONE leaf at a time so we can see the issue clearly.',
  shadow_detected: 'Move out of harsh shadows — try open shade.',
});

const _TINY_PAYLOAD_BYTES   = 30 * 1024;          // 30KB
const _SMALL_DIMENSION_PX   = 600;                // long edge threshold
const _DARK_BRIGHTNESS      = 0.30;
const _BRIGHT_BRIGHTNESS    = 0.95;
const _BLUR_VARIANCE_FLOOR  = 60;                  // Laplacian variance
const _SHADOW_CONTRAST_HIGH = 0.55;                // stddev / max
const _SAMPLE_DIM           = 96;                  // canvas sample size

function _hasCanvas() {
  try {
    return typeof document !== 'undefined'
        && typeof document.createElement === 'function'
        && typeof Image !== 'undefined';
  } catch { return false; }
}

function _hasImageBitmap() {
  try {
    return typeof createImageBitmap === 'function';
  } catch { return false; }
}

function _emptyReport(issues) {
  const safeIssues = Array.isArray(issues) ? issues : [];
  return Object.freeze({
    score:    safeIssues.length === 0 ? QUALITY_SCORES.UNKNOWN
              : safeIssues.length >= 2 ? QUALITY_SCORES.POOR
              : QUALITY_SCORES.FAIR,
    issues:   Object.freeze(safeIssues),
    guidance: Object.freeze(safeIssues.map((i) => _GUIDANCE_COPY[i]).filter(Boolean)),
    metrics:  Object.freeze({
      brightness:    null,
      blurVariance:  null,
      contrast:      null,
      width:         null,
      height:        null,
    }),
  });
}

function _safeNum(v) { return Number.isFinite(v) ? v : null; }

async function _loadImageElement(source) {
  // Prefer createImageBitmap when available — it works on Files,
  // Blobs, and HTMLImageElements without going through the DOM
  // image-load roundtrip.
  if (_hasImageBitmap() && (source instanceof Blob || source instanceof File)) {
    try { return await createImageBitmap(source); } catch { /* fall through */ }
  }
  if (!_hasCanvas()) return null;
  // Fall back to <img src=objectURL>.
  return new Promise((resolve) => {
    try {
      let url;
      try { url = (source instanceof Blob || source instanceof File)
                    ? URL.createObjectURL(source)
                    : null; } catch { url = null; }
      if (!url && typeof source === 'string') url = source;
      if (!url) { resolve(null); return; }
      const img = new Image();
      img.onload  = () => { try { URL.revokeObjectURL(url); } catch { /* swallow */ } resolve(img); };
      img.onerror = () => { try { URL.revokeObjectURL(url); } catch { /* swallow */ } resolve(null); };
      img.src = url;
    } catch { resolve(null); }
  });
}

function _samplePixels(img) {
  try {
    if (!_hasCanvas()) return null;
    const c = document.createElement('canvas');
    c.width  = _SAMPLE_DIM;
    c.height = _SAMPLE_DIM;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, _SAMPLE_DIM, _SAMPLE_DIM);
    const data = ctx.getImageData(0, 0, _SAMPLE_DIM, _SAMPLE_DIM).data;
    // Compute mean luminance + Laplacian variance for blur.
    let lumSum = 0;
    let lumSqSum = 0;
    const lum = new Float32Array(_SAMPLE_DIM * _SAMPLE_DIM);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      lum[j] = l;
      lumSum += l;
      lumSqSum += l * l;
    }
    const N = lum.length;
    const meanLum = lumSum / N;
    const lumVariance = (lumSqSum / N) - (meanLum * meanLum);
    // Cheap Laplacian: |center - average(neighbors)|
    let lapSum = 0;
    let lapSqSum = 0;
    let lapN = 0;
    for (let y = 1; y < _SAMPLE_DIM - 1; y += 1) {
      for (let x = 1; x < _SAMPLE_DIM - 1; x += 1) {
        const i = y * _SAMPLE_DIM + x;
        const v = (4 * lum[i])
                  - lum[i - 1] - lum[i + 1]
                  - lum[i - _SAMPLE_DIM] - lum[i + _SAMPLE_DIM];
        lapSum += v;
        lapSqSum += v * v;
        lapN += 1;
      }
    }
    const lapMean = lapSum / lapN;
    const lapVariance = (lapSqSum / lapN) - (lapMean * lapMean);
    // Map variance -> a 0..255-ish blur score so the threshold
    // numbers above feel readable.
    const blurScore = lapVariance * 65025; // (255 * 255) scale
    return {
      brightness:   meanLum,
      blurVariance: blurScore,
      contrast:     Math.sqrt(lumVariance),
    };
  } catch { return null; }
}

/**
 * Analyze the image quality before upload. Returns a frozen
 * envelope with score / issues / guidance / metrics. Always
 * resolves (never rejects).
 *
 * @param {File|Blob|HTMLImageElement|string} source
 * @param {object} [opts]
 * @param {number} [opts.fileSize]   used as a cheap fast-path
 *                                    when caller already knows
 *                                    the byte size
 * @returns {Promise<object>}
 */
export async function analyzeImageQuality(source, opts) {
  try {
    const issues = [];
    const fileSize = (opts && Number.isFinite(opts.fileSize))
                      ? opts.fileSize
                      : (source && Number.isFinite(source.size) ? source.size : null);
    if (Number.isFinite(fileSize) && fileSize < _TINY_PAYLOAD_BYTES) {
      issues.push(QUALITY_ISSUES.TINY_PAYLOAD);
    }

    // Without a canvas (SSR / Node tests), we can still ship the
    // tiny-payload check above. Everything else falls back to
    // UNKNOWN so the FSM doesn't block the upload.
    if (!_hasCanvas() && !_hasImageBitmap()) {
      return _emptyReport(issues);
    }

    const img = await _loadImageElement(source);
    if (!img) return _emptyReport(issues);

    const width  = _safeNum(img.width  || img.naturalWidth);
    const height = _safeNum(img.height || img.naturalHeight);
    const longEdge = Math.max(width || 0, height || 0);
    if (longEdge > 0 && longEdge < _SMALL_DIMENSION_PX) {
      issues.push(QUALITY_ISSUES.TOO_SMALL);
    }

    const px = _samplePixels(img);
    if (!px) {
      // Decoded but couldn't sample — partial report.
      return Object.freeze({
        score:    issues.length >= 2 ? QUALITY_SCORES.POOR
                  : issues.length === 1 ? QUALITY_SCORES.FAIR
                  : QUALITY_SCORES.UNKNOWN,
        issues:   Object.freeze(issues),
        guidance: Object.freeze(issues.map((i) => _GUIDANCE_COPY[i]).filter(Boolean)),
        metrics:  Object.freeze({
          brightness:    null,
          blurVariance:  null,
          contrast:      null,
          width,
          height,
        }),
      });
    }

    if (px.brightness < _DARK_BRIGHTNESS)   issues.push(QUALITY_ISSUES.TOO_DARK);
    if (px.brightness > _BRIGHT_BRIGHTNESS) issues.push(QUALITY_ISSUES.TOO_BRIGHT);
    if (px.blurVariance < _BLUR_VARIANCE_FLOOR) issues.push(QUALITY_ISSUES.BLURRY);
    // Shadow heuristic — dark mean + high contrast variance
    // suggests harsh shadows across the frame.
    if (px.brightness < 0.45 && (px.contrast / Math.max(0.01, px.brightness)) > _SHADOW_CONTRAST_HIGH) {
      issues.push(QUALITY_ISSUES.SHADOW_DETECTED);
    }

    // Categorical score.
    let score;
    if (issues.length === 0)      score = QUALITY_SCORES.GOOD;
    else if (issues.length === 1) score = QUALITY_SCORES.FAIR;
    else                          score = QUALITY_SCORES.POOR;

    return Object.freeze({
      score,
      issues:   Object.freeze(issues),
      guidance: Object.freeze(issues.map((i) => _GUIDANCE_COPY[i]).filter(Boolean)),
      metrics:  Object.freeze({
        brightness:    _safeNum(px.brightness),
        blurVariance:  _safeNum(px.blurVariance),
        contrast:      _safeNum(px.contrast),
        width,
        height,
      }),
    });
  } catch {
    return _emptyReport([]);
  }
}

/**
 * Build a single low-literacy guidance sentence from a quality
 * report. Surfaces the top issue first so the user gets ONE
 * clear instruction instead of a list.
 */
export function buildQualityGuidance(report) {
  try {
    if (!report || report.issues.length === 0) return null;
    return report.guidance[0] || null;
  } catch { return null; }
}

/**
 * Translate quality issues into the scan-confidence ladder so
 * a poor-quality photo automatically downgrades the result
 * confidence even if the analyzer reported "high".
 *
 * @param {string} apiConfidence   'high' | 'medium' | 'low' | etc.
 * @param {object} qualityReport   analyzeImageQuality output
 * @returns {string}               'High' | 'Moderate' | 'Low' | 'Needs review'
 */
export function classifyByQualityIssues(apiConfidence, qualityReport) {
  const c = String(apiConfidence || '').toLowerCase();
  const baseLabel =
    c === 'high'   ? 'High' :
    c === 'medium' ? 'Moderate' :
    c === 'low'    ? 'Low' :
                     'Needs review';
  if (!qualityReport || !qualityReport.issues) return baseLabel;
  const issueCount = qualityReport.issues.length;
  if (issueCount === 0)  return baseLabel;
  if (issueCount === 1)  {
    if (baseLabel === 'High') return 'Moderate';
    return baseLabel;
  }
  // 2+ issues — never claim High; downgrade to Low or NeedsReview.
  if (baseLabel === 'High')      return 'Low';
  if (baseLabel === 'Moderate')  return 'Low';
  return 'Needs review';
}

const _module = {
  QUALITY_SCORES,
  QUALITY_ISSUES,
  analyzeImageQuality,
  buildQualityGuidance,
  classifyByQualityIssues,
};
export default _module;
