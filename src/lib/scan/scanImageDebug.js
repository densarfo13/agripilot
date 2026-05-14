/**
 * scanImageDebug — small inspector that summarises an image
 * payload (size, MIME, encoding, dimension) before + after
 * compression so the diagnostics panel + the [SCAN_IMAGE_READY]
 * log line can describe the actual file without printing its
 * bytes.
 *
 *   import { describeImage, describeCompression, isOversized }
 *     from '../lib/scan/scanImageDebug.js';
 *
 *   const beforeSummary = describeImage(file);
 *   //   { size, mime, encoding, looksHeic }
 *
 *   const after = describeCompression({
 *     original: { size: 4_200_000, mime: 'image/jpeg' },
 *     compressed: { size: 1_900_000, mime: 'image/jpeg' },
 *   });
 *   //   { ratio: 0.45, original, compressed }
 *
 *   if (isOversized(beforeSummary, { maxBytes: 8_000_000 })) {
 *     // reject with a calm prompt
 *   }
 *
 * Why this exists
 *   Hard Scan Pipeline Debug Mode §5 calls for an image debug
 *   log line + a "reject oversized images gracefully" path.
 *   This module does the inspection without ever loading the
 *   image bytes into the log — only the safe summary fields
 *   (size, mime, an HEIC heuristic) reach the diagnostics
 *   surface.
 *
 * Strict-rule audit
 *   * Pure, never throws, SSR-safe.
 *   * Accepts File, Blob, base64 data URLs, or a plain
 *     { size, mime } literal.
 *   * Never logs / persists the image bytes.
 */

const _BASE64_PREFIX = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?(;[^,]*)?,/i;

function _isFile(v) {
  try {
    return typeof File !== 'undefined' && v instanceof File;
  } catch { return false; }
}
function _isBlob(v) {
  try {
    return typeof Blob !== 'undefined' && v instanceof Blob;
  } catch { return false; }
}

function _heicHeuristic({ mime, name }) {
  const m = typeof mime === 'string' ? mime.toLowerCase() : '';
  const n = typeof name === 'string' ? name.toLowerCase() : '';
  if (m.includes('heic') || m.includes('heif')) return true;
  if (n.endsWith('.heic') || n.endsWith('.heif')) return true;
  return false;
}

function _base64ByteLength(dataUrl) {
  try {
    if (typeof dataUrl !== 'string') return 0;
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) return 0;
    const b64 = dataUrl.slice(commaIdx + 1);
    // Each 4 chars of base64 encode 3 bytes; "=" pads the last group.
    const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
  } catch { return 0; }
}

function _mimeFromDataUrl(dataUrl) {
  try {
    if (typeof dataUrl !== 'string') return null;
    const match = dataUrl.match(_BASE64_PREFIX);
    return match && match[1] ? match[1] : null;
  } catch { return null; }
}

/**
 * Describe an image payload for the diagnostics surface. Returns
 * the same shape regardless of whether the caller passed a File,
 * a Blob, a base64 data URL, or a literal { size, mime }.
 *
 * @param {File|Blob|string|object} input
 * @returns {{ size: number, mime: string|null, encoding: 'binary'|'base64'|'unknown',
 *             looksHeic: boolean, name: string|null }}
 */
export function describeImage(input) {
  try {
    if (input == null) return _emptyDescription();
    if (_isFile(input)) {
      return Object.freeze({
        size:      Number.isFinite(input.size) ? input.size : 0,
        mime:      input.type || null,
        encoding:  'binary',
        looksHeic: _heicHeuristic({ mime: input.type, name: input.name }),
        name:      input.name || null,
      });
    }
    if (_isBlob(input)) {
      return Object.freeze({
        size:      Number.isFinite(input.size) ? input.size : 0,
        mime:      input.type || null,
        encoding:  'binary',
        looksHeic: _heicHeuristic({ mime: input.type }),
        name:      null,
      });
    }
    if (typeof input === 'string' && input.startsWith('data:')) {
      const mime = _mimeFromDataUrl(input);
      return Object.freeze({
        size:      _base64ByteLength(input),
        mime,
        encoding:  'base64',
        looksHeic: _heicHeuristic({ mime: mime || '' }),
        name:      null,
      });
    }
    if (typeof input === 'object') {
      return Object.freeze({
        size:      Number.isFinite(input.size) ? input.size : 0,
        mime:      typeof input.mime === 'string' ? input.mime : (typeof input.type === 'string' ? input.type : null),
        encoding:  typeof input.encoding === 'string' ? input.encoding : 'unknown',
        looksHeic: _heicHeuristic({
          mime: input.mime || input.type || '',
          name: input.name || '',
        }),
        name:      typeof input.name === 'string' ? input.name : null,
      });
    }
    return _emptyDescription();
  } catch { return _emptyDescription(); }
}

function _emptyDescription() {
  return Object.freeze({
    size: 0, mime: null, encoding: 'unknown', looksHeic: false, name: null,
  });
}

/**
 * Summarise a compression result. Both halves are described
 * independently + the ratio is computed.
 *
 * @param {object} input
 * @param {*} input.original
 * @param {*} input.compressed
 * @returns {{ original, compressed, ratio: number|null }}
 */
export function describeCompression(input) {
  try {
    const safe = (input && typeof input === 'object') ? input : {};
    const o = describeImage(safe.original);
    const c = describeImage(safe.compressed);
    const ratio = (o.size > 0 && c.size > 0)
                    ? Math.round((c.size / o.size) * 100) / 100
                    : null;
    return Object.freeze({ original: o, compressed: c, ratio });
  } catch {
    return Object.freeze({ original: _emptyDescription(), compressed: _emptyDescription(), ratio: null });
  }
}

/**
 * Spec §5 — reject oversized images gracefully. Defaults to an
 * 8MB ceiling for the RAW input (before compression). The
 * compressed payload check is left to the caller's own ceiling.
 *
 * @param {object} description  result of describeImage()
 * @param {object} [opts]
 * @param {number} [opts.maxBytes]
 * @returns {boolean}
 */
export function isOversized(description, opts) {
  try {
    if (!description || !Number.isFinite(description.size)) return false;
    const max = (opts && Number.isFinite(opts.maxBytes)) ? opts.maxBytes : 8_000_000;
    return description.size > max;
  } catch { return false; }
}

const _module = {
  describeImage,
  describeCompression,
  isOversized,
};
export default _module;
