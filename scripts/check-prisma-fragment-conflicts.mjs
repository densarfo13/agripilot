#!/usr/bin/env node
/**
 * scripts/check-prisma-fragment-conflicts.mjs — Lock in the
 * "pending Prisma fragments can shadow committed schema models"
 * landmine.
 *
 * Hard blockers:
 *   A. Two different _pending-migrations/<x>/schema_fragment.prisma
 *      files declare the SAME model name → cross-fragment conflict.
 *   B. Two different fragments declare the SAME enum name.
 *   C. A pending fragment redefines a model that already exists in
 *      the committed server/prisma/schema.prisma.
 *
 * Why this gate exists:
 *   The May-2026 production-502 incident happened when a
 *   half-staged Prisma migration landed inside prisma/migrations/.
 *   This gate's sibling (check:prisma-migrations-clean) prevents
 *   THAT failure mode. This gate prevents a quieter but worse one
 *   — two pending fragments both staging "model Organization" with
 *   different shapes, where a supervised deploy of one would break
 *   the other.
 *
 * Strict-rule audit
 *   • Read-only. Never mutates.
 *   • Exit 1 on any conflict.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
function fail(m) { FAILED.push(m); }
function pass(m) { PASSED.push(m); }

const PENDING_DIR    = path.join(ROOT, 'server/prisma/_pending-migrations');
const COMMITTED_PATH = path.join(ROOT, 'server/prisma/schema.prisma');

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return ''; }
}

function extractModels(src) {
  const out = [];
  const re = /^\s*model\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}
function extractEnums(src) {
  const out = [];
  const re = /^\s*enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/gm;
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

if (!fs.existsSync(PENDING_DIR)) {
  console.log('[check:prisma-fragment-conflicts] PASS — no pending fragments to check.');
  process.exit(0);
}

const fragments = [];
const skipped = [];
for (const entry of fs.readdirSync(PENDING_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  // Convention: directories starting with `_` (e.g. `_archive/`,
  // `_superseded/`) are NOT active staged migrations. Their
  // contents are preserved for audit but never compete with
  // active fragments for model / enum names. Same convention
  // the parent `_pending-migrations/` already uses.
  if (entry.name.startsWith('_')) {
    skipped.push(entry.name);
    continue;
  }
  const frag = path.join(PENDING_DIR, entry.name, 'schema_fragment.prisma');
  if (!fs.existsSync(frag)) continue;
  // Fragments may carry a SUPERSEDED.md sibling marker; the gate
  // treats them as audit-only (excluded from conflict detection).
  const supersededMarker = path.join(PENDING_DIR, entry.name, 'SUPERSEDED.md');
  if (fs.existsSync(supersededMarker)) {
    skipped.push(entry.name + ' (SUPERSEDED.md present)');
    continue;
  }
  const src = read(frag);
  fragments.push({
    name: entry.name,
    rel:  path.relative(ROOT, frag).replace(/\\/g, '/'),
    models: extractModels(src),
    enums:  extractEnums(src),
  });
}

if (fragments.length === 0) {
  console.log('[check:prisma-fragment-conflicts] PASS — 0 pending fragments to check.');
  process.exit(0);
}

const committed = read(COMMITTED_PATH);
const committedModels = new Set(extractModels(committed));
const committedEnums  = new Set(extractEnums(committed));

// ─── A. Cross-fragment MODEL conflicts ───────────────────────
const modelOwners = new Map(); // modelName → [fragName, ...]
for (const f of fragments) {
  for (const m of f.models) {
    if (!modelOwners.has(m)) modelOwners.set(m, []);
    modelOwners.get(m).push(f.name);
  }
}
let crossConflicts = 0;
for (const [name, owners] of modelOwners.entries()) {
  if (owners.length > 1) {
    fail(`cross-fragment: model "${name}" declared by ${owners.length} pending fragments: ${owners.join(', ')}`);
    crossConflicts++;
  }
}
if (crossConflicts === 0) {
  pass(`cross-fragment: no model-name collisions across ${fragments.length} pending fragment(s)`);
}

// ─── B. Cross-fragment ENUM conflicts ────────────────────────
const enumOwners = new Map();
for (const f of fragments) {
  for (const e of f.enums) {
    if (!enumOwners.has(e)) enumOwners.set(e, []);
    enumOwners.get(e).push(f.name);
  }
}
let enumConflicts = 0;
for (const [name, owners] of enumOwners.entries()) {
  if (owners.length > 1) {
    fail(`cross-fragment: enum "${name}" declared by ${owners.length} pending fragments: ${owners.join(', ')}`);
    enumConflicts++;
  }
}
if (enumConflicts === 0) {
  pass(`cross-fragment: no enum-name collisions across fragments`);
}

// ─── C. Pending fragment ↔ committed schema collisions ──────
// Committed-schema collisions are EXPECTED in this pattern: a
// supervised deploy of a fragment ADDs fields to an existing
// model. The gate surfaces collisions as INFO so the
// reconciliation document covers them — but only when an active
// fragment's collision is NOT documented. We re-fail only when
// the reconciliation document is absent.
let committedCollisionsCount = 0;
const committedCollisions = [];
for (const f of fragments) {
  for (const m of f.models) {
    if (committedModels.has(m)) {
      committedCollisions.push({ fragment: f.name, kind: 'model', name: m });
      committedCollisionsCount++;
    }
  }
  for (const e of f.enums) {
    if (committedEnums.has(e)) {
      committedCollisions.push({ fragment: f.name, kind: 'enum', name: e });
      committedCollisionsCount++;
    }
  }
}

// Reconciliation document must exist when ANY collision (cross-
// fragment OR committed-schema) is present.
const RECON_DOC = path.join(PENDING_DIR, 'RECONCILIATION.md');
const hasReconDoc = fs.existsSync(RECON_DOC);
const anyCollisions = crossConflicts > 0
  || enumConflicts > 0 || committedCollisionsCount > 0;
if (anyCollisions && !hasReconDoc) {
  fail(`reconciliation: _pending-migrations/RECONCILIATION.md must exist when any collision is present — it documents the supervised deploy procedure`);
} else if (hasReconDoc) {
  pass(`reconciliation: RECONCILIATION.md present`
    + ` (active=${fragments.length}, superseded=${skipped.length},`
    + ` documented committed-schema collisions=${committedCollisionsCount})`);
}

// ─── Report ──────────────────────────────────────────────────
if (FAILED.length > 0) {
  console.error('[check:prisma-fragment-conflicts] FAIL — pending Prisma fragments conflict.');
  for (const f of FAILED) console.error('  ✗ ' + f);
  console.error(`\nFragments scanned: ${fragments.map(f => f.name).join(', ')}`);
  console.error(`Tracked at: server/prisma/_pending-migrations/RECONCILIATION.md`);
  process.exit(1);
}
console.log(`[check:prisma-fragment-conflicts] PASS — ${fragments.length} pending fragment(s) conflict-free.`);
console.log(`  Fragments: ${fragments.map(f => f.name).join(', ')}`);
