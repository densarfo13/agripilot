/**
 * check-location-error-classify.mjs — location-error classification (priority #2 location
 * detection) + runs its test. Locks: a single classifier maps every cause to a SPECIFIC
 * verdict, the primary request surface uses it (no collapsed generic message), and a
 * redaction-safe last-attempt trace is recorded.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };

const ENG  = 'src/runtime/location/classifyLocationError.ts';
const TEST = 'src/runtime/location/__tests__/ClassifyLocationError.test.ts';
const UI   = 'src/components/LocationDetect.jsx';
for (const f of [ENG, TEST, UI]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

const eng = rd(ENG);
for (const code of ['PERMISSION_DENIED','POSITION_UNAVAILABLE','TIMEOUT','NOT_SECURE_CONTEXT','BROWSER_UNSUPPORTED','PRIVACY_RESTRICTION','UNKNOWN'])
  if (!eng.includes(code)) E.push('classifier must handle ' + code);
if (!eng.includes('export function classifyLocationError')) E.push('must export classifyLocationError');
if (!eng.includes('export function recordLocationAttempt')) E.push('must export recordLocationAttempt');
// Redaction: the trace must never store a precise position — coords are rounded.
if (!/coarseLat/.test(eng) || !/Math\.round\([^)]*\*\s*1000\)/.test(eng))
  E.push('last-attempt trace must round coordinates (no precise position)');

// The request surface must USE the classifier and must NOT keep the collapsed message.
const ui = rd(UI);
if (!ui.includes('classifyLocationError')) E.push('LocationDetect must use classifyLocationError');
if (/We couldn't get your exact location\. You can continue/.test(ui))
  E.push('LocationDetect still collapses errors into the generic message — render the classified verdict');

// The canonical onboarding flow (the first trust screen) must show the SPECIFIC reason too.
const fast = rd('src/pages/onboarding/FastOnboarding.jsx');
if (fast) {
  if (!fast.includes('classifyLocationError')) E.push('FastOnboarding must classify the location failure (not collapse every cause to "denied")');
  if (!fast.includes('geoVerdict')) E.push('FastOnboarding must render the specific verdict (geoVerdict) on a location failure');
  // A successful fix must actually be PERSISTED + auto-continue, and never mislabeled.
  if (!fast.includes('saveLocation(')) E.push('FastOnboarding must persist a successful GPS fix via saveLocation (coords were previously discarded)');
  if (!fast.includes('finishLocation(')) E.push('FastOnboarding must use the shared finishLocation handler (tap + auto-continue)');
  if (/geoStatus !== 'ok'/.test(fast)) E.push("FastOnboarding still uses the geoStatus !== 'ok' guard — a successful 'granted' fix gets mislabeled general_guidance/skipped");
  // No dead button while GPS runs (TASK 2) + the town/ZIP search is wired in (TASK 6).
  if (!/geoStatus !== 'requesting'/.test(fast)) E.push('FastOnboarding must hide the Continue button while GPS is running (geoStatus !== "requesting")');
  if (!fast.includes('LocationSearch')) E.push('FastOnboarding must offer the town/ZIP LocationSearch in the manual fallback');
}

// Town/ZIP instant search (TASK 6) — forward-geocode helper + component + redaction-safe parse.
const geo = rd('src/utils/geolocation.js');
if (!/export async function searchLocations/.test(geo)) E.push('geolocation.js must export searchLocations (Nominatim forward search)');
if (!geo.includes('export function parseLocationSearch')) E.push('geolocation.js must export parseLocationSearch (pure, testable)');
if (!fs.existsSync(path.join(R, 'src/components/location/LocationSearch.jsx'))) E.push('missing: src/components/location/LocationSearch.jsx');

const PARSE_TEST = 'src/utils/__tests__/parseLocationSearch.test.ts';
if (E.length === 0) {
  try {
    const out = execSync('npx tsx ' + TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('classifier test did not PASS: ' + out.trim());
  } catch (err) { E.push('classifier test failed: ' + ((err && (err.stdout || err.message)) || '')); }
  try {
    const out = execSync('npx tsx ' + PARSE_TEST, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (!/PASS/.test(out)) E.push('parseLocationSearch test did not PASS: ' + out.trim());
  } catch (err) { E.push('parseLocationSearch test failed: ' + ((err && (err.stdout || err.message)) || '')); }
}

if (E.length) { console.error('[check:location-error-classify] FAIL:'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:location-error-classify] PASS — every location failure maps to a specific verdict + buttons; '
  + 'LocationDetect renders it (no generic collapse); redaction-safe last-attempt trace; test green.');
