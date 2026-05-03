/**
 * protectedRouter.js — defence-in-depth Express router factory.
 *
 *   import { protectedRouter, publicListingGuard, markAsGuard }
 *     from '../middleware/protectedRouter.js';
 *
 *   // 1. Auto-authenticated farms router.
 *   const router = protectedRouter();
 *
 *   // 2. Routes WITHOUT :id → registered as-is.
 *   router.get('/', listFarmsHandler);
 *
 *   // 3. Routes WITH :id MUST carry one of:
 *   //      requireOwnership / requireFarmerOwnership / authorize /
 *   //      requireRole / verifyOrgAccess / verifyProgramAccess /
 *   //      publicListingGuard
 *   //    in their middleware chain. Otherwise the registration
 *   //    is replaced with a 404/500 terminator that logs
 *   //    `unguarded_route_blocked` so the operator sees the
 *   //    misuse in the audit log.
 *   router.get('/:id', requireOwnership('farm'), getFarmHandler);
 *
 *   // 4. Admin-only router shorthand — every handler is gated by
 *   //    `authorize(super_admin / institutional_admin / admin /
 *   //    platform_admin)` automatically.
 *   const adminRouter = protectedRouter({ adminOnly: true });
 *
 * Why this helper exists
 * ──────────────────────
 *   The static scanner (`npm run security:routes`) catches
 *   missing-guard routes at build time. This helper is the
 *   COMPLEMENTARY safety net at runtime: even if a future
 *   developer forgets to add the guard middleware AND skips the
 *   scanner, the route physically cannot reach its handler
 *   unguarded — the registration-time wrapper detects the
 *   missing guard and terminates the call with a 404 (prod) or
 *   diagnostic 500 (dev).
 *
 *   The helper is OPT-IN. Existing routers are untouched;
 *   adopting it on new routes is a one-line edit
 *   (`Router()` → `protectedRouter()`).
 *
 * Strict-rule audit
 *   • Pure factory — never mutates global state, never throws.
 *   • Auto-applies `authenticate` (skip via `{ skipAuthenticate: true }`).
 *   • Logs `unguarded_route_blocked` events via the existing
 *     opsLogger so every block is visible in the admin audit
 *     surface.
 *   • Production responses leak no path / chain detail —
 *     consistent with the merged-blocker spec §10.
 *   • Dev responses include a precise diagnostic so engineers
 *     can fix the misuse without grepping logs.
 *   • Pure ESM, top-level imports only.
 */

import { Router } from 'express';
import { authenticate, authorize } from './auth.js';
import { logPermissionEvent } from '../utils/opsLogger.js';
import { config } from '../config/index.js';

// Path-param shapes that mark a route as resource-keyed.
// Adding a new id-shape is a one-line edit here.
export const ID_PARAM_RE =
  /:(?:id|farmId|farmerId|gardenId|scanId|taskId|userId|programId|orgId|inquiryId|listingId|cycleId|reportId|sessionId|inviteId|applicationId|buyerId|fieldVisitId|harvestId)\b/;

// Identifiers that satisfy the "this route is guarded" check
// when found by name on a middleware in the registration chain.
// Mirrors the scanner's `OWNERSHIP_TOKENS / ROLE_TOKENS / …`.
const GUARD_NAMES = new Set([
  // Ownership
  'requireOwnership',
  'requireFarmerOwnership',
  'requireOwnershipOrRole',
  'requireApplicationAccess',
  // Role
  'authorize',
  'requireRole',
  'requireAdmin',
  'blockRoles',
  // Composite (auth + role bundles)
  'adminGate',
  // Org / program scoping
  'extractOrganization',
  'verifyOrgAccess',
  'verifyProgramAccess',
  'requireProgramAccess',
  // Public-listing escape hatch
  'publicListingGuard',
]);

/**
 * Mark a function as a guard so the registration-time check
 * accepts it regardless of its `name`. Useful when wrapping a
 * guard in a domain-specific factory.
 *
 *   const requireBuyerTrustAccess = markAsGuard(
 *     requireRole('buyer', 'admin'),
 *   );
 */
export function markAsGuard(fn) {
  if (typeof fn === 'function') {
    Object.defineProperty(fn, '__isGuard', {
      value: true, configurable: true, writable: false, enumerable: false,
    });
  }
  return fn;
}

function _hasGuard(handlers, opts) {
  for (const h of handlers) {
    if (typeof h !== 'function') continue;
    if (h.__isGuard === true) return true;
    if (h.name && GUARD_NAMES.has(h.name)) return true;
  }
  if (opts && Array.isArray(opts.extraGuardNames) && opts.extraGuardNames.length > 0) {
    const extra = new Set(opts.extraGuardNames);
    for (const h of handlers) {
      if (typeof h === 'function' && h.name && extra.has(h.name)) return true;
    }
  }
  return false;
}

function _isIdShaped(path) {
  if (typeof path !== 'string') return false;
  return ID_PARAM_RE.test(path);
}

/**
 * Build a 404/500 terminator that runs in place of the
 * developer-supplied handler when an unguarded :id route is
 * registered on a protectedRouter.
 *
 * Production: 404 with a neutral "Not found" body so an
 * attacker probing the surface can't tell whether a route was
 * blocked or simply doesn't exist.
 * Development: 500 with a precise diagnostic naming the path
 * + verb so the engineer can fix the misuse immediately.
 *
 * Either way, the call is logged via opsLogger as
 * `unguarded_route_blocked` for the audit dashboard.
 */
function _unguardedTerminator(verb, path) {
  return function unguardedRouteBlocked(req, res, _next) {
    try {
      logPermissionEvent('unguarded_route_blocked', {
        verb,
        path,
        method:    req.method,
        url:       req.originalUrl || req.path,
        userId:    (req.user && (req.user.sub || req.user.id)) || null,
        role:      (req.user && req.user.role) || null,
        ip:        req.ip,
      });
    } catch { /* never let telemetry block the response */ }

    if (config && config.isProduction) {
      // Match the merged-blocker spec §10 — neutral 404 wording.
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(500).json({
      error: 'Unguarded route blocked by protectedRouter',
      verb:  verb.toUpperCase(),
      path,
      hint:  'Add requireOwnership(...) / requireRole(...) / verifyOrgAccess(...) '
           + '/ verifyProgramAccess(...) / publicListingGuard to the chain, OR '
           + 'wrap the guard with markAsGuard(fn).',
    });
  };
}

/**
 * publicListingGuard — explicit escape hatch for a route that
 * SHOULD be reachable without ownership because the resource
 * is flagged public.
 *
 * Strategy: defer to the handler. The middleware ALONE does
 * not establish public-ness — it ATTACHES a flag (`req.publicAccess = true`)
 * that downstream Prisma queries are expected to honor by
 * including `visibility: 'public'` in their `where` clause.
 *
 * This keeps the guard's responsibility small (a marker) while
 * still satisfying both the scanner and the registration-time
 * check.
 */
export const publicListingGuard = markAsGuard(function publicListingGuard(req, _res, next) {
  req.publicAccess = true;
  next();
});

/**
 * protectedRouter(opts?) → express.Router
 *
 * @param {object} [opts]
 * @param {boolean} [opts.adminOnly]  — auto-apply
 *                                       authorize('super_admin',
 *                                       'institutional_admin', 'admin',
 *                                       'platform_admin') so EVERY
 *                                       handler on this router is
 *                                       admin-gated.
 * @param {boolean} [opts.skipAuthenticate] — when true, do NOT auto-apply
 *                                       `authenticate`. Use only for
 *                                       routers mounted under an
 *                                       already-authenticated parent.
 * @param {string[]} [opts.extraGuardNames] — additional middleware names
 *                                       that count as guards (e.g.
 *                                       `['requireBuyerTrustAccess']`).
 *                                       Prefer `markAsGuard(fn)` in most
 *                                       cases.
 */
export function protectedRouter(opts = {}) {
  const router = Router();
  const adminOnly = opts.adminOnly === true;
  const skipAuth  = opts.skipAuthenticate === true;

  // Auto-apply authenticate so every route on this router is
  // 401-gated by default.
  if (!skipAuth) {
    router.use(authenticate);
  }

  // adminOnly === true → every route is also role-gated. The
  // role middleware is registered as router-wide so it runs
  // before any per-route middleware.
  if (adminOnly) {
    router.use(authorize(
      'super_admin', 'institutional_admin', 'admin', 'platform_admin',
    ));
  }

  // Wrap the verb methods so we can inspect the middleware
  // chain at registration time and inject the terminator when
  // the spec is violated.
  for (const verb of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = router[verb].bind(router);
    router[verb] = function wrappedVerb(path, ...handlers) {
      // adminOnly satisfies the guard requirement uniformly —
      // every handler is already role-gated by the router-wide
      // middleware, so :id routes don't need an additional
      // requireOwnership call.
      if (adminOnly) return original(path, ...handlers);

      // Non-:id paths pass through unchanged — only
      // resource-keyed routes need the additional guard check.
      if (!_isIdShaped(path)) return original(path, ...handlers);

      // :id-shaped path on a protected router. Inspect the
      // chain. If a guard is present, register normally.
      if (_hasGuard(handlers, opts)) return original(path, ...handlers);

      // Unguarded — replace with the terminator. The original
      // handlers are intentionally DROPPED so they cannot run
      // even by accident.
      return original(path, _unguardedTerminator(verb, path));
    };
  }

  return router;
}

// Test hook — internal helpers exposed for the unit suite.
export const _internal = Object.freeze({
  GUARD_NAMES,
  _hasGuard,
  _isIdShaped,
  _unguardedTerminator,
});

export default protectedRouter;
