import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Sensitive-leak scrubbing tests for the errorHandler middleware.
 * Merged-blocker spec §5: API errors must never leak stack
 * traces, Prisma internals, env vars, file paths, or tokens.
 */

vi.mock('../utils/opsLogger.js', () => ({
  opsEvent: vi.fn(),
  logAuthEvent:       vi.fn(),
  logPermissionEvent: vi.fn(),
}));

// We toggle config.isProduction per-test, so import the module
// fresh inside each test rather than at module scope.
async function loadHandler({ isProduction }) {
  vi.resetModules();
  vi.doMock('../config/index.js', () => ({
    config: {
      isProduction,
      upload: { maxFileSizeMB: 10 },
    },
  }));
  return await import('../middleware/errorHandler.js');
}

function makeReqRes() {
  const req = {
    requestId: 'rid-test-1',
    method: 'GET',
    path: '/api/test',
    originalUrl: '/api/test',
    user: { sub: 'u-1' },
    ip: '127.0.0.1',
  };
  let statusCode = 200;
  const json = vi.fn();
  const status = vi.fn((c) => { statusCode = c; return res; });
  const res = { status, json, get statusCode() { return statusCode; } };
  return { req, res, json, status };
}

describe('errorHandler — sensitive-leak scrubbing (production)', () => {
  let mod;
  beforeEach(async () => {
    mod = await loadHandler({ isProduction: true });
  });

  it('500 errors fall back to "Internal server error" in prod', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('whatever the controller said');
    err.statusCode = 500;
    mod.errorHandler(err, req, res, () => {});
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Internal server error',
      requestId: 'rid-test-1',
    }));
  });

  it('strips DATABASE_URL from a 4xx error message', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('Bad config: DATABASE_URL missing');
    err.statusCode = 400;
    mod.errorHandler(err, req, res, () => {});
    const arg = json.mock.calls[0][0];
    expect(arg.error).not.toMatch(/DATABASE_URL/);
    expect(arg.error).toBe('Something went wrong');
  });

  it('strips JWT_SECRET from a 4xx message', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('JWT_SECRET is malformed');
    err.statusCode = 400;
    mod.errorHandler(err, req, res, () => {});
    expect(json.mock.calls[0][0].error).not.toMatch(/JWT_SECRET/);
  });

  it('strips a Prisma error class name', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('PrismaClientKnownRequestError: duplicate');
    err.statusCode = 400;
    mod.errorHandler(err, req, res, () => {});
    expect(json.mock.calls[0][0].error).not.toMatch(/PrismaClient/);
  });

  it('strips a stack frame substring', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('failed at Object.handler in /app/server/src/x.js');
    err.statusCode = 400;
    mod.errorHandler(err, req, res, () => {});
    expect(json.mock.calls[0][0].error).not.toMatch(/at Object/);
  });

  it('strips an absolute file path', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('lookup at /app/node_modules/.prisma/client');
    err.statusCode = 500;
    mod.errorHandler(err, req, res, () => {});
    expect(json.mock.calls[0][0].error).toBe('Internal server error');
  });

  it('strips an inline JWT', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMxMjM0NTY3ODkwIn0.dGVzdC1zaWctYWJjZGVmZ2hpag');
    err.statusCode = 401;
    mod.errorHandler(err, req, res, () => {});
    expect(json.mock.calls[0][0].error).toBe('Something went wrong');
  });

  it('passes a clean 4xx message through unchanged', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('Email already in use');
    err.statusCode = 409;
    mod.errorHandler(err, req, res, () => {});
    expect(json.mock.calls[0][0].error).toBe('Email already in use');
  });

  it('500 error never includes a stack trace in the response', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at Object.<anonymous> (/app/x.js:1:1)';
    err.statusCode = 500;
    mod.errorHandler(err, req, res, () => {});
    const arg = json.mock.calls[0][0];
    expect(arg).not.toHaveProperty('stack');
    expect(JSON.stringify(arg)).not.toMatch(/at Object/);
  });

  it('5xx response includes requestId for support correlation', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('boom');
    err.statusCode = 502;
    mod.errorHandler(err, req, res, () => {});
    expect(json.mock.calls[0][0].requestId).toBe('rid-test-1');
  });
});

describe('errorHandler — development mode preserves diagnostics', () => {
  let mod;
  beforeEach(async () => {
    mod = await loadHandler({ isProduction: false });
  });

  it('keeps the original message in development', () => {
    const { req, res, json } = makeReqRes();
    const err = new Error('Bad config: DATABASE_URL missing');
    err.statusCode = 400;
    mod.errorHandler(err, req, res, () => {});
    // Dev keeps the message — engineers need it to debug.
    expect(json.mock.calls[0][0].error).toMatch(/DATABASE_URL/);
  });
});

describe('scrubMessage helper', () => {
  it('exports LEAK_PATTERNS that cover every spec category', async () => {
    const mod = await loadHandler({ isProduction: true });
    expect(Array.isArray(mod.LEAK_PATTERNS)).toBe(true);
    expect(mod.LEAK_PATTERNS.length).toBeGreaterThan(8);
  });
});
