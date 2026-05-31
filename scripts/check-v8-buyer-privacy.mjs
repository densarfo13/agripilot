#!/usr/bin/env node
/**
 * scripts/check-v8-buyer-privacy.mjs
 *
 * The supply-chain layer is buyer-facing — it must never expose private
 * farmer data, and must not invent demand or prices. Fails if
 * SupplyChainIntelligenceEngine:
 *   • exposes a PII field as an output key
 *   • exposes private scan detail (disease/pest/severity) as an output key
 *   • emits a price/currency figure (price prediction without real market data)
 *   • calls the network or fabricates data
 *
 * Read-only static analyzer. PII/scan regexes match object KEYS only.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v8/supplyChain/SupplyChainIntelligenceEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  const PII_KEY_RE = /(^|[^.\w])(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|fileName|nationalId)\s*:/;
  if (PII_KEY_RE.test(src)) F.push('SupplyChainIntelligenceEngine must not expose a PII field as an output key');
  else P.push('no PII exposed as an output key');
  // Private scan detail must not be exposed as output keys.
  const SCAN_KEY_RE = /(^|[^.\w])(diseaseName|pestName|severity|scanNotes|diagnosis)\s*:/;
  if (SCAN_KEY_RE.test(src)) F.push('SupplyChainIntelligenceEngine must not expose private scan detail (disease/pest/severity) as output keys');
  else P.push('no private scan detail exposed');
  // No price/currency figure (no price prediction without real market data).
  if (/\bprice\s*:\s*\d|[$₵€£]\s*\d/.test(src))
    F.push('SupplyChainIntelligenceEngine must not emit a price/currency figure (no price prediction)');
  else P.push('no price prediction / currency figure');
  if (/\b(?:Math\.random|fetch)\s*\(/.test(src))
    F.push('SupplyChainIntelligenceEngine must not fabricate data or call the network');
  else P.push('no fabricated data, no network call');
  if (!/Decision support, not a guarantee/.test(raw))
    F.push('SupplyChainIntelligenceEngine must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:v8-buyer-privacy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v8-buyer-privacy] PASS — no private farmer data, no fake demand, no price prediction.');
for (const m of P) console.log('  ✓ ' + m);
