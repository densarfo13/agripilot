/**
 * NGO Admin routes — /api/admin/*
 *
 *   GET  /api/admin/summary  → { totalFarmers, activeFarmers, newThisMonth, completionRate }
 *   GET  /api/admin/farmers  → [ { id, location, crop, stage, status, createdAt } ]
 *   GET  /api/admin/risk     → [ { region, farmers, risk } ]
 *   GET  /api/admin/export   → text/csv (RFC 4180)
 *
 * Data source: Prisma `farmEvent` table. All aggregation logic
 * lives in farmEventsService.js (pure, test-covered) — this
 * router is just the HTTP adapter.
 *
 * Auth: mount behind the same admin-role middleware used by
 * other admin routes. The router exports a factory so callers
 * can inject their own prisma client + auth middleware.
 */

const express = require('express');
const {
  buildSummary,
  buildFarmersList,
  buildRiskByRegion,
  buildCsvExport,
} = require('./farmEventsService.js');

function createNgoAdminRouter({ prisma, requireAdmin } = {}) {
  const router = express.Router();
  const adminGate = typeof requireAdmin === 'function'
    ? requireAdmin
    : (_req, _res, next) => next();

  // Pull all events within a safe window. For a production-scale
  // dataset we'd push the aggregation into SQL; this implementation
  // keeps the shape simple and lets tests cover the logic in pure
  // JS. Each endpoint uses the same fetch and runs its own aggregator.
  async function loadEvents(windowDays = 90) {
    if (!prisma || typeof prisma.farmEvent?.findMany !== 'function') {
      return [];
    }
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    return prisma.farmEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });
  }

  router.get('/summary', adminGate, async (_req, res) => {
    try {
      const events = await loadEvents(90);
      res.json(buildSummary(events));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ngoAdmin.summary]', err?.message);
      res.status(500).json({ error: 'summary failed' });
    }
  });

  router.get('/farmers', adminGate, async (req, res) => {
    try {
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
      const events = await loadEvents(90);
      res.json(buildFarmersList(events, { limit }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ngoAdmin.farmers]', err?.message);
      res.status(500).json({ error: 'farmers failed' });
    }
  });

  router.get('/risk', adminGate, async (_req, res) => {
    try {
      const events = await loadEvents(90);
      res.json(buildRiskByRegion(events));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ngoAdmin.risk]', err?.message);
      res.status(500).json({ error: 'risk failed' });
    }
  });

  router.get('/export', adminGate, async (req, res) => {
    try {
      const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit, 10) || 500));
      const events = await loadEvents(90);
      const csv = buildCsvExport(events, { limit });
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.attachment('farroway_export.csv');
      res.send(csv);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ngoAdmin.export]', err?.message);
      res.status(500).json({ error: 'export failed' });
    }
  });

  return router;
}

module.exports = { createNgoAdminRouter };
