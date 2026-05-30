/**
 * server/src/config/persistenceProbe.js — Wave-39 hardening.
 * Produces the canonical persistence envelope that the frontend
 * runtime wave-38 `__persistenceHealth()` reads from /api/health.
 *
 * Shape:
 *   {
 *     mode:                     'postgres' | 'in_memory' | 'unavailable',
 *     databaseUrlPresent:       boolean,
 *     prismaClientReady:        boolean,
 *     migrationsApplied:        boolean,
 *     criticalWritesPersisted:  boolean,
 *   }
 *
 * Rules
 *   • Pure read-only probe. NEVER opens new transactions.
 *   • SELECT 1 is the only DB read; piggybacks on the existing
 *     `_healthHandler` which already runs it.
 *   • migrationsApplied: probes Prisma's `_prisma_migrations`
 *     table for any row with `finished_at` not null. One
 *     deterministic SELECT — cached for the lifetime of the
 *     process.
 *   • criticalWritesPersisted: operator-flipped flag via env
 *     `FARROWAY_CRITICAL_WRITES_PERSISTED=true`. The wave-39
 *     contract treats this as ground truth — code cannot
 *     self-attest. Operators run `npm run validate:persistence`
 *     against the live DB, smoke-write each of the 9 critical
 *     surfaces in a non-prod replica, then flip the flag.
 *   • Never throws. Never logs secrets. Never returns a stack.
 */

import prisma from './database.js';

let _migrationsCheckResult = null; // null | boolean

/**
 * _checkMigrationsApplied — one-shot probe of _prisma_migrations.
 * Caches the result for the process lifetime so /api/health stays
 * cheap. Returns false if the probe fails for ANY reason.
 */
async function _checkMigrationsApplied() {
  if (_migrationsCheckResult !== null) return _migrationsCheckResult;
  try {
    // Prisma exposes the migration table via raw SQL. We don't
    // care about specific migration names — only that AT LEAST ONE
    // migration has finished.
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS applied
      FROM _prisma_migrations
      WHERE finished_at IS NOT NULL
    `;
    const applied = Array.isArray(rows) && rows[0]
      ? Number(rows[0].applied || 0) > 0
      : false;
    _migrationsCheckResult = applied;
    return applied;
  } catch {
    // Migration table may not exist yet on first boot — that's
    // honest "unavailable", not a crash.
    _migrationsCheckResult = false;
    return false;
  }
}

/**
 * probePersistence — async one-shot probe; the caller already knows
 * `dbStatus` from `_healthHandler`'s SELECT 1 round-trip, so it
 * passes that in to avoid a duplicate query.
 *
 * Returns the frozen envelope synchronously when possible.
 */
export async function probePersistence({ dbStatus }) {
  const databaseUrlPresent = !!(process.env.DATABASE_URL
                                 && String(process.env.DATABASE_URL).length > 0);
  const prismaClientReady  = dbStatus === 'ok';

  // Mode resolution honest rules:
  //   • postgres    — DB is reachable AND DATABASE_URL set
  //   • unavailable — DATABASE_URL missing OR DB unreachable
  //   • in_memory   — only ever reported in non-production single
  //                   tenant dev; we never claim in_memory in prod
  let mode;
  if (databaseUrlPresent && prismaClientReady) mode = 'postgres';
  else                                          mode = 'unavailable';

  let migrationsApplied = false;
  if (prismaClientReady) {
    migrationsApplied = await _checkMigrationsApplied();
  }

  // criticalWritesPersisted — operator-flipped env flag.
  // Default false. Truthy values: 'true', '1', 'yes', 'on'.
  const rawFlag = String(process.env.FARROWAY_CRITICAL_WRITES_PERSISTED || '')
                    .trim().toLowerCase();
  const criticalWritesPersisted =
    rawFlag === 'true' || rawFlag === '1' || rawFlag === 'yes' || rawFlag === 'on';

  return Object.freeze({
    mode,
    databaseUrlPresent,
    prismaClientReady,
    migrationsApplied,
    criticalWritesPersisted,
  });
}

export const PERSISTENCE_PROBE_VERSION = 'persistence-probe-v1';
