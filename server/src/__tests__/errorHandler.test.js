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
    req: { method: 'POST', path: '/test' },
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
      expect(res.json).toHaveBeenCalledWith({ error: 'Something went wrong' });
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

      expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
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
      expect(res.json).toHaveBeenCalledWith({ error: 'A record with that value already exists' });
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
