#!/usr/bin/env node
/**
 * scripts/check-ngo-reporting-privacy.mjs — §5 NGO reporting hooks must be
 * org-scoped, privacy-safe, and never fabricate metrics.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/intelligence/ngo/NGOReportingHooks.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/orgScoped:\s*true/.test(raw)) F.push('must declare orgScoped:true');
  else P.push('organization-scoped');
  if (!/privacySafe:\s*true/.test(raw)) F.push('must declare privacySafe:true');
  else P.push('privacy-safe');
  if (!/noFakeMetrics:\s*true/.test(raw)) F.push('must declare noFakeMetrics:true');
  else P.push('no fake metrics');
  for (const k of ['farmerEnrollmentReady', 'scanAggregateReady', 'taskAggregateReady', 'outcomeAggregateReady']) {
    if (!raw.includes(k)) F.push(`must surface ${k}`);
  }
  if (!F.some((m) => m.includes('must surface'))) P.push('aggregate readiness flags present');
  const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|nationalId)\s*:/;
  if (PII_KEY_RE.test(src)) F.push('must not expose a PII / private farmer field as an output key');
  else P.push('no private farmer detail exposed');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/NEEDS_DATA/.test(raw)) F.push('must show insufficient data honestly (NEEDS_DATA)');
  else P.push('honest NEEDS_DATA');
}

if (F.length) {
  console.error('[check:ngo-reporting-privacy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:ngo-reporting-privacy] PASS — org-scoped, privacy-safe, no fake metrics, honest NEEDS_DATA.');
for (const m of P) console.log('  ✓ ' + m);
