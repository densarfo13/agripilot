import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// ─── Production environment validation ─────────────────
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  const required = ['JWT_SECRET', 'DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Missing required env vars in production: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('[FATAL] JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

// In development, warn if using fallback secret
if (!isProduction && !process.env.JWT_SECRET) {
  console.warn('[WARN] JWT_SECRET not set — using dev-only fallback. Do NOT use in production.');
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  jwt: {
    // No fallback in production (validated above); dev-only fallback for local use
    secret: process.env.JWT_SECRET || (isProduction ? undefined : 'dev-only-fallback-not-for-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  cors: {
    // Comma-separated origins, or empty for dev permissive mode
    origins: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  },
};
