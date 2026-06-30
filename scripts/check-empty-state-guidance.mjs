/**
 * check-empty-state-guidance.mjs — sprint #212 §11.
 * Fails build if a farmer empty state renders without a CTA / guidance.
 * Verifies the guided-state surfaces (Home below-fold setup card +
 * Activity guided journey) + the engine that backs them.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const errors = [];
const _read = (r) => { try { return fs.readFileSync(path.join(ROOT, r), 'utf8'); } catch { return ''; } };
const _has = (s, n, m) => { if (!s.includes(n)) errors.push(m); };

// Home below-fold renders ONE consolidated Farm Readiness card (progress % + next-step CTA +
// confidence/quality detail behind a disclosure). Consolidated from the former 3 stacked cards.
const BF = _read('src/components/farmBrain/FarmBrainBelowFold.jsx');
_has(BF, 'farm-readiness-card', 'Home below-fold must render the consolidated Farm Readiness card');
_has(BF, 'farm-readiness-next', 'Farm Readiness card must render the next-step CTA');
_has(BF, 'farm-readiness-details', 'Farm Readiness card must keep confidence/quality detail behind a disclosure');

// FarmTimeline engine always carries an empty-state story + CTA.
const TLE = _read('src/runtime/farmTimeline/FarmTimelineEngine.ts');
_has(TLE, 'storyKey', 'FarmTimelineEngine must carry an empty-state storyKey');
_has(TLE, 'ctaKey', 'FarmTimelineEngine must carry an empty-state ctaKey');

// The escaped guidance keys are now registered (translatable).
const TEN = _read('src/i18n/columns/T-en.js');
for (const k of ['farmTimeline.story', 'farmTimeline.cta.firstScan',
  'farm.setup.title', 'farm.setup.continue', 'activity.empty.title']) {
  if (!TEN.includes('"' + k + '"')) errors.push('T-en.js missing guidance key: ' + k);
}

if (errors.length) { console.error('[check:empty-state-guidance] FAIL'); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log('[check:empty-state-guidance] PASS — empty states carry CTA + guidance.');
