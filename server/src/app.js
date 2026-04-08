import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import weatherRoutes from './modules/weather/routes.js';
import financeScoreRoutes from './modules/financeScore/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─── Trust Proxy (required for rate limiting behind Render/Docker proxy) ──
if (config.isProduction) {
  app.set('trust proxy', 1);
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
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

// ─── Body Parsing ──────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── Request ID & Structured Logging ──────────────────
app.use(requestId);
app.use(requestLogger);

// ─── Rate Limiters ─────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Uses default keyGenerator (request IP via express trust proxy)
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply API-wide rate limiter to all /api routes
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
app.use('/api/mfa', mfaRoutes);
app.use('/api/auto-notifications', autoNotificationRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/v1/farms', farmProfileRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1', weatherRoutes); // mounts /farms/:farmId/weather and /insights/recommend under /api/v1
app.use('/api/v1/farms', financeScoreRoutes);

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
