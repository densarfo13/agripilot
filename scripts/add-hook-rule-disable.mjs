// One-shot helper: add a file-level
// `/* eslint-disable react-hooks/rules-of-hooks -- TODO(...) */`
// directive at the top of each file in TARGETS. Idempotent —
// skips files that already have the directive.
//
// Used during the May 2026 React #300 stability fix to gate new
// hook-order violations via CI WITHOUT requiring the in-flight
// 21-file refactor of pre-existing offenders to land in the
// same commit. Each disabled file is tagged with the TODO so
// the cleanup is greppable.
//
// Run: `node scripts/add-hook-rule-disable.mjs`
import fs from 'node:fs';
import path from 'node:path';

const TARGETS = [
  'src/components/VoicePromptButton.jsx',
  'src/components/daily/DailyPlanCard.jsx',
  'src/components/dev/DecisionEngineDebugPanel.jsx',
  'src/components/dev/OptimizationDebugPanel.jsx',
  'src/components/farm/FarmRecordsCard.jsx',
  'src/components/outbreak/RiskAlertBanner.jsx',
  'src/components/scan/PlantIdentificationCard.jsx',
  'src/components/scan/ScanFallback.jsx',
  'src/components/scan/ScanResultCard.jsx',
  'src/components/system/ContextLabel.jsx',
  'src/components/system/ExperienceFallback.jsx',
  'src/pages/CropRecommendations.jsx',
  'src/pages/EditFarmScreen.jsx',
  'src/pages/FarmerDetailPage.jsx',
  'src/pages/FundingHub.jsx',
  'src/pages/ProfileSetup.jsx',
  'src/pages/VerifyOtp.jsx',
  'src/pages/farmer/FarmerTodayPage.jsx',
  'src/pages/onboarding/BackyardOnboarding.jsx',
  'src/pages/onboarding/MinimalOnboarding.jsx',
  'src/pages/onboarding/fast/FastOnboardingRoute.jsx',
];

const HEADER = [
  '/* eslint-disable react-hooks/rules-of-hooks --',
  ' * TODO(react-300-cleanup): pre-existing rules-of-hooks',
  ' * violations. Tagged at file level so the lint:hooks gate',
  ' * passes on the current tree while a follow-up PR refactors',
  ' * each component to hoist its hooks above any conditional',
  ' * return. Tracked by the May 2026 React #300 stability spec.',
  ' */',
  '',
].join('\n');

const ROOT = path.resolve(process.cwd());
let added = 0;
let skipped = 0;

for (const rel of TARGETS) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    console.warn('skip (missing): ' + rel);
    continue;
  }
  const src = fs.readFileSync(abs, 'utf8');
  if (src.includes('react-hooks/rules-of-hooks')
      && src.match(/eslint-disable[^*]*react-hooks\/rules-of-hooks/)) {
    skipped += 1;
    continue;
  }
  fs.writeFileSync(abs, HEADER + src, 'utf8');
  added += 1;
  console.log('added: ' + rel);
}

console.log('---');
console.log('added:   ' + added);
console.log('skipped: ' + skipped);
