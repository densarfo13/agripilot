/**
 * check-home-next-step.mjs — Daily Decision §2 onboarding ladder.
 * Locks: the ladder composes the existing FarmerCompletion engine (no duplicate
 * decision logic), returns null when complete (defers to the live hero), every step
 * carries a reason, the card uses farmer-facing copy (no backend/provider terms), and
 * Home consumes it. Runs the pure test.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const R = process.cwd();
const E = [];
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const has = (s, n, m) => { if (!s.includes(n)) E.push(m); };

const LADDER = 'src/components/home/homeNextStep.js';
const CARD = 'src/components/home/HomeNextStepCard.jsx';
const TEST = 'src/components/home/__tests__/homeNextStep.test.js';
const CROP_RESOLVER = 'src/components/home/resolveCompletionCrop.js';
const CROP_TEST = 'src/components/home/__tests__/resolveCompletionCrop.test.js';
for (const f of [LADDER, CARD, TEST, CROP_RESOLVER, CROP_TEST]) if (!fs.existsSync(path.join(R, f))) E.push('missing: ' + f);

// Stale-"Add your crop" fix — the resolver must recognize every crop field the app
// uses, and Home must consume it (not the old crop||cropId-only check).
const cropResolver = rd(CROP_RESOLVER);
for (const field of ['cropName', 'cropType', 'cropDisplayName', 'cropId'])
  has(cropResolver, field, 'resolveCompletionCrop must recognize farm.' + field);

const ladder = rd(LADDER);
for (const k of ['create_farm', 'add_crop', 'add_location', 'first_scan'])
  has(ladder, k, 'ladder must define step ' + k);
has(ladder, 'export function homeNextStep', 'must export homeNextStep');
has(ladder, 'reasonFallback', 'every step must carry a reason (decisions are never bare)');
if (!/return null/.test(ladder)) E.push('ladder must return null when the farm is complete (defer to the live hero)');

// Card: farmer-facing copy only, no backend/provider terms, 44px target.
const card = rd(CARD);
has(card, 'tSafe', 'card must use tSafe (localizable)');
has(card, "'Recommended'", "card must use farmer-facing 'Recommended' (not a confidence enum)");
if (!/minHeight:\s*44/.test(card)) E.push('card CTA must meet the 44px touch target');
for (const bad of ['FarmBrain', 'provider', 'model', 'evidence tier', 'API ']) {
  if (card.includes(bad)) E.push('card must NOT expose the backend term "' + bad.trim() + '" to farmers');
}

// Home composes the existing FarmerCompletion engine + renders the card.
const home = rd('src/pages/Home.jsx');
has(home, 'buildFarmerCompletion', 'Home must compose the existing FarmerCompletion engine (no duplicate decision logic)');
has(home, 'resolveCompletionCrop', 'Home must resolve the crop via resolveCompletionCrop (fixes stale "Add your crop")');
if (/crop:\s*local\.farm\?\.crop\s*\|\|\s*local\.farm\?\.cropId\s*\|\|\s*''/.test(home))
  E.push('Home still uses the incomplete crop||cropId check — must use resolveCompletionCrop (misses cropName/cropType)');
has(home, 'homeNextStep', 'Home must derive the onboarding step');
has(home, 'HomeNextStepCard', 'Home must render the onboarding ladder card');

if (E.length === 0) {
  for (const t of [TEST, CROP_TEST]) {
    try {
      const out = execSync('npx tsx ' + t, { cwd: R, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      if (!/PASS/.test(out)) E.push(t + ' did not PASS: ' + out.trim());
    } catch (err) { E.push(t + ' failed: ' + ((err && (err.stdout || err.message)) || '?')); }
  }
}

if (E.length) {
  console.error('[check:home-next-step] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:home-next-step] PASS — onboarding ladder composes FarmerCompletion (no duplicate logic); '
  + 'defers to the live hero when complete; every step carries a reason; farmer-facing copy only; Home wired; test green.');
