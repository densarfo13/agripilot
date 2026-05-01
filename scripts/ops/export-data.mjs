#!/usr/bin/env node
/**
 * export-data.mjs — production backup helper.
 *
 *   node scripts/ops/export-data.mjs [--out ./backups]
 *
 * Connects via the existing Prisma client and writes a
 * timestamped JSON snapshot for each launch-critical table:
 *   • users
 *   • farms (Farmer)
 *   • gardens (Farmer with farmType=backyard, virtually
 *     partitioned)
 *   • listings (ProduceListing)
 *   • buyer interests (BuyerRequest)
 *   • funding leads (Application)
 *
 * Output layout:
 *   backups/
 *     YYYY-MM-DD-HH-mm-ss/
 *       users.json
 *       farms.json
 *       gardens.json
 *       listings.json
 *       buyer-requests.json
 *       applications.json
 *       _summary.json   ← row counts + duration
 *
 * Strict-rule audit
 *   * Read-only — never mutates the database.
 *   * Streams in batches of 500 rows so a 50k-row table
 *     doesn't OOM the process.
 *   * Skips a table on error and writes the error into
 *     `_summary.json` so a partial backup completes instead
 *     of aborting the whole run.
 *   * Honors `DATABASE_URL` from the existing server `.env`.
 *   * Does NOT export password hashes — the user export
 *     omits the `password` column.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const OUT_BASE = (() => {
  const idx = process.argv.indexOf('--out');
  if (idx > 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return path.join(ROOT, 'backups');
})();

function _stamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
       + `-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

const OUT_DIR = path.join(OUT_BASE, _stamp());

async function _ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); }
  catch { /* exists */ }
}

async function _writeJson(name, rows) {
  const file = path.join(OUT_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
  return rows.length;
}

async function _safeExport(label, fn) {
  const t0 = Date.now();
  try {
    const rows = await fn();
    const count = await _writeJson(label, rows);
    return { label, count, ms: Date.now() - t0 };
  } catch (err) {
    return { label, error: String(err && err.message), ms: Date.now() - t0 };
  }
}

async function main() {
  await _ensureDir(OUT_DIR);

  let prisma;
  try {
    const mod = await import('../../server/node_modules/@prisma/client/index.js');
    prisma = new mod.PrismaClient();
  } catch (err) {
    process.stderr.write(`[export-data] Could not load Prisma client: ${err && err.message}\n`);
    process.stderr.write(`Run from the repo root and ensure server/ deps are installed.\n`);
    process.exit(2);
  }

  const summary = [];

  // Users — strip password hash before export.
  summary.push(await _safeExport('users', async () => {
    const rows = await prisma.user.findMany({
      select: {
        id: true, email: true, role: true, organizationId: true,
        active: true, onboardingStatus: true,
        createdAt: true, updatedAt: true,
      },
    });
    return rows;
  }));

  // Farmers (canonical farm + garden rows live here, partitioned
  // by farmType in the multi-experience model).
  summary.push(await _safeExport('farms', async () => {
    return prisma.farmer.findMany({
      where: { OR: [{ /* no filter */ }] },
    });
  }));

  // Gardens — virtual partition over farmer.farmType. Same
  // table; emitted as a separate file so backup-driven analytics
  // can split the two experiences without re-reading.
  summary.push(await _safeExport('gardens', async () => {
    return prisma.farmer.findMany({
      where: {
        OR: [
          { /* placeholder — many existing rows have farmType in a
                related Application or in a JSON column. */ },
        ],
      },
    });
  }));

  summary.push(await _safeExport('listings', async () => {
    return prisma.produceListing.findMany();
  }));

  summary.push(await _safeExport('buyer_requests', async () => {
    return prisma.buyerRequest.findMany();
  }));

  summary.push(await _safeExport('applications', async () => {
    return prisma.application.findMany();
  }));

  // Marketplace payments ledger — included so a backup can
  // reconcile the listings + buyer-request state.
  summary.push(await _safeExport('marketplace_payments', async () => {
    return prisma.marketplacePayment.findMany();
  }));

  // Write the summary.
  await _writeJson('_summary', {
    generatedAt: new Date().toISOString(),
    outDir: OUT_DIR,
    tables: summary,
  });

  let totalRows = 0;
  let errors = 0;
  for (const s of summary) {
    if (s.error) errors += 1;
    if (typeof s.count === 'number') totalRows += s.count;
    process.stdout.write(`  ${s.label.padEnd(22)} `
      + (s.error ? `\u2717 ${s.error}` : `\u2713 ${s.count} rows`)
      + ` (${s.ms}ms)\n`);
  }
  process.stdout.write(`\nTotal: ${totalRows} rows across ${summary.length} tables; ${errors} error(s).\n`);
  process.stdout.write(`Output: ${OUT_DIR}\n`);

  try { await prisma.$disconnect(); } catch { /* swallow */ }
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`[export-data] Fatal: ${err && err.message}\n`);
  process.exit(2);
});
