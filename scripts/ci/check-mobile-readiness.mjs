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
    // Production-hardening spec \u00a75 superseded the legacy
    // 4-button menu. The new layout collapses Reload / Repair /
    // Restart / Clear cache down to 3 user-friendly actions:
    // Try again / Fix setup issue / Restart setup.
    name: 'RecoveryErrorBoundary surfaces 3 buttons (Try again, Fix setup, Restart)',
    why:  'Production-hardening spec \u00a75 \u2014 collapsed recovery menu',
    pass: () => {
      const f = read('src/components/system/RecoveryErrorBoundary.jsx');
      return /data-testid="recovery-try-again"/.test(f)
          && /data-testid="recovery-fix-setup"/.test(f)
          && /data-testid="recovery-restart"/.test(f);
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
  {
    name: 'QuickGardenSetup ships 2 required fields + optional size',
    why:  'Optimized setup spec \u00a73 \u2014 garden onboarding under 30s',
    pass: () => {
      const f = read('src/pages/setup/QuickGardenSetup.jsx');
      const app = read('src/App.jsx');
      return /quick-garden-plant/.test(f)
          && /quick-garden-country/.test(f)
          && /SIZE_OPTIONS/.test(f)
          && /addGarden/.test(f)
          && /setOnboardingComplete/.test(f)
          && /\/setup\/garden/.test(app);
    },
  },
  {
    name: 'QuickFarmSetup ships 4 fields with regional unit default',
    why:  'Optimized setup spec \u00a74 \u2014 farm onboarding under 45s',
    pass: () => {
      const f = read('src/pages/setup/QuickFarmSetup.jsx');
      const app = read('src/App.jsx');
      return /quick-farm-crop/.test(f)
          && /quick-farm-country/.test(f)
          && /quick-farm-size/.test(f)
          && /quick-farm-unit/.test(f)
          && /getDefaultUnit/.test(f)
          && /addFarm/.test(f)
          && /setOnboardingComplete/.test(f)
          && /\/setup\/farm/.test(app);
    },
  },
  {
    name: 'landIntelligenceEngine ships scale + risk + scan-adjustment',
    why:  'Land intelligence spec \u00a72-\u00a76 \u2014 scale + risk + action enrichment',
    pass: () => {
      const f = read('src/core/landIntelligenceEngine.js');
      return /export function getScaleType/.test(f)
          && /export function getRiskProfile/.test(f)
          && /export function getScanContextAdjustment/.test(f)
          && /export function enrichActions/.test(f)
          && /export function landIntelligenceEngine/.test(f);
    },
  },
  {
    name: 'hybridScanEngine + ScanPage thread sizeSqFt into Land Intelligence',
    why:  'Land intelligence spec \u00a77 \u2014 scan results adapt to scale',
    pass: () => {
      const hybrid = read('src/core/hybridScanEngine.js');
      const scan   = read('src/pages/ScanPage.jsx');
      return /landIntelligenceEngine/.test(hybrid)
          && /scanContextAdjustment/.test(hybrid)
          && /sizeSqFt:\s*profile\?\.landSizeSqFt/.test(scan);
    },
  },
  {
    name: 'dailyIntelligenceEngine consumes Land Intelligence for daily plan',
    why:  'Land intelligence spec \u00a77 \u2014 task generator adapts to scale + risk profile',
    pass: () => {
      const f = read('src/core/dailyIntelligenceEngine.js');
      return /landIntelligenceEngine/.test(f)
          && /source:\s*['"]land_intel['"]/.test(f)
          && /scaleType:\s*land\.scaleType/.test(f);
    },
  },
  {
    name: 'treatmentEngine maps issue \u2192 category + safe chemical guidance',
    why:  'Treatment engine spec \u00a72\u2013\u00a74 \u2014 class-only guidance, no exact dosage',
    pass: () => {
      const f = read('src/core/treatmentEngine.js');
      return /export function recommendTreatment/.test(f)
          && /ISSUE_TO_CATEGORY/.test(f)
          && /locally approved fungicide/.test(f)
          && /locally approved pest-control/.test(f)
          && /Farroway provides guidance/.test(f);
    },
  },
  {
    name: 'TreatmentGuidanceCard mounted under scan result',
    why:  'Treatment engine spec \u00a78 \u2014 result surfaces structured guidance',
    pass: () => {
      const page = read('src/pages/ScanPage.jsx');
      const card = read('src/components/scan/TreatmentGuidanceCard.jsx');
      return fs.existsSync(path.join(ROOT, 'src/components/scan/TreatmentGuidanceCard.jsx'))
          && /<TreatmentGuidanceCard/.test(page)
          && /treatment_add_to_plan/.test(card);
    },
  },
  {
    // Treatment engine spec \u00a74 + safe-launch policy: chemical guidance must
    // be CLASS-ONLY ("a locally approved fungicide", "a pest-control option
    // labelled for this crop"). Naming a specific product or active ingredient
    // ("neem oil", "soap spray", "mancozeb", etc.) creates legal + safety
    // exposure (we'd be implicitly recommending it) and bypasses the user's
    // local extension service. This guard scans the scan + treatment engine
    // source files for banned product / active-ingredient tokens and fails
    // CI if any reach the engine output strings. Add new tokens here as the
    // safety review surfaces them.
    name: 'scan + treatment engines never name specific products / actives',
    why:  'Treatment engine spec \u00a74 \u2014 chemical guidance must be class-only',
    pass: () => {
      const BANNED = [
        'neem oil', 'soap spray', 'copper sulphate', 'copper sulfate',
        'mancozeb', 'imidacloprid', 'cypermethrin', 'carbaryl',
        'chlorothalonil', 'tebuconazole', 'propiconazole', 'chlorpyrifos',
        'deltamethrin', 'permethrin', 'malathion', 'glyphosate',
        'roundup', 'sevin',
      ];
      const FILES = [
        'src/core/treatmentEngine.js',
        'src/core/hybridScanEngine.js',
        'src/core/dailyIntelligenceEngine.js',
        'src/core/landIntelligenceEngine.js',
      ];
      for (const rel of FILES) {
        const body = read(rel).toLowerCase();
        for (const token of BANNED) {
          if (body.includes(token)) return false;
        }
      }
      return true;
    },
  },
  {
    // High-trust scan output spec \u00a72: certain phrases imply
    // overconfidence we don't have. The scan engine sources
    // (and the policy module that sanitises them) must never
    // contain these as OUTPUT strings. We allow them in the
    // policy module's REGEX list (left-hand side of the
    // FORBIDDEN_REPLACEMENTS table) by checking only the engine
    // sources, not the policy itself.
    name: 'scan engines never use overconfident verdict wording',
    why:  'High-trust scan output spec \u00a72 \u2014 no "confirmed disease" / "guaranteed cure"',
    pass: () => {
      const BANNED = [
        'confirmed disease',
        'disease detected',
        'disease confirmed',
        'guaranteed cure',
        'guaranteed treatment',
        'proven cure',
      ];
      const FILES = [
        'src/core/treatmentEngine.js',
        'src/core/hybridScanEngine.js',
        'src/core/scanDetectionEngine.js',
      ];
      // Strip // line comments + /* block comments */ before
      // scanning so the engine sources can DOCUMENT what they're
      // forbidden from emitting (e.g. "* NEVER emits 'confirmed
      // disease'") without tripping this guard. The substring
      // checks then only see source code + string literals.
      const stripComments = (src) => src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      for (const rel of FILES) {
        const body = stripComments(read(rel)).toLowerCase();
        for (const token of BANNED) {
          if (body.includes(token)) return false;
        }
      }
      return true;
    },
  },
  {
    name: 'scanResultPolicy module ships sanitiser + escalation + follow-up',
    why:  'High-trust scan output spec \u00a71\u2013\u00a76 \u2014 single source of structured safe output',
    pass: () => {
      const f = read('src/core/scanResultPolicy.js');
      return /export function sanitizeScanText/.test(f)
          && /export function escalationCopyFor/.test(f)
          && /export function followUpTaskFor/.test(f)
          && /export function verificationChecksFor/.test(f)
          && /export function enforceHighTrustScanResult/.test(f)
          && /confirmed disease/.test(f)             // forbidden-token table
          && /guaranteed cure/.test(f)               // forbidden-token table
          && /Follow label instructions/.test(f);    // safe replacement
    },
  },
  {
    name: 'ScanResultCard renders Possible issue / Why / Escalate / Follow-up',
    why:  'High-trust scan output spec \u00a71 \u2014 every result follows the same structure',
    pass: () => {
      const f = read('src/components/scan/ScanResultCard.jsx');
      return /enforceHighTrustScanResult/.test(f)
          && /scan\.eyebrow\.possibleIssue/.test(f)
          && /data-testid=["']scan-eyebrow["']/.test(f)
          && /data-testid=["']scan-actions["']/.test(f)
          && /data-testid=["']scan-escalate["']/.test(f)
          && /data-testid=["']scan-followup["']/.test(f)
          && /scan\.whenToEscalate/.test(f)
          && /scan\.followUp/.test(f);
    },
  },
  {
    name: 'scanToTask persists max 2 immediate + 1 follow-up task',
    why:  'High-trust scan output spec \u00a77 \u2014 follow-up task always appears',
    pass: () => {
      const f = read('src/core/scanToTask.js');
      return /context\.followUpTask/.test(f)
          && /isFollowUp:\s*!!isFollowUp/.test(f)
          && /immediateSource\s*=\s*Array\.isArray\(suggestedTasks\)/.test(f)
          && /\.slice\(0,\s*2\)/.test(f);
    },
  },
  {
    name: 'ScanPage threads policy follow-up task into addScanTasks',
    why:  'High-trust scan output spec \u00a77 \u2014 \u201cCheck this again tomorrow\u201d added to plan',
    pass: () => {
      const f = read('src/pages/ScanPage.jsx');
      return /followUpTaskFor/.test(f)
          && /followUpTask,/.test(f);   // passed into addScanTasks context
    },
  },
  {
    // High-trust onboarding spec \u00a71 \u2014 the FIRST onboarding
    // screen asks "What are you growing?" with two tiles
    // Final-onboarding-polish spec \u00a73\u2013\u00a74 \u2014 first-screen
    // question rewrites to "Where are you growing?" and the
    // tile labels are "At home" / "On a farm" with subtext,
    // not the legacy "Backyard / Garden" / "Farm".
    name: 'FastFlow first screen asks "Where are you growing?" with At-home / On-a-farm tiles',
    why:  'Final-onboarding-polish spec \u00a73\u2013\u00a74 \u2014 reframed question + premium tile labels',
    pass: () => {
      const f = read('src/pages/onboarding/FastFlow.jsx');
      return /onboarding\.whereAreYouGrowing\b/.test(f)
          // Helper line under the title (final-onboarding-polish
          // follow-up). Explains why we're asking; smaller font
          // + medium-opacity white than the title.
          && /onboarding\.whereAreYouGrowingHelper/.test(f)
          && /data-testid=["']onb-entry-helper["']/.test(f)
          && /data-testid=["']onb-entry-garden["']/.test(f)
          && /data-testid=["']onb-entry-farm["']/.test(f)
          && /onboarding\.atHome/.test(f)
          && /onboarding\.atHomeSub/.test(f)
          && /onboarding\.onAFarm/.test(f)
          && /onboarding\.onAFarmSub/.test(f)
          && !/fastFlow\.entry\.question/.test(f)        // legacy key removed
          && /\/setup\/garden/.test(f)                   // garden hand-off
          && /\/setup\/farm/.test(f);                    // farm hand-off
    },
  },
  {
    // High-trust onboarding spec \u00a78 \u2014 step indicator MUST
    // show "Step X of 3" so users see a 3-step (not 6) flow.
    // Stability-patch \u00a73 \u2014 step pill REMOVED entirely from
    // the FastFlow header; only the progress bar communicates
    // position. The bar represents the canonical 6-decision
    // flow (FastFlow takes 2: language + experience; setup
    // form takes 4: location, plant/crop, setup, review).
    name: 'FastFlow header has no step-count pill (progress bar only)',
    why:  'Stability-patch \u00a73 \u2014 numeric step counts removed',
    pass: () => {
      const f = read('src/pages/onboarding/FastFlow.jsx');
      // Forbidden: any rendered tStrict('onboarding.step', \u2026)
      // call inside the Header. The legacy `<span style={S.stepPill}>`
      // is gone; the Header now only renders the back button or
      // a hidden spacer.
      return !/data-testid=["']fast-flow-step["']/.test(f)
          && !/tStrict\(\s*['"]onboarding\.step['"]/.test(f)
          // Progress bar still mounted with totalSteps = 6
          // (matches the canonical flow length).
          && /totalSteps\s*=\s*6/.test(f)
          && /<OnboardingProgressBar/.test(f);
    },
  },
  {
    // High-trust onboarding spec \u00a72 \u2014 "Are you new to growing?"
    // moves to the setup forms as a non-blocking guidance pill.
    // Garden uses growing-wording, Farm uses farming-wording.
    // Stability-patch \u00a74 \u2014 the skill-level pill is no longer
    // rendered (spec \u00a74 forbids "experience level" in the
    // stacked form). The skillLevel state stays in both Quick
    // setups for any downstream surface that wants to read it,
    // but it is NOT collected during onboarding.
    name: 'Quick setup forms do NOT render the skill-level pill',
    why:  'Stability-patch \u00a74 \u2014 one decision per screen, no experience-level pill',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Forbidden: testids on the dropped pill row.
      const SKILL_TESTID = /data-testid=\{`setup-(?:garden|farm)-skill-/;
      return !SKILL_TESTID.test(garden)
          && !SKILL_TESTID.test(farm)
          // The legacy "Are you new to..." copy is no longer
          // referenced in the rendered output.
          && !/tStrict\('onboarding\.newToGrowing'/.test(garden)
          && !/tStrict\('onboarding\.newToFarming'/.test(farm);
    },
  },
  {
    // Spec \u00a79 \u2014 button copy is action-shaped: "Save Garden" /
    // "Save Farm". The legacy "Save my garden" / "Save my farm"
    // is no longer the rendered label.
    // Go-live merged spec \u00a76 \u2014 the Save CTAs unified on a
    // single "Start using Farroway" button across both flows.
    // The legacy onboarding.saveGarden / saveFarm keys stay
    // registered in translations.js for any external consumer
    // but are no longer rendered by the Quick setups.
    name: 'Quick setup forms render unified "Start using Farroway" CTA',
    why:  'Go-live merged spec \u00a76 \u2014 single Save CTA across garden + farm',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      return /onboarding\.review\.startUsing/.test(garden)
          && /onboarding\.review\.startUsing/.test(farm);
    },
  },
  {
    // Spec \u00a77 \u2014 onboarding screens MUST hide bottom nav
    // (which carries scan + funding/sell tabs) so the user
    // can't be distracted away from setup. The nav already
    // self-hides on /onboarding; this guard ensures the new
    // /setup/garden + /setup/farm + /start/farm paths are
    // also covered.
    name: 'BottomTabNav suppresses onboarding paths (setup + start)',
    why:  'High-trust onboarding spec \u00a77 \u2014 no nav distractions during setup',
    pass: () => {
      const f = read('src/components/farmer/BottomTabNav.jsx');
      return /HIDE_NAV_PATHS/.test(f)
          && /['"]\/setup\/garden['"]/.test(f)
          && /['"]\/setup\/farm['"]/.test(f)
          && /['"]\/start\/farm['"]/.test(f)
          && /['"]\/onboarding['"]/.test(f);
    },
  },
  {
    // Spec \u00a75 \u2014 strict screen-level translator with the
    // exact getScreenText(screenName, language) shape the
    // onboarding spec calls out. The hook variant
    // (useScreenTranslator) is re-exported so existing callers
    // keep working unchanged.
    name: 'strictScreenTranslator ships getScreenText + screen-fallback policy',
    why:  'High-trust onboarding spec \u00a74\u2013\u00a75 \u2014 one screen = one language',
    pass: () => {
      const f = read('src/i18n/strictScreenTranslator.js');
      return /export function getScreenText/.test(f)
          && /export\s*\{\s*useScreenTranslator\s*\}/.test(f)
          && /validation\.ok\s*\?\s*safeLang\s*:\s*['"]en['"]/.test(f);
    },
  },
  {
    // Spec \u00a76 \u2014 every required onboarding key must be
    // present in the canonical translations store. We sample
    // the keys here; guard:i18n-parity covers per-language
    // completeness across the whole file.
    name: 'translations.js ships every required onboarding key',
    why:  'High-trust onboarding spec \u00a76 \u2014 complete keys for the new flow',
    pass: () => {
      const f = read('src/i18n/translations.js');
      const KEYS = [
        'onboarding.whatAreYouGrowing',
        'onboarding.backyardGarden',
        'onboarding.farm',
        'onboarding.newToGrowing',
        'onboarding.newToFarming',
        'onboarding.yesNew',
        'onboarding.alreadyGrowPlants',
        'onboarding.alreadyFarm',
        'onboarding.selectPlant',
        'onboarding.selectCrop',
        'onboarding.location',
        'onboarding.landSize',
        'onboarding.saveGarden',
        'onboarding.saveFarm',
        'onboarding.needHelp',
        'onboarding.contactTeam',
        'onboarding.step',
        'onboarding.continue',
        'onboarding.back',
      ];
      for (const k of KEYS) {
        const re = new RegExp(`['"]${k.replace(/\./g, '\\.')}['"]\\s*:`);
        if (!re.test(f)) return false;
      }
      return true;
    },
  },
  {
    // Clean-onboarding spec \u00a72 \u2014 Step 0 language picker exists
    // BEFORE any translated content so the rest of the flow is
    // read in the user's preferred language.
    name: 'FastFlow ships Step 0 language picker',
    why:  'Clean-onboarding spec \u00a72 \u2014 language chosen before translated content',
    pass: () => {
      const f = read('src/pages/onboarding/FastFlow.jsx');
      return /onboarding\.chooseLanguage/.test(f)
          && /data-testid=["']fast-flow-language["']/.test(f)
          && /LANGUAGE_OPTIONS/.test(f)
          && /OnboardingProgressBar/.test(f)
          // 6 launch picker languages: en/es/fr/sw/ha/hi (Twi
          // intentionally not in first-paint picker).
          && /['"]en['"][\s\S]*?['"]es['"][\s\S]*?['"]fr['"][\s\S]*?['"]sw['"][\s\S]*?['"]ha['"][\s\S]*?['"]hi['"]/.test(f);
    },
  },
  {
    // Spec \u00a75 \u2014 progress bar replaces "Step 1 of 6". Both
    // FastFlow + the Quick setup forms mount the same component.
    name: 'Onboarding renders progress bar instead of scary step number',
    why:  'Clean-onboarding spec \u00a75 \u2014 progress bar only',
    pass: () => {
      const bar    = read('src/components/onboarding/OnboardingProgressBar.jsx');
      const flow   = read('src/pages/onboarding/FastFlow.jsx');
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Render-crash hardening (this commit): the progress bar
      // moved into its own leaf module so importing it from
      // setup forms no longer drags the whole FastFlow tree
      // along. The bar itself defines role="progressbar"; flow
      // + setup forms only need to import + render it.
      return /export default function OnboardingProgressBar/.test(bar)
          && /role=["']progressbar["']/.test(bar)
          && /OnboardingProgressBar/.test(flow)
          && /OnboardingProgressBar/.test(garden)
          && /OnboardingProgressBar/.test(farm)
          // Setup forms import from the leaf module (NOT from
          // FastFlow.jsx \u2014 that's the cross-coupling we removed).
          && /from ['"]\.\.\/\.\.\/components\/onboarding\/OnboardingProgressBar\.jsx['"]/.test(garden)
          && /from ['"]\.\.\/\.\.\/components\/onboarding\/OnboardingProgressBar\.jsx['"]/.test(farm);
    },
  },
  {
    // Spec \u00a77 \u2014 garden ships predefined plant tiles + Other
    // free-input fallback; farm ships predefined crop tiles +
    // Other.
    name: 'Setup forms ship predefined plant/crop tiles + Other',
    why:  'Clean-onboarding spec \u00a77 \u2014 quick taps, no typing required',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const GARDEN_TILES = ['tomato', 'pepper', 'herbs', 'lettuce', 'cucumber', 'other'];
      const FARM_TILES   = ['maize', 'rice', 'pepper', 'tomato', 'cassava', 'other'];
      for (const t of GARDEN_TILES) {
        if (!new RegExp(`onboarding\\.plant\\.${t}`).test(garden)) return false;
      }
      for (const t of FARM_TILES) {
        if (!new RegExp(`onboarding\\.crop\\.${t}`).test(farm)) return false;
      }
      return /PLANT_OPTIONS/.test(garden)
          && /CROP_OPTIONS/.test(farm);
    },
  },
  {
    // Spec \u00a76 \u2014 size buckets are experience-specific.
    // Garden: Small/Medium/Large/I don't know. Acres NEVER shown.
    // Farm: <1 acre / 1-5 / 5+ / I don't know. NEVER "Small backyard".
    name: 'Size buckets are experience-specific (garden uses size words, farm uses acres)',
    why:  'Clean-onboarding spec \u00a76 \u2014 size scale matches the experience',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Garden uses Small/Medium/Large/Don't-know words. Acres
      // bucket key must NOT exist in the garden source (the
      // farmType: 'backyard' string is the backend type, not a
      // user-visible label, so it's allowed).
      return /onboarding\.gardenSize\.small/.test(garden)
          && /onboarding\.gardenSize\.medium/.test(garden)
          && /onboarding\.gardenSize\.large/.test(garden)
          && /onboarding\.gardenSize\.unknown/.test(garden)
          // No acres-keyed bucket label sneaks into the garden
          // size options (would break the spec "do not show acres").
          && !/onboarding\.gardenSize\.[a-z0-9_]*acre/i.test(garden)
          // Farm ships the 4 acre buckets + the FARM_SIZE_BUCKETS
          // module table.
          && /onboarding\.farmSize\.lt1/.test(farm)
          && /onboarding\.farmSize\.1to5/.test(farm)
          && /onboarding\.farmSize\.gt5/.test(farm)
          && /onboarding\.farmSize\.unknown/.test(farm)
          && /FARM_SIZE_BUCKETS/.test(farm)
          // Farm size labels must not include a "small backyard"
          // bucket (spec: "do not show 'Small backyard' in farm flow").
          && !/onboarding\.farmSize\.[a-z0-9_]*backyard/i.test(farm);
    },
  },
  {
    // Spec \u00a78 \u2014 "Use my location" is the primary CTA on the
    // location section; manual entry is the fallback, not the
    // first thing the user sees. Geolocation failure must not
    // block setup (the manual fields are always visible).
    name: 'Setup forms expose explicit "Use my current location" CTA',
    why:  'Clean-onboarding spec \u00a78 + location-cleanup \u00a74 \u2014 explicit location action',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Either the legacy or the new key is acceptable for the
      // CTA copy; both forms must wire the requestLocation
      // handler + carry the testid.
      return (/onboarding\.useMyCurrentLocation/.test(garden) || /onboarding\.useMyLocation/.test(garden))
          && /data-testid=["']quick-garden-use-location["']/.test(garden)
          && /requestLocation/.test(garden)
          && (/onboarding\.useMyCurrentLocation/.test(farm) || /onboarding\.useMyLocation/.test(farm))
          && /data-testid=["']quick-farm-use-location["']/.test(farm)
          && /requestLocation/.test(farm);
    },
  },
  {
    // Spec \u00a74 \u2014 ProtectedLayout suppresses logout, mode
    // toggle, AutoVoice on every onboarding path so the user has
    // zero distractions during setup. The language selector
    // (left side) stays visible per spec.
    name: 'ProtectedLayout suppresses logout / mode / AutoVoice on onboarding paths',
    why:  'Clean-onboarding spec \u00a74 \u2014 zero distractions during setup',
    pass: () => {
      const f = read('src/layouts/ProtectedLayout.jsx');
      return /_isOnboardingPath/.test(f)
          && /ONBOARDING_PREFIXES/.test(f)
          && /!onboarding\s*&&\s*<AutoVoiceToggle/.test(f)
          && /!onboarding\s*&&\s*\(/.test(f)               // logout button
          && /['"]\/setup\/garden['"]/.test(f)
          && /['"]\/setup\/farm['"]/.test(f);
    },
  },
  {
    // Backyard growing-setup spec \u00a71\u2013\u00a72 \u2014 QuickGardenSetup
    // adds the "How are you growing this?" tile group AFTER the
    // plant pick. Garden-only step; farm flow never sees it.
    // The picked value is persisted onto the garden record as
    // growingSetup so dailyIntelligenceEngine + hybridScanEngine
    // can read it without an extra lookup.
    name: 'QuickGardenSetup ships "How are you growing your plant?" picker',
    why:  'Merge-spec \u00a71 \u2014 capture container/raised_bed/ground/indoor_balcony/unknown',
    pass: () => {
      const f = read('src/pages/setup/QuickGardenSetup.jsx');
      const PERSISTED = /growingSetup\s*:\s*growingSetup\b|^\s*growingSetup,?\s*$/m;
      return /garden\.growingSetup\.title/.test(f)
          && /GROWING_SETUP_OPTIONS/.test(f)
          // The 5 canonical merge-spec keys.
          && /garden\.growingSetup\.container/.test(f)
          && /garden\.growingSetup\.raisedBed/.test(f)
          && /garden\.growingSetup\.ground/.test(f)
          && /garden\.growingSetup\.indoorBalcony/.test(f)
          && /garden\.growingSetup\.unknown/.test(f)
          // The 5 canonical value strings used by engines.
          && /['"]raised_bed['"]/.test(f)
          && /['"]indoor_balcony['"]/.test(f)
          && PERSISTED.test(f)
          && /quick-garden-growing-/.test(f);
    },
  },
  {
    // Spec \u00a72 \u2014 farm flow MUST NOT show the growing-setup
    // picker. Belt-and-braces check: scan QuickFarmSetup for
    // any reference to the garden-only translation key.
    name: 'QuickFarmSetup never shows the growing-setup picker',
    why:  'Backyard growing-setup spec \u00a71 \u2014 garden-only step',
    pass: () => {
      const f = read('src/pages/setup/QuickFarmSetup.jsx');
      return !/garden\.growingSetup\./.test(f)
          && !/GROWING_SETUP_OPTIONS/.test(f);
    },
  },
  {
    // Spec \u00a75 \u2014 dailyIntelligenceEngine personalises the
    // daily plan based on growingSetup. Container plants get
    // drainage/moisture tasks; beds get spacing/weed tasks;
    // ground gets soil/weed tasks; unknown falls through to
    // generic garden tasks.
    name: 'dailyIntelligenceEngine personalises tasks by growingSetup',
    why:  'Merge-spec \u00a74 \u2014 5-bucket task personalisation with canonical value taxonomy',
    pass: () => {
      const f = read('src/core/dailyIntelligenceEngine.js');
      return /SETUP_TASKS/.test(f)
          // Canonical merge-spec keys.
          && /\braised_bed\b/.test(f)
          && /\bindoor_balcony\b/.test(f)
          // Container.
          && /Check container soil moisture/.test(f)
          && /Make sure the pot drains well/.test(f)
          // Raised bed.
          && /Check spacing between plants/.test(f)
          && /Remove weeds around the bed/.test(f)
          // Ground.
          && /Check soil around the plant/.test(f)
          && /Look for weeds or pests nearby/.test(f)
          // Indoor / balcony.
          && /Check light exposure/.test(f)
          && /Rotate plant toward light/.test(f)
          && /Avoid overwatering/.test(f)
          // Backwards-compat alias for legacy saved gardens.
          && /SETUP_ALIAS/.test(f)
          && /source:\s*['"]growing_setup['"]/.test(f);
    },
  },
  {
    // Spec \u00a76 \u2014 hybridScanEngine adds setup-specific actions
    // for garden + container/bed/ground; final list capped at 3.
    name: 'hybridScanEngine personalises scan actions by growingSetup',
    why:  'Merge-spec \u00a75 \u2014 scan-action enrichment per canonical bucket (incl. indoor_balcony)',
    pass: () => {
      const f = read('src/core/hybridScanEngine.js');
      return /SETUP_ACTIONS/.test(f)
          // Canonical merge-spec keys.
          && /\braised_bed\b/.test(f)
          && /\bindoor_balcony\b/.test(f)
          // Container.
          && /Check pot drainage/.test(f)
          && /Avoid water sitting in the container/.test(f)
          // Raised bed.
          && /Check nearby plants for similar signs/.test(f)
          && /Improve airflow between plants/.test(f)
          // Ground.
          && /Check soil around the plant/.test(f)
          && /Remove nearby weeds/.test(f)
          // Indoor / balcony.
          && /Check light exposure/.test(f)
          && /Move plant closer to light if needed/.test(f)
          // Legacy alias for backwards compat.
          && /SETUP_ALIAS/.test(f)
          && /recommendedActions\s*=\s*recommendedActions\.slice\(0,\s*3\)/.test(f);
    },
  },
  {
    // Spec \u00a77 \u2014 every required garden.growingSetup.* key is
    // present in the canonical translations store.
    name: 'translations.js ships every garden.growingSetup.* key',
    why:  'Backyard growing-setup spec \u00a77 \u2014 complete keys (incl. indoor)',
    pass: () => {
      const f = read('src/i18n/translations.js');
      const KEYS = [
        'garden.growingSetup.title',
        'garden.growingSetup.label',
        'garden.growingSetup.container',
        // Merge-spec canonical keys.
        'garden.growingSetup.raisedBed',
        'garden.growingSetup.ground',
        'garden.growingSetup.indoorBalcony',
        'garden.growingSetup.unknown',
      ];
      for (const k of KEYS) {
        const re = new RegExp(`['"]${k.replace(/\./g, '\\.')}['"]\\s*:`);
        if (!re.test(f)) return false;
      }
      return true;
    },
  },
  {
    // Spec \u00a74 \u2014 GardenSetupForm (the add-another / edit-garden
    // surface) maps its existing growingLocation pick to the
    // canonical growingSetup bucket so downstream engines read
    // the same field whether the garden was created via this
    // form or via QuickGardenSetup.
    name: 'GardenSetupForm normalises growingLocation \u2192 growingSetup',
    why:  'Backyard growing-setup spec \u00a74 \u2014 edit-garden updates the canonical field',
    pass: () => {
      const f = read('src/components/farm/GardenSetupForm.jsx');
      return /GROWING_LOCATION_TO_SETUP/.test(f)
          && /soil:\s*['"]ground['"]/.test(f)
          // Merge-spec canonical taxonomy: raised_bed maps to
          // itself; legacy 'bed' value retired.
          && /raised_bed:\s*['"]raised_bed['"]/.test(f)
          && /pots:\s*['"]container['"]/.test(f)
          && /indoor:\s*['"]indoor_balcony['"]/.test(f)
          && /growingSetup,/.test(f);                  // included in the saved object
    },
  },
  {
    // Final-gap stability \u00a71 \u2014 single source of truth for
    // "who is this user, what are they working on right now,
    // and where". Returns a stable shape with no undefined keys.
    name: 'contextResolver ships resolveUserContext with stable shape',
    why:  'Final-gap stability \u00a71 \u2014 every consumer reads the same context shape',
    pass: () => {
      const f = read('src/core/contextResolver.js');
      return /export function resolveUserContext/.test(f)
          && /experience,/.test(f)
          && /gardenId,/.test(f)
          && /farmId,/.test(f)
          && /growingSetup,/.test(f)
          && /location,/.test(f)
          && /cropOrPlant,/.test(f)
          // Garden experience always coerces missing growingSetup
          // to 'unknown' (spec \u00a76).
          && /growingSetup\s*=\s*['"]unknown['"]/.test(f);
    },
  },
  {
    // Final-gap stability \u00a77 \u2014 universal "system has nothing
    // to say" fallback. Scan / API / empty kinds each return a
    // stable shape with 2\u20133 actions.
    name: 'getSafeFallback ships scan / api / empty fallbacks with 2\u20133 actions',
    why:  'Final-gap stability \u00a77 \u2014 user is never stuck on a blank screen',
    pass: () => {
      const f = read('src/core/getSafeFallback.js');
      return /export function getSafeFallback/.test(f)
          && /SCAN_FALLBACK/.test(f)
          && /API_FALLBACK/.test(f)
          && /EMPTY_FALLBACK_GARDEN/.test(f)
          && /EMPTY_FALLBACK_FARM/.test(f)
          && /Retake the photo in better light/.test(f)
          && /Check leaves and soil manually/.test(f)
          && /Monitor the plant tomorrow/.test(f);
    },
  },
  {
    // Final-gap stability \u00a72 \u2014 enforceHighTrustScanResult
    // GUARANTEES at least one action in the rendered result.
    // Empty engine output falls through to the canonical scan
    // fallback action set (matches getSafeFallback).
    name: 'enforceHighTrustScanResult guarantees \u22651 action',
    why:  'Final-gap stability \u00a72 \u2014 scan result NEVER renders an empty action list',
    pass: () => {
      const f = read('src/core/scanResultPolicy.js');
      return /_SCAN_FALLBACK_ACTIONS/.test(f)
          && /recommendedActions\.length\s*===\s*0/.test(f)
          && /Retake the photo in better light/.test(f)
          && /Check leaves and soil manually/.test(f)
          && /Monitor the plant tomorrow/.test(f);
    },
  },
  {
    // Final-gap stability \u00a73 \u2014 sanitizeScanOutput alias points
    // to the canonical orchestrator so callers can speak in
    // spec terms ("hard-block forbidden wording") without
    // learning the longer name.
    name: 'sanitizeScanOutput alias is exported from scanResultPolicy',
    why:  'Final-gap stability \u00a73 \u2014 spec-named hard-block entry point',
    pass: () => {
      const f = read('src/core/scanResultPolicy.js');
      return /export const sanitizeScanOutput\s*=\s*enforceHighTrustScanResult/.test(f);
    },
  },
  {
    // Final-gap stability \u00a76 \u2014 garden experience always has a
    // usable growingSetup ('unknown' when skipped). Coercion
    // happens at the canonical write-site (QuickGardenSetup).
    name: 'QuickGardenSetup coerces missing growingSetup to "unknown"',
    why:  'Final-gap stability \u00a76 \u2014 garden experience always has a setup value',
    pass: () => {
      const f = read('src/pages/setup/QuickGardenSetup.jsx');
      return /growingSetup:\s*growingSetup\s*\|\|\s*['"]unknown['"]/.test(f);
    },
  },
  {
    // Final-gap stability \u00a78 \u2014 onboarding routes redirect to
    // /home when isOnboardingComplete() is true so a returning
    // user can never land mid-flow + create duplicate gardens
    // / farms. All three onboarding entry surfaces enforce this.
    name: 'Onboarding routes redirect to /home when already completed',
    why:  'Final-gap stability \u00a78 \u2014 onboarding never loops',
    pass: () => {
      const flow   = read('src/pages/onboarding/FastFlow.jsx');
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const guard  = /isOnboardingComplete\(\)/;
      const redir  = /navigate\(\s*['"]\/home['"]\s*,\s*\{\s*replace:\s*true\s*\}\s*\)/;
      return guard.test(flow)   && redir.test(flow)
          && guard.test(garden) && redir.test(garden)
          && guard.test(farm)   && redir.test(farm);
    },
  },
  {
    // Risk-fix follow-up to the final-gap commit: GardenSetupForm
    // now ships a FIRST-CLASS canonical 4-bucket growing-setup
    // picker so this surface can serve as the edit-garden form
    // (pre-populated from initialProfile.growingSetup; explicit
    // pick wins over the legacy growingLocation \u2192 bucket mapping
    // at save time).
    name: 'GardenSetupForm ships first-class growingSetup picker (edit-garden)',
    why:  'Risk-fix \u2014 canonical growing-setup field is editable, not just derived',
    pass: () => {
      const f = read('src/components/farm/GardenSetupForm.jsx');
      return /GROWING_SETUP_OPTIONS/.test(f)
          && /useState\(\s*String\(initialProfile\?\.growingSetup/.test(f)
          && /garden-setup-growing-/.test(f)
          && /finalGrowingSetup/.test(f)                     // explicit-wins logic
          && /growingSetup:\s*finalGrowingSetup/.test(f);
    },
  },
  {
    // Risk-fix follow-up: LanguageSelector dropdown auto-hides
    // any language missing the new canonical onboarding keys.
    // Belt-and-braces alongside the strict screen translator's
    // per-screen English fallback.
    name: 'LanguageSelector REQUIRED_KEYS covers onboarding + growingSetup keys',
    why:  'Risk-fix \u2014 partial-translation languages auto-hide from picker',
    pass: () => {
      const f = read('src/components/LanguageSelector.jsx');
      return /onboarding\.chooseLanguage/.test(f)
          && /onboarding\.whatAreYouGrowing/.test(f)
          && /onboarding\.saveGarden/.test(f)
          && /onboarding\.saveFarm/.test(f)
          && /garden\.growingSetup\.title/.test(f)
          && /garden\.growingSetup\.container/.test(f);
    },
  },
  {
    // Review-step spec \u2014 Step 6 of Simple Onboarding gains
    // back + edit controls. Title swaps from "Here is what to
    // do today" to "Review your plan", a helper line tells the
    // user nothing is committed yet, and an "Edit your setup"
    // panel below the actions exposes 3 jump-back buttons:
    // Change crop / Change location / Change growing setup.
    name: 'StepDailyPlanPreview ships Review title + Edit your setup panel',
    why:  'Review-step spec \u2014 user can change anything before continuing',
    pass: () => {
      const f = read('src/onboarding/StepDailyPlanPreview.jsx');
      return /onboarding\.review\.title/.test(f)
          && /onboarding\.review\.helper/.test(f)
          && /onboarding\.review\.editTitle/.test(f)
          && /onboarding\.review\.changeCrop/.test(f)
          && /onboarding\.review\.changeLocation/.test(f)
          && /onboarding\.review\.changeGrowingSetup/.test(f)
          && /data-testid=["']onboarding-edit-setup["']/.test(f)
          && /data-testid=["']onboarding-edit-crop["']/.test(f)
          && /data-testid=["']onboarding-edit-location["']/.test(f)
          && /data-testid=["']onboarding-edit-growing-setup["']/.test(f)
          // Legacy "Here is what to do today" title is no longer
          // rendered by tSafe (the review.title key is now the
          // primary heading).
          && !/tSafe\(['"]onboarding\.planReady['"]/.test(f);
    },
  },
  {
    // Review-step spec \u2014 OnboardingFlow shows the back button
    // on step 6 and threads `onEditStep` to StepDailyPlanPreview
    // so each "Edit" button jumps the user back to the right
    // step (preserving profile state).
    // OBSOLETE \u2014 OnboardingFlow.jsx is now a redirect-only shim
    // pointing /onboarding/simple at /onboarding/start. The
    // 6-step body (back-button + onEditStep wiring) is gone.
    // Replaced by the "redirect-only shim" guard below.
    name: 'OnboardingFlow.jsx is a redirect-only shim to /onboarding/start',
    why:  'Risk-fix \u2014 legacy 6-step flow superseded by canonical FastFlow',
    pass: () => {
      const f = read('src/onboarding/OnboardingFlow.jsx');
      return /CANONICAL_ENTRY\s*=\s*['"]\/onboarding\/start['"]/.test(f)
          && /navigate\(CANONICAL_ENTRY,\s*\{\s*replace:\s*true\s*\}\)/.test(f)
          // Redirect-only \u2014 the legacy step state must NOT be
          // declared in the new shim; presence of `useState`
          // indicates the dead code crept back.
          && !/React\.useState\(\(\) => loadOnboardingProfile/.test(f)
          // No more 6-step pill / back button / onEditStep
          // wiring \u2014 those concerns moved to FastFlow + Quick
          // setups + StepDailyPlanPreview (now unreferenced).
          && !/showBack/.test(f)
          && !/onEditStep/.test(f);
    },
  },
  {
    // Review-step spec \u2014 6 new translation keys present in
    // every launch language (per-language parity is enforced
    // separately by guard:i18n-parity).
    name: 'translations.js ships every onboarding.review.* key',
    why:  'Review-step spec \u2014 review/edit copy translated for all launch langs',
    pass: () => {
      const f = read('src/i18n/translations.js');
      const KEYS = [
        'onboarding.review.title',
        'onboarding.review.helper',
        'onboarding.review.editTitle',
        'onboarding.review.changeCrop',
        'onboarding.review.changeLocation',
        'onboarding.review.changeGrowingSetup',
        // Polish-audit \u00a71 \u2014 farm-only edit option.
        'onboarding.review.changeFarmSize',
        // Polish-audit \u00a74 \u2014 final-step pill copy.
        'onboarding.almostDone',
      ];
      for (const k of KEYS) {
        const re = new RegExp(`['"]${k.replace(/\./g, '\\.')}['"]\\s*:`);
        if (!re.test(f)) return false;
      }
      return true;
    },
  },
  {
    // Polish-audit \u00a72 \u2014 final-step title swaps from
    // "Review your plan" to "Review your first plan" so the
    // user reads it as a starting position, not the final one.
    // Go-live merged spec \u00a76 superseded the polish-audit title.
    // Review screen now reads "Your plan is ready" so the
    // user's mental model is "the plan is done; here's what
    // to do" rather than "review what you entered".
    name: 'Review-step title is "Your plan is ready"',
    why:  'Go-live merged spec \u00a76 \u2014 outcome-shaped review framing',
    pass: () => {
      const f = read('src/i18n/translations.js');
      return /'onboarding\.review\.title':[\s\S]{0,160}en:\s*'Your plan is ready'/.test(f);
    },
  },
  {
    // Polish-audit \u00a71 \u2014 farm experience swaps the
    // "Change growing setup" button for "Change farm size".
    // Both keys + testids must be present in the source.
    name: 'Review step ships farm-only "Change farm size" edit option',
    why:  'Polish-audit \u00a71 \u2014 farm size editable from review screen',
    pass: () => {
      const f = read('src/onboarding/StepDailyPlanPreview.jsx');
      return /onboarding\.review\.changeFarmSize/.test(f)
          && /data-testid=["']onboarding-edit-farm-size["']/.test(f)
          && /handleEdit\(\s*['"]farmSize['"]\s*\)/.test(f);
    },
  },
  {
    // Polish-audit \u00a73 + \u00a75 \u2014 the bottom CTA is just "Go to
    // Home"; the legacy VoiceLauncher + PhotoLauncher chip
    // shortcuts were dropped so the final step has one
    // primary action. Each launcher import is commented out
    // (kept as history reference) so a grep for the value
    // doesn't accidentally match.
    name: 'Review-step bottom CTA drops voice + photo chip shortcuts',
    why:  'Polish-audit \u00a73/\u00a75 \u2014 single primary CTA, no distractions',
    pass: () => {
      const f = read('src/onboarding/StepDailyPlanPreview.jsx');
      // No active <VoiceLauncher /> or <PhotoLauncher /> JSX;
      // commented-out imports allowed (line starts with //).
      const hasActiveVoice = /^[^/]*<VoiceLauncher\b/m.test(f);
      const hasActivePhoto = /^[^/]*<PhotoLauncher\b/m.test(f);
      return !hasActiveVoice && !hasActivePhoto
          // Primary CTA testid still present.
          && /data-testid=["']onboarding-go-home["']/.test(f);
    },
  },
  {
    // OBSOLETE \u2014 the "Almost done" pill belonged to the legacy
    // 6-step flow body that no longer exists. The canonical
    // 4-step FastFlow uses the progress bar only (no step pill
    // text after step 3 \u2014 see clean-onboarding spec). Kept as
    // a no-op pass so removing the assertion doesn't change
    // the check count.
    name: 'OnboardingFlow.jsx is no longer a 6-step orchestrator',
    why:  'Risk-fix \u2014 legacy 6-step flow consolidated into FastFlow',
    pass: () => {
      const f = read('src/onboarding/OnboardingFlow.jsx');
      // The legacy TOTAL_STEPS constant must be gone.
      return !/const\s+TOTAL_STEPS\s*=\s*6/.test(f)
          && !/onboarding\.almostDone/.test(f)
          // Step components are no longer imported (the
          // redirect shim has zero feature imports).
          && !/from\s+['"]\.\/StepFarmerType\.jsx['"]/.test(f)
          && !/from\s+['"]\.\/StepCropSelection\.jsx['"]/.test(f);
    },
  },
  {
    // Risk-fix follow-up to 9874630 \u2014 every user-facing
    // onboarding entry surface routes to the canonical
    // /onboarding/start (FastFlow):
    //   \u2022 FarmerEntry post-auth no-farm path
    //   \u2022 BeginnerReassurance Continue button
    //   \u2022 OnboardingFlow legacy /onboarding/simple route
    //     (now an unconditional redirect-only shim)
    name: 'Canonical onboarding entry points all route to /onboarding/start',
    why:  'Risk-fix \u2014 single user-facing onboarding flow',
    pass: () => {
      const farmerEntry  = read('src/pages/FarmerEntry.jsx');
      const reassurance  = read('src/pages/BeginnerReassurance.jsx');
      const simpleFlow   = read('src/onboarding/OnboardingFlow.jsx');
      const farmerOk = /['"]\/onboarding\/start['"]\s*:\s*['"]\/beginner-reassurance['"]/.test(farmerEntry);
      const reassureOk = /navigate\(\s*['"]\/onboarding\/start['"],\s*\{\s*replace:\s*true\s*\}\s*\)/.test(reassurance);
      // OnboardingFlow shim: unconditional navigate to
      // /onboarding/start via the CANONICAL_ENTRY constant.
      const simpleOk = /CANONICAL_ENTRY\s*=\s*['"]\/onboarding\/start['"]/.test(simpleFlow)
                    && /navigate\(CANONICAL_ENTRY,\s*\{\s*replace:\s*true\s*\}\)/.test(simpleFlow);
      return farmerOk && reassureOk && simpleOk;
    },
  },
  {
    // Farm/garden separation spec \u00a74 \u2014 search input above the
    // tile grid so users can filter to their plant/crop quickly.
    // "Other" stays visible regardless of the query so the
    // free-text fallback is always reachable.
    name: 'Setup forms ship plant / crop search input above tile grid',
    why:  'Farm/garden separation spec \u00a74 \u2014 user can search the tile list',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      return /onboarding\.searchPlant/.test(garden)
          && /data-testid=["']quick-garden-plant-search["']/.test(garden)
          && /plantQuery/.test(garden)
          // "Other" tile bypasses the filter so free-text path
          // is always reachable from the picker.
          && /opt\.value\s*===\s*['"]other['"]\)\s*return true/.test(garden)
          && /onboarding\.searchCrop/.test(farm)
          && /data-testid=["']quick-farm-crop-search["']/.test(farm)
          && /cropQuery/.test(farm);
    },
  },
  {
    // OBSOLETE \u2014 the legacy 6-step pill no longer exists. The
    // canonical FastFlow uses a continuous progress bar instead
    // of any step pill at all (clean-onboarding spec \u00a75).
    // Replaced with a "no scary step count anywhere" assertion
    // that scans the entire flow surface for the legacy
    // "Step X of 6" pattern.
    name: 'No "Step X of 6" pattern anywhere in onboarding flow',
    why:  'Risk-fix \u2014 legacy 6-step pill is fully retired',
    pass: () => {
      const flow   = read('src/pages/onboarding/FastFlow.jsx');
      const shim   = read('src/onboarding/OnboardingFlow.jsx');
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Reject any literal "of 6" string written into source
      // (translations.js carries the {step}/{total} template
      // and isn't part of the rendered surface check).
      const NO_HARDCODED_OF_SIX = (s) => !/of\s*['"]?6/.test(s);
      return NO_HARDCODED_OF_SIX(flow)
          && NO_HARDCODED_OF_SIX(shim)
          && NO_HARDCODED_OF_SIX(garden)
          && NO_HARDCODED_OF_SIX(farm);
    },
  },
  {
    // Farm/garden separation spec \u00a76 \u2014 Quick setup forms
    // persist a draft snapshot via localStore so back-navigation
    // doesn't lose data. Drafts are wiped on a successful save
    // so the next setup attempt starts blank.
    name: 'Quick setup forms persist draft state for back-preservation',
    why:  'Farm/garden separation spec \u00a76 \u2014 back preserves data',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Production-hardening: setup forms now route through the
      // versioned + sanitised draft helpers in onboardingDraft.js
      // instead of calling localStore directly. The helpers
      // include malformed-draft auto-clear + telemetry.
      return /loadGardenDraft\(\)/.test(garden)
          && /saveGardenDraft\(/.test(garden)
          && /clearGardenDraft\(\)/.test(garden)
          && /loadFarmDraft\(\)/.test(farm)
          && /saveFarmDraft\(/.test(farm)
          && /clearFarmDraft\(\)/.test(farm);
    },
  },
  {
    // Production-hardening spec \u00a72\u2013\u00a73 \u2014 the onboarding-draft
    // module ships a versioned + sanitised load/save path so a
    // malformed draft can never crash the form.
    name: 'onboardingDraft module ships versioned sanitised I/O',
    why:  'Production-hardening spec \u00a72\u2013\u00a73 \u2014 malformed draft never crashes',
    pass: () => {
      const f = read('src/core/onboardingDraft.js');
      // Merge-spec bumped CURRENT_ONBOARDING_DRAFT_VERSION
      // from 2 to 3 (growingSetup taxonomy renamed). Accept
      // any version >= 2 so a future bump doesn't trip this.
      return /CURRENT_ONBOARDING_DRAFT_VERSION\s*=\s*[2-9]/.test(f)
          && /export function sanitizeGardenDraft/.test(f)
          && /export function sanitizeFarmDraft/.test(f)
          && /export function loadGardenDraft/.test(f)
          && /export function saveGardenDraft/.test(f)
          && /export function clearGardenDraft/.test(f)
          && /export function loadFarmDraft/.test(f)
          && /export function saveFarmDraft/.test(f)
          && /export function clearFarmDraft/.test(f)
          && /export function clearAllOnboardingDrafts/.test(f)
          && /version\s*!==\s*CURRENT_ONBOARDING_DRAFT_VERSION/.test(f)
          && /onboarding_draft_malformed/.test(f);
    },
  },
  {
    // Production-hardening spec \u00a76 \u2014 OnboardingProgressBar
    // MUST live in its own leaf module + setup forms MUST NOT
    // import it from FastFlow.jsx. Belt-and-braces against the
    // cross-coupling that caused the recovery-card crash.
    name: 'OnboardingProgressBar never imported from FastFlow.jsx',
    why:  'Production-hardening spec \u00a76 \u2014 leaf-module rule cannot be reintroduced',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Forbidden import shape: importing from /onboarding/FastFlow.jsx.
      const FORBIDDEN = /from\s+['"]\.\.\/onboarding\/FastFlow\.jsx['"]/;
      // Required import shape: importing from the leaf module.
      const REQUIRED  = /from\s+['"]\.\.\/\.\.\/components\/onboarding\/OnboardingProgressBar\.jsx['"]/;
      return !FORBIDDEN.test(garden)
          && !FORBIDDEN.test(farm)
          && REQUIRED.test(garden)
          && REQUIRED.test(farm);
    },
  },
  {
    // Production-hardening spec \u00a74 \u2014 RecoveryErrorBoundary uses
    // user-friendly copy ("Fix setup issue") and the new
    // "Try again" / "Fix setup issue" / "Restart setup" buttons.
    // The legacy "Clear local app cache" wording is gone.
    name: 'RecoveryErrorBoundary ships user-friendly copy + 3-button layout',
    why:  'Production-hardening spec \u00a74\u2013\u00a75 \u2014 non-technical recovery UX',
    pass: () => {
      const f = read('src/components/system/RecoveryErrorBoundary.jsx');
      return /recovery\.tryAgain/.test(f)
          && /recovery\.fixSetup/.test(f)
          && /recovery\.restart/.test(f)
          && /Fix setup issue/.test(f)
          && /Try again/.test(f)
          && /Your saved farm or garden is safe/.test(f)
          && /clearAllOnboardingDrafts/.test(f)
          // Legacy "Clear local app cache" button is removed.
          // We check for the testid (not the visible text) so a
          // comment that documents the change doesn't trip the
          // guard. recovery-clear was the testid of the dropped
          // 4th button.
          && !/data-testid="recovery-clear"/.test(f)
          // Legacy "Repair session" button is removed (the 3-button
          // layout collapses onto Try again / Fix / Restart).
          && !/data-testid="recovery-repair"/.test(f)
          // Legacy testid for the old reload button is removed
          // \u2014 the new "Try again" action uses recovery-try-again.
          && !/data-testid="recovery-reload"/.test(f)
          // Telemetry on shown + used.
          && /onboarding_recovery_shown/.test(f)
          && /onboarding_recovery_used/.test(f);
    },
  },
  {
    // Production-hardening spec \u00a71 \u2014 FastFlow fires the
    // canonical onboarding telemetry events at every meaningful
    // step transition.
    name: 'FastFlow fires onboarding_started + step_viewed + step_completed',
    why:  'Production-hardening spec \u00a71 \u2014 canonical funnel events',
    pass: () => {
      const f = read('src/pages/onboarding/FastFlow.jsx');
      return /trackEvent\(\s*['"]onboarding_started['"]/.test(f)
          && /trackEvent\(\s*['"]onboarding_step_viewed['"]/.test(f)
          && /trackEvent\(\s*['"]onboarding_step_completed['"]/.test(f);
    },
  },
  {
    // Risk-fix \u2014 the legacy /onboarding/simple route is now an
    // unconditional redirect-only shim. The 6-step body is gone.
    // No flag, no feature toggle, no draft handling \u2014 just a
    // useEffect that calls navigate(CANONICAL_ENTRY) on mount.
    // This collapses the parallel onboarding paths so every
    // future polish + hardening fix lands in one place.
    name: '/onboarding/simple is a redirect-only shim (no rendered body)',
    why:  'Risk-fix \u2014 legacy flow consolidated into canonical /onboarding/start',
    pass: () => {
      const f = read('src/onboarding/OnboardingFlow.jsx');
      return /CANONICAL_ENTRY\s*=\s*['"]\/onboarding\/start['"]/.test(f)
          && /useEffect\(\s*\(\)\s*=>/.test(f)
          && /navigate\(CANONICAL_ENTRY,\s*\{\s*replace:\s*true\s*\}\)/.test(f)
          // Shim returns null, no rendered output.
          && /return null;/.test(f)
          // Forbidden: any of the legacy step-flow imports.
          && !/StepFarmerType/.test(f)
          && !/StepLocation/.test(f)
          && !/StepCropSelection/.test(f)
          && !/StepFarmSetup/.test(f)
          && !/StepDailyPlanPreview/.test(f)
          // Forbidden: the legacy feature flag check.
          && !/FEATURE_SIMPLE_ONBOARDING/.test(f)
          // Forbidden: any draft / store I/O that belonged to
          // the old body.
          && !/loadOnboardingProfile/.test(f)
          && !/completeOnboarding/.test(f);
    },
  },
  {
    // Final-merged onboarding spec \u00a74 \u2014 language screen helper
    // copy reads "Suggested for your location" instead of the
    // legacy country-interpolated "Best matches for {country}".
    name: 'StepLanguage helper reads "Suggested for your location"',
    why:  'Final-merged onboarding spec \u00a74 \u2014 conversational location-aware copy',
    pass: () => {
      const f = read('src/onboarding/StepLanguage.jsx');
      return /onboarding\.languageHelperLocation/.test(f)
          && /Suggested for your location/.test(f)
          // Legacy "Best matches for" + country interpolation
          // is gone (the key may stay in translations.js for
          // any external callers but is no longer consumed
          // here).
          && !/onboarding\.languageHelperWithCountry/.test(f);
    },
  },
  {
    // Final-merged onboarding spec \u00a75 \u2014 review-screen task
    // titles tighten + diverge garden vs farm. Garden uses
    // "Check your plant"; farm uses "Check your crop"; both
    // include "Scan if you see damage" instead of the legacy
    // "Ask Farroway if you are unsure" CTA. The "do these
    // first" hint reads "Follow these steps today to keep your
    // plant/crop healthy" depending on experience.
    name: 'StepDailyPlanPreview ships tightened garden/farm-aware copy',
    why:  'Final-merged onboarding spec \u00a75 \u2014 action-first review copy',
    pass: () => {
      const f = read('src/onboarding/StepDailyPlanPreview.jsx');
      return /preview\.title\.checkPlant/.test(f)
          && /preview\.title\.checkCrop/.test(f)
          && /preview\.title\.scan/.test(f)
          && /onboarding\.newFarmerHint\.garden/.test(f)
          && /onboarding\.newFarmerHint\.farm/.test(f)
          && /isGardenPreview/.test(f)
          // Legacy "Start simple" hint is gone.
          && !/Start simple\. Do these actions first/.test(f)
          // Legacy "Ask Farroway if you are unsure" fallback
          // task is gone \u2014 replaced by "Scan if you see damage".
          && !/Ask Farroway if you are unsure/.test(f);
    },
  },
  {
    // Final-merged onboarding spec \u2014 every new copy key is
    // present in the canonical translations store across all
    // launch languages (per-language parity is enforced
    // separately by guard:i18n-parity).
    name: 'translations.js ships new final-merged onboarding keys',
    why:  'Final-merged onboarding spec \u2014 every copy key present',
    pass: () => {
      const f = read('src/i18n/translations.js');
      const KEYS = [
        'onboarding.languageHelperLocation',
        'onboarding.newFarmerHint.garden',
        'onboarding.newFarmerHint.farm',
        'preview.title.checkPlant',
        'preview.title.checkCrop',
        'preview.title.scan',
        'preview.reason.checkPlant',
        'preview.reason.scan',
      ];
      for (const k of KEYS) {
        const re = new RegExp(`['"]${k.replace(/\./g, '\\.')}['"]\\s*:`);
        if (!re.test(f)) return false;
      }
      return true;
    },
  },
  {
    // Risk-fix follow-up to 6fad99c \u2014 the polished review-screen
    // copy was staged in legacy code (StepDailyPlanPreview) that
    // the redirect-only OnboardingFlow never mounts. The new
    // OnboardingReviewPanel leaf component brings the review
    // framing into the canonical /setup/{garden,farm} Quick
    // setup flow, so every user sees "Review your first plan"
    // + the 3 tightened action tiles + the experience-aware
    // hint BEFORE tapping Save.
    name: 'OnboardingReviewPanel mounted in canonical Quick setup forms',
    why:  'Risk-fix \u2014 review screen polish reaches the canonical user-facing flow',
    pass: () => {
      const panel  = read('src/components/onboarding/OnboardingReviewPanel.jsx');
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const panelOk = /export default function OnboardingReviewPanel/.test(panel)
                   && /onboarding\.review\.title/.test(panel)
                   // The panel migrated from review.helper to
                   // review.subtitle as the under-title copy
                   // (go-live merged spec \u00a76).
                   && /onboarding\.review\.subtitle/.test(panel)
                   && /onboarding\.newFarmerHint\.garden/.test(panel)
                   && /onboarding\.newFarmerHint\.farm/.test(panel)
                   && /preview\.title\.checkPlant/.test(panel)
                   && /preview\.title\.checkCrop/.test(panel)
                   && /preview\.title\.scan/.test(panel)
                   && /data-testid=["']onboarding-review-panel["']/.test(panel);
      const gardenOk = /from ['"]\.\.\/\.\.\/components\/onboarding\/OnboardingReviewPanel\.jsx['"]/.test(garden)
                    && /<OnboardingReviewPanel/.test(garden)
                    && /experience="garden"/.test(garden);
      const farmOk   = /from ['"]\.\.\/\.\.\/components\/onboarding\/OnboardingReviewPanel\.jsx['"]/.test(farm)
                    && /<OnboardingReviewPanel/.test(farm)
                    && /experience="farm"/.test(farm);
      return panelOk && gardenOk && farmOk;
    },
  },
  {
    // Merge-spec \u00a73 \u2014 the review panel renders the user's
    // actual picks (Plant + Location + Growing setup for
    // garden, Crop + Location + Farm size for farm) with a
    // "Change X" button per row that scrolls to the relevant
    // form section. Anchors live on the form sections so a
    // smooth scroll keeps the user in-page.
    name: 'Review panel renders Your-picks summary + Change buttons',
    why:  'Merge-spec \u00a73 \u2014 user sees their picks + can jump back to edit any',
    pass: () => {
      const panel  = read('src/components/onboarding/OnboardingReviewPanel.jsx');
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const panelOk = /scrollToAnchor/.test(panel)
                   && /onboarding-review-summary/.test(panel)
                   && /onboarding-review-change-plant/.test(panel)
                   && /onboarding-review-change-crop/.test(panel)
                   && /onboarding-review-change-location/.test(panel)
                   && /onboarding-review-change-growing-setup/.test(panel)
                   && /onboarding-review-change-farm-size/.test(panel)
                   // SummaryRow component wired with label + value.
                   && /function SummaryRow/.test(panel);
      // Garden form passes plant + location + growingSetup.
      const gardenOk = /summary=\{\{[\s\S]*?plant:[\s\S]*?location:[\s\S]*?growingSetup:/.test(garden)
                    // Anchor IDs present on the form sections.
                    && /id="review-plant"/.test(garden)
                    && /id="review-location"/.test(garden)
                    && /id="review-growing-setup"/.test(garden);
      // Farm form passes crop + location + farmSize.
      const farmOk   = /summary=\{\{[\s\S]*?crop:[\s\S]*?location:[\s\S]*?farmSize:/.test(farm)
                    && /id="review-crop"/.test(farm)
                    && /id="review-location"/.test(farm)
                    && /id="review-farm-size"/.test(farm);
      return panelOk && gardenOk && farmOk;
    },
  },
  {
    // Premium-logo migration \u2014 every brand surface points at
    // the canonical logo-premium.* family. The legacy
    // farroway-mark.{svg,jpg} + raw /icon-192.png + logo-shield
    // paths must NOT appear in any of the well-known reference
    // sites (brand registry, index.html, manifest.json,
    // notification service, FarrowayLogo fallback).
    name: 'Brand surfaces point at logo-premium.* (no legacy paths)',
    why:  'Premium-logo migration \u2014 single source of truth for the brand mark',
    pass: () => {
      const FILES = [
        'src/brand/farrowayBrand.js',
        'index.html',
        'public/manifest.json',
        'src/services/notificationService.js',
        'src/components/FarrowayLogo.jsx',
      ];
      for (const rel of FILES) {
        const body = read(rel);
        // Forbidden legacy paths (filename-only check so a
        // build-output hash can't accidentally match).
        if (/farroway-mark\.(svg|jpg)/.test(body))            return false;
        if (/logo-shield\.png/.test(body))                    return false;
        // The raw /icon-192.png + /icon-512.png + apple-touch-
        // icon.png paths from the old PWA manifest are also
        // gone. Allowed in the SW (which legitimately caches
        // both names for back-compat) so we skip src/sw.js /
        // public/sw.js.
        if (/['"]\/icon-(?:192|512)\.png['"]/.test(body))     return false;
        if (/['"]\/apple-touch-icon\.png['"]/.test(body))     return false;
      }
      // The new family must show up at canonical sites.
      const brand    = read('src/brand/farrowayBrand.js');
      const html     = read('index.html');
      const manifest = read('public/manifest.json');
      return /logo-premium/.test(brand)
          && /logo-premium/.test(html)
          && /logo-premium/.test(manifest);
    },
  },
  {
    // Final-onboarding-polish spec \u00a71 \u2014 the FastFlow header
    // mounts the premium logo as an <img> instead of the
    // legacy emoji. Sets a fixed 32px height + objectFit so
    // the image never stretches or crops.
    name: 'FastFlow header mounts premium logo image (no emoji)',
    why:  'Final-onboarding-polish spec \u00a71 \u2014 premium logo on onboarding header',
    pass: () => {
      const f = read('src/pages/onboarding/FastFlow.jsx');
      return /<img[\s\S]{0,160}src="\/icons\/logo-premium\.jpg"/.test(f)
          && /brandLogoImg/.test(f)
          // Legacy emoji removed from the Header's brand row.
          && !/<span style=\{S\.brandLogo\} aria-hidden="true">\uD83C\uDF31<\/span>/.test(f);
    },
  },
  {
    // Final-onboarding-polish spec \u00a76 \u2014 tagline reads
    // "Know what to do today. Grow better." with the new
    // "today" qualifier. Brand registry is the single source
    // of truth; translations.js + manifest.json mirror.
    name: 'Brand tagline reads "Know what to do today. Grow better."',
    why:  'Final-onboarding-polish spec \u00a76 \u2014 tagline conversion polish',
    pass: () => {
      const brand    = read('src/brand/farrowayBrand.js');
      const trans    = read('src/i18n/translations.js');
      const manifest = read('public/manifest.json');
      const html     = read('index.html');
      const PHRASE = /Know what to do today\. Grow better\./;
      return PHRASE.test(brand)
          && PHRASE.test(trans)
          && PHRASE.test(manifest)
          && PHRASE.test(html);
    },
  },
  {
    // Stability-patch \u00a74 \u2014 Quick setup forms are now
    // multi-step state machines (one decision per screen),
    // not single scrollable stacked forms. Each setup ships
    // a subStep state, canAdvance gate, handleBack +
    // handleContinue, and the review-screen Change buttons
    // jump back via setSubStep (state-based, NOT scrollIntoView).
    name: 'Quick setup forms are multi-step (one decision per screen)',
    why:  'Stability-patch \u00a74 + onboarding-polish \u00a72 \u2014 stacked form removed; back preserves data; garden splits growing-setup + size onto separate sub-steps',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const COMMON = (f) =>
            /\[\s*subStep,\s*setSubStep\s*\]\s*=\s*useState\(0\)/.test(f)
         && /function canAdvance/.test(f)
         && /function handleBack/.test(f)
         && /function handleContinue/.test(f)
         && /\{\s*subStep === 0\s*&&/.test(f)
         && /\{\s*subStep === 1\s*&&/.test(f)
         && /\{\s*subStep === 2\s*&&/.test(f)
         && /\{\s*subStep === 3\s*&&/.test(f)
         // Review panel jumps back via state, not scroll.
         && /onChangeStep=\{/.test(f)
         && /setSubStep\(\d\)/.test(f);
      // Garden form: 5 sub-steps (location \u2192 plant \u2192 growing
      // setup \u2192 garden size \u2192 review). Onboarding-polish patch
      // \u00a72 split garden size out of the growing-setup screen.
      const GARDEN_OK = COMMON(garden)
         && /TOTAL_SUB_STEPS\s*=\s*5/.test(garden)
         && /\{\s*subStep === 4\s*&&/.test(garden);
      // Farm form: still 4 sub-steps (location \u2192 crop \u2192
      // farm size \u2192 review). Farm size has its own screen
      // already; no split needed.
      const FARM_OK = COMMON(farm)
         && /TOTAL_SUB_STEPS\s*=\s*4/.test(farm);
      return GARDEN_OK && FARM_OK;
    },
  },
  {
    // Stability-patch \u00a71 \u2014 the FastFlow header logo image
    // ships an onError fallback that hides the <img> if it
    // fails to load. No "?" placeholder, no broken-image icon.
    name: 'FastFlow header logo has onError fallback (no broken icon)',
    why:  'Stability-patch \u00a71 \u2014 broken logo never shows a placeholder',
    pass: () => {
      const f = read('src/pages/onboarding/FastFlow.jsx');
      return /logoFailed/.test(f)
          && /onError=\{\(\)\s*=>\s*setLogoFailed\(true\)\}/.test(f)
          && /logoFailed \?\s*null/.test(f);
    },
  },
  {
    // First-plan engine \u2014 generates a stage + weather-aware
    // action list inline on the review screen so the user's
    // first plan is personalised to what they just told us.
    // Coexists with dailyIntelligenceEngine.generateDailyPlan
    // (which drives /home daily card from the full farm
    // record); this engine is a slimmer pure function for
    // the END of onboarding.
    name: 'firstPlanEngine ships generateFirstPlan with stage + weather logic',
    why:  'First-plan engine spec \u2014 personalised first daily plan on review',
    pass: () => {
      const f = read('src/core/firstPlanEngine.js');
      return /export function generateFirstPlan/.test(f)
          // Stage detector covers the 4 named stages.
          && /germination/.test(f)
          && /['"]early growth['"]/.test(f)
          && /vegetative/.test(f)
          && /mature/.test(f)
          // Weather thresholds match the spec: rainChance > 60,
          // humidity > 70, temp > 30.
          && /rainChance\)\s*>\s*60/.test(f)
          && /humidity\)\s*>\s*70/.test(f)
          && /temp\)\s*>\s*30/.test(f)
          // Action types: inspection / watering / risk /
          // growth / scan all referenced.
          && /type:\s*['"]inspection['"]/.test(f)
          && /type:\s*['"]watering['"]/.test(f)
          && /type:\s*['"]risk['"]/.test(f)
          && /type:\s*['"]growth['"]/.test(f)
          && /type:\s*['"]scan['"]/.test(f)
          // isGarden flips plant\u2194crop wording.
          && /isGarden/.test(f);
    },
  },
  {
    // Quick setup forms compute the first plan from current
    // state + cached weather and pass the action list to
    // the review panel. The panel renders dynamic actions
    // when provided, otherwise falls back to the static
    // 3-task list.
    name: 'Quick setup forms feed firstPlan into the review panel',
    why:  'First-plan engine spec \u2014 review screen reflects user\u2019s entries',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const panel  = read('src/components/onboarding/OnboardingReviewPanel.jsx');
      return /from ['"]\.\.\/\.\.\/core\/firstPlanEngine\.js['"]/.test(garden)
          && /actions=\{generateFirstPlan\(/.test(garden)
          && /isGarden:\s*true/.test(garden)
          && /from ['"]\.\.\/\.\.\/core\/firstPlanEngine\.js['"]/.test(farm)
          && /actions=\{generateFirstPlan\(/.test(farm)
          && /isGarden:\s*false/.test(farm)
          // Panel accepts the actions prop and renders dynamic
          // tasks ahead of the static fallback.
          && /actions:\s*dynamicActions/.test(panel)
          && /dynamicActions\.slice\(0,\s*3\)/.test(panel);
    },
  },
  {
    // Invisible-intelligence engine \u2014 the orchestrator behind
    // Today's Plan. Composes weather + stage + scale + setup +
    // crop-pack signals into the spec output shape (priority +
    // secondary + risks + explanation + confidence + follow-up).
    // Coexists with dailyIntelligenceEngine.generateDailyPlan
    // (legacy) and firstPlanEngine.generateFirstPlan (onboarding
    // review).
    name: 'farrowayIntelligenceEngine ships full spec contract',
    why:  'Invisible-intelligence spec \u00a71\u2013\u00a77 \u2014 priority/secondary/risk/explanation/follow-up',
    pass: () => {
      const f = read('src/core/farrowayIntelligenceEngine.js');
      return /export function generateIntelligentPlan/.test(f)
          // 6 named stages including the new flowering stage.
          && /germination/.test(f)
          && /early_growth/.test(f)
          && /vegetative/.test(f)
          && /flowering/.test(f)
          && /mature/.test(f)
          // Weather thresholds.
          && /rainChance[\s\S]{0,40}>\s*60/.test(f)
          && /humidity[\s\S]{0,80}>\s*70/.test(f)
          && /temp[\s\S]{0,80}>\s*30/.test(f)
          // Wind threshold for spray-warning rule.
          && /WIND_KMH_THRESHOLD\s*=\s*25/.test(f)
          // Crop rule packs (spec \u00a76).
          && /CROP_PACKS/.test(f)
          && /pepper:/.test(f)
          && /tomato:/.test(f)
          && /maize:/.test(f)
          && /herbs:/.test(f)
          // Growing-setup packs (spec \u00a74).
          && /SETUP_PACKS/.test(f)
          && /container:/.test(f)
          && /raised_bed:/.test(f)
          && /ground:/.test(f)
          && /indoor_balcony:/.test(f)
          // Farm-scale tiers (spec \u00a75).
          && /small_farm/.test(f)
          && /medium_farm/.test(f)
          && /large_farm/.test(f)
          // Output shape \u2014 spec mandates these 6 keys.
          && /todaysPriority/.test(f)
          && /secondaryTasks/.test(f)
          && /riskSignals/.test(f)
          && /explanation/.test(f)
          && /confidence/.test(f)
          && /followUpTask/.test(f);
    },
  },
  {
    // Invisible-intelligence \u00a78 \u2014 Home integration. DailyPlanCard
    // composes the new engine output on top of the existing
    // generateDailyPlan: priority + secondary become actions[],
    // risk signals fold into alerts[], explanation + followUp
    // render as new slots.
    name: 'DailyPlanCard composes farrowayIntelligenceEngine output',
    why:  'Invisible-intelligence spec \u00a78 \u2014 Home shows priority + risks + follow-up',
    pass: () => {
      const f = read('src/components/daily/DailyPlanCard.jsx');
      return /from ['"]\.\.\/\.\.\/core\/farrowayIntelligenceEngine\.js['"]/.test(f)
          && /generateIntelligentPlan\(/.test(f)
          && /todaysPriority/.test(f)
          && /secondaryTasks/.test(f)
          && /riskSignals/.test(f)
          && /explanation:\s*intel\.explanation/.test(f)
          && /followUpTask:\s*intel\.followUpTask/.test(f)
          // New render slots wired up.
          && /data-testid=["']daily-plan-explanation["']/.test(f)
          && /data-testid=["']daily-followup["']/.test(f);
    },
  },
  {
    // Location-screen UX cleanup \u2014 humanizer-leaking keys
    // (setup.garden.title / .subtitle / .countryPh / .regionPh
    // / .geoDenied) used to surface as literal "Title",
    // "Subtitle", "Country Ph", "Geo Denied" because their
    // tails humanise into those strings and tStrict doesn't
    // detect humanised values as missing.
    //
    // The Location step now uses long-tail keys that humanise
    // gracefully even when missing:
    //   onboarding.locationSubtitle / .useMyCurrentLocation /
    //   .detectingLocation / .locationFailed / .selectCountry /
    //   .enterRegion. The legacy keys are no longer rendered
    //   in the Quick setup forms.
    name: 'Location step uses clean copy keys (no humanizer leaks)',
    why:  'Location-screen UX cleanup \u2014 no "Title" / "Country Ph" / "Geo Denied"',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Required: new copy keys present on both forms.
      const REQ = (f) =>
            /onboarding\.locationSubtitle/.test(f)
         && /onboarding\.useMyCurrentLocation/.test(f)
         && /onboarding\.detectingLocation/.test(f)
         && /onboarding\.locationFailed/.test(f)
         && /onboarding\.selectCountry/.test(f)
         && /onboarding\.enterRegion/.test(f);
      // Forbidden: legacy keys whose tails humanise into
      // user-visible junk.
      const NO_LEAKS = (f) =>
            !/setup\.garden\.title['"]/.test(f)
         && !/setup\.garden\.subtitle/.test(f)
         && !/setup\.garden\.countryPh/.test(f)
         && !/setup\.garden\.regionPh/.test(f)
         && !/setup\.garden\.geoDenied/.test(f)
         && !/setup\.farm\.title['"]/.test(f)
         && !/setup\.farm\.subtitle/.test(f)
         && !/setup\.farm\.countryPh/.test(f)
         && !/setup\.farm\.regionPh/.test(f)
         && !/setup\.farm\.geoDenied/.test(f);
      // Continue gate must accept geolocation-succeeded as
      // a valid entry path (not just country.trim()).
      const GATE = (f) =>
            /geoStatus === ['"]ok['"]/.test(f)
         && /country\.trim\(\)\s*\|\|\s*geoStatus === ['"]ok['"]/.test(f);
      return REQ(garden) && NO_LEAKS(garden) && GATE(garden)
          && REQ(farm)   && NO_LEAKS(farm)   && GATE(farm);
    },
  },
  {
    // Go-live merged spec \u2014 review screen + onboarding copy
    // overhaul. Title swaps from "Review your first plan" to
    // "Your plan is ready"; subtitle to "Here's what to do
    // today."; Save CTAs unify on "Start using Farroway"; the
    // "I don't know" affirmations become "Not sure"; the
    // pickPlant/pickCrop titles become "What are you growing?"
    // / "Which crop are you growing?".
    name: 'Go-live copy: Your plan is ready / Start using Farroway / Not sure',
    why:  'Go-live merged spec \u00a76 + \u00a74 + \u00a75 \u2014 final review + size copy',
    pass: () => {
      const trans  = read('src/i18n/translations.js');
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      // Translations carry the new English values.
      const Q = (key, value) => {
        const re = new RegExp(
          `'${key.replace(/\./g, '\\\\.')}':\\s*\\{[^}]*?en:\\s*'${
            value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
          }`);
        return re.test(trans);
      };
      // The translations file stores curly apostrophes as the
      // literal `\u2019` escape sequence (7 ASCII chars), not
      // the single Unicode character. Match the literal escape
      // form so a JS regex compile doesn't resolve the escape
      // at compile time.
      const reviewTitle = /'onboarding\.review\.title':[\s\S]{0,160}en:\s*'Your plan is ready'/.test(trans);
      const reviewSub   = /'onboarding\.review\.subtitle':[\s\S]{0,200}en:\s*'Here\\u2019s what to do today\.'/.test(trans);
      const editPrompt  = /'onboarding\.review\.editPrompt':[\s\S]{0,200}en:\s*'Want to change anything\?'/.test(trans);
      const startUsing  = /'onboarding\.review\.startUsing':[\s\S]{0,200}en:\s*'Start using Farroway'/.test(trans);
      const startSimple = /'onboarding\.review\.startSimple':[\s\S]{0,200}en:\s*'Start simple\. Do these first:'/.test(trans);
      const pickPlant   = /'onboarding\.pickPlant\.title':[\s\S]{0,200}en:\s*'What are you growing\?'/.test(trans);
      const pickCrop    = /'onboarding\.pickCrop\.title':[\s\S]{0,200}en:\s*'Which crop are you growing\?'/.test(trans);
      const setupTitle  = /'garden\.growingSetup\.title':[\s\S]{0,200}en:\s*'How are you growing your plants\?'/.test(trans);
      // Save CTAs unify on the new key.
      const gardenCTA = /tStrict\(\s*'onboarding\.review\.startUsing'/.test(garden);
      const farmCTA   = /tStrict\(\s*'onboarding\.review\.startUsing'/.test(farm);
      // "Not sure" replaces "I don't know" on size + setup unknown.
      const notSure = /'garden\.growingSetup\.unknown':[\s\S]{0,80}en:\s*'Not sure'/.test(trans)
                   && /'onboarding\.gardenSize\.unknown':[\s\S]{0,80}en:\s*'Not sure'/.test(trans)
                   && /'onboarding\.farmSize\.unknown':[\s\S]{0,80}en:\s*'Not sure'/.test(trans);
      return reviewTitle && reviewSub && editPrompt && startUsing && startSimple
          && pickPlant && pickCrop && setupTitle
          && gardenCTA && farmCTA && notSure;
    },
  },
  {
    // Go-live spec \u00a78 \u2014 contextResolver returns flat
    // country/region/sizeSqFt/displayUnit fields plus the
    // existing nested `location` so every consumer sees the
    // same shape.
    name: 'contextResolver returns flat country / region / sizeSqFt / displayUnit',
    why:  'Go-live spec \u00a78 \u2014 stable context shape, no undefined keys',
    pass: () => {
      const f = read('src/core/contextResolver.js');
      // Fields are bare-shorthand in the return object
       // (`country,` not `country: country,`), so match either
       // shape.
      const HAS = (name) => new RegExp(`\\b${name}\\s*[,:]`).test(f);
      return HAS('activeExperience')
          && HAS('country')
          && HAS('region')
          && HAS('sizeSqFt')
          && HAS('displayUnit');
    },
  },
  {
    // Go-live spec \u00a714 \u2014 lightweight analytics shim at
    // src/core/analytics.js (spec asked for .ts; codebase rule
    // is JS-only). Re-exports trackEvent from the canonical
    // analyticsStore so a single emit pipeline stays in place.
    name: 'src/core/analytics ships trackEvent shim re-export',
    why:  'Go-live spec \u00a714 \u2014 spec-pathed analytics import resolves',
    pass: () => {
      const f = read('src/core/analytics.js');
      return /export\s*\{\s*trackEvent\s*\}\s*from\s*['"]\.\.\/analytics\/analyticsStore\.js['"]/.test(f);
    },
  },
  {
    // Onboarding-polish patch \u00a71. The floating voice-nav button
    // is hidden on every onboarding + setup screen so the user
    // is never offered "scan crop" / "my farm" voice navigation
    // before they actually own a farm/garden. Two layered gates:
    // (a) the isOnboardingComplete() flag returns false until
    // setOnboardingComplete() fires inside the save handler;
    // (b) the path-based hidden list catches /onboarding and
    // /setup so the mic stays hidden even on cold paint while
    // the flag write hasn't yet propagated to localStorage.
    name: 'VoiceAssistant hides until onboarding completes',
    why:  'Onboarding-polish patch \u00a71 \u2014 mic appears only after Home loads',
    pass: () => {
      const f = read('src/components/VoiceAssistant.jsx');
      return /from\s*['"]\.\.\/utils\/onboarding\.js['"]/.test(f)
          && /isOnboardingComplete/.test(f)
          && /if\s*\(\s*!\s*isOnboardingComplete\(\)\s*\)\s*return\s*null/.test(f)
          && /'\/onboarding'/.test(f)
          && /'\/setup'/.test(f);
    },
  },
  {
    // Onboarding-polish patch \u00a72. Garden growing-setup and
    // garden size now live on SEPARATE sub-steps (2 + 3) so the
    // user makes one decision per screen. Farm size already had
    // its own screen and is unaffected.
    name: 'Garden growing-setup and size are on separate sub-steps',
    why:  'Onboarding-polish patch \u00a72 \u2014 one decision per screen',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      // Sub-step 2 = growing setup, sub-step 3 = garden size.
      // The growing-setup card is gated on === 2, the size card
      // on === 3. The review jump-back maps gardenSize \u2192 3.
      return /TOTAL_SUB_STEPS\s*=\s*5/.test(garden)
          && /subStep === 2 &&[\s\S]*?setup-garden-growing-setup/.test(garden)
          && /subStep === 3 &&[\s\S]*?setup-garden-size/.test(garden)
          && /subStep === 4 &&/.test(garden)
          && /onChangeStep=\{[\s\S]*?key === 'gardenSize'[\s\S]*?setSubStep\(3\)/.test(garden);
    },
  },
  {
    // Onboarding-polish patch \u00a73. Location step copy:
    //   subtitle \u2014 "This helps us give you the right advice for your weather."
    //   manual fallback \u2014 "Or enter it manually"
    //   error \u2014 "We couldn't detect your location. Please enter it manually."
    name: 'Location step copy: weather-advice subtitle + detect-error wording',
    why:  'Onboarding-polish patch \u00a73 \u2014 calmer, action-first location wording',
    pass: () => {
      const t = read('src/i18n/translations.js');
      // The translations file persists the curly apostrophe as the
      // literal escape sequence `\u2019`, so the regex must match
      // those six characters verbatim (one backslash, one `u`,
      // four hex digits) \u2014 hence the `couldn\\\\u2019t` source.
      // Note we also accept the modern multi-line definition (line
      // ~12551 in this build) by anchoring on the canonical
      // English wording rather than whichever duplicate definition
      // the regex engine sees first.
      return /'onboarding\.locationSubtitle':[\s\S]*?This helps us give you the right advice for your weather/.test(t)
          && /'onboarding\.locationManual':[\s\S]*?Or enter it manually/.test(t)
          && /We couldn\\u2019t detect your location\. Please enter it manually/.test(t);
    },
  },
  {
    // Onboarding-polish patch \u00a74. Onboarding primary CTA reads
    // "Next" everywhere except the final review screen (which
    // reads "Start using Farroway"). FastFlow + QuickGardenSetup
    // + QuickFarmSetup each use the new onboarding.next key.
    name: 'Onboarding CTAs read "Next" (onboarding.next key)',
    why:  'Onboarding-polish patch \u00a74 \u2014 unified Next CTA across onboarding',
    pass: () => {
      const t      = read('src/i18n/translations.js');
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const fast   = read('src/pages/onboarding/FastFlow.jsx');
      return /'onboarding\.next':[\s\S]*?en:\s*'Next'/.test(t)
          && /tStrict\(\s*'onboarding\.next'\s*,\s*'Next'\s*\)/.test(garden)
          && /tStrict\(\s*'onboarding\.next'\s*,\s*'Next'\s*\)/.test(farm)
          && /tStrict\(\s*'onboarding\.next'\s*,\s*'Next'\s*\)/.test(fast);
    },
  },
  {
    // Onboarding-polish patch \u00a75. Every onboarding option that
    // used "I don't know" now reads "Not sure". Both the
    // translation values AND the source-code fallbacks (used
    // when translations.js fails to load entirely).
    name: 'Onboarding "I don\u2019t know" replaced with "Not sure"',
    why:  'Onboarding-polish patch \u00a75 \u2014 calmer, less self-blame copy',
    pass: () => {
      const garden = read('src/pages/setup/QuickGardenSetup.jsx');
      const farm   = read('src/pages/setup/QuickFarmSetup.jsx');
      const stepFarm = read('src/onboarding/StepFarmSetup.jsx');
      const gardenForm = read('src/components/farm/GardenSetupForm.jsx');
      // No source fallback in any onboarding file should still
      // read "I don't know"; every unknown affirmation is now
      // "Not sure" in the source AND in translations.js.
      const noLeak = (f) => !/I don\\u2019t know/.test(f) && !/I don\u2019t know/.test(f);
      return noLeak(garden) && noLeak(farm) && noLeak(stepFarm) && noLeak(gardenForm);
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
