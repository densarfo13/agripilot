import app from './app.js';
import { config } from './config/index.js';
import prisma from './config/database.js';

async function main() {
  // Verify database connection
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`[SERVER] AgriPilot MVP running on http://localhost:${config.port}`);
    console.log(`[SERVER] Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
