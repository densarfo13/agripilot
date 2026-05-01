#!/usr/bin/env node
/**
 * check-mobile-readiness.mjs
 *
 * Go-live guard — asserts the small set of mobile affordances
 * required for App Store submission stays in place across
 * refactors. Catches regressions like:
 *   * deleting the keyboard scroll-margin rule
 *   * removing safe-area-inset-bottom from bottom-nav padding
 *   * dropping the `<input capture="environment">` camera hook
 *   * forgetting to ship the PWA icon set
 *   * removing the service-worker registration
 *
 * Each check below reads ONE file and asserts ONE substring.
 * The script is intentionally simple so it never produces a
 * confusing "what does this mean" failure — every assertion
 * names the user-visible mobile feature it protects.
 *
 *   node scripts/ci/check-mobile-readiness.mjs
 *     → exit 0 when every check passes
 *     → exit 1 with a list of broken checks
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return ''; }
}

function exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); }
  catch { return false; }
}

const checks = [
  {
    name: 'index.css ships keyboard scroll-margin rule',
    why:  'Keeps focused inputs visible above the iOS soft keyboard',
    pass: () => /scroll-margin-bottom\s*:\s*96px/.test(read('src/index.css')),
  },
  {
    name: 'BottomTabNav respects safe-area-inset-bottom',
    why:  'Prevents the iPhone home indicator from overlapping the nav',
    pass: () => /safe-area-inset-bottom/.test(read('src/components/farmer/BottomTabNav.jsx')),
  },
  {
    name: 'ScanCapture exposes capture="environment" camera input',
    why:  'iOS Safari needs this to launch the rear camera in-page',
    pass: () => /capture\s*=\s*["']environment["']/.test(read('src/components/scan/ScanCapture.jsx')),
  },
  {
    name: 'ScanCapture proactively queries camera permission',
    why:  'Lets the gallery-fallback button promote when access is denied',
    pass: () => /navigator\.permissions/.test(read('src/components/scan/ScanCapture.jsx')),
  },
  {
    name: 'main.jsx registers the service worker',
    why:  'PWA install + new-version banner depend on SW registration',
    pass: () => /registerServiceWorker/.test(read('src/main.jsx')),
  },
  {
    name: 'SWUpdateBanner is mounted in App.jsx',
    why:  'Long-running tabs need a "Reload" prompt when a new SW activates',
    pass: () => /<SWUpdateBanner\s*\/>/.test(read('src/App.jsx')),
  },
  {
    name: 'RecoveryErrorBoundary is mounted in main.jsx',
    why:  'Surfaces the 3-button recovery card on render-time exceptions',
    pass: () => /<RecoveryErrorBoundary>/.test(read('src/main.jsx')),
  },
  {
    name: 'BackyardGuard wraps /sell, /opportunities, /funding',
    why:  'Stops backyard users hitting farmer-only commerce via direct URL',
    pass: () => {
      const app = read('src/App.jsx');
      return /<BackyardGuard><Sell\s*\/><\/BackyardGuard>/.test(app)
        && /<BackyardGuard><Opportunities\s*\/><\/BackyardGuard>/.test(app)
        && /<BackyardGuard><FundingHub\s*\/><\/BackyardGuard>/.test(app);
    },
  },
  {
    name: 'PWA icon set is present',
    why:  'Manifest + iOS home-screen need the 192/512/maskable icons',
    pass: () => exists('public/icons/icon-192.png')
             && exists('public/icons/icon-512.png')
             && exists('public/icons/maskable-512.png')
             && exists('public/icons/apple-touch-icon.png'),
  },
  {
    name: 'AuthContext listens for cross-tab storage events',
    why:  'Stops "logout in tab A, refresh tab B" leaving a zombie session',
    pass: () => /addEventListener\(['"]storage['"]/.test(read('src/context/AuthContext.jsx')),
  },
  {
    name: 'marketStore exports sweepExpiredListings',
    why:  'Stale listings must auto-flip ACTIVE→EXPIRED on app boot',
    pass: () => /export function sweepExpiredListings/.test(read('src/market/marketStore.js')),
  },
  {
    name: '/help, /contact, /privacy, /terms are public (outside ProtectedLayout block)',
    why:  'App Store reviewers + footer links must reach legal pages without a session',
    pass: () => {
      const app = read('src/App.jsx');
      // The legal routes appear above the V2ProtectedLayout block opener.
      const idxLayout = app.indexOf('<Route element={<V2ProtectedLayout />}>');
      const idxHelp = app.indexOf('path="/help"');
      const idxPrivacy = app.indexOf('path="/privacy"');
      if (idxLayout < 0 || idxHelp < 0 || idxPrivacy < 0) return false;
      return idxHelp < idxLayout && idxPrivacy < idxLayout;
    },
  },
  {
    name: 'RecoveryErrorBoundary surfaces 4 buttons (Reload, Repair, Restart, Clear)',
    why:  'Spec §19 requires the full recovery menu, not 3 buttons',
    pass: () => {
      const f = read('src/components/system/RecoveryErrorBoundary.jsx');
      return /data-testid="recovery-reload"/.test(f)
          && /data-testid="recovery-repair"/.test(f)
          && /data-testid="recovery-restart"/.test(f)
          && /data-testid="recovery-clear"/.test(f);
    },
  },
  {
    name: 'marketStore exports LISTING_STATUS taxonomy with DRAFT',
    why:  'Spec §10 requires draft / active / interested / contacted / sold / expired',
    pass: () => {
      const f = read('src/market/marketStore.js');
      return /LISTING_STATUS\s*=\s*Object\.freeze/.test(f)
          && /DRAFT:\s*['"]DRAFT['"]/.test(f)
          && /INTERESTED:\s*['"]INTERESTED['"]/.test(f)
          && /CONTACTED:\s*['"]CONTACTED['"]/.test(f);
    },
  },
  {
    name: 'AllSetForTodayCard ships the empty-state',
    why:  'Spec §9 — Home must surface a friendly empty state when no priority',
    pass: () => fs.existsSync(path.join(ROOT, 'src/components/home/AllSetForTodayCard.jsx')),
  },
  {
    name: 'FarmerEntry has per-role redirect map',
    why:  'Spec §1 — buyer/admin/staff/agent each land on the right surface',
    pass: () => {
      const f = read('src/pages/FarmerEntry.jsx');
      return /role === ['"]super_admin['"]/.test(f)
          && /role === ['"]reviewer['"]/.test(f)
          && /role === ['"]agent['"]/.test(f);
    },
  },
  {
    name: 'LanguageSelector filters to supported languages',
    why:  'Spec §15 — never show a language without translations',
    pass: () => /_isLanguageSupported|REQUIRED_KEYS/.test(read('src/components/LanguageSelector.jsx')),
  },
  {
    name: 'multiExperience store exports core actions',
    why:  'Multi-experience: garden + farm coexist; switch never overwrites',
    pass: () => {
      const f = read('src/store/multiExperience.js');
      return /export function getActiveExperience/.test(f)
          && /export function setActiveExperience/.test(f)
          && /export function switchExperience/.test(f)
          && /export function addGarden/.test(f)
          && /export function addFarm/.test(f)
          && /export function removeExperience/.test(f)
          && /SWITCH_EVENT/.test(f);
    },
  },
  {
    name: 'useExperience hook subscribes to switch event',
    why:  'Components must re-render when the user switches between garden + farm',
    pass: () => {
      const f = read('src/hooks/useExperience.js');
      return /SWITCH_EVENT/.test(f) && /addEventListener/.test(f);
    },
  },
  {
    name: 'ExperienceSwitcher mounted in ProtectedLayout',
    why:  'Users with both a garden and a farm need a visible switch control',
    pass: () => {
      const layout = read('src/layouts/ProtectedLayout.jsx');
      return /<ExperienceSwitcher\s*\/>/.test(layout);
    },
  },
  {
    name: 'BottomTabNav reacts to active experience',
    why:  'Switching experience must instantly flip nav between FARM_TABS / BACKYARD_TABS',
    pass: () => /useExperience/.test(read('src/components/farmer/BottomTabNav.jsx')),
  },
  {
    name: 'repairExperience runs at boot',
    why:  'Spec §4 — stale pin / deleted active row must auto-heal',
    pass: () => {
      const ctx = read('src/context/AuthContext.jsx');
      return /repairExperience/.test(ctx)
          && fs.existsSync(path.join(ROOT, 'src/utils/repairExperience.js'));
    },
  },
  {
    name: 'ExperienceSwitcher fires switch toast',
    why:  'Spec §2 — user sees "Switched to Garden/Farm" feedback on switch',
    pass: () => {
      const f = read('src/components/system/ExperienceSwitcher.jsx');
      return /showToast/.test(f) && /experience\.switched/.test(f);
    },
  },
  {
    name: 'ExperienceManageCard surfaces Add Garden / Add Farm CTAs',
    why:  'Spec §2 — single-experience users see the +Add CTA on Home',
    pass: () => fs.existsSync(path.join(ROOT, 'src/components/system/ExperienceManageCard.jsx')),
  },
  {
    name: 'getExperienceLabels helper exists',
    why:  'Spec §9 — single source of truth for backyard \u2194 farm copy split',
    pass: () => {
      const f = read('src/experience/labels.js');
      return /export function getExperienceLabels/.test(f)
          && /BACKYARD_LABELS/.test(f);
    },
  },
  {
    name: 'strictTranslator ships screen-level fallback',
    why:  'Final UI launch §1 \u2014 if any key on a screen is missing, render the whole screen in English',
    pass: () => {
      const f = read('src/i18n/strictTranslator.js');
      return /export function validateScreen/.test(f)
          && /export function useScreenTranslator/.test(f);
    },
  },
  {
    name: 'home.task.remindLater i18n key wired in HomeTaskEnhancer',
    why:  'Final UI launch §3 \u2014 secondary CTA standardised to "Remind me later"',
    pass: () => /home\.task\.remindLater/.test(read('src/components/home/HomeTaskEnhancer.jsx'))
              && /home\.task\.remindLater/.test(read('src/i18n/translations.js')),
  },
  {
    name: 'BottomTabNav uses nav.funding (not nav.opportunities) for the Funding tab',
    why:  'Final UI launch §6 \u2014 nav label keys aligned to spec',
    pass: () => /labelKey:\s*['"]nav\.funding['"]/.test(read('src/components/farmer/BottomTabNav.jsx')),
  },
  {
    name: 'ProfileCompletionPrompt ships the spec copy + progress indicator',
    why:  'Final UI launch §5 \u2014 "Finish setup to get better recommendations" + progress bar',
    pass: () => {
      const f = read('src/components/home/ProfileCompletionPrompt.jsx');
      return /Finish setup/.test(f) && /profile-completion-progress/.test(f);
    },
  },
  {
    name: 'userFeedbackStore exports requestUserFeedback + saveFeedback',
    why:  'Feedback-loop §1, §2 \u2014 quick capture API surface',
    pass: () => {
      const f = read('src/analytics/userFeedbackStore.js');
      return /export function requestUserFeedback/.test(f)
          && /export function saveFeedback/.test(f)
          && /FEEDBACK_OPTIONS/.test(f);
    },
  },
  {
    name: 'feedbackClassifier maps the 6 spec buckets',
    why:  'Feedback-loop §3 \u2014 each option must resolve to a bucket + suggested fix',
    pass: () => {
      const f = read('src/analytics/feedbackClassifier.js');
      return /unclear_priority/.test(f)
          && /scan_visibility/.test(f)
          && /task_overload/.test(f)
          && /unclear_result/.test(f)
          && /low_value/.test(f)
          && /manual_review/.test(f);
    },
  },
  {
    name: 'feedbackPriority computes topIssue + recommendedNextFix',
    why:  'Feedback-loop §6 \u2014 admin sees one fix to do next',
    pass: () => {
      const f = read('src/analytics/feedbackPriority.js');
      return /computeFeedbackPriority/.test(f)
          && /recommendedNextFix/.test(f);
    },
  },
  {
    name: 'UserFeedbackPromptHost mounted in ProtectedLayout',
    why:  'Feedback-loop §1, §8 \u2014 global host enforces session rate-limit + setup-path skip',
    pass: () => {
      const layout = read('src/layouts/ProtectedLayout.jsx');
      return /<UserFeedbackPromptHost\s*\/>/.test(layout);
    },
  },
  {
    name: 'FeedbackDashboard route registered (admin/feedback)',
    why:  'Feedback-loop §4 \u2014 admin must be able to see top issue',
    pass: () => /admin\/feedback/.test(read('src/App.jsx')),
  },
  {
    name: 'requestUserFeedback wired into 5 meaningful actions',
    why:  'Feedback-loop §1 \u2014 onboarding, scan, task, sell, funding',
    pass: () => {
      const files = [
        'src/pages/AdaptiveFarmSetup.jsx',
        'src/components/scan/ScanResultCard.jsx',
        'src/components/home/HomeTaskEnhancer.jsx',
        'src/pages/Sell.jsx',
        'src/components/funding/ApplicationPreviewModal.jsx',
      ];
      return files.every((p) => /requestUserFeedback/.test(read(p)));
    },
  },
  {
    name: 'explicitLogout helper exists',
    why:  'Logout-loop fix \u2014 dedicated marker that beats repair logic',
    pass: () => {
      const f = read('src/utils/explicitLogout.js');
      return /export function markExplicitLogout/.test(f)
          && /export function clearExplicitLogout/.test(f)
          && /export function isExplicitLogout/.test(f);
    },
  },
  {
    name: 'AuthContext bootstrap honors explicit-logout flag',
    why:  'Logout-loop fix \u2014 bootstrap must short-circuit when flag set',
    pass: () => {
      const f = read('src/context/AuthContext.jsx');
      return /isExplicitLogout/.test(f)
          && /markExplicitLogout/.test(f)
          && /clearExplicitLogout/.test(f);
    },
  },
  {
    name: 'repairSession + repairExperience bail on explicit-logout',
    why:  'Logout-loop fix \u2014 repair logic must NOT undo a logout',
    pass: () => {
      const a = read('src/utils/repairSession.js');
      const b = read('src/utils/repairExperience.js');
      return /skipped_explicit_logout/.test(a)
          && /skipped_explicit_logout/.test(b);
    },
  },
  {
    name: 'landUnits ships LAND_SIZE_UNITS + formatLandSize + convertToSquareFeet',
    why:  'Land-size spec \u2014 sq ft option + spec-shape unit list',
    pass: () => {
      const f = read('src/utils/landUnits.js');
      return /LAND_SIZE_UNITS/.test(f)
          && /export function formatLandSize/.test(f)
          && /export function convertToSquareFeet/.test(f)
          && /sq_ft/.test(f);
    },
  },
  {
    name: 'getAllowedUnits offers sqft for US farm + Ghana farm',
    why:  'Land-size spec \u2014 sqft must surface in the unit dropdown',
    pass: () => {
      const f = read('src/lib/units/areaConversion.js');
      return /\['acres',\s*'sqft',\s*'hectares'\]/.test(f)
          && /'acres',\s*'hectares',\s*'sqm',\s*'sqft'/.test(f);
    },
  },
  {
    name: 'ExperienceFallback ships loading + signedOut + recovery branches',
    why:  'Crash-prevention §1 \u2014 dashboard never paints against null user/farm',
    pass: () => {
      const f = read('src/components/system/ExperienceFallback.jsx');
      return /experience-fallback-loading/.test(f)
          && /experience-fallback-loggedout/.test(f)
          && /experience-fallback-recovery/.test(f);
    },
  },
  {
    name: 'ExperienceFallback wraps /dashboard + /my-farm routes',
    why:  'Crash-prevention §1 \u2014 high-traffic surfaces use the safe guard',
    pass: () => {
      const f = read('src/App.jsx');
      return /<ExperienceFallback><V2Dashboard\s*\/><\/ExperienceFallback>/.test(f)
          && /<ExperienceFallback><MyFarmPage\s*\/><\/ExperienceFallback>/.test(f);
    },
  },
  {
    name: 'clearFarrowayCache (aggressive) + clearFarrowayCacheKeepingAuth both export',
    why:  'Crash-prevention §4 \u2014 hard-reset path needed alongside the keep-auth one',
    pass: () => {
      const f = read('src/utils/repairSession.js');
      return /export function clearFarrowayCache\b/.test(f)
          && /export function clearFarrowayCacheKeepingAuth/.test(f);
    },
  },
  {
    name: 'safeNavigateHome helper exists',
    why:  'Crash-prevention §6 \u2014 guarded navigation prevents blank /home',
    pass: () => {
      const f = read('src/utils/safeNavigateHome.js');
      return /export function safeNavigateHome/.test(f)
          && /isExplicitLogout/.test(f)
          && /getActiveExperience/.test(f);
    },
  },
  {
    name: 'landSizeBase ships toLandSizeSqFt + displayLandSize + repair',
    why:  'Land-size base spec \u2014 single canonical sqft, no double conversion',
    pass: () => {
      const f = read('src/lib/units/landSizeBase.js');
      return /export function toLandSizeSqFt/.test(f)
          && /export function fromLandSizeSqFt/.test(f)
          && /export function displayLandSize/.test(f)
          && /export function repairLandSize\b/.test(f)
          && /export function repairLandSizeBase/.test(f);
    },
  },
  {
    name: 'farrowayLocal.saveFarm writes landSizeSqFt + displayUnit',
    why:  'Land-size base spec \u2014 every saved row carries the canonical base',
    pass: () => {
      const f = read('src/store/farrowayLocal.js');
      return /landSizeSqFt:/.test(f)
          && /displayUnit:/.test(f)
          && /toLandSizeSqFt/.test(f);
    },
  },
  {
    name: 'AuthContext bootstrap runs repairLandSizeBase',
    why:  'Land-size base spec \u00a76 \u2014 historical rows must auto-migrate',
    pass: () => /repairLandSizeBase/.test(read('src/context/AuthContext.jsx')),
  },
];

const failed = [];
for (const c of checks) {
  let ok = false;
  try { ok = !!c.pass(); } catch { ok = false; }
  if (ok) {
    process.stdout.write(`\u2713 ${c.name}\n`);
  } else {
    failed.push(c);
    process.stdout.write(`\u2717 ${c.name}\n    why: ${c.why}\n`);
  }
}

if (failed.length) {
  process.stderr.write(`\nmobile-readiness: ${failed.length} check(s) failed.\n`);
  process.exit(1);
}
process.stdout.write(`\n\u2713 mobile-readiness: ${checks.length} checks passed.\n`);
