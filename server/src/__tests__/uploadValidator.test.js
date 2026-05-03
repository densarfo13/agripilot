import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: {
    isProduction: false,
    upload: { maxFileSizeMB: 10 },
  },
}));

import {
  imageUploadValidator,
  validateOne,
  sniffMime,
  ALLOWED_MIME,
  ALLOWED_EXT,
} from '../middleware/uploadValidator.js';

// JPEG magic bytes (FF D8 FF + padding to 12 bytes minimum)
const JPEG_BYTES = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
// PNG magic bytes
const PNG_BYTES  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
// WebP magic bytes (RIFF....WEBP)
const WEBP_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
// HTML <script> opener — what an XSS-bait .png might actually contain
const HTML_BYTES = Buffer.from('<script>alert(1)</script>'.padEnd(64, ' '));
// PDF header
const PDF_BYTES  = Buffer.from('%PDF-1.4\n%abc\n');
// SVG header
const SVG_BYTES  = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" />');

function mockFile(overrides = {}) {
  return {
    originalname: 'photo.jpg',
    mimetype:     'image/jpeg',
    size:         1024,
    buffer:       JPEG_BYTES,
    ...overrides,
  };
}

describe('uploadValidator — validateOne', () => {
  const opts = { maxBytes: 10 * 1024 * 1024 };

  it('accepts a valid JPEG', () => {
    expect(validateOne(mockFile(), opts).ok).toBe(true);
  });

  it('accepts a valid PNG', () => {
    expect(validateOne(
      mockFile({ originalname: 'photo.png', mimetype: 'image/png', buffer: PNG_BYTES }),
      opts,
    ).ok).toBe(true);
  });

  it('accepts a valid WebP', () => {
    expect(validateOne(
      mockFile({ originalname: 'photo.webp', mimetype: 'image/webp', buffer: WEBP_BYTES }),
      opts,
    ).ok).toBe(true);
  });

  it('rejects when no file present', () => {
    expect(validateOne(null, opts)).toEqual({ ok: false, status: 400, error: 'No file uploaded' });
  });

  it('rejects oversized file with 413', () => {
    const f = mockFile({ size: 20 * 1024 * 1024 });
    expect(validateOne(f, opts)).toEqual({ ok: false, status: 413, error: 'File too large' });
  });

  it('rejects unsupported MIME (PDF)', () => {
    const f = mockFile({ originalname: 'doc.pdf', mimetype: 'application/pdf', buffer: PDF_BYTES });
    expect(validateOne(f, opts)).toEqual({ ok: false, status: 400, error: 'Unsupported file type' });
  });

  it('rejects SVG even when MIME claims image/svg+xml', () => {
    const f = mockFile({ originalname: 'icon.svg', mimetype: 'image/svg+xml', buffer: SVG_BYTES });
    expect(validateOne(f, opts).ok).toBe(false);
  });

  it('rejects HTML disguised as PNG (magic-byte mismatch)', () => {
    const f = mockFile({ originalname: 'photo.png', mimetype: 'image/png', buffer: HTML_BYTES });
    const r = validateOne(f, opts);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rejects when MIME claims image/png but bytes are JPEG', () => {
    const f = mockFile({ originalname: 'photo.png', mimetype: 'image/png', buffer: JPEG_BYTES });
    expect(validateOne(f, opts).ok).toBe(false);
  });

  it('rejects unsupported extension even with valid MIME', () => {
    const f = mockFile({ originalname: 'photo.html', mimetype: 'image/jpeg', buffer: JPEG_BYTES });
    expect(validateOne(f, opts).ok).toBe(false);
  });

  it('rejects EXE-like binary', () => {
    const exe = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const f = mockFile({ originalname: 'evil.exe', mimetype: 'image/jpeg', buffer: exe });
    expect(validateOne(f, opts).ok).toBe(false);
  });

  it('skips magic-byte check on disk-storage uploads (no buffer)', () => {
    // Disk-storage multer does not populate `buffer`. Ext +
    // MIME alone gates the request — magic-byte sniffing
    // happens later (e.g. by preprocessImage at scan time).
    const f = mockFile({ buffer: undefined });
    expect(validateOne(f, opts).ok).toBe(true);
  });
});

describe('uploadValidator — middleware shape', () => {
  function mockReqRes(req) {
    let statusCode = 200;
    const json = vi.fn();
    const status = vi.fn((c) => { statusCode = c; return res; });
    const next = vi.fn();
    const res = { status, json, get statusCode() { return statusCode; } };
    return { req, res, next, json, status };
  }

  it('400 when neither req.file nor req.files present', () => {
    const v = imageUploadValidator();
    const { req, res, next, json } = mockReqRes({});
    v(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith({ error: 'No file uploaded' });
  });

  it('passes through on valid req.file', () => {
    const v = imageUploadValidator();
    const { req, res, next } = mockReqRes({ file: mockFile() });
    v(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects on invalid req.file', () => {
    const v = imageUploadValidator();
    const { req, res, next, json, status } = mockReqRes({
      file: mockFile({ mimetype: 'application/pdf', originalname: 'a.pdf', buffer: PDF_BYTES }),
    });
    v(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Unsupported file type' });
  });

  it('handles req.files array (multer .array())', () => {
    const v = imageUploadValidator();
    const { req, res, next } = mockReqRes({
      files: [mockFile(), mockFile({ originalname: 'b.png', mimetype: 'image/png', buffer: PNG_BYTES })],
    });
    v(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects an array when ANY file is invalid', () => {
    const v = imageUploadValidator();
    const { req, res, next, status } = mockReqRes({
      files: [mockFile(), mockFile({ mimetype: 'application/pdf', buffer: PDF_BYTES, originalname: 'b.pdf' })],
    });
    v(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });
});

describe('uploadValidator — sniffMime', () => {
  it('detects JPEG', () => { expect(sniffMime(JPEG_BYTES)).toBe('image/jpeg'); });
  it('detects PNG',  () => { expect(sniffMime(PNG_BYTES)).toBe('image/png'); });
  it('detects WebP', () => { expect(sniffMime(WEBP_BYTES)).toBe('image/webp'); });
  it('returns null for HTML',  () => { expect(sniffMime(HTML_BYTES)).toBeNull(); });
  it('returns null for PDF',   () => { expect(sniffMime(PDF_BYTES)).toBeNull(); });
  it('returns null for SVG',   () => { expect(sniffMime(SVG_BYTES)).toBeNull(); });
  it('returns null for short buffers', () => {
    expect(sniffMime(Buffer.from([1, 2, 3]))).toBeNull();
  });
});

describe('uploadValidator — exports', () => {
  it('ALLOWED_MIME contains exactly jpeg / png / webp', () => {
    expect(ALLOWED_MIME.size).toBe(3);
    expect(ALLOWED_MIME.has('image/jpeg')).toBe(true);
    expect(ALLOWED_MIME.has('image/png')).toBe(true);
    expect(ALLOWED_MIME.has('image/webp')).toBe(true);
    expect(ALLOWED_MIME.has('image/svg+xml')).toBe(false);
    expect(ALLOWED_MIME.has('application/pdf')).toBe(false);
  });

  it('ALLOWED_EXT contains exactly the matching extensions', () => {
    expect(ALLOWED_EXT.has('.jpg')).toBe(true);
    expect(ALLOWED_EXT.has('.jpeg')).toBe(true);
    expect(ALLOWED_EXT.has('.png')).toBe(true);
    expect(ALLOWED_EXT.has('.webp')).toBe(true);
    expect(ALLOWED_EXT.has('.svg')).toBe(false);
    expect(ALLOWED_EXT.has('.exe')).toBe(false);
  });
});
