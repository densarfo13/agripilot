#!/usr/bin/env node
/**
 * check-farmer-adoption.mjs — Phase 13 farmer-adoption gate.
 *
 *   node scripts/check-farmer-adoption.mjs
 *
 * Verifies the Phase 13 farmer-adoption runtime is complete:
 *   1. 7 sub-engine files + composite + hook + 3 UI cards exist.
 *   2. Required exports declared on each.
 *   3. ONBOARDING_STEPS covers the 5 canonical steps.
 *   4. DAY_MILESTONES covers day1..day7.
 *   5. NOTIFICATION_KIND covers the 4 spec'd alert kinds.
 *   6. UI cards expose the spec'd testids.
 *   7. App.jsx installs the global during boot.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(__dirname, '..');
const HEADER    = '[check:farmer-adoption]';

function _read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return readFileSync(p, 'utf8'); } catch { return null; }
}
function fail(m, d) {
  console.error(HEADER, 'FAIL —', m);
  if (d) console.error('  ' + d);
  process.exit(1);
}

const FILES = {
  onboarding:   'src/runtime/adoption/onboardingScore.js',
  firstWeek:    'src/runtime/adoption/firstSevenDays.js',
  referral:     'src/runtime/adoption/referralEngine.js',
  weekly:       'src/runtime/adoption/weeklyReport.js',
  community:    'src/runtime/adoption/communityIntelligence.js',
  notifications:'src/runtime/adoption/smartNotifications.js',
  retention:    'src/runtime/adoption/retentionAnalytics.js',
  composite:    'src/runtime/adoption/index.js',
  hook:         'src/hooks/useFarmerAdoption.js',
  onbCard:      'src/components/adoption/OnboardingScoreCard.jsx',
  weekCard:     'src/components/adoption/FirstSevenDaysCard.jsx',
  reportCard:   'src/components/adoption/WeeklyReportCard.jsx',
  app:          'src/App.jsx',
};
const sources = {};
for (const [k, rel] of Object.entries(FILES)) {
  const src = _read(rel);
  if (!src) fail('missing file: ' + rel);
  sources[k] = src;
}

const REQUIRED = [
  { src: 'onboarding',    sym: 'computeOnboardingScore' },
  { src: 'onboarding',    sym: 'ONBOARDING_STEPS' },
  { src: 'firstWeek',     sym: 'computeFirstSevenDays' },
  { src: 'firstWeek',     sym: 'DAY_MILESTONES' },
  { src: 'referral',      sym: 'computeReferralState' },
  { src: 'referral',      sym: 'REFERRAL_BADGES' },
  { src: 'referral',      sym: 'REWARD_KIND' },
  { src: 'weekly',        sym: 'composeWeeklyReport' },
  { src: 'community',     sym: 'computeCommunityIntelligence' },
  { src: 'community',     sym: 'COMMUNITY_CHALLENGE_KIND' },
  { src: 'notifications', sym: 'composeSmartNotifications' },
  { src: 'notifications', sym: 'NOTIFICATION_KIND' },
  { src: 'notifications', sym: 'NOTIFICATION_COOLDOWN_MS' },
  { src: 'retention',     sym: 'computeRetentionAnalytics' },
  { src: 'retention',     sym: 'RETENTION_DAYS' },
  { src: 'composite',     sym: 'farmerAdoption' },
  { src: 'composite',     sym: 'installFarmerAdoptionGlobal' },
  { src: 'composite',     sym: 'FARMER_ADOPTION_VERSION' },
  { src: 'hook',          sym: 'useFarmerAdoption' },
];
for (const { src, sym } of REQUIRED) {
  if (!new RegExp('export\\s+(function|const|async function)\\s+' + sym + '\\b').test(sources[src])
      && !new RegExp('export\\s*\\{[\\s\\S]*\\b' + sym + '\\b').test(sources[src])) {
    fail(FILES[src] + ' missing export: ' + sym);
  }
}

// ONBOARDING_STEPS — 5 canonical steps
const REQUIRED_STEPS = [
  'farmCreated', 'locationAdded', 'cropAdded',
  'firstScan', 'firstTaskCompleted',
];
for (const s of REQUIRED_STEPS) {
  if (!new RegExp(s + '\\s*:').test(sources.onboarding)) {
    fail('ONBOARDING_STEPS missing: ' + s);
  }
}

// DAY_MILESTONES — day1..day7
for (let d = 1; d <= 7; d++) {
  if (!new RegExp('day' + d + '\\s*:').test(sources.firstWeek)) {
    fail('DAY_MILESTONES missing: day' + d);
  }
}

// NOTIFICATION_KIND — 4 spec'd alert kinds
const REQUIRED_NOTIFS = [
  'HIGH_DISEASE_RISK', 'TASK_OVERDUE',
  'RAIN_APPROACHING',  'HARVEST_WINDOW',
];
for (const n of REQUIRED_NOTIFS) {
  if (!new RegExp(n + '\\s*:').test(sources.notifications)) {
    fail('NOTIFICATION_KIND missing: ' + n);
  }
}

// RETENTION_DAYS — D1 / D7 / D30
const REQUIRED_RETENTION = ['D1', 'D7', 'D30'];
for (const r of REQUIRED_RETENTION) {
  if (!new RegExp(r + '\\s*:').test(sources.retention)) {
    fail('RETENTION_DAYS missing: ' + r);
  }
}

// UI testids
const ONB_IDS = ['onboarding-score-card'];
for (const id of ONB_IDS) {
  if (!sources.onbCard.includes(id)) {
    fail('OnboardingScoreCard missing testid: ' + id);
  }
}
const WEEK_IDS = ['first-seven-days-card'];
for (const id of WEEK_IDS) {
  if (!sources.weekCard.includes(id)) {
    fail('FirstSevenDaysCard missing testid: ' + id);
  }
}
const REPORT_IDS = ['weekly-report-card'];
for (const id of REPORT_IDS) {
  if (!sources.reportCard.includes(id)) {
    fail('WeeklyReportCard missing testid: ' + id);
  }
}

// App.jsx installs the global
if (!/installFarmerAdoptionGlobal\s*\(\s*\)/.test(sources.app)) {
  fail('App.jsx does not call installFarmerAdoptionGlobal() during boot');
}

console.log(HEADER, 'PASS — Phase 13 farmer adoption runtime complete.');
console.log('  7 engines + composite + hook + 3 UI cards + install wired.');
console.log('  Onboarding steps: ' + REQUIRED_STEPS.length
  + ' · day milestones: 7 · notification kinds: '
  + REQUIRED_NOTIFS.length + ' · retention buckets: '
  + REQUIRED_RETENTION.length + '.');
process.exit(0);
