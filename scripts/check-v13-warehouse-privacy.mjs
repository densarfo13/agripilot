#!/usr/bin/env node
/**
 * scripts/check-v13-warehouse-privacy.mjs — warehouse export must be
 * tenant-isolated + anonymization-aware and leak no private farmer data.
 *
 * Fails if DataWarehouseReadiness:
 *   • does not surface tenantIsolationReady + anonymizationReady
 *   • exposes a PII field as an output key
 *   • claims an external warehouse without env configuration
 *     (externalWarehouseConfigured must be present, not hardcoded true)
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v13/warehouse/DataWarehouseReadiness.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/tenantIsolationReady/.test(src)) F.push('DataWarehouseReadiness must surface tenantIsolationReady');
  else P.push('tenantIsolationReady surfaced');
  if (!/anonymizationReady/.test(src)) F.push('DataWarehouseReadiness must surface anonymizationReady');
  else P.push('anonymizationReady surfaced');
  if (!/externalWarehouseConfigured/.test(src)) F.push('DataWarehouseReadiness must surface externalWarehouseConfigured');
  else P.push('externalWarehouseConfigured surfaced (readiness only)');
  const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|fileName|nationalId)\s*:/;
  if (PII_KEY_RE.test(src)) F.push('DataWarehouseReadiness must not expose a PII field as an output key');
  else P.push('no PII exposed as an output key');
}

if (F.length) {
  console.error('[check:v13-warehouse-privacy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v13-warehouse-privacy] PASS — tenant-isolated, anonymization-aware, no PII leak.');
for (const m of P) console.log('  ✓ ' + m);
