/**
 * middleware.js — reusable Express middleware for the
 * stabilization patch:
 *
 *   requireFields(fields[])  — 400 on missing body fields
 *   requireRole(roleOrRoles) — 403 on mismatched user.role
 *   standardResponse({
 *     ok(data), fail(error, status?)
 *   })                       — { success, data | error } wrapper
 *   asyncHandler(fn)         — wraps an async route handler so
 *                              unhandled rejections produce a
 *                              500 + structured error instead of
 *                              crashing the request
 */

/**
 * requireFields — ensures every field in `fields` is present
 * and non-empty on req.body. 400 otherwise with a standardized
 * error shape.
 */
function requireFields(fields) {
  const list = Array.isArray(fields) ? fields : [];
  return function requireFieldsMiddleware(req, res, next) {
    const body = req?.body || {};
    for (const f of list) {
      const v = body[f];
      if (v == null || v === '' ||
          (typeof v === 'string' && v.trim() === '')) {
        return res.status(400).json({
          success: false,
          error: `Missing field: ${f}`,
          missing: f,
        });
      }
    }
    return next();
  };
}

/**
 * requireRole — ensures req.user.role matches. Accepts a single
 * role string or an array. 403 on mismatch, 401 when user is
 * missing entirely.
 */
function requireRole(roleOrRoles) {
  const allowed = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return function requireRoleMiddleware(req, res, next) {
    const user = req?.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'unauthenticated' });
    }
    if (!allowed.includes(user.role)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }
    return next();
  };
}

/**
 * standardResponse — factory that returns { ok, fail } helpers
 * bound to a given res. Keeps every endpoint's response shape
 * uniform: `{ success: boolean, data? , error? }`.
 */
function standardResponse(res) {
  return {
    ok(data) {
      return res.json({ success: true, data: data == null ? null : data });
    },
    fail(error, status = 500) {
      const message = typeof error === 'string'
        ? error
        : (error && error.message) || 'Internal error';
      return res.status(status).json({ success: false, error: message });
    },
  };
}

/**
 * asyncHandler — wraps an async route so any thrown/awaited
 * rejection produces a standard 500 JSON instead of crashing
 * the process / hanging the request.
 *
 *   router.get('/x', asyncHandler(async (req, res) => {
 *     const rows = await svc.load();
 *     return standardResponse(res).ok(rows);
 *   }));
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    return Promise.resolve(fn(req, res, next)).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[asyncHandler]', err?.message || err);
      if (res.headersSent) return;
      res.status(500).json({
        success: false,
        error: err?.message || 'Internal error',
      });
    });
  };
}

export { requireFields, requireRole, standardResponse, asyncHandler };
export default { requireFields, requireRole, standardResponse, asyncHandler };
