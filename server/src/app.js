import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authenticate, requireApprovedFarmer } from './middleware/auth.js';
import { extractOrganization } from './middleware/orgScope.js';
import prisma from './config/database.js';
import { checkUploadDirHealth, listDiskFiles } from './utils/uploadHealth.js';

// Route imports
import authRoutes from './modules/auth/routes.js';
import adminUserRoutes from './modules/auth/admin-routes.js';
// Client-event ingestion (data foundation v2) + NGO read APIs
import ingestRoutes from './modules/ingest/routes.js';
import ngoRoutes    from './modules/ingest/ngoRoutes.js';
import farmersRoutes from './modules/farmers/routes.js';
import applicationsRoutes from './modules/applications/routes.js';
import locationRoutes from './modules/location/routes.js';
import evidenceRoutes from './modules/evidence/routes.js';
import verificationRoutes from './modules/verification/routes.js';
import fraudRoutes from './modules/fraud/routes.js';
import decisionRoutes from './modules/decision/routes.js';
import benchmarkRoutes from './modules/benchmarking/routes.js';
import intelligenceRoutes from './modules/intelligence/routes.js';
import reviewRoutes from './modules/reviews/routes.js';
import portfolioRoutes from './modules/portfolio/routes.js';
import reportRoutes from './modules/reports/routes.js';
import auditRoutes from './modules/audit/routes.js';
import fieldVisitRoutes from './modules/field-visits/routes.js';
import activityRoutes from './modules/activities/routes.js';
import reminderRoutes from './modules/reminders/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import localizationRoutes from './modules/localization/routes.js';
import regionConfigRoutes from './modules/regionConfig/routes.js';
import postHarvestRoutes from './modules/postHarvest/routes.js';
import marketGuidanceRoutes from './modules/marketGuidance/routes.js';
import buyerInterestRoutes from './modules/buyerInterest/routes.js';
import { createMarketplaceRouter } from './modules/marketplace/routes.js';
import lifecycleRoutes from './modules/lifecycle/routes.js';
import seasonRoutes from './modules/seasons/routes.js';
import organizationRoutes from './modules/organizations/routes.js';
import pilotMetricsRoutes from './modules/pilotMetrics/routes.js';
import pilotQARoutes from './modules/pilotQA/routes.js';
import securityRoutes from './modules/security/routes.js';
import inviteRoutes from './modules/invites/routes.js';
import trustRoutes from './modules/trust/routes.js';
import taskRoutes from './modules/tasks/routes.js';
import systemRoutes from './modules/system/routes.js';
import feedbackRoutes from './modules/feedback/routes.js';
import mfaRoutes from './modules/mfa/routes.js';
import autoNotificationRoutes from './modules/autoNotifications/routes.js';
import performanceRoutes from './modules/performance/routes.js';
import farmProfileRoutes from './modules/farmProfiles/routes.js';
import programRoutes from './modules/programs/routes.js';
import weatherRoutes from './modules/weather/routes.js';
import financeScoreRoutes from './modules/financeScore/routes.js';
import referralRoutes from './modules/referral/routes.js';
import analyticsRoutes from './modules/analytics/routes.js';
import impactRoutes from './modules/impact/routes.js';
import issueRoutes from './modules/issues/routes.js';
import onboardingRoutes from './modules/onboarding/routes.js';
import emailRoutes from './modules/email/routes.js';
// Outbox-drainer endpoint for the local-first action queue
// (src/sync/actionQueue.js + src/sync/syncWorker.js on the
// client). Idempotent on action.id; first handler wired:
// OUTBREAK_REPORT.
import syncRoutes from './modules/sync/routes.js';

// ─── V2 enterprise auth routes (cookie-based) ──────────────
import v2AuthRoutes from '../routes/auth.js';
import v2FarmProfileRoutes from '../routes/farmProfile.js';
import v2CropSuggestionsRoutes from '../routes/cropSuggestions.js';
import v2UsRecommendationRoutes from '../routes/usRecommendations.js';
import v2IssueReportRoutes from '../routes/issueReports.js';
import v2VerificationRoutes from '../routes/verification.js';
import v2NgoDashboardRoutes from '../routes/ngoDashboard.js';
import v2CropCycleRoutes, { createFarmerTodayRouter } from '../routes/cropCycles.js';
import v2HarvestRoutes from '../routes/harvests.js';
import recommendationsRouter from '../routes/recommendations.js';
import marketRouter from '../routes/market.js';
import v2NgoDecisionRoutes from '../routes/ngoV2.js';
import v2MonitoringRoutes from '../routes/monitoring.js';
import v2WeatherRoutes from '../routes/weather.js';
import v2SeasonRoutes from '../routes/seasons.js';
import v2TaskRoutes from '../routes/tasks.js';
import v2AnalyticsRoutes from '../routes/analytics.js';
import v2SupportRoutes from '../routes/support.js';
import v2ExportRoutes from '../routes/exports.js';
import v2BulkRoutes from '../routes/bulk.js';
import v2AnalyticsSummaryRoutes from '../routes/analytics-summary.js';
import v2LandBoundaryRoutes from '../routes/land-boundaries.js';
import v2SeedScanRoutes from '../routes/seed-scans.js';
import v2VerificationSignalRoutes from '../routes/verification-signals.js';
import v2SupplyReadinessRoutes from '../routes/supply-readiness.js';
import v2BuyerRoutes from '../routes/buyers.js';
import v2BuyerLinkRoutes from '../routes/buyer-links.js';
import v2BuyerTrustRoutes from '../routes/buyer-trust.js';
import v2TtsRoutes from '../routes/tts.js';
import v2FarmTaskRoutes from '../routes/farmTasks.js';
import v2FarmWeatherRoutes from '../routes/farmWeather.js';
import v2FarmRiskRoutes from '../routes/farmRisks.js';
import v2FarmInputRoutes from '../routes/farmInputs.js';
import v2FarmHarvestRoutes from '../routes/farmHarvest.js';
import v2HarvestRecordRoutes from '../routes/harvestRecords.js';
import v2FarmCostRoutes from '../routes/farmCosts.js';
import v2FarmBenchmarkRoutes from '../routes/farmBenchmarks.js';
import v2WeeklySummaryRoutes from '../routes/weeklySummary.js';
// V1 JS intelligence routes (kept as fallback — replaced by TS module below)
// import v2PestRiskRoutes from '../routes/pest-risk.js';
// import v2IntelligenceAdminRoutes from '../routes/intelligence-admin.js';
// import v2IntelligenceIngestRoutes from '../routes/intelligence-ingest.js';

// V2 TypeScript intelligence module (pest-risk, admin, ingest routes)
import { intelligenceRouter } from '../intelligence/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─── Trust Proxy (required for rate limiting behind Render/Docker proxy) ──
if (config.isProduction) {
  app.set('trust proxy', 1);
}

// ─── Canonical Domain Redirect ────────────────────────────────────────
// In production, redirect old/www domains to the canonical https://farroway.app
if (config.isProduction) {
  app.use((req, res, next) => {
    const host = (req.hostname || req.headers.host || '').replace(/:\d+$/, '');
    const canonicalHost = 'farroway.app';
    // Redirect www.farroway.app, farroways.com, www.farroways.com, and old railway domain
    const redirectHosts = ['www.farroway.app', 'farroways.com', 'www.farroways.com', 'agripilot-production.up.railway.app'];
    if (redirectHosts.includes(host)) {
      return res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);
    }
    next();
  });
}

// ─── Production Static Assets (served early, before API middleware) ─────
// Must be registered before API routes so asset requests never hit the API
// middleware chain. The SPA fallback (app.get('*')) remains at the bottom.
//
// PWA-critical assets (icons, manifest, favicon) are mounted UNCONDITIONALLY
// when dist/ exists on disk. Why: if NODE_ENV drifts from 'production' on the
// deploy host (Railway/Render env-var drift), config.isProduction reads
// false, the static handler below never mounts, and the SPA catch-all at the
// bottom returns index.html for /icons/icon-192.png. Chrome then tries to
// parse HTML as PNG and the manifest icon fails with "Download error or
// resource isn't a valid image". Mounting the PWA paths unconditionally
// guarantees they always serve real bytes from disk.
const _distPath = path.join(__dirname, '../../dist');
if (fs.existsSync(_distPath)) {
  // Long-cache PWA assets — they are content-hashed at the icon path (size in
  // filename) and the manifest is cheap to revalidate.
  const pwaCache = { maxAge: '7d', immutable: false };
  app.use('/icons', express.static(path.join(_distPath, 'icons'), pwaCache));
  app.use('/manifest.json',
    express.static(path.join(_distPath, 'manifest.json'), pwaCache));
  app.use('/manifest.webmanifest',
    express.static(path.join(_distPath, 'manifest.webmanifest'), pwaCache));
  app.use('/favicon.ico',
    express.static(path.join(_distPath, 'favicon.ico'), pwaCache));
  app.use('/apple-touch-icon.png',
    express.static(path.join(_distPath, 'apple-touch-icon.png'), pwaCache));
  app.use('/sw.js',
    express.static(path.join(_distPath, 'sw.js'),
      { maxAge: '0', etag: true })); // SW must always revalidate
  app.use('/robots.txt',
    express.static(path.join(_distPath, 'robots.txt'), pwaCache));
}

if (config.isProduction) {
  app.use(express.static(_distPath));
}

// ─── Security Headers ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Vite bundles use inline scripts; configure CSP via reverse proxy if needed
  crossOriginEmbedderPolicy: false, // allow loading images from uploads
}));

// ─── CORS ──────────────────────────────────────────────
const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'x-user-id'],
};

if (config.cors.origins.includes('*')) {
  // Wildcard — allow all origins (explicit opt-in)
  corsOptions.origin = true;
} else if (config.cors.origins.length > 0) {
  // Production: restrict to configured origins
  corsOptions.origin = (origin, callback) => {
    // Allow requests with no origin (server-to-server, mobile apps)
    if (!origin || config.cors.origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  };
} else if (config.isProduction) {
  // Production with no CORS_ORIGIN set — allow same-origin (no Origin header) requests only
  corsOptions.origin = (origin, callback) => {
    if (!origin) callback(null, true);
    else callback(new Error(`CORS: origin ${origin} not allowed`));
  };
} else {
  // Development: allow all origins
  corsOptions.origin = true;
}

app.use(cors(corsOptions));

// ─── Cookie Parser (for httpOnly cookie auth) ─────────
app.use(cookieParser());

// ─── Body Parsing ──────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Request ID & Structured Logging ──────────────────
app.use(requestId);
app.use(requestLogger);

// ─── Rate Limiters ─────────────────────────────────────
// Early-scale infra spec §7 — when REDIS_URL is present, use a
// Redis-backed rate-limit store so caps stay consistent across
// API replicas. When Redis is unset, fall back to the in-process
// memory store (per-replica caps) — fine for the 1k–10k tier and
// for local dev. The store is loaded lazily so the build never
// requires `rate-limit-redis`/`ioredis` to be installed.
let _rateLimitStoreFactory = null; // (prefix) => RedisStore | undefined
(async () => {
  try {
    if (!process.env.REDIS_URL) return;
    const [{ default: RedisStore }, { default: IORedis }] = await Promise.all([
      import('rate-limit-redis').catch(() => ({ default: null })),
      import('ioredis').catch(() => ({ default: null })),
    ]);
    if (!RedisStore || !IORedis) return;
    const client = new IORedis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    client.on('error', () => { /* silent — limiter degrades to memory */ });
    _rateLimitStoreFactory = (prefix) => new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `farroway:rl:${prefix}:`,
    });
  } catch { /* never propagate — falls back to memory store */ }
})();

function _rlStore(prefix) {
  if (!_rateLimitStoreFactory) return undefined;
  try { return _rateLimitStoreFactory(prefix); } catch { return undefined; }
}

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (relaxed for pilot)
  max: 30, // 30 auth requests per 5 min per IP (covers login + refresh + me)
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // successful requests don't count toward limit
  store: _rlStore('auth'),
  // Uses default keyGenerator (request IP via express trust proxy)
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/v2/auth/'), // auth has its own limiter
  store: _rlStore('api'),
});

// Production infra spec §2: domain-specific rate limits.
// Scan is moderate (image upload + AI-heavy), funding +
// sell are generous (forms + reads), all stricter than the
// per-IP /api default to protect cost-sensitive paths.
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,             // 1 minute
  max: 30,                          // 30 scans/min/IP — moderate
  message: { error: 'Too many scan requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: _rlStore('scan'),
});
const fundingLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                          // 60 funding requests/min/IP
  message: { error: 'Too many funding requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: _rlStore('funding'),
});
const sellLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                          // 60 sell/listing requests/min/IP
  message: { error: 'Too many marketplace requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: _rlStore('sell'),
});

// Apply API-wide rate limiter to all /api routes (auth excluded — has authLimiter)
app.use('/api', apiLimiter);

// Domain limiters — applied AFTER the general limiter so a
// hostile flood is bounded by the strictest applicable rule.
// Path matchers are deliberately broad (regex) so /api/v1
// + /api/v2 + /api/scan-* all inherit the cap.
app.use(/^\/api\/(v\d+\/)?(scan|pest-scan|crop-scan|image-scan)/i,        scanLimiter);
app.use(/^\/api\/(v\d+\/)?(funding|opportunities|fund-application)/i,     fundingLimiter);
app.use(/^\/api\/(v\d+\/)?(market|listing|listings|sell|buyer-interest)/i, sellLimiter);

// ─── Uploads: authenticated static serving ─────────────
// Files require a valid JWT to download (prevents public access to evidence)
app.use('/uploads', authenticate, express.static(path.join(__dirname, '../uploads')));

// ─── Health Check ───────────────────────────────────────
// Production infra spec §1: response shape is
//   { status, db, uptime, timestamp }
// `uptime` is process uptime in seconds (whole-number rounded).
// `db: 'ok' | 'down'` lets the load balancer distinguish a
// fully-degraded instance from a transient db blip.
// `/health` is exposed alongside `/api/health` as a route alias
// so a load-balancer can probe either path without coupling
// to the API prefix.
const _serverStartedAt = Date.now();
async function _healthHandler(_req, res) {
  let dbStatus = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch { dbStatus = 'down'; }
  const uptime = Math.floor((Date.now() - _serverStartedAt) / 1000);
  const body = {
    status:    dbStatus === 'ok' ? 'ok' : 'degraded',
    db:        dbStatus,
    uptime,
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  };
  res.status(dbStatus === 'ok' ? 200 : 503).json(body);
}
app.get('/api/health', _healthHandler);
app.get('/health',     _healthHandler);

// ─── ML scan endpoints (advanced ML layer spec) ───────────────
// Pipeline:
//   POST /api/scan/analyze
//     → preprocessImage (validate, size cap, optional EXIF strip)
//     → analyzePlantImage (external provider OR rule fallback)
//     → fuseContext (weather + experience + region rules)
//     → applySafetyFilter (strip unsafe language, append disclaimer)
//     → persist scan_training_events row
//     → return safe verdict
//   POST /api/scan/feedback
//     → save user feedback for future ML training
// Both endpoints are auth-only — the global /api limiter +
// scanLimiter (regex-matched) cap volume.
app.post('/api/scan/analyze', authenticate, async (req, res) => {
  try {
    const {
      imageBase64, imageUrl,
      cropName, plantName,
      country, region,
      activeExperience,
      weather,
    } = req.body || {};

    const { preprocessImage } = await import('./ml/preprocessImage.js');
    const { analyzePlantImage } = await import('./ml/scanInferenceService.js');
    const { fuseContext } = await import('./ml/contextFusionEngine.js');
    const { applySafetyFilter } = await import('./ml/scanSafetyFilter.js');

    const pre = await preprocessImage({ base64: imageBase64, url: imageUrl });
    if (!pre.ok) {
      return res.status(400).json({ error: 'image_rejected', reason: pre.reason });
    }

    // Pull recent scan history for the same user to feed the
    // "repeated issue → escalate urgency" rule.
    let scanHistory = [];
    try {
      scanHistory = await prisma.scanTrainingEvent.findMany({
        where:    { userId: req.user?.id || null },
        orderBy:  { createdAt: 'desc' },
        take:     20,
        select:   { predictedIssue: true, createdAt: true },
      });
      scanHistory = scanHistory.map((r) => ({
        possibleIssue: r.predictedIssue, createdAt: r.createdAt.toISOString(),
      }));
    } catch { scanHistory = []; }

    const inference = await analyzePlantImage({
      image:    pre.image,
      mime:     pre.mime,
      cropName, plantName,
      country,  region,
      weather,
    });

    const fused = fuseContext({
      symptom:    inference.symptom,
      confidence: inference.confidence,
      activeExperience,
      country, region, weather,
      scanHistory,
    });

    // Engine output is a "raw" verdict — pass it through the
    // safety filter before sending to the client.
    const followUpTask = (fused.contextType === 'garden')
      ? { id: 'ml_followup_garden', title: 'Check this plant again tomorrow',
          reason: 'Confirm whether the issue has changed.', urgency: 'medium' }
      : { id: 'ml_followup_farm',   title: 'Scout nearby crop area tomorrow',
          reason: 'Check whether the issue is contained.', urgency: 'medium' };

    const safe = applySafetyFilter({
      ...fused,
      followUpTask,
      // Recommended actions are filled in by the frontend hybrid
      // engine using its garden/farm action tables. The server
      // returns the issue + confidence + context the frontend
      // needs to pick the right action set.
      recommendedActions: [],
    });

    // Persist the training event (fire-and-forget — don't block
    // the response on the DB write).
    try {
      await prisma.scanTrainingEvent.create({
        data: {
          scanId:         req.body?.scanId || ('scan_' + Date.now().toString(36)),
          userId:         req.user?.id || null,
          imageUrl:       imageUrl || null,
          cropName:       cropName  || null,
          plantName:      plantName || null,
          country:        country   || null,
          region:         region    || null,
          weatherSummary: weather   || null,
          predictedIssue: safe.possibleIssue,
          confidence:     safe.confidence,
        },
      });
    } catch { /* swallow — analytics row is best-effort */ }

    return res.json({
      ok:           true,
      verdict:      safe,
      inferenceMeta: {
        provider:     inference.meta?.provider || null,
        latencyMs:    inference.meta?.latencyMs || 0,
        fallbackUsed: !!inference.fallbackUsed,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: 'scan_analyze_failed', message: err && err.message });
  }
});

app.post('/api/scan/feedback', authenticate, async (req, res) => {
  try {
    const { scanId, userFeedback, correctedIssue } = req.body || {};
    if (!scanId || !userFeedback) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }
    const allowed = new Set(['helpful', 'not_helpful', 'not_sure']);
    if (!allowed.has(String(userFeedback))) {
      return res.status(400).json({ error: 'invalid_feedback' });
    }
    // Find the most recent training row for this scan + user
    // and update it with the feedback. Don't error if missing —
    // some scans run before the migration is applied.
    try {
      const row = await prisma.scanTrainingEvent.findFirst({
        where:   { scanId, userId: req.user?.id || null },
        orderBy: { createdAt: 'desc' },
      });
      if (row) {
        await prisma.scanTrainingEvent.update({
          where: { id: row.id },
          data:  {
            userFeedback:   String(userFeedback),
            correctedIssue: correctedIssue ? String(correctedIssue).slice(0, 200) : null,
          },
        });
      }
    } catch { /* swallow */ }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'scan_feedback_failed', message: err && err.message });
  }
});


// ─── Extended Health Check (admin-only) ────────────────────
app.get('/api/ops/health', authenticate, async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    // DB latency
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - dbStart;

    // Upload dir health
    const uploadHealth = checkUploadDirHealth();

    // Evidence file count in DB
    const evidenceCount = await prisma.evidenceFile.count();

    // Active season count
    const activeSeasons = await prisma.farmSeason.count({ where: { status: 'active' } });

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: { connected: true, latencyMs: dbLatencyMs },
      uploads: uploadHealth,
      counts: {
        evidenceFiles: evidenceCount,
        diskFiles: uploadHealth.fileCount,
        orphanRisk: uploadHealth.fileCount - evidenceCount, // positive = potential orphans
        activeSeasons,
      },
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// ─── Ops: Orphaned file detection (admin-only) ─────────────
app.get('/api/ops/orphaned-files', authenticate, async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    const diskFiles = listDiskFiles();
    if (diskFiles.length === 0) return res.json({ orphans: [], count: 0 });

    // Get all filenames tracked in DB
    const dbFiles = await prisma.evidenceFile.findMany({
      select: { filename: true },
    });
    const dbFilenames = new Set(dbFiles.map(f => f.filename));

    // Also check progress entry image URLs (they store /uploads/filename)
    const progressImages = await prisma.seasonProgressEntry.findMany({
      where: { imageUrl: { not: null } },
      select: { imageUrl: true },
    });
    for (const pi of progressImages) {
      if (pi.imageUrl && pi.imageUrl.startsWith('/uploads/')) {
        dbFilenames.add(pi.imageUrl.replace('/uploads/', ''));
      }
    }

    const orphans = diskFiles.filter(f => !dbFilenames.has(f.filename));

    res.json({
      orphans: orphans.slice(0, 100), // limit response size
      count: orphans.length,
      totalDiskFiles: diskFiles.length,
      totalDbReferences: dbFilenames.size,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to detect orphans', details: err.message });
  }
});

// ─── Ops: Quick pilot metrics (admin + field officer) ──────
app.get('/api/ops/metrics', authenticate, async (req, res) => {
  const allowed = ['super_admin', 'institutional_admin', 'field_officer'];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient access' });
  }
  try {
    const [farmers, seasons, apps, users, pendingReg] = await Promise.all([
      prisma.farmer.count(),
      prisma.farmSeason.groupBy({ by: ['status'], _count: true }),
      prisma.application.groupBy({ by: ['status'], _count: true }),
      prisma.user.count({ where: { active: true } }),
      prisma.farmer.count({ where: { registrationStatus: 'pending_approval' } }),
    ]);

    const seasonMap = {};
    seasons.forEach(s => { seasonMap[s.status] = s._count; });
    const appMap = {};
    apps.forEach(a => { appMap[a.status] = a._count; });

    res.json({
      timestamp: new Date().toISOString(),
      farmers: { total: farmers },
      seasons: seasonMap,
      applications: appMap,
      users: { active: users, pendingRegistrations: pendingReg },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load metrics' });
  }
});

// ─── Auth (public — with stricter rate limiting) ────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', adminUserRoutes);

// ─── Ingest + NGO aggregates (data foundation v2) ───────
// /api/ingest accepts batched client events idempotently.
// /api/ngo/* serves the NGO dashboard summary / regions /
// clusters from the same store. Both auth-gated inside their
// own route modules; mounted at the root /api so the spec's
// path (/ingest, /ngo/summary, /ngo/regions, /ngo/clusters)
// matches verbatim.
app.use('/api/ingest', ingestRoutes);
app.use('/api/ngo',    ngoRoutes);

// ─── /me endpoint ───────────────────────────────────────
// V1 admin /me (used by older admin tools). V2 farmer-facing
// /me lives at /api/v2/auth/me with its own hardening.
// Both share the never-throw + JSON-always envelope so a Prisma
// blip can't break either client's boot sequence.
app.get('/api/me', authenticate, async (req, res) => {
  try {
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ error: 'Unauthorized', code: 'no_subject' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true, email: true, fullName: true, role: true, active: true, createdAt: true,
        organizationId: true,
        organization: { select: { id: true, name: true, type: true } },
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'user_not_found' });
    }
    return res.json(user);
  } catch (err) {
    const msg = err && err.message ? String(err.message).slice(0, 200) : 'unknown';
    // eslint-disable-next-line no-console
    console.error('[ME V1 ERROR]', msg, err);
    return res.status(503).json({
      error: 'Failed to load user. Please try again.',
      code: 'me_lookup_failed',
    });
  }
});

// ─── Protected API Routes ───────────────────────────────
// Note: /api/farmers handles its own /me endpoint (no approval gate for viewing own profile).
// The requireApprovedFarmer middleware is applied inside individual route files where needed.
app.use('/api/farmers', farmersRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/decision', decisionRoutes);
app.use('/api/benchmark', benchmarkRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/field-visits', fieldVisitRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/localization', localizationRoutes);
app.use('/api/region-config', regionConfigRoutes);
app.use('/api/post-harvest', postHarvestRoutes);
app.use('/api/market-guidance', marketGuidanceRoutes);
app.use('/api/buyer-interest', buyerInterestRoutes);

// ─── Marketplace (farmer listings + buyer requests) ──────────
// Feature-flagged behind FEATURES.marketplace so it can be rolled
// out to a subset of environments. authenticate handles cookie +
// bearer tokens and exposes req.user; admin-only routes inside the
// router layer on an additional role check.
app.use('/api/marketplace', createMarketplaceRouter({
  prisma,
  requireAuth:  authenticate,
  requireAdmin: authenticate,  // admin-role check lives in router via requireRole
  // Hard-enable the marketplace feature at mount time. The router
  // still honours requireFeature internally but this predicate
  // short-circuits it to on — Railway env vars
  // (FARROWAY_FEATURE_MARKETPLACE=0) can still kill the surface
  // since we fall back to the global predicate when this fn is
  // absent, but while the marketplace is live we want the flag ON.
  isEnabled:    () => true,
}));
app.use('/api/lifecycle', lifecycleRoutes);
app.use('/api/seasons', seasonRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/pilot', pilotMetricsRoutes);
app.use('/api/pilot-qa', pilotQARoutes);
app.use('/api/security', securityRoutes);
app.use('/api/invites', inviteRoutes); // public invite acceptance (rate-limited internally)
app.use('/api/trust', trustRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/auto-notifications', autoNotificationRoutes);
app.use('/api/email', authenticate, emailRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/v1/farms', farmProfileRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1', weatherRoutes); // mounts /farms/:farmId/weather and /insights/recommend under /api/v1
app.use('/api/v1/farms', financeScoreRoutes);
app.use('/api/v1/referral', referralRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/impact', impactRoutes);

// ─── V2 Enterprise Auth (cookie-based, httpOnly) ────────
app.use('/api/v2/auth', authLimiter, v2AuthRoutes);
app.use('/api/v2/farm-profile', v2FarmProfileRoutes);
app.use('/api/v2/farm-tasks', v2FarmTaskRoutes);
app.use('/api/v2/farm-weather', v2FarmWeatherRoutes);
app.use('/api/v2/farm-risks', v2FarmRiskRoutes);
app.use('/api/v2/farm-inputs', v2FarmInputRoutes);
app.use('/api/v2/farm-harvest', v2FarmHarvestRoutes);
app.use('/api/v2/harvest-records', v2HarvestRecordRoutes);
app.use('/api/v2/farm-costs', v2FarmCostRoutes);
app.use('/api/v2/farm-benchmarks', v2FarmBenchmarkRoutes);
app.use('/api/v2/weekly-summary', v2WeeklySummaryRoutes);
app.use('/api/v2/crop-suggestions', v2CropSuggestionsRoutes);
app.use('/api/v2/recommend/us', v2UsRecommendationRoutes);
app.use('/api/v2/issues', v2IssueReportRoutes);
app.use('/api/v2/verification', v2VerificationRoutes);
app.use('/api/v2/ngo', v2NgoDashboardRoutes);
app.use('/api/v2/crop-cycles', v2CropCycleRoutes);
app.use('/api/v2/farmer', createFarmerTodayRouter());
app.use('/api/v2/harvests', v2HarvestRoutes);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api', marketRouter);
app.use('/api/v2/ngo', v2NgoDecisionRoutes);
app.use('/api/v2/weather', v2WeatherRoutes);
app.use('/api/v2/monitoring', v2MonitoringRoutes);
app.use('/api/v2/seasons', v2SeasonRoutes);
app.use('/api/v2/tasks', v2TaskRoutes);
app.use('/api/v2/analytics', v2AnalyticsRoutes);
app.use('/api/v2/support', v2SupportRoutes);
app.use('/api/v2/exports', v2ExportRoutes);
app.use('/api/v2/bulk', v2BulkRoutes);
app.use('/api/v2/analytics-summary', v2AnalyticsSummaryRoutes);
app.use('/api/v2/land-boundaries', v2LandBoundaryRoutes);
app.use('/api/v2/seed-scans', v2SeedScanRoutes);
app.use('/api/v2/verification-signals', v2VerificationSignalRoutes);
app.use('/api/v2/supply-readiness', v2SupplyReadinessRoutes);
app.use('/api/v2/buyers', v2BuyerRoutes);
app.use('/api/v2/buyer-links', v2BuyerLinkRoutes);
app.use('/api/v2/buyer-trust', v2BuyerTrustRoutes);
app.use('/api/v2/tts', v2TtsRoutes);
// TypeScript intelligence module (pest-risk, admin, ingest)
app.use('/api/v2', intelligenceRouter);

// ─── API 404 (catch unmatched /api routes) ──────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ─── Production Static Serving ─────────────────────────
if (config.isProduction) {
  const clientDist = path.join(__dirname, '../../dist');
  app.use(express.static(clientDist));
  // SPA fallback: serve index.html for non-API routes (React Router handles
  // client-side routing).
  //
  // Defensive guard: if an asset request slips past the static handlers above
  // (e.g. the file doesn't exist on disk because of a botched build), DO NOT
  // return index.html. Returning HTML for an image / manifest URL is what
  // caused Chrome's "isn't a valid image" PWA manifest error in the first
  // place. Return a real 404 so the browser knows the asset is missing
  // instead of trying to parse HTML as PNG/JSON.
  const _ASSET_RX = /\.(png|jpg|jpeg|gif|svg|webp|ico|json|webmanifest|js|mjs|css|map|woff2?|ttf|eot|wasm|txt|xml)$/i;
  app.get('*', (req, res) => {
    if (_ASSET_RX.test(req.path)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
