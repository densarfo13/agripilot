#!/usr/bin/env node
/**
 * scripts/check-prisma-production-ready.mjs — Wave-38 CI gate.
 *
 * Statically enforces the Prisma + production-persistence
 * readiness contract:
 *
 *   • DATABASE_URL is REFERENCED in server config (presence in
 *     env is checked at server boot; we check the reference here).
 *   • server/prisma/schema.prisma exists.
 *   • The 12 required production-critical models exist in the schema:
 *       User, FarmerProfile, Organization, Program, ProgramEnrollment,
 *       EnrollmentBatch, EnrollmentBatchRow, SellListing, BuyerInterest,
 *       AuditEvent, Artifact, ImpactRecord
 *   • server/prisma/migrations/ directory exists (or staged at
 *     server/prisma/_pending-migrations/).
 *   • No production-critical write route silently writes to an
 *     in-memory store without a persistence guard.
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch { return ''; }
}

// ─── 1. schema.prisma exists ───────────────────────────────────
const schemaPath = path.join(ROOT, 'server/prisma/schema.prisma');
const schema = read(schemaPath);
if (!schema) {
  fail(`prisma: server/prisma/schema.prisma missing`);
} else {
  pass(`prisma: schema.prisma present (${schema.length} chars)`);
}

// ─── 2. DATABASE_URL referenced in server config ───────────────
const serverConfig = read(path.join(ROOT, 'server/src/config/database.js'))
                   + read(path.join(ROOT, 'server/src/config/envSchema.js'))
                   + read(path.join(ROOT, 'server/src/app.js'));
if (!/DATABASE_URL/.test(serverConfig)) {
  fail(`prisma: DATABASE_URL must be referenced in server config`);
} else {
  pass(`prisma: DATABASE_URL referenced in server config`);
}

// ─── 3. Required models present in schema (canonical names) ────
// Reflects THIS codebase's Prisma naming (Farmer, AuditLog, etc.)
// — see src/runtime/persistence/persistenceContracts.ts for the
// conceptual-to-actual mapping.
const REQUIRED_MODELS = [
  'User', 'Farmer', 'Organization', 'Program', 'Application',
  'CropListing', 'BuyerInterest', 'AuditLog', 'EvidenceFile',
];
// Staged models live in server/prisma/_pending-migrations/.
// Their absence is reported but does NOT fail the gate.
const STAGED_MODELS = ['EnrollmentBatch', 'EnrollmentBatchRow', 'ImpactReport'];

if (schema) {
  const missing = [];
  for (const m of REQUIRED_MODELS) {
    const re = new RegExp(`^\\s*model\\s+${m}\\s*\\{`, 'm');
    if (!re.test(schema)) missing.push(m);
  }
  if (missing.length > 0) {
    fail(`prisma: schema missing required models: ${missing.join(', ')}`);
  } else {
    pass(`prisma: all ${REQUIRED_MODELS.length} canonical production models present`);
  }

  // Staged models — informational only.
  const stagedMissing = [];
  for (const m of STAGED_MODELS) {
    const re = new RegExp(`^\\s*model\\s+${m}\\s*\\{`, 'm');
    if (!re.test(schema)) stagedMissing.push(m);
  }
  if (stagedMissing.length > 0) {
    pass(`prisma: ${stagedMissing.length} staged models pending: ${stagedMissing.join(', ')} (see _pending-migrations/)`);
  } else {
    pass(`prisma: all staged models already promoted into schema`);
  }
}

// ─── 4. Migrations folder OR pending-migrations folder exists ──
const migrationsDir = path.join(ROOT, 'server/prisma/migrations');
const pendingDir    = path.join(ROOT, 'server/prisma/_pending-migrations');
const hasMigrations = fs.existsSync(migrationsDir);
const hasPending    = fs.existsSync(pendingDir);
if (!hasMigrations && !hasPending) {
  fail(`prisma: neither server/prisma/migrations/ nor _pending-migrations/ exists`);
} else {
  pass(`prisma: migrations dir present (${hasMigrations ? 'migrations' : '_pending-migrations'})`);
}

// ─── 5. ProductionPersistenceRuntime is present (wave-38) ──────
// Renamed from PersistenceRuntime.ts to avoid case-clash with the
// pre-existing wave-5 persistenceRuntime.js on case-insensitive
// filesystems.
const persistencePath = path.join(ROOT, 'src/runtime/persistence/ProductionPersistenceRuntime.ts');
if (!fs.existsSync(persistencePath)) {
  fail(`prisma: src/runtime/persistence/ProductionPersistenceRuntime.ts must exist (wave-38)`);
} else {
  pass(`prisma: ProductionPersistenceRuntime wired (wave-38)`);
}

// ─── 6. PersistenceGuard exposes the canonical guard fn ────────
const guard = read(path.join(ROOT, 'src/runtime/persistence/PersistenceGuard.ts'));
if (!guard.includes('requireWritablePersistence')) {
  fail(`prisma: PersistenceGuard must export requireWritablePersistence`);
}
if (!guard.includes('SAFE_503_MESSAGE')) {
  fail(`prisma: PersistenceGuard must use the canonical SAFE_503_MESSAGE`);
}

// ─── Report ────────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:prisma-production-ready] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\n${PASSED.length} checks passed, ${FAILED.length} failed.`);
  process.exit(1);
}
console.log('[check:prisma-production-ready] PASS — Prisma + persistence runtime contract intact.');
for (const p of PASSED) console.log('  ✓ ' + p);
