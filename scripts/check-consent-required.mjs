#!/usr/bin/env node
/**
 * scripts/check-consent-required.mjs — Consent runtime sanity:
 * required spec files, CONSENT_TYPES enum coverage, fail-closed
 * default, and no raw geolocation outside ConsentPolicy.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const FAILED = [], PASSED = [];
const fail = (m) => FAILED.push(m);
const pass = (m) => PASSED.push(m);
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const CONSENT_DIR = path.join(ROOT, 'src/runtime/consent');
const SPEC_FILES = [
  'consentContracts.ts',
  'ConsentStore.ts',
  'ConsentPolicy.ts',
  'ConsentRuntime.ts',
  'consentDefaults.ts',
  'index.ts',
];
const sources = {};
for (const f of SPEC_FILES) {
  const full = path.join(CONSENT_DIR, f);
  const s = read(full);
  sources[f] = s;
  if (!s) fail(`consent: missing src/runtime/consent/${f}`);
}
const promptPath = path.join(ROOT, 'src/runtime/consent/ConsentPrompt.jsx');
const promptSrc = read(promptPath);
if (!promptSrc) fail('consent: missing src/runtime/consent/ConsentPrompt.jsx');
if (Object.values(sources).every(Boolean) && promptSrc) {
  pass('consent: 6 spec files + ConsentPrompt.jsx present');
}

const SPEC_TYPES = [
  'collect_photos',
  'collect_location',
  'collect_diagnostics',
  'collect_usage',
  'share_for_review',
  'export_data',
  'delete_account',
  'receive_notifications',
];
const contracts = stripComments(sources['consentContracts.ts'] || '');
let typesMissing = 0;
for (const t of SPEC_TYPES) {
  if (!new RegExp("'" + t + "'").test(contracts) &&
      !new RegExp('"' + t + '"').test(contracts)) {
    fail(`consent: CONSENT_TYPES missing "${t}"`);
    typesMissing++;
  }
}
if (typesMissing === 0) pass(`consent: 8 spec types covered in CONSENT_TYPES`);

// Fail-closed default branch in requiresConsent
const policy = stripComments(sources['ConsentPolicy.ts'] || '');
// Look for a default case / fallback that returns required: true
const failClosedPatterns = [
  /default\s*:\s*[\s\S]{0,200}?required\s*:\s*true/,
  /return\s*\{\s*required\s*:\s*true[\s\S]{0,200}?\}\s*;\s*\}\s*$/m,
  /\/\/\s*fail[-\s]?closed[\s\S]{0,200}?required\s*:\s*true/i,
];
const hasFailClosed = failClosedPatterns.some((re) => re.test(policy));
if (!hasFailClosed) {
  fail('consent: ConsentPolicy.requiresConsent must fail-closed (default branch → required:true)');
} else {
  pass('consent: requiresConsent fail-closed default verified');
}

// No raw geolocation outside ConsentPolicy gate
function walk(dir, acc = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) acc.push(full);
  }
  return acc;
}
const runtimeDir = path.join(ROOT, 'src/runtime');
const consentRel = path.normalize('src/runtime/consent');
const offenders = [];
for (const file of walk(runtimeDir)) {
  // Skip the consent runtime itself
  if (file.includes(consentRel)) continue;
  const raw = read(file);
  if (!raw) continue;
  const code = stripComments(raw);
  const hasGeo =
    /\bgetCurrentPosition\b/.test(code) ||
    /\bnavigator\s*\.\s*geolocation\b/.test(code);
  if (!hasGeo) continue;
  const gated = /requiresConsent\s*\(\s*['"]collect_location['"]\s*\)/.test(code);
  if (!gated) offenders.push(path.relative(ROOT, file).replace(/\\/g, '/'));
}
if (offenders.length > 0) {
  for (const o of offenders) {
    fail(`consent: raw geolocation usage without ConsentPolicy.requiresConsent("collect_location") in ${o}`);
  }
} else {
  pass('consent: no raw geolocation usage outside ConsentPolicy gate');
}

if (FAILED.length > 0) {
  console.error('[check:consent-required] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:consent-required] PASS — consent runtime present, 8 types covered, fail-closed default, geolocation gated.');
