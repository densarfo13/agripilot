#!/usr/bin/env node
/**
 * scripts/check-buyer-readiness.mjs — §9 buyer readiness + match queue.
 *
 * Fails if:
 *   • the supply-chain runtime does not surface harvest-window + buyer-match
 *     readiness (the buyer match queue inputs)
 *   • harvest readiness is not tracked
 *   • a PII field is exposed as an output key (buyer must not see private
 *     farmer data)
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const supply = read('src/runtime/v8/supplyChain/SupplyChainIntelligenceEngine.ts');
if (!supply) { F.push('SupplyChainIntelligenceEngine.ts: missing'); }
else {
  if (!/harvestWindowReadiness/.test(supply)) F.push('supply chain must surface harvestWindowReadiness');
  else P.push('harvest-window readiness surfaced');
  if (!/buyerMatchReadiness/.test(supply)) F.push('supply chain must surface buyerMatchReadiness (match queue input)');
  else P.push('buyer-match readiness surfaced');
  // No private farmer data exposed as an output key.
  const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|nationalId)\s*:/;
  if (PII_KEY_RE.test(strip(supply))) F.push('buyer readiness must not expose a PII field as an output key');
  else P.push('no private farmer data exposed to buyers');
}

// Harvest readiness tracked.
const harvest = read('src/runtime/harvest/HarvestReadinessRuntime.ts');
if (!harvest) F.push('HarvestReadinessRuntime.ts: missing (harvest-ready crops tracking)');
else P.push('harvest readiness tracked');

if (F.length) {
  console.error('[check:buyer-readiness] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:buyer-readiness] PASS — harvest + buyer-match readiness; no private farmer data exposed.');
for (const m of P) console.log('  ✓ ' + m);
