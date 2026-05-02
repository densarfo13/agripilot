/**
 * preprocessImage.js — pre-inference image validation + sizing.
 *
 * Spec §4: every uploaded image must be validated, optionally
 * resized + compressed, and stripped of EXIF metadata BEFORE the
 * inference layer sees it. This module is the single source of
 * truth for "is this image safe to forward to ML".
 *
 *   import { preprocessImage } from './preprocessImage.js';
 *   const { ok, reason, image, mime, bytes } =
 *     await preprocessImage({ base64, url, file });
 *
 * Strict rules
 *   * Never throws — every error path returns
 *     `{ ok: false, reason: 'short_code' }` so the inference
 *     pipeline can branch without try/catch.
 *   * Hard caps: 8 MB raw / 10 MB base64. Reject anything
 *     larger to keep the queue + provider costs bounded.
 *   * Accepted MIME: image/jpeg, image/png, image/webp.
 *     Anything else → reject. Heuristic-detected via the magic
 *     bytes header (sniff first 12 bytes) so we don't trust
 *     client-supplied content-type alone.
 *   * EXIF stripping is best-effort: when the optional `sharp`
 *     dependency is available the image is re-encoded to a
 *     clean JPEG; otherwise we pass the raw buffer through
 *     and flag `metadataStripped: false` so callers know.
 *
 * Loaded lazily so the build never requires `sharp` to be
 * installed. Production teams that want EXIF stripping +
 * resize should run `npm install sharp` in the server tree.
 */

const MAX_RAW_BYTES    = 8  * 1024 * 1024;   // 8 MB raw
const MAX_BASE64_BYTES = 10 * 1024 * 1024;   // 10 MB base64 string
const TARGET_MAX_DIM   = 1280;               // resize beyond this
const TARGET_QUALITY   = 80;                 // JPEG quality

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Magic-byte sniffer — checks the first few bytes of the buffer
// against known image signatures. Returns null when no match.
function _sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  const b = buf;
  // JPEG: FF D8 FF
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return 'image/png';
  // WebP: RIFF....WEBP
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
   && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

function _bufferFromBase64(b64) {
  if (typeof b64 !== 'string' || !b64) return null;
  // Allow the data-URL prefix the browser canvas helper uses.
  const stripped = b64.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');
  try { return Buffer.from(stripped, 'base64'); }
  catch { return null; }
}

/**
 * preprocessImage(input) → { ok, image?, mime?, bytes?, reason?, metadataStripped? }
 *
 * input shape (any one of):
 *   { base64 }            — base64 or data-URL string
 *   { url }               — http(s) URL fetched server-side
 *   { buffer, mime? }     — raw Buffer
 */
export async function preprocessImage(input = {}) {
  let buf = null;

  // 1. Resolve to a Buffer.
  if (input.buffer && Buffer.isBuffer(input.buffer)) {
    buf = input.buffer;
  } else if (typeof input.base64 === 'string' && input.base64) {
    if (input.base64.length > MAX_BASE64_BYTES) {
      return { ok: false, reason: 'too_large_base64' };
    }
    buf = _bufferFromBase64(input.base64);
    if (!buf) return { ok: false, reason: 'invalid_base64' };
  } else if (typeof input.url === 'string' && /^https?:\/\//.test(input.url)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(input.url, { signal: ctrl.signal });
      clearTimeout(t);
      if (!res || !res.ok) return { ok: false, reason: 'fetch_failed' };
      const ab = await res.arrayBuffer();
      buf = Buffer.from(ab);
    } catch { return { ok: false, reason: 'fetch_error' }; }
  } else {
    return { ok: false, reason: 'no_image' };
  }

  // 2. Hard size cap.
  if (!buf || buf.length === 0) return { ok: false, reason: 'empty_image' };
  if (buf.length > MAX_RAW_BYTES) return { ok: false, reason: 'too_large' };

  // 3. Magic-byte MIME sniff (don't trust client content-type).
  const mime = _sniffMime(buf);
  if (!mime || !ALLOWED_MIME.has(mime)) {
    return { ok: false, reason: 'unsupported_mime' };
  }

  // 4. Optional EXIF strip + resize via `sharp` if installed.
  //    The team can `npm install sharp` in the server tree to
  //    activate this path; without it the raw buffer flows
  //    through and metadataStripped is false.
  let processed = buf;
  let metadataStripped = false;
  let outMime = mime;
  try {
    const sharpMod = await import('sharp').catch(() => null);
    if (sharpMod && sharpMod.default) {
      const sharp = sharpMod.default;
      processed = await sharp(buf)
        .rotate()
        .resize({ width: TARGET_MAX_DIM, height: TARGET_MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: TARGET_QUALITY, mozjpeg: true })
        .withMetadata({ exif: {}, icc: undefined, iptc: undefined, xmp: undefined })
        .toBuffer();
      outMime = 'image/jpeg';
      metadataStripped = true;
    }
  } catch { /* swallow — fall through to raw buffer */ }

  return {
    ok:    true,
    image: processed,
    mime:  outMime,
    bytes: processed.length,
    metadataStripped,
  };
}

export const _internal = Object.freeze({
  MAX_RAW_BYTES, MAX_BASE64_BYTES, TARGET_MAX_DIM, TARGET_QUALITY, ALLOWED_MIME,
  _sniffMime, _bufferFromBase64,
});

export default preprocessImage;
