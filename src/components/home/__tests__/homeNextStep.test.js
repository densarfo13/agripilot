/**
 * homeNextStep.test.js — the Home onboarding ladder. Self-running: `tsx homeNextStep.test.js`.
 * Covers the spec's required states: no farm / farm-no-crop / crop-no-location /
 * crop+location-no-scan / complete. Honest: never fabricates a step.
 */
import { homeNextStep } from '../homeNextStep.js';

let passed = 0;
function ok(c, m) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

const flags = (o) => ({ farmCreated: false, cropSelected: false, locationAdded: false, firstScanCompleted: false, ...o });

// No farm → create farm.
ok(homeNextStep(flags({})).key === 'create_farm', 'no farm → create_farm');

// Farm but no crop → add crop.
ok(homeNextStep(flags({ farmCreated: true })).key === 'add_crop', 'farm, no crop → add_crop');

// Crop but no location → add location.
ok(homeNextStep(flags({ farmCreated: true, cropSelected: true })).key === 'add_location', 'crop, no location → add_location');

// Crop + location but no scan → first scan.
ok(homeNextStep(flags({ farmCreated: true, cropSelected: true, locationAdded: true })).key === 'first_scan',
  'crop+location, no scan → first_scan');

// All four done → null (defer to the live decision engine).
ok(homeNextStep(flags({ farmCreated: true, cropSelected: true, locationAdded: true, firstScanCompleted: true })) === null,
  'fully set up → null (defer to hero)');

// Accepts the FarmerCompletion.completedSteps array shape too.
const completion = { completedSteps: [
  { key: 'farmCreated', done: true }, { key: 'cropSelected', done: false },
  { key: 'locationAdded', done: false }, { key: 'firstScanCompleted', done: false },
] };
ok(homeNextStep(completion).key === 'add_crop', 'reads FarmerCompletion.completedSteps array');

// Every returned step carries a title + reason + cta + route + confidence (never bare).
for (const f of [{}, { farmCreated: true }, { farmCreated: true, cropSelected: true, locationAdded: true }]) {
  const s = homeNextStep(flags(f));
  ok(s.titleFallback && s.reasonFallback && s.ctaFallback && s.route && s.confidence === 'high',
    'step carries title+reason+cta+route+confidence');
}

// ── Spec invariants (negative assertions) ───────────────────────────
// crop exists → NEVER "Add your crop", for every combination that has a crop.
for (const extra of [{}, { locationAdded: true }, { firstScanCompleted: true }, { locationAdded: true, firstScanCompleted: true }]) {
  const s = homeNextStep(flags({ farmCreated: true, cropSelected: true, ...extra }));
  ok(!s || s.key !== 'add_crop', 'crop exists → never add_crop (' + JSON.stringify(extra) + ')');
}
// location exists → NEVER "Add your location".
for (const extra of [{}, { firstScanCompleted: true }]) {
  const s = homeNextStep(flags({ farmCreated: true, cropSelected: true, locationAdded: true, ...extra }));
  ok(!s || s.key !== 'add_location', 'location exists → never add_location (' + JSON.stringify(extra) + ')');
}
// first-scan step's CTA opens Scan (route === '/scan').
const scanStep = homeNextStep(flags({ farmCreated: true, cropSelected: true, locationAdded: true }));
ok(scanStep.key === 'first_scan' && scanStep.route === '/scan', 'first-scan CTA opens /scan');

// Never throws on junk.
ok(homeNextStep(null) === null && homeNextStep(undefined) === null, 'junk input → null, never throws');

console.log('[test:home-next-step] PASS — ' + passed + ' assertions (onboarding ladder: create farm → add crop → add location → first scan; null when complete; every step carries a reason + confidence; no fabrication).');
