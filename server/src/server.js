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
import { validateEmailConfig } from '../lib/mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
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

  // One-shot email provider check at boot so missing SENDGRID_API_KEY
  // / EMAIL_FROM / APP_BASE_URL shows up in the deploy log instead of
  // silently degrading password-reset delivery at 2am.
  try { validateEmailConfig(); } catch (e) { console.warn('[SERVER] email config check failed:', e?.message); }

  const host = '0.0.0.0';
  const server = app.listen(config.port, host, () => {
    console.log(`[SERVER] Farroway running on http://${host}:${config.port}`);
    console.log(`[SERVER] Environment: ${config.nodeEnv}`);
    if (config.isProduction && config.cors.origins.length > 0) {
      console.log(`[SERVER] CORS origins: ${config.cors.origins.join(', ')}`);
    }
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
