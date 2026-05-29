#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FAILED = [];
const PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);

function readOrEmpty(f) {
  try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
}

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
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.(js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const PRIVACY_TOKENS = /(demographicDistribution|DEMOGRAPHIC_PROTECTED_FIELDS|FarmerProfile)/;
const IMPORT_LINE = /import[^;]*from\s*['"][^'"]+['"]/g;

const buyerDirs = [
  path.join(ROOT, 'src/pages/buyer'),
  path.join(ROOT, 'src/runtime/buyer'),
];

for (const dir of buyerDirs) {
  for (const abs of walk(dir)) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const raw = readOrEmpty(abs);
    const code = stripComments(raw);

    let m;
    IMPORT_LINE.lastIndex = 0;
    while ((m = IMPORT_LINE.exec(code)) !== null) {
      const line = m[0];
      if (PRIVACY_TOKENS.test(line)) {
        const token = line.match(PRIVACY_TOKENS)[1];
        fail(`${rel}: imports privacy-protected token "${token}" — buyer surfaces must not access farmer-private data`);
      }
    }
  }
}

const buyerListingPath = path.join(ROOT, 'src/runtime/buyer/BuyerListingService.ts');
if (fs.existsSync(buyerListingPath)) {
  const raw = readOrEmpty(buyerListingPath);
  const code = stripComments(raw);
  const hasConst = /BUYER_VISIBLE_STATUSES/.test(code);
  const hasLiteral = /\[\s*["']approved["']\s*,\s*["']active["']\s*\]/.test(code);
  if (!hasConst && !hasLiteral) {
    fail(`src/runtime/buyer/BuyerListingService.ts: must reference BUYER_VISIBLE_STATUSES or contain ["approved","active"] literal in buyer-list read path`);
  } else {
    pass(`BuyerListingService.ts gates buyer-visible statuses`);
  }
} else {
  fail(`src/runtime/buyer/BuyerListingService.ts: required file missing`);
}

const buyerRuntimeDir = path.join(ROOT, 'src/runtime/buyer');
if (fs.existsSync(buyerRuntimeDir)) {
  for (const abs of walk(buyerRuntimeDir)) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const raw = readOrEmpty(abs);
    const code = stripComments(raw);

    const draftRe = /["']draft["']/g;
    let m;
    while ((m = draftRe.exec(code)) !== null) {
      const start = Math.max(0, m.index - 600);
      const window = code.slice(start, m.index + 200);
      if (/upsertSellListing/.test(window)) continue;
      fail(`${rel}: references "draft" status outside upsertSellListing default — buyer-list context must not include draft`);
    }
  }
}

if (FAILED.length === 0) {
  pass('buyer data scope clean');
}

if (FAILED.length > 0) {
  console.error('[check:buyer-data-scope] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check:buyer-data-scope] PASS — buyer surfaces respect farmer-privacy and visible-status scope`);
