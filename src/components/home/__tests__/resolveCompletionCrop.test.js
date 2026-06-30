/**
 * resolveCompletionCrop.test.js — locks the stale-"Add your crop" bug fix.
 * Self-running: `tsx resolveCompletionCrop.test.js`.
 *
 * Bug: the Home onboarding ladder read only farm.crop || farm.cropId, so a farm whose
 * crop is stored under cropName / cropType / cropDisplayName reported "no crop" and
 * Home kept showing "Add your crop" even though a crop existed.
 */
import { resolveCompletionCrop } from '../resolveCompletionCrop.js';
import { homeNextStep } from '../homeNextStep.js';
import { buildFarmerCompletion } from '../../../runtime/farmerCompletion/FarmerCompletionEngine.ts';

let passed = 0;
function ok(c, m) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// ── Every crop field the app uses is recognized ─────────────────────
ok(resolveCompletionCrop({ cropName: 'Onion' }) === 'Onion', 'cropName is recognized');
ok(resolveCompletionCrop({ cropType: 'Maize' }) === 'Maize', 'cropType is recognized');
ok(resolveCompletionCrop({ cropDisplayName: 'Tomato' }) === 'Tomato', 'cropDisplayName is recognized');
ok(resolveCompletionCrop({ crop: 'Yam' }) === 'Yam', 'crop is recognized');
ok(resolveCompletionCrop({ cropId: 'cassava' }) === 'cassava', 'cropId is recognized');

// ── No crop → empty (so the ladder correctly asks to add one) ───────
ok(resolveCompletionCrop({}) === '', 'no crop field → empty');
ok(resolveCompletionCrop({ cropName: '   ' }) === '', 'whitespace-only → empty');
ok(resolveCompletionCrop(null) === '' && resolveCompletionCrop(undefined) === '', 'junk → empty, never throws');

// ── THE FIX: a farm with crop under cropName no longer shows "Add your crop" ──
const farmWithCropName = { farmExists: true, cropName: 'Onion', location: '', plantingDate: '', scanHistory: [] };
const completion = buildFarmerCompletion({
  farmExists: true,
  crop: resolveCompletionCrop(farmWithCropName),   // the wiring under test
  location: '', plantingDate: '', scanHistory: [],
});
const step = homeNextStep(completion);
ok(step && step.key !== 'add_crop', 'crop under cropName → ladder does NOT show add_crop');
ok(step && step.key === 'add_location', 'crop under cropName → ladder advances to add_location');

// Before the fix this returned '' (crop+cropId only), proving the regression is real:
ok((farmWithCropName.crop || farmWithCropName.cropId || '') === '', 'old logic (crop||cropId) missed cropName — bug confirmed');

console.log('[test:resolve-completion-crop] PASS — ' + passed + ' assertions. Crop is recognized under '
  + 'cropName/crop/cropType/cropDisplayName/cropId; missing → empty; a crop under cropName no longer '
  + 'triggers a stale "Add your crop".');
