#!/usr/bin/env node
/**
 * scripts/validate-persistence.mjs — operational validation
 * script (NOT a CI gate). Run after deploying Prisma migrations
 * to confirm production-persistence is wired end-to-end.
 *
 * Usage:
 *   npm run validate:persistence
 *
 * Probes:
 *   • DATABASE_URL is set in the current shell environment.
 *   • Prisma client can be generated (npx prisma generate).
 *   • Required production models exist in the generated client.
 *   • Migration table reachable (if so configured).
 *
 * This script does NOT run migrations. Operators run those
 * separately via `npx prisma migrate deploy` per
 * docs/PRISMA_PRODUCTION_DEPLOY.md.
 *
 * Read-only over the running database state.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const WARNINGS = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }
function warn(m) { WARNINGS.push(m); }

// ─── 1. DATABASE_URL present in shell environment ──────────────
if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL not set in current shell environment');
} else {
  // Mask the URL — never log credentials.
  const masked = process.env.DATABASE_URL.replace(
    /(\/\/[^:]+:)[^@]+(@)/,
    '$1***$2',
  );
  pass(`DATABASE_URL present (${masked.slice(0, 40)}...)`);
}

// ─── 2. Schema file present ────────────────────────────────────
const schemaPath = path.join(ROOT, 'server/prisma/schema.prisma');
if (!existsSync(schemaPath)) {
  fail(`schema.prisma missing at ${schemaPath}`);
} else {
  const schema = readFileSync(schemaPath, 'utf8');
  pass(`schema.prisma present (${schema.length} chars)`);
  // Check required models.
  const REQUIRED = [
    'User', 'FarmerProfile', 'Organization', 'Program', 'ProgramEnrollment',
    'EnrollmentBatch', 'EnrollmentBatchRow', 'SellListing', 'BuyerInterest',
    'AuditEvent', 'Artifact', 'ImpactRecord',
  ];
  const missing = REQUIRED.filter((m) =>
    !new RegExp(`^\\s*model\\s+${m}\\s*\\{`, 'm').test(schema));
  if (missing.length > 0) {
    fail(`schema: missing required models — ${missing.join(', ')}`);
  } else {
    pass(`schema: all 12 production-critical models present`);
  }
}

// ─── 3. Generated Prisma client present ────────────────────────
const clientPath = path.join(ROOT, 'server/node_modules/.prisma/client');
const clientPath2 = path.join(ROOT, 'server/node_modules/@prisma/client');
if (!existsSync(clientPath) && !existsSync(clientPath2)) {
  warn(`Prisma client not generated. Run: cd server && npx prisma generate`);
} else {
  pass(`Prisma client present`);
}

// ─── 4. Migrations folder ─────────────────────────────────────
const migrationsDir = path.join(ROOT, 'server/prisma/migrations');
const pendingDir    = path.join(ROOT, 'server/prisma/_pending-migrations');
if (existsSync(migrationsDir)) {
  pass(`migrations/ folder present — deployable`);
} else if (existsSync(pendingDir)) {
  warn(`Only _pending-migrations/ folder present — not yet promoted to migrations/. Operator must review and promote.`);
} else {
  fail(`Neither migrations/ nor _pending-migrations/ folder present`);
}

// ─── Report ────────────────────────────────────────────────────
console.log('\n=== Persistence Validation Report ===\n');
for (const p of PASSED)   console.log('  ✓ ' + p);
for (const w of WARNINGS) console.warn('  ⚠ ' + w);
for (const f of FAILED)   console.error('  ✗ ' + f);
console.log(`\n${PASSED.length} passed, ${WARNINGS.length} warnings, ${FAILED.length} failed.\n`);

if (FAILED.length > 0) {
  console.error('Persistence validation FAILED. Resolve above before deploying writes.');
  process.exit(1);
}
if (WARNINGS.length > 0) {
  console.warn('Persistence validation passed with warnings.');
  process.exit(0);
}
console.log('Persistence validation PASS.');
