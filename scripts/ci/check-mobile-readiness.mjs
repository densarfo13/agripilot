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
  {
    name: 'MyFarmPage adapts header + buttons to backyard farmType',
    why:  'Safe-launch backyard-as-farm-type \u00a72, \u00a75 \u2014 garden vs farm labels',
    pass: () => {
      const f = read('src/pages/MyFarmPage.jsx');
      return /isBackyardActive/.test(f)
          && /myFarm\.editGarden/.test(f)
          && /myFarm\.addGarden/.test(f)
          && /myFarm\.switchToFarm/.test(f);
    },
  },
  {
    name: 'getActiveExperience derives from active farm farmType',
    why:  'Safe-launch backyard-as-farm-type \u00a78 \u2014 activeFarm.farmType drives experience surface',
    pass: () => {
      const f = read('src/store/multiExperience.js');
      return /_readLegacyActiveFarm/.test(f)
          && /farroway_active_farm/.test(f)
          && /isBackyard \?\s*EXPERIENCE\.GARDEN|isBackyard\s*&&\s*gardens\.length/.test(f);
    },
  },
  {
    name: 'migrateLegacyFarms ships dual-store split + backup + sentinel',
    why:  'Multi-role architecture \u00a72 \u2014 first-class gardens + farms arrays',
    pass: () => {
      const f = read('src/utils/migrateLegacyFarms.js');
      return /export function migrateLegacyFarms/.test(f)
          && /farroway_legacy_farms_backup/.test(f)
          && /farroway_full_architecture_migrated/.test(f)
          && /farroway_gardens/.test(f)
          && /farroway_farms/.test(f);
    },
  },
  {
    name: 'activeContext resolver covers grower + non-grower roles',
    why:  'Multi-role architecture \u00a73 \u2014 single resolver across every role',
    pass: () => {
      const f = read('src/core/activeContext.js');
      return /export function getActiveContext/.test(f)
          && /NON_GROWER_ROLE_TO_EXPERIENCE/.test(f)
          && /buyer/.test(f)
          && /ngo_admin/.test(f)
          && /platform_admin/.test(f);
    },
  },
  {
    name: 'repairActiveContext orchestrates migrate + repair + landsize',
    why:  'Multi-role architecture \u00a714 \u2014 single boot-time entry',
    pass: () => {
      const f = read('src/utils/repairActiveContext.js');
      return /migrateLegacyFarms/.test(f)
          && /repairExperience/.test(f)
          && /repairLandSizeBase/.test(f);
    },
  },
  {
    name: 'AuthContext bootstrap calls repairActiveContext',
    why:  'Multi-role architecture \u00a74 \u2014 single boot-time chain replaces ad-hoc calls',
    pass: () => /repairActiveContext/.test(read('src/context/AuthContext.jsx')),
  },
  {
    name: 'farrowayLocal dual-writes new gardens/farms arrays after migration',
    why:  'Multi-role architecture \u2014 new writes mirror to first-class arrays',
    pass: () => {
      const f = read('src/store/farrowayLocal.js');
      return /_dualWriteToNewArrays/.test(f)
          && /farroway_full_architecture_migrated/.test(f);
    },
  },
  {
    name: 'BuyerBottomNav + NgoBottomNav exist + mounted',
    why:  'Architecture audit \u00a77 \u2014 buyer + NGO get a mobile bottom nav by role',
    pass: () => {
      const layout = read('src/layouts/ProtectedLayout.jsx');
      return fs.existsSync(path.join(ROOT, 'src/components/buyer/BuyerBottomNav.jsx'))
          && fs.existsSync(path.join(ROOT, 'src/components/admin/NgoBottomNav.jsx'))
          && /<BuyerBottomNav\s*\/>/.test(layout)
          && /<NgoBottomNav\s*\/>/.test(layout);
    },
  },
  {
    name: 'PrivacyPolicy mentions marketplace + localStorage + data rights',
    why:  'Architecture audit \u00a719 \u2014 App Store reviewer checklist',
    pass: () => {
      const f = read('src/pages/PrivacyPolicy.jsx');
      return /marketplace contact handling/i.test(f)
          && /localStorage/.test(f)
          && /support@farroway\.app/.test(f);
    },
  },
  {
    name: 'useScreenTranslator wired into at least one canonical home surface',
    why:  'Architecture audit \u00a717 \u2014 per-screen language gate has a real consumer',
    pass: () => {
      const f = read('src/components/home/AllSetForTodayCard.jsx');
      return /useScreenTranslator/.test(f);
    },
  },
  {
    name: 'Buyer empty-state uses spec sentence',
    why:  'Architecture audit \u00a715 \u2014 "No produce nearby yet. We\u2019ll notify you when listings are available."',
    pass: () => {
      // The translation source file stores curly-apostrophe as
      // the literal `\u2019` escape sequence, so we match that
      // form here rather than the decoded unicode glyph.
      const f = read('src/i18n/translations.js');
      return /No produce nearby yet\. We\\u2019ll notify you when listings are available\./
        .test(f);
    },
  },
  {
    name: 'Backend /health returns spec shape (status + db + uptime + timestamp)',
    why:  'Production infra \u00a71 \u2014 load balancer needs uptime + db keys',
    pass: () => {
      const f = read('server/src/app.js');
      return /app\.get\(['"]\/health['"]/.test(f)
          && /uptime/.test(f)
          && /db:\s*dbStatus/.test(f);
    },
  },
  {
    name: 'Backend ships scan + funding + sell rate limiters',
    why:  'Production infra \u00a72 \u2014 protect cost-sensitive paths',
    pass: () => {
      const f = read('server/src/app.js');
      return /scanLimiter/.test(f)
          && /fundingLimiter/.test(f)
          && /sellLimiter/.test(f);
    },
  },
  {
    name: 'Marketplace tables index region + createdAt',
    why:  'Production infra \u00a73 \u2014 query times bounded as we scale',
    pass: () => {
      const f = read('server/prisma/schema.prisma');
      return /idx_produce_listings_region/.test(f)
          && /idx_buyer_requests_region/.test(f)
          && /idx_buyer_requests_created/.test(f)
          && /idx_marketplace_payments_created/.test(f);
    },
  },
  {
    name: 'export-data backup script exists',
    why:  'Production infra \u00a78 \u2014 daily snapshot of launch-critical tables',
    pass: () => {
      return fs.existsSync(path.join(ROOT, 'scripts/ops/export-data.mjs'));
    },
  },
  {
    name: 'Queue ships SCAN_JOBS + SYNC_JOBS names',
    why:  'Early-scale infra \u00a72 \u2014 background queue covers scan + sync',
    pass: () => {
      const f = read('server/src/queue/queueClient.js');
      return /SCAN_JOBS:\s*['"]scan_jobs['"]/.test(f)
          && /SYNC_JOBS:\s*['"]sync_jobs['"]/.test(f);
    },
  },
  {
    name: 'Rate limiters use Redis store when REDIS_URL is set',
    why:  'Early-scale infra \u00a77 \u2014 caps consistent across replicas',
    pass: () => {
      const f = read('server/src/app.js');
      return /rate-limit-redis/.test(f)
          && /_rateLimitStoreFactory/.test(f)
          && /store: _rlStore\(['"]auth['"]\)/.test(f);
    },
  },
  {
    name: 'Analytics-light service ships the 8 spec events',
    why:  'Early-scale infra \u00a76 \u2014 launch-critical event taxonomy',
    pass: () => {
      const f = read('server/src/services/analytics/earlyScaleAnalytics.js');
      return /INSTALL/.test(f)
          && /FIRST_ACTION/.test(f)
          && /HOME_VIEW/.test(f)
          && /TASK_COMPLETED/.test(f)
          && /SCAN_USED/.test(f)
          && /LISTING_CREATED/.test(f)
          && /BUYER_INTEREST/.test(f)
          && /DAY2_RETURN/.test(f);
    },
  },
  {
    name: 'env validation lists REDIS_URL + AUTH_SECRET as required',
    why:  'Early-scale infra \u00a78 \u2014 Redis is non-optional at this tier',
    pass: () => {
      const f = read('scripts/ci/check-env-assertions.mjs');
      return /REDIS_URL/.test(f)
          && /AUTH_SECRET/.test(f)
          && /SCAN_API_KEY/.test(f)
          && /ANALYTICS_KEY/.test(f);
    },
  },
  {
    name: 'isOnboardingComplete reads BOTH _done and _completed keys',
    why:  'Onboarding-loop fix v2 \u2014 save handlers + repairSession stamp _completed; legacy helper read _done',
    pass: () => {
      const f = read('src/utils/onboarding.js');
      return /ONBOARDING_DONE_KEY/.test(f)
          && /ONBOARDING_COMPLETED_KEY/.test(f)
          && /export function shouldShowSetup/.test(f);
    },
  },
  {
    name: 'ProfileGuard uses shouldShowSetup (covers \u00a76 fallback)',
    why:  'Onboarding-loop fix v2 \u2014 flag-true-but-no-entity routes back to setup',
    pass: () => /shouldShowSetup\(\)/.test(read('src/components/ProfileGuard.jsx')),
  },
  {
    name: 'narrowRepairActivePointers exported from multiExperience',
    why:  'No-crash fix \u00a76 \u2014 Repair Session button clears only 3 pointer keys',
    pass: () => {
      const f = read('src/store/multiExperience.js');
      return /export function narrowRepairActivePointers/.test(f)
          && /experience_derived_garden/.test(f)
          && /experience_derived_farm/.test(f);
    },
  },
  {
    name: 'ExperienceFallback auto-repairs + redirects to setup',
    why:  'No-crash fix \u00a73, \u00a75 \u2014 never paint the recovery card on first miss',
    pass: () => {
      const f = read('src/components/system/ExperienceFallback.jsx');
      return /narrowRepairActivePointers/.test(f)
          && /<Navigate to="\/onboarding\/simple"/.test(f)
          && /experience_fallback_auto_repair/.test(f);
    },
  },
  {
    name: 'scanHistory carries gardenId + farmId + isolation helper',
    why:  'Scan engine \u00a710 \u2014 garden + farm scan histories must never cross-contaminate',
    pass: () => {
      const f = read('src/data/scanHistory.js');
      return /gardenId:\s*context\.gardenId/.test(f)
          && /export function getScansForActiveContext/.test(f);
    },
  },
  {
    name: 'scanToTask attaches gardenId/farmId + dedupes same-day duplicates',
    why:  'Scan engine \u00a79 \u2014 tasks isolated per active context; no daily duplicates',
    pass: () => {
      const f = read('src/core/scanToTask.js');
      return /gardenId:\s*context\.gardenId/.test(f)
          && /existing\.has/.test(f)
          && /todayKey/.test(f);
    },
  },
  {
    name: 'ScanPage attaches scans to active experience id',
    why:  'Scan engine \u00a72 \u2014 gardenId when garden active, farmId when farm active',
    pass: () => {
      const f = read('src/pages/ScanPage.jsx');
      return /useExperience/.test(f)
          && /activeGardenId/.test(f)
          && /activeFarmId/.test(f)
          && /isGarden\s*\?/.test(f);
    },
  },
  {
    name: 'hybridScanEngine ships safe taxonomy + context rules + disclaimer',
    why:  'Hybrid scan spec \u2014 image + weather + experience refinement',
    pass: () => {
      const f = read('src/core/hybridScanEngine.js');
      return /export function hybridAnalyze/.test(f)
          && /POSSIBLE_FUNGAL_STRESS/.test(f)
          && /POSSIBLE_WATER_STRESS/.test(f)
          && /POSSIBLE_PEST_DAMAGE/.test(f)
          && /Farroway provides guidance/.test(f);
    },
  },
  {
    name: 'ScanPage applies hybrid refinement after analyzeScan',
    why:  'Hybrid scan spec \u2014 image-only verdict gets context layered on it',
    pass: () => {
      const f = read('src/pages/ScanPage.jsx');
      return /hybridAnalyze/.test(f)
          && /scan_hybrid_applied/.test(f);
    },
  },
  {
    name: 'Backend ML pipeline ships preprocess + inference + fusion + safety',
    why:  'Advanced ML scan layer \u2014 4-stage server pipeline before user sees a verdict',
    pass: () => {
      return fs.existsSync(path.join(ROOT, 'server/src/ml/preprocessImage.js'))
          && fs.existsSync(path.join(ROOT, 'server/src/ml/scanInferenceService.js'))
          && fs.existsSync(path.join(ROOT, 'server/src/ml/contextFusionEngine.js'))
          && fs.existsSync(path.join(ROOT, 'server/src/ml/scanSafetyFilter.js'));
    },
  },
  {
    name: '/api/scan/analyze + /api/scan/feedback endpoints registered',
    why:  'Advanced ML scan layer \u00a712 + \u00a79 \u2014 frontend integration points',
    pass: () => {
      const f = read('server/src/app.js');
      return /\/api\/scan\/analyze/.test(f)
          && /\/api\/scan\/feedback/.test(f);
    },
  },
  {
    name: 'ScanTrainingEvent Prisma model + migration shipped',
    why:  'Advanced ML scan layer \u00a710 \u2014 training-data foundation',
    pass: () => {
      const schema = read('server/prisma/schema.prisma');
      return /model ScanTrainingEvent/.test(schema)
          && fs.existsSync(path.join(ROOT, 'server/prisma/migrations/20260501_scan_training_events/migration.sql'));
    },
  },
  {
    name: 'ScanFeedbackPrompt mounted under scan result',
    why:  'Advanced ML scan layer \u00a79 \u2014 "Was this helpful?" UX',
    pass: () => {
      const page = read('src/pages/ScanPage.jsx');
      return fs.existsSync(path.join(ROOT, 'src/components/scan/ScanFeedbackPrompt.jsx'))
          && /<ScanFeedbackPrompt\s+scanId=/.test(page);
    },
  },
  {
    name: 'scanSafetyFilter strips unsafe language + appends disclaimer',
    why:  'Advanced ML scan layer \u00a78 \u2014 no "confirmed disease" / dosage leaks',
    pass: () => {
      const f = read('server/src/ml/scanSafetyFilter.js');
      return /UNSAFE_PHRASES/.test(f)
          && /DOSAGE_PATTERN/.test(f)
          && /Farroway provides guidance/.test(f);
    },
  },
  {
    name: 'scanProviders registry ships plantnet + plantix + cropsense + generic',
    why:  'ML risk fix \u2014 swap providers via SCAN_PROVIDER_PROFILE without code changes',
    pass: () => {
      const f = read('server/src/ml/scanProviders.js');
      return /name:\s*['"]plantnet['"]/.test(f)
          && /name:\s*['"]plantix['"]/.test(f)
          && /name:\s*['"]cropsense['"]/.test(f)
          && /name:\s*['"]generic['"]/.test(f)
          && /export function pickProvider/.test(f);
    },
  },
  {
    name: 'pruneScanTrainingEvents retention sweep + admin trigger + cron hook',
    why:  'ML risk fix \u2014 ScanTrainingEvent ledger bounded at 100k; high-value rows preserved',
    pass: () => {
      const sweep = read('server/src/ml/pruneScanTrainingEvents.js');
      const app   = read('server/src/app.js');
      const cron  = read('server/src/queue/farmProcessingCron.js');
      return /export async function pruneScanTrainingEvents/.test(sweep)
          && /\/api\/ops\/scan-training\/prune/.test(app)
          && /pruneScanTrainingEvents/.test(cron);
    },
  },
  {
    name: 'ops/health reports ML preprocess + provider status',
    why:  'ML risk fix \u2014 admin can see at a glance whether sharp + provider are wired',
    pass: () => {
      const f = read('server/src/app.js');
      return /imagePreprocessing/.test(f)
          && /scanProviderStatus/.test(f)
          && /scanTrainingEvents/.test(f);
    },
  },
  {
    name: 'confidenceTiers ships numeric thresholds + tierPolicy',
    why:  'High-confidence ML \u00a71 \u2014 0.85/0.60 thresholds drive output rules',
    pass: () => {
      const f = read('server/src/ml/confidenceTiers.js');
      return /HIGH:\s*0\.85/.test(f)
          && /MEDIUM:\s*0\.60/.test(f)
          && /export function tierPolicy/.test(f)
          && /export function downgrade/.test(f);
    },
  },
  {
    name: 'verificationQuestions returns 2\u20133 yes/no checks per issue',
    why:  'High-confidence ML \u00a72 \u2014 verify before naming a specific condition',
    pass: () => {
      const f = read('server/src/ml/verificationQuestions.js');
      return /export function verificationQuestions/.test(f)
          && /export function scoreVerification/.test(f)
          && /Possible fungal stress/.test(f)
          && /Possible water stress/.test(f);
    },
  },
  {
    name: 'scanSafetyFilter rewrites to treatment-class language',
    why:  'High-confidence ML \u00a74 \u2014 no exact products / dosages',
    pass: () => {
      const f = read('server/src/ml/scanSafetyFilter.js');
      return /TREATMENT_CLASS_REWRITES/.test(f)
          && /locally approved fungicide/i.test(f)
          && /locally approved insecticide/i.test(f);
    },
  },
  {
    name: 'ScanVerificationChecklist + ScanLocalExpertCTA mounted',
    why:  'High-confidence ML \u00a72 + \u00a75 \u2014 user-facing UX',
    pass: () => {
      const page = read('src/pages/ScanPage.jsx');
      return fs.existsSync(path.join(ROOT, 'src/components/scan/ScanVerificationChecklist.jsx'))
          && fs.existsSync(path.join(ROOT, 'src/components/scan/ScanLocalExpertCTA.jsx'))
          && /<ScanVerificationChecklist/.test(page)
          && /<ScanLocalExpertCTA/.test(page);
    },
  },
  {
    name: 'ScanTrainingEvent extended with verification + outcome',
    why:  'High-confidence ML \u00a76 \u2014 data foundation for future training',
    pass: () => {
      const schema = read('server/prisma/schema.prisma');
      return /verificationAnswers/.test(schema)
          && /verificationDowngrade/.test(schema)
          && /outcome\s+String/.test(schema)
          && fs.existsSync(path.join(ROOT, 'server/prisma/migrations/20260501_scan_verification_outcome/migration.sql'));
    },
  },
  {
    name: '/api/scan/analyze returns tierPolicy + verificationQuestions',
    why:  'High-confidence ML \u00a71 + \u00a72 \u2014 frontend has what it needs to gate naming',
    pass: () => {
      const f = read('server/src/app.js');
      return /tierPolicy/.test(f)
          && /verificationQuestions/.test(f);
    },
  },
  {
    name: 'ScanHero mounted on Home above the fold',
    why:  'Retention spec \u00a71 \u2014 scan CTA anchors the daily-habit loop',
    pass: () => {
      return fs.existsSync(path.join(ROOT, 'src/components/home/ScanHero.jsx'))
          && /<ScanHero\s*\/>/.test(read('src/pages/FarmerOverviewTab.jsx'));
    },
  },
  {
    name: 'TaskCompletionToast mounted in HomeTaskEnhancer',
    why:  'Retention spec \u00a77 \u2014 celebratory feedback after Mark as done',
    pass: () => {
      const enh = read('src/components/home/HomeTaskEnhancer.jsx');
      return fs.existsSync(path.join(ROOT, 'src/components/tasks/TaskCompletionToast.jsx'))
          && /<TaskCompletionToast/.test(enh)
          && /completionToast/.test(enh);
    },
  },
  {
    name: 'ScanPage 2s fallback timer surfaces rule-based result',
    why:  'Retention spec \u00a72 + \u00a712 \u2014 result must appear under 2s',
    pass: () => {
      const f = read('src/pages/ScanPage.jsx');
      return /fallback_2s_timer/.test(f)
          && /scan_fallback_used/.test(f);
    },
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
