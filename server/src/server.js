import dotenv from "dotenv";
dotenv.config();

import "../config/redis.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';
import { config } from './config/index.js';
import prisma from './config/database.js';
import { startNotificationCron, stopNotificationCron } from './modules/autoNotifications/cron.js';
import {
  startAutonomousActionCron, stopAutonomousActionCron,
} from './modules/autonomousActions/cronRunner.js';
import {
  startFarmProcessingCron, stopFarmProcessingCron,
} from './queue/farmProcessingCron.js';
import {
  startWeeklyReportCron, stopWeeklyReportCron,
} from './modules/ngoReports/weeklyReportCron.js';
import {
  loadThresholdsFromDb,
  startWorker,
  stopAllWorkers,
  expireStaleAlerts,
  pruneJobs,
} from '../intelligence/dist/index.js';
import { validateEmailConfig } from '../services/emailService.js';
import { validateSmsConfig }   from '../services/smsService.js';
import { logProductionStartupBanner } from './config/productionRuntime.js';
// Sentry init — pure no-op when SENTRY_DSN isn't set. Called as
// the first line of main() so server-side captureException paths
// have an active SDK before any request handler runs.
import { initSentry as _initSentry } from './lib/sentry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Sentry first — so any later setup error flows through it.
  // No-op when SENTRY_DSN isn't set; the productionRuntime
  // banner already reports the "disabled safely" state below.
  try { _initSentry(); } catch { /* never block boot */ }

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, '..', config.upload.dir);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`[SERVER] Created uploads directory: ${uploadsDir}`);
  }

  // Verify database connection
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }

  // One-time admin password reset (remove RESET_ADMIN_PW env var after use)
  if (process.env.RESET_ADMIN_PW) {
    try {
      const { default: bcrypt } = await import('bcryptjs');
      const hash = await bcrypt.hash(process.env.RESET_ADMIN_PW, 10);
      const updated = await prisma.user.update({
        where: { email: 'admin@farroway.com' },
        data: { passwordHash: hash },
        select: { id: true, email: true, role: true },
      });
      console.log('[RESET] Admin password reset for:', updated.email);
    } catch (err) {
      console.error('[RESET] Admin password reset failed:', err.message);
    }
  }

  // Start automated notification cron (skip in test environment)
  if (config.nodeEnv !== 'test') {
    startNotificationCron();
    // Autonomous action loop — decision → SMS/email → action log.
    // Schedule overridable via AUTONOMOUS_ACTION_CRON (default 07:00 UTC).
    // Dry-run mode via AUTONOMOUS_ACTION_DRY_RUN=1 for shadow validation.
    startAutonomousActionCron();
    // Farm processing sweep — batches farms onto the risk_scoring
    // queue for workers. Degrades to inline execution when no
    // processor + Redis are wired yet; the API layer never blocks.
    startFarmProcessingCron();
    // Weekly NGO report — Monday 08:00 UTC by default. Gated by
    // SendGrid config (skipped at send time with a `skipped`
    // outcome if email is off).
    startWeeklyReportCron();
  }

  // ── Intelligence module startup ──
  // Load configurable scoring thresholds from DB (falls back to defaults)
  await loadThresholdsFromDb();

  if (config.nodeEnv !== 'test') {
    // Start background job workers for async intelligence processing
    startWorker('satellite_ingest', async (payload) => {
      const { ingestSatelliteScan } = await import('../intelligence/dist/services/satellite.service.js');
      await ingestSatelliteScan(payload);
    });
    startWorker('score_farm', async (payload) => {
      const { computeComponentScores } = await import('../intelligence/dist/services/components.service.js');
      const { computeFarmPestRisk } = await import('../intelligence/dist/services/scoring.service.js');
      const components = await computeComponentScores(payload.profileId);
      await computeFarmPestRisk(components);
    });
    startWorker('send_alert', async (payload) => {
      // Alert delivery hook — log for now, replace with push/SMS when ready
      console.log(`[alert-worker] Delivering alert ${payload.alertId} to ${payload.targetId}`);
    });

    // Expire stale alerts every 15 minutes
    setInterval(() => expireStaleAlerts().catch(console.error), 15 * 60 * 1000);

    // Prune completed/failed jobs older than 7 days, once per hour
    setInterval(() => pruneJobs(7).catch(console.error), 60 * 60 * 1000);
  }

  // One-shot provider checks at boot so missing config shows up in
  // the deploy log instead of silently degrading user-facing flows
  // (password reset, invite email, invite SMS, SMS-based recovery).
  // Both validators never throw — each is wrapped defensively so a
  // bad config never blocks unrelated server startup.
  try { validateEmailConfig(); } catch (e) { console.warn('[SERVER] email config check failed:', e?.message); }
  try { validateSmsConfig();   } catch (e) { console.warn('[SERVER] sms config check failed:',   e?.message); }

  const host = '0.0.0.0';
  const server = app.listen(config.port, host, () => {
    console.log(`[SERVER] Farroway running on http://${host}:${config.port}`);
    console.log(`[SERVER] Environment: ${config.nodeEnv}`);
    if (config.isProduction && config.cors.origins.length > 0) {
      console.log(`[SERVER] CORS origins: ${config.cors.origins.join(', ')}`);
    }
    // Railway production banner — single greppable block. Silent
    // under NODE_ENV=test; idempotent on HMR / reconnect.
    try { logProductionStartupBanner(); }
    catch { /* never throw from a banner */ }

    // Next-Stage Readiness §18 — single greppable build marker.
    // Pulls Railway / Render / Source-commit env vars in priority
    // order; falls back to the boot timestamp when no commit
    // hash is available (local boots, custom hosting).
    try {
      const sha = (process.env.RAILWAY_GIT_COMMIT_SHA
                || process.env.RENDER_GIT_COMMIT
                || process.env.SOURCE_COMMIT
                || process.env.FARROWAY_COMMIT_SHA
                || '').slice(0, 12);
      const stamp = sha ? sha : new Date().toISOString();
      console.log(`[Farroway] Next-stage readiness build active: ${stamp}`);
      // Master Readiness §18 — paired marker for the master pass.
      // Both lines fire so log dashboards keyed to either tag
      // pick up the boot; the SHA is identical so dedup is
      // trivial. Keep both until log infra is consolidated.
      console.log(`[Farroway] Master readiness build active: ${stamp}`);
    } catch { /* never throw from a marker */ }

    // ─── Dist/Static-serve audit log (May 2026) ──────────────────
    // Spec-mandated single-line markers so the operator can confirm
    // at a glance which dist folder production is serving and when
    // the bundle was last produced. Pairs with the front-end
    // [Farroway Frontend Build] log so a stale-deploy mismatch shows
    // up in seconds (front-end version older than back-end stamp).
    try {
      const distAbs = path.resolve(__dirname, '../../dist');
      const distExists = fs.existsSync(distAbs);
      console.log(`[Farroway Static Serve] Serving frontend from: ${distAbs}${distExists ? '' : ' (MISSING)'}`);
      // Build timestamp — prefer the mtime of dist/index.html (the
      // SPA entry point Vite rewrites on every build). Falls back to
      // the boot timestamp on dev / missing-dist boots so the line
      // always renders SOMETHING greppable.
      let buildIso = new Date().toISOString();
      try {
        if (distExists) {
          const indexPath = path.join(distAbs, 'index.html');
          if (fs.existsSync(indexPath)) {
            buildIso = fs.statSync(indexPath).mtime.toISOString();
          }
        }
      } catch { /* keep boot timestamp */ }
      console.log(`[Farroway Build Timestamp] ${buildIso}`);
    } catch { /* never throw from a marker */ }
  });

  // Graceful shutdown handler
  const shutdown = async (signal) => {
    console.log(`\n[SERVER] ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
      stopNotificationCron();
      stopAllWorkers();
      await prisma.$disconnect();
      console.log('[SERVER] Shut down complete.');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('[SERVER] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

// Handle uncaught errors
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});
