import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config
vi.mock('../config/index.js', () => ({
  config: {
    isProduction: false,
    upload: { maxFileSizeMB: 10 },
  },
}));

import { errorHandler, asyncHandler } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';

function createMocks() {
  return {
    req: { method: 'POST', path: '/test', requestId: 'test-rid-123' },
    res: {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    },
    next: vi.fn(),
  };
}

describe('Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    config.isProduction = false;
  });

  describe('errorHandler', () => {
    it('returns 500 for generic errors', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Something went wrong');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong', requestId: 'test-rid-123' });
    });

    it('uses custom statusCode from error', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Not found');
      err.statusCode = 404;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('hides error message in production for 500 errors', () => {
      config.isProduction = true;
      const { req, res, next } = createMocks();
      const err = new Error('Internal database leak');

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error', requestId: 'test-rid-123' });
    });

    it('shows error message in production for non-500 errors', () => {
      config.isProduction = true;
      const { req, res, next } = createMocks();
      const err = new Error('Bad request');
      err.statusCode = 400;

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith({ error: 'Bad request' });
    });

    it('never includes stack traces in response', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Test error');

      errorHandler(err, req, res, next);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody).not.toHaveProperty('stack');
    });

    it('handles Prisma P2002 (unique constraint)', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Unique constraint failed');
      err.code = 'P2002';

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'A record with that value already exists.' });
    });

    it('handles Prisma P2025 (record not found)', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Record not found');
      err.code = 'P2025';

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('handles Prisma P2003 (foreign key constraint)', () => {
      const { req, res, next } = createMocks();
      const err = new Error('FK constraint');
      err.code = 'P2003';

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('handles LIMIT_FILE_SIZE error', () => {
      const { req, res, next } = createMocks();
      const err = new Error('File too large');
      err.code = 'LIMIT_FILE_SIZE';

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith({ error: 'File too large. Maximum size is 10MB' });
    });

    // ─── Production CORS Noise Hardening ─────────────────────
    // Unknown origins (scanners, Mozilla Observatory, automated
    // probes) must return a clean 403 with a single [CORS_BLOCKED]
    // warn line — no 500, no Sentry escalation, no
    // unhandled_route_error ops event.
    describe('CORS-block fast path', () => {
      it('returns 403 with neutral message for isCorsBlocked errors', () => {
        const { req, res, next } = createMocks();
        const err = new Error('CORS: origin https://http-observatory.security.mozilla.org not allowed');
        err.statusCode    = 403;
        err.isCorsBlocked = true;
        err.blockedOrigin = 'https://http-observatory.security.mozilla.org';

        errorHandler(err, req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Origin not allowed' });
      });

      it('emits a single [CORS_BLOCKED] warn line with the blocked origin', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { req, res, next } = createMocks();
        const err = new Error('CORS: origin https://evil.example not allowed');
        err.isCorsBlocked = true;
        err.blockedOrigin = 'https://evil.example';

        errorHandler(err, req, res, next);

        const corsLines = warnSpy.mock.calls.filter(
          (c) => String(c[0]).startsWith('[CORS_BLOCKED]'),
        );
        expect(corsLines.length).toBe(1);
        expect(String(corsLines[0][0])).toBe('[CORS_BLOCKED] origin=https://evil.example');
        warnSpy.mockRestore();
      });

      it('does NOT log an [ERROR] line (no 500-treatment noise)', () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { req, res, next } = createMocks();
        const err = new Error('CORS: origin https://x.test not allowed');
        err.isCorsBlocked = true;
        err.blockedOrigin = 'https://x.test';

        errorHandler(err, req, res, next);

        // The existing dev/prod error log paths run AFTER the
        // CORS short-circuit returns, so neither path fires.
        expect(errSpy).not.toHaveBeenCalled();
        errSpy.mockRestore();
      });
    });
  });

  describe('asyncHandler', () => {
    it('wraps async function and calls next on error', async () => {
      const { req, res, next } = createMocks();
      const err = new Error('async error');
      const handler = asyncHandler(async () => { throw err; });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });

    it('does not call next when function succeeds', async () => {
      const { req, res, next } = createMocks();
      const handler = asyncHandler(async (req, res) => {
        res.json({ ok: true });
      });

      await handler(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
