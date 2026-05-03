import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * protectedRouter — registration-time defence-in-depth tests.
 *
 * Strategy: don't full-boot Express. Mock `./auth.js` so the
 * router's auto-applied `authenticate` is a no-op that just
 * marks req.user, then simulate routing by invoking the
 * stack the router builds.
 */

vi.mock('../middleware/auth.js', () => {
  const authenticate = (req, _res, next) => {
    req.user = req.user || { sub: 'u-test', role: 'farmer' };
    next();
  };
  // authorize(...roles) returns a guard whose .name is "authorize"
  // so the protectedRouter's name-based guard detection picks it up.
  const authorize = (...roles) => {
    const fn = (req, res, next) => {
      const role = req.user && req.user.role;
      if (!role) return res.status(401).json({ error: 'Not authorized' });
      if (!roles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
      next();
    };
    Object.defineProperty(fn, 'name', { value: 'authorize' });
    return fn;
  };
  return { authenticate, authorize };
});

vi.mock('../utils/opsLogger.js', () => ({
  opsEvent: vi.fn(),
  logAuthEvent: vi.fn(),
  logPermissionEvent: vi.fn(),
}));

// Per-test toggle for production-mode terminator.
let _isProduction = false;
vi.mock('../config/index.js', () => ({
  config: { get isProduction() { return _isProduction; } },
}));

import {
  protectedRouter,
  publicListingGuard,
  markAsGuard,
  _internal,
} from '../middleware/protectedRouter.js';
import { logPermissionEvent } from '../utils/opsLogger.js';

// ─── Mini Express simulator ──────────────────────────────
// We simulate route dispatch by walking the router's stack.
// For each layer that matches the path + method, we invoke
// its handle in the standard `(req, res, next)` shape.

function simulate(router, method, url, reqOverrides = {}) {
  return new Promise((resolve) => {
    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: url,
      path: url.split('?')[0],
      params: {},
      query: {},
      ip: '127.0.0.1',
      ...reqOverrides,
    };
    let statusCode = 200;
    let body = null;
    const res = {
      get statusCode() { return statusCode; },
      status(c) { statusCode = c; return this; },
      json(b) { body = b; resolve({ statusCode, body }); return this; },
      send(b) { body = b; resolve({ statusCode, body }); return this; },
    };

    // Walk the stack manually. The router's internal stack
    // has `regexp`, `route` (when registered via verbs), or
    // `handle` (router.use middleware). We just invoke layers
    // in order and respect calls to next().
    const layers = router.stack;
    let i = 0;
    function runNext(err) {
      if (err) { res.status(500).json({ error: String(err && err.message || err) }); return; }
      const layer = layers[i++];
      if (!layer) {
        // Reached the end without anyone responding — Express
        // would normally 404. We simulate that.
        res.status(404).json({ error: 'Not found' });
        return;
      }
      // Only check method match for layers backed by a route.
      if (layer.route) {
        const matches = layer.match
          ? layer.match(req.path)
          : (layer.route.path === req.path);
        if (!matches) return runNext();
        const routeMethod = req.method.toLowerCase();
        const stack = layer.route.stack;
        let j = 0;
        function runRoute(rerr) {
          if (rerr) { res.status(500).json({ error: String(rerr && rerr.message || rerr) }); return; }
          const lay = stack[j++];
          if (!lay) return runNext();
          if (lay.method && lay.method !== routeMethod) return runRoute();
          try { lay.handle(req, res, runRoute); }
          catch (e) { runRoute(e); }
        }
        runRoute();
        return;
      }
      // Plain middleware layer (e.g. authenticate) — just call.
      try {
        const matches = layer.match ? layer.match(req.path) : true;
        if (!matches) return runNext();
        layer.handle(req, res, runNext);
      } catch (e) { runNext(e); }
    }
    runNext();
  });
}

beforeEach(() => {
  _isProduction = false;
  vi.mocked(logPermissionEvent).mockClear();
});

// ─── Internals ───────────────────────────────────────────
describe('protectedRouter — internals', () => {
  it('_isIdShaped detects :id / :farmId / :scanId / :programId / etc.', () => {
    expect(_internal._isIdShaped('/farms/:id')).toBe(true);
    expect(_internal._isIdShaped('/scans/:scanId')).toBe(true);
    expect(_internal._isIdShaped('/programs/:programId/farmers')).toBe(true);
    expect(_internal._isIdShaped('/orgs/:orgId')).toBe(true);
    expect(_internal._isIdShaped('/static-path')).toBe(false);
    expect(_internal._isIdShaped('/me/context')).toBe(false);
    expect(_internal._isIdShaped('/listings')).toBe(false);
  });

  it('_hasGuard accepts canonical guard names', () => {
    const requireOwnership = function requireOwnership() {};
    const handler = function handler() {};
    expect(_internal._hasGuard([requireOwnership, handler])).toBe(true);
  });

  it('_hasGuard accepts markAsGuard-flagged functions', () => {
    const local = markAsGuard(function () {});
    const handler = function handler() {};
    expect(_internal._hasGuard([local, handler])).toBe(true);
  });

  it('_hasGuard rejects a chain with no guard', () => {
    const handler = function handler() {};
    expect(_internal._hasGuard([handler])).toBe(false);
  });

  it('_hasGuard accepts publicListingGuard', () => {
    const handler = function handler() {};
    expect(_internal._hasGuard([publicListingGuard, handler])).toBe(true);
  });
});

// ─── Registration-time blocking ──────────────────────────
describe('protectedRouter — registration-time blocking of unguarded :id routes', () => {
  it('serves a guarded :id route normally', async () => {
    const router = protectedRouter();
    const requireOwnership = function requireOwnership(req, _res, next) { next(); };
    router.get('/:id', requireOwnership, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const result = await simulate(router, 'GET', '/abc-123');
    expect(result.statusCode).toBe(200);
    expect(result.body).toEqual({ ok: true });
  });

  it('blocks an UNGUARDED :id route (development → 500 + diagnostic)', async () => {
    _isProduction = false;
    const router = protectedRouter();
    let handlerRan = false;
    router.get('/:id', (_req, res) => {
      handlerRan = true;
      res.status(200).json({ ok: true });
    });
    const result = await simulate(router, 'GET', '/abc-123');
    expect(handlerRan).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.body.error).toMatch(/Unguarded route blocked/);
    expect(result.body.path).toBe('/:id');
    expect(result.body.verb).toBe('GET');
  });

  it('blocks an UNGUARDED :id route (production → 404 + neutral wording)', async () => {
    _isProduction = true;
    const router = protectedRouter();
    router.get('/:id', (_req, res) => res.status(200).json({ ok: true }));
    const result = await simulate(router, 'GET', '/abc-123');
    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ error: 'Not found' });
    expect(result.body.path).toBeUndefined();
    expect(result.body.verb).toBeUndefined();
    // Production response leaks no internals.
    expect(JSON.stringify(result.body)).not.toMatch(/protectedRouter|hint|Unguarded/);
  });

  it('logs `unguarded_route_blocked` when the terminator fires', async () => {
    const router = protectedRouter();
    router.get('/:id', (_req, res) => res.status(200).json({ ok: true }));
    await simulate(router, 'GET', '/abc-123');
    expect(logPermissionEvent).toHaveBeenCalledWith(
      'unguarded_route_blocked',
      expect.objectContaining({
        verb: 'get',
        path: '/:id',
      }),
    );
  });

  it('non-:id routes are NEVER blocked', async () => {
    const router = protectedRouter();
    router.get('/list', (_req, res) => res.status(200).json({ list: [] }));
    const result = await simulate(router, 'GET', '/list');
    expect(result.statusCode).toBe(200);
  });

  it('accepts publicListingGuard as a satisfier', async () => {
    const router = protectedRouter();
    router.get('/:id', publicListingGuard, (req, res) => {
      res.status(200).json({ ok: true, publicAccess: req.publicAccess });
    });
    const result = await simulate(router, 'GET', '/abc-123');
    expect(result.statusCode).toBe(200);
    expect(result.body.publicAccess).toBe(true);
  });

  it('accepts a markAsGuard-tagged custom function as a satisfier', async () => {
    const router = protectedRouter();
    const requireBuyerTrustAccess = markAsGuard((_req, _res, next) => next());
    router.get('/:id', requireBuyerTrustAccess, (_req, res) => res.status(200).json({ ok: true }));
    const result = await simulate(router, 'GET', '/abc-123');
    expect(result.statusCode).toBe(200);
  });

  it('accepts a guard via opts.extraGuardNames', async () => {
    const router = protectedRouter({ extraGuardNames: ['domainSpecificGuard'] });
    function domainSpecificGuard(_req, _res, next) { next(); }
    router.get('/:id', domainSpecificGuard, (_req, res) => res.status(200).json({ ok: true }));
    const result = await simulate(router, 'GET', '/abc-123');
    expect(result.statusCode).toBe(200);
  });
});

// ─── adminOnly ───────────────────────────────────────────
describe('protectedRouter — adminOnly mode', () => {
  it('admin role passes through to handler', async () => {
    const router = protectedRouter({ adminOnly: true });
    router.get('/:id', (_req, res) => res.status(200).json({ ok: true }));
    const result = await simulate(router, 'GET', '/abc-123', {
      user: { sub: 'admin-1', role: 'admin' },
    });
    expect(result.statusCode).toBe(200);
  });

  it('non-admin role gets 403', async () => {
    const router = protectedRouter({ adminOnly: true });
    router.get('/:id', (_req, res) => res.status(200).json({ ok: true }));
    const result = await simulate(router, 'GET', '/abc-123', {
      user: { sub: 'farmer-1', role: 'farmer' },
    });
    expect(result.statusCode).toBe(403);
    expect(result.body).toEqual({ error: 'Forbidden' });
  });

  it('adminOnly :id routes do NOT need an additional guard middleware', async () => {
    // The router-wide authorize() satisfies the spec; per-route
    // requireOwnership is unnecessary for admin-only surfaces.
    const router = protectedRouter({ adminOnly: true });
    let handlerRan = false;
    router.get('/:id', (_req, res) => {
      handlerRan = true;
      res.status(200).json({ ok: true });
    });
    const result = await simulate(router, 'GET', '/abc-123', {
      user: { sub: 'admin-1', role: 'super_admin' },
    });
    expect(handlerRan).toBe(true);
    expect(result.statusCode).toBe(200);
  });
});

// ─── publicListingGuard semantics ────────────────────────
describe('publicListingGuard', () => {
  it('attaches req.publicAccess = true and calls next', () => {
    const req = {};
    const res = {};
    const next = vi.fn();
    publicListingGuard(req, res, next);
    expect(req.publicAccess).toBe(true);
    expect(next).toHaveBeenCalled();
  });

  it('is markedAsGuard so the registration-time check accepts it', () => {
    expect(publicListingGuard.__isGuard).toBe(true);
  });
});
