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
});

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

const _module = { INVALID_REASON, validateScanImage, assertValidScanInput };
export default _module;
