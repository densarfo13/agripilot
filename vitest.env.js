/**
 * vitest.env.js — defensive env-stamping module.
 *
 * Imported synchronously at the top of pollution-sensitive test
 * files (auth, permissions, userOffboardingAuth, security.mfa).
 * Ensures DATABASE_URL / token secrets / service URLs are present
 * BEFORE the test file's module graph imports server modules that
 * call `required()` from server/lib/env.js.
 *
 * Why this exists in addition to vitest.setup.js:
 *   • setupFiles runs once per worker; vi.resetModules() in another
 *     test file can wipe the module cache and trigger re-imports.
 *   • If a test deletes/mutates process.env between imports, env.js
 *     re-runs `required(...)` against a partially-cleared env.
 *   • Re-stamping at top-of-file is cheap (idempotent ||) and
 *     guarantees the values exist at the moment they're read.
 *
 * Strict-rule audit
 *   • Pure side-effect import — no exports beyond a sentinel.
 *   • Idempotent: only stamps when value is unset/empty (||).
 *   • Never throws.
 *   • Runs at module load — guarantees env is set before any
 *     subsequent import in the same module graph.
 */

function _stamp(name, fallback) {
  try {
    if (typeof process !== 'undefined' && process.env) {
      if (!process.env[name] || String(process.env[name]).trim() === '') {
        process.env[name] = fallback;
      }
    }
  } catch { /* swallow */ }
}

// Database — env.js requires this at module load.
_stamp('DATABASE_URL',          'postgres://test:test@localhost:5432/test');

// JWT / token secrets.
_stamp('ACCESS_TOKEN_SECRET',   'test-access-secret');
_stamp('REFRESH_TOKEN_SECRET',  'test-refresh-secret');
_stamp('JWT_SECRET',            'test-jwt-secret');
_stamp('SESSION_SECRET',        'test-session-secret');
_stamp('ENCRYPTION_KEY',        'test-encryption-key-must-be-32b!');

// Service URLs.
_stamp('APP_BASE_URL',          'http://localhost:5173');
_stamp('API_BASE_URL',          'http://localhost:5000');
_stamp('EMAIL_FROM',            'test@farroway.local');

// Test mode markers — let test code branch when needed.
_stamp('NODE_ENV',              'test');
_stamp('TEST_MODE',             '1');

// Sentinel export — lets the importer see a defined value so
// dead-code elimination doesn't tree-shake the side-effect.
export const __FARROWAY_TEST_ENV_STAMPED = true;
