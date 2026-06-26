/**
 * run-production-validation.mjs — the Production Validation Report command
 * (`npm run scan:validate`).
 *
 * Reads the REAL ScanProviderMetric rows recorded by production scans, synthesises a
 * GO / NO_GO / INSUFFICIENT_EVIDENCE verdict, and writes PRODUCTION_VALIDATION.md.
 *
 *   On Railway (DB reachable):   railway run npm run scan:validate
 *   In a sandbox (no DB):        emits INSUFFICIENT_EVIDENCE — NO-GO, honestly.
 *
 * Never fabricates readiness: with no recorded provider evidence the verdict is
 * INSUFFICIENT_EVIDENCE, never GO.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const R = process.cwd();
const CERT = (rel) => pathToFileURL(path.join(R, 'server/src/services/scan/certification', rel)).href;

async function loadPrisma() {
  // Resolve @prisma/client from the server workspace, defensively.
  const candidates = ['@prisma/client', pathToFileURL(path.join(R, 'server/node_modules/@prisma/client/index.js')).href];
  for (const c of candidates) {
    try { const m = await import(c); if (m && m.PrismaClient) return m.PrismaClient; } catch { /* try next */ }
  }
  return null;
}

async function fetchScorecard() {
  const PrismaClient = await loadPrisma();
  if (!PrismaClient) return { scorecard: null, note: 'prisma client not resolvable (run on Railway via `railway run`)' };
  let prisma = null;
  try {
    prisma = new PrismaClient();
    const { getReliabilityScorecard } = await import(CERT('providerReliability.js'));
    const scorecard = await getReliabilityScorecard(prisma, { windowHours: 24 });
    return { scorecard, note: null };
  } catch (err) {
    return { scorecard: null, note: 'database unreachable: ' + (err && err.message ? err.message.split('\n')[0] : '?') };
  } finally {
    try { if (prisma) await prisma.$disconnect(); } catch { /* */ }
  }
}

async function main() {
  const { buildProductionValidationReport } = await import(CERT('productionValidation.js'));
  const { scorecard, note } = await fetchScorecard();

  const report = buildProductionValidationReport({ scorecard: scorecard || { hasData: false, providers: [], windowHours: 24 } });

  let md = report.markdown;
  if (note) md += `\n> NOTE: ${note}\n`;
  fs.writeFileSync(path.join(R, 'PRODUCTION_VALIDATION.md'), md);

  console.log('── Production Validation ──');
  console.log('  verdict:', report.verdict);
  console.log('  ' + report.readiness);
  console.log('  successful:', report.successful.join(', ') || '(none)');
  console.log('  failed:', report.failed.join(', ') || '(none)');
  for (const r of report.recommendations) console.log('  → ' + r.provider + ' (' + r.category + '): ' + r.recommendation);
  if (note) console.log('  note:', note);
  console.log('── Report written: PRODUCTION_VALIDATION.md');
  // Informational command — exit 0 regardless of verdict (the verdict is the signal).
  process.exit(0);
}

main().catch((err) => { console.error('production-validation failed:', err && err.message); process.exit(1); });
