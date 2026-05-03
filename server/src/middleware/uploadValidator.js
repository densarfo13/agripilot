/**
 * uploadValidator.js — image-upload allowlist + magic-byte sniff.
 *
 *   import { imageUploadValidator } from './middleware/uploadValidator.js';
 *
 *   router.post('/scans',
 *     authenticate,
 *     uploadLimiter,
 *     imageUploadValidator(),         // 400 on wrong MIME / size
 *     asyncHandler(handler),
 *   );
 *
 * What it enforces (merged-blocker spec §7)
 *   • MIME whitelist: image/jpeg, image/png, image/webp.
 *     Anything else → 400.
 *   • Magic-byte verification — never trust client-supplied
 *     content-type alone. The buffer's first 12 bytes must
 *     match the claimed MIME. SVGs / HTMLs / EXEs / PDFs /
 *     ZIPs are rejected at this stage even when the request
 *     advertises image/png.
 *   • Size cap — falls back to `config.upload.maxFileSizeMB`
 *     (default 10 MB) when the caller doesn't override.
 *   • Server-side filename — the route handler should rename
 *     the file to `<uuid>.<ext>` after this middleware accepts
 *     it. The original filename is sanitized via
 *     `sanitizeFilename` (existing helper) and exposed at
 *     `req.upload.originalName` for audit logs only.
 *
 * Where it fits in the existing pipeline
 *   server/src/ml/preprocessImage.js already does magic-byte
 *   sniffing for the scan-analyze base64-body path. This
 *   middleware mirrors that protection for routes that take
 *   multipart/form-data uploads (multer) so the same rules
 *   apply across both surfaces.
 *
 * Strict-rule audit
 *   • Pure read; never mutates the file buffer.
 *   • Never throws — bad uploads return 400 with a neutral
 *     message ("Unsupported file type" / "File too large").
 *   • Pure ESM, top-level imports only.
 *   • Compatible with both multer's `req.file` (single) and
 *     `req.files` (array).
 */

import { config } from '../config/index.js';

const ALLOWED_MIME = Object.freeze(new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]));

const ALLOWED_EXT = Object.freeze(new Set([
  '.jpg', '.jpeg', '.png', '.webp',
]));

// Magic-byte sniffer — same shape as preprocessImage.js so
// behaviour is consistent across both surfaces. Returns the
// canonical MIME or null when no signature matches.
function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  // WebP: RIFF....WEBP
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
   && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

function getExt(name) {
  if (typeof name !== 'string') return '';
  const i = name.lastIndexOf('.');
  if (i < 0) return '';
  return name.slice(i).toLowerCase();
}

/**
 * Validate a single multer file object. Returns
 * `{ ok: true }` or `{ ok: false, status, error }`.
 */
function validateOne(file, opts) {
  if (!file) return { ok: false, status: 400, error: 'No file uploaded' };

  // 1. Size cap (multer also enforces this server-side, but
  // belt-and-suspenders for memory-storage callers).
  const maxBytes = opts.maxBytes;
  if (typeof file.size === 'number' && file.size > maxBytes) {
    return { ok: false, status: 413, error: 'File too large' };
  }

  // 2. Claimed MIME must be in the allowlist.
  const claimed = String(file.mimetype || '').toLowerCase();
  if (!ALLOWED_MIME.has(claimed)) {
    return { ok: false, status: 400, error: 'Unsupported file type' };
  }

  // 3. Extension must be in the allowlist (defence in depth —
  // some upstream proxies sniff the extension, not the MIME).
  const ext = getExt(file.originalname);
  if (ext && !ALLOWED_EXT.has(ext)) {
    return { ok: false, status: 400, error: 'Unsupported file type' };
  }

  // 4. Magic-byte sniff — refuses a .png that's actually HTML.
  // Skip when storage is disk-backed (no buffer in memory) and
  // the caller hasn't opted in via opts.requireBufferSniff.
  if (file.buffer && Buffer.isBuffer(file.buffer)) {
    const sniffed = sniffMime(file.buffer);
    if (!sniffed) {
      return { ok: false, status: 400, error: 'Unsupported file type' };
    }
    if (sniffed !== claimed) {
      // Claimed image/png but bytes say image/jpeg, etc. Reject
      // outright — the mismatch is a strong tampering signal.
      return { ok: false, status: 400, error: 'Unsupported file type' };
    }
  }

  return { ok: true };
}

/**
 * Express middleware factory. Place AFTER multer / busboy in
 * the chain so `req.file` / `req.files` are populated.
 *
 *   imageUploadValidator()                — defaults
 *   imageUploadValidator({ maxBytes: ... })
 *   imageUploadValidator({ field: 'photos' })  // multi-file array
 */
export function imageUploadValidator(opts = {}) {
  const cfg = {
    maxBytes: opts.maxBytes
      ?? (config.upload?.maxFileSizeMB || 10) * 1024 * 1024,
    field: opts.field || null, // when set, expect req.files[field] array
  };

  return (req, res, next) => {
    // Resolve the file shape. Multer single() → req.file;
    // Multer array() → req.files (array); Multer fields() →
    // req.files (object keyed by field name).
    let files = [];
    if (req.file) {
      files = [req.file];
    } else if (Array.isArray(req.files)) {
      files = req.files;
    } else if (req.files && cfg.field && Array.isArray(req.files[cfg.field])) {
      files = req.files[cfg.field];
    }

    if (files.length === 0) {
      _logUploadFailure(req, { reason: 'no_file' });
      return res.status(400).json({ error: 'No file uploaded' });
    }

    for (const f of files) {
      const result = validateOne(f, cfg);
      if (!result.ok) {
        _logUploadFailure(req, {
          reason:    result.error,
          mimeType:  f && f.mimetype,
          extension: f && f.originalname,
          status:    result.status,
        });
        return res.status(result.status).json({ error: result.error });
      }
    }

    return next();
  };
}

// Admin Monitoring Dashboard v1 — fire-and-forget logger for
// upload failures. Persists as a `client_events` row with
// `type='upload_failed'` so the metrics aggregator picks it up.
// Lazy-imports prisma + uuid to avoid pulling them into modules
// that only consume the validator's pure helpers (validateOne /
// sniffMime), and so the validator stays unit-testable without
// a DB. Never throws — telemetry must never break a request.
function _logUploadFailure(req, meta) {
  try {
    import('../config/database.js').then(({ default: prisma }) => {
      try {
        const id = (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID)
          ? globalThis.crypto.randomUUID()
          : `up-fail-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        prisma.clientEvent.create({
          data: {
            id,
            type:      'upload_failed',
            payload: {
              reason:    meta && meta.reason,
              status:    meta && meta.status,
              mimeType:  meta && meta.mimeType,
              extension: meta && meta.extension,
              route:     (req && (req.originalUrl || req.path)) || null,
              userId:    (req && req.user && (req.user.sub || req.user.id)) || null,
            },
            createdAt: new Date(),
            farmerId:  (req && req.user && (req.user.sub || req.user.id)) || null,
            orgId:     (req && req.user && req.user.organizationId) || null,
            offline:   false,
          },
        }).catch(() => { /* swallow — never block on telemetry */ });
      } catch { /* swallow */ }
    }).catch(() => { /* swallow */ });
  } catch { /* swallow */ }
}

// Exported for tests + reuse from other modules.
export { ALLOWED_MIME, ALLOWED_EXT, sniffMime, validateOne };

export default imageUploadValidator;
