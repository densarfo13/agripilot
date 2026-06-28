import fs from 'fs';
import express from 'express';
import satelliteRoutes from './routes/satellite.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
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
import {
  resolveBuildVersion,
  resolveGitSha,
  resolveBuildTimestamp,
  resolveDeploymentId,
  resolveEnvironment,
  resolveReleaseVersion,
} from './config/productionRuntime.js';

// Route imports
import authRoutes from './modules/auth/routes.js';
import adminUserRoutes from './modules/auth/admin-routes.js';
// Client-event ingestion (data foundation v2) + NGO read APIs
import ingestRoutes from './modules/ingest/routes.js';
// Soft-launch monitoring pipeline (Phase 3 §C). Exposes:
//   POST /api/events            — single + batched ingest
//   POST /api/errors            — auth-only crash logger
//   GET  /api/admin/metrics     — admin-gated aggregation view
// Routes are mounted at the API root because the spec wires
// frontend `trackEvent()` calls to /api/events directly (no
// versioning prefix needed for the pilot).
import softLaunchEventsRoutes from './modules/events/routes.js';
// AI Task Engine v1 — POST /api/tasks/today. Rules-based daily
// task generator. See server/src/modules/aiTask/engine.js for
// the precedence ladder.
import aiTaskRoutes from './modules/aiTask/routes.js';
// Calm-UI services-layer adaptors. Mounts spec-named routes
// (/api/weather/today, /api/actions/today, /api/actions/complete,
// /api/tasks/from-scan) that delegate to existing engines/stores.
// No new business logic — pure forwarders.
import serviceAliasesRoutes from './modules/serviceAliases/routes.js';
import ngoRoutes    from './modules/ingest/ngoRoutes.js';
import farmersRoutes from './modules/farmers/routes.js';
// Wave-27 — Honest 503 stub for /api/v2/farmers/partner-import.
// AdminImportFarmersPage.jsx posts to /api/v2/farmers/partner-import
// (and PATCHes /api/v2/farmers/:id/partner-import). Both endpoints
// were missing pre-wave-27 — the founder-readiness audit flagged
// this as a critical NGO blocker. The stub returns the same
// machine-readable PENDING_REASON envelope as the bulk-onboarding
// writes so the frontend banner is consistent.
import partnerImportRoutes from './modules/farmers/partnerImportRoutes.js';
import applicationsRoutes from './modules/applications/routes.js';
import locationRoutes from './modules/location/routes.js';
import evidenceRoutes from './modules/evidence/routes.js';
import verificationRoutes from './modules/verification/routes.js';
import fraudRoutes from './modules/fraud/routes.js';
import decisionRoutes from './modules/decision/routes.js';
// Decision Engine v2 — adds /today + /complete + soil + satellite
// + region routes. Wraps the AI Task Engine v1 with the priority
// ladder + soil/satellite/region/scan signals. Each router is
// mounted on its own /api segment so it never collides with the
// legacy decisionRoutes.
import decisionV2Routers from './modules/decisionV2/routes.js';
import benchmarkRoutes from './modules/benchmarking/routes.js';
import intelligenceRoutes from './modules/intelligence/routes.js';
// Phase 14 — Data Flywheel Intelligence API. Mounted at
// /api/flywheel/* (NOT /api/intelligence/*) to avoid colliding
// with the existing wave-9 application-intelligence module's
// :applicationId wildcard. See the route module's header for the
// full spec mapping.
import flywheelRoutes from './modules/flywheel/routes.js';
// Enterprise Agriculture Platform — organizations, programs,
// cohorts, interventions, analytics, reports, trust.
// Writes return 503 until the Prisma migration ships (staged at
// server/prisma/_pending-migrations/enterprise_agriculture_platform/).
import enterpriseRoutes from './modules/enterprise/routes.js';
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
import insightsRoutes from './modules/insights/routes.js';
import { createMarketplaceRouter } from './modules/marketplace/routes.js';
import lifecycleRoutes from './modules/lifecycle/routes.js';
import seasonRoutes from './modules/seasons/routes.js';
import organizationRoutes from './modules/organizations/routes.js';
import pilotMetricsRoutes from './modules/pilotMetrics/routes.js';
import pilotQARoutes from './modules/pilotQA/routes.js';
import securityRoutes from './modules/security/routes.js';
import inviteRoutes from './modules/invites/routes.js';
// Wave-39 — canonical admin-only invite-management routes.
// Exposes GET /api/invites/status/:farmerId and POST
// /api/invites/:farmerId/resend. Sits alongside the existing
// public acceptance routes; admin-gated internally.
import inviteAdminRoutes from './modules/invites/adminRoutes.js';
import trustRoutes from './modules/trust/routes.js';
import taskRoutes from './modules/tasks/routes.js';
import systemRoutes from './modules/system/routes.js';
import feedbackRoutes from './modules/feedback/routes.js';
import communityRoutes from './modules/community/routes.js';
import mfaRoutes from './modules/mfa/routes.js';
import autoNotificationRoutes from './modules/autoNotifications/routes.js';
import performanceRoutes from './modules/performance/routes.js';
import farmProfileRoutes from './modules/farmProfiles/routes.js';
import programRoutes from './modules/programs/routes.js';
import weatherRoutes from './modules/weather/routes.js';
import publicWeatherRoute from './modules/weather/publicRoute.js';
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
import v2AdminBasicRoutes from '../routes/adminBasic.js';
// Phase 7A restore — pricing suggestion endpoint (public, aggregate only).
import v2PricingSuggestRoutes from '../routes/pricingSuggest.js';
// Phase 7B restore — trust score endpoint (public, aggregate only).
import v2TrustScoreRoutes from '../routes/trustScore.js';
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
  // /sw.js — service worker fully removed (May 2026 stability
  // pass). The route is intentionally left unmounted; any
  // browser still requesting /sw.js gets a 404, the SW unregister
  // path in src/lib/forceUiReset.js handles cleanup on the
  // client. NEVER reintroduce a static handler for this path
  // without the corresponding registration on the client.
  app.use('/robots.txt',
    express.static(path.join(_distPath, 'robots.txt'), pwaCache));

  // RC1 — /cache-bust.js is intentionally NEVER cached. The script
  // compares the build SHA pinned into index.html against the SHA
  // recorded in localStorage; on mismatch it drops every
  // CacheStorage entry, unregisters every service worker, and
  // reloads once. If the browser ever cached this script the bust
  // pipeline would freeze at the last deploy's SHA and stop firing.
  app.use('/cache-bust.js',
    express.static(path.join(_distPath, 'cache-bust.js'), {
      maxAge: 0,
      immutable: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      },
    }));
}

// Removed: duplicate `app.use(express.static(_distPath))` that
// previously lived here. Two mounts of the same dist path were
// installed (this one + the cache-header-aware one at the bottom of
// the file). Express middleware runs in registration order, so this
// no-header mount served every dist file BEFORE the proper cache-
// header logic could attach — making the no-cache rule for
// index.html dead code. With this mount removed, the single canonical
// static handler (see "Production Static Serving" block at the end
// of this file) is now the only one — and the explicit cache rules
// (no-cache on .html, immutable on /assets/*) become live.
//
// The PWA-critical mounts above (/icons, /manifest.json, etc.) are
// preserved — they target specific paths and ship the appropriate
// pwaCache headers themselves.
//
// Fail-loud guard for the dist directory in production: if the
// build artefact is missing on the deploy host (a Railway/Render
// build that didn't run `npm run build`, or a Docker stage that
// skipped the COPY step), every frontend request would silently
// 404 with no signal. Log a single greppable banner so ops sees
// the cause immediately. We DO NOT throw — the API surface stays
// reachable so health checks still pass and the operator can fix
// the deploy.
if (config.isProduction && !fs.existsSync(_distPath)) {
  console.error(
    '[Farroway Static Serve] FATAL: frontend dist not found at '
    + _distPath
    + ' — the deploy is missing the build artefact. Run `npm run build` '
    + 'before starting the server, or check the build pipeline.',
  );
}

// Canonical-asset boot check. When dist/ exists, verify the
// fallback hero + the three spec-listed realism trio + the brand
// icons are all present. The realism-fallback middleware below
// can only do its job if `africa-farm-atmosphere.jpeg` exists —
// when it doesn't, every missing-asset request falls all the way
// through to the SPA real-404 catch-all, which is exactly the
// noise the user has been seeing in production screenshots. Log
// one greppable line listing every missing file so ops can spot
// the partial-deploy state without grep-ing user reports.
if (config.isProduction && fs.existsSync(_distPath)) {
  const _critical = [
    'icons/logo-premium.jpg',
    'icons/logo-premium-192.jpg',
    'icons/logo-premium-512.jpg',
    'icons/logo-premium-1024.jpg',
    'assets/realism/heroes/africa-farm-atmosphere.jpeg',
    'assets/realism/farm/pepper-closeup.jpeg',
    'assets/realism/journal/farm-inspection.jpeg',
    'assets/realism/journal/greenhouse-work.jpeg',
    'assets/realism/scan/healthy-leaf.jpeg',
  ];
  const _missing = [];
  for (const rel of _critical) {
    if (!fs.existsSync(path.join(_distPath, rel))) _missing.push(rel);
  }
  if (_missing.length > 0) {
    console.error(
      '[Farroway Static Serve] WARN: ' + _missing.length
      + ' canonical asset' + (_missing.length === 1 ? '' : 's')
      + ' missing from dist — realism-fallback middleware will degrade. '
      + 'Missing:\n  • ' + _missing.join('\n  • ')
      + '\nRun `npm run check:production-assets` locally to verify, '
      + 'then redeploy with the full public/ tree.',
    );
  } else {
    console.log('[Farroway Static Serve] All ' + _critical.length
      + ' canonical assets present in dist/.');
  }
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

// Build a structured CORS-block error so the rejection is treated
// as an EXPECTED 4xx by the error handler instead of bubbling up
// as a 5xx that gets captured by Sentry + escalated as a server
// fault. Mozilla Observatory, security scanners, and other
// unauthorized origins are SUPPOSED to be blocked — they are not
// internal application failures.
function _corsBlockedError(origin) {
  const err = new Error(`CORS: origin ${origin} not allowed`);
  err.statusCode    = 403;
  err.isCorsBlocked = true;
  err.blockedOrigin = origin;
  return err;
}

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
      callback(_corsBlockedError(origin));
    }
  };
} else if (config.isProduction) {
  // Production with no CORS_ORIGIN set — allow same-origin (no Origin header) requests only
  corsOptions.origin = (origin, callback) => {
    if (!origin) callback(null, true);
    else callback(_corsBlockedError(origin));
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

// Admin Monitoring Dashboard v1 — fire `rate_limit_hit` events
// on every cap excess so the dashboard's "API rate-limit hits"
// card has a signal to count. The handler runs AFTER the
// limiter has already decided to reject; we log + return the
// configured 429 message untouched.
function _onRateLimited(_limiterName) {
  return (req, res, _next, options) => {
    try {
      import('./config/database.js').then(({ default: prisma }) => {
        try {
          const id = (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID)
            ? globalThis.crypto.randomUUID()
            : `rl-hit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          prisma.clientEvent.create({
            data: {
              id,
              type:      'rate_limit_hit',
              payload: {
                limiter: _limiterName,
                method:  req.method,
                route:   req.originalUrl || req.path,
                userId:  (req.user && (req.user.sub || req.user.id)) || null,
                ip:      req.ip,
              },
              createdAt: new Date(),
              farmerId:  (req.user && (req.user.sub || req.user.id)) || null,
              orgId:     (req.user && req.user.organizationId) || null,
              offline:   false,
            },
          }).catch(() => { /* swallow — telemetry never blocks the response */ });
        } catch { /* swallow */ }
      }).catch(() => { /* swallow */ });
    } catch { /* swallow */ }
    res.status(options.statusCode).json(options.message);
  };
}

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/v2/auth/'), // auth has its own limiter
  store: _rlStore('api'),
  handler: _onRateLimited('api'),
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
  handler: _onRateLimited('scan'),
});
// Soft-launch hardening: per-USER scan cap. The IP-keyed
// scanLimiter above protects against floods from a single
// network egress, but a shared NAT (school / NGO office /
// public WiFi) could exhaust 30/min/IP across many legit
// users. This second limiter, mounted AFTER authenticate so
// req.user is populated, caps each authenticated caller
// independently at 60/min — generous for human use but a
// hard ceiling against a runaway client loop or a stolen
// token replaying scans against the AI-cost path.
const scanUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,                          // 60 scans/min/USER
  message: { error: 'Too many scan requests. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: _rlStore('scan-user'),
  handler: _onRateLimited('scan-user'),
  keyGenerator: (req, res) => {
    // Prefer authenticated userId; fall back to the
    // ipKeyGenerator helper from express-rate-limit so IPv6
    // addresses are masked to a subnet (required since v8 —
    // bare `req.ip` throws ERR_ERL_KEY_GEN_IPV6 at server boot).
    const u = req.user && (req.user.sub || req.user.id);
    if (u) return `u:${u}`;
    return `ip:${ipKeyGenerator(req, res)}`;
  },
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
// Resolved once at module load so /health responses are stable for
// the lifetime of the process; the build version comes from the
// deploy environment (Railway commit SHA / VITE_BUILD_ID / etc.)
// via productionRuntime.resolveBuildVersion().
const _resolvedBuildVersion = (() => {
  try { return resolveBuildVersion(); }
  catch { return '0.0.0-local'; }
})();
// Hardening Pass 2 — observability metadata. Resolved once at module
// load (productionRuntime helpers are pure + side-effect-free) so the
// /health response stays cheap. Any field that can't be resolved
// resolves to null; consumers MUST tolerate null for forward-compat.
const _deployMetadata = (() => {
  try {
    return Object.freeze({
      gitSha:         resolveGitSha(),
      deploymentId:   resolveDeploymentId(),
      deployedAt:     resolveBuildTimestamp(),
      environment:    resolveEnvironment(),
      releaseVersion: resolveReleaseVersion(),
      // serverStartedAt is module-load time — useful to distinguish
      // a long-running container from a fresh restart.
      serverStartedAt: new Date(_serverStartedAt).toISOString(),
    });
  } catch {
    return Object.freeze({
      gitSha: null, deploymentId: null, deployedAt: null,
      environment: 'unknown', releaseVersion: null,
      serverStartedAt: new Date(_serverStartedAt).toISOString(),
    });
  }
})();
// Wave-39 — persistence probe for the canonical health envelope.
// Read-only; piggybacks on the SELECT 1 round-trip below.
import { probePersistence as _probePersistence } from './config/persistenceProbe.js';

async function _healthHandler(_req, res) {
  let dbStatus = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'ok';
  } catch { dbStatus = 'down'; }
  const uptime = Math.floor((Date.now() - _serverStartedAt) / 1000);

  // Wave-39 — persistence envelope for __persistenceHealth().
  // Honest mode + migration + criticalWritesPersisted flags.
  // Probe is safe even when the DB is down — returns an
  // unavailable envelope without throwing.
  let persistence = null;
  try {
    persistence = await _probePersistence({ dbStatus });
  } catch {
    persistence = Object.freeze({
      mode:                    'unavailable',
      databaseUrlPresent:      false,
      prismaClientReady:       false,
      migrationsApplied:       false,
      criticalWritesPersisted: false,
    });
  }

  // BACKWARD-COMPAT: every pre-hardening field stays exactly where
  // it was — { status, db, uptime, timestamp, version }. New
  // observability fields are ADDED, never removed or renamed.
  // Existing consumers (the load balancer, the rollback runbook
  // grep, external uptime checks) keep working unchanged.
  const body = {
    status:         dbStatus === 'ok' ? 'ok' : 'degraded',
    db:             dbStatus,
    uptime,
    timestamp:      new Date().toISOString(),
    version:        _resolvedBuildVersion,
    // Hardening Pass 2 — deployment metadata. Any subset may be
    // null when the deploy didn't write the BUILD_SHA file (e.g.
    // local docker build, or a pre-hardening deploy still serving).
    gitSha:         _deployMetadata.gitSha,
    deploymentId:   _deployMetadata.deploymentId,
    deployedAt:     _deployMetadata.deployedAt,
    environment:    _deployMetadata.environment,
    releaseVersion: _deployMetadata.releaseVersion,
    serverStartedAt: _deployMetadata.serverStartedAt,
    // Wave-39 — persistence envelope. Frontend's
    // __persistenceHealth() reads this exact shape.
    persistence,
  };
  res.status(dbStatus === 'ok' ? 200 : 503).json(body);
}
app.get('/api/health', _healthHandler);
app.get('/health',     _healthHandler);

// RC1 — scan-provider health (public, no auth). The frontend
// classifier-availability runtime probes this BEFORE login so the
// app store readiness diagnostic can report `realClassifierAvailable`
// honestly. Never exposes the key — only configured/provider booleans.
import { registerScanProviderHealthRoute as _registerScanProviderHealth }
  from './routes/scanProviderHealth.js';
_registerScanProviderHealth(app);

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
// Sprint #221 — emergency scan-provider diagnostics. Auth-only.
// Reveals whether the Plant.id provider is CONFIGURED + the last call's
// HTTP status / candidate count / failure reason, so a P0 "every clear
// photo reads unclear" is root-caused in prod without redeploying. It
// NEVER returns the key value — only presence + length.
// GET /api/admin/scan/last-trace — ADMIN-ONLY. The most recent scan's REDACTED trace
// (provider HTTP status + latency, raw vs normalized candidate count, top candidate,
// rejection reason, final verdict). No secrets, no image bytes. Lets an operator
// root-cause "why did this scan return unknown?" from real production data.
app.get('/api/admin/scan/last-trace', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const { getLastScanTrace } = await import('./ml/scanLastTrace.js');
    return res.json({ ok: true, trace: getLastScanTrace() });
  } catch {
    return res.status(500).json({ ok: false, error: 'last_trace_unavailable' });
  }
});

app.get('/api/scan/diagnostics', authenticate, async (req, res) => {
  try {
    const { getScanProviderDiagnostics, pingScanProvider } =
      await import('./ml/scanInferenceService.js');
    const diag = getScanProviderDiagnostics();
    // P0 PROVIDER RUNTIME STATUS — read the ACTUAL env for crop.health/insect.id/
    // mushroom.id at runtime (was Plant.id-only, which made the client always
    // report them false regardless of Railway). Never logs full secrets.
    let providerFlags = {};
    try {
      const { getProviderAcceptanceFlags } = await import('./ml/providerRuntimeStatus.js');
      providerFlags = getProviderAcceptanceFlags();
    } catch { /* keep core diagnostics working even if this fails */ }
    // ?live=1 → execute a REAL authenticated provider call (Kindwise
    // usage_info) to prove the key works, without consuming credits.
    let live = null;
    if (String(req.query.live || '') === '1') {
      live = await pingScanProvider();
    }
    return res.json({
      ok: true,
      providerConfigured: diag.providerConfigured,
      providerAvailable: live
        ? live.httpStatus === 200
        : (diag.lastHttpStatus === 200 || (diag.providerConfigured && diag.lastHttpStatus == null)),
      // Env-var NAME audit (the #221 root cause was a name mismatch).
      envVarUsed: diag.envVarUsed,
      plantIdApiKeyLength: diag.plantIdApiKeyLength,   // PLANT_ID_API_KEY (canonical)
      plantApiKeyLength: diag.plantApiKeyLength,       // PLANT_API_KEY (alias)
      keyFingerprint: diag.keyFingerprint,             // first 6 chars only
      keyPresent: diag.keyPresent,
      keyLength: diag.keyLength,
      keyLooksTruncated: diag.keyLooksTruncated,
      // Last real /analyze call.
      httpStatus: diag.lastHttpStatus,
      candidateCount: diag.lastCandidateCount,
      confidence: diag.lastConfidence,
      failureReason: diag.lastFailureReason,
      latencyMs: diag.lastLatencyMs,
      lastCallAt: diag.lastCallAt,
      providerName: diag.providerName,
      // P0 — per-provider runtime truth (crop.health / insect.id / mushroom.id).
      ...providerFlags,
      // Live authenticated provider ping (only when ?live=1).
      live,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'diagnostics_failed', message: err && err.message });
  }
});

// ── Environment Provider Orchestrator diagnostics ──
// GET /api/environment/diagnostics — admin/auth only. Per-provider readiness
// (soil now; pluggable). Safe info only: no full keys, no raw provider payload.
app.get('/api/environment/diagnostics', authenticate, async (req, res) => {
  try {
    const { getSoilProviderDiagnostics } = await import('./services/soil/ambeeSoilService.js');
    const soil = getSoilProviderDiagnostics();
    return res.json({
      ok: true,
      configuredProviders: [soil.providerName].filter(() => soil.envPresent),
      providers: [
        // Soil — the first production provider (real readiness from telemetry).
        { provider: 'soil', envName: soil.envName, envPresent: soil.envPresent,
          keyLength: soil.keyLength, keyFingerprint: soil.keyFingerprint,
          status: soil.status, httpStatus: soil.httpStatus, failureReason: soil.failureReason,
          latencyMs: soil.latencyMs, cacheTtlMs: soil.cacheTtlMs,
          cacheHits: soil.cacheHits, calls: soil.calls, failures: soil.failures },
        // Pollen — honest disabled stub (no live dependency; never fabricated).
        { provider: 'pollen', envPresent: false, status: 'not_configured',
          failureReason: 'no_pollen_provider', note: 'disabled stub' },
      ],
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'environment_diagnostics_failed', message: err && err.message });
  }
});

// GET /api/environment/health — PUBLIC, safe readiness only. No secrets, no
// credits, no raw payloads, no provider internals.
app.get('/api/environment/health', async (req, res) => {
  try {
    const { getSoilProviderDiagnostics } = await import('./services/soil/ambeeSoilService.js');
    const soil = getSoilProviderDiagnostics();
    return res.json({
      environmentReady: true,           // orchestrator always yields a recommendation
      weatherReady: true,               // weather derives from request context
      soilSignalAvailable: !!soil.envPresent,
      pollenSignalAvailable: false,     // honest: no live pollen provider
    });
  } catch {
    return res.json({ environmentReady: true, weatherReady: true,
      soilSignalAvailable: false, pollenSignalAvailable: false });
  }
});

// POST /api/admin/scan/certify — PRODUCTION CERTIFICATION (admin/auth only).
// Runs the certification across every provider from LIVE runtime evidence,
// stores the result rows, and returns the scorecard + overall verdict. Never
// infers readiness from env vars; never fabricates provider health.
app.post('/api/admin/scan/certify', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;   // admin-only: certify makes real provider calls (burns credits)
  try {
    const { runProductionCertification } = await import('./services/scan/certification/productionCertification.js');
    const liveCall = (req.body && typeof req.body.liveCall === 'object') ? req.body.liveCall : {};
    const result = await runProductionCertification({ liveCall });

    // Store results (best-effort — certification must not fail on a DB hiccup).
    try {
      if (prisma && prisma.scanProviderCertification) {
        for (const c of result.certifications) {
          await prisma.scanProviderCertification.create({ data: {
            provider: c.provider, status: c.status, latency: c.latencyMs,
            confidence: c.avgConfidence, auth: c.authenticated, credits: c.creditsOk,
            environment: c.environment, buildSha: c.buildVersion, apiVersion: c.apiVersion,
            lastSuccess: c.lastSuccessfulCall ? new Date(c.lastSuccessfulCall) : null,
            failureReason: c.failureReason,
          } }).catch(() => { /* swallow per-row */ });
        }
      }
    } catch { /* persistence is best-effort */ }

    return res.json({
      ok: true,
      runtimeContext: result.runtimeContext,
      overallVerdict: result.overall,
      providers: result.certifications,
      scorecard: result.scorecard,
      // Honest next action when the certify ran where secrets aren't reachable.
      nextAction: result.nextAction
        || (result.runtimeContext && !result.runtimeContext.isRailway
          ? 'Run `railway run npm run scan:certify` from the linked project.' : null),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'certify_failed', message: err && err.message });
  }
});

// ── Scan Intelligence v10 — API surface (honest aliases over existing logic). ──
// POST /api/scan — alias to the analyze pipeline (preserves method + body).
app.post('/api/scan', (req, res) => res.redirect(307, '/api/scan/analyze'));

// GET /api/scan/statistics — scan totals from observability (auth-only).
app.get('/api/scan/statistics', authenticate, async (req, res) => {
  try {
    const { getScanObservability } = await import('./ml/scanObservability.js');
    const obs = await getScanObservability(prisma, { sinceDays: Number(req.query.days) || 30 });
    return res.json({ ok: true, totals: obs.totals, topCrops: obs.mostScannedCrops,
      topDiseases: obs.mostCommonDiseases, topInsects: obs.mostCommonInsects });
  } catch (err) { return res.status(500).json({ ok: false, error: 'statistics_failed', message: err && err.message }); }
});

// GET /api/scan/providers — per-provider runtime status (auth-only).
app.get('/api/scan/providers', authenticate, async (req, res) => {
  try {
    const { getProviderRuntimeStatus } = await import('./ml/providerRuntimeStatus.js');
    return res.json({ ok: true, providers: getProviderRuntimeStatus() });
  } catch (err) { return res.status(500).json({ ok: false, error: 'providers_failed', message: err && err.message }); }
});

// POST /api/scan/review — submit a scan to the manual review queue (auth-only).
app.post('/api/scan/review', authenticate, async (req, res) => {
  try {
    const scanId = req.body && (req.body.scanId || req.body.scan_id);
    if (!scanId) return res.status(400).json({ ok: false, error: 'scanId_required' });
    // Honest: marks the observability row review-only; the review queue is the
    // existing low-confidence/trust-gate surface. No fabricated verdict.
    const { recordScanOutcome } = await import('./ml/scanObservability.js');
    await recordScanOutcome(prisma, String(scanId), { reviewRequested: true }).catch(() => {});
    return res.json({ ok: true, scanId: String(scanId), queued: true, status: 'in_review' });
  } catch (err) { return res.status(500).json({ ok: false, error: 'review_failed', message: err && err.message }); }
});

// POST /api/scan/bulk — accept N scans for sequential analysis (auth-only).
app.post('/api/scan/bulk', authenticate, async (req, res) => {
  const items = (req.body && Array.isArray(req.body.scans)) ? req.body.scans : [];
  if (!items.length) return res.status(400).json({ ok: false, error: 'scans_array_required' });
  // Honest: acknowledges + bounds; each item is processed via /api/scan/analyze.
  return res.json({ ok: true, accepted: Math.min(items.length, 50),
    note: 'Submit each item to /api/scan/analyze; bulk processes sequentially, never blocking on one failure.' });
});

// GET /api/admin/scan/reliability — PROVIDER RELIABILITY 24h scorecard (admin).
// Uptime / latency p50-p99 / error breakdown / health score, computed from the
// scan_provider_metrics rows. Never fabricated; empty when there are no calls.
app.get('/api/admin/scan/reliability', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;   // admin-only: exposes provider reliability metrics
  try {
    const { getReliabilityScorecard } = await import('./services/scan/certification/providerReliability.js');
    const hours = Number(req.query.hours) || 24;
    const scorecard = await getReliabilityScorecard(prisma, { sinceHours: hours });
    return res.json({ ok: true, ...scorecard });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'reliability_failed', message: err && err.message });
  }
});

// GET /api/admin/scan-credits — Kindwise credit monitor (admin-only).
// Remaining credits for plant.id / crop.health / insect.id, per-provider
// alert level (<100 low, <50 warning, <20 critical), daily burn rate +
// estimated days remaining. Reads usage_info (does NOT spend credits) and
// never returns the key value. ?refresh=1 forces a fresh poll.
app.get('/api/admin/scan-credits', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;   // admin-only: exposes provider credit balances
  try {
    const { getScanCredits, refreshScanCredits } =
      await import('./ml/scanCreditMonitor.js');
    const data = String(req.query.refresh || '') === '1'
      ? await refreshScanCredits()
      : await getScanCredits();
    return res.json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'scan_credits_failed', message: err && err.message });
  }
});

// SCAN_OBSERVABILITY_V1 — client reports a downstream outcome (task
// created / plant saved) for a scan it owns. Auth-only, best-effort.
app.post('/api/scan/observability/outcome', authenticate, async (req, res) => {
  try {
    const { scanId, taskCreated, plantSaved } = req.body || {};
    if (!scanId) return res.status(400).json({ ok: false, error: 'scanId_required' });
    const { recordScanOutcome } = await import('./ml/scanObservability.js');
    const ok = await recordScanOutcome(prisma, scanId, { taskCreated, plantSaved });
    return res.json({ ok });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'observability_outcome_failed', message: err && err.message });
  }
});

// GET /api/admin/scan-observability — aggregate dashboard (admin-only):
// totals, success/fail, avg confidence, most-scanned crops, most-common
// diseases + insects. ?sinceDays=N&limit=N to scope the window.
app.get('/api/admin/scan-observability', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;   // admin-only: aggregates farmer scan data
  try {
    const { getScanObservability } = await import('./ml/scanObservability.js');
    const data = await getScanObservability(prisma, {
      sinceDays: req.query.sinceDays, limit: req.query.limit,
    });
    return res.json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'scan_observability_failed', message: err && err.message });
  }
});

// GET /api/admin/scan-observability/export.csv — full per-scan CSV (admin-only).
app.get('/api/admin/scan-observability/export.csv', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;   // admin-only: exports full per-scan farmer data
  try {
    const { buildObservabilityCsv } = await import('./ml/scanObservability.js');
    const csv = await buildObservabilityCsv(prisma, {
      sinceDays: req.query.sinceDays, limit: req.query.limit,
    });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="scan-observability.csv"');
    return res.send(csv);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'scan_observability_csv_failed', message: err && err.message });
  }
});

// FARM_PERSISTENCE_V1 — durable farmer state (plants/scanHistory/tasks/
// outcomes/timeline). Client mirrors writes here; recovers on login.
// POST /api/farm-state/sync — batch upsert (last-write-wins).
app.post('/api/farm-state/sync', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { syncRecords } = await import('./services/farmStateService.js');
    const result = await syncRecords(prisma, userId, (req.body && req.body.records) || []);
    return res.json({ ...result, serverTime: Date.now() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'farm_state_sync_failed', message: err && err.message });
  }
});

// GET /api/farm-state?domains=plants,tasks&since=ms — recovery read.
app.get('/api/farm-state', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthenticated' });
    const { getRecords } = await import('./services/farmStateService.js');
    const domains = typeof req.query.domains === 'string' && req.query.domains
      ? req.query.domains.split(',').map((d) => d.trim()).filter(Boolean) : undefined;
    const data = await getRecords(prisma, userId, { domains, since: req.query.since });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'farm_state_get_failed', message: err && err.message });
  }
});

app.post('/api/scan/analyze', authenticate, scanUserLimiter, async (req, res) => {
  const _obsT0 = Date.now(); // SCAN_OBSERVABILITY_V1 — per-scan duration
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
    // Smart Scan AI Backend §3 + §8 — spec-shape verdict
    // adapter + fallback constant. Lazy-imported alongside
    // the rest of the ML pipeline so the route stays small.
    const {
      normalizeToSpecShape, SPEC_FALLBACK_VERDICT,
      // Plant Identification v1.1 — full envelope with both
      // plantIdentification + healthAnalysis. Existing verdictV2
      // stays for back-compat; new consumers bind to verdictV3.
      normalizeToFullSpecShape, SPEC_FALLBACK_FULL,
      // Scan Decision Intelligence (May 2026 §2) — tight 12-field
      // action-card envelope. Consumers that only want the
      // headline + action read `decision`; the rich verdicts stay
      // for back-compat.
      normalizeToDecisionShape, SPEC_FALLBACK_DECISION,
    } = await import('./ml/scanResultNormalizer.js');
    // Smart Scan AI Backend §7 — daily per-user quota guard.
    const { checkDailyScanLimit } = await import('./ml/scanLimitGuard.js');

    // §7 cost control — enforce the daily quota BEFORE we do
    // any image preprocess / AI work so an over-quota request
    // doesn't burn provider tokens. Anonymous callers fall
    // through to the IP-based scanLimiter; signed-in callers
    // get the per-user counter. Pro flag is read off the user
    // record when present; defaults to false so we always pick
    // the conservative limit when in doubt.
    const _limit = await checkDailyScanLimit({
      prisma,
      userId: req.user && req.user.id,
      isPro:  !!(req.user && (req.user.isPro || req.user.proStatus === 'active')),
    });
    if (!_limit.ok) {
      return res.status(429).json({
        error:     'scan_limit_reached',
        limit:     _limit.limit,
        used:      _limit.used,
        remaining: _limit.remaining,
        resetAt:   _limit.resetAt,
        // Include the spec fallback shape so the client doesn't
        // need a separate render path — it can show the
        // "uncertain / monitor" state with a clear retry hint.
        verdictV2: SPEC_FALLBACK_VERDICT,
        verdictV3: SPEC_FALLBACK_FULL,
        decision:  SPEC_FALLBACK_DECISION,
        message:   'Daily scan limit reached. Upgrade to Pro for more scans.',
      });
    }

    const pre = await preprocessImage({ base64: imageBase64, url: imageUrl });
    if (!pre.ok) {
      return res.status(400).json({
        error:     'image_rejected',
        reason:    pre.reason,
        // §8 fallback — even on image-validation failure we
        // return the spec shape so the client never has to
        // null-check the verdict field.
        verdictV2: SPEC_FALLBACK_VERDICT,
        verdictV3: SPEC_FALLBACK_FULL,
        decision:  SPEC_FALLBACK_DECISION,
      });
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

    // Satellite land-health snapshot — fully optional. Reads the
    // most recent fresh snapshot (≤7 days old) the satellite
    // module persisted for this user. The placeholder service
    // returns null when no snapshot exists, so the scan pipeline
    // gracefully degrades: when present, contextFusionEngine
    // gets an extra `landHealth` signal it can layer on top of
    // weather; when absent, fuseContext runs on weather alone.
    // Per spec: "If satellite missing, do not block scan."
    let landHealth = null;
    try {
      if (req.user && req.user.id) {
        const { getLatestSatelliteSnapshot } =
          await import('./modules/satellite/service.js');
        const snap = await getLatestSatelliteSnapshot(prisma, {
          userId: req.user.id,
        });
        if (snap && typeof snap === 'object') landHealth = snap;
      }
    } catch (satErr) {
      // Provider failure must never crash the scan — log + continue.
      try { console.warn('[scan] satellite snapshot lookup failed:', satErr && satErr.message); }
      catch { /* swallow */ }
    }

    // Scan Recovery Sprint §5 — consensus engine. Fires Plant.id AND
    // PlantNet in parallel when both keys present; returns a weighted
    // verdict + top-5 candidates + disease module output. Falls
    // through to single-provider mode when only one key is set, and
    // to rule mode when neither is set. Pure; never throws.
    const { runConsensus } = await import('./ml/scanConsensusEngine.js');
    // Scan Intelligence V2 §1 + §2 — fire insect detection AND
    // satellite field health IN PARALLEL with consensus. Both are
    // optional; both return ok:false when keys missing so the
    // route never blocks on them.
    const { detectInsect } = await import('./ml/providers/insectProvider.js');
    // Provider adapters — crop.health (disease) + mushroom.id (edibility).
    // Best-effort: both return an honest UNSUPPORTED/ok:false envelope when the
    // key is missing or the API is unreachable, so they NEVER block a scan.
    const { detectCropHealth } = await import('./ml/providers/cropHealthProvider.js');
    const { detectMushroom } = await import('./ml/providers/mushroomProvider.js');
    const { fetchFieldHealth } = await import('./ml/providers/fieldHealthProvider.js');
    // Final 3-point gap closure — server-side SoilGrids (public,
    // key-less). Composes the new soilProvider; cached in Redis
    // 7 days. Honest ok:false envelope on timeout or invalid coords.
    const { fetchSoilProfile } = await import('./ml/providers/soilProvider.js');
    // V3 §2 + §5 + §6 — growth stage + regional intelligence +
    // market engine. Pure / async / never throw. Composed into the
    // unified envelope below alongside consensus + insect + soil +
    // field health.
    const { deriveGrowthStage } = await import('./ml/growthStageEngine.js');
    const { getRegionalIntelligence } = await import('./ml/providers/regionalIntelligenceProvider.js');
    const { getMarketIntelligence } = await import('./ml/marketEngine.js');

    // Derive farm coords from authenticated user's primary farm
    // (fire-and-forget — never blocks).
    let farmLat = null, farmLng = null;
    try {
      if (req.user && req.user.id) {
        const farm = await prisma.farm.findFirst({
          where:  { userId: req.user.id },
          select: { latitude: true, longitude: true },
        });
        if (farm) {
          farmLat = Number(farm.latitude);
          farmLng = Number(farm.longitude);
          if (!Number.isFinite(farmLat) || !Number.isFinite(farmLng)) {
            farmLat = null; farmLng = null;
          }
        }
      }
    } catch { /* swallow — field health falls back to ok:false */ }

    // ScanPipeline order: Plant.id (consensus) → Crop.health → Insect.id →
    // Mushroom.id → FarmBrain. Run in parallel (failure-isolated) and merge in
    // that precedence. Mushroom only fires on a mushroom-relevant scan (cost-
    // aware) — otherwise it short-circuits UNSUPPORTED without an API call.
    const _isMushroom = /mushroom|fungi|toadstool/i.test(String(cropName || '')
      + ' ' + String((req.body && req.body.scanMode) || ''));
    const [consensus, pest, cropHealth, mushroom, fieldHealth, soil] = await Promise.all([
      runConsensus({
        image:    pre.image,
        mime:     pre.mime,
        cropName, country, region,
      }),
      detectInsect({
        image: pre.image,
        mime:  pre.mime,
        cropName,
      }),
      detectCropHealth({ image: pre.image, mime: pre.mime, cropName }),
      _isMushroom
        ? detectMushroom({ image: pre.image, mime: pre.mime })
        : Promise.resolve({ ok: false, status: 'UNSUPPORTED', reason: 'not_mushroom_scan',
            species: '', edibility: 'unknown', confidence: 0, warnings: [] }),
      (farmLat != null && farmLng != null)
        ? fetchFieldHealth({ latitude: farmLat, longitude: farmLng, cropName })
        : Promise.resolve({ ok: false, reason: 'no_farm_coords',
            ndvi: null, cropVigor: null, stressScore: null,
            vegetationTrend: null, interpretation: '',
            confidence: 'low',
            limitations: 'Decision support, not a guarantee.' }),
      // Final 3-point gap closure — soil context. Same coord guard
      // as field health; SoilGrids is key-less so we just need lat/lng.
      (farmLat != null && farmLng != null)
        ? fetchSoilProfile({ latitude: farmLat, longitude: farmLng })
        : Promise.resolve({ ok: false, reason: 'no_farm_coords',
            soilTexture: { clayPct: null, sandPct: null, siltPct: null, label: 'unknown' },
            ph: null, organicMatterProxy: null,
            drainageRisk: 'unknown', confidence: 'low',
            interpretation: 'Soil reading requires farm coordinates.',
            limitations: 'Decision support, not a guarantee.' }),
    ]);

    // Inference orchestrator still runs for back-compat (legacy
    // symptom / confidence path). When the consensus engine returned
    // a real verdict, prefer those signals so safety filter +
    // contextFusionEngine see the higher-quality input.
    const inferenceRaw = await analyzePlantImage({
      image:    pre.image,
      mime:     pre.mime,
      cropName, plantName,
      country,  region,
      weather,
    });
    const inference = consensus && consensus.ok ? {
      symptom:    consensus.symptom    || inferenceRaw.symptom,
      confidence: consensus.confidence || inferenceRaw.confidence,
      meta: {
        ...(inferenceRaw.meta || {}),
        consensus:     true,
        consensusMode: consensus.consensusMode,
        provider:      'consensus:plantid+plantnet',
      },
      fallbackUsed: false,
    } : inferenceRaw;

    const fused = fuseContext({
      symptom:    inference.symptom,
      confidence: inference.confidence,
      activeExperience,
      country, region, weather,
      scanHistory,
      // landHealth flows through to the verdict alongside weather —
      // fuseContext's optional consumer; pass-through-safe when the
      // engine ignores it.
      landHealth,
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

    // High-confidence scan spec §1: tier policy from confidence.
    // §2: verification questions tailored to the predicted issue.
    let policy = { tier: safe.confidence, allowSpecificName: false, allowTop3: false, categoryOnly: true };
    let questions = [];
    try {
      const { tierPolicy } = await import('./ml/confidenceTiers.js');
      const { verificationQuestions } = await import('./ml/verificationQuestions.js');
      policy = tierPolicy(safe.confidence);
      questions = verificationQuestions({
        issue:  safe.possibleIssue,
        crop:   cropName,
        region,
        weather,
      });
    } catch { /* swallow — both modules are pure helpers */ }

    // Persist the training event (fire-and-forget — don't block
    // the response on the DB write).
    const scanId = req.body?.scanId || ('scan_' + Date.now().toString(36));
    try {
      await prisma.scanTrainingEvent.create({
        data: {
          scanId,
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

    // SCAN_OBSERVABILITY_V1 — one durable row per scan (fire-and-forget,
    // never blocks the response). scanId @unique → no duplicate rows.
    try {
      const _INSECTS = new Set(['holes', 'chewing', 'aphids', 'mites', 'whiteflies',
        'armyworm', 'caterpillar', 'beetle', 'thrips', 'mealybug', 'pest']);
      const _issue = String(safe.possibleIssue || '').toLowerCase();
      const _isInsect = [..._INSECTS].some((w) => _issue.includes(w));
      const _real = !(inference && inference.fallbackUsed);
      const _identified = _issue && _issue !== 'unclear';
      const _band = safe.confidence; // low | medium | high
      const _confPct = _band === 'high' ? 85 : _band === 'medium' ? 55 : _band === 'low' ? 25 : null;
      const { recordScanObservation } = await import('./ml/scanObservability.js');
      recordScanObservation(prisma, {
        scanId,
        userId:         req.user?.id || null,
        photoQuality:   req.body?.photoQuality || req.body?.imageQuality || null,
        provider:       (inference && inference.meta && inference.meta.provider) || (_real ? 'external' : 'rule'),
        cropName:       cropName || plantName || null,
        confidence:     _confPct,            // band-derived numeric (V1)
        confidenceBand: _band || null,
        healthDetected: !!(_identified && !_isInsect && _issue !== 'healthy'),
        detectedIssue:  (_identified && !_isInsect && _issue !== 'healthy') ? safe.possibleIssue : null,
        insectDetected: !!_isInsect,
        detectedInsect: _isInsect ? safe.possibleIssue : null,
        durationMs:     Date.now() - _obsT0,
        success:        !!(_real && _identified),
        failureReason:  _real ? null : ((inference && inference.meta && inference.meta.fallbackReason) || 'rule_fallback'),
      }).catch(() => {});
    } catch { /* swallow — observability is best-effort */ }

    // PRODUCTION VALIDATION — persist ONE durable ScanProviderMetric row per provider
    // call on every real scan, so the Reliability Dashboard + certification have real
    // evidence from production traffic (previously written only during certify runs).
    // Failures are classified into the 7 canonical buckets. Fire-and-forget + total —
    // metric recording must NEVER block or fail a scan.
    try {
      const [{ recordProviderMetric }, { classifyProviderFailure }] = await Promise.all([
        import('./services/scan/certification/providerReliability.js'),
        import('./services/scan/certification/providerFailure.js'),
      ]);
      const _haveCoords = (farmLat != null && farmLng != null);
      const _calls = [
        { provider: 'plant.id',    r: consensus,  run: true },
        { provider: 'insect.id',   r: pest,       run: true },
        { provider: 'crop.health', r: cropHealth, run: true },
        { provider: 'mushroom.id', r: mushroom,   run: _isMushroom },
        { provider: 'soil',        r: soil,       run: _haveCoords },
      ];
      for (const _c of _calls) {
        if (!_c.run) continue;                       // provider was not invoked this scan
        const r = _c.r || {};
        const ok = r.ok === true;
        const httpStatus = (typeof r.httpStatus === 'number') ? r.httpStatus : (ok ? 200 : null);
        const failCat = ok ? null : classifyProviderFailure({ httpStatus, reason: r.reason, status: r.status });
        recordProviderMetric(prisma, {
          provider:          _c.provider,
          status:            ok ? 'READY' : (failCat || r.status || 'UNKNOWN'),
          latency:           r.latencyMs,
          confidence:        r.confidence,
          httpStatus,
          failureReason:     ok ? null : (failCat || r.reason || r.status || null),
          retryCount:        r.retryCount,
          farmbrainAccepted: ok,                     // this provider produced a usable signal
          cacheHit:          r.cacheHit === true,
        });
      }
    } catch { /* swallow — provider-metric persistence is best-effort, never blocks a scan */ }

    // Smart Scan AI Backend §3 — strict-shape verdict for
    // ML / analytics / partner consumers. Existing rich
    // `verdict` field stays untouched so the frontend
    // ScanResultCard keeps rendering. New consumers should
    // bind to verdictV2.
    const verdictV2 = normalizeToSpecShape(safe, {
      // Force-low-confidence when the inference path used its
      // fallback engine (no real provider response). Honest
      // floor — never claim certainty we don't have.
      forceLowConfidence: !!inference.fallbackUsed,
    });
    // Plant Identification v1.1 — full envelope. Same
    // forceLowConfidence semantics; additionally feeds the
    // user-supplied selectedCropOrPlant through so the
    // identification card can echo the user's profile crop
    // when inference can't identify independently.
    const verdictV3 = normalizeToFullSpecShape(safe, {
      forceLowConfidence:   !!inference.fallbackUsed,
      selectedCropOrPlant:  cropName || plantName || null,
    });

    // Scan Decision Intelligence — tight 12-field action-card
    // envelope built from the safe verdict + caller context.
    // Pure function; never throws. Consumers bind to
    // `result.decision.{actionToday|nextCheck|saveableSummary|…}`
    // for the action-oriented UI without traversing the rich
    // verdict.
    const decision = normalizeToDecisionShape(safe, {
      selectedCropOrPlant:   cropName || plantName || null,
      tierPolicy:            policy,
      verificationQuestions: questions,
      weather, region, country,
      landHealth,
      providerName:          (inference.meta && inference.meta.provider) || null,
      forceLowConfidence:    !!inference.fallbackUsed,
    });

    // Scan Recovery Sprint §3 — spec envelope. Single canonical
    // shape IntelligentScanResult consumes; replaces the legacy
    // verdict as the surface the result page renders.
    // V2 — also carries pest + fieldHealth signals.
    const { buildScanRecoveryEnvelope } =
      await import('./ml/scanRecoveryEnvelope.js');
    // V2 §5 — apply learning boost to candidates using THIS user's
    // confirmation history before envelope build. Re-rank only;
    // never invent new candidates.
    let _boostedConsensus = consensus;
    try {
      if (req.user && req.user.id && consensus && consensus.ok
          && Array.isArray(consensus.candidates) && consensus.candidates.length > 0) {
        const { readUserConfirmationHistory, applyLearningBoost } =
          await import('./ml/scanLearningEngine.js');
        const history = await readUserConfirmationHistory(prisma, req.user.id, 50);
        if (history.length > 0) {
          const boosted = applyLearningBoost(consensus.candidates, history);
          // Replace candidate list; preserve everything else on the frozen object.
          _boostedConsensus = Object.freeze({
            ...consensus,
            candidates: boosted,
            identification: boosted[0] ? Object.freeze({
              commonName:     boosted[0].commonName,
              scientificName: boosted[0].scientificName,
              score:          boosted[0].score,
            }) : consensus.identification,
            learningApplied: true,
          });
        }
      }
    } catch { /* swallow — fall through to raw consensus */ }

    // V3 §2 — growth stage. Reads planting date from the user's
    // farm profile when present. Pure / never throws.
    let plantingDate = null;
    try {
      if (req.user && req.user.id) {
        const farm = await prisma.farm.findFirst({
          where: { userId: req.user.id },
          select: { plantingDate: true },
        });
        plantingDate = farm && farm.plantingDate
          ? new Date(farm.plantingDate).toISOString()
          : null;
      }
    } catch { /* swallow */ }
    const growthStage = deriveGrowthStage({
      scanCategory: consensus && consensus.identification
        ? 'plant' : 'unknown',
      plantType:    cropName || plantName,
      plantingDate,
      weather,
      healthStatus: safe && safe.confidence,
    });

    // V3 §5 — regional intelligence. Composes user's prior local
    // scans + weather + the planting-window table. Honest
    // 'unknown' pressure bands when sample size <3.
    const regional = await getRegionalIntelligence(prisma, {
      country, region,
      district: req.body && req.body.district,
      latitude: farmLat, longitude: farmLng,
      cropName,
      weather,
    });

    // V3 §6 — market intelligence. Composes recent listings +
    // nearby buyers + a conservative reference-price table when
    // the marketplace module is unwired. Never fabricates.
    const market = await getMarketIntelligence(prisma, {
      cropName, plantName, country, region,
      growthStage: growthStage.stage,
    });

    const scanRecovery = buildScanRecoveryEnvelope({
      consensus:    _boostedConsensus,
      safe,
      fused,
      pest,
      fieldHealth,
      soil,
      growthStage,
      regional,
      market,
      cropNameHint: cropName || plantName,
    });

    // V3 §7 — auto-create 3 / 7 / 14-day follow-up plan + persist.
    // Fire-and-forget; the analyze response carries the plan so the
    // client can show "Re-check in 3 days" cards immediately.
    let followUpPlan = null;
    try {
      const { buildFollowUpPlan, persistFollowUpPlan } =
        await import('./ml/followUpEngine.js');
      followUpPlan = buildFollowUpPlan({
        scanId,
        severity:    (scanRecovery && scanRecovery.severity) || null,
        growthStage: growthStage.stage,
      });
      persistFollowUpPlan(prisma, { scanId, plan: followUpPlan })
        .catch(() => { /* logged inside */ });
    } catch { followUpPlan = null; }

    // Scan Intelligence V2 §3 — auto-persist FULL outcome. Pure
    // helper; logs failures via console.warn (no silent training-
    // corpus leakage). Fires AFTER the response shape is built so
    // the persistence write never delays the response.
    try {
      const { persistScanOutcome } =
        await import('./ml/scanOutcomePersister.js');
      // Fire-and-forget — never await; never block /api/scan/analyze.
      persistScanOutcome(prisma, {
        scanId,
        userId:   req.user?.id || null,
        imageUrl: imageUrl || null,
        cropName, country, region,
        weather,
        recovery: scanRecovery,
        pest,
        fieldHealth,
        soil,
      }).catch(() => { /* swallow — already logged inside */ });
    } catch { /* swallow */ }

    const _scanResponse = {
      ok:                    true,
      // Scan Recovery Sprint §3 — new canonical envelope. Lives at
      // top-level + ALSO spread onto the legacy `verdict` so the
      // IntelligentScanResult extractors find it whether they read
      // result.plantName or result.scanRecovery.plantName.
      scanRecovery,
      plantName:             scanRecovery.plantName,
      scientificName:        scanRecovery.scientificName,
      confidence:            scanRecovery.confidence,
      diseaseCandidates:     scanRecovery.diseaseCandidates,
      severity:              scanRecovery.severity,
      recommendations:       scanRecovery.recommendations,
      nextAction:            scanRecovery.nextAction,
      candidates:            scanRecovery.candidates,
      consensusMode:         scanRecovery.consensusMode,
      // Final closure — pest + fieldHealth + soil surfaced at top
      // level so IntelligentScanResult's extractors (which read
      // result.soil / result.fieldHealth / result.pest directly)
      // find them without traversing the scanRecovery envelope.
      pest:                  scanRecovery.pest,
      fieldHealth:           scanRecovery.fieldHealth,
      soil:                  scanRecovery.soil,
      satellite:             scanRecovery.fieldHealth, // alias for IntelligentScanResult._extractSatellite
      // Provider adapters — crop.health (disease) + mushroom.id (edibility),
      // merged into the result. FarmBrain consumes these alongside plant/pest.
      cropHealth:            cropHealth,
      mushroom:              mushroom,
      // Per-provider runtime status this scan (READY/AUTH_FAILED/RATE_LIMITED/
      // NO_RESULT/UNSUPPORTED) — the live truth, never assumed.
      providerStatuses: {
        plantId:    (consensus && consensus.ok) ? 'READY' : (consensus && consensus.status) || 'NO_RESULT',
        cropHealth: (cropHealth && cropHealth.status) || 'UNSUPPORTED',
        insectId:   (pest && pest.ok) ? 'READY' : ((pest && pest.status) || 'NO_RESULT'),
        mushroom:   (mushroom && mushroom.status) || 'UNSUPPORTED',
      },
      // V3 — growth + regional + market + follow-up. Surfaced at
      // top level for the ScanCommandCard composer.
      growthStage,
      regional,
      market,
      followUpPlan,
      // ── Permanent Detection Fix (v5) — top-level mirrors ──
      // Mirror the canonical scanRecovery envelope fields at the
      // root so the IntelligentScanResult extractors find them
      // without nested traversal. See scanRecoveryEnvelope.js v5.
      topCandidates:    scanRecovery.topCandidates,
      confidenceLabel:  scanRecovery.confidenceLabel,
      issueCandidates:  scanRecovery.issueCandidates,
      whatWeNoticed:    scanRecovery.whatWeNoticed,
      whyItMatters:     scanRecovery.whyItMatters,
      healthStatus:     scanRecovery.healthStatus,
      imageQuality:     scanRecovery.imageQuality,
      sourceResults:    scanRecovery.sourceResults,
      followUpDate:     scanRecovery.followUpDate,
      // ── Universal Scan (v6) — sprint #178 ──────────────────
      // Mirror universal-scan additions at the root so the
      // IntelligentScanResult Type chip + issue-aware actions
      // surface without nested traversal. objectType ∈ 11 categories;
      // issueType ∈ 18 labels + 'no_visible_issue'.
      objectType:       scanRecovery.objectType,
      issueType:        scanRecovery.issueType,
      verdict:               safe,
      verdictV2,
      verdictV3,
      decision,
      tierPolicy:            policy,
      verificationQuestions: questions,
      scanId,
      // Smart Scan AI Backend §7 — surface remaining quota so
      // the client can show "X of N scans left today" without
      // a second round-trip.
      scanQuota: {
        limit:     _limit.limit,
        used:      _limit.used + 1,                 // +1 for the scan we just did
        remaining: Math.max(0, _limit.remaining - 1),
        resetAt:   _limit.resetAt,
      },
      inferenceMeta: {
        provider:     inference.meta?.provider || null,
        latencyMs:    inference.meta?.latencyMs || 0,
        fallbackUsed: !!inference.fallbackUsed,
      },
      // Surface the satellite snapshot (or null) so the result UI
      // can render a "land-health caution" line when stress is
      // visible. Pure pass-through — the snapshot shape is opaque
      // to this route; consumers read what's there.
      landHealth,
    };

    // PLANT SAFETY ENGINE (feature-flagged: plantSafetyEngine) — attach structured,
    // non-fabricated edibility/toxicity guidance for a CONFIDENT known plant. When the
    // flag is OFF the response is byte-identical to before (client falls back to its
    // local safety badge), so this is fully backward compatible. Pure in-memory lookup
    // → no provider call, no I/O, no scan-latency cost. Additive + never blocks a scan.
    try {
      const [{ attachSafety }, { isFeatureEnabled }] = await Promise.all([
        import('./ml/safety/plantSafetyEngine.js'),
        import('./config/features.js'),
      ]);
      attachSafety(
        _scanResponse,
        scanRecovery.plantName,
        scanRecovery.confidence,
        isFeatureEnabled('plantSafetyEngine'),
      );
    } catch { /* swallow — safety is additive, never blocks the scan result */ }

    // LAST-SCAN TRACE — record a REDACTED trace (no secrets, no image bytes) so an
    // admin can root-cause "why did this scan return unknown?" via /api/admin/scan/
    // last-trace. Whitelist-only by construction; fire-and-forget; never blocks.
    try {
      const { recordScanTrace } = await import('./ml/scanLastTrace.js');
      const _top = (Array.isArray(scanRecovery.topCandidates) && scanRecovery.topCandidates[0]) || {};
      const _b64 = typeof imageBase64 === 'string' ? imageBase64 : '';
      recordScanTrace({
        scanId,
        imageMime: (req.body && (req.body.imageMime || req.body.mime)) || null,
        imageBytes: _b64 ? Math.round(_b64.length * 0.75) : null,   // base64 → byte estimate, NOT the bytes
        imageDims: scanRecovery.imageQuality && scanRecovery.imageQuality.stats
          ? { width: scanRecovery.imageQuality.stats.width, height: scanRecovery.imageQuality.stats.height } : null,
        qualityScore: (scanRecovery.imageQuality && (scanRecovery.imageQuality.score ?? scanRecovery.imageQuality.qualityScore)) ?? null,
        providers: [
          { name: 'plant.id',   status: (consensus && consensus.ok) ? 'READY' : (consensus && consensus.status) || 'NO_RESULT', latencyMs: consensus && consensus.latencyMs, httpStatus: consensus && consensus.httpStatus },
          { name: 'crop.health', status: (cropHealth && cropHealth.status) || 'UNSUPPORTED', latencyMs: cropHealth && cropHealth.latencyMs },
          { name: 'insect.id',  status: (pest && pest.ok) ? 'READY' : (pest && pest.status) || 'NO_RESULT', latencyMs: pest && pest.latencyMs },
        ],
        rawCandidateCount: Array.isArray(consensus && consensus.candidates) ? consensus.candidates.length : null,
        normalizedCandidateCount: Array.isArray(scanRecovery.topCandidates) ? scanRecovery.topCandidates.length : null,
        topScientificName: _top.scientificName || scanRecovery.scientificName || null,
        topCommonName: _top.commonName || _top.name || scanRecovery.plantName || null,
        topConfidence: typeof scanRecovery.confidence === 'number' ? scanRecovery.confidence : null,
        cropHealthStatus: (cropHealth && cropHealth.status) || null,
        rejectionReason: (Array.isArray(scanRecovery.topCandidates) && scanRecovery.topCandidates.length === 0)
          ? 'no_candidates'
          : (scanRecovery.confidenceLabel === 'low' ? 'low_confidence' : null),
        finalVerdict: scanRecovery.plantName || scanRecovery.possibleIssue || 'unknown',
      }, new Date().toISOString());
    } catch { /* swallow — tracing must never affect a scan */ }

    return res.json(_scanResponse);
  } catch (err) {
    // Smart Scan AI Backend §8 — total-failure fallback. We
    // never return an empty body or a raw 500; the client
    // always gets the spec-shape verdict so render code stays
    // identical regardless of whether the AI succeeded. Lazy-
    // import here so module-resolution failures don't shadow
    // the original error.
    let fallbackBody = {
      error:    'scan_analyze_failed',
      message:  err && err.message,
    };
    try {
      const { SPEC_FALLBACK_VERDICT, SPEC_FALLBACK_FULL, SPEC_FALLBACK_DECISION } =
        await import('./ml/scanResultNormalizer.js');
      fallbackBody.verdictV2 = SPEC_FALLBACK_VERDICT;
      fallbackBody.verdictV3 = SPEC_FALLBACK_FULL;
      fallbackBody.decision  = SPEC_FALLBACK_DECISION;
    } catch { /* swallow — body still ships error code */ }
    return res.status(500).json(fallbackBody);
  }
});

// ── Recommendation Engine V1 — daily action ─────────────────
// GET /api/daily-action
//   Returns exactly ONE clear daily action for the signed-in
//   farmer per the spec shape:
//     { action, priority, reason, confidence, estimatedTime,
//       followUpDate, topThree[<=3] }
//   Always returns 1 action — even on internal failure the engine
//   falls back to a conservative "walk the field" suggestion so
//   the contract holds.
app.get('/api/daily-action', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    // Pull farm + crop + growth-stage context.
    let farm = null;
    try {
      farm = await prisma.farm.findFirst({
        where:  { userId },
        select: { id: true, latitude: true, longitude: true,
                  country: true, region: true, plantingDate: true,
                  crop: true },
      });
    } catch { farm = null; }

    const lat = farm ? Number(farm.latitude)  : null;
    const lng = farm ? Number(farm.longitude) : null;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    // Latest scan envelope.
    let scan = null;
    try {
      const row = await prisma.scanTrainingEvent.findFirst({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        select:  { weatherSummary: true, plantName: true,
                   cropName: true, confidence: true },
      });
      if (row && row.weatherSummary && typeof row.weatherSummary === 'object') {
        const ws = row.weatherSummary;
        scan = {
          plantName: row.plantName || row.cropName,
          severity:  ws.severity || row.confidence,
          diseaseCandidates: Array.isArray(ws.diseaseCandidates)
            ? ws.diseaseCandidates : [],
          pest: ws.pest || null,
        };
      }
    } catch { scan = null; }

    // Weather + growth stage in parallel.
    const [weather, growthStage] = await Promise.all([
      hasCoords
        ? import('./services/weather/weatherProvider.js')
            .then((m) => m.getWeatherForFarm({ latitude: lat, longitude: lng }))
            .catch(() => null)
        : Promise.resolve(null),
      import('./ml/growthStageEngine.js')
        .then((m) => m.deriveGrowthStage({
          plantType: farm && farm.crop,
          plantingDate: farm && farm.plantingDate
            ? new Date(farm.plantingDate).toISOString() : null,
          weather: null,
        }))
        .catch(() => null),
    ]);

    // Open tasks (current pending) — best-effort.
    let openTasks = [];
    try {
      if (prisma.task) {
        openTasks = await prisma.task.findMany({
          where:   { userId, status: { not: 'completed' } },
          orderBy: { createdAt: 'desc' },
          take:    10,
          select:  { title: true },
        });
      }
    } catch { openTasks = []; }

    // Recent recommendation outcome history (60d).
    let outcomeHistory = [];
    try {
      const { computeRecommendationSuccess } =
        await import('./ml/outcomeIntelligenceEngine.js');
      const out = await computeRecommendationSuccess(prisma, { days: 60 });
      if (out && out.ok) outcomeHistory = Array.from(out.rows);
    } catch { outcomeHistory = []; }

    const { computeDailyAction } = await import('./ml/dailyActionEngine.js');
    const envelope = computeDailyAction({
      weather, scan,
      crop:            farm && farm.crop,
      growthStage,
      openTasks,
      outcomeHistory,
    });

    // Today's Action V1 — funnel stage 1: SHOWN. Fire-and-forget.
    // Caller can also explicitly POST /api/daily-action/shown if
    // it wants to be sure the event landed.
    try {
      const { logEvent } = await import('./ml/todaysActionFunnel.js');
      const actionId = 'ta_' + Buffer.from(String(envelope.action || ''))
        .toString('base64').slice(0, 32);
      logEvent(prisma, {
        userId, actionId,
        kind: 'shown',
        metadata: {
          priority: envelope.priority,
          category: envelope.category,
          priorityScore: envelope.priorityScore,
        },
      }).catch(() => { /* swallow */ });
      // Attach the actionId to the envelope so the client can
      // reference the same id in /start + /outcome calls.
      return res.json({ ...envelope, actionId });
    } catch {
      return res.json(envelope);
    }
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'daily_action_failed', message: err && err.message,
      // Still emit the contract-required fields so the UI never
      // sees a missing `action`.
      action: 'Walk the field for 5 minutes and note anything unusual.',
      priority: 'low', reason: 'Service degraded — running on safe fallback.',
      confidence: 30, estimatedTime: '5 minutes',
      followUpDate: new Date(Date.now() + 14 * 24 * 3600 * 1000)
        .toISOString().slice(0, 10),
      topThree: [],
    });
  }
});

// POST /api/daily-action/start
//   body: { actionId, action, category?, priority?, followUpDate?,
//            estimatedMinutes? }
//   Auto-creates: task + follow-up plan + outcome path.
//   Logs funnel stage 2: STARTED.
app.post('/api/daily-action/start', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const b = req.body || {};
    if (!b.action) return res.status(400).json({ error: 'action_required' });

    const { logEvent } = await import('./ml/todaysActionFunnel.js');
    let taskId = null;

    // 1. Create the real Task row when the Task model exists.
    try {
      if (prisma.task && typeof prisma.task.create === 'function') {
        const taskRow = await prisma.task.create({
          data: {
            userId,
            title:    String(b.action).slice(0, 200),
            status:   'in_progress',
            category: b.category ? String(b.category).slice(0, 32) : 'general',
            priority: b.priority ? String(b.priority).slice(0, 16) : 'medium',
          },
        });
        taskId = taskRow.id;
      }
    } catch { /* swallow — task creation is best-effort */ }

    // 2. Create the follow-up plan (3 / 7 / 14 day) so the user
    //    sees re-check reminders. Re-uses the V3 follow-up engine.
    let followUpPlan = null;
    try {
      const { buildFollowUpPlan, persistFollowUpPlan } =
        await import('./ml/followUpEngine.js');
      // Mint a synthetic scanId if the action wasn't tied to one — the
      // follow-up engine just needs a stable key.
      const synthScan = b.scanId || ('ta_' + Date.now().toString(36));
      followUpPlan = buildFollowUpPlan({
        scanId:      synthScan,
        severity:    b.priority || 'medium',
        growthStage: b.growthStage || null,
      });
      persistFollowUpPlan(prisma, { scanId: synthScan, plan: followUpPlan })
        .catch(() => { /* logged inside */ });
    } catch { /* swallow — follow-up is best-effort */ }

    // 3. Funnel stage 2 — STARTED.
    await logEvent(prisma, {
      userId,
      actionId: b.actionId ? String(b.actionId).slice(0, 100) : null,
      taskId,
      scanId:   b.scanId  ? String(b.scanId).slice(0, 100) : null,
      kind:     'started',
      metadata: {
        category: b.category || null,
        priority: b.priority || null,
        estimatedMinutes: b.estimatedMinutes || null,
      },
    });

    return res.json({
      ok: true,
      taskId,
      followUpPlanItems: followUpPlan ? followUpPlan.items : null,
      outcomePathReady:  true,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'start_failed', message: err && err.message,
    });
  }
});

// POST /api/daily-action/complete — funnel stage 3: COMPLETED.
//   body: { actionId, taskId? }
app.post('/api/daily-action/complete', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const b = req.body || {};
    const { logEvent } = await import('./ml/todaysActionFunnel.js');
    await logEvent(prisma, {
      userId,
      actionId: b.actionId ? String(b.actionId).slice(0, 100) : null,
      taskId:   b.taskId   ? String(b.taskId).slice(0, 100) : null,
      kind:     'completed',
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'complete_failed', message: err && err.message,
    });
  }
});

// POST /api/daily-action/outcome — funnel stage 4: OUTCOME_RECORDED.
//   body: { actionId, outcome ('better'|'same'|'worse'), taskId?,
//            scanId?, note? }
app.post('/api/daily-action/outcome', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const b = req.body || {};
    if (!['better', 'same', 'worse'].includes(b.outcome)) {
      return res.status(400).json({ error: 'invalid_outcome' });
    }
    const { logEvent } = await import('./ml/todaysActionFunnel.js');
    await logEvent(prisma, {
      userId,
      actionId: b.actionId ? String(b.actionId).slice(0, 100) : null,
      taskId:   b.taskId   ? String(b.taskId).slice(0, 100) : null,
      scanId:   b.scanId   ? String(b.scanId).slice(0, 100) : null,
      kind:     'outcome_recorded',
      outcome:  b.outcome,
      metadata: { note: b.note ? String(b.note).slice(0, 500) : null },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'outcome_failed', message: err && err.message,
    });
  }
});

// GET /api/daily-action/kpi?days=30 — 5-step funnel for the
// founder analytics dashboard. Admin / super_admin / NGO only.
app.get('/api/daily-action/kpi', authenticate, async (req, res) => {
  if (!req.user || !['admin', 'super_admin', 'ngo', 'field_officer']
        .includes(req.user.role)) {
    return res.status(403).json({ error: 'admin_only' });
  }
  try {
    const { computeFunnel } = await import('./ml/todaysActionFunnel.js');
    const days = Number(req.query?.days) || 30;
    const out = await computeFunnel(prisma, days);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'kpi_failed', message: err && err.message,
    });
  }
});

// ── Intelligence Platform V1 — unified recommendation engine ─
// GET /api/recommendations/today
//   Returns the Top Action + Top 3 prioritized actions for the
//   signed-in farmer. Composes the most recent scan envelope, the
//   last weather snapshot, the farm's soil + satellite + regional
//   + market signals, and the user's recent recommendation outcome
//   rows. Pure / never throws / honest empty-state when no inputs.
app.get('/api/recommendations/today', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });

    // Locate the user's primary farm + last weather snapshot.
    let farm = null;
    try {
      farm = await prisma.farm.findFirst({
        where:  { userId },
        select: { id: true, latitude: true, longitude: true,
                  country: true, region: true, plantingDate: true,
                  crop: true },
      });
    } catch { farm = null; }

    // Pull the most recent scan training event for this user as the
    // "current scan" context. weatherSummary carries the v3 outcome
    // envelope when present.
    let scan = null;
    try {
      const row = await prisma.scanTrainingEvent.findFirst({
        where:   { userId },
        orderBy: { createdAt: 'desc' },
        select:  { scanId: true, predictedIssue: true,
                   confidence: true, weatherSummary: true,
                   plantName: true, cropName: true },
      });
      if (row && row.weatherSummary && typeof row.weatherSummary === 'object') {
        const ws = row.weatherSummary;
        scan = {
          scanId:    row.scanId,
          plantName: row.plantName || row.cropName,
          confidence: ws.confidencePct
            || (row.confidence === 'high' ? 85
                : row.confidence === 'medium' ? 55 : 25),
          severity:    ws.severity || row.confidence,
          diseaseCandidates: Array.isArray(ws.diseaseCandidates)
            ? ws.diseaseCandidates : [],
          pest:        ws.pest || null,
          nextAction:  ws.followUpTask && ws.followUpTask.title,
        };
      }
    } catch { scan = null; }

    // Lazy-import providers — same pattern the analyze route uses.
    const lat = farm ? Number(farm.latitude) : null;
    const lng = farm ? Number(farm.longitude) : null;
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    const [soilEnv, satellite, regional, market] = await Promise.all([
      hasCoords
        ? import('./ml/providers/soilProvider.js')
            .then((m) => m.fetchSoilProfile({ latitude: lat, longitude: lng }))
            .catch(() => null)
        : Promise.resolve(null),
      hasCoords
        ? import('./ml/providers/fieldHealthProvider.js')
            .then((m) => m.fetchFieldHealth({ latitude: lat, longitude: lng,
              cropName: farm && farm.crop }))
            .catch(() => null)
        : Promise.resolve(null),
      import('./ml/providers/regionalIntelligenceProvider.js')
        .then((m) => m.getRegionalIntelligence(prisma, {
          country: farm && farm.country, region: farm && farm.region,
          latitude: lat, longitude: lng,
          cropName: farm && farm.crop,
        })).catch(() => null),
      import('./ml/marketEngine.js')
        .then((m) => m.getMarketIntelligence(prisma, {
          cropName: farm && farm.crop,
          country:  farm && farm.country, region: farm && farm.region,
        })).catch(() => null),
    ]);

    // Weather snapshot — best-effort.
    let weather = null;
    try {
      if (hasCoords) {
        const { getWeatherForFarm } = await import('./services/weather/weatherProvider.js');
        weather = await getWeatherForFarm({ latitude: lat, longitude: lng });
      }
    } catch { weather = null; }

    // Outcome history — last 90 days of recommendation outcomes,
    // bucketed for the engine's boost step.
    let outcomeHistory = [];
    try {
      const { computeRecommendationSuccess } =
        await import('./ml/outcomeIntelligenceEngine.js');
      const out = await computeRecommendationSuccess(prisma, { days: 90 });
      if (out && out.ok) outcomeHistory = Array.from(out.rows);
    } catch { outcomeHistory = []; }

    const { computeUnifiedRecommendations } =
      await import('./ml/recommendationPriorityEngine.js');
    const envelope = computeUnifiedRecommendations({
      weather,
      scan,
      soil:      soilEnv && soilEnv.ok ? soilEnv : null,
      satellite: satellite && satellite.ok ? satellite : null,
      regional:  regional && regional.ok ? regional : null,
      market:    market && market.ok ? market : null,
      outcomeHistory,
    });
    return res.json(envelope);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'unified_recommendations_failed',
      message: err && err.message,
      topAction: null, topThree: [],
    });
  }
});

// POST /api/recommendations/score — pure helper for clients that
// already have the 4-tuple (risk, urgency, impact, confidence) and
// just need the priority score. Useful for previewing the score
// before persisting a custom action.
app.post('/api/recommendations/score', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    const { scoreAction } = await import('./ml/recommendationPriorityEngine.js');
    const score = scoreAction({
      risk:       Number(b.risk) || 0,
      urgency:    Number(b.urgency) || 0,
      impact:     Number(b.impact) || 0,
      confidence: Number(b.confidence) || 0,
    });
    return res.json({ ok: true, priorityScore: score });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'score_failed',
      message: err && err.message });
  }
});

// ── Permanent Scan Detection — admin trace + escalation ─────
// GET /api/admin/scan/trace/:scanId — masked end-to-end trace
//   admin / super_admin / ngo / field_officer only
//   Returns raw provider envelopes + consensus + final API payload
//   reconstructed from the stored scanTrainingEvent row.
//   API keys are NEVER returned — only `keyMasked: true` flags.
app.get('/api/admin/scan/trace/:scanId', authenticate, async (req, res) => {
  if (!req.user || !['admin', 'super_admin', 'ngo', 'field_officer']
      .includes(req.user.role)) {
    return res.status(403).json({ error: 'admin_only' });
  }
  try {
    const scanId = String(req.params.scanId || '');
    if (!scanId) return res.status(400).json({ error: 'scanId_required' });
    const row = await prisma.scanTrainingEvent.findFirst({
      where:   { scanId },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return res.status(404).json({ error: 'not_found' });
    const ws = row.weatherSummary && typeof row.weatherSummary === 'object'
      ? row.weatherSummary : {};
    // Build the trace envelope. The scan_training_event row carries
    // the persisted outcome envelope (v: 3) which has the per-source
    // attribution. Raw provider responses (full Plant.id / PlantNet
    // JSON) are NOT stored — would balloon row size. The trace shows
    // the parsed candidates + the consensus output instead.
    const trace = Object.freeze({
      scanId:       row.scanId,
      createdAt:    row.createdAt && row.createdAt.toISOString(),
      userId:       row.userId ? '[redacted]' : null,
      // Predictions captured at analyze time.
      predictedPlant:   row.plantName || null,
      predictedIssue:   row.predictedIssue || null,
      confidence:       row.confidence || null,
      confidencePct:    typeof ws.confidencePct === 'number' ? ws.confidencePct : null,
      consensusMode:    ws.consensusMode || null,
      // Provider attribution (masked — only ok/latency, never raw key).
      sourceResults:    Array.isArray(ws.sources) ? ws.sources : [],
      // Reconstructed outcome envelope.
      diseaseCandidates: Array.isArray(ws.diseaseCandidates)
                          ? ws.diseaseCandidates : [],
      candidates:       Array.isArray(ws.candidates) ? ws.candidates : [],
      pest:             ws.pest || null,
      soil:             ws.soil || null,
      fieldHealth:      ws.fieldHealth || null,
      recommendations:  Array.isArray(ws.recommendations) ? ws.recommendations : [],
      followUpTask:     ws.followUpTask || null,
      followUps:        Array.isArray(ws.followUps) ? ws.followUps : [],
      learning:         ws.learning || null,
      // Key masking attestation.
      keysMasked:       true,
      neverEmitsApiKeys: true,
      limitations:      'Decision support, not a guarantee.',
    });
    return res.json({ ok: true, trace });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'trace_failed', message: err && err.message,
    });
  }
});

// POST /api/scan/escalate — review escalation when confidence<60.
//   body: { scanId, target ('community'|'field_officer'|'admin'),
//            note? }
//   Status starts at 'pending review'. Composes existing human-
//   review queue when present; falls back to a structured event.
app.post('/api/scan/escalate', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const b = req.body || {};
    if (!b.scanId) return res.status(400).json({ error: 'scanId_required' });
    if (!['community', 'field_officer', 'admin'].includes(b.target)) {
      return res.status(400).json({ error: 'invalid_target' });
    }
    // Log as a scan training event annotation so the row carries
    // the escalation marker. No new schema migration required.
    try {
      const existing = await prisma.scanTrainingEvent.findFirst({
        where:   { scanId: String(b.scanId) },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        const prev = existing.weatherSummary
          && typeof existing.weatherSummary === 'object'
          ? existing.weatherSummary : {};
        await prisma.scanTrainingEvent.update({
          where: { id: existing.id },
          data:  { weatherSummary: { ...prev, escalation: {
            target:   String(b.target),
            note:     b.note ? String(b.note).slice(0, 500) : null,
            status:   'pending review',
            createdAt: new Date().toISOString(),
            userId:   userId,
          } } },
        });
      }
    } catch { /* swallow — annotation is best-effort */ }
    return res.json({
      ok: true,
      status: 'pending review',
      target: String(b.target),
      message: 'Scan queued for review. You will see the outcome here once reviewed.',
    });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'escalate_failed', message: err && err.message,
    });
  }
});

// ── Outcome Intelligence Platform ────────────────────────────
// POST /api/outcomes/task
//   body: { taskId, completion ('yes'|'partial'|'no'),
//            scanId?, recommendation?, note? }
app.post('/api/outcomes/task', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.taskId || !['yes', 'partial', 'no'].includes(b.completion)) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    let farmId = null;
    try {
      if (req.user && req.user.id) {
        const farm = await prisma.farm.findFirst({
          where: { userId: req.user.id }, select: { id: true },
        });
        farmId = farm ? farm.id : null;
      }
    } catch { /* swallow */ }
    const row = await prisma.taskOutcome.create({
      data: {
        taskId:         String(b.taskId),
        userId:         req.user?.id || null,
        farmId,
        scanId:         b.scanId ? String(b.scanId) : null,
        recommendation: b.recommendation ? String(b.recommendation).slice(0, 200) : null,
        completion:     String(b.completion),
        note:           b.note ? String(b.note).slice(0, 500) : null,
      },
    });
    return res.json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'task_outcome_failed', message: err && err.message,
    });
  }
});

// POST /api/outcomes/follow-up
//   body: { scanId, recommendation, dayOffset (3|7|14),
//            result ('improved'|'same'|'worse'),
//            category? ('disease'|'pest'|'soil'|'other'),
//            crop?, region?, season?, taskId?, note? }
app.post('/api/outcomes/follow-up', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.scanId || !b.recommendation
        || ![3, 7, 14].includes(Number(b.dayOffset))
        || !['improved', 'same', 'worse'].includes(b.result)) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    let farmId = null;
    try {
      if (req.user && req.user.id) {
        const farm = await prisma.farm.findFirst({
          where: { userId: req.user.id }, select: { id: true, region: true },
        });
        farmId = farm ? farm.id : null;
      }
    } catch { /* swallow */ }

    const row = await prisma.recommendationOutcome.create({
      data: {
        scanId:         String(b.scanId),
        taskId:         b.taskId ? String(b.taskId) : null,
        userId:         req.user?.id || null,
        farmId,
        recommendation: String(b.recommendation).slice(0, 200),
        crop:           b.crop ? String(b.crop).slice(0, 80) : null,
        region:         b.region ? String(b.region).slice(0, 80) : null,
        season:         b.season ? String(b.season).slice(0, 32) : null,
        category:       ['disease', 'pest', 'soil', 'other'].includes(b.category)
                          ? String(b.category) : 'other',
        dayOffset:      Number(b.dayOffset),
        result:         String(b.result),
        note:           b.note ? String(b.note).slice(0, 500) : null,
      },
    });
    return res.json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'follow_up_outcome_failed', message: err && err.message,
    });
  }
});

// POST /api/outcomes/photo-pair
//   body: { scanId, beforeUrl, afterUrl?, improvementNote?,
//            verdict? ('better'|'same'|'worse') }
app.post('/api/outcomes/photo-pair', authenticate, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.scanId || !b.beforeUrl) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const existing = await prisma.photoComparison.findFirst({
      where:   { scanId: String(b.scanId) },
      orderBy: { beforeAt: 'desc' },
    });
    let farmId = null;
    try {
      if (req.user && req.user.id) {
        const farm = await prisma.farm.findFirst({
          where: { userId: req.user.id }, select: { id: true },
        });
        farmId = farm ? farm.id : null;
      }
    } catch { /* swallow */ }

    if (existing && b.afterUrl && !existing.afterUrl) {
      // Promote — second tap with the after photo.
      const updated = await prisma.photoComparison.update({
        where: { id: existing.id },
        data: {
          afterUrl:        String(b.afterUrl),
          afterAt:         new Date(),
          improvementNote: b.improvementNote ? String(b.improvementNote).slice(0, 500) : existing.improvementNote,
          verdict:         ['better', 'same', 'worse'].includes(b.verdict)
                             ? String(b.verdict) : existing.verdict,
        },
      });
      return res.json({ ok: true, id: updated.id, promoted: true });
    }

    const row = await prisma.photoComparison.create({
      data: {
        scanId:          String(b.scanId),
        userId:          req.user?.id || null,
        farmId,
        beforeUrl:       String(b.beforeUrl),
        afterUrl:        b.afterUrl ? String(b.afterUrl) : null,
        afterAt:         b.afterUrl ? new Date() : null,
        improvementNote: b.improvementNote ? String(b.improvementNote).slice(0, 500) : null,
        verdict:         ['better', 'same', 'worse'].includes(b.verdict)
                           ? String(b.verdict) : null,
      },
    });
    return res.json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'photo_pair_failed', message: err && err.message,
    });
  }
});

// GET /api/outcomes/recommendation-ranking
//   query: { category?, crop?, region?, season?, days? }
app.get('/api/outcomes/recommendation-ranking', authenticate, async (req, res) => {
  try {
    const { rankRecommendations } = await import('./ml/outcomeIntelligenceEngine.js');
    const out = await rankRecommendations(prisma, {
      category: req.query?.category,
      crop:     req.query?.crop,
      region:   req.query?.region,
      season:   req.query?.season,
      days:     Number(req.query?.days) || 90,
    });
    return res.json(out);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'ranking_failed', message: err && err.message,
    });
  }
});

// GET /api/outcomes/farmer-dashboard
app.get('/api/outcomes/farmer-dashboard', authenticate, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { computeFarmerDashboard } = await import('./ml/outcomeIntelligenceEngine.js');
    const out = await computeFarmerDashboard(prisma, req.user.id);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'farmer_dashboard_failed', message: err && err.message,
    });
  }
});

// GET /api/outcomes/organization — admin only
app.get('/api/outcomes/organization', authenticate, async (req, res) => {
  if (!req.user || !['admin', 'super_admin', 'ngo', 'field_officer'].includes(req.user.role)) {
    return res.status(403).json({ error: 'admin_only' });
  }
  try {
    const { computeOrgDashboard } = await import('./ml/outcomeIntelligenceEngine.js');
    const out = await computeOrgDashboard(prisma);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'org_dashboard_failed', message: err && err.message,
    });
  }
});

// GET /api/outcomes/command-center
app.get('/api/outcomes/command-center', authenticate, async (req, res) => {
  try {
    const { computeCommandCenterMetrics } = await import('./ml/outcomeIntelligenceEngine.js');
    const out = await computeCommandCenterMetrics(prisma,
      Number(req.query?.days) || 30);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'command_center_failed', message: err && err.message,
    });
  }
});

// POST /api/outcomes/snapshot — admin: fire daily rollup
app.post('/api/outcomes/snapshot', authenticate, async (req, res) => {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'admin_only' });
  }
  try {
    const { snapshotFarmHealth } = await import('./ml/outcomeIntelligenceEngine.js');
    const out = await snapshotFarmHealth(prisma);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'snapshot_failed', message: err && err.message,
    });
  }
});

// ── Scan Pilot Validation (admin) ─────────────────────────────
// POST /api/admin/scan-validation
//   body: { scanId, imageUrl?, predictedPlant, predictedDisease?,
//            predictedPest?, confidencePct?, consensusMode?,
//            latencyMs?, notes? }
//   Inserts a fresh ScanValidation row (source='scan_lab').
function _requireAdmin(req, res) {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'admin_only' });
    return false;
  }
  return true;
}

app.post('/api/admin/scan-validation', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const b = req.body || {};
    if (!b.scanId) return res.status(400).json({ error: 'scanId_required' });
    const row = await prisma.scanValidation.create({
      data: {
        scanId:           String(b.scanId),
        userId:           req.user?.id || null,
        imageUrl:         b.imageUrl ? String(b.imageUrl) : null,
        predictedPlant:   b.predictedPlant ? String(b.predictedPlant) : null,
        predictedDisease: b.predictedDisease ? String(b.predictedDisease) : null,
        predictedPest:    b.predictedPest ? String(b.predictedPest) : null,
        confidencePct:    Number.isFinite(Number(b.confidencePct))
                            ? Math.round(Number(b.confidencePct)) : null,
        consensusMode:    b.consensusMode ? String(b.consensusMode) : null,
        latencyMs:        Number.isFinite(Number(b.latencyMs))
                            ? Math.round(Number(b.latencyMs)) : null,
        source:           b.source ? String(b.source).slice(0, 32) : 'scan_lab',
        notes:            b.notes ? String(b.notes).slice(0, 1000) : null,
      },
    });
    return res.json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'create_failed',
      message: err && err.message });
  }
});

// PATCH /api/admin/scan-validation/:id — label ground truth
//   body: { actualPlant?, actualDisease?, actualPest?, notes? }
app.patch('/api/admin/scan-validation/:id', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const id = String(req.params.id);
    const b = req.body || {};
    const existing = await prisma.scanValidation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });

    const _matches = (predicted, actual) => {
      const p = String(predicted || '').toLowerCase().trim();
      const a = String(actual || '').toLowerCase().trim();
      if (!p || !a) return null;
      if (p === a) return true;
      if (p.includes(a) || a.includes(p)) return true;
      return false;
    };

    const newActualPlant   = b.actualPlant   != null ? String(b.actualPlant)   : existing.actualPlant;
    const newActualDisease = b.actualDisease != null ? String(b.actualDisease) : existing.actualDisease;
    const newActualPest    = b.actualPest    != null ? String(b.actualPest)    : existing.actualPest;

    // Derive result if any actual is set.
    let result = existing.result;
    if (newActualPlant || newActualDisease || newActualPest) {
      const plantM = _matches(existing.predictedPlant, newActualPlant);
      const diseaseM = _matches(existing.predictedDisease, newActualDisease);
      const pestM = _matches(existing.predictedPest, newActualPest);
      const matches = [plantM, diseaseM, pestM].filter((x) => x !== null);
      const trues   = matches.filter((x) => x === true).length;
      if (matches.length === 0)              result = 'unknown';
      else if (trues === matches.length)     result = 'correct';
      else if (trues === 0)                  result = 'incorrect';
      else                                   result = 'partial';
    }

    const row = await prisma.scanValidation.update({
      where: { id },
      data: {
        actualPlant:   newActualPlant,
        actualDisease: newActualDisease,
        actualPest:    newActualPest,
        labeledBy:     req.user?.id || existing.labeledBy,
        labeledAt:     new Date(),
        notes:         b.notes != null ? String(b.notes).slice(0, 1000) : existing.notes,
        result,
      },
    });
    return res.json({ ok: true, row });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'update_failed',
      message: err && err.message });
  }
});

// GET /api/admin/scan-validation?limit=50
app.get('/api/admin/scan-validation', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const limit = Math.max(1, Math.min(Number(req.query?.limit) || 50, 200));
    const rows = await prisma.scanValidation.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return res.json({ ok: true, rows });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'list_failed',
      message: err && err.message, rows: [] });
  }
});

// POST /api/admin/scan-validation/feedback
//   body: { scanId, feedback ('correct'|'incorrect'|'partial'),
//            correctedPlant?, correctedDisease?, correctedPest? }
app.post('/api/admin/scan-validation/feedback', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const b = req.body || {};
    if (!b.scanId || !['correct', 'incorrect', 'partial'].includes(b.feedback)) {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const row = await prisma.scanFeedback.create({
      data: {
        scanId:           String(b.scanId),
        userId:           req.user?.id || null,
        feedback:         String(b.feedback),
        correctedPlant:   b.correctedPlant ? String(b.correctedPlant) : null,
        correctedDisease: b.correctedDisease ? String(b.correctedDisease) : null,
        correctedPest:    b.correctedPest ? String(b.correctedPest) : null,
        source:           b.source ? String(b.source).slice(0, 32) : 'scan_lab',
      },
    });
    return res.json({ ok: true, id: row.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'feedback_failed',
      message: err && err.message });
  }
});

// GET /api/admin/scan-validation/metrics?days=7
app.get('/api/admin/scan-validation/metrics', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const { computeMetrics } = await import('./ml/scanValidationMetrics.js');
    const days = Number(req.query?.days) || 7;
    const m = await computeMetrics(prisma, { days });
    return res.json(m);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'metrics_failed',
      message: err && err.message });
  }
});

// GET /api/admin/scan-validation/top-failures?days=30&limit=10
app.get('/api/admin/scan-validation/top-failures', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const { computeTopFailures } = await import('./ml/scanValidationMetrics.js');
    const out = await computeTopFailures(prisma, {
      days: Number(req.query?.days) || 30,
      limit: Number(req.query?.limit) || 10,
    });
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'top_failures_failed',
      message: err && err.message });
  }
});

// GET /api/admin/scan-validation/calibration?days=30
app.get('/api/admin/scan-validation/calibration', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const { computeCalibration } = await import('./ml/scanValidationMetrics.js');
    const out = await computeCalibration(prisma, {
      days: Number(req.query?.days) || 30,
    });
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'calibration_failed',
      message: err && err.message });
  }
});

// POST /api/admin/scan-validation/snapshot — fire the daily rollup.
app.post('/api/admin/scan-validation/snapshot', authenticate, async (req, res) => {
  if (!_requireAdmin(req, res)) return;
  try {
    const { snapshotMetrics } = await import('./ml/scanValidationMetrics.js');
    const out = await snapshotMetrics(prisma);
    return res.json(out);
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'snapshot_failed',
      message: err && err.message });
  }
});

// ── Scan follow-up outcome (V3 §7) ────────────────────────────
// POST /api/scan/follow-up
//   body: { scanId, dayOffset (3|7|14), status (improved|same|worse) }
//   updates the corresponding follow-up row on the existing
//   ScanTrainingEvent.weatherSummary.followUps array.
app.post('/api/scan/follow-up', authenticate, async (req, res) => {
  try {
    const { scanId, dayOffset, status } = req.body || {};
    if (!scanId || typeof dayOffset !== 'number'
        || typeof status !== 'string') {
      return res.status(400).json({ error: 'invalid_input' });
    }
    const { recordFollowUpOutcome } =
      await import('./ml/followUpEngine.js');
    const out = await recordFollowUpOutcome(prisma, {
      scanId, dayOffset, status,
    });
    if (!out.ok) {
      return res.status(out.reason === 'scan_not_found' ? 404 : 400)
        .json({ ok: false, reason: out.reason });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'follow_up_failed', message: err && err.message,
    });
  }
});

// GET /api/scan/follow-up/history — recent follow-up rows for the
// signed-in user. Drives the V3 Recent Follow-ups card.
app.get('/api/scan/follow-up/history', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const limit = Math.max(1, Math.min(Number(req.query && req.query.limit) || 20, 100));
    const { readFollowUpHistory } =
      await import('./ml/followUpEngine.js');
    const items = await readFollowUpHistory(prisma, userId, limit);
    return res.json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({
      ok: false, error: 'follow_up_history_failed',
      message: err && err.message, items: [],
    });
  }
});

// ── Scan history (V2 §4) ──────────────────────────────────────
// GET /api/scan/history — returns the signed-in user's recent
// scans (server-side; auto-persisted by the analyze route).
//   Query: ?limit=20 (max 50)
//   Returns: { scans: [{ scanId, plantName, predictedIssue,
//                        confidence, confidencePct, imageUrl,
//                        createdAt }] }
app.get('/api/scan/history', authenticate, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'unauthorized' });
    const rawLimit = Number(req.query && req.query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.max(1, Math.min(rawLimit, 50)) : 20;
    const rows = await prisma.scanTrainingEvent.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select: {
        scanId: true, imageUrl: true,
        cropName: true, plantName: true,
        predictedIssue: true, confidence: true,
        weatherSummary: true,
        userFeedback: true,
        createdAt: true,
      },
    });
    const scans = rows.map((r) => {
      const ws = r.weatherSummary && typeof r.weatherSummary === 'object' ? r.weatherSummary : {};
      const confidencePct = (ws && typeof ws.confidencePct === 'number')
        ? ws.confidencePct
        : (r.confidence === 'high' ? 85
          : r.confidence === 'medium' ? 55 : 25);
      return {
        scanId:         r.scanId,
        plantName:      r.plantName || r.cropName || '',
        predictedIssue: r.predictedIssue || '',
        confidence:     r.confidence || 'low',
        confidencePct,
        imageUrl:       r.imageUrl || null,
        userConfirmed:  r.userFeedback === 'helpful',
        createdAt:      r.createdAt
                          ? new Date(r.createdAt).toISOString() : null,
      };
    });
    return res.json({ ok: true, scans });
  } catch (err) {
    return res.status(500).json({
      error: 'scan_history_failed',
      message: err && err.message,
      scans: [],
    });
  }
});

app.post('/api/scan/feedback', authenticate, scanUserLimiter, async (req, res) => {
  try {
    const {
      scanId, userFeedback, correctedIssue,
      verificationAnswer,        // { questionId, answer } — checklist tap
      verificationSummary,       // { matched, mismatched, confirmed, downgrade } — after checklist completes
      outcome,                   // 'recovered' | 'spread' | 'lost' | 'unknown'
      outcomeNote,
      // Scan Intelligence V2 §5 — learning loop. When `correct` is
      // a boolean, the route routes through the learning engine
      // (which updates ranking signals + stores the corrected
      // plant for future boost/demote).
      correct,
      correctedPlant,
    } = req.body || {};

    // V2 §5 — learning-loop write-through. Runs BEFORE the legacy
    // partial-update so the learning engine sees a consistent row.
    if (typeof correct === 'boolean' && scanId) {
      try {
        const { recordConfirmation } =
          await import('./ml/scanLearningEngine.js');
        await recordConfirmation(prisma, {
          scanId,
          userId:         req.user?.id || null,
          correct,
          correctedPlant: correctedPlant || correctedIssue || null,
        });
      } catch { /* swallow — handled inside */ }
      // Short-circuit when caller used the V2 correct/wrong shape
      // (legacy verification answer / outcome paths still fall
      // through below when their fields are present).
      if (!userFeedback && !verificationAnswer
          && !verificationSummary && !outcome) {
        return res.json({ ok: true, learning: 'recorded' });
      }
    }

    if (!scanId) {
      return res.status(400).json({ error: 'missing_required_fields' });
    }
    // Allowed feedback values (§9 + §6 verification + outcome).
    const allowedFb       = new Set(['helpful', 'not_helpful', 'not_sure', 'verification']);
    const allowedOutcome  = new Set(['recovered', 'spread', 'lost', 'unknown']);
    if (userFeedback && !allowedFb.has(String(userFeedback))) {
      return res.status(400).json({ error: 'invalid_feedback' });
    }
    if (outcome && !allowedOutcome.has(String(outcome))) {
      return res.status(400).json({ error: 'invalid_outcome' });
    }

    try {
      const row = await prisma.scanTrainingEvent.findFirst({
        where:   { scanId, userId: req.user?.id || null },
        orderBy: { createdAt: 'desc' },
      });
      if (row) {
        // Build a partial update — only fields the caller sent.
        const data = {};
        if (userFeedback && userFeedback !== 'verification') {
          data.userFeedback = String(userFeedback);
        }
        if (correctedIssue) {
          data.correctedIssue = String(correctedIssue).slice(0, 200);
        }
        if (verificationAnswer && verificationAnswer.questionId) {
          // Merge answer into existing JSON map.
          const prev = row.verificationAnswers && typeof row.verificationAnswers === 'object'
            ? row.verificationAnswers : {};
          data.verificationAnswers = {
            ...prev,
            [String(verificationAnswer.questionId)]: String(verificationAnswer.answer || '')
              .toLowerCase() === 'yes' ? 'yes' : 'no',
          };
        }
        if (verificationSummary && typeof verificationSummary === 'object') {
          data.verificationDowngrade = !!verificationSummary.downgrade;
        }
        if (outcome) {
          data.outcome = String(outcome);
          if (outcomeNote) data.outcomeNote = String(outcomeNote).slice(0, 400);
        }
        if (Object.keys(data).length > 0) {
          await prisma.scanTrainingEvent.update({
            where: { id: row.id },
            data,
          });
        }
      }
    } catch { /* swallow — best-effort */ }
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

    // Advanced ML scan layer — preprocessing + provider status.
    // Detects whether `sharp` is installed (full image preprocess
    // available) and which provider profile is currently
    // selected. Reports them in the admin health response so a
    // dashboard can flag misconfiguration.
    let imagePreprocessing = 'minimal';
    try {
      const sharpMod = await import('sharp').catch(() => null);
      if (sharpMod && sharpMod.default) imagePreprocessing = 'full';
    } catch { /* swallow */ }

    let scanProviderStatus = { available: [], selected: null, apiKeySet: false };
    try {
      const m = await import('./ml/scanProviders.js');
      if (m.describeProviders) scanProviderStatus = m.describeProviders();
    } catch { /* swallow */ }

    let scanTrainingCount = null;
    try { scanTrainingCount = await prisma.scanTrainingEvent.count(); }
    catch { /* table may not exist on a non-migrated dev db */ }

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
        scanTrainingEvents: scanTrainingCount,
      },
      ml: {
        imagePreprocessing,                   // 'full' | 'minimal'
        provider:  scanProviderStatus,
      },
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

// ─── Ops: prune scan_training_events (admin-only) ───────────
// Manual trigger for the retention sweep. Use ?dryRun=1 to
// preview without deleting. The sweep also runs on the existing
// daily cron.
app.post('/api/ops/scan-training/prune', authenticate, async (req, res) => {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    const { pruneScanTrainingEvents } = await import('./ml/pruneScanTrainingEvents.js');
    const dryRun = String(req.query?.dryRun || '').trim() === '1';
    const maxKeep = Number(req.query?.maxKeep) || undefined;
    const summary = await pruneScanTrainingEvents({ dryRun, maxKeep });
    res.json({ ok: true, summary });
  } catch (err) {
    res.status(500).json({ error: 'prune_failed', message: err && err.message });
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
// Spec-canonical alias for the admin surface. Same router,
// same middleware (`router.use(authenticate)` +
// `authorize('super_admin', ...)` per route). Mounted as
// /api/admin so the merged-blocker spec's tests
// (GET /api/admin/users, etc.) hit the existing guards.
app.use('/api/admin', adminUserRoutes);

// ─── Ingest + NGO aggregates (data foundation v2) ───────
// /api/ingest accepts batched client events idempotently.
// /api/ngo/* serves the NGO dashboard summary / regions /
// clusters from the same store. Both auth-gated inside their
// own route modules; mounted at the root /api so the spec's
// path (/ingest, /ngo/summary, /ngo/regions, /ngo/clusters)
// matches verbatim.
app.use('/api/ingest', ingestRoutes);
app.use('/api/ngo',    ngoRoutes);
// Soft-launch monitoring pipeline. Mounted at /api so the
// child routes resolve as /api/events, /api/errors,
// /api/admin/metrics — matching the spec's exact paths.
app.use('/api',        softLaunchEventsRoutes);
// AI Task Engine v1 — child routes resolve as /api/tasks/today.
app.use('/api/tasks',  aiTaskRoutes);
// Calm-UI service aliases. Mounted at /api so child paths
// resolve as /api/weather/today, /api/actions/today,
// /api/actions/complete, /api/tasks/from-scan.
app.use('/api',        serviceAliasesRoutes);

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
//
// Satellite intelligence (May 2026) — proxies Sentinel Hub NDVI
// requests through the server so the OAuth secret never leaves
// the backend. Mounted under `authenticate` because each call
// consumes paid Sentinel Hub quota; anonymous access would let
// any visitor drain it. Frontend consumer:
//   src/hooks/useFarmHealth.js → src/components/home/LandHealthCard.jsx
app.use('/api/v2/satellite', authenticate, satelliteRoutes);

app.use('/api/farmers', farmersRoutes);
// Wave-27 — Partner-import honest 503 stub. Mounted under /api/v2/farmers
// so AdminImportFarmersPage.jsx (which posts to /api/v2/farmers/partner-import)
// receives the documented PENDING_REASON instead of a generic 404.
app.use('/api/v2/farmers', partnerImportRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/fraud', fraudRoutes);
// Decision Engine v2 — must mount BEFORE the legacy decisionRoutes
// because the v2 router declares concrete /today + /complete paths
// while the legacy router uses /:applicationId positional params
// that would otherwise swallow the v2 path matches.
app.use('/api/decision',  decisionV2Routers.decisionRouter);
app.use('/api/soil',      decisionV2Routers.soilRouter);
app.use('/api/satellite', decisionV2Routers.satelliteRouter);
app.use('/api/region',    decisionV2Routers.regionRouter);
app.use('/api/decision', decisionRoutes);
app.use('/api/benchmark', benchmarkRoutes);
app.use('/api/intelligence', intelligenceRoutes);
// Phase 14 — Data Flywheel Intelligence API
app.use('/api/flywheel', flywheelRoutes);
// Enterprise Agriculture Platform
app.use('/api/enterprise', enterpriseRoutes);
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
// ─── Global Insights Layer (Data Moat §1) ────────────────────
// Privacy-safe aggregated counts. POST /batch upserts client
// deltas; GET / returns scored insights for the dailyPlanEngine
// reorder hook. NO per-user data flows through this module.
app.use('/api/insights', insightsRoutes);

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
// Wave-39 — admin routes FIRST so /api/invites/status/:farmerId
// resolves before the public router's /:token wildcard matches.
app.use('/api/invites', inviteAdminRoutes);
app.use('/api/invites', inviteRoutes); // public invite acceptance (rate-limited internally)
app.use('/api/trust', trustRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/community', communityRoutes);
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
// Pilot Weather → Task pipeline (May 2026 spec): clean public
// route at /api/weather. No auth, never returns 4xx/5xx for the
// frontend, normalised shape consumed by useWeatherSafe.
app.use('/api/weather', publicWeatherRoute);
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
// Phase 6 restore — basic admin dashboard endpoints.
app.use('/api/v2/admin', v2AdminBasicRoutes);
// Phase 7A restore — pricing suggestion (public aggregate, no auth).
app.use('/api/v2/pricing', v2PricingSuggestRoutes);
// Phase 7B restore — trust score (public aggregate, no auth).
app.use('/api/v2/trust', v2TrustScoreRoutes);
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
  // Hashed bundles (assets/index-*.js, assets/vendor-*.js, etc.) are
  // safe to long-cache because their filenames change on every
  // deploy. The HTML entry point is NOT — it must always be re-
  // fetched so users pick up the new hashed-bundle references on
  // each deploy. Without this, browsers happily reuse a months-old
  // index.html that points at a missing/old bundle and the user
  // ends up running an outdated UI version (the v4-vs-v6 bundle
  // ping-pong loop chrome surfaces as "Throttling navigation").
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      const lower = String(filePath || '').toLowerCase();
      if (lower.endsWith('.html')) {
        res.setHeader('Cache-Control',
          'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else if (lower.includes(`${path.sep}assets${path.sep}`)
              || lower.includes('/assets/')) {
        // Vite's hashed assets are immutable.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // ─── Realism asset compatibility layer (May 2026) ─────────
  // Three safety nets that bracket every cached/stale request for
  // a realism image. All fire BEFORE the SPA catch-all (which would
  // return a real 404).
  //
  // 0. JPEG → WebP fallback (this audit): for the three canonical
  //    fallback paths the production audit named, when only the
  //    .webp variant exists on disk (e.g. the .jpeg got deleted in
  //    a future cleanup), 301-redirect the .jpeg request to the
  //    .webp file. Both extensions ship side-by-side today, so the
  //    middleware no-ops when the .jpeg is present. Acts as a
  //    permanent stale-asset compatibility shim.
  //
  // 1. Legacy-path mapper: 21 realism files were renamed from
  //    `.webp.jpeg` / `.webp.png` to single-extension `.jpeg` /
  //    `.png` in commit 8277714f. Old cached bundles still ship
  //    URLs with the old names. This middleware rewrites the URL
  //    to the new name and serves the renamed file — old bundles
  //    render correctly without any browser cache eviction.
  //
  // 2. Realism fallback: any /assets/realism/* image request that
  //    survives the static handler AND both mappers above falls
  //    back to the canonical hero (africa-farm-atmosphere.jpeg).
  //    The user gets an image (just not the right one), the
  //    console doesn't 404, and the UI never shows a broken box.
  //    Short cache (1 h) so the fallback doesn't stick once the
  //    real file is back on disk.
  const _JPEG_TO_WEBP_FALLBACK = Object.freeze({
    '/assets/realism/heroes/africa-farm-atmosphere.jpeg':
      '/assets/realism/heroes/africa-farm-atmosphere.webp',
    '/assets/realism/journal/farm-inspection.jpeg':
      '/assets/realism/journal/farm-inspection.webp',
    '/assets/realism/farm/pepper-closeup.jpeg':
      '/assets/realism/farm/pepper-closeup.webp',
    // Added after the May 2026 production console showed 404s
    // for these two paths specifically. Same conditional-redirect
    // semantics: serve .jpeg directly when present, fall back to
    // .webp only when the .jpeg is missing.
    '/assets/realism/journal/greenhouse-work.jpeg':
      '/assets/realism/journal/greenhouse-work.webp',
    '/assets/realism/scan/healthy-leaf.jpeg':
      '/assets/realism/scan/healthy-leaf.webp',
  });
  app.use((req, res, next) => {
    const target = _JPEG_TO_WEBP_FALLBACK[req.path];
    if (!target) return next();
    // If the requested .jpeg exists on disk, let the static handler
    // serve it directly — no redirect needed. The redirect is the
    // FALLBACK for the cleanup scenario where the .jpeg got
    // deleted.
    const jpegOnDisk = path.join(clientDist, req.path);
    if (fs.existsSync(jpegOnDisk)) return next();
    const webpOnDisk = path.join(clientDist, target);
    if (!fs.existsSync(webpOnDisk)) return next();
    return res.redirect(301, target);
  });

  app.use('/assets/realism', (req, res, next) => {
    if (!/\.webp\.(jpe?g|png)$/i.test(req.path)) return next();
    const remapped = req.path.replace(/\.webp\.(jpe?g|png)$/i, '.$1');
    const realPath = path.join(clientDist, 'assets/realism' + remapped);
    if (fs.existsSync(realPath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(realPath);
    }
    return next();
  });
  app.use('/assets/realism', (req, res, next) => {
    // Only intercept image extensions; other realism resources
    // (json metadata, video, etc.) fall through to the catch-all.
    if (!/\.(jpe?g|png|webp|gif|svg)$/i.test(req.path)) return next();
    const requested = path.join(clientDist, 'assets/realism' + req.path);
    if (fs.existsSync(requested)) return next(); // static will serve below — defensive only
    const fallbackAbs = path.join(clientDist, 'assets/realism/heroes/africa-farm-atmosphere.jpeg');
    if (fs.existsSync(fallbackAbs)) {
      // Short cache — a broken-state response shouldn't pin into
      // browser caches once the real file is restored.
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(fallbackAbs);
    }
    return next();
  });

  // SPA fallback: serve index.html for non-API routes (React Router handles
  // client-side routing). Same no-cache headers — this path serves
  // the SAME index.html as the static handler when the URL doesn't
  // match a file on disk.
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
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export default app;
