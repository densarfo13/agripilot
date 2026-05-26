/**
 * validateScanImage.js — hard image-validation rules. Returns a
 * structured verdict the pipeline branches on. NEVER throws.
 *
 *   import { validateScanImage, assertValidScanInput, INVALID_REASON }
 *     from 'src/core/scan/validateScanImage.js';
 *
 *   const v = validateScanImage(imageRecord);
 *   if (!v.valid) { transitionTo(SCAN_STATE.FAILED); return; }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The single truth source the scan pipeline calls BEFORE every
 *   downstream step (persist / analyze / journal / followup).
 *   An image that fails here ENDS the pipeline — no classifier
 *   run, no diagnosis envelope, no journal write.
 *
 *   It is NOT a classifier, NOT a fixer (we don't try to repair
 *   a bad image), and NOT a network call.
 *
 *   Validation rules:
 *     • Record exists and is an object
 *     • Has at least ONE survival channel: objectUrl OR
 *       dataUrlBackup OR file
 *     • Size > 0 (we have actual bytes)
 *     • MIME in the allowlist: jpeg / png / webp / heic / heif
 *     • Width × height > 0 when dimensions were extracted (still
 *       valid if unread — some flows don't measure)
 *     • objectUrl, if present, must look like a blob: / data: URL
 *       (defends against revoked or empty strings)
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Default-fail: an unrecognised shape returns invalid.
 */

export const INVALID_REASON = Object.freeze({
  NO_RECORD:        'no_record',
  NOT_OBJECT:       'not_object',
  NO_SURVIVAL_CHANNEL: 'no_survival_channel',
  EMPTY_BYTES:      'empty_bytes',
  UNSUPPORTED_MIME: 'unsupported_mime',
  REVOKED_URL:      'revoked_url',
  BAD_DIMENSIONS:   'bad_dimensions',
  TOO_LARGE:        'too_large',
});

// Spec V5 §12 — hard upper limit; iPhone HEIC originals can hit
// ~6 MB before we re-encode, so 12 MB gives a healthy margin.
export const MAX_VALIDATION_BYTES = 12_000_000;

// User-facing hints keyed by reason. Surfaces use these as fallback
// copy when no localized translation is available. The strings
// stay deliberately concrete — "Photo could not be loaded" was
// removed from the bag because it was too generic to be actionable.
export const FRIENDLY_HINTS = Object.freeze({
  no_record:           'No photo selected yet. Tap the camera to capture or upload one.',
  not_object:          'That photo couldn’t be read. Try a different one.',
  no_survival_channel: 'We lost the photo before we could analyze it. Please retake the photo.',
  empty_bytes:         'That photo file is empty. Please retake the photo.',
  unsupported_mime:    'Use a JPEG, PNG, WebP, or HEIC photo.',
  revoked_url:         'The photo preview expired. Please retake the photo.',
  bad_dimensions:      'That photo has an invalid size. Please retake.',
  too_large:           'That photo is too large. Try a smaller one (under 12 MB).',
});

/**
 * Map a validate-result `reason` to an actionable user hint. Returns
 * a fallback string when the reason is unknown. Strings here are
 * fallbacks ONLY — surfaces should prefer the matching `scan.error.*`
 * translation key when available.
 */
export function friendlyHintFor(reason) {
  if (typeof reason !== 'string') return FRIENDLY_HINTS.not_object;
  return FRIENDLY_HINTS[reason] || FRIENDLY_HINTS.not_object;
}

const _ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/heic', 'image/heif',
]);

function _looksLikeBlobOrData(url) {
  if (typeof url !== 'string' || !url) return false;
  return url.startsWith('blob:') || url.startsWith('data:image/');
}

/**
 * @param {object} record  — typically a stableScanImageStore record
 * @returns {{
 *   valid: boolean,
 *   reason?: string,
 *   dimensions?: { width:number, height:number }|null,
 *   size?: number,
 *   mime?: string,
 * }}
 */
export function validateScanImage(record) {
  try {
    if (record == null) {
      return { valid: false, reason: INVALID_REASON.NO_RECORD };
    }
    if (typeof record !== 'object') {
      return { valid: false, reason: INVALID_REASON.NOT_OBJECT };
    }
    const hasObjectUrl    = !!record.objectUrl;
    const hasDataUrl      = !!record.dataUrlBackup || !!record.dataUrl;
    const hasFile         = !!record.file;
    if (!hasObjectUrl && !hasDataUrl && !hasFile) {
      return { valid: false, reason: INVALID_REASON.NO_SURVIVAL_CHANNEL };
    }
    const size = Number(record.size) || 0;
    if (size <= 0 && !hasFile) {
      return { valid: false, reason: INVALID_REASON.EMPTY_BYTES };
    }
    if (size > MAX_VALIDATION_BYTES) {
      return { valid: false, reason: INVALID_REASON.TOO_LARGE, size };
    }
    const mime = String(record.mimeType || record.type || '').toLowerCase();
    if (mime && !_ALLOWED_MIMES.has(mime)) {
      return { valid: false, reason: INVALID_REASON.UNSUPPORTED_MIME, mime };
    }
    if (hasObjectUrl && !_looksLikeBlobOrData(record.objectUrl)) {
      return { valid: false, reason: INVALID_REASON.REVOKED_URL };
    }
    if (hasDataUrl) {
      const d = record.dataUrlBackup || record.dataUrl;
      if (!_looksLikeBlobOrData(d) && typeof d === 'string' && d.length === 0) {
        return { valid: false, reason: INVALID_REASON.REVOKED_URL };
      }
    }
    const width  = Number(record.width)  || 0;
    const height = Number(record.height) || 0;
    if ((width > 0) !== (height > 0)) {
      return { valid: false, reason: INVALID_REASON.BAD_DIMENSIONS };
    }
    return {
      valid:      true,
      dimensions: (width > 0 && height > 0) ? { width, height } : null,
      size,
      mime,
    };
  } catch {
    return { valid: false, reason: INVALID_REASON.NOT_OBJECT };
  }
}

/**
 * Hard guard — the call surfaces should make BEFORE the classifier.
 * Returns the verdict. The classifier runner is responsible for
 * checking `verdict.valid` and short-circuiting on false. We do not
 * throw because every part of the scan pipeline needs to never
 * raise (one throw would leave the UI in a stuck-spinner state).
 *
 * @param {object} record
 * @returns {object}  same shape as validateScanImage
 */
export function assertValidScanInput(record) {
  return validateScanImage(record);
}

const _module = {
  INVALID_REASON, MAX_VALIDATION_BYTES, FRIENDLY_HINTS,
  validateScanImage, assertValidScanInput, friendlyHintFor,
};
export default _module;
