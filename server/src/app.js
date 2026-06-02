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
app.post('/api/scan/analyze', authenticate, scanUserLimiter, async (req, res) => {
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
    const { fetchFieldHealth } = await import('./ml/providers/fieldHealthProvider.js');
    // Final 3-point gap closure — server-side SoilGrids (public,
    // key-less). Composes the new soilProvider; cached in Redis
    // 7 days. Honest ok:false envelope on timeout or invalid coords.
    const { fetchSoilProfile } = await import('./ml/providers/soilProvider.js');

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

    const [consensus, pest, fieldHealth, soil] = await Promise.all([
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

    const scanRecovery = buildScanRecoveryEnvelope({
      consensus:    _boostedConsensus,
      safe,
      fused,
      pest,
      fieldHealth,
      soil,
      cropNameHint: cropName || plantName,
    });

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

    return res.json({
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
    });
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
