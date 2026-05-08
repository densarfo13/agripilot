/**
 * vitest.setup.js — runs once before any test module loads.
 *
 * Provides fallback environment variables for tests that import
 * server modules (which call `required()` from server/lib/env.js
 * at module-load time and crash without these vars).
 *
 * Tests that exercise the real DB path (security.mfa token
 * revocation, etc.) gate themselves behind a `describe.skipIf`
 * check on the original env var; this setup only ensures the
 * MODULE LOAD itself doesn't fail before the gate can fire.
 *
 * Real CI / dev environments with a populated .env override
 * these (the `||` short-circuit only fires when the var is
 * unset or empty).
 */

// Database connection string — only the format matters for env
// validation; tests that actually touch the DB are gated and
// skipped when this is the dummy value.
process.env.DATABASE_URL = process.env.DATABASE_URL
  || 'postgres://test:test@localhost:5432/test';

// JWT / token secrets — env.js requires them for auth.js to load.
process.env.ACCESS_TOKEN_SECRET  = process.env.ACCESS_TOKEN_SECRET  || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.JWT_SECRET           = process.env.JWT_SECRET           || 'test-jwt-secret';

// Service URLs — required by env.js, used as bases for email
// links etc. Dummy values are fine for unit tests.
process.env.APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';
process.env.API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Email sender (env.js validates EMAIL_FROM).
process.env.EMAIL_FROM = process.env.EMAIL_FROM || 'test@farroway.local';
