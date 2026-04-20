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
const { calculateRisk } = require('./riskEngine.js');
const { estimateYield } = require('./yieldEngine.js');
const { getIntervention } = require('./interventionEngine.js');
const { generateAlerts }  = require('./alertService.js');

function createNgoAdminRouter(opts = {}) {
  const { prisma, requireAdmin } = opts;
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

  /**
   * /performance — per-farm risk + yield estimates.
   *
   * Iterates unique farms from the last 90 days of events,
   * computes the completion rate per farm, and runs risk +
   * yield engines. Weather is injected by an optional
   * `weatherFor(farm)` function the caller can pass in; when
   * absent, a neutral "unknown weather" profile is used so
   * the engines still produce deterministic output.
   */
  router.get('/performance', adminGate, async (_req, res) => {
    try {
      const events = await loadEvents(90);
      const farmList = buildFarmersList(events, { limit: 200 });

      // Completion rate per farm, derived from task_completed/task_seen ratio.
      const perFarmStats = new Map();
      for (const e of events) {
        if (!e || !e.farmId) continue;
        let s = perFarmStats.get(e.farmId);
        if (!s) { s = { completed: 0, seen: 0 }; perFarmStats.set(e.farmId, s); }
        if (e.eventType === 'task_completed') s.completed++;
        else if (e.eventType === 'task_seen') s.seen++;
      }

      const weatherFor = typeof opts?.weatherFor === 'function'
        ? opts.weatherFor
        : () => ({ rainExpected: false, extremeHeat: false });

      const out = farmList.map((f) => {
        const stats = perFarmStats.get(f.id) || { completed: 0, seen: 0 };
        const total = stats.completed + stats.seen;
        const completionRate = total > 0 ? stats.completed / total : 0.5;
        const weather = weatherFor(f) || {};
        const rainfall = Number.isFinite(weather.rainfall)
          ? weather.rainfall : (weather.rainExpected ? 25 : 15);

        const risk   = calculateRisk({ weather, completionRate, stage: f.stage });
        const yieldE = estimateYield({ crop: f.crop, rainfall, completionRate });

        return {
          farmId:        f.id,
          crop:          f.crop,
          region:        f.location,
          stage:         f.stage,
          completionRate,
          risk:          risk.level,
          riskScore:     risk.score,
          riskReasons:   risk.reasons,
          yield:         yieldE.estimated,
          yieldBaseline: yieldE.baseline,
          yieldDeltas:   yieldE.deltas,
        };
      });

      res.json(out);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ngoAdmin.performance]', err?.message);
      res.status(500).json({ error: 'performance failed' });
    }
  });

  /**
   * /interventions — admin-facing per-farm intervention plan.
   * Reuses the per-farm completionRate + stage computed for the
   * /performance endpoint so risk scoring stays consistent.
   */
  router.get('/interventions', adminGate, async (_req, res) => {
    try {
      const events = await loadEvents(90);
      const farmList = buildFarmersList(events, { limit: 200 });

      const perFarmStats = new Map();
      for (const e of events) {
        if (!e || !e.farmId) continue;
        let s = perFarmStats.get(e.farmId);
        if (!s) { s = { completed: 0, seen: 0 }; perFarmStats.set(e.farmId, s); }
        if (e.eventType === 'task_completed') s.completed++;
        else if (e.eventType === 'task_seen') s.seen++;
      }

      const weatherFor = typeof opts?.weatherFor === 'function'
        ? opts.weatherFor
        : () => ({ rainTomorrow: false, rainExpected: false, extremeHeat: false });

      const out = farmList.map((f) => {
        const stats = perFarmStats.get(f.id) || { completed: 0, seen: 0 };
        const total = stats.completed + stats.seen;
        const completionRate = total > 0 ? stats.completed / total : 0.5;
        const weather = weatherFor(f) || {};

        const risk = calculateRisk({ weather, completionRate, stage: f.stage });
        const intervention = getIntervention({
          risk: risk.level, crop: f.crop, stage: f.stage,
        });
        const alerts = generateAlerts({ risk: risk.level, weather });

        return {
          farmId:       f.id,
          region:       f.location,
          crop:         f.crop,
          stage:        f.stage,
          risk:         risk.level,
          riskScore:    risk.score,
          intervention, // { level, actionKey, actionFallback, stepKeys[], stepFallbacks[] }
          alerts,       // [{ id, severity, key, params, fallback }]
        };
      })
      // Surface highest-priority farms first so admins triage quickly.
      .sort((a, b) => {
        const sev = { critical: 3, warning: 2, safe: 1 };
        return (sev[b.intervention.level] || 0) - (sev[a.intervention.level] || 0);
      });

      res.json(out);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ngoAdmin.interventions]', err?.message);
      res.status(500).json({ error: 'interventions failed' });
    }
  });

  /**
   * /alerts — farmer-facing endpoint. Accepts ?farmId=X and
   * returns the alerts for JUST that farm. Kept on the admin
   * router for now since it uses the same Prisma client and
   * weather source; mount path can be aliased by the caller
   * (e.g. app.use('/api/alerts', <thin wrapper>)) if desired.
   */
  router.get('/alerts/:farmId', adminGate, async (req, res) => {
    try {
      const farmId = String(req.params.farmId || '');
      if (!farmId) return res.status(400).json({ error: 'missing farmId' });

      const events = await loadEvents(90);
      const farmEvents = events.filter((e) => e && e.farmId === farmId);
      if (farmEvents.length === 0) {
        return res.json({ farmId, risk: 'low', alerts: [] });
      }

      let completed = 0, seen = 0;
      for (const e of farmEvents) {
        if (e.eventType === 'task_completed') completed++;
        else if (e.eventType === 'task_seen') seen++;
      }
      const total = completed + seen;
      const completionRate = total > 0 ? completed / total : 0.5;
      const latest = farmEvents[0]; // ordered desc by loadEvents
      const stage  = (latest.payload && (latest.payload.stage || latest.payload.cropStage)) || null;

      const weatherFor = typeof opts?.weatherFor === 'function'
        ? opts.weatherFor
        : () => ({ rainTomorrow: false });
      const weather = weatherFor({ id: farmId, stage, crop: latest.crop, region: latest.region }) || {};

      const risk = calculateRisk({ weather, completionRate, stage });
      const alerts = generateAlerts({ risk: risk.level, weather });

      res.json({ farmId, risk: risk.level, alerts });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ngoAdmin.alerts]', err?.message);
      res.status(500).json({ error: 'alerts failed' });
    }
  });

  return router;
}

module.exports = { createNgoAdminRouter };
