import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Request Logger Enhancement Tests ───────────────────────

describe('Enhanced Request Logger', () => {
  let buildLogEntry, classifyLogLevel, get403Count, clear403Tracker, getSlowRequestThreshold;

  beforeEach(async () => {
    const mod = await import('../middleware/requestLogger.js');
    buildLogEntry = mod.buildLogEntry;
    classifyLogLevel = mod.classifyLogLevel;
    get403Count = mod.get403Count;
    clear403Tracker = mod.clear403Tracker;
    getSlowRequestThreshold = mod.getSlowRequestThreshold;
    clear403Tracker();
  });

  function mockReq(overrides = {}) {
    return {
      requestId: 'rid-001',
      method: 'GET',
      originalUrl: '/api/test',
      path: '/api/test',
      user: { sub: 'user-1' },
      ip: '127.0.0.1',
      ...overrides,
    };
  }

  function mockRes(statusCode = 200, contentLength = null) {
    return {
      statusCode,
      getHeader(name) {
        if (name === 'content-length' && contentLength) return String(contentLength);
        return undefined;
      },
    };
  }

  // ─── Log level classification ─────────────────────────────

  describe('classifyLogLevel', () => {
    it('returns error for 5xx status', () => {
      expect(classifyLogLevel(500, 100)).toBe('error');
      expect(classifyLogLevel(503, 50)).toBe('error');
    });

    it('returns warn for 429 (rate limited)', () => {
      expect(classifyLogLevel(429, 100)).toBe('warn');
    });

    it('returns warn for slow requests regardless of status', () => {
      const threshold = getSlowRequestThreshold();
      expect(classifyLogLevel(200, threshold + 100)).toBe('warn');
    });

    it('returns warn for 4xx errors', () => {
      expect(classifyLogLevel(400, 100)).toBe('warn');
      expect(classifyLogLevel(404, 100)).toBe('warn');
      expect(classifyLogLevel(403, 100)).toBe('warn');
    });

    it('returns info for successful responses', () => {
      expect(classifyLogLevel(200, 100)).toBe('info');
      expect(classifyLogLevel(201, 50)).toBe('info');
      expect(classifyLogLevel(304, 10)).toBe('info');
    });
  });

  // ─── buildLogEntry ────────────────────────────────────────

  describe('buildLogEntry', () => {
    it('includes standard fields', () => {
      const entry = buildLogEntry(mockReq(), mockRes(200), 150);
      expect(entry.level).toBe('info');
      expect(entry.requestId).toBe('rid-001');
      expect(entry.method).toBe('GET');
      expect(entry.path).toBe('/api/test');
      expect(entry.status).toBe(200);
      expect(entry.duration).toBe(150);
      expect(entry.userId).toBe('user-1');
      expect(entry.ip).toBe('127.0.0.1');
      expect(entry.timestamp).toBeDefined();
    });

    it('includes response size when content-length is present', () => {
      const entry = buildLogEntry(mockReq(), mockRes(200, 4096), 100);
      expect(entry.responseSize).toBe(4096);
    });

    it('omits response size when content-length is absent', () => {
      const entry = buildLogEntry(mockReq(), mockRes(200), 100);
      expect(entry.responseSize).toBeUndefined();
    });

    it('flags slow requests', () => {
      const threshold = getSlowRequestThreshold();
      const entry = buildLogEntry(mockReq(), mockRes(200), threshold + 500);
      expect(entry.slow).toBe(true);
      expect(entry.slowThreshold).toBe(threshold);
      expect(entry.level).toBe('warn');
    });

    it('does not flag fast requests as slow', () => {
      const entry = buildLogEntry(mockReq(), mockRes(200), 50);
      expect(entry.slow).toBeUndefined();
    });

    it('tracks userId as null for unauthenticated requests', () => {
      const entry = buildLogEntry(mockReq({ user: null }), mockRes(401), 20);
      expect(entry.userId).toBeNull();
    });
  });

  // ─── 403 tracking ────────────────────────────────────────

  describe('Repeated 403 tracking', () => {
    it('tracks 403 responses per IP', () => {
      const req = mockReq({ ip: '10.0.0.1' });
      const res = mockRes(403);

      // Trigger 3 403s
      buildLogEntry(req, res, 50);
      buildLogEntry(req, res, 50);
      buildLogEntry(req, res, 50);

      expect(get403Count('10.0.0.1')).toBe(3);
    });

    it('does not track non-403 responses', () => {
      buildLogEntry(mockReq({ ip: '10.0.0.2' }), mockRes(200), 50);
      buildLogEntry(mockReq({ ip: '10.0.0.2' }), mockRes(404), 50);
      expect(get403Count('10.0.0.2')).toBe(0);
    });

    it('sets forbiddenAlert when threshold is reached', () => {
      const req = mockReq({ ip: '10.0.0.3' });
      const res = mockRes(403);

      // Generate 10 403s (the alert threshold)
      let lastEntry;
      for (let i = 0; i < 10; i++) {
        lastEntry = buildLogEntry(req, res, 50);
      }

      expect(lastEntry.forbiddenAlert).toBe(true);
      expect(lastEntry.forbiddenCount).toBe(10);
    });

    it('does not set forbiddenAlert below threshold', () => {
      const req = mockReq({ ip: '10.0.0.4' });
      const res = mockRes(403);

      let lastEntry;
      for (let i = 0; i < 5; i++) {
        lastEntry = buildLogEntry(req, res, 50);
      }

      expect(lastEntry.forbiddenAlert).toBeUndefined();
    });

    it('separates tracking by IP', () => {
      const res = mockRes(403);
      buildLogEntry(mockReq({ ip: '10.0.0.5' }), res, 50);
      buildLogEntry(mockReq({ ip: '10.0.0.5' }), res, 50);
      buildLogEntry(mockReq({ ip: '10.0.0.6' }), res, 50);

      expect(get403Count('10.0.0.5')).toBe(2);
      expect(get403Count('10.0.0.6')).toBe(1);
    });
  });
});

// ─── Operational Event Logger Tests ─────────────────────────

describe('Operational Event Logger', () => {
  let opsEvent, logAuthEvent, logUploadEvent, logPermissionEvent, logWorkflowEvent, logSystemEvent;

  beforeEach(async () => {
    const mod = await import('../utils/opsLogger.js');
    opsEvent = mod.opsEvent;
    logAuthEvent = mod.logAuthEvent;
    logUploadEvent = mod.logUploadEvent;
    logPermissionEvent = mod.logPermissionEvent;
    logWorkflowEvent = mod.logWorkflowEvent;
    logSystemEvent = mod.logSystemEvent;
  });

  describe('opsEvent', () => {
    it('returns structured event object', () => {
      const result = opsEvent('auth', 'login_success', 'info', { userId: 'u-1' });
      expect(result.type).toBe('ops_event');
      expect(result.category).toBe('auth');
      expect(result.event).toBe('login_success');
      expect(result.severity).toBe('info');
      expect(result.userId).toBe('u-1');
      expect(result.timestamp).toBeDefined();
    });

    it('includes arbitrary metadata', () => {
      const result = opsEvent('upload', 'file_uploaded', 'info', {
        filename: 'test.jpg', sizeBytes: 12345, requestId: 'rid-1',
      });
      expect(result.filename).toBe('test.jpg');
      expect(result.sizeBytes).toBe(12345);
      expect(result.requestId).toBe('rid-1');
    });
  });

  describe('convenience helpers', () => {
    it('logAuthEvent sets warn for failures', () => {
      const result = logAuthEvent('login_failed', { ip: '10.0.0.1' });
      expect(result.category).toBe('auth');
      expect(result.severity).toBe('warn');
    });

    it('logAuthEvent sets info for success', () => {
      const result = logAuthEvent('login_success', { userId: 'u-1' });
      expect(result.severity).toBe('info');
    });

    it('logUploadEvent sets warn for failures', () => {
      const result = logUploadEvent('upload_failed', { error: 'disk full' });
      expect(result.category).toBe('upload');
      expect(result.severity).toBe('warn');
    });

    it('logPermissionEvent always warns', () => {
      const result = logPermissionEvent('role_denied', { role: 'farmer' });
      expect(result.category).toBe('permission');
      expect(result.severity).toBe('warn');
    });

    it('logWorkflowEvent sets error for failures', () => {
      const result = logWorkflowEvent('transaction_failed', { error: 'deadlock' });
      expect(result.category).toBe('workflow');
      expect(result.severity).toBe('error');
    });

    it('logWorkflowEvent sets info for normal transitions', () => {
      const result = logWorkflowEvent('status_changed', { from: 'active', to: 'harvested' });
      expect(result.severity).toBe('info');
    });

    it('logSystemEvent uses provided severity', () => {
      const result = logSystemEvent('startup', 'info', { port: 4000 });
      expect(result.category).toBe('system');
      expect(result.severity).toBe('info');
      expect(result.port).toBe(4000);
    });
  });
});

// ─── Request Logger Middleware Integration ───────────────────

describe('requestLogger middleware', () => {
  let requestLogger;

  beforeEach(async () => {
    const mod = await import('../middleware/requestLogger.js');
    requestLogger = mod.requestLogger;
  });

  it('skips /api/health requests', () => {
    const req = { path: '/api/health' };
    const res = {};
    let nextCalled = false;
    requestLogger(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  it('calls next for non-health requests', () => {
    const req = {
      path: '/api/farmers',
      originalUrl: '/api/farmers',
      method: 'GET',
      requestId: 'rid-1',
      ip: '127.0.0.1',
    };
    const res = {
      statusCode: 200,
      on: vi.fn(),
      getHeader: vi.fn(),
    };
    let nextCalled = false;
    requestLogger(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });
});
