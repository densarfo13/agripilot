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

// ─── V2 enterprise auth routes (cookie-based) ──────────────
import v2AuthRoutes from '../routes/auth.js';
import v2FarmProfileRoutes from '../routes/farmProfile.js';
import v2CropSuggestionsRoutes from '../routes/cropSuggestions.js';
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
if (config.isProduction) {
  const clientDist = path.join(__dirname, '../../dist');
  app.use(express.static(clientDist));
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
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (relaxed for pilot)
  max: 30, // 30 auth requests per 5 min per IP (covers login + refresh + me)
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // successful requests don't count toward limit
  // Uses default keyGenerator (request IP via express trust proxy)
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/v2/auth/'), // auth has its own limiter
});

// Apply API-wide rate limiter to all /api routes (auth excluded — has authLimiter)
app.use('/api', apiLimiter);

// ─── Uploads: authenticated static serving ─────────────
// Files require a valid JWT to download (prevents public access to evidence)
app.use('/uploads', authenticate, express.static(path.join(__dirname, '../uploads')));

// ─── Health Check ───────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', timestamp: new Date().toISOString(), error: 'Database unreachable' });
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

// ─── /me endpoint ───────────────────────────────────────
app.get('/api/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: {
      id: true, email: true, fullName: true, role: true, active: true, createdAt: true,
      organizationId: true,
      organization: { select: { id: true, name: true, type: true } },
    },
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
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
  // SPA fallback: serve index.html for non-API routes (React Router handles client-side routing)
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
