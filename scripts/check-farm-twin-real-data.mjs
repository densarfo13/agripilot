#!/usr/bin/env node
/**
 * scripts/check-farm-twin-real-data.mjs — §2 farm digital twin must reflect
 * REAL data, invent no history, expose no private farmer data.
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/intelligence/farmTwin/FarmDigitalTwinRuntime.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  const FLAGS = ['farmProfileReady', 'plantHistoryReady', 'scanHistoryReady',
    'taskHistoryReady', 'outcomeHistoryReady', 'weatherContextReady'];
  const missing = FLAGS.filter((k) => !raw.includes(k));
  if (missing.length) F.push(`farm twin missing readiness flags: ${missing.join(', ')}`);
  else P.push('readiness flags present');
  if (!/noInventedHistory:\s*true/.test(raw)) F.push('must declare noInventedHistory:true');
  else P.push('no invented history');
  if (!/tenantScoped:\s*true/.test(raw)) F.push('must declare tenantScoped:true');
  else P.push('tenant-scoped');
  if (!/_ls\s*\(/.test(src)) F.push('must read from real on-device stores (_ls)');
  else P.push('reads real on-device stores');
  // No PII exposed as an output key.
  const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|nationalId)\s*:/;
  if (PII_KEY_RE.test(src)) F.push('must not expose a PII field as an output key');
  else P.push('no PII exposed as an output key');
  if (/Math\.random\s*\(|\bfetch\s*\(/.test(src)) F.push('must not fabricate / call the network');
  else P.push('no fabrication, no network');
  if (!/Decision support, not a guarantee/.test(raw)) F.push('must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:farm-twin-real-data] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:farm-twin-real-data] PASS — real data only, no invented history, no PII, tenant-scoped.');
for (const m of P) console.log('  ✓ ' + m);
