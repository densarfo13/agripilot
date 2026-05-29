#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);

const ALLOWLIST = new Set([
  'src/runtime/grow/flowermarketplacegate.js',
]);

function stripComments(src) {
  src = src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return src;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next' || entry.name === 'build' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const KEYWORDS = /(buyer|sell|marketplace)/i;
const IMPORT_PAYMENT = /import[^;]*from\s+['"](stripe|@stripe\/[^'"]+|paypal-rest-sdk|@paypal\/[^'"]+|plaid|@plaid\/[^'"]+)['"]/g;
const ROUTE_PATH = /['"`]\/(pay|checkout|cart|payments?)(?:\/[^'"`]*)?['"`]/g;
const PAY_NOW = /Pay\s+Now/g;
const FORBIDDEN_TERMS = /\b(escrow|settlement|wire[-_\s]?transfer|bidding|auction)\b/gi;

const srcDir = path.join(ROOT, 'src');
const files = walk(srcDir);

for (const abs of files) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
  if (ALLOWLIST.has(rel.toLowerCase())) continue;
  const raw = fs.readFileSync(abs, 'utf8');
  if (!KEYWORDS.test(rel) && !KEYWORDS.test(raw)) continue;
  const code = stripComments(raw);

  let m;
  IMPORT_PAYMENT.lastIndex = 0;
  while ((m = IMPORT_PAYMENT.exec(code)) !== null) {
    fail(`${rel}: forbidden payment SDK import "${m[1]}"`);
  }

  ROUTE_PATH.lastIndex = 0;
  while ((m = ROUTE_PATH.exec(code)) !== null) {
    fail(`${rel}: forbidden payment route path ${m[0]}`);
  }

  PAY_NOW.lastIndex = 0;
  while ((m = PAY_NOW.exec(code)) !== null) {
    fail(`${rel}: forbidden literal "Pay Now"`);
  }

  FORBIDDEN_TERMS.lastIndex = 0;
  while ((m = FORBIDDEN_TERMS.exec(code)) !== null) {
    fail(`${rel}: forbidden term "${m[1]}"`);
  }
}

if (FAILED.length === 0) {
  pass('no payment / escrow / bidding / auction surfaces in buyer scope');
}

if (FAILED.length > 0) {
  console.error('[check:buyer-no-payments] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check:buyer-no-payments] PASS — scanned ${files.length} files, buyer scope clean of payments / escrow / bidding / auction`);
