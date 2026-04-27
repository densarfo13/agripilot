/**
 * sync/routes.js — POST /api/sync
 *
 * Drains the client-side outbox produced by
 * src/sync/actionQueue.js. Per the spec section 6 of the
 * outbreak system + the production-ready architecture commit:
 *
 *   * Server idempotency keys off `action.id`. The same id
 *     received twice is treated as already-processed and the
 *     handler returns 200 with `replayed: true` so the client
 *     deletes the action from its queue.
 *
 *   * Action types we explicitly handle today:
 *       OUTBREAK_REPORT  - persist on a Prisma model when
 *                          available; fall back to a minimal
 *                          in-memory aggregate so the rest of
 *                          the contract stays useful in
 *                          environments where the migration
 *                          hasn't run yet.
 *
 *   * Other action types accept-and-ignore so the client queue
 *     can drain cleanly while we add handlers later.
 *
 * Idempotency
 * ───────────
 * We don't use the `idempotencyCheck` middleware here because
 * the dedupe key the client sends is `action.id` in the body,
 * not the X-Idempotency-Key header. We store action ids in a
 * small in-memory LRU keyed `${userId}:${actionId}` with a
 * 24-hour TTL. That covers the realistic outbox-replay window
 * (the client retries on every drain + on `online` events).
 *
 * Auth
 * ────
 * Wrapped in `authenticate` so the action.userId is the one
 * we trust. Anonymous traffic isn't accepted - the route is
 * mounted under /api/sync after the apiLimiter and global auth
 * middleware in app.js.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

/* ─── In-memory dedupe ledger ─────────────────────────────────── */

const TTL_MS    = 24 * 60 * 60 * 1000; // 24 hours
const MAX_KEYS  = 50_000;

const ledger = new Map(); // key -> expiresAt

function _cleanExpired() {
  const now = Date.now();
  for (const [k, exp] of ledger) {
    if (exp <= now) ledger.delete(k);
  }
}

function _seenBefore(userId, actionId) {
  const key = `${userId}:${actionId}`;
  const exp = ledger.get(key);
  if (exp && exp > Date.now()) return true;
  return false;
}

function _markSeen(userId, actionId) {
  const key = `${userId}:${actionId}`;
  ledger.set(key, Date.now() + TTL_MS);
  if (ledger.size > MAX_KEYS) _cleanExpired();
}

/* ─── Action dispatch ─────────────────────────────────────────── */

async function _handleOutbreakReport(req, action) {
  const payload = action && action.payload;
  if (!payload || typeof payload !== 'object') {
    return { ok: false, reason: 'empty_payload' };
  }

  // Best-effort persistence. Try the optional Prisma model first
  // - when the migration that adds OutbreakReport has been
  // applied this writes durably; otherwise we still acknowledge
  // the action so the client queue drains.
  try {
    const { prisma } = await import('../../config/database.js');
    if (prisma && prisma.outbreakReport && typeof prisma.outbreakReport.upsert === 'function') {
      await prisma.outbreakReport.upsert({
        where:  { id: String(payload.id || action.id) },
        update: {}, // idempotent - existing row stays
        create: {
          id:        String(payload.id || action.id),
          userId:    String(req.user && req.user.sub) || null,
          farmId:    payload.farmId   || null,
          farmerId:  payload.farmerId || null,
          crop:      payload.crop     || null,
          issueType: payload.issueType || 'unknown',
          severity:  payload.severity  || 'low',
          symptoms:  Array.isArray(payload.symptoms) ? payload.symptoms : [],
          notes:     typeof payload.notes === 'string' ? payload.notes : '',
          country:   payload.location && payload.location.country  || '',
          region:    payload.location && payload.location.region   || '',
          district:  payload.location && payload.location.district || '',
          lat:       payload.location && Number.isFinite(Number(payload.location.lat)) ? Number(payload.location.lat) : null,
          lng:       payload.location && Number.isFinite(Number(payload.location.lng)) ? Number(payload.location.lng) : null,
          createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
        },
      });
      return { ok: true, persisted: 'prisma' };
    }
  } catch (err) {
    // Fall through to the in-memory aggregate below.
    try { console.warn('[sync] outbreakReport prisma write failed:', err && err.message); }
    catch { /* console missing */ }
  }

  // No Prisma model yet - keep an ephemeral aggregate so the
  // contract stays useful for staging + tests. This lives only
  // in process memory; restart drops it.
  try {
    if (!global.__farrowayOutbreakReports) global.__farrowayOutbreakReports = [];
    global.__farrowayOutbreakReports.push({
      ...payload,
      receivedAt: Date.now(),
      userId: String(req.user && req.user.sub) || null,
    });
  } catch { /* swallow */ }
  return { ok: true, persisted: 'memory' };
}

const HANDLERS = {
  OUTBREAK_REPORT: _handleOutbreakReport,
};

/* ─── Route ───────────────────────────────────────────────────── */

router.post('/', authenticate, asyncHandler(async (req, res) => {
  const action = req.body || {};
  const id   = action && action.id   ? String(action.id)   : '';
  const type = action && action.type ? String(action.type) : '';

  if (!id || !type) {
    return res.status(400).json({
      error: 'sync action requires id + type',
    });
  }

  const userId = String(req.user && req.user.sub) || 'anon';

  // Idempotency: replay returns 200 so the client deletes from
  // its queue. We deliberately don't 409 - the client treats
  // 4xx as "drop" which is what we want for a replay too.
  if (_seenBefore(userId, id)) {
    return res.status(200).json({
      ok: true, replayed: true, id, type,
    });
  }

  const handler = HANDLERS[type];
  let outcome;
  if (typeof handler === 'function') {
    try { outcome = await handler(req, action); }
    catch (err) {
      try { console.warn('[sync] handler threw for', type, ':', err && err.message); }
      catch { /* console missing */ }
      // Don't mark seen on transient handler errors - lets the
      // client retry. Server errors return 5xx so the sync
      // worker keeps the action in the queue.
      return res.status(500).json({ error: 'handler_failed', type });
    }
  } else {
    // Unknown action type - accept-and-ignore so the queue
    // drains cleanly. Mark seen so a stale outbox doesn't loop
    // forever on an action no handler implements.
    outcome = { ok: true, persisted: 'noop' };
  }

  _markSeen(userId, id);
  return res.status(200).json({
    ok: !!(outcome && outcome.ok),
    replayed: false,
    id,
    type,
    persisted: outcome && outcome.persisted,
  });
}));

export default router;

/* ─── Test helpers (named export only - not used by router) ──── */

export function _resetLedgerForTests() {
  ledger.clear();
  try { delete global.__farrowayOutbreakReports; } catch { /* ignore */ }
}
