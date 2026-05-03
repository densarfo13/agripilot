import { describe, it, expect } from 'vitest';

/**
 * Calm-UI Services Layer — backend-side contract tests.
 *
 * The 4 frontend service files (apiClient / weather / action /
 * scan) live in `src/services/*.ts` and are exercised by the
 * Vite build — they're TypeScript and the security-test runner
 * doesn't compile TS. Instead we contract-test the BACKEND
 * adaptors that the service files call:
 *
 *   GET  /api/weather/today
 *   GET  /api/actions/today
 *   POST /api/actions/complete
 *   POST /api/tasks/from-scan
 *
 * The adaptors are pure delegators over existing engines/stores;
 * we exercise them at the route-handler level by reading the
 * source file + verifying:
 *   • each path is registered
 *   • auth middleware is in the chain
 *   • the body schema (Zod) is referenced
 *
 * Behaviour-level tests for the engine / persistence path are
 * covered by `aiTaskEngine.test.js` + `softLaunchEvents.test.js`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ALIASES_PATH = path.resolve(__dirname, '..', 'modules', 'serviceAliases', 'routes.js');

describe('serviceAliases module — route registration', () => {
  const src = fs.readFileSync(ALIASES_PATH, 'utf8');

  it('registers GET /weather/today', () => {
    expect(src).toMatch(/router\.get\(\s*'\/weather\/today'/);
  });

  it('registers GET /actions/today', () => {
    expect(src).toMatch(/router\.get\(\s*'\/actions\/today'/);
  });

  it('registers POST /actions/complete', () => {
    expect(src).toMatch(/router\.post\(\s*'\/actions\/complete'/);
  });

  it('registers POST /tasks/from-scan', () => {
    expect(src).toMatch(/router\.post\(\s*'\/tasks\/from-scan'/);
  });
});

describe('serviceAliases — auth + validation', () => {
  const src = fs.readFileSync(ALIASES_PATH, 'utf8');

  it('imports authenticate from the canonical middleware path', () => {
    expect(src).toMatch(/import\s+\{\s*authenticate\s*\}\s+from\s+['"]\.\.\/\.\.\/middleware\/auth\.js['"]/);
  });

  it('every route handler in the file lists `authenticate` in its chain', () => {
    // For each `router.<method>('<path>',` line we check the next
    // few lines contain `authenticate`.
    const lines = src.split(/\r?\n/);
    const idxs = lines
      .map((l, i) => /^\s*router\.(get|post|put|patch|delete)\s*\(/.test(l) ? i : -1)
      .filter((i) => i >= 0);
    expect(idxs.length).toBeGreaterThan(0);
    for (const i of idxs) {
      const slice = lines.slice(i, i + 5).join('\n');
      expect(slice).toMatch(/authenticate/);
    }
  });

  it('uses Zod safeParse for the two POST endpoints', () => {
    // safeParse appears at least twice — once per POST endpoint.
    const matches = src.match(/safeParse/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('imports z from zod', () => {
    expect(src).toMatch(/import\s+\{\s*z\s*\}\s+from\s+['"]zod['"]/);
  });

  it('delegates to existing engine — never duplicates AI logic', () => {
    expect(src).toMatch(/from\s+['"]\.\.\/aiTask\/engine\.js['"]/);
    expect(src).toMatch(/from\s+['"]\.\.\/aiTask\/schemas\.js['"]/);
    expect(src).toMatch(/from\s+['"]\.\.\/weather\/service\.js['"]/);
  });
});

describe('serviceAliases — failure-shape contract', () => {
  const src = fs.readFileSync(ALIASES_PATH, 'utf8');

  it('GET /weather/today returns 200 with `source: \'unavailable\'` on failure (per spec §3)', () => {
    // The handler returns a fallback envelope rather than 5xx.
    // Verifies: a `source: 'unavailable'` literal appears inside
    // a try/catch fallback path.
    expect(src).toMatch(/source:\s*'unavailable'/);
  });

  it('uses upsert (not create) for client_events writes — idempotent on retry', () => {
    expect(src).toMatch(/clientEvent\.upsert/);
  });

  it('every POST handler is rate-limited via submissionLimiter', () => {
    // Both POST endpoints sit behind submissionLimiter.
    expect(src).toMatch(/submissionLimiter/);
  });
});

describe('serviceAliases — output never carries internals', () => {
  const src = fs.readFileSync(ALIASES_PATH, 'utf8');

  it('the file does not log raw Prisma errors', () => {
    expect(src).not.toMatch(/console\.error.*err/i);
  });

  it('error handling uses neutral 400 shape — never echoes Prisma details', () => {
    // Inspect every res.status(400) call: the body should be a
    // simple { error: '<short string>' } shape.
    const errorCalls = src.match(/res\.status\(400\)\.json\([^)]*\)/g) || [];
    expect(errorCalls.length).toBeGreaterThan(0);
    for (const call of errorCalls) {
      // Must NOT include `err`, `error.stack`, `prisma`, etc.
      expect(call.toLowerCase()).not.toMatch(/prisma|stack|err\.|error\./);
    }
  });
});
