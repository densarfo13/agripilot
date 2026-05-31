#!/usr/bin/env node
/**
 * scripts/check-buyer-privacy.mjs — buyer trust signals must NEVER
 * expose private farmer data.
 *
 * A buyer-facing trust signal is composed from coarse, non-identifying
 * facts only (last-scan recency, an active-grower badge, an opaque photo
 * ref). Fails if the BuyerTrustRuntime:
 *   • reads a PII field (phone / email / coords / deviceId / ip /
 *     farmer name / exact filename)
 *   • calls a server route (fetch) — trust signals are local-only in v1
 *   • writes to a store (must be read-only over existing stores)
 *   • does not document its no-PII / opaque-ref contract
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const FILES = [
  'src/runtime/buyerTrust/BuyerTrustRuntime.ts',
  'src/runtime/buyerTrust/buyerTrustContracts.ts',
];
const runtime = read(FILES[0]);
if (!runtime) { F.push(`${FILES[0]}: missing (buyer trust runtime required)`); }
else P.push('BuyerTrustRuntime present');

// Document the no-PII contract.
if (runtime && !/No PII/i.test(runtime))
  F.push('BuyerTrustRuntime must document its No-PII contract');
else if (runtime) P.push('No-PII contract documented');

// PII field access — code only (comments may legitimately name the
// fields being EXCLUDED, e.g. "never resolved to phone/email/coords").
const PII_RE = /\.(phone|phoneNumber|email|latitude|longitude|deviceId|ipAddress|farmerName|fullName|filename|fileName|nationalId|gpsCoords)\b/;
for (const rel of FILES) {
  const src = strip(read(rel));
  if (!src) continue;
  if (PII_RE.test(src))
    F.push(`${rel}: reads a PII field — buyer signals must stay non-identifying`);
}
if (!F.some((m) => m.includes('PII field'))) P.push('no PII field is read (signals stay non-identifying)');

// Local-only + read-only.
for (const rel of FILES) {
  const src = strip(read(rel));
  if (!src) continue;
  if (/\bfetch\s*\(/.test(src))
    F.push(`${rel}: no server route — buyer trust signals are local-only in v1`);
  if (/localStorage\.setItem|localStorage\.removeItem|localStorage\.clear/.test(src))
    F.push(`${rel}: no store write — buyer trust runtime is read-only`);
}
if (!F.some((m) => m.includes('local-only'))) P.push('no server route (local-only)');
if (!F.some((m) => m.includes('read-only'))) P.push('read-only over existing stores');

if (F.length) {
  console.error('[check:buyer-privacy] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:buyer-privacy] PASS — buyer trust signals are non-identifying, local-only, read-only.');
for (const m of P) console.log('  ✓ ' + m);
