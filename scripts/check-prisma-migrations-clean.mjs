#!/usr/bin/env node
/**
 * check-prisma-migrations-clean.mjs — Incident-driven CI guard.
 *
 *   node scripts/check-prisma-migrations-clean.mjs
 *
 * Why this exists
 * ───────────────
 *   Gap-fix sprint placed a "pending" Prisma schema fragment inside
 *   `server/prisma/migrations/_pending/`. Prisma's startup
 *   `migrate deploy` scans every subdirectory of `migrations/`
 *   and expects each to contain a `migration.sql`. The `_pending/`
 *   directory failed that contract; the server failed to boot
 *   and farroway.app returned 502 for ~5 minutes.
 *
 *   This gate ensures the same mistake never reaches production
 *   again. Every subdirectory of `server/prisma/migrations/` must:
 *     1. match the `YYYYMMDDHHMMSS_name` Prisma format, OR
 *     2. be `migration_lock.toml` at the root level
 *   AND every migration directory must contain `migration.sql`.
 *
 *   Pending artifacts MUST live at
 *   `server/prisma/_pending-migrations/` (sibling, NOT inside).
 */

import { readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:prisma-migrations-clean]';
const MIGRATIONS_DIR = resolve(ROOT, 'server/prisma/migrations');

function fail(m, d) {
  console.error(HEADER, 'FAIL —', m);
  if (d) console.error('  ' + d);
  process.exit(1);
}

if (!existsSync(MIGRATIONS_DIR)) {
  console.log(HEADER, 'SKIP — server/prisma/migrations/ does not exist');
  process.exit(0);
}

// Prisma migration folder name format: YYYYMMDD_some_name OR
// YYYYMMDDHHMMSS_some_name. Farroway uses the 8-digit shorthand;
// upstream Prisma init uses the 14-digit form. Both are valid
// as long as the folder is monotonically sortable.
const MIGRATION_FOLDER_RE = /^\d{8}(\d{6})?_[a-z0-9_]+$/i;
const ALLOWED_ROOT_FILES = new Set(['migration_lock.toml']);

const entries = readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
const violations = [];

for (const e of entries) {
  const abs = join(MIGRATIONS_DIR, e.name);
  if (e.isDirectory()) {
    if (!MIGRATION_FOLDER_RE.test(e.name)) {
      violations.push('Directory "' + e.name + '" does not match the '
        + 'Prisma migration format YYYYMMDDHHMMSS_name — '
        + 'Prisma will choke on it at startup');
      continue;
    }
    const sqlPath = join(abs, 'migration.sql');
    if (!existsSync(sqlPath)) {
      violations.push('Directory "' + e.name + '" is missing '
        + 'migration.sql — Prisma will fail to apply it');
    }
  } else if (e.isFile()) {
    if (!ALLOWED_ROOT_FILES.has(e.name)) {
      violations.push('Unexpected file "' + e.name + '" at the root '
        + 'of prisma/migrations/ — only migration_lock.toml is '
        + 'allowed here');
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(HEADER, 'VIOLATION:', v);
  console.error(HEADER,
    'Pending migration artifacts MUST live at '
    + 'server/prisma/_pending-migrations/ (SIBLING of, NOT INSIDE, '
    + 'migrations/). See the README there for the supervised-deploy '
    + 'procedure.');
  fail(violations.length + ' migrations-directory violation(s)');
}

console.log(HEADER, 'PASS — Prisma migrations directory is clean.');
console.log('  Scanned ' + entries.length + ' entries — all match '
  + 'YYYYMMDDHHMMSS_name format and carry migration.sql.');
process.exit(0);
