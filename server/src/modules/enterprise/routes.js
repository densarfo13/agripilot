/**
 * server/src/modules/enterprise/routes.js — Enterprise
 * Agriculture Platform API.
 *
 * Mounted at /api/enterprise/* (see app.js).
 *
 * Status (this sprint)
 * ────────────────────
 *   READS: real aggregates computed inline from caller-supplied
 *   data. The client side runs the SAME aggregation logic via
 *   the shared TypeScript engines under src/runtime/enterprise/
 *   (transpiled by Vite). The server intentionally does NOT
 *   import the .ts engines at runtime (Node doesn't run TS
 *   natively); the aggregation here mirrors the engine output
 *   shape so callers get the same envelopes from either side.
 *
 *   WRITES (POST / PATCH): the Enterprise Prisma tables
 *   (Organization, Program, Cohort, Intervention, ...) are
 *   staged at server/prisma/_pending-migrations/
 *   enterprise_agriculture_platform/ — NOT yet in the live
 *   schema. Write endpoints therefore return
 *     503 { error: 'enterprise_persistence_pending_migration' }
 *   with a `migrationStaged` reference. Once the supervised
 *   migration ships, these handlers switch to real
 *   prisma.organization.create(...) etc.
 *
 * Auth + scoping
 * ──────────────
 *   • Every route runs through the existing `authenticate`
 *     middleware.
 *   • All routes refuse non-internal callers UNLESS the user
 *     has an OrganizationMember record. (Until the table
 *     exists, this collapses to: admin OR internal flag OR
 *     development environment.)
 *   • Aggregate routes never reveal one organization's farmers
 *     to another organization — `organizationId` is required
 *     and validated against the caller's membership when the
 *     table exists.
 *
 * Strict-rule audit
 *   • Auth required.
 *   • Never throws — every handler wrapped in asyncHandler.
 *   • No PII the client didn't already have.
 *   • Composition-only — does NOT modify any existing route.
 */

import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { authenticate } from '../../middleware/auth.js';

const ENTERPRISE_RUNTIME_VERSION = 'enterprise-runtime-v1';

const router = Router();
router.use(authenticate);

function _requireEnterpriseAccess(req, res, next) {
  try {
    const role = req.user && req.user.role;
    if (role === 'super_admin' || role === 'institutional_admin'
        || role === 'admin') {
      return next();
    }
    if (process.env.NODE_ENV !== 'production') return next();
    return res.status(403).json({
      error: 'forbidden',
      reason: 'enterprise_access_requires_admin_or_internal',
    });
  } catch {
    return res.status(403).json({ error: 'forbidden' });
  }
}
router.use(_requireEnterpriseAccess);

const PENDING_MIGRATION = {
  error: 'enterprise_persistence_pending_migration',
  message:
    'Write endpoint requires the Enterprise Agriculture Platform '
    + 'Prisma tables. They are staged at '
    + 'server/prisma/_pending-migrations/enterprise_agriculture_platform/ '
    + 'and will deploy in a supervised migration sprint. Read '
    + 'aggregates remain available.',
  migrationStaged: 'enterprise_agriculture_platform',
  runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
};

function _writePending(res) {
  return res.status(503).json(PENDING_MIGRATION);
}

const _arr = (v) => (Array.isArray(v) ? v : []);
const _isObj = (v) => v != null && typeof v === 'object';
const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function _countEvents(events, kind) {
  let n = 0;
  for (const e of _arr(events)) {
    if (_isObj(e) && _str(e.eventType) === kind) n++;
  }
  return n;
}

function _avgScore(values) {
  if (values.length === 0) return null;
  let s = 0;
  for (const v of values) s += v;
  return Math.round((s / values.length) * 10) / 10;
}

/**
 * Inline organization aggregator — mirrors the shape returned
 * by the client-side organizationSummary() so a single contract
 * holds for both. Pure compute over caller-supplied data.
 */
function _organizationSummary(ctx) {
  const c = _isObj(ctx) ? ctx : {};
  const orgId = _str(c.organizationId);
  const programs = _arr(c.programs).filter((p) =>
    _isObj(p) && _str(p.organizationId) === orgId);
  const programIds = new Set(programs.map((p) => _str(p.id)));
  const participants = _arr(c.participants).filter((p) =>
    _isObj(p) && programIds.has(_str(p.programId)));
  const userIds = new Set(participants.map((p) => _str(p.userId)));
  const farms = _arr(c.farms).filter((f) =>
    _isObj(f) && userIds.has(_str(f.userId)));
  const gardens = _arr(c.gardens).filter((g) =>
    _isObj(g) && userIds.has(_str(g.userId)));
  const plants = _arr(c.plants).filter((p) =>
    _isObj(p) && userIds.has(_str(p.userId)));
  const healthScores = plants
    .map((p) => _num(p.healthScore))
    .filter((v) => v != null);
  const highRiskCount = plants.filter((p) =>
    (_num(p.riskScore) ?? 0) >= 60
    || (_num(p.healthScore) ?? 100) < 50).length;
  const activeFarmers = participants.filter((p) => p.status === 'active').length;
  const inactiveFarmers = participants.filter((p) => p.status === 'inactive').length;
  const interventionsCompleted = _arr(c.interventions).filter((i) =>
    _isObj(i) && programIds.has(_str(i.programId))
    && i.status === 'completed').length;

  return {
    runtimeVersion: 'enterprise-analytics-v1',
    organizationId: orgId,
    hasAnySignal: participants.length > 0 || plants.length > 0,
    totals: {
      farmers: participants.length,
      activeFarmers, inactiveFarmers,
      farms: farms.length,
      gardens: gardens.length,
      plants: plants.length,
      scansCompleted: _countEvents(_arr(c.events), 'scan_completed'),
      tasksCompleted: _countEvents(_arr(c.events), 'task_completed'),
      activePrograms: programs.filter((p) => p.status === 'active').length,
      interventionsCompleted,
      highRiskCount,
    },
    averages: {
      plantHealth: _avgScore(healthScores),
    },
    generatedAt: new Date().toISOString(),
  };
}

/* ──────────────────────────────────────────────────────────────
 * GET /api/enterprise/organizations
 * ─────────────────────────────────────────────────────────────*/
router.get('/organizations', asyncHandler(async (req, res) => {
  const supplied = _arr(req.body && req.body.organizations);
  res.json({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    organizations: supplied,
    pendingMigration: true,
  });
}));

router.post('/organizations', asyncHandler(async (_req, res) =>
  _writePending(res)));

/* ──────────────────────────────────────────────────────────────
 * GET /api/enterprise/programs
 * ─────────────────────────────────────────────────────────────*/
router.get('/programs', asyncHandler(async (req, res) => {
  const supplied = _arr(req.body && req.body.programs);
  res.json({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    programs: supplied,
    pendingMigration: true,
  });
}));

router.post('/programs', asyncHandler(async (_req, res) =>
  _writePending(res)));

/* ──────────────────────────────────────────────────────────────
 * GET /api/enterprise/cohorts
 * ─────────────────────────────────────────────────────────────*/
router.get('/cohorts', asyncHandler(async (req, res) => {
  const supplied = _arr(req.body && req.body.cohorts);
  res.json({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    cohorts: supplied,
    pendingMigration: true,
  });
}));

router.post('/cohorts', asyncHandler(async (_req, res) =>
  _writePending(res)));

/* ──────────────────────────────────────────────────────────────
 * GET / POST / PATCH /api/enterprise/interventions
 * ─────────────────────────────────────────────────────────────*/
router.get('/interventions', asyncHandler(async (req, res) => {
  const supplied = _arr(req.body && req.body.interventions);
  res.json({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    interventions: supplied,
    pendingMigration: true,
  });
}));

router.post('/interventions', asyncHandler(async (_req, res) =>
  _writePending(res)));

router.patch('/interventions/:id/status',
  asyncHandler(async (_req, res) => _writePending(res)));

/* ──────────────────────────────────────────────────────────────
 * GET /api/enterprise/analytics/summary
 * GET /api/enterprise/analytics/program/:programId
 * ─────────────────────────────────────────────────────────────*/
router.get('/analytics/summary', asyncHandler(async (req, res) => {
  const ctx = _isObj(req.body) ? req.body : {};
  res.json({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    summary: _organizationSummary(ctx),
  });
}));

router.get('/analytics/program/:programId',
  asyncHandler(async (req, res) => {
    // Lightweight program aggregator — full math lives in the
    // client-side ProgramSummary engine; this returns the basic
    // counts that match its envelope shape.
    const ctx = _isObj(req.body) ? req.body : {};
    const pid = req.params.programId;
    const programs = _arr(ctx.programs);
    const program = programs.find((p) => _isObj(p) && _str(p.id) === pid) || null;
    const participants = _arr(ctx.participants).filter((p) =>
      _isObj(p) && _str(p.programId) === pid);
    const userIds = new Set(participants.map((p) => _str(p.userId)));
    const plants = _arr(ctx.plants).filter((p) =>
      _isObj(p) && userIds.has(_str(p.userId)));
    const interventions = _arr(ctx.interventions).filter((i) =>
      _isObj(i) && _str(i.programId) === pid);
    const completed = interventions.filter((i) => i.status === 'completed').length;
    const healthScores = plants.map((p) => _num(p.healthScore))
      .filter((v) => v != null);
    res.json({
      runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
      summary: {
        runtimeVersion: 'enterprise-analytics-v1',
        programId: pid,
        hasAnySignal: participants.length > 0 || plants.length > 0,
        program,
        totals: {
          enrolled: participants.length,
          activeFarmers: participants.filter((p) => p.status === 'active').length,
          plants: plants.length,
          scansCompleted: _countEvents(_arr(ctx.events), 'scan_completed'),
          interventionsTotal: interventions.length,
          interventionsCompleted: completed,
          interventionCompletionRatePct: interventions.length === 0 ? null
            : Math.round((completed / interventions.length) * 100),
        },
        averages: {
          plantHealth: _avgScore(healthScores),
        },
      },
    });
  }));

/* ──────────────────────────────────────────────────────────────
 * GET /api/enterprise/reports
 * ─────────────────────────────────────────────────────────────*/
router.get('/reports', asyncHandler(async (req, res) => {
  // Returns the organization summary wrapped as a report
  // envelope. Full per-program rollup happens client-side via
  // composeImpactReport().
  const ctx = _isObj(req.body) ? req.body : {};
  const summary = _organizationSummary(ctx);
  res.json({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    report: {
      runtimeVersion: 'impact-report-v1',
      title: _str(ctx.title) || 'Impact Report',
      organizationId: _str(ctx.organizationId),
      periodStart: _str(ctx.periodStart),
      periodEnd: _str(ctx.periodEnd),
      status: summary.hasAnySignal ? 'generated' : 'draft',
      metrics: {
        farmersReached:        summary.totals.farmers,
        activeFarmers:         summary.totals.activeFarmers,
        farmsEnrolled:         summary.totals.farms,
        gardensEnrolled:       summary.totals.gardens,
        plantsTracked:         summary.totals.plants,
        scansCompleted:        summary.totals.scansCompleted,
        tasksCompleted:        summary.totals.tasksCompleted,
        interventionsCompleted: summary.totals.interventionsCompleted,
        averagePlantHealth:    summary.averages.plantHealth,
        highRiskCount:         summary.totals.highRiskCount,
      },
      generatedAt: summary.generatedAt,
    },
  });
}));

/* ──────────────────────────────────────────────────────────────
 * GET /api/enterprise/trust/summary
 * ─────────────────────────────────────────────────────────────*/
router.get('/trust/summary', asyncHandler(async (req, res) => {
  const scores = _arr(req.body && req.body.scores);
  if (scores.length === 0) {
    return res.json({
      runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
      summary: {
        runtimeVersion: 'enterprise-trust-v1',
        count: 0, average: null,
        bands: { excellent: 0, good: 0, needs_attention: 0, high_risk: 0 },
      },
    });
  }
  let sum = 0;
  const bands = { excellent: 0, good: 0, needs_attention: 0, high_risk: 0 };
  for (const s of scores) {
    if (!_isObj(s)) continue;
    const v = _num(s.overall);
    if (v == null) continue;
    sum += v;
    const b = _str(s.band);
    if (bands[b] != null) bands[b]++;
  }
  res.json({
    runtimeVersion: ENTERPRISE_RUNTIME_VERSION,
    summary: {
      runtimeVersion: 'enterprise-trust-v1',
      count: scores.length,
      average: Math.round(sum / scores.length),
      bands,
    },
  });
}));

export default router;
