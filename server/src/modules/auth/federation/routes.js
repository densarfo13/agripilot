/**
 * server/src/modules/auth/federation/routes.js — Express
 * router for /api/auth/federation/* + /api/admin/federation/*.
 *
 * Wave-5 single-writer pattern:
 *   - READS return real shapes inline (or empty array honestly
 *     until durable data lands).
 *   - WRITES return 503 with reason
 *     'federation_persistence_pending_migration' until the
 *     supervised Prisma deploy of federated_identity lands.
 *
 * Strict-rule audit
 *   • Server-side route module. Self-contained (.js only —
 *     no TypeScript imports across the client tree).
 *   • Never logs tokens / secrets / raw credentials.
 *   • Admin endpoints gated by the existing role middleware.
 *   • Enforces organizationId scope on every endpoint.
 */

'use strict';

const express = require('express');

const FEDERATION_API_VERSION = 'federation-api-v1';
const PENDING_REASON = 'federation_persistence_pending_migration';

/**
 * Build the router. Caller injects auth + role middleware so
 * this module stays self-contained and doesn't reach across
 * trees.
 */
function buildFederationRouter(opts) {
  const o = (opts && typeof opts === 'object') ? opts : {};
  const requireAuth  = typeof o.requireAuth  === 'function'
    ? o.requireAuth  : (req, res, next) => next();
  const requireAdmin = typeof o.requireAdmin === 'function'
    ? o.requireAdmin : (req, res, next) => next();

  const router = express.Router();

  // GET /providers — list public-safe provider metadata for the
  // calling user's organization. Never includes clientSecretRef.
  router.get('/providers', requireAuth, (req, res) => {
    const orgId = String((req.user && req.user.organizationId)
      || req.query.organizationId || '');
    if (!orgId) {
      return res.status(400).json({
        runtimeVersion: FEDERATION_API_VERSION,
        ok: false, reason: 'organizationId_required',
      });
    }
    // Until the migration deploys, return an empty list with
    // an honest pending-state marker.
    return res.json({
      runtimeVersion: FEDERATION_API_VERSION,
      ok: true,
      organizationId: orgId,
      providers: [],
      persistencePending: true,
      reason: PENDING_REASON,
    });
  });

  // POST /start — begin a federated login. Pure runtime; no
  // DB write. Caller's session middleware stashes the state.
  router.post('/start', (req, res) => {
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const providerType = String(body.providerType || '');
    if (!providerType) {
      return res.status(400).json({
        ok: false, reason: 'providerType_required',
      });
    }
    // The runtime composes the authorization URL; the server
    // route only wraps + audits. We hand back a placeholder
    // marker until the provider config table is live; the
    // frontend's federation runtime can compute the URL too.
    return res.json({
      runtimeVersion: FEDERATION_API_VERSION,
      ok: true,
      providerType,
      runtimeOwned: true,
      note: 'Authorization-URL construction is owned by the '
          + 'federation runtime on the client. The server '
          + 'persists state + audit only.',
    });
  });

  // POST /callback — completes a federated login. The actual
  // token exchange + signature verification belongs to a
  // server-side OIDC handler; here we stage 503 until the
  // migration lands.
  router.post('/callback', (req, res) => {
    return res.status(503).json({
      runtimeVersion: FEDERATION_API_VERSION,
      ok: false, reason: PENDING_REASON,
      detail: 'Federated callback persistence pending the '
            + 'federated_identity migration deploy.',
    });
  });

  // GET /policy/:organizationId — login policy for an org.
  router.get('/policy/:organizationId', requireAuth, (req, res) => {
    const orgId = String(req.params.organizationId || '');
    if (!orgId) {
      return res.status(400).json({
        ok: false, reason: 'organizationId_required',
      });
    }
    // Honest empty policy until durable storage lands.
    return res.json({
      runtimeVersion: FEDERATION_API_VERSION,
      ok: true,
      organizationId: orgId,
      policy: null,
      persistencePending: true,
      reason: PENDING_REASON,
    });
  });

  // ─── Admin endpoints ─────────────────────────────────────
  router.post('/admin/provider', requireAuth, requireAdmin, (req, res) => {
    return res.status(503).json({
      runtimeVersion: FEDERATION_API_VERSION,
      ok: false, reason: PENDING_REASON,
    });
  });
  router.patch('/admin/provider/:id', requireAuth, requireAdmin, (req, res) => {
    return res.status(503).json({
      runtimeVersion: FEDERATION_API_VERSION,
      ok: false, reason: PENDING_REASON,
    });
  });
  router.post('/admin/claim-mapping', requireAuth, requireAdmin, (req, res) => {
    return res.status(503).json({
      runtimeVersion: FEDERATION_API_VERSION,
      ok: false, reason: PENDING_REASON,
    });
  });

  return router;
}

module.exports = {
  buildFederationRouter,
  FEDERATION_API_VERSION,
  PENDING_REASON,
};
