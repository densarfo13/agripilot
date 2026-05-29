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

const NGO_DIRS = [
  path.join(ROOT, 'src/pages/organization'),
  path.join(ROOT, 'src/pages/enterprise'),
  path.join(ROOT, 'src/components/ngo'),
  path.join(ROOT, 'src/components/organization'),
  path.join(ROOT, 'src/runtime/organization'),
];

const FORBIDDEN = [
  { name: 'hardcoded-farmers-reached', re: /(?:[0-9]{3,})\s*farmers?\s*(?:reached|enrolled)/i },
  { name: 'fake-intervention',         re: /fake[-_\s]?intervention/i },
  { name: 'mock-ngo-metrics',          re: /mock[-_\s]?ngo[-_\s]?metrics/i },
  { name: 'placeholder-traction',      re: /placeholder[-_\s]?traction/i },
  { name: 'carbon-credit',             re: /\bcarbon[-_\s]?credit/i },
  { name: 'carbon-offset',             re: /\bcarbon[-_\s]?offset/i },
  { name: 'investor-dashboard',        re: /\binvestor[-_\s]?dashboard\b/i },
  { name: 'satellite-dashboard',       re: /\bsatellite[-_\s]?dashboard\b/i },
];

let scanned = 0;
for (const dir of NGO_DIRS) {
  for (const abs of walk(dir)) {
    scanned++;
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const raw = readOrEmpty(abs);
    const code = stripComments(raw);
    for (const { name, re } of FORBIDDEN) {
      if (re.test(code)) {
        fail(`${rel}: forbidden NGO fake-data token "${name}"`);
      }
    }
  }
}

const reportEngine = path.join(ROOT, 'src/runtime/organization/OrganizationReportEngine.ts');
if (!fs.existsSync(reportEngine)) {
  fail('src/runtime/organization/OrganizationReportEngine.ts: required file missing');
} else {
  const raw = readOrEmpty(reportEngine);
  if (!/fakeData\s*:\s*false/.test(raw)) {
    fail('src/runtime/organization/OrganizationReportEngine.ts: must declare "fakeData: false"');
  } else {
    pass('OrganizationReportEngine declares fakeData: false');
  }
}

if (FAILED.length === 0) {
  pass(`${scanned} NGO/organization/enterprise files clean of fake-data tokens`);
}

if (FAILED.length > 0) {
  console.error('[check:ngo-no-fake-data] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check:ngo-no-fake-data] PASS — ${scanned} NGO/organization surfaces use real aggregates only`);
