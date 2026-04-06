import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';
import { config } from './config/index.js';
import prisma from './config/database.js';

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

  const host = '0.0.0.0';
  const server = app.listen(config.port, host, () => {
    console.log(`[SERVER] AgriPilot running on http://${host}:${config.port}`);
    console.log(`[SERVER] Environment: ${config.nodeEnv}`);
    if (config.isProduction && config.cors.origins.length > 0) {
      console.log(`[SERVER] CORS origins: ${config.cors.origins.join(', ')}`);
    }
  });

  // Graceful shutdown handler
  const shutdown = async (signal) => {
    console.log(`\n[SERVER] ${signal} received. Shutting down gracefully...`);
    server.close(async () => {
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
