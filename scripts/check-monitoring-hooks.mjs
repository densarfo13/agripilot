#!/usr/bin/env node
/**
 * scripts/check-monitoring-hooks.mjs — Monitoring runtime sanity:
 * 5 spec files, MONITORED_EVENTS enum covers 10 spec events, and
 * no plaintext secret/token/password logging.
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

const DIR = path.join(ROOT, 'src/runtime/monitoring');
const SPEC_FILES = [
  'monitoringContracts.ts',
  'MonitoringClient.ts',
  'MonitoringRuntime.ts',
  'eventScrubber.ts',
  'index.ts',
];
const sources = {};
for (const f of SPEC_FILES) {
  const s = read(path.join(DIR, f));
  sources[f] = s;
  if (!s) fail(`monitoring: missing src/runtime/monitoring/${f}`);
}
if (Object.values(sources).every(Boolean)) {
  pass('monitoring: 5 spec files present');
}

const SPEC_EVENTS = [
  'app_loaded',
  'route_changed',
  'scan_started',
  'scan_completed',
  'scan_failed',
  'plant_created',
  'task_completed',
  'error_boundary_hit',
  'api_error',
  'rate_limited',
];
const contracts = stripComments(sources['monitoringContracts.ts'] || '');
let missing = 0;
for (const ev of SPEC_EVENTS) {
  if (!new RegExp("'" + ev + "'").test(contracts) &&
      !new RegExp('"' + ev + '"').test(contracts)) {
    fail(`monitoring: MONITORED_EVENTS missing "${ev}"`);
    missing++;
  }
}
if (missing === 0) pass('monitoring: 10 spec events covered in MONITORED_EVENTS');

// No plaintext secret/token/password logging in the monitoring runtime
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
const offenders = [];
for (const file of walk(DIR)) {
  const code = stripComments(read(file));
  // Match console.log(...) calls whose argument list mentions
  // secret/token/password — keyword match inside the call.
  const re = /console\s*\.\s*log\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(code))) {
    const args = m[1];
    if (/\b(secret|token|password)\b/i.test(args)) {
      offenders.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        snippet: m[0].slice(0, 120),
      });
    }
  }
}
if (offenders.length > 0) {
  for (const o of offenders) {
    fail(`monitoring: plaintext secret/token/password logging in ${o.file}: ${o.snippet}`);
  }
} else {
  pass('monitoring: no plaintext secret/token/password logging detected');
}

if (FAILED.length > 0) {
  console.error('[check:monitoring-hooks] FAIL');
  for (const f of FAILED) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log('[check:monitoring-hooks] PASS — monitoring runtime present, 10 events covered, no plaintext secret logging.');
