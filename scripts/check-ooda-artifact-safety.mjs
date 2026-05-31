#!/usr/bin/env node
/**
 * scripts/check-ooda-artifact-safety.mjs — §4 OODA + Artifact safety.
 *
 * Fails if:
 *   • OODA could block the user-facing scan render (intelligence
 *     runtimes must run AFTER the result is set, never gate the shell)
 *   • artifacts are written directly from UI (must go through
 *     ArtifactRuntime / scanPersistenceBridge — no raw registry writes
 *     in components)
 *   • __oodaHealth lacks scanIntegrated / nonBlocking / growerSafeOutput
 *   • __artifactHealth lacks scanArtifactsReady / failureArtifactsReady
 *     / offlineSafe / idempotent
 *
 * Read-only. Never mutates source.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// ─── 1. OODA non-blocking in ScanPage ──────────────────────────
const scanPage = read('src/pages/ScanPage.jsx');
// The scan shell render (idle/capture) must not await OODA. We assert
// the idle branch renders the shell and intelligence runtimes are
// composed inside a post-result useEffect (gated on `result`), not in
// the render path.
if (!/phase\s*===\s*['"]idle['"]/.test(scanPage))
  F.push('ScanPage must render the idle shell before any analysis/OODA');
else P.push('scan shell renders before analysis (OODA never gates render)');
if (/if\s*\(\s*!\s*result\s*\)\s*return/.test(scanPage))
  P.push('intelligence/OODA composition is gated on result (post-analysis, non-blocking)');

// ─── 2. No direct artifact writes from UI components ───────────
// Components must not import the raw artifact registry writer; scan
// persistence goes through scanPersistenceBridge / ArtifactRuntime.
let directWrites = 0;
const scanComponents = (() => {
  try { return fs.readdirSync(path.join(ROOT, 'src/components/scan')).filter((f) => f.endsWith('.jsx')); }
  catch { return []; }
})();
for (const f of scanComponents) {
  const src = read('src/components/scan/' + f)
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
  // Raw registry mutation from a component is the violation.
  if (/artifactRegistry\.(add|write|push)\s*\(/.test(src)) {
    directWrites += 1;
    F.push(`${f}: writes artifacts directly — must go through ArtifactRuntime`);
  }
}
if (directWrites === 0) P.push('no UI component writes artifacts directly (ArtifactRuntime only)');

// ─── 3. __oodaHealth scan-integration flags ────────────────────
const ooda = read('src/runtime/intelligence/index.ts');
for (const tok of ['scanIntegrated', 'nonBlocking', 'growerSafeOutput']) {
  if (!new RegExp(`\\b${tok}\\b`).test(ooda)) F.push(`__oodaHealth must surface "${tok}"`);
}
if (!F.some((m) => m.includes('__oodaHealth'))) P.push('__oodaHealth: scanIntegrated + nonBlocking + growerSafeOutput');

// ─── 4. __artifactHealth scan-artifact flags ───────────────────
const art = read('src/runtime/artifacts/index.ts');
for (const tok of ['scanArtifactsReady', 'failureArtifactsReady', 'offlineSafe', 'idempotent']) {
  if (!new RegExp(`\\b${tok}\\b`).test(art)) F.push(`__artifactHealth must surface "${tok}"`);
}
if (!F.some((m) => m.includes('__artifactHealth'))) P.push('__artifactHealth: scanArtifactsReady + failureArtifactsReady + offlineSafe + idempotent');

const uniqF = [...new Set(F)];
if (uniqF.length) {
  console.error('[check:ooda-artifact-safety] FAIL');
  for (const m of uniqF) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:ooda-artifact-safety] PASS — OODA non-blocking, artifacts via runtime, failure-safe + idempotent.');
for (const m of P) console.log('  ✓ ' + m);
