import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { loadTranslations, getCurrentLang } from './utils/i18n.js';
import { initAutoSync } from './utils/offlineQueue.js';
import api from './runtime/apiRuntime.js';
// Demo-readiness: one-line call populates the local store with a
// plausible NGO roster (farmers, farms, activity, issues) the first
// time the app boots in demo mode. Production boots are unaffected
// because `isDemoMode()` is false and the helper no-ops.
import { ensureDemoSeed } from './lib/demo/demoSeed.js';
import { isFeatureEnabled } from './config/features.js';

import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StepUpModal from './components/StepUpModal.jsx';
import SyncStatus from './components/SyncStatus.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import SWUpdateBanner from './components/system/SWUpdateBanner.jsx';
import BackyardGuard from './components/system/BackyardGuard.jsx';
// Final crash-prevention spec §1: drop-in safe guard for any
// page that reads activeExperience / activeFarmId /
// activeGardenId. Renders Loading → SignedOut → Recovery
// before delegating to children, so the dashboard never paints
// a blank screen against null data.
import ExperienceFallback from './components/system/ExperienceFallback.jsx';
import VoiceAssistant from './components/VoiceAssistant.jsx';
import OfflineSyncBanner from './components/OfflineSyncBanner.jsx';
// Global toast host — mounted ONCE so every non-React caller
// (e.g. taskActions.completeTask) can fire toasts via
// `import { showToast } from '../lib/globalToast.js'`.
import GlobalToastHost from './components/system/GlobalToastHost.jsx';
// Nature-dark theme tinter — reads weather context, applies a
// `theme-*` class to <body> so the gradient + cards re-tint
// to match rain / heat / wind / dry / normal. Pure observer.
import AppShellTheme from './components/system/AppShellTheme.jsx';
// Role theme applicator — reads the signed-in user's role and
// applies a `role-*` class to <body> so CTAs / links / badges /
// progress bars all tint to the role accent (farmer = green,
// ngo = teal, buyer = amber). Pure observer; coexists with
// AppShellTheme (different class prefix → no conflict).
import RoleThemeApplicator from './components/system/RoleThemeApplicator.jsx';
// Role-aware home redirect — sends the user to /home (farmer),
// /dashboard (ngo), or /market (buyer) based on their signed-in
// role. Drives the new role-routing system in lib/roleFeatures.js.
import RoleHomeRedirect from './components/system/RoleHomeRedirect.jsx';
import Home from './pages/Home.jsx';
import HomeErrorBoundary from './components/system/HomeErrorBoundary.jsx';
import { DashboardErrorBoundary } from './components/system/DashboardErrorBoundary.jsx';
import {
  FEATURE_EVENT_SYNC as PILOT_FEATURE_EVENT_SYNC,
  DISABLE_EVENTS,
  FEATURE_OFFLINE_SAFE,
} from './lib/pilotFlags.js';
// Focused offline reliability layer (FEATURE_OFFLINE_SAFE).
// Coexists with the existing OfflineBanner + OfflineSyncBanner;
// this layer exclusively handles the spec-defined storage keys
// and bounded sync (max 1 retry, 400s dropped, no interval).
import OfflineSafeStatusBanner from './components/OfflineSafeStatusBanner.jsx';
import { installSafeOnlineSync } from './lib/offline/safeOnlineSync.js';

// One-shot warner for /api/events 400 responses. Prevents the
// console-spam loop from a permanently-malformed payload —
// emits exactly once per process, then silently drops every
// subsequent 400 from the same source.
let _eventsBadRequestWarned = false;
function _warnEventsBadRequestOnce(name) {
  if (_eventsBadRequestWarned) return;
  _eventsBadRequestWarned = true;
  try {
     
    console.warn(
      '[Farroway] POST /api/events returned 400 for "'
      + (typeof name === 'string' ? name : 'unknown')
      + '". Dropping event and any further 400 responses '
      + 'are suppressed (this warning fires once).'
    );
  } catch { /* swallow */ }
}
// Role-aware dashboard wrapper — picks the right page for
// /dashboard based on user.role. Farmer → V2Dashboard;
// ngo / admin → NgoDashboardV1.
import RoleAwareDashboard from './components/system/RoleAwareDashboard.jsx';
import { syncQueue } from './offline/syncManager.js';
import { makeTransport as makeOfflineTransport } from './lib/sync/transport.js';
import { refreshSession } from './lib/api.js';
// Production-readiness: drains the IndexedDB outbox at /api/sync.
// Sits alongside the existing offline-queue + sync-manager systems
// without replacing them - it's the path the new Farroway core
// (TodayCard / progressStore / actionQueue) writes into.
import { useSyncLoop } from './sync/syncWorker.js';
// Hydrate the IDB-backed farm + progress mirrors on boot so the
// first synchronous getCurrentFarm() / getProgress() call after
// reload is fresh, even when another tab updated IDB while this
// tab was closed.
import { hydrateFarm } from './core/farroway/farmStore.js';
import { hydrateProgress } from './core/farroway/progressStore.js';
// Onboarding-loop fix (Apr 2026): restore the user's saved
// language preference on app boot. The setup screen persists this
// at the same time it sets the onboarding-done flag, so a
// returning user lands on the app in their last chosen language
// without going through setup again.
import { getSavedLanguage } from './utils/onboarding.js';
import { setLanguage as setLangGlobally, getLanguage as getActiveLanguage } from './i18n/index.js';
// Dev-only / opt-in session-state snapshot. Gated behind
// import.meta.env.DEV OR localStorage['farroway:debug'] = '1' so
// production users never see the line.
import { logSessionState } from './utils/sessionDebug.js';
// Daily engagement loop. One small, idempotent call: marks the
// per-day check-in flag, advances or resets the streak, and arms
// the soft 6h reminder. Safe to mount once at the App root.
import { initDailyLoop } from './utils/dailyLoop.js';
// NGO impact event log (local-first). Used by the Farmer
// Engagement section of NgoDashboard to count active /
// inactive farmers + completion rates over a 7-day window.
import { logEvent, EVENT_TYPES } from './data/eventLogger.js';

// Landing page (marketing homepage)
//
// LandingPage.jsx is the v3 marketing surface (white bg,
// global pilot copy). It serves both /welcome and /landing
// so external links to either path land on the canonical
// page. The earlier Landing.jsx (dark v2 design language)
// is retained in tree as a backup but no longer routed.
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
// Viral Click → Conversion §1-§3 — value-first landing surface
// served at /try and /preview. Single-screen ("Do not water
// today" + reason + soft CTA), no signup required. The CTA
// jumps straight to the existing FastOnboarding flow which
// already collects only location + crop (spec §4).
const ViralLandingPage = lazy(() => import('./pages/ViralLandingPage.jsx'));

/**
 * ExitTrackingObserver — User Behavior Tracking §4.
 *
 * Lives inside the Router so it can subscribe to useLocation()
 * route changes. Two responsibilities:
 *   1. Record every route as the "last screen viewed"
 *      (sessionStorage so the unload handler can read it).
 *   2. Install browser exit listeners ONCE on first mount so
 *      `exit_point` fires when the user closes the tab.
 *
 * Pure observer — renders nothing. Side-effect-only via
 * useEffect. The exit listeners themselves are installed once
 * via the module's idempotent installExitTracking().
 */
function ExitTrackingObserver() {
  const location = useLocation();
  // Record the route on every change. recordScreenView is a
  // synchronous sessionStorage write — cheap.
  useEffect(() => {
    let cancelled = false;
    import('./analytics/exitTracking.js')
      .then((mod) => {
        if (cancelled) return;
        try { mod.recordScreenView(location.pathname || '/'); }
        catch { /* swallow */ }
      })
      .catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, [location.pathname]);
  // Install exit listeners once. Cleanup on unmount removes them.
  useEffect(() => {
    let teardown = () => {};
    let cancelled = false;
    Promise.all([
      import('./analytics/exitTracking.js'),
      import('./analytics/analyticsStore.js'),
    ]).then(([exit, store]) => {
      if (cancelled) return;
      try {
        teardown = exit.installExitTracking({
          trackEvent: store && store.trackEvent,
        });
      } catch { /* swallow */ }
    }).catch(() => { /* swallow */ });
    return () => {
      cancelled = true;
      try { teardown(); } catch { /* ignore */ }
    };
  }, []);
  return null;
}

/**
 * ScanOnlyVoiceAssistant — route-aware wrapper around the global
 * <VoiceAssistant /> mic FAB.
 *
 * Renders the mic ONLY on the /scan surface (and its sub-routes
 * like /scan/result/:id). Every other tab — Home, My Farm,
 * My Grow, Tasks, Progress — gets a clean view with no floating
 * camera / scan / mic clutter. The bottom-nav still has a Scan
 * tab, so users always have one tap to reach this surface.
 */
function ScanOnlyVoiceAssistant() {
  const location = useLocation();
  const path = (location && location.pathname) || '';
  const onScan = path === '/scan' || path.startsWith('/scan/');
  if (!onScan) return null;
  return <VoiceAssistant />;
}

// Buyer + Funding/Impact layer (v3 merge, local-first)
//   /sell           — farmer creates a produce listing
//   /marketplace    — buyer browses available produce
//   /ngo/impact     — NGO funding + impact + market activity
//   /opportunities  — farmer funding & support matches
//   /admin/funding  — admin manages funding catalog
//   /ngo/funding    — same management page, NGO entry point
const Sell           = lazy(() => import('./pages/Sell.jsx'));
const Buy                = lazy(() => import('./pages/Buy.jsx'));
const OperatorDashboard  = lazy(() => import('./pages/OperatorDashboard.jsx'));
const MetricsDashboard   = lazy(() => import('./pages/MetricsDashboard.jsx'));
const OnboardingEntry    = lazy(() => import('./pages/OnboardingEntry.jsx'));
const MinimalFarmSetup   = lazy(() => import('./pages/MinimalFarmSetup.jsx'));
// Optimized fast setup flow per the
// "fast, simple, accurate" spec: 2 fields for garden,
// 4 for farm. Both end with onboardingCompleted=true +
// navigate('/home', { replace: true }). Mounted alongside
// (not replacing) the existing setup paths so deep links keep
// working.
const QuickGardenSetup   = lazy(() => import('./pages/setup/QuickGardenSetup.jsx'));
// Universal Plant Runtime — My Plants home grid.
const MyPlants           = lazy(() => import('./pages/MyPlants.jsx'));
// Single-plant detail page (universalPlantRuntime composite).
const PlantProfile       = lazy(() => import('./pages/PlantProfile.jsx'));
// Internal-only founder dashboard (Phase 15 — gated by
// `localStorage.farroway_internal === '1'` OR `?internal=1`).
const FounderDashboard   = lazy(() => import('./pages/FounderDashboard.jsx'));
// Internal-only Release Lock dashboard (Wave 9 — gated by the
// same `localStorage.farroway_internal === '1'` flag).
const ReleaseLockPage    = lazy(() => import('./pages/internal/ReleaseLock.jsx'));
// Internal-only architecture + release audit page (Wave 10 —
// same `localStorage.farroway_internal === '1'` gate).
const GodmodePage        = lazy(() => import('./pages/internal/Godmode.jsx'));
const QAPage             = lazy(() => import('./pages/internal/QAPage.jsx'));
const ReviewPage         = lazy(() => import('./pages/internal/ReviewPage.jsx'));
const ProductionCertificationPage = lazy(() => import("./pages/internal/ProductionCertificationPage.jsx"));
// Enterprise Agriculture Platform — orgs / programs / cohorts
// / interventions / analytics / trust. Internal gate today;
// per-OrganizationMember role check ships with the migration.
const EnterpriseHome     = lazy(() => import('./pages/enterprise/EnterpriseHome.jsx'));
const QuickFarmSetup     = lazy(() => import('./pages/setup/QuickFarmSetup.jsx'));
const Marketplace    = lazy(() => import('./pages/Marketplace.jsx'));
const NgoImpactPage  = lazy(() => import('./pages/NgoImpactPage.jsx'));
const Opportunities  = lazy(() => import('./pages/Opportunities.jsx'));
// Funding Hub (spec build) — region- and role-aware static
// catalog. Coexists with /opportunities (per-farm matcher).
// Off by default; gated by feature flag inside the page.
const FundingHub     = lazy(() => import('./pages/FundingHub.jsx'));
// App Store launch surfaces — required by the submission process
// AND by the Voice Assistant / ErrorBoundary recovery paths.
const ContactPage    = lazy(() => import('./pages/ContactPage.jsx'));
const PrivacyPolicy  = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const Terms          = lazy(() => import('./pages/Terms.jsx'));
const GuidanceDisclaimer = lazy(() => import('./pages/GuidanceDisclaimer.jsx'));
const DataConsent    = lazy(() => import('./pages/DataConsent.jsx'));
// Wave-39 — invite-activation route. Reads `?token=<raw>` from the
// URL, POSTs to /api/invites/accept, renders accepting/accepted/
// failed states. Pure render; never logs the token.
const Activate       = lazy(() => import('./pages/Activate.jsx'));
// Wave-41 — admin-only pilot validation surfaces. Each renders
// real health probes; no fake metrics.
const PilotCommandPage = lazy(() => import('./pages/internal/pilot/PilotCommandPage.jsx'));
const NGOPilotPage     = lazy(() => import('./pages/internal/pilot/NGOPilotPage.jsx'));
const PerformancePage  = lazy(() => import('./pages/internal/PerformancePage.jsx'));
const I18nQAPage       = lazy(() => import('./pages/internal/I18nQAPage.jsx'));
const OfflineQAPage    = lazy(() => import('./pages/internal/OfflineQAPage.jsx'));
const NotificationSettingsPage = lazy(() => import('./pages/settings/NotificationSettingsPage.jsx'));
const CommunityFeedPage = lazy(() => import('./pages/CommunityFeedPage.jsx'));
const CommunityModerationPage = lazy(() => import('./pages/internal/CommunityModerationPage.jsx'));
const GrowerPilotPage  = lazy(() => import('./pages/internal/pilot/GrowerPilotPage.jsx'));
// Wave-36 — outcome intelligence pages (admin only).
const PilotAnalyticsPage      = lazy(() => import('./pages/internal/PilotAnalyticsPage.jsx'));
const PilotReadinessPage      = lazy(() => import('./pages/internal/PilotReadinessPage.jsx'));
const FieldOfficerOutcomesPage = lazy(() => import('./pages/internal/FieldOfficerOutcomesPage.jsx'));
// Wave-37 — executive field intelligence dashboard (admin only).
const FieldIntelligencePage = lazy(() => import('./pages/internal/FieldIntelligencePage.jsx'));
// Wave-38 — NGO command center page (admin only).
const NGOHealthPage = lazy(() => import('./pages/internal/NGOHealthPage.jsx'));
// V7 — institutional command center + NGO intelligence (admin only).
const V7CommandCenterPage = lazy(() => import('./pages/internal/V7CommandCenterPage.jsx'));
const NGOIntelligencePage = lazy(() => import('./pages/internal/NGOIntelligencePage.jsx'));
// V8 — next platform layer command center (admin only).
const V8CommandCenterPage = lazy(() => import('./pages/internal/V8CommandCenterPage.jsx'));
// V13 — institutional data/MLOps readiness command center (admin only).
const V13CommandCenterPage = lazy(() => import('./pages/internal/V13CommandCenterPage.jsx'));
// U.S. Backyard onboarding (FEATURE_US_BACKYARD_FLOW). Self-
// redirects to /dashboard when the flag is off.
const BackyardOnboarding = lazy(() => import('./pages/onboarding/BackyardOnboarding.jsx'));
// U.S. experience selector — sits in front of both backyard
// and farm onboarding routes for U.S. users.
const USExperienceSelection = lazy(() => import('./pages/onboarding/USExperienceSelection.jsx'));
// Scan detection (FEATURE_SCAN_DETECTION). Coexists with the
// existing /scan-crop surface; the new pages bounce there when
// the flag is off so deep links never strand the user.
const ScanPage       = lazy(() => import('./pages/ScanPage.jsx'));
// Soil Scan v1 (May 2026) — confidence-safe soil photo guidance.
// Mounted at /scan/soil; the existing /scan ScanPage gets a
// secondary tile linking to it.
const SoilScanPage   = lazy(() => import('./pages/SoilScanPage.jsx'));
const ScanResultPage = lazy(() => import('./pages/ScanResultPage.jsx'));
// Scan-specific error boundary — eagerly imported (not lazy) so
// it can catch a crash from ScanPage's own lazy-import / mount.
// Wraps the /scan + /scan/result/:id routes in App.jsx below.
import ScanErrorBoundary from './components/scan/ScanErrorBoundary.jsx';
// Generic per-route error boundary — wraps Home / Tasks /
// Progress so a crash on one tab degrades to a small in-route
// fallback instead of unmounting the whole app.
import RouteErrorBoundary from './components/system/RouteErrorBoundary.jsx';
// Safe Runtime Layer: global last-resort boundary + per-route shell.
// AppCrashBoundary — global overlay with nav links (inside BrowserRouter
//   so <Link> works in the recovery UI); resets on routeKey change.
// SafeRouteShell — per-route error boundary + 8 s loading timeout;
//   replaces RouteErrorBoundary on the five main farmer routes.
import { AppCrashBoundary } from './components/system/AppCrashBoundary.jsx';
import { SafeRouteShell } from './components/system/SafeRouteShell.jsx';
// Feature-flag gate — wraps disabled-for-pilot routes so they
// render a calm placeholder instead of mounting an unstable
// surface. Falls open (renders children) on flag-system error.
import FeatureGated from './components/system/FeatureGated.jsx';
import RC1RouteGate from './components/system/RC1RouteGate.jsx';
import OfflineQueueBanner from './components/system/OfflineQueueBanner.jsx';
const ReleaseReadiness = lazy(() => import('./pages/internal/ReleaseReadiness.jsx'));
const FundingOpportunityDetail = lazy(() =>
  import('./pages/FundingOpportunityDetail.jsx'));
const FundingAdmin   = lazy(() => import('./pages/admin/FundingAdmin.jsx'));
const CreateProgram  = lazy(() => import('./pages/admin/CreateProgram.jsx'));

// v3 Field Agent Mode — dedicated /agent surface for the
// 'agent' role. Local-first onboarding flow with retry sync.
const AgentDashboard = lazy(() => import('./pages/AgentDashboard.jsx'));

// v3 Notification System — full-page list of recent
// notifications across TASK / FUNDING / BUYER / PROGRAM.
const Notifications  = lazy(() => import('./pages/Notifications.jsx'));

// V2 enterprise auth pages — Login is NOT lazy (prevents Suspense flash on first load)
import V2Login from './pages/Login.jsx';
// Wave-15 — opt-in organization sign-in surface. Direct-URL
// only; never linked from grower nav.
import OrgLoginPage from './pages/OrgLoginPage.jsx';
const V2Register = lazy(() => import('./pages/Register.jsx'));
const V2ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const V2ForgotPasswordSms = lazy(() => import('./pages/ForgotPasswordSms.jsx'));
const V2ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));

// Farm-issue management (farmer → admin → field officer pipeline).
// Local-first for v1 — no server endpoints yet; all state in the
// farroway.issues localStorage key via src/lib/issues/issueStore.js.
const ReportIssuePage      = lazy(() => import('./pages/farmer/ReportIssuePage.jsx'));
const MyIssuesPage         = lazy(() => import('./pages/farmer/MyIssuesPage.jsx'));
const AdminFarmIssuesPage  = lazy(() => import('./pages/admin/AdminFarmIssuesPage.jsx'));
const OfficerIssuesPage    = lazy(() => import('./pages/officer/OfficerIssuesPage.jsx'));
const V2VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'));
const V2ProfileSetup = lazy(() => import('./pages/ProfileSetup.jsx'));
const V2FarmerType = lazy(() => import('./pages/FarmerType.jsx'));
const V2StarterGuide = lazy(() => import('./pages/StarterGuide.jsx'));
const V2Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const HelpPage = lazy(() => import('./pages/HelpPage.jsx'));
// May 2026 support-system unification: dedicated /support hub +
// FAQ + contact form. Lazy loaded so the support bundle never
// enters the main route chunk. /help + /contact stay mounted as
// aliases so legacy deep links never break.
const SupportCenterPage  = lazy(() => import('./pages/support/SupportCenterPage.jsx'));
const SupportFAQPage     = lazy(() => import('./pages/support/SupportFAQPage.jsx'));
const SupportContactPage = lazy(() => import('./pages/support/SupportContactPage.jsx'));
const SimpleOnboarding = lazy(() => import('./onboarding/OnboardingFlow.jsx'));
const FarmerWelcome = lazy(() => import('./pages/FarmerWelcome.jsx'));
const FarmerEntry = lazy(() => import('./pages/FarmerEntry.jsx'));
const BeginnerReassurance = lazy(() => import('./pages/BeginnerReassurance.jsx'));
const FarmerSettingsPage = lazy(() => import('./pages/FarmerSettingsPage.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
// NGO value dashboard + pricing screens (monetisation layer).
// Distinct from the existing NgoDashboard which is the server-fed
// program admin view.
const NgoValueDashboard = lazy(() => import('./pages/NgoValueDashboard.jsx'));
// Outbreak control panel: KPIs + (lazy) map + alerts table.
// The map subtree inside the page is also code-split via
// React.lazy so the page chunk stays small even on low-end
// devices that never expand the map.
const NgoControlPanel = lazy(() => import('./pages/NgoControlPanel.jsx'));
const Pricing = lazy(() => import('./pages/Pricing.jsx'));
// Optimised single-task farmer screen. Mounted at /today/quick
// so the existing /today (FarmerTodayPage) keeps working for
// users who depend on its richer surfaces.
const TodayQuick = lazy(() => import('./pages/Today.jsx'));
// Frictionless one-screen onboarding for low-literacy farmers.
// Lives alongside the legacy OnboardingV3 / FastOnboarding routes -
// nothing is replaced; ProfileGuard now points first-time users
// here instead of the legacy form.
const QuickStart = lazy(() => import('./pages/onboarding/QuickStart.jsx'));
const FastFlow = lazy(() => import('./pages/onboarding/FastFlow.jsx'));
// Minimal onboarding (Apr 2026 fast-flow refactor): 2-screen
// entry → 3-input setup → straight to /dashboard. Reaches the
// first actionable task in under 60 s. Legacy QuickStart +
// FastOnboardingRoute remain mounted for any deep links that
// were previously documented.
const MinimalOnboarding = lazy(() => import('./pages/onboarding/MinimalOnboarding.jsx'));
// CameraScanPage was the legacy /scan-crop surface — its file header
// is marked DEPRECATED and the only route that used it (line 1691)
// now redirects to /scan (canonical ScanPage). The unused import is
// removed so the bundler can tree-shake the deprecated page out.
const LandCheckPage = lazy(() => import('./pages/LandCheckPage.jsx'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp.jsx'));
// ProtectedLayout is NOT lazy — it's the auth/profile gate and must stay mounted
// while inner lazy children (Dashboard, etc.) load via their own Suspense boundary.
import V2ProtectedLayout from './layouts/ProtectedLayout.jsx';
const V2SeasonStart = lazy(() => import('./pages/SeasonStart.jsx'));
const AllTasksPage = lazy(() => import('./pages/AllTasksPage.jsx'));
const MyFarmPage = lazy(() => import('./pages/MyFarmPage.jsx'));
const FarmerProgressPage = lazy(() => import('./pages/FarmerProgressPage.jsx'));
// Journal page — Garden Mode Refactor §4. Replaces Progress as the
// 4th garden bottom-nav tab; surfaces the existing usePlantTimeline
// data as a calm full-length growth story (not analytics).
const JournalPage = lazy(() => import('./pages/JournalPage.jsx'));
const CropFitIntake = lazy(() => import('./pages/CropFitIntake.jsx'));
const CropRecommendations = lazy(() => import('./pages/CropRecommendations.jsx'));
const USCropRecommendations = lazy(() => import('./pages/USCropRecommendations.jsx'));
const CropPlan = lazy(() => import('./pages/CropPlan.jsx'));
const NGOOverview = lazy(() => import('./pages/NGOOverview.jsx'));
// Phase 5 restore — basic NGO dashboard (overview cards + farmer list + risk labels).
const NgoDashboardV1 = lazy(() => import('./pages/ngo/NgoDashboardV1.jsx'));
// Phase 6 restore — basic admin dashboard (overview cards + activity + moderation).
const AdminBasicPage = lazy(() => import('./pages/admin/AdminBasicPage.jsx'));
const InterventionCenter = lazy(() => import('./pages/ngo/InterventionCenter.jsx'));
const FarmerScoring = lazy(() => import('./pages/ngo/FarmerScoring.jsx'));
const FundingReadiness = lazy(() => import('./pages/ngo/FundingReadiness.jsx'));
const FarmerTodayPage = lazy(() => import('./pages/farmer/FarmerTodayPage.jsx'));
const PostHarvestSummaryPage = lazy(() => import('./pages/farmer/PostHarvestSummaryPage.jsx'));
const FarmerOnboardingPage = lazy(() => import('./pages/onboarding/FarmerOnboardingPage.jsx'));
const FastOnboardingRoute = lazy(() => import('./pages/onboarding/fast/FastOnboardingRoute.jsx'));
const OnboardingV3 = lazy(() => import('./pages/onboarding/OnboardingV3.jsx'));
// Perfect Onboarding spec — 4-screen sub-30-second path. Lives
// at /onboarding/fast. Replaces the legacy multi-step paths for
// new sign-ups; the older paths remain mounted for any in-flight
// users / deep links.
const FastOnboarding = lazy(() => import('./pages/onboarding/FastOnboarding.jsx'));
// OnboardingRouter — thin guard that bounces U.S. users to the
// experience chooser when they haven't picked one yet. Flag-off
// behaviour: identical to OnboardingV3.
const OnboardingRouter = lazy(() => import('./pages/onboarding/OnboardingRouter.jsx'));
const EditFarmScreen = lazy(() => import('./pages/EditFarmScreen.jsx'));
const NewFarmScreen  = lazy(() => import('./pages/NewFarmScreen.jsx'));
// Adaptive farm/garden setup wrapper — picks GardenSetupForm
// vs the existing NewFarmScreen by experience. Behind the
// adaptiveFarmGardenSetup feature flag; flag-off path renders
// NewFarmScreen verbatim, so /farm/new is the same surface
// for current pilots.
const AdaptiveFarmSetup = lazy(() => import('./pages/AdaptiveFarmSetup.jsx'));
// /farms — Manage Farms control panel for multi-farm households
// (April 2026). Lazy because most farmers won't visit it; it
// only matters once they have 2+ farms or want to archive.
const ManageFarms    = lazy(() => import('./pages/ManageFarms.jsx'));
// Garden-visibility spec — backyard / home gardens live on a
// dedicated /manage-gardens surface. ManageFarms hides garden
// rows; the new page lists them with the same set-active /
// edit / remove actions, plus a switcher so users with both
// experience types hop between the two with one tap.
const ManageGardens  = lazy(() => import('./pages/ManageGardens.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const WelcomeScreen  = lazy(() => import('./pages/WelcomeScreen.jsx'));
const CropFitQuick   = lazy(() => import('./pages/CropFit.jsx'));
const ProgramDashboardPage = lazy(() => import('./pages/ProgramDashboard.jsx'));
const NgoDashboardPage = lazy(() => import('./pages/NgoDashboard.jsx'));
const MyListingsPage = lazy(() => import('./pages/farmer/MyListingsPage.jsx'));
const CreateListingPage = lazy(() => import('./pages/farmer/CreateListingPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/farmer/NotificationsPage.jsx'));
const BrowseListingsPage = lazy(() => import('./pages/buyer/BrowseListingsPage.jsx'));
const ListingDetailPage = lazy(() => import('./pages/buyer/ListingDetailPage.jsx'));
const MyInterestsPage = lazy(() => import('./pages/buyer/MyInterestsPage.jsx'));
const BuyerNotificationsPage = lazy(() => import('./pages/buyer/BuyerNotificationsPage.jsx'));
const CropSummary = lazy(() => import('./pages/CropSummary.jsx'));

// Lazy-loaded pages — split into separate chunks for faster initial load
const FarmersPage = lazy(() => import('./pages/FarmersPage.jsx'));
const FarmerDetailPage = lazy(() => import('./pages/FarmerDetailPage.jsx'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage.jsx'));
const NewApplicationPage = lazy(() => import('./pages/NewApplicationPage.jsx'));
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage.jsx'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
const PrintableReportPage = lazy(() => import('./pages/PrintableReportPage.jsx'));
const AuditPage = lazy(() => import('./pages/AuditPage.jsx'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'));
const VerificationQueuePage = lazy(() => import('./pages/VerificationQueuePage.jsx'));
const FraudQueuePage = lazy(() => import('./pages/FraudQueuePage.jsx'));
const OfficerValidationPage = lazy(() => import('./pages/OfficerValidationPage.jsx'));
const FarmerHomePage = lazy(() => import('./pages/FarmerHomePage.jsx'));
const FarmerOverviewTab = lazy(() => import('./pages/FarmerOverviewTab.jsx'));
const FarmerActivitiesTab = lazy(() => import('./pages/FarmerActivitiesTab.jsx'));
const FarmerRemindersTab = lazy(() => import('./pages/FarmerRemindersTab.jsx'));
const FarmerNotificationsTab = lazy(() => import('./pages/FarmerNotificationsTab.jsx'));
const FarmerStorageTab = lazy(() => import('./pages/FarmerStorageTab.jsx'));
const FarmerMarketTab = lazy(() => import('./pages/FarmerMarketTab.jsx'));
const FarmerProgressTab = lazy(() => import('./pages/FarmerProgressTab.jsx'));
const AdminControlPage = lazy(() => import('./pages/AdminControlPage.jsx'));
const AdminOrganizationsPage = lazy(() => import('./pages/AdminOrganizationsPage.jsx'));
const OrganizationDashboardPage = lazy(() => import('./pages/OrganizationDashboardPage.jsx'));
// Wave 17 — Bulk farmer onboarding pages.
const OnboardingHome        = lazy(() => import('./pages/organization/OnboardingHome.jsx'));
const OnboardingImport      = lazy(() => import('./pages/organization/OnboardingImport.jsx'));
const OnboardingBatches     = lazy(() => import('./pages/organization/OnboardingBatches.jsx'));
const OnboardingBatchDetail = lazy(() => import('./pages/organization/OnboardingBatchDetail.jsx'));
const AddFarmerPage         = lazy(() => import('./pages/organization/AddFarmerPage.jsx'));
const AdminSyncQueuePage = lazy(() => import('./pages/AdminSyncQueuePage.jsx'));
const FarmerRegisterPage = lazy(() => import('./pages/FarmerRegisterPage.jsx'));
// FarmerDashboardPage was the legacy V1 farmer dashboard rendered
// under the BYPASS_SETUP_FOR_PILOT=false branch. The flag was
// removed in the May 2026 permanent-PilotHome-removal pass — Home
// is now the only canonical farmer surface. The file stays in
// src/pages/ for any standalone test imports but is no longer
// part of the route bundle.
const PendingRegistrationsPage = lazy(() => import('./pages/PendingRegistrationsPage.jsx'));
const InvestorIntelligencePage = lazy(() => import('./pages/InvestorIntelligencePage.jsx'));
const PilotMetricsPage = lazy(() => import('./pages/PilotMetricsPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const SecurityRequestsPage = lazy(() => import('./pages/SecurityRequestsPage.jsx'));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage.jsx'));
const PilotQAPage = lazy(() => import('./pages/PilotQAPage.jsx'));
const AutoNotificationsPage = lazy(() => import('./pages/AutoNotificationsPage.jsx'));
const ImpactDashboardPage = lazy(() => import('./pages/ImpactDashboardPage.jsx'));
const AdminIssuesPage = lazy(() => import('./pages/AdminIssuesPage.jsx'));
const AdminOpsPage = lazy(() => import('./pages/AdminOpsPage.jsx'));
const SupplyReadinessPage = lazy(() => import('./pages/SupplyReadinessPage.jsx'));
const BuyerManagementPage = lazy(() => import('./pages/BuyerManagementPage.jsx'));
const BuyerTrustPage = lazy(() => import('./pages/BuyerTrustPage.jsx'));
const BuyerView = lazy(() => import('./pages/BuyerView.jsx'));
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage.jsx'));
// Phase 7D — farmer-facing read-only analytics page.
const FarmerAnalyticsPage = lazy(() => import('./pages/FarmerAnalyticsPage.jsx'));
// Phase 3 §C — soft-launch monitoring dashboard. Reads the
// canonical event store + computes DAU / completion / stuck /
// crashes / retention numbers in-memory. Admin-only via the
// surrounding RoleRoute wrapper.
const MonitoringDashboardPage = lazy(() => import('./pages/admin/MonitoringDashboardPage.jsx'));
// Live Admin Issue Dashboard — turns metrics into ranked alerts
// with severity + suggested operator action. Same admin-only
// gate; consumes GET /api/admin/alerts.
const AdminIssueDashboardPage = lazy(() => import('./pages/admin/AdminIssueDashboardPage.jsx'));
// Final feedback-loop spec §4 — admin-only feedback rollup.
const FeedbackDashboard = lazy(() => import('./components/admin/FeedbackDashboard.jsx'));
const AdminImportFarmersPage = lazy(() => import('./pages/AdminImportFarmersPage.jsx'));
const ProfileSetupPage = lazy(() => import('./pages/ProfileSetupPage.jsx'));

// Intelligence pages (farmer-facing, V2 cookie auth)
const PestRiskCheck = lazy(() => import('./pages/PestRiskCheck.jsx'));
const PestRiskResult = lazy(() => import('./pages/PestRiskResult.jsx'));
const FieldHotspotAlert = lazy(() => import('./pages/FieldHotspotAlert.jsx'));
const RegionalWatch = lazy(() => import('./pages/RegionalWatch.jsx'));
const TreatmentFeedback = lazy(() => import('./pages/TreatmentFeedback.jsx'));

// Intelligence admin pages
const AdminRegionalRiskMap = lazy(() => import('./pages/admin/RegionalRiskMap.jsx'));
const AdminHighRiskFarms = lazy(() => import('./pages/admin/HighRiskFarms.jsx'));
const AdminHotspotInspector = lazy(() => import('./pages/admin/HotspotInspector.jsx'));
const AdminAlertControlCenter = lazy(() => import('./pages/admin/AlertControlCenter.jsx'));
const AdminInterventionEffectiveness = lazy(() => import('./pages/admin/InterventionEffectiveness.jsx'));
const AdminOperationalQueues = lazy(() => import('./pages/admin/OperationalQueues.jsx'));

import { STAFF_ROLES, REVIEW_ROLES, ADMIN_ROLES, REGISTRATION_ROLES } from './utils/roles.js';
// Permanent safe bootstrap wrapper for /today — always renders something
// even when FarmerTodayPage crashes or API calls hang past 4 seconds.
import DashboardShell from './components/DashboardShell.jsx';
// Legacy profile guard + provider use the old farmStore-based flow (Bearer token auth)
import LegacyProfileGuard from './components/ProfileGuard.jsx';
import { ProfileProvider as LegacyProfileProvider } from './context/ProfileContextLegacy.jsx';
// V2 enterprise auth context (cookie-based)
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ProfileProvider as V2ProfileProvider } from './context/ProfileContext.jsx';
// Phase 2: Offline, voice, weather contexts
import { NetworkProvider } from './context/NetworkContext.jsx';
import { AppPrefsProvider } from './context/AppPrefsContext.jsx';
import { UserModeProvider } from './context/UserModeContext.jsx';
import { WeatherProvider } from './context/WeatherContext.jsx';
import { ForecastProvider } from './context/ForecastContext.jsx';
import { MarketProvider } from './context/MarketContext.jsx';
import { SeasonProvider } from './context/SeasonContext.jsx';

// Wave broken-link audit fix — replaced the static loader with
// the self-timing variant so the outer Suspense fallback NEVER
// hangs forever on a stalled lazy chunk. After 5s it flips to a
// recovery panel with Try again / Upload photo (scan route only)
// / Go Home. Root cause: inner SafeRouteShell's useEffect can't
// run while its children are suspended on a lazy import, so its
// timeout never fired. Putting the timeout INSIDE the Suspense
// fallback guarantees recovery regardless of which chunk is in
// flight. LazyLoadErrorBoundary additionally catches ChunkLoadError
// so a failed chunk download surfaces a recovery panel rather than
// crashing the SPA.
import PageLoaderWithTimeout from './components/system/PageLoaderWithTimeout.jsx';
import LazyLoadErrorBoundary from './components/system/LazyLoadErrorBoundary.jsx';
// Global safe loader (startup-deadlock fix §2) — the app-level
// loading gate uses this so an auth bootstrap that never settles can
// never leave a full-screen spinner forever; it flips to a recovery
// panel after the timeout.
import SafeLoader from './components/common/SafeLoader.jsx';
// Wave real-device scan validation — visible 3s/5s diagnostic banner.
// Self-hides off /scan and once scan-ready. Polls __scanStartupHealth()
// every 500ms. Eager-loaded (NOT lazy) so the banner can render
// even while ScanPage's chunk is in flight.
import ScanStartupBanner from './components/scan/ScanStartupBanner.jsx';
const PageLoader = () => <PageLoaderWithTimeout />;

/**
 * AppCrashBoundaryWithLocation — thin function-component wrapper that
 * reads useLocation() (hook — cannot be in a class component) and passes
 * location.pathname as `routeKey` to AppCrashBoundary so the class-based
 * boundary auto-resets when the user navigates to a different route.
 *
 * Must live INSIDE <BrowserRouter> (useLocation requirement).
 */
function AppCrashBoundaryWithLocation({ children }) {
  const location = useLocation();
  // CPO pilot-fix C-3 — recordVisit() previously only fired on
  // FarmerTodayPage via DailyReminderBanner mount. Deep-linkers
  // straight to /scan, /my-plants, /activity, or /tasks (the
  // natural week-2 muscle-memory routes) never updated
  // lastVisitISO, leaving daysSinceLastVisit() permanently stale
  // and the return-banner firing falsely. Hoist the call to a
  // top-level route-change effect so every navigation refreshes
  // the visit signal. Idempotent — recordVisit() is a no-op on
  // second call within the same UTC day.
  React.useEffect(() => {
    let cancelled = false;
    import('./lib/retention/streakStore.js').then((m) => {
      if (cancelled) return;
      try {
        if (m && typeof m.recordVisit === 'function') m.recordVisit();
      } catch { /* never propagate — retention is non-critical */ }
    }).catch(() => { /* swallow */ });
    return () => { cancelled = true; };
  }, [location.pathname]);
  return (
    <AppCrashBoundary routeKey={location.pathname}>
      {children}
    </AppCrashBoundary>
  );
}

function ProtectedRoute({ children, allowSetup }) {
  const token = useAuthStore(s => s.token);
  const storeUser = useAuthStore(s => s.user);
  const { user: v2User, authLoading } = useAuth();
  const location = useLocation();

  console.log('[GUARD]', Date.now(), 'ProtectedRoute:', {
    v1Token: !!token, v1Role: storeUser?.role, v2Role: v2User?.role,
    authLoading, path: window.location.pathname,
  });

  // Bridge V2 cookie-auth user into the V1 zustand store via effect.
  //
  // The previous implementation called `useAuthStore.setState()` during
  // render, which violates React's render-purity contract: it double-
  // fires in strict mode and risks cascading re-renders / inconsistent
  // state across components reading from the store. Moving the write
  // into a useEffect makes it a true post-commit side effect.
  //
  // Downstream components that read ONLY from useAuthStore (15 pages)
  // see the bridged user one render after the effect lands — a one-
  // frame delay we accept in exchange for render-purity. ProtectedRoute
  // and RoleRoute themselves read from BOTH sources via the
  // `storeUser || v2User` fallback below, so the redirect decision on
  // the very first render is unaffected.
  useEffect(() => {
    if (v2User && v2User.role && v2User.role !== 'farmer' && !storeUser) {
      console.log('[GUARD]', Date.now(), 'Bridging V2 user to V1 store, role:', v2User.role);
      useAuthStore.setState({ user: v2User });
    }
  }, [v2User, storeUser]);

  // Defensive fallback: read from BOTH sources so this component +
  // downstream RoleRoute see the v2User on the very first render
  // even before the bridge effect runs.
  const user = storeUser || v2User;
  const hasSession = !!token || (v2User && v2User.role);

  // Wait for the auth context to finish its /me bootstrap BEFORE
  // making a redirect decision. On a page reload, authLoading=true
  // for the first ~100ms while /api/v2/auth/me restores the session
  // from the httpOnly cookie; without this gate we used to flash-
  // redirect the farmer from (e.g.) /edit-farm → /login → /dashboard
  // even though the cookie was perfectly valid. We also check the
  // localStorage session cache so a user on a slow network sees
  // their last-known role immediately and doesn't get a blank page.
  if (!hasSession && authLoading) {
    let cachedHasUser = false;
    try {
      const cached = localStorage.getItem('farroway:session_cache');
      cachedHasUser = !!(cached && JSON.parse(cached)?.user);
    } catch { /* ignore */ }
    if (cachedHasUser) {
      // Cached session present → render immediately from the cached
      // user role; the bootstrap /me call validates the cookie in the
      // background and AuthContext will swap state when it lands.
      // (Removed the `|| true` short-circuit that forced every load
      // to wait for the slow bootstrap even with a valid cache.)
    } else {
      // No cache + still hydrating → safe to show the loader; the
      // bootstrap will resolve it within a few seconds.
      console.log('[GUARD]', Date.now(), 'Waiting for auth bootstrap…');
      return <PageLoader />;
    }
  }

  if (!hasSession) {
    console.log('[GUARD]', Date.now(), 'No session — redirecting to login');
    // No V1 token and no V2 staff session — check for cached V2 farmer session
    if (v2User?.role === 'farmer') {
      return <Navigate to="/dashboard" replace />;
    }
    try {
      const cached = localStorage.getItem('farroway:session_cache');
      if (cached && JSON.parse(cached)?.user) return <Navigate to="/dashboard" replace />;
    } catch { /* ignore */ }
    // Preserve the intended destination so Login can send the user
    // back to their refreshed page once they sign in again. Stops
    // "I was on /edit-farm → refreshed → redirected → forgot where
    // I was" — Login already reads `location.state.from` + the
    // sessionStorage returnTo slot via AuthGuard, but inside
    // ProtectedRoute we can set state directly here too.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  // Farmer-role users: "/" is a pure redirect to "/home" per the
  // Permanent Farmer Home Nav Enforcement spec §2. The canonical
  // farmer Home renders ONLY at "/home" via the dedicated route
  // at App.jsx:1134-1138 (SafeRouteShell → Home). Rendering Home
  // directly at "/" duplicated the entry point + made route
  // audits confusing — the new contract is one canonical URL.
  //
  // The setup-flow branch (allowSetup === true) still threads
  // children through LegacyProfileProvider so /v1/profile/setup
  // and the other in-setup routes keep their shared profile
  // state.
  if (user?.role === 'farmer') {
    if (allowSetup) return <LegacyProfileProvider>{children}</LegacyProfileProvider>;
    return <Navigate to="/home" replace />;
  }
  return children;
}

// Role-based route guard — redirects unauthorized roles to dashboard
function RoleRoute({ roles, children }) {
  const storeUser = useAuthStore(s => s.user);
  const { user: v2User } = useAuth();
  const user = storeUser || v2User;
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

// ─── Auth loading gate ─────────────────────────────────────
// Prevents ANY route from rendering until the V2 auth bootstrap
// has resolved. This eliminates the blink caused by V1 ProtectedRoute
// redirecting to /login before the V2 cookie session is verified.
function AuthLoadingGate({ children }) {
  const { authLoading } = useAuth();
  // Startup-deadlock fix §2/§3 — never gate the whole app on an
  // indefinite spinner. AuthContext.bootstrap() releases authLoading
  // within an absolute 8s hard-stop; SafeLoader is the belt-and-
  // suspenders: even if authLoading somehow stayed true, it flips to
  // a Try Again / Go Home recovery panel after 8s instead of spinning
  // forever.
  if (authLoading) return <SafeLoader timeoutMs={8000} />;
  return children;
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const stepUpRequired = useAuthStore((s) => s.stepUpRequired);

  // Drain the new IndexedDB outbox at /api/sync on a 15s tick.
  // Single-flight guard inside; safe to mount once at the root.
  useSyncLoop();

  // FEATURE_OFFLINE_SAFE: install the bounded online sync once.
  // Only runs when the flag is on. Wires window.addEventListener('online')
  // + a 2s boot flush. No interval, no blocking render.
  useEffect(() => {
    if (!FEATURE_OFFLINE_SAFE) return;
    // The task sender maps action types to their existing API endpoints.
    // Imported lazily so the module stays out of the critical-path bundle.
    const taskSender = async (action) => {
      const { default: apiClient } = await import('./api/client.js');
      const { type, taskId, farmId, note, reason } = action || {};
      if (type === 'task_complete') {
        if (!taskId) return;
        return apiClient.post(
          farmId
            ? `/farm-tasks/${farmId}/tasks/${encodeURIComponent(taskId)}/complete`
            : `/tasks/${encodeURIComponent(taskId)}/complete`,
          { note: note || '' },
        );
      }
      if (type === 'task_skip') {
        if (!taskId) return;
        return apiClient.post(
          farmId
            ? `/farm-tasks/${farmId}/tasks/${encodeURIComponent(taskId)}/skip`
            : `/tasks/${encodeURIComponent(taskId)}/skip`,
          { reason: reason || '' },
        );
      }
      // Unknown type — resolve silently (no-op on server).
    };
    const cleanup = installSafeOnlineSync({ taskSender });
    return cleanup;
   
  }, []);

  useEffect(() => {
    // Spec §2 + §15 — boot-time sweep of the 13 legacy farm storage
    // keys into the canonical zustand key, and pin diagnostic globals
    // so `window.__farmAudit()` + `window.__hardResetFarroway()` are
    // reachable from any device DevTools.
    // Production hardening §1, §3, §5, §6 — install the runtime
    // health monitor + scan-to-farm continuity bridge so screens
    // stay in lock-step with the canonical store.
    (async () => {
      try {
        const { migrateLegacyFarmState } = await import('./bootstrap/migrateLegacyFarmState.js');
        migrateLegacyFarmState();
      } catch { /* never block app boot */ }
      try {
        const { installFarmAuditDiagnostics } = await import('./lib/farmAuditDiagnostics.js');
        installFarmAuditDiagnostics();
      } catch { /* never block app boot */ }
      try {
        const { installFarmRuntimeHealth } = await import('./lib/farmRuntimeHealth.js');
        installFarmRuntimeHealth();
      } catch { /* never block app boot */ }
      try {
        const { installScanContinuityBridge } = await import('./lib/scanContinuityBridge.js');
        installScanContinuityBridge();
      } catch { /* never block app boot */ }
      try {
        // Wave 5 — continuity runtime registers canonical writers,
        // installs reconnect drain orchestration, and mirrors bus
        // events into the replay log. Must mount BEFORE the
        // diagnostics layer so __continuityHealth() has data.
        const { installContinuityRuntime } =
          await import('./runtime/continuity/continuityRuntime.js');
        installContinuityRuntime();
      } catch { /* never block app boot */ }
      try {
        // Wave 6 — intelligence runtime registers itself with the
        // wave-5 persistence registry for RECOMMENDATION_LOG and
        // OUTCOME_MEMORY. Idempotent; must mount AFTER continuity.
        const { installIntelligenceRuntime } =
          await import('./runtime/intelligence/intelligenceRuntime.js');
        installIntelligenceRuntime();
      } catch { /* never block app boot */ }
      try {
        // Wave 7 — offline runtime registers all 5 queue adapters
        // with the queueRegistry + installs device resilience hooks
        // (visibilitychange, pageshow, online) + fires an initial
        // restoration snapshot. Idempotent.
        const { installOfflineRuntime } =
          await import('./runtime/offline/offlineRuntime.js');
        installOfflineRuntime();
      } catch { /* never block app boot */ }
      try {
        // RC1 — install the canonical build-identity global FIRST
        // so the readiness runtime can read a consistent SHA when
        // it composes its envelope below.
        const { installFarrowayBuildGlobal } =
          await import('./runtime/release/farrowayBuild.js');
        installFarrowayBuildGlobal();
      } catch { /* never block app boot */ }
      try {
        // RC1 — pin __scanUIHealth() so QA can verify the scan
        // landing default mode is 'idle' (no camera auto-start)
        // without DevTools introspection.
        const { installScanUIHealthGlobal } =
          await import('./runtime/scan/scanUIHealth.js');
        installScanUIHealthGlobal();
      } catch { /* never block app boot */ }
      try {
        // Phase 10 — pin __farmIntelligence() so QA can introspect
        // the farm-intelligence composite (health score + field
        // risk + weather actions + crop stage + trust) without
        // re-importing the engines.
        const { installFarmIntelligenceGlobal } =
          await import('./runtime/farmIntelligence/index.js');
        installFarmIntelligenceGlobal();
      } catch { /* never block app boot */ }
      try {
        // Phase 11 — pin __todayEngine() so QA can introspect the
        // daily operating composite (briefing + ranked tasks +
        // streaks + achievements) without re-importing engines.
        const { installTodayEngineGlobal } =
          await import('./runtime/today/index.js');
        installTodayEngineGlobal();
      } catch { /* never block app boot */ }
      try {
        // Phase 12 — pin __networkIntelligence() so QA can
        // introspect the network-intel composite (digital twin +
        // trends + peer benchmarks + collective recommendations +
        // anonymized records ready for future sync).
        const { installNetworkIntelligenceGlobal } =
          await import('./runtime/intelligenceNetwork/index.js');
        installNetworkIntelligenceGlobal();
      } catch { /* never block app boot */ }
      try {
        // Phase 13 — pin __farmerAdoption() so QA + the wave-8
        // notifications runtime can introspect the adoption
        // composite (onboarding score + first-7-days + referrals +
        // weekly report + community + smart-notification candidates
        // + D1/D7/D30 retention).
        const { installFarmerAdoptionGlobal } =
          await import('./runtime/adoption/index.js');
        installFarmerAdoptionGlobal();
      } catch { /* never block app boot */ }
      try {
        // Phase 14 — pin __dataFlywheel() so QA + the future
        // event-sync layer can introspect the flywheel composite
        // (events + farm memory + crop memory + recommendation
        // funnel + outcomes + regional insight + farmer/buyer/
        // program trust). Backend mount: /api/flywheel/*.
        const { installDataFlywheelGlobal } =
          await import('./runtime/flywheel/index.js');
        installDataFlywheelGlobal();
      } catch { /* never block app boot */ }
      try {
        // Grow Platform (15-phase grow-mode expansion) — pin
        // __gardenPlatform() so QA can introspect the
        // grow-mode composite (growType + plant DB + flower
        // advisor + companions + pollinator + scan tagger +
        // garden mode + indoor care + marketplace gate +
        // discover feed + library + assistant + dashboard +
        // multi-garden). Farm mode is unchanged; Garden mode
        // is opt-in.
        const { installGardenPlatformGlobal } =
          await import('./runtime/grow/index.js');
        installGardenPlatformGlobal();
      } catch { /* never block app boot */ }
      try {
        // Intelligence Layer (Phase 16) — pin __intelligenceLayer()
        // so QA can introspect the proactive Today composite
        // (dailyGrowEngine + growthStage + weatherAdjuster +
        // regionalDiseaseCalendar + pestRisk + diseaseForecast +
        // soilAdvisor + satelliteGate + gardenHealth + smartScan).
        // Backend pieces (satellite, market, LLM) are named-
        // deferred in the envelope.
        const { installIntelligenceLayerGlobal } =
          await import('./intelligence/intelligenceLayer');
        installIntelligenceLayerGlobal();
      } catch { /* never block app boot */ }
      try {
        // Enterprise Agriculture Platform — pin
        // __enterpriseRuntime, __enterpriseHealth,
        // __enterpriseAnalyticsHealth (+ extend
        // __appStoreReadiness warnings). Composes 7 enterprise
        // engines (organizations / programs / cohorts /
        // interventions / analytics / trust / reports).
        const { installEnterpriseRuntimeGlobal } =
          await import('./runtime/enterprise/index');
        installEnterpriseRuntimeGlobal();
      } catch { /* never block app boot */ }
      try {
        // Global Plant Intelligence Library — pin __plantLibrary()
        // so QA can introspect the unified browsing surface
        // (categories + search + profiles + library across all 7
        // plant categories including trees). Composition-only over
        // the existing plant DB; persistence stays with the wave-5
        // single-writer.
        const { installGlobalPlantIntelligenceGlobal } =
          await import('./modules/plants');
        installGlobalPlantIntelligenceGlobal();
      } catch { /* never block app boot */ }
      try {
        // Universal Plant Runtime — pin __plantRuntime() so QA
        // can introspect the runtime composite (managed Plant
        // records + lifecycle transitions + per-plant memory
        // graph + recommendations + tasks + health scoring).
        const { installUniversalPlantRuntimeGlobal,
                installPlantMediaGlobal } =
          await import('./runtime/plants');
        installUniversalPlantRuntimeGlobal();
        // Verified Plant Media System — registry auto-seeds on
        // the import above; this pins __plantMediaHealth() for QA.
        try { installPlantMediaGlobal(); }
        catch { /* never block boot */ }
        // Farroway Knowledge Layer — pin __farrowayKnowledge() so
        // QA can call the canonical lookupPlantKnowledge / disease /
        // pest service from the production console.
        try {
          const { installFarrowayKnowledgeGlobal } =
            await import('./knowledge/index');
          installFarrowayKnowledgeGlobal();
        } catch { /* never block boot */ }
        // Farroway Release Lock — pin __releaseLock() and extend
        // __appStoreReadiness with releaseLockVerdict.
        try {
          const { installReleaseLockGlobal } =
            await import('./runtime/release/index');
          installReleaseLockGlobal();
        } catch { /* never block boot */ }
        // Wave 10 — OODA Engine + Artifacts + Launch Readiness.
        // All three are pure runtimes; the boot install simply
        // pins their diagnostic probes onto window for QA.
        try {
          const { installOODAGlobal } =
            await import('./runtime/intelligence/index');
          installOODAGlobal();
        } catch { /* never block boot */ }
        // Intelligence Layer v1 — production-safe decision support.
        // Each engine is a pure, read-only composition over the
        // existing scan-history / managed-plants / event-log / weather
        // stores. They emit explainable envelopes (value, confidence,
        // dataSources, explanation, limitations) and degrade honestly
        // ("Not enough data yet"). None block scan/upload/camera — the
        // boot install only pins their diagnostic probes for QA.
        try {
          const [
            { installCropMemoryHealthGlobal },
            { installTrendHealthGlobal },
            { installFarmHealthScoreHealthGlobal },
            { installYieldReadinessHealthGlobal },
            { installDailyDecisionHealthGlobal },
            { installRemoteSensingReadinessGlobal },
            { installIntelligenceHealthGlobals },
          ] = await Promise.all([
            import('./runtime/intelligence/CropMemoryEngine'),
            import('./runtime/intelligence/TrendEngine'),
            import('./runtime/intelligence/FarmHealthScoreEngine'),
            import('./runtime/intelligence/YieldReadinessEngine'),
            import('./runtime/intelligence/DailyDecisionEngine'),
            import('./runtime/intelligence/RemoteSensingReadiness'),
            import('./runtime/intelligence/IntelligenceHealthRuntime'),
          ]);
          installCropMemoryHealthGlobal();
          installTrendHealthGlobal();
          installFarmHealthScoreHealthGlobal();
          installYieldReadinessHealthGlobal();
          installDailyDecisionHealthGlobal();
          installRemoteSensingReadinessGlobal();
          // Composite LAST — it reads the engine probes by name.
          installIntelligenceHealthGlobals();
        } catch { /* never block boot */ }
        // V7 — institutional agricultural intelligence platform. Six pure,
        // read-only engines (predictive / NGO intelligence / marketplace /
        // remote sensing / assistant / institutional readiness) + the
        // composite __v7Health. Each is self-contained (no project imports),
        // explainable, and degrades honestly. None block scan/upload/camera;
        // this only pins their diagnostic probes for the V7 command center.
        try {
          const [
            { installPredictiveHealthGlobal },
            { installNGOIntelligenceHealthGlobal },
            { installMarketplaceIntelligenceHealthGlobal },
            { installRemoteSensingHealthGlobal },
            { installFarmAssistantHealthGlobal },
            { installInstitutionalReadinessHealthGlobal },
            { installV7HealthGlobals },
          ] = await Promise.all([
            import('./runtime/v7/predictive/PredictiveRiskEngine'),
            import('./runtime/v7/ngo/NGOIntelligenceEngine'),
            import('./runtime/v7/marketplace/MarketplaceIntelligenceEngine'),
            import('./runtime/v7/remote/RemoteSensingEngine'),
            import('./runtime/v7/assistant/FarmAssistantEngine'),
            import('./runtime/v7/institutional/InstitutionalReadinessEngine'),
            import('./runtime/v7/V7HealthRuntime'),
          ]);
          installPredictiveHealthGlobal();
          installNGOIntelligenceHealthGlobal();
          installMarketplaceIntelligenceHealthGlobal();
          installRemoteSensingHealthGlobal();
          installFarmAssistantHealthGlobal();
          installInstitutionalReadinessHealthGlobal();
          // Composite LAST — it reads the engine probes by name.
          installV7HealthGlobals();
        } catch { /* never block boot */ }
        // V8 — regional intelligence / digital farm twin / voice readiness /
        // NGO enterprise / supply chain / remote-sensing readiness /
        // institutional data readiness. Seven pure, read-only engines + the
        // composite __v8Health. Self-contained (no project imports), honest,
        // and never block scan/upload/login — this only pins their probes.
        try {
          const [
            { installRegionalIntelligenceHealthGlobal },
            { installFarmTwinHealthGlobal },
            { installVoiceAssistantHealthGlobal },
            { installNGOEnterpriseHealthGlobal },
            { installSupplyChainHealthGlobal },
            { installRemoteSensingReadinessHealthGlobal },
            { installInstitutionalDataHealthGlobal },
            { installV8HealthGlobals },
          ] = await Promise.all([
            import('./runtime/v8/regional/RegionalIntelligenceEngine'),
            import('./runtime/v8/farmTwin/FarmTwinEngine'),
            import('./runtime/v8/voice/VoiceAssistantReadiness'),
            import('./runtime/v8/ngoEnterprise/NGOEnterpriseEngine'),
            import('./runtime/v8/supplyChain/SupplyChainIntelligenceEngine'),
            import('./runtime/v8/remoteSensing/RemoteSensingReadinessEngine'),
            import('./runtime/v8/institutionalData/InstitutionalDataReadiness'),
            import('./runtime/v8/V8HealthRuntime'),
          ]);
          installRegionalIntelligenceHealthGlobal();
          installFarmTwinHealthGlobal();
          installVoiceAssistantHealthGlobal();
          installNGOEnterpriseHealthGlobal();
          installSupplyChainHealthGlobal();
          installRemoteSensingReadinessHealthGlobal();
          installInstitutionalDataHealthGlobal();
          // Composite LAST — it reads the engine probes by name.
          installV8HealthGlobals();
        } catch { /* never block boot */ }
        // V13 — institutional data warehouse / MLOps / outcome-learning
        // readiness. Ten pure, read-only readiness runtimes + the composite
        // __v13Health. Self-contained (no deep imports), honest, NEEDS_DATA-
        // aware. None block scan/upload/login — this only pins their probes.
        try {
          const [
            { installEventSourcingHealthGlobal },
            { installOutcomeLearningHealthGlobal },
            { installRegionalNetworkHealthGlobal },
            { installVoiceFirstHealthGlobal },
            { installYieldPredictionReadinessHealthGlobal },
            { installDataWarehouseHealthGlobal },
            { installFeatureStoreHealthGlobal },
            { installModelRegistryHealthGlobal },
            { installAnalyticsExportHealthGlobal },
            { installDataGovernanceHealthGlobal },
            { installV13HealthGlobals },
          ] = await Promise.all([
            import('./runtime/v13/events/EventSourcingRuntime'),
            import('./runtime/v13/outcomeLearning/OutcomeLearningRuntime'),
            import('./runtime/v13/regionalNetwork/RegionalNetworkRuntime'),
            import('./runtime/v13/voice/VoiceFirstReadinessRuntime'),
            import('./runtime/v13/yield/YieldPredictionReadinessRuntime'),
            import('./runtime/v13/warehouse/DataWarehouseReadiness'),
            import('./runtime/v13/featureStore/FeatureStoreReadiness'),
            import('./runtime/v13/modelRegistry/ModelRegistryReadiness'),
            import('./runtime/v13/exports/AnalyticsExportRuntime'),
            import('./runtime/v13/governance/DataGovernanceRuntime'),
            import('./runtime/v13/V13HealthRuntime'),
          ]);
          installEventSourcingHealthGlobal();
          installOutcomeLearningHealthGlobal();
          installRegionalNetworkHealthGlobal();
          installVoiceFirstHealthGlobal();
          installYieldPredictionReadinessHealthGlobal();
          installDataWarehouseHealthGlobal();
          installFeatureStoreHealthGlobal();
          installModelRegistryHealthGlobal();
          installAnalyticsExportHealthGlobal();
          installDataGovernanceHealthGlobal();
          // Composite LAST — it reads the runtime probes by name.
          installV13HealthGlobals();
        } catch { /* never block boot */ }
        try {
          const { installArtifactRuntimeGlobal } =
            await import('./runtime/artifacts/index');
          installArtifactRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installLaunchReadinessGlobal,
                  installGodmodeHealthGlobal } =
            await import('./runtime/release/LaunchReadiness');
          installLaunchReadinessGlobal();
          installGodmodeHealthGlobal();
        } catch { /* never block boot */ }
        // Intelligence Loop — composes scan + plant runtime +
        // knowledge layer + OODA + artifacts + outcome tracker +
        // learning signals. Engines are pure; this pin adds
        // __intelligenceLoopHealth() for QA introspection.
        try {
          const { installIntelligenceLoopGlobal } =
            await import('./runtime/intelligenceLoop/index');
          installIntelligenceLoopGlobal();
        } catch { /* never block boot */ }
        // Enterprise-grade hardening (Wave 12) — RBAC + audit +
        // evidence chain + reports + outcomes + reliability +
        // enterprise-readiness gate. All pure runtimes; the
        // boot install pins their diagnostic probes.
        try {
          const { installRBACGlobal } =
            await import('./runtime/security/RBACRuntime');
          installRBACGlobal();
        } catch { /* never block boot */ }
        try {
          const { installAuditRuntimeGlobal } =
            await import('./runtime/audit/index');
          installAuditRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installEvidenceChainGlobal } =
            await import('./runtime/artifacts/EvidenceChain');
          installEvidenceChainGlobal();
        } catch { /* never block boot */ }
        try {
          const { installReportRuntimeGlobal } =
            await import('./runtime/reports/index');
          installReportRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installOutcomeRuntimeGlobal } =
            await import('./runtime/outcomes/index');
          installOutcomeRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installReliabilityRuntimeGlobal } =
            await import('./runtime/reliability/ReliabilityRuntime');
          installReliabilityRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installEnterpriseReadinessGlobal } =
            await import('./runtime/enterprise/EnterpriseReadinessGate');
          installEnterpriseReadinessGlobal();
        } catch { /* never block boot */ }
        // Wave 13 — Admin impact + demographics + record system.
        // Pure runtime; pins __adminImpactHealth() for QA.
        try {
          const { installAdminImpactGlobal } =
            await import('./runtime/admin/index');
          installAdminImpactGlobal();
        } catch { /* never block boot */ }
        // Wave 14 — Buyer dashboard runtime.
        try {
          const { installBuyerDashboardGlobal } =
            await import('./runtime/buyer/index');
          installBuyerDashboardGlobal();
        } catch { /* never block boot */ }
        // Wave 14 — NGO / organization dashboard runtime.
        try {
          const { installNgoDashboardGlobal } =
            await import('./runtime/organization/index');
          installNgoDashboardGlobal();
        } catch { /* never block boot */ }
        // Wave 15 — Federation runtime. Pins
        // __federationHealth() so QA can verify OIDC validator +
        // SAML placeholder + claim mapper + JIT gate.
        try {
          const { installFederationGlobal } =
            await import('./runtime/auth/federation/index');
          installFederationGlobal();
        } catch { /* never block boot */ }
        try {
          const { installQAReadinessGlobal } =
            await import('./runtime/qa/index');
          installQAReadinessGlobal();
        } catch { /* never block boot */ }
        try {
          const { installConsentGlobal } =
            await import('./runtime/consent/index');
          installConsentGlobal();
        } catch { /* never block boot */ }
        try {
          const { installRetentionPolicyGlobal } =
            await import('./runtime/compliance/index');
          installRetentionPolicyGlobal();
        } catch { /* never block boot */ }
        try {
          const { installMonitoringGlobal } =
            await import('./runtime/monitoring/index');
          installMonitoringGlobal();
        } catch { /* never block boot */ }
        try {
          const { installHumanReviewGlobal } =
            await import('./runtime/review/index');
          installHumanReviewGlobal();
        } catch { /* never block boot */ }
        // Wave 17 — Bulk farmer onboarding runtime. Pins
        // __bulkOnboardingHealth() so QA can verify CSV parser +
        // validator + duplicate detector + farmer provisioner +
        // batch runtime + audit trail.
        try {
          const { installBulkOnboardingGlobal } =
            await import("./runtime/organization/onboarding/index");
          installBulkOnboardingGlobal();
        } catch { /* never block boot */ }
        try {
          const { installProductionCertificationGlobal } =
            await import("./runtime/certification/index");
          installProductionCertificationGlobal();
        } catch { /* never block boot */ }
        // Wave 21 — Scan Analysis pipeline. Pins
        // __scanAnalysisHealth() so QA can verify the
        // compress → analyze → normalize → OODA → artifact
        // pipeline contract (composes existing runtimes; never
        // calls Plant.id directly).
        try {
          const { installScanAnalysisGlobal } =
            await import('./runtime/scan/ScanAnalysisRuntime');
          installScanAnalysisGlobal();
        } catch { /* never block boot */ }
        // Scan detection production fix — canonical detection contract +
        // normalizer + the detection/OODA/artifact health probes. Pure
        // diagnostics; never touch the live scan render or block boot.
        try {
          const { installScanDetectionGlobals } =
            await import('./runtime/scanDetection/ScanDetectionRuntime');
          installScanDetectionGlobals();
        } catch { /* never block boot */ }
        // Post-scan intelligence layer — outcome learning loop / farm digital
        // twin / regional readiness / scan risk scoring / NGO reporting hooks
        // + the post-scan OODA+artifact composite. Pure read-only composition;
        // composes AFTER a scan result and NEVER blocks the scan render/boot.
        try {
          const [
            { installOutcomeLearningLoopHealthGlobal },
            { installFarmDigitalTwinHealthGlobal },
            { installRegionalIntelligenceReadinessGlobal },
            { installScanRiskScoringHealthGlobal },
            { installNGOReportingHooksHealthGlobal },
            { installPostScanIntelligenceGlobals },
          ] = await Promise.all([
            import('./runtime/intelligence/outcomes/OutcomeLearningLoop'),
            import('./runtime/intelligence/farmTwin/FarmDigitalTwinRuntime'),
            import('./runtime/intelligence/regional/RegionalIntelligenceRuntime'),
            import('./runtime/scanRisk/ScanRiskScoringRuntime'),
            import('./runtime/intelligence/ngo/NGOReportingHooks'),
            import('./runtime/intelligence/PostScanIntelligenceRuntime'),
          ]);
          installOutcomeLearningLoopHealthGlobal();
          installFarmDigitalTwinHealthGlobal();
          installRegionalIntelligenceReadinessGlobal();
          installScanRiskScoringHealthGlobal();
          installNGOReportingHooksHealthGlobal();
          // Composite LAST — it reads the post-scan probes by name.
          installPostScanIntelligenceGlobals();
        } catch { /* never block boot */ }
        // Daily Farm Plan — the day-to-day operating loop that tells farmers
        // and gardeners what to do from setup → planting → care → scan →
        // harvest → post-harvest. Engines (grow timeframe / crop lifecycle /
        // post-harvest) install first; the DailyFarmPlan composite + the
        // task/scan/weather/outcome integration probes install last (they
        // read the engines by name). Pure read-only; approximate, never
        // exact; works without weather / scan / GPS; NEVER blocks boot.
        try {
          const [
            { installGrowTimeframeHealthGlobal },
            { installCropLifecycleHealthGlobal },
            { installPostHarvestHealthGlobal },
            { installDailyFarmPlanHealthGlobal },
            { installDailyPlanIntegrationGlobals },
          ] = await Promise.all([
            import('./runtime/dailyPlan/GrowTimeframeEngine'),
            import('./runtime/dailyPlan/CropLifecycleEngine'),
            import('./runtime/dailyPlan/PostHarvestEngine'),
            import('./runtime/dailyPlan/DailyFarmPlanRuntime'),
            import('./runtime/dailyPlan/DailyPlanIntegrationRuntime'),
          ]);
          installGrowTimeframeHealthGlobal();
          installCropLifecycleHealthGlobal();
          installPostHarvestHealthGlobal();
          // Composite + integration LAST — they read the engines by name.
          installDailyFarmPlanHealthGlobal();
          installDailyPlanIntegrationGlobals();
        } catch { /* never block boot */ }
        // Final Pilot Proof layer — 10 read-only proof probes that prove real
        // end-to-end workflows happened (daily plan / scan-to-task / post-
        // harvest / outcome / data readiness / translation review /
        // persistence / invite / offline sync / onboarding) + the composite
        // scorecard. Honest PASS / NEEDS_TEST / FAIL only — never a fake
        // green. Pure diagnostics; never block boot.
        try {
          const [
            { installDailyPlanProofGlobal },
            { installScanToTaskProofGlobal },
            { installPostHarvestProofGlobal },
            { installOutcomeProofGlobal },
            { installDataReadinessGlobal },
            { installTranslationReviewProofGlobal },
            { installPersistenceProofGlobal },
            { installInviteProofGlobal },
            { installOfflineSyncProofGlobal },
            { installOnboardingProofGlobal },
            { installFinalPilotProofGlobals },
          ] = await Promise.all([
            import('./runtime/proof/DailyPlanProofRuntime'),
            import('./runtime/proof/ScanToTaskProofRuntime'),
            import('./runtime/proof/PostHarvestProofRuntime'),
            import('./runtime/proof/OutcomeProofRuntime'),
            import('./runtime/proof/DataReadinessRuntime'),
            import('./runtime/proof/TranslationReviewProofRuntime'),
            import('./runtime/proof/PersistenceProofRuntime'),
            import('./runtime/proof/InviteProofRuntime'),
            import('./runtime/proof/OfflineSyncProofRuntime'),
            import('./runtime/proof/OnboardingProofRuntime'),
            import('./runtime/proof/FinalPilotProofRuntime'),
          ]);
          installDailyPlanProofGlobal();
          installScanToTaskProofGlobal();
          installPostHarvestProofGlobal();
          installOutcomeProofGlobal();
          installDataReadinessGlobal();
          installTranslationReviewProofGlobal();
          installPersistenceProofGlobal();
          installInviteProofGlobal();
          installOfflineSyncProofGlobal();
          installOnboardingProofGlobal();
          // Composite LAST — it reads the 10 proof probes by name.
          installFinalPilotProofGlobals();
        } catch { /* never block boot */ }
        // Community grow-share runtimes — private-first share + privacy
        // guard + interaction + NGO evidence + artifact/OODA composite.
        // All read-only diagnostics; never block app or write to DB.
        try {
          const [
            { installCommunityPrivacyGuardGlobal },
            { installGrowShareGlobal },
            { installCommunityInteractionGlobal },
            { installNGOEvidenceShareGlobal },
            { installGrowShareCompositeGlobals },
          ] = await Promise.all([
            import('./runtime/community/CommunityPrivacyGuard'),
            import('./runtime/community/GrowShareRuntime'),
            import('./runtime/community/CommunityInteractionRuntime'),
            import('./runtime/community/NGOEvidenceShareRuntime'),
            import('./runtime/community/GrowShareCompositeRuntime'),
          ]);
          installCommunityPrivacyGuardGlobal();
          installGrowShareGlobal();
          installCommunityInteractionGlobal();
          installNGOEvidenceShareGlobal();
          // Composite LAST — it reads the 4 sub-probes by name.
          installGrowShareCompositeGlobals();
        } catch { /* never block boot */ }
        // Polish wave (Jun 2026): notification template resolver, location
        // display normalizer, cross-page action context, voice FAB
        // visibility diagnostic. All read-only; never block boot.
        try {
          const [
            { installNotificationTemplateGlobal },
            { installLocationDisplayGlobal },
            { installActionContextGlobal },
            { installVoiceFloatingButtonGlobal },
          ] = await Promise.all([
            import('./runtime/notifications/NotificationTemplateRuntime'),
            import('./runtime/location/LocationDisplayNormalizer'),
            import('./runtime/actionContext/FarrowayActionContextRuntime'),
            import('./runtime/voiceUI/VoiceFloatingButtonHealth'),
          ]);
          installNotificationTemplateGlobal();
          installLocationDisplayGlobal();
          installActionContextGlobal();
          installVoiceFloatingButtonGlobal();
        } catch { /* never block boot */ }
        // Premium mobile shell composite — depends on __headerHealth +
        // __voiceFloatingButtonHealth being installed earlier in the boot,
        // so it MUST run after the polish-wave block above.
        try {
          const { installMobileShellHealthGlobal } =
            await import('./runtime/mobileShell/MobileShellHealthRuntime');
          installMobileShellHealthGlobal();
        } catch { /* never block boot */ }
        // Daily Assistant — task chain runtime + composite + 4 probes.
        // Composite reads __taskChainHealth + __postHarvestHealth by name,
        // so install order is: chain → composite → probes. Read-only;
        // never blocks boot.
        try {
          const [
            { installTaskChainHealthGlobal },
            { installDailyAssistantGlobal },
            { installDailyAssistantProbeGlobals },
          ] = await Promise.all([
            import('./runtime/dailyAssistant/TaskChainRuntime'),
            import('./runtime/dailyAssistant/DailyAssistantRuntime'),
            import('./runtime/dailyAssistant/DailyAssistantProbes'),
          ]);
          installTaskChainHealthGlobal();
          installDailyAssistantGlobal();
          installDailyAssistantProbeGlobals();
          // Consumer integration health — tracks which pages consume the
          // chain runtime. Honest false-by-default; pages call
          // recordConsumerIntegration() on mount to flip their flag.
          try {
            const { installDailyAssistantConsumerGlobal } =
              await import('./runtime/dailyAssistant/DailyAssistantConsumerRuntime');
            installDailyAssistantConsumerGlobal();
          } catch { /* swallow */ }
          // Single-brain composite — installed LAST so it can read every
          // consumer probe by name. Honest false-by-default; reports per-
          // page connectivity from the consumer envelope.
          try {
            const { installFarrowayBrainHealthGlobal } =
              await import('./runtime/dailyAssistant/FarrowayBrainHealthRuntime');
            installFarrowayBrainHealthGlobal();
          } catch { /* swallow */ }
          // Outcome intelligence composite — composes the existing
          // outcome / capture / learning-loop / farm-health / yield /
          // post-harvest / funding probes into the 8 spec flags. Honest
          // false until each engine reports ready. No fake scores; no
          // fabricated yield.
          try {
            const { installOutcomeIntelligenceCompositeGlobal } =
              await import('./runtime/outcomes/OutcomeIntelligenceComposite');
            installOutcomeIntelligenceCompositeGlobal();
          } catch { /* swallow */ }
        } catch { /* never block boot */ }
        // Simple Mode — action-first, low-literacy diagnostics + voice +
        // OODA/artifact attestation. Read-only; never blocks boot.
        try {
          const [
            { installSimpleModeGlobal },
            { installSimpleModeVoiceGlobal },
            { installSimpleModeOODAGlobals },
          ] = await Promise.all([
            import('./runtime/simpleMode/SimpleModeRuntime'),
            import('./runtime/simpleMode/SimpleModeVoiceRuntime'),
            import('./runtime/simpleMode/SimpleModeOODARuntime'),
          ]);
          installSimpleModeGlobal();
          installSimpleModeVoiceGlobal();
          // OODA + artifact composite LAST.
          installSimpleModeOODAGlobals();
        } catch { /* never block boot */ }
        // Header health diagnostic — attests the header-duplication fix
        // (Online badge removed, ProtectedLayout bell+menu hidden on /home,
        // Home owns its hero actions). Read-only; never blocks boot.
        try {
          const { installHeaderHealthGlobal } = await import('./runtime/header/HeaderHealthRuntime');
          installHeaderHealthGlobal();
        } catch { /* never block boot */ }
        // Notification runtime — read-only diagnostic + contract layer over
        // the existing src/lib/notifications/* JS surface. Pins 6 globals
        // (__notificationHealth + preferences/delivery/queue/OODA/artifact).
        // Notifications are OPTIONAL: nothing here blocks Home/Scan/boot;
        // fakeDelivery is hard-coded false in the delivery envelope.
        try {
          const [
            { installNotificationPreferencesGlobal },
            { installNotificationDeliveryGlobal },
            { installNotificationSchedulerGlobal },
            { installNotificationRuntimeGlobals },
          ] = await Promise.all([
            import('./runtime/notifications/NotificationPreferences'),
            import('./runtime/notifications/NotificationDelivery'),
            import('./runtime/notifications/NotificationScheduler'),
            import('./runtime/notifications/NotificationRuntime'),
          ]);
          installNotificationPreferencesGlobal();
          installNotificationDeliveryGlobal();
          installNotificationSchedulerGlobal();
          // Composite LAST — it reads the 3 sub-probes by name.
          installNotificationRuntimeGlobals();
        } catch { /* never block boot */ }
        // V13 pilot lock — scan reliability metrics (data collection only;
        // architecture frozen). Pure read-only probe; never blocks boot.
        try {
          const { installScanMetricsGlobal } =
            await import('./runtime/scanMetrics/ScanMetricsRuntime');
          installScanMetricsGlobal();
        } catch { /* never block boot */ }
        // Operating System layer — funding subsystem readiness + the unified
        // __farrowayHealth() composite over all subsystems. Pure read-only
        // composition (no new AI); installed LAST so the composite can read
        // every subsystem probe. Never blocks boot.
        try {
          const { installFundingHealthGlobal } =
            await import('./runtime/funding/FundingRuntime');
          installFundingHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installFarrowayHealthGlobal } =
            await import('./runtime/os/FarrowayHealthRuntime');
          installFarrowayHealthGlobal();
        } catch { /* never block boot */ }
        // Pilot readiness metrics — outcome / NGO / language / retention
        // metrics + the 12-subsystem readiness dashboard. Read-only
        // composition (no engines); never blocks boot.
        try {
          const { installPilotReadinessGlobals } =
            await import('./runtime/pilotReadiness/PilotReadinessRuntime');
          installPilotReadinessGlobals();
        } catch { /* never block boot */ }
        // Wave 22 — Launch UX health composite. Pins
        // __launchUXHealth() which mirrors the 11 grower-flow
        // gates the launch-friction CI gate enforces statically.
        try {
          const { installLaunchUXHealthGlobal } =
            await import('./runtime/launch/LaunchUXHealth');
          installLaunchUXHealthGlobal();
        } catch { /* never block boot */ }
        // Wave 24 — Launch UX truthfulness sprint. Four sibling
        // health pins that the parallel CI gates enforce statically.
        try {
          const { installActivityNavHealthGlobal } =
            await import('./runtime/launch/ActivityNavHealth');
          installActivityNavHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installNgoImportTruthHealthGlobal } =
            await import('./runtime/launch/NgoImportTruthHealth');
          installNgoImportTruthHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installNgoMetricsHealthGlobal } =
            await import('./runtime/launch/NgoMetricsHealth');
          installNgoMetricsHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installI18nGrowerHealthGlobal } =
            await import('./runtime/launch/I18nGrowerHealth');
          installI18nGrowerHealthGlobal();
        } catch { /* never block boot */ }
        // Wave 26 — six critical launch-blocker fixes (C-1…C-6) +
        // composite go-live verdict. Pure-runtime composition over
        // the existing modules; each install pins a __xxxHealth()
        // diagnostic so QA can verify the wave-26 invariants from
        // the production console. ActivityDataHealth additionally
        // migrates legacy 'farroway_event_log' / 'farroway_events'
        // entries into the canonical 'farroway.farmEvents' store
        // at boot — idempotent, never loses data.
        try {
          const { installLaunchBlockerGlobals } =
            await import('./runtime/launchBlockers/index');
          installLaunchBlockerGlobals();
        } catch { /* never block boot */ }
        // Final Gap Closure Pack — six composition runtimes for the
        // pilot launch:
        //   1. Outcome tracking — Issue → Recommendation → Task →
        //      Follow-up scan → Outcome stored, with frozen 5-status
        //      enum (resolved/improved/unchanged/worsened/unknown).
        //   2. Feedback intelligence — thumbs-up/down collector
        //      with hashed userId, capped at 500 rows.
        //   3. Retention analytics — D1/D7/D30 cohort markers +
        //      weekly active growers/gardeners counters.
        //   4. Field officer workflow — offline-safe intervention
        //      queue, organization-scoped, audit-log composition.
        //   5. Buyer trust signals — read-only composition over
        //      scan history + managed plants; ratings/reviews
        //      explicitly excluded.
        //   6. Knowledge content — counts plants/flowers/diseases/
        //      pests against the 250/50/30/30 launch target.
        // Each runtime pins its own window.__*Health probe; failures
        // are fault-isolated so a single misbehaving module never
        // blocks app boot.
        try {
          const { installOutcomeRuntimeGlobal } =
            await import('./runtime/outcomes/index');
          installOutcomeRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installFeedbackRuntimeGlobal } =
            await import('./runtime/feedback/index');
          installFeedbackRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installRetentionRuntimeGlobal } =
            await import('./runtime/retention/index');
          installRetentionRuntimeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installFieldOfficerGlobal } =
            await import('./runtime/fieldOfficer/index');
          installFieldOfficerGlobal();
        } catch { /* never block boot */ }
        try {
          const { installBuyerTrustGlobal } =
            await import('./runtime/buyerTrust/index');
          installBuyerTrustGlobal();
        } catch { /* never block boot */ }
        try {
          const { installKnowledgeContentGlobal } =
            await import('./runtime/knowledgeContent/index');
          installKnowledgeContentGlobal();
        } catch { /* never block boot */ }
        // Wave-28 — Harvest Readiness runtime. Composition over the
        // existing ScanRuntime + ArtifactRuntime + eventLogger;
        // never owns camera, never bypasses ScanRuntime, never
        // writes tasks directly. Pins window.__harvestReadinessHealth
        // and extends __scanAnalysisHealth with harvest readiness
        // flags. See src/runtime/harvest/.
        try {
          const { installHarvestReadinessGlobal } =
            await import('./runtime/harvest/index');
          installHarvestReadinessGlobal();
        } catch { /* never block boot */ }
        // Wave-29 Scan Intelligence V2 — four additional composition
        // runtimes evaluated against the same normalized scan result.
        // Each pins its own diagnostic global; together with
        // __harvestReadinessHealth they upgrade scan from an
        // identification engine to an agricultural decision engine.
        try {
          const { installGrowthStageGlobal } =
            await import('./runtime/growth/index');
          installGrowthStageGlobal();
        } catch { /* never block boot */ }
        try {
          const { installSeverityGlobal } =
            await import('./runtime/severity/index');
          installSeverityGlobal();
        } catch { /* never block boot */ }
        try {
          const { installOutcomeComparisonGlobal } =
            await import('./runtime/outcomeComparison/index');
          installOutcomeComparisonGlobal();
        } catch { /* never block boot */ }
        try {
          const { installWeatherRiskGlobal } =
            await import('./runtime/weatherRisk/index');
          installWeatherRiskGlobal();
        } catch { /* never block boot */ }
        // Wave-36 V5 Invisible Agricultural Intelligence — three
        // composition runtimes that produce DECISION-LEVEL signals
        // (yield risk, satellite signals, knowledge graph). NEVER
        // exposed in grower UI as raw NDVI / graph JSON / yield
        // algorithm — only as simple cards via composeSafeMessage
        // and similar. The CI gate enforces no React imports + no
        // raw-data exposure in grower surfaces.
        try {
          const { installYieldIntelligenceGlobal } =
            await import('./runtime/yield/index');
          installYieldIntelligenceGlobal();
        } catch { /* never block boot */ }
        try {
          const { installSatelliteIntelligenceGlobal } =
            await import('./runtime/satellite/index');
          installSatelliteIntelligenceGlobal();
        } catch { /* never block boot */ }
        try {
          const { installKnowledgeGraphGlobal } =
            await import('./runtime/knowledgeGraph/index');
          installKnowledgeGraphGlobal();
        } catch { /* never block boot */ }
        // Wave-38 — Production go-live readiness: persistence
        // probe + invite providers + offline validation. Each
        // pins its diagnostic global and composes into
        // __goLiveHealth() / __releaseLock(). Persistence is
        // installed FIRST so other probes that depend on it
        // (GoLiveHealth's persistenceProductionSafe gate) read
        // the cached envelope.
        try {
          const { installPersistenceGlobal } =
            await import('./runtime/persistence/index');
          installPersistenceGlobal();
        } catch { /* never block boot */ }
        try {
          const { installInviteGlobal } =
            await import('./runtime/invites/index');
          installInviteGlobal();
        } catch { /* never block boot */ }
        try {
          const { installOfflineValidationGlobal } =
            await import('./runtime/offline/OfflineValidationRuntime');
          installOfflineValidationGlobal();
        } catch { /* never block boot */ }
        // Wave-39 — Adoption-readiness probes: farmer/gardener
        // onboarding, NGO onboarding, buyer onboarding, knowledge
        // coverage. Each pins its diagnostic global and composes
        // into __goLiveHealth(). All four are installed even when
        // some optional global health probes are absent.
        try {
          const { installOnboardingHealthGlobal } =
            await import('./runtime/adoption/OnboardingHealthRuntime');
          installOnboardingHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installNGOOnboardingHealthGlobal } =
            await import('./runtime/adoption/NGOOnboardingHealthRuntime');
          installNGOOnboardingHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installBuyerOnboardingHealthGlobal } =
            await import('./runtime/adoption/BuyerOnboardingHealthRuntime');
          installBuyerOnboardingHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installKnowledgeCoverageHealthGlobal } =
            await import('./runtime/adoption/KnowledgeCoverageHealthRuntime');
          installKnowledgeCoverageHealthGlobal();
        } catch { /* never block boot */ }
        // Wave-40 — Enterprise trust + operations hardening
        // probes. Tenant isolation, backup, security, program
        // evidence, and the composite enterprise-readiness verdict.
        // Audit/monitoring globals are wired by their own boot
        // paths elsewhere; this block adds the wave-40 wrappers.
        try {
          const { installTenantIsolationHealthGlobal } =
            await import('./runtime/enterprise/security/TenantIsolationHealthRuntime');
          installTenantIsolationHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installBackupHealthGlobal, markBackupRunbookPresent } =
            await import('./runtime/backup/BackupHealthRuntime');
          // The wave-40 governance gate enforces docs/BACKUP_RUNBOOK.md
          // ships in the build; this attestation flag mirrors that.
          markBackupRunbookPresent();
          installBackupHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installSecurityHealthGlobal } =
            await import('./runtime/security/SecurityHealthRuntime');
          installSecurityHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installProgramEvidenceHealthGlobal } =
            await import('./runtime/evidence/ProgramEvidenceHealthRuntime');
          installProgramEvidenceHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installEnterpriseReadinessGlobal } =
            await import('./runtime/enterprise/EnterpriseReadinessRuntime');
          installEnterpriseReadinessGlobal();
        } catch { /* never block boot */ }
        // Wave-23 — Launch-cleanup probes: clean-build attestation,
        // queue health, wave-23-target knowledge coverage. The
        // wave-23 KnowledgeCoverage installer intentionally
        // overrides the wave-39 adoption-tier installer (same
        // __knowledgeCoverageHealth global, launch-target envelope).
        try {
          const { installBuildHealthGlobal, markCleanBuild } =
            await import('./runtime/build/BuildHealthRuntime');
          // The wave-23 governance gate enforces clean:build ran
          // in build:safe; this attestation mirrors that fact for
          // the in-app diagnostic.
          markCleanBuild();
          installBuildHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installQueueHealthGlobal } =
            await import('./runtime/offline/QueueHealthRuntime');
          installQueueHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installKnowledgeCoverageGlobal } =
            await import('./runtime/knowledge/KnowledgeCoverageRuntime');
          installKnowledgeCoverageGlobal();
        } catch { /* never block boot */ }
        // Wave-41 — Pilot execution probes: plant-catalog readiness,
        // regional knowledge packs, NGO + grower pilot checklists,
        // outcome capture, and the pilot-command-center summary.
        try {
          const { installPlantCatalogReadinessGlobal } =
            await import('./runtime/knowledge/PlantCatalogReadinessRuntime');
          installPlantCatalogReadinessGlobal();
        } catch { /* never block boot */ }
        try {
          const { installRegionalKnowledgeGlobal } =
            await import('./runtime/knowledge/RegionalKnowledgeRuntime');
          installRegionalKnowledgeGlobal();
        } catch { /* never block boot */ }
        try {
          const { installPilotHealthGlobals } =
            await import('./runtime/pilot/PilotHealthRuntime');
          installPilotHealthGlobals();
        } catch { /* never block boot */ }
        // Wave-36 — outcome intelligence globals. Installed after
        // OutcomeRuntime so the chain runtime can compose against
        // the canonical store. Pins __pilotAnalytics +
        // __fieldOfficerView + __outcomeChainReady.
        try {
          const { installOutcomeIntelligenceGlobals } =
            await import('./runtime/outcomeIntelligence/index');
          installOutcomeIntelligenceGlobals();
        } catch { /* never block boot */ }
        // Production Acceptance — composite operator-facing
        // probe that mirrors docs/PRODUCTION_ACCEPTANCE_TEST.md.
        // Installed last so every upstream probe has had a chance
        // to land at boot.
        try {
          const { installProductionAcceptanceGlobal } =
            await import('./runtime/production/ProductionAcceptanceHealthRuntime');
          installProductionAcceptanceGlobal();
        } catch { /* never block boot */ }
        // Wave-37 — Field intelligence globals. Composes existing
        // outcome + retention data only; never invents metrics.
        try {
          const { installFieldIntelligenceGlobals } =
            await import('./runtime/fieldIntelligence/FieldIntelligenceRuntime');
          installFieldIntelligenceGlobals();
        } catch { /* never block boot */ }
        // Wave-37.5 — Farmer Success Engine. Composes existing
        // outcomes + retention + field-intelligence + task-store
        // + weather signals into daily-assistant surfaces. No new
        // architecture; honest empty-states throughout.
        try {
          const { installFarmerSuccessGlobals } =
            await import('./runtime/farmerSuccess/FarmerSuccessEngine');
          installFarmerSuccessGlobals();
        } catch { /* never block boot */ }
        // Wave-38 — Pilot observability runtime. Activation,
        // adoption funnel, scan success metrics, alerts, NGO
        // command, composite __pilotHealth. Real data only.
        try {
          const { installPilotObservabilityGlobals } =
            await import('./runtime/pilotObservability/PilotObservabilityRuntime');
          installPilotObservabilityGlobals();
        } catch { /* never block boot */ }
        // Wave broken-link audit — installs __routeAuditHealth,
        // __brokenLinkHealth, and EXTENDS __scanUIHealth with the
        // 3 new attestation fields (scanRouteLoads,
        // scanSpinnerTimeoutReady, scanNavOpensCamera).
        try {
          const { installRouteAuditGlobals } =
            await import('./runtime/routeAudit/RouteAuditRuntime');
          installRouteAuditGlobals();
        } catch { /* never block boot */ }
        // Wave real-device scan validation — pins
        // __scanStartupHealth() and starts a 250ms DOM-poll loop
        // that tracks the EXACT startup stage the scan-route
        // reached. Also transparently wraps
        // navigator.mediaDevices.getUserMedia so cameraRequested /
        // cameraGranted timestamps are real, not inferred.
        try {
          const { installScanStartupHealthGlobal } =
            await import('./runtime/scanStartup/ScanStartupHealthRuntime');
          installScanStartupHealthGlobal();
        } catch { /* never block boot */ }
        // Login-routing fix — pins __loginRoutingHealth() so the
        // post-login routing + optional-location contract is
        // observable on real devices.
        try {
          const { installLoginRoutingHealthGlobal } =
            await import('./runtime/loginRouting/LoginRoutingHealthRuntime');
          installLoginRoutingHealthGlobal();
        } catch { /* never block boot */ }
        // Permanent scan-stability — pins __scanPermanentHealth()
        // (safe-shell-first / upload-primary / camera-optional
        // contract). Installed after the scan-startup probe so the
        // roll-up can cross-check it.
        try {
          const { installScanPermanentHealthGlobal } =
            await import('./runtime/scanStartup/ScanPermanentHealthRuntime');
          installScanPermanentHealthGlobal();
        } catch { /* never block boot */ }
        // Option 3 — camera-like mobile shell diagnostic. Pins
        // __scanCameraLikeShellHealth() so the "camera look, safe-shell
        // protections preserved" contract is observable on-device.
        try {
          const { installScanCameraLikeShellHealthGlobal } =
            await import('./runtime/scanStartup/ScanCameraLikeShellHealthRuntime');
          installScanCameraLikeShellHealthGlobal();
        } catch { /* never block boot */ }
        // Permanent Mobile Navigation Fix — pins the five new
        // diagnostics so the stale-bundle / route-reach / route-guard /
        // bottom-nav / build-version contracts are observable on real
        // devices. All five are composition-only read-only probes.
        try {
          const { installAppVersionHealthGlobal } =
            await import('./runtime/appVersion/AppVersionRuntime');
          installAppVersionHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installCacheRecoveryHealthGlobal } =
            await import('./runtime/cache/CacheRecoveryRuntime');
          installCacheRecoveryHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installRouteReachHealthGlobal } =
            await import('./runtime/routeReach/RouteReachHealthRuntime');
          installRouteReachHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installRouteGuardHealthGlobal } =
            await import('./runtime/routeGuard/RouteGuardHealthRuntime');
          installRouteGuardHealthGlobal();
        } catch { /* never block boot */ }
        try {
          const { installBottomNavHealthGlobal } =
            await import('./runtime/bottomNav/BottomNavHealthRuntime');
          installBottomNavHealthGlobal();
        } catch { /* never block boot */ }
        // Auth-startup hard-stop diagnostic — pins __authStartupHealth()
        // so the bootstrap-timeout contract is observable on-device.
        try {
          const { installAuthStartupHealthGlobal } =
            await import('./runtime/authStartup/AuthStartupHealthRuntime');
          installAuthStartupHealthGlobal();
        } catch { /* never block boot */ }
        // Auth-refresh resilience diagnostic — pins __authRefreshHealth()
        // {refreshAttempts, refreshFailures, degradedMode, routeShellLoaded}
        // so the soft-auth-degraded contract (429/5xx never logs out) is
        // observable on-device.
        try {
          const { installAuthRefreshHealthGlobal } =
            await import('./runtime/authRefresh/AuthRefreshHealthRuntime');
          installAuthRefreshHealthGlobal();
        } catch { /* never block boot */ }
        // Composite startup probe — pins __startupHealth()
        // {routeMatched, routeLoaded, suspenseResolved, authLoaded,
        // profileLoaded, scanShellLoaded} so "did the app start, and
        // if not where did it stall?" is one console line.
        try {
          const { installStartupHealthGlobal } =
            await import('./runtime/startup/StartupHealthRuntime');
          installStartupHealthGlobal();
        } catch { /* never block boot */ }
        // Polling-discipline diagnostic — pins __pollingHealth()
        // {healthPollMs, localizationCached, authRefreshBackoffReady,
        // diagnosticsThrottled, no429Loop} so the 429-storm fixes are
        // observable on-device.
        try {
          const { installPollingHealthGlobal } =
            await import('./runtime/polling/PollingHealthRuntime');
          installPollingHealthGlobal();
        } catch { /* never block boot */ }
        // Final Pilot Gap Fix — pins __scanCameraUXHealth /
        // __uploadAnalysisHealth / __captureAnalysisHealth /
        // __inviteValidationHealth validation diagnostics.
        try {
          const { installPilotGapHealthGlobals } =
            await import('./runtime/pilotGap/PilotGapHealthRuntime');
          installPilotGapHealthGlobals();
        } catch { /* never block boot */ }
        // Performance audit diagnostics — pins __scanPerformanceHealth /
        // __pollingPerformanceHealth / __bundleHealth / __memoryHealth /
        // __performanceHealth (composite + verdict).
        try {
          const { installPerformanceHealthGlobals } =
            await import('./runtime/performance/PerformanceHealthRuntime');
          installPerformanceHealthGlobals();
        } catch { /* never block boot */ }
        // i18n diagnostics — pins __languageState / __languageHealth /
        // __messageTemplateHealth (honest coverage, no fake 100%).
        try {
          const { installLanguageHealthGlobals } =
            await import('./runtime/i18n/LanguageHealthRuntime.js');
          installLanguageHealthGlobals();
        } catch { /* never block boot */ }
        // Offline language packs + voice/text alignment diagnostics.
        try {
          const { installOfflineLanguagePackGlobal } =
            await import('./i18n/offlineLanguagePackRuntime.js');
          installOfflineLanguagePackGlobal();
        } catch { /* never block boot */ }
        try {
          const { installVoiceLanguageGlobal } =
            await import('./i18n/voiceLanguageRuntime.js');
          installVoiceLanguageGlobal();
        } catch { /* never block boot */ }
      } catch { /* never block app boot */ }
      try {
        // Wave 8 — app store readiness composite. Probes classifier
        // availability, installs safety-mode flag overrides, detects
        // notification transport, reads locale state. Idempotent.
        const { installAppStoreReadinessRuntime } =
          await import('./runtime/appStore/appStoreReadinessRuntime.js');
        await installAppStoreReadinessRuntime();
      } catch { /* never block app boot */ }
      try {
        const { installWeatherAndLanguageDiagnostics } =
          await import('./lib/weatherAndLanguageDiagnostics.js');
        installWeatherAndLanguageDiagnostics();
      } catch { /* never block app boot */ }
      try {
        const { installLocationDiagnostics } =
          await import('./core/location/locationIntelligenceEngine.js');
        installLocationDiagnostics();
      } catch { /* never block app boot */ }
      try {
        const { installCameraDiagnostics } =
          await import('./core/camera/cameraHealthEngine.js');
        installCameraDiagnostics();
      } catch { /* never block app boot */ }
      // iOS camera-init diagnostic — pins window.__cameraHealth()
      // {state, permissionState, videoReady, videoWidth, failedStage,
      // startupMs, …} so the REAL camera stage is observable on-device
      // (not the vague "runtimeInitialized" the scan-startup probe showed).
      try {
        const { installCameraHealthGlobal } =
          await import('./core/camera/cameraRuntimeManager.js');
        installCameraHealthGlobal();
      } catch { /* never block app boot */ }
    })();

    loadTranslations(getCurrentLang())
      .then(() => setI18nReady(true))
      .catch(() => setI18nReady(true)); // proceed even if translations fail — fallbacks work
    // Initialize offline sync — replays queued mutations when back online
    initAutoSync(api);
    // Funnel + attribution: capture acquisition source FIRST so
    // it's attached to every event the rest of the boot fires.
    // Both modules lazy-load so they stay out of the critical
    // path bundle.
    (async () => {
      try {
        const a = await import('./analytics/attribution.js');
        if (a && typeof a.captureFromUrl === 'function') {
          a.captureFromUrl();
        }
      } catch { /* swallow */ }
      try {
        const mod = await import('./analytics/funnelEvents.js');
        if (mod && typeof mod.markSessionStart === 'function') {
          mod.markSessionStart();
        }
      } catch { /* swallow */ }
    })();
    // Demo mode: populate the local store so every admin/NGO page
    // renders real data on first load. No-ops outside demo mode and
    // when the store already has real data (see demoSeed.isStoreEmpty).
    try { ensureDemoSeed(); } catch { /* never blocks app boot */ }
    // Schema versioning (Phase 1 spec §A) — one-shot
    // upgrade-on-boot for legacy localStorage shapes so a user
    // who skipped releases never sees a v1 blob crash a v5 render
    // path. Idempotent: the SCHEMA_VERSION sentinel guards against
    // re-running steps. See src/store/bootSchemaMigrate.js.
    (async () => {
      try {
        const mod = await import('./store/bootSchemaMigrate.js');
        if (mod && typeof mod.migrateOnBoot === 'function') {
          mod.migrateOnBoot();
        }
      } catch { /* never blocks app boot */ }
    })();
    // Soft-launch lifecycle listeners (Phase 3 §C) — install
    // window.onerror / unhandledrejection / stuck-screen watch
    // so app_error + screen_stuck events fire automatically
    // without every component having to subscribe. Idempotent.
    (async () => {
      try {
        const mod = await import('./analytics/lifecycleEvents.js');
        if (mod && typeof mod.installLifecycleListeners === 'function') {
          mod.installLifecycleListeners();
        }
      } catch { /* never blocks app boot */ }
    })();
    // Behavior tracking (gated). One `app_open` event per cold
    // mount feeds the local analytics log + the canonical pipeline.
    try {
      if (isFeatureEnabled('behaviorTracking')) {
        // Lazy-import so the analyticsStore is only pulled into
        // the bundle when the flag is on at build time.
        import('./analytics/analyticsStore.js')
          .then((m) => { try { m.trackEvent?.('app_open'); } catch { /* ignore */ } })
          .catch(() => { /* swallow */ });
      }
    } catch { /* never blocks app boot */ }
    // Refresh the synchronous mirrors of the IDB-backed farm +
    // progress stores. Both helpers swallow their own errors so
    // boot is never blocked by a missing IndexedDB.
    try { hydrateFarm(); } catch { /* never blocks app boot */ }
    try { hydrateProgress(); } catch { /* never blocks app boot */ }
    // Restore the user's saved UI language. Only applied when:
    //   (a) we have a saved value
    //   (b) the active language differs (avoid re-dispatching
    //       langchange events into a no-op)
    // This complements the existing i18n storage key ('farroway:lang')
    // by surfacing the user's deliberate setup-screen choice even
    // when the i18n key is missing (e.g. fresh install on a new
    // browser that imported localStorage from a backup).
    try {
      const saved = getSavedLanguage();
      if (saved) {
        let active = '';
        try { active = getActiveLanguage(); } catch { /* keep '' */ }
        if (saved !== active) setLangGlobally(saved);
      }
    } catch { /* never blocks app boot */ }
    // Dev/opt-in console snapshot. Production: silent no-op.
    try { logSessionState('boot'); } catch { /* never blocks app boot */ }
    // Daily engagement loop. Returns a teardown for the soft
    // reminder timer; we don't capture it here because the timer
    // is itself idempotent across re-mounts (single-flight inside
    // scheduleReminder). On HMR the previous timer is replaced
    // automatically.
    try { initDailyLoop(); } catch { /* never blocks app boot */ }
    // NGO impact: log APP_OPENED once per app boot. Kept lean —
    // the active-farmer count uses ANY event in the 7-day window,
    // so a single boot row is enough to mark the farmer alive.
    try {
      logEvent(EVENT_TYPES.APP_OPENED, {
        openedAt: new Date().toISOString(),
      });
    } catch { /* never blocks app boot */ }
  }, []);

  // Lightweight offline-action queue auto-flush (additive — sits
  // alongside the existing IndexedDB sync engine). Every 5s, when
  // online, drain `farroway_offline_queue` by handing each entry's
  // `action` to a tiny dispatcher that maps action types to their
  // existing API helpers. The dispatcher is intentionally small
  // and stateless — it does NOT replace any sync logic, just gives
  // the new low-literacy farmer flows a path home.
  useEffect(() => {
    let cancelled = false;
    async function dispatchOne(action, meta) {
      // Module-local capture so the closure doesn't have to
      // import pilotFlags on every dispatch — and so a future
      // hot reload can flip the const without re-mounting.
      const FEATURE_EVENT_SYNC_RUNTIME = PILOT_FEATURE_EVENT_SYNC;
      // Fire-and-forget mapping. Any unrecognised type is dropped
      // silently to avoid jamming the queue on shape drift.
      if (!action || typeof action !== 'object') return;
      const { default: api } = await import('./api/client.js');
      // The queue mints an idempotency key per entry; forward it as
      // a header so any server endpoint that respects it can dedupe
      // a re-fired action after a lost network response. Headers are
      // strictly additive — no existing endpoint is required to
      // implement them, but those that do get exactly-once semantics
      // for free.
      const headers = {};
      if (meta && meta.idempotencyKey) {
        headers['Idempotency-Key'] = meta.idempotencyKey;
      }
      const cfg = Object.keys(headers).length ? { headers } : undefined;
      switch (action.type) {
        case 'task_complete': {
          const { farmId, taskId, body } = action.payload || {};
          if (!farmId || !taskId) return;
          return api.post(
            `/farm-tasks/${farmId}/tasks/${encodeURIComponent(taskId)}/complete`,
            body || {},
            cfg,
          );
        }
        case 'farm_update': {
          const { farmId, payload } = action.payload || {};
          if (!farmId || !payload) return;
          return api.patch(`/farm-profile/${farmId}`, payload, cfg);
        }
        case 'harvest_record': {
          const { cycleId, payload } = action.payload || {};
          if (!cycleId || !payload) return;
          return api.post(`/crop-cycles/${cycleId}/harvest`, payload, cfg);
        }
        // Retention Loop \u00a76 follow-up \u2014 micro health-feedback
        // mirror. Local persistence at `farroway_health_feedback`
        // is the source of truth; this case forwards the same
        // payload to the server endpoint so admin dashboards can
        // aggregate cross-device. Gated by
        // FEATURE_HEALTH_FEEDBACK_SYNC at the enqueue site
        // (src/core/healthFeedbackStore.js); when the flag is
        // off no entries land here, so the dispatcher is a
        // no-op until the server route ships.
        case 'health_feedback': {
          const { contextId, contextType, date, healthFeedback } = action.payload || {};
          if (!contextId || !healthFeedback) return;
          return api.post('/health-feedback', {
            contextId,
            contextType,
            date,
            healthFeedback,
          }, cfg);
        }
        // Data Moat Layer follow-up \u2014 canonical event-log
        // mirror. Each tracked event becomes one queue entry
        // of type 'event'; the local eventStore at
        // farroway_events stays the source of truth, this
        // forwards the same record to the server route so
        // admin surfaces can aggregate cross-device.
        //
        // Gated TWICE for safety:
        //   1. FEATURE_EVENT_SYNC at the enqueue site
        //      (src/core/analytics.js) prevents new entries
        //      from being queued while the flag is off.
        //   2. Belt-and-braces guard here: if a stale entry
        //      slipped through from an earlier session, this
        //      dispatcher silently swallows it instead of
        //      POSTing to /api/events. The wrapping syncQueue
        //      treats a resolved promise as success and removes
        //      the entry from the queue, so the bad payload
        //      drains in exactly one tick.
        //
        // 400 handling (spec \u00a74): a permanent client-side
        // validation failure must NOT retry. We catch the
        // axios error inline, warn ONCE per process, and
        // resolve with `undefined` so syncQueue removes the
        // entry instead of bumping its retry counter.
        case 'event': {
          // Hard kill switch (May 2026) — DISABLE_EVENTS is the
          // outermost guard. When true, EVERY event entry drains
          // silently regardless of any other flag state. Belt-
          // and-braces: even if a stale entry survived the boot
          // wipe AND somehow bypassed addToQueue's refusal,
          // this branch never POSTs.
          if (DISABLE_EVENTS || !FEATURE_EVENT_SYNC_RUNTIME) {
            // Drain quietly. Resolving (not throwing) tells
            // syncQueue to remove the entry from the queue.
            return undefined;
          }
          const { name, payload } = action.payload || {};
          // Spec \u00a73 \u2014 validate event before sending.
          if (!name || typeof name !== 'string') return undefined;
          if (payload != null && typeof payload !== 'object') {
            return undefined;
          }
          try {
            return await api.post('/events', { name, payload }, cfg);
          } catch (err) {
            const status = err && err.response && err.response.status;
            if (status === 400) {
              _warnEventsBadRequestOnce(name);
              // Resolve, don't throw \u2014 dropping the entry.
              return undefined;
            }
            // Any other error \u2014 5xx, network, etc. \u2014 still
            // throws so syncQueue's existing retry/backoff
            // path takes over.
            throw err;
          }
        }
        default:
          return undefined;
      }
    }
    const tick = () => {
      if (cancelled) return;
      // Best-effort. Any error is already isolated per-entry by
      // syncQueue itself, so we don't await here.
      syncQueue(dispatchOne).catch(() => { /* never propagate */ });
    };
    const id = setInterval(tick, 5000);
    // Also flush opportunistically when the browser flips back to
    // online — getting an instant retry on reconnect, not waiting
    // for the next 5s tick.
    const onOnline = () => tick();
    if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
    // Run once shortly after mount in case the queue has stale
    // entries from a previous session.
    const bootId = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(bootId);
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
    };
  }, []);

  // Global Insights Layer — opportunistic batch sync of locally-
  // aggregated event deltas to /api/insights/batch. The sync helper
  // (src/core/localInsightSync.js) self-respects the privacy
  // opt-out (farroway:helpImproveRecommendations) AND short-
  // circuits when offline, so this effect can fire freely without
  // an online-check here.
  //
  // Cadence (per spec §5: "daily or on app idle"):
  //   • One opportunistic sync 30s after mount (settle period)
  //   • Every 30 minutes while the tab is open
  //   • Whenever the tab becomes visible again (handles "open
  //     overnight, foreground in the morning" path which the 30-
  //     minute tick would otherwise miss for hours)
  //   • Whenever the network flips back online (mirrors the
  //     offline-queue dispatcher above)
  //
  // No backend ticket: the endpoint already exists, model already
  // migrated. Auto-flush turns on the data flow. ​
  useEffect(() => {
    let cancelled = false;
    let lastRunAt = 0;
    const MIN_GAP_MS = 60_000; // never run twice within 60s
    async function runSync() {
      if (cancelled) return;
      if (Date.now() - lastRunAt < MIN_GAP_MS) return;
      lastRunAt = Date.now();
      try {
        const [{ syncInsights }, { default: api }] = await Promise.all([
          import('./core/localInsightSync.js'),
          import('./api/client.js'),
        ]);
        await syncInsights({ apiClient: api });
      } catch {
        // Failure is intentionally swallowed — the helper itself
        // never throws, but a dynamic-import failure on a slow
        // network shouldn't break boot.
      }
    }
    const startId = setTimeout(runSync, 30_000);
    const tickId  = setInterval(runSync, 30 * 60_000);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        runSync();
      }
    };
    const onOnline = () => runSync();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
    if (typeof window   !== 'undefined') window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      clearTimeout(startId);
      clearInterval(tickId);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      if (typeof window   !== 'undefined') window.removeEventListener('online', onOnline);
    };
  }, []);

  // Go-live audit — listing expiry sweep. Runs once on boot via
  // a microtask so it never blocks render. Idempotent: rerunning
  // is a no-op once everything stale is already flagged. Lazy-
  // imported so a problem inside marketStore can never break boot.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(async () => {
      if (cancelled) return;
      try {
        const m = await import('./market/marketStore.js');
        const changed = (m.sweepExpiredListings || (() => 0))();
        if (changed > 0) {
          try {
            const a = await import('./analytics/analyticsStore.js');
            a.trackEvent?.('listing_expiry_sweep', { changed });
          } catch { /* swallow */ }
        }
      } catch { /* never propagate */ }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <BrowserRouter>
      {/* User Behavior Tracking §4 — observes route changes and
          installs page-unload exit listeners. Renders nothing;
          purely a side-effect component so it has to live INSIDE
          BrowserRouter (useLocation is unavailable above it). */}
      <ExitTrackingObserver />
      <NetworkProvider>
      <AppPrefsProvider>
      <AuthProvider>
      <V2ProfileProvider>
      <UserModeProvider>
      <WeatherProvider>
      <ForecastProvider>
      <MarketProvider>
      <SeasonProvider>
      {stepUpRequired && <StepUpModal />}
      <SyncStatus />
      {/* Offline banner wired to the real sync transport — routes
          queued actions (task_complete, task_skip, crop.update,
          farm.update, listing.draft, photo.metadata) to their
          actual server endpoints when the device reconnects. */}
      {/* Wire refreshAuth into the sync transport so the queue can
            self-heal once on a 401 (Gap B of final hardening sprint).
            refreshSession returns boolean — exactly the contract
            transport.send expects. */}
      <OfflineBanner transport={makeOfflineTransport({ refreshAuth: refreshSession })} />
      {/* App Store launch audit §4.1.4: surfaces the
          `farroway:sw_new_version` event dispatched by
          registerServiceWorker so users on long-running tabs
          actually pick up production deploys instead of being
          stuck on stale builds. */}
      <SWUpdateBanner />
      {/* Safe Runtime Layer: global crash boundary. Sits inside the
          router so Link/useNavigate work in the recovery UI, and
          outside every per-route boundary so it catches anything
          that escapes SafeRouteShell. Resets automatically when
          the user navigates to a new route (routeKey = pathname). */}
      <AppCrashBoundaryWithLocation>
      <AuthLoadingGate>
      {/* RC1 — global persistent offline-pending banner. Self-hides
          when the queue is empty. Reads via wave-7 queueRegistry. */}
      <OfflineQueueBanner />
      {/* Wave real-device scan validation — fixed-position banner.
          Renders nothing unless the user is on /scan AND startup
          has exceeded 3s. Eager-loaded above Suspense so it can
          render even while the scan-page chunk is still loading. */}
      <ScanStartupBanner />
      <LazyLoadErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Marketing landing page (farroway.app homepage).
              Both /welcome and /landing render the same v3
              page so external links keep working. */}
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          {/* Wave-39 — public invite-activation route. */}
          <Route path="/activate" element={<Activate />} />

          {/* Viral Click → Conversion (§1-§5) — value-first
              landing for share-link recipients. Two paths so
              both `farroway.app/try?ref=...` and
              `farroway.app/preview?ref=...` resolve, letting
              the team A/B-test path naming without breaking
              outbound shares. Public — no auth gate. */}
          <Route path="/try"     element={<ViralLandingPage />} />
          <Route path="/preview" element={<ViralLandingPage />} />

          {/* Public Marketplace — buyers browse without an
              account. Interest forms route to platform/admin
              via marketStore.saveBuyerInterest; farmer phone
              is never exposed publicly. */}
          <Route path="/marketplace" element={
            <SafeRouteShell routeName="marketplace">
              <FeatureGated flag="FEATURE_BUYER" feature="buyer">
                {/* Garden Mode Refactor §3 — gardeners never see
                    commercial marketplace. Calm empty-state instead. */}
                <BackyardGuard surface="sell"><Marketplace /></BackyardGuard>
              </FeatureGated>
            </SafeRouteShell>
          } />
          {/* Role-routing canonical paths (May 2026).
              /home    → role-aware redirect (farmer→/dashboard,
                         ngo→/dashboard, buyer→/market).
              /market  → canonical buyer landing → bounces to
                         /market/browse which already exists.
              These keep the spec's role-routing contract
              clean while reusing the existing destination
              pages — no codebase duplication. */}
          {/* /home — single canonical Home route. Renders the
              safe-default Home that never returns null, never
              redirects, and renders with hard-coded fallbacks for
              missing location / farm / crop / weather. Replaces
              the old RoleHomeRedirect (which infinite-looped for
              farmer.homePath='/home'). The role-redirect helper is
              still imported for the "/" entry below where staff/
              admin still benefit from the role-aware landing. */}
          {/* Canonical farmer Home — the SINGLE entry point per
              Permanent Farmer Home Nav Enforcement spec §1.
              Bottom-nav Home tab routes here directly; "/"
              redirects here; legacy "/dashboard" redirects
              here (via RoleAwareDashboard for non-NGO roles).
              HomeErrorBoundary wraps Home so any render throw
              shows a calm fallback instead of crashing the
              shell — was previously only wrapped on the "/"
              path; now wraps the canonical path so both
              entry vectors benefit from the boundary. */}
          {/* /home moved INSIDE V2ProtectedLayout (see below) per
              Home Bottom Nav Visibility Fix — the previous mount
              point HERE was outside the layout shell, so the
              canonical Home rendered without a BottomTabNav. */}
          <Route path="/market" element={<Navigate to="/market/browse" replace />} />

          {/* Farmer-first entry: Welcome gate (auto-routes if session exists) */}
          {/* Universal Plant Runtime home grid + single-plant
              profile. /plants → /my-plants alias keeps legacy
              deep links pointing to the right surface. */}
          <Route path="/my-plants" element={<MyPlants />} />
          <Route path="/my-plants/:plantId" element={<PlantProfile />} />
          <Route path="/plants/:plantId"    element={<PlantProfile />} />
          <Route path="/plants"    element={<Navigate to="/my-plants" replace />} />
          {/* Internal-only founder dashboard. Page itself
              enforces the internal gate via INTERNAL_FLAG_KEY +
              <RoleRoute> defence-in-depth. Restricted to admins.
              Non-farmer/gardener/grower role list. */}
          <Route path="/internal/founder" element={<RoleRoute roles={ADMIN_ROLES}><FounderDashboard /></RoleRoute>} />
          {/* Internal release-lock dashboard. INTERNAL_FLAG_KEY gate
              inside the page, plus <RoleRoute> guard so non-admins
              redirect to "/". Excludes farmer/gardener/grower. */}
          <Route path="/internal/release-lock" element={<RoleRoute roles={ADMIN_ROLES}><ReleaseLockPage /></RoleRoute>} />
          {/* Internal-only architecture audit. Same INTERNAL_FLAG_KEY
              gate as release-lock plus <RoleRoute> wrapper. */}
          <Route path="/internal/godmode" element={<RoleRoute roles={ADMIN_ROLES}><GodmodePage /></RoleRoute>} />
          {/* Wave-41 — pilot validation surfaces (admin only). */}
          <Route path="/internal/pilot"        element={<RoleRoute roles={ADMIN_ROLES}><PilotCommandPage /></RoleRoute>} />
          <Route path="/internal/pilot/ngo"    element={<RoleRoute roles={ADMIN_ROLES}><NGOPilotPage /></RoleRoute>} />
          <Route path="/internal/performance"  element={<RoleRoute roles={ADMIN_ROLES}><PerformancePage /></RoleRoute>} />
          <Route path="/internal/i18n"         element={<RoleRoute roles={ADMIN_ROLES}><I18nQAPage /></RoleRoute>} />
          <Route path="/internal/pilot/grower" element={<RoleRoute roles={ADMIN_ROLES}><GrowerPilotPage /></RoleRoute>} />
          {/* Wave-36 — outcome intelligence surfaces (admin only). */}
          <Route path="/internal/pilot-analytics"               element={<RoleRoute roles={ADMIN_ROLES}><PilotAnalyticsPage /></RoleRoute>} />
          <Route path="/internal/pilot-readiness"               element={<RoleRoute roles={ADMIN_ROLES}><PilotReadinessPage /></RoleRoute>} />
          {/* Execution Mode — pilot command center (reuses the readiness board). */}
          <Route path="/internal/pilot-command"                 element={<RoleRoute roles={ADMIN_ROLES}><PilotReadinessPage /></RoleRoute>} />
          <Route path="/internal/pilot-analytics/field-officer" element={<RoleRoute roles={ADMIN_ROLES}><FieldOfficerOutcomesPage /></RoleRoute>} />
          {/* Wave-37 — executive field-intelligence dashboard (admin only). */}
          <Route path="/internal/intelligence" element={<RoleRoute roles={ADMIN_ROLES}><FieldIntelligencePage /></RoleRoute>} />
          {/* Wave-38 — NGO command center (admin only). */}
          <Route path="/internal/ngo-health"   element={<RoleRoute roles={ADMIN_ROLES}><NGOHealthPage /></RoleRoute>} />
          {/* Intelligence Layer v1 — NGO impact analytics (admin only,
              org-scoped via __ngoImpactHealth; surfaces the same
              command-center page under the spec path). */}
          <Route path="/internal/ngo-impact"   element={<RoleRoute roles={ADMIN_ROLES}><NGOHealthPage /></RoleRoute>} />
          {/* V7 — institutional command center + NGO intelligence (admin only). */}
          <Route path="/internal/v7"               element={<RoleRoute roles={ADMIN_ROLES}><V7CommandCenterPage /></RoleRoute>} />
          <Route path="/internal/ngo-intelligence" element={<RoleRoute roles={ADMIN_ROLES}><NGOIntelligencePage /></RoleRoute>} />
          {/* V8 — next platform layer command center (admin only). */}
          <Route path="/internal/v8"               element={<RoleRoute roles={ADMIN_ROLES}><V8CommandCenterPage /></RoleRoute>} />
          {/* V13 — institutional data/MLOps readiness command center (admin only). */}
          <Route path="/internal/v13"              element={<RoleRoute roles={ADMIN_ROLES}><V13CommandCenterPage /></RoleRoute>} />
          <Route path="/internal/qa"     element={<RoleRoute roles={ADMIN_ROLES}><QAPage /></RoleRoute>} />
          <Route path="/internal/qa/offline" element={<RoleRoute roles={ADMIN_ROLES}><OfflineQAPage /></RoleRoute>} />
          <Route path="/internal/community-moderation" element={<RoleRoute roles={ADMIN_ROLES}><CommunityModerationPage /></RoleRoute>} />
          <Route path="/internal/review" element={<RoleRoute roles={ADMIN_ROLES}><ReviewPage /></RoleRoute>} />
          {/* Wave-27 fix — /internal/production-certification was
              mounted without any RoleRoute; the founder-readiness
              audit (Part 3) flagged it as a critical access bug.
              Now matched to the rest of /internal/* (godmode/qa/review)
              which all gate by ADMIN_ROLES. */}
          <Route path="/internal/production-certification" element={<RoleRoute roles={ADMIN_ROLES}><ProductionCertificationPage /></RoleRoute>} />
          {/* Enterprise Agriculture Platform. <RoleRoute> with admin-only
              role list (excludes farmer/gardener/grower). Full
              OrganizationMember role check ships with the Prisma migration. */}
          <Route path="/enterprise" element={<RoleRoute roles={ADMIN_ROLES}><EnterpriseHome /></RoleRoute>} />
          <Route path="/start" element={<FarmerEntry />} />

          {/* Farmer-first entry (phone OTP, Google, offline) */}
          <Route path="/farmer-welcome" element={<FarmerWelcome />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />

          {/* V2 enterprise auth routes (cookie-based, httpOnly) */}
          <Route path="/login" element={<V2Login />} />
          {/* Wave-15 — opt-in organization sign-in. Lives at
              /org-login, deliberately NOT linked from any
              grower nav so farmers / gardeners never see SSO
              options unless their org admin shares the link. */}
          <Route path="/org-login" element={<OrgLoginPage />} />
          {/* Wave broken-link audit — spec-named /organization
              aliases redirect to the canonical /org-login surface
              so spec deep-links resolve. */}
          <Route path="/organization"    element={<Navigate to="/org-login" replace />} />
          <Route path="/organization/*"  element={<Navigate to="/org-login" replace />} />
          <Route path="/register" element={<V2Register />} />
          <Route path="/forgot-password" element={<V2ForgotPassword />} />
          <Route path="/forgot-password/sms" element={<V2ForgotPasswordSms />} />
          <Route path="/reset-password" element={<V2ResetPassword />} />

          {/* Farm-issue management pipeline. Farmer submits, admin
              triages + assigns, field officer works + resolves. Kept
              local-first for v1; server endpoints will slot in later
              without changing the UI shape.
              NOTE: /admin/farm-issues moved to V2ProtectedLayout
              below (Phase 6 fix — was unguarded in public block). */}
          <Route path="/report-issue"     element={<ReportIssuePage />} />
          <Route path="/my-issues"        element={<MyIssuesPage />} />
          <Route path="/officer/issues"   element={<OfficerIssuesPage />} />
          <Route path="/verify-email" element={<V2VerifyEmail />} />
          <Route path="/profile/setup" element={<V2ProfileSetup />} />
          {/* Public pricing page - reachable without auth. Gated
              under FEATURE_PRICING so the May 2026 stable-pilot
              restore can hide it; renders the canonical
              "Feature temporarily disabled for pilot." fallback
              when the flag is off. */}
          <Route path="/pricing" element={
            <FeatureGated flag="FEATURE_PRICING" feature="pricing">
              <Pricing />
            </FeatureGated>
          } />

          {/* Go-live audit fix: legal + help surfaces MUST be
              reachable without a session so App Store reviewers
              and unauthenticated visitors can land on them.
              Previously these were nested inside V2ProtectedLayout
              despite the comment claiming "Public" — moving them
              to the public block here. */}
          {/* Legacy /help + /contact stay mounted so existing
              deep links (App Store metadata, voice-assistant
              "I need help" intent, share cards, etc.) still
              resolve to a working surface. */}
          <Route path="/help"    element={<HelpPage />} />
          <Route path="/contact" element={<ContactPage />} />
          {/* May 2026 support-system unification (spec §2):
              /support is the canonical hub. FAQ + contact form
              are dedicated pages instead of /help aliases so the
              hub can showcase distinct affordances without the
              old "FAQ === /help" overload. */}
          <Route path="/support"          element={<SupportCenterPage />} />
          <Route path="/support/faq"      element={<SupportFAQPage />} />
          <Route path="/support/contact"  element={<SupportContactPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms"   element={<Terms />} />
          <Route path="/disclaimer"   element={<GuidanceDisclaimer />} />
          <Route path="/data-consent" element={<DataConsent />} />
          <Route element={<V2ProtectedLayout />}>
            {/* Frictionless welcome screen - the new first-time
                destination. Legacy /onboarding + /onboarding/fast
                routes remain reachable for users / scripts that
                deep-link to them. */}
            {/* Onboarding cleanup — single canonical entry. Every
                legacy onboarding route now redirects to
                /onboarding/fast (FastOnboarding, the sub-30s path).
                The component imports stay for now so any tests
                that exercise them keep working; the visible flow
                converges on one place. Deletion of dead components
                is a separate follow-up commit. */}
            <Route path="/onboarding/quick" element={<Navigate to="/onboarding/fast" replace />} />
            {/* /onboarding/start — new 4-screen FastFlow per the
                action-first spec. Reaches first-task in <60 s.
                Existing /onboarding/quick + /onboarding/minimal
                + /onboarding/v3 routes stay intact for scripts
                or links that deep-link to them. */}
            <Route path="/onboarding/start" element={<Navigate to="/onboarding/fast" replace />} />
            {/* Perfect Onboarding spec — sub-30-second 4-screen
                path. /onboarding/fast is the canonical entry.
                The bare /onboarding path stays bound to
                OnboardingRouter (line 947) so the existing
                LandingPage / FarmerEntry funnel keeps working;
                that router can opt into the fast flow via its
                own redirect logic without us double-mounting
                the route here. */}
            <Route path="/onboarding/fast" element={<FastOnboarding />} />
            <Route path="/onboarding/minimal" element={<Navigate to="/onboarding/fast" replace />} />
            <Route path="/onboarding/farmer-type" element={<Navigate to="/onboarding/fast" replace />} />
            <Route path="/onboarding/starter-guide" element={<Navigate to="/onboarding/fast" replace />} />
            {/* Canonical Farmer Home — Home Bottom Nav Visibility
                Fix: /home MUST be a child of V2ProtectedLayout so
                the persistent BottomTabNav (rendered by the
                layout's Outlet siblings) wraps the canonical Home.
                Previous mount was at line ~1140 OUTSIDE this
                layout, which is why Home rendered without a
                bottom nav on production. Now sits next to
                /dashboard, /tasks, /my-farm as canonical
                authenticated routes. */}
            <Route path="/home" element={
              <SafeRouteShell routeName="home" loadingMs={5000}>
                <HomeErrorBoundary>
                  <Home />
                </HomeErrorBoundary>
              </SafeRouteShell>
            } />
            <Route path="/dashboard" element={
              <SafeRouteShell routeName="dashboard">
                <DashboardErrorBoundary>
                  <RoleAwareDashboard>
                    <ExperienceFallback><V2Dashboard /></ExperienceFallback>
                  </RoleAwareDashboard>
                </DashboardErrorBoundary>
              </SafeRouteShell>
            } />
            <Route path="/tasks" element={
              <SafeRouteShell routeName="tasks">
                <AllTasksPage />
              </SafeRouteShell>
            } />
            <Route path="/my-farm" element={
              <SafeRouteShell routeName="my-farm">
                <ExperienceFallback><MyFarmPage /></ExperienceFallback>
              </SafeRouteShell>
            } />
            {/* Phase 1 §A.5 — backyard nav tab points at /my-grow.
                We mount the same MyFarmPage so all the existing
                action-first / photo-upload / switch / edit
                affordances are reused; the page reads
                useUserMode() and renders "My Grow" wording when
                the userType is backyard, "My Farm" when farmer.
                Strict no-duplicates: NO parallel /my-grow page. */}
            <Route path="/my-grow" element={
              <SafeRouteShell routeName="my-grow">
                <ExperienceFallback><MyFarmPage /></ExperienceFallback>
              </SafeRouteShell>
            } />
            {/* /help moved to the public block above (go-live audit). */}
            {/* Simple Onboarding (rollout v1) — gated by
                FEATURE_SIMPLE_ONBOARDING inside the component;
                when off it forwards to /onboarding so existing
                pilots are unaffected. */}
            <Route path="/onboarding/simple" element={<Navigate to="/onboarding/fast" replace />} />
            <Route path="/progress" element={<Navigate to="/activity" replace />} />
            {/* Remove Mobile Dashboard Experience §6 — Progress is
                renamed to Activity in the grower nav. /activity
                mounts the same FarmerProgressPage (already
                action-first, no analytics, GrowthJourneyCard
                timeline). /progress remains live for backwards
                compatibility and deep links. */}
            <Route path="/activity" element={
              <SafeRouteShell routeName="activity">
                <FarmerProgressPage />
              </SafeRouteShell>
            } />
            {/* Garden Mode Refactor §4 — calm growth-story timeline
                that replaces Progress as the 4th bottom-nav tab in
                garden mode. Always-mounted (never gated) so deep
                links never 404; the page itself reads
                usePlantTimeline + usePlantIdentity locally. */}
            <Route path="/journal" element={
              <SafeRouteShell routeName="journal">
                <JournalPage />
              </SafeRouteShell>
            } />
            <Route path="/season/start" element={<V2SeasonStart />} />
            <Route path="/beginner-reassurance" element={<BeginnerReassurance />} />
            <Route path="/crop-fit" element={<CropFitIntake />} />
            <Route path="/crop-fit/us" element={<USCropRecommendations />} />
            <Route path="/crop-plan" element={<CropPlan />} />
            {/* NGO surfaces — gated by FEATURE_NGO (Phase 5 restore).
                Server APIs at /api/v2/ngo/* enforce role via 403;
                FeatureGated adds a calm placeholder while flag is off
                so deep-links never 404. RouteErrorBoundary isolates
                any render crash from the shell. */}
            {/* Phase 5 restore — basic NGO dashboard.
                Client-side: RoleRoute blocks non-NGO from rendering the page.
                Server-side: /api/v2/ngo/* routes enforce role + org scope (403 on violation).
                DO NOT redirect users to setup from here — see routePolicy.js. */}
            <Route path="/ngo" element={
              <SafeRouteShell routeName="ngo-dashboard-v1">
                <FeatureGated flag="FEATURE_NGO" feature="ngo">
                  <RoleRoute roles={[...STAFF_ROLES, 'ngo_admin', 'field_agent', 'ngo', 'reviewer']}>
                    <NgoDashboardV1 />
                  </RoleRoute>
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/ngo/interventions" element={
              <SafeRouteShell routeName="ngo-interventions">
                <FeatureGated flag="FEATURE_NGO" feature="ngo">
                  <InterventionCenter />
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/ngo/scores" element={
              <SafeRouteShell routeName="ngo-scores">
                <FeatureGated flag="FEATURE_NGO" feature="ngo">
                  <FarmerScoring />
                </FeatureGated>
              </SafeRouteShell>
            } />
            {/* /ngo/funding now renders the v3 FundingAdmin
                management surface (see route below). The
                legacy FundingReadiness page is kept reachable
                at /ngo/funding-readiness for any internal
                links that still point at it. */}
            <Route path="/ngo/funding-readiness" element={
              <SafeRouteShell routeName="ngo-funding-readiness">
                <FeatureGated flag="FEATURE_NGO" feature="ngo">
                  <FundingReadiness />
                </FeatureGated>
              </SafeRouteShell>
            } />
            {/* Monetisation layer (additive). Distinct from the
                server-fed NGOOverview above; reads local metrics
                + pricing config so it works in demos / offline.
                /pricing itself lives outside this protected block
                so it can be demo'd without an account. */}
            <Route path="/ngo/value" element={
              <SafeRouteShell routeName="ngo-value">
                <FeatureGated flag="FEATURE_NGO" feature="ngo">
                  <NgoValueDashboard />
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/ngo/control" element={
              <SafeRouteShell routeName="ngo-control">
                <FeatureGated flag="FEATURE_NGO" feature="ngo">
                  <NgoControlPanel />
                </FeatureGated>
              </SafeRouteShell>
            } />
            {/* Phase 6 restore — basic Admin dashboard.
                Client-side: RoleRoute blocks non-admins (redirects to /).
                Server-side: /api/v2/admin/* enforce super_admin | institutional_admin (403).
                DO NOT add location/crop/farm checks here — see routePolicy.js. */}
            <Route path="/admin" element={
              <SafeRouteShell routeName="admin-basic">
                <FeatureGated flag="FEATURE_ADMIN" feature="admin">
                  <RoleRoute roles={ADMIN_ROLES}>
                    <AdminBasicPage />
                  </RoleRoute>
                </FeatureGated>
              </SafeRouteShell>
            } />

            <Route path="/today" element={
              <DashboardShell>
                <FarmerTodayPage />
              </DashboardShell>
            } />
            <Route path="/today/quick" element={<TodayQuick />} />

            {/* Buyer + Funding/Impact layer — v3 local-first
                routes mounted alongside the legacy
                /farmer/listings* + /market/* surfaces (those
                stay for backend-driven flows).
                /ngo/impact is staff-only (NGO operators
                + super_admin) so a regular farmer who
                stumbles onto the URL is redirected. */}
            <Route path="/sell" element={
              <SafeRouteShell routeName="sell">
                <FeatureGated flag="FEATURE_SELL" feature="sell">
                  <BackyardGuard surface="sell"><Sell /></BackyardGuard>
                </FeatureGated>
              </SafeRouteShell>
            } />
            {/* /buy — simple buyer marketplace. The page itself
                checks the `buyMarketplace` flag and renders a
                "coming soon" notice when off, so the route is
                always live + safe (no 404 on stray nav taps).
                Coexists with /marketplace + /market/browse. */}
            <Route path="/buy" element={
              <RC1RouteGate flag="buyMarketplace">
                <SafeRouteShell routeName="buy">
                  {/* Garden Mode Refactor §3 — buy surface is
                      commercial; garden mode gets the calm empty-state. */}
                  <BackyardGuard surface="sell"><Buy /></BackyardGuard>
                </SafeRouteShell>
              </RC1RouteGate>
            } />
            {/* /operator — RC1 gated; redirects to /home when
                operatorTools flag is off. Page stays in codebase. */}
            <Route path="/operator" element={
              <RC1RouteGate flag="operatorTools">
                <OperatorDashboard />
              </RC1RouteGate>
            } />
            {/* /internal/metrics — RC1 gated; redirects to /home
                when investorMetrics flag is off. Also wrapped in
                <RoleRoute> (admin-only) for defence-in-depth. */}
            <Route path="/internal/metrics" element={
              <RoleRoute roles={ADMIN_ROLES}>
                <RC1RouteGate flag="investorMetrics">
                  <MetricsDashboard />
                </RC1RouteGate>
              </RoleRoute>
            } />
            {/* /internal/release — RC1 release readiness dashboard.
                Gated behind investorMetrics so it only renders on
                internal builds. Surfaces __farrowayBuild,
                __scanRuntimeHealthV8, __queueHealth,
                __continuityHealth, __offlineHealth,
                __appStoreReadiness without DevTools.
                Wrapped in <RoleRoute> admin-only. */}
            <Route path="/internal/release" element={
              <RoleRoute roles={ADMIN_ROLES}>
                <RC1RouteGate flag="investorMetrics">
                  <ReleaseReadiness />
                </RC1RouteGate>
              </RoleRoute>
            } />
            {/* /start — minimal onboarding entry. The page checks
                the `onboardingV2` flag and renders a "coming soon"
                notice when off. Returning users (with farm or
                onboarding stamp) auto-redirect to /home. */}
            {/* App Store launch audit: removed duplicate /start
                route mount. The public-zone /start above (line
                ~615) → FarmerEntry is the canonical entry; this
                second mount of OnboardingEntry was unreachable
                first-match dead code. The OnboardingEntry
                component stays in the codebase for the V2 entry
                experiment but is not currently routed. */}
            {/* /start/farm — 2-field minimal setup (crop + location).
                Defers farm size + crop stage to the home prompt. */}
            <Route path="/start/farm"         element={<MinimalFarmSetup />} />
            {/* Optimized setup flow — single-screen forms per
                the "fast, simple, accurate" spec. Garden = 2
                required fields + 1 optional pill. Farm = 4
                required fields with regional unit default. */}
            <Route path="/setup/garden"       element={<QuickGardenSetup />} />
            <Route path="/setup/farm"         element={<QuickFarmSetup />} />
            <Route path="/opportunities" element={
              <SafeRouteShell routeName="opportunities">
                <FeatureGated flag="FEATURE_FUNDING" feature="funding">
                  <BackyardGuard surface="funding"><Opportunities /></BackyardGuard>
                </FeatureGated>
              </SafeRouteShell>
            } />
            {/* /funding — Funding Hub. The page itself checks the
                feature flag and renders a "rolling out" message
                when off, so the route is always live + safe. */}
            <Route path="/funding" element={
              <SafeRouteShell routeName="funding">
                <FeatureGated flag="FEATURE_FUNDING" feature="funding">
                  <BackyardGuard><FundingHub /></BackyardGuard>
                </FeatureGated>
              </SafeRouteShell>
            } />
            {/* /analytics — Phase 7D: farmer read-only analytics cards.
                Route always mounted so deep links don't 404.
                FeatureGated shows "Feature temporarily disabled" when
                FEATURE_ANALYTICS is off. */}
            <Route path="/analytics" element={
              <FeatureGated flag="FEATURE_ANALYTICS" feature="analytics">
                <FarmerAnalyticsPage />
              </FeatureGated>
            } />
            {/* /contact, /privacy, /terms moved to the public
                block above (go-live audit). Previously they
                lived here despite the comment claiming "public",
                which the App Store reviewer fix now actually
                honours. */}
            {/* /onboarding/backyard — feature-flag-gated 6-step
                garden setup. The page checks the flag itself
                and redirects to /dashboard when off. */}
            <Route path="/onboarding/backyard" element={<Navigate to="/onboarding/fast" replace />} />
            {/* /onboarding/us-experience — chooser between Backyard
                and Farm for U.S. users. The page checks the flag
                itself and bounces to /dashboard when off. Routes
                onward to /onboarding/backyard or /onboarding (V3)
                based on choice. */}
            <Route path="/onboarding/us-experience" element={<Navigate to="/onboarding/fast" replace />} />
            {/* Scan detection — feature-flag gated. Pages
                self-bounce to /scan-crop when off so deep links
                stay reachable. */}
            {/* /scan + /scan/result/:scanId — Safe Runtime Layer.
                SafeRouteShell (outer) fires the 8 s loading
                timeout and catches any render throw that escapes
                ScanErrorBoundary. ScanErrorBoundary (inner) still
                handles scan-specific recovery UI ("Upload photo +
                Retry"). Camera permission denial is handled by
                ScanCapture's native file picker — the user always
                has a library fallback. When scanApiEnabled=false
                the engine returns a rule-based safe mock result so
                the page renders without any network call. */}
            <Route path="/scan" element={
              <SafeRouteShell routeName="scan" loadingMs={5000}>
                <FeatureGated flag="FEATURE_SCAN" feature="scan">
                  <ScanErrorBoundary>
                    <ScanPage />
                  </ScanErrorBoundary>
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/scan/result/:scanId" element={
              <SafeRouteShell routeName="scan-result">
                <FeatureGated flag="FEATURE_SCAN" feature="scan">
                  <ScanErrorBoundary>
                    <ScanResultPage />
                  </ScanErrorBoundary>
                </FeatureGated>
              </SafeRouteShell>
            } />
            {/* Soil Scan v1 (May 2026) — confidence-safe soil
                photo guidance. Same FEATURE_SCAN gate + scan
                error boundary so a crash here is isolated to
                this surface. */}
            <Route path="/scan/soil" element={
              <SafeRouteShell routeName="scan-soil" loadingMs={5000}>
                <FeatureGated flag="FEATURE_SCAN" feature="scan">
                  <ScanErrorBoundary>
                    <SoilScanPage />
                  </ScanErrorBoundary>
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/opportunities/:id" element={
              <SafeRouteShell routeName="opportunities-detail">
                <FundingOpportunityDetail />
              </SafeRouteShell>
            } />
            <Route path="/ngo/impact"
                   element={
                     <SafeRouteShell routeName="ngo-impact">
                       <FeatureGated flag="FEATURE_NGO" feature="ngo">
                         <RoleRoute roles={STAFF_ROLES}>
                           <NgoImpactPage />
                         </RoleRoute>
                       </FeatureGated>
                     </SafeRouteShell>
                   } />
            {/* Admin farm-issue inbox — moved from public block
                (Phase 6 fix). Local-first page; requires auth +
                staff role so a farmer who typed the URL directly
                gets a clean "access denied" rather than raw data. */}
            <Route path="/admin/farm-issues" element={
              <SafeRouteShell routeName="admin-farm-issues">
                <FeatureGated flag="FEATURE_ADMIN" feature="admin">
                  <RoleRoute roles={STAFF_ROLES}>
                    <AdminFarmIssuesPage />
                  </RoleRoute>
                </FeatureGated>
              </SafeRouteShell>
            } />

            {/* Funding Opportunities admin — same page on
                /admin/funding and /ngo/funding so both staff
                personas land on the same management surface. */}
            <Route path="/admin/funding"
                   element={
                     <SafeRouteShell routeName="admin-funding">
                       <FeatureGated flag="FEATURE_ADMIN" feature="admin">
                         <RoleRoute roles={STAFF_ROLES}>
                           <FundingAdmin />
                         </RoleRoute>
                       </FeatureGated>
                     </SafeRouteShell>
                   } />
            <Route path="/ngo/funding"
                   element={
                     <SafeRouteShell routeName="ngo-funding">
                       <FeatureGated flag="FEATURE_ADMIN" feature="admin">
                         <RoleRoute roles={STAFF_ROLES}>
                           <FundingAdmin />
                         </RoleRoute>
                       </FeatureGated>
                     </SafeRouteShell>
                   } />

            {/* NGO Program Distribution — Send a program
                to matched farmers. Same surface mounted
                on both /admin/programs and /ngo/programs. */}
            <Route path="/admin/programs"
                   element={
                     <SafeRouteShell routeName="admin-programs">
                       <FeatureGated flag="FEATURE_ADMIN" feature="admin">
                         <RoleRoute roles={STAFF_ROLES}>
                           <CreateProgram />
                         </RoleRoute>
                       </FeatureGated>
                     </SafeRouteShell>
                   } />
            <Route path="/ngo/programs"
                   element={
                     <SafeRouteShell routeName="ngo-programs">
                       <FeatureGated flag="FEATURE_ADMIN" feature="admin">
                         <RoleRoute roles={STAFF_ROLES}>
                           <CreateProgram />
                         </RoleRoute>
                       </FeatureGated>
                     </SafeRouteShell>
                   } />

            {/* v3 Field Agent Mode — gated to the 'agent'
                role plus full staff (so super_admin can
                preview the surface). Per spec § 6, the
                page itself enforces "agents only see their
                own farmers" via a per-call agentId filter. */}
            <Route path="/agent"
                   element={
                     <RoleRoute roles={['agent', ...STAFF_ROLES]}>
                       <AgentDashboard />
                     </RoleRoute>
                   } />

            {/* v3 Notification System — full list. The
                NotificationBell popover is mounted on the
                farmer Dashboard; this is the deep-link
                target for "View all". Auth-only via the
                surrounding V2ProtectedLayout. */}
            <Route path="/notifications"
                   element={<Notifications />} />
            <Route path="/harvest/:cycleId/summary" element={<PostHarvestSummaryPage />} />
            {/* Garden Mode Refactor §3 — wrap each commercial
                farmer/buyer/marketplace surface in BackyardGuard so
                gardeners hit the calm "this is for farm mode"
                empty state instead of leaking commercial UI. */}
            <Route path="/farmer/listings" element={
              <BackyardGuard surface="sell"><MyListingsPage /></BackyardGuard>
            } />
            <Route path="/farmer/listings/new" element={
              <BackyardGuard surface="sell"><CreateListingPage /></BackyardGuard>
            } />
            <Route path="/farmer/notifications" element={<NotificationsPage />} />
            <Route path="/market/browse" element={
              <SafeRouteShell routeName="market-browse">
                <FeatureGated flag="FEATURE_BUYER" feature="buyer">
                  <BackyardGuard surface="sell"><BrowseListingsPage /></BackyardGuard>
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/market/listings/:id" element={
              <SafeRouteShell routeName="market-listing-detail">
                <FeatureGated flag="FEATURE_BUYER" feature="buyer">
                  <BackyardGuard surface="sell"><ListingDetailPage /></BackyardGuard>
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/buyer/interests" element={
              <RoleRoute roles={['buyer', 'super_admin', 'institutional_admin']}>
                <SafeRouteShell routeName="buyer-interests">
                  <FeatureGated flag="FEATURE_BUYER_INTEREST" feature="buyer-interest">
                    <BackyardGuard surface="sell"><MyInterestsPage /></BackyardGuard>
                  </FeatureGated>
                </SafeRouteShell>
              </RoleRoute>
            } />
            <Route path="/buyer/notifications" element={
              <RoleRoute roles={['buyer', 'super_admin', 'institutional_admin']}>
                <SafeRouteShell routeName="buyer-notifications">
                  <FeatureGated flag="FEATURE_BUYER" feature="buyer">
                    <BackyardGuard surface="sell"><BuyerNotificationsPage /></BackyardGuard>
                  </FeatureGated>
                </SafeRouteShell>
              </RoleRoute>
            } />
            <Route path="/onboarding/smart" element={<Navigate to="/onboarding/fast" replace />} />
            {/* Onboarding cleanup — duplicate /onboarding/fast
                (FastOnboardingRoute) intentionally removed; the
                canonical /onboarding/fast handler is mounted
                earlier in this file under the V2ProtectedLayout
                block (FastOnboarding component). FastOnboardingRoute
                stays in the bundle as a lazy import for any test
                that imports it directly; the route is gone. */}
            <Route path="/onboarding"    element={<Navigate to="/onboarding/fast" replace />} />
            <Route path="/onboarding/v3" element={<Navigate to="/onboarding/fast" replace />} />
            <Route path="/edit-farm" element={<EditFarmScreen />} />
            {/* /farm/new now routes through AdaptiveFarmSetup
                so backyard users get the simple GardenSetupForm
                while farm users keep the existing NewFarmScreen.
                Flag-off path: identical to before. */}
            <Route path="/farm/new" element={<AdaptiveFarmSetup />} />
            <Route path="/farms" element={<ManageFarms />} />
            {/* Garden-visibility spec — gardens get their own
                manage surface. /manage-gardens is the canonical
                path; /gardens is an alias so deep-links from
                older builds keep resolving. */}
            <Route path="/manage-gardens" element={<ManageGardens />} />
            <Route path="/gardens" element={<ManageGardens />} />
            <Route path="/welcome-farmer" element={<WelcomeScreen />} />
            <Route path="/crop-fit/quick" element={<CropFitQuick />} />
            {/* Wave-27 fix — /program-dashboard exposed NGO program
                surface to any authenticated user. The founder-readiness
                audit (Part 3) flagged it as a critical access bug.
                Gated to ADMIN_ROLES until proper org-member scoping
                ships with the pending enterprise migration. */}
            <Route path="/program-dashboard" element={<RoleRoute roles={ADMIN_ROLES}><ProgramDashboardPage /></RoleRoute>} />
            {/*
              /settings now resolves to the unified Settings page
              (notifications + communication + farmer ID), backed by
              the farroway_settings store. The legacy
              FarmerSettingsPage stays exported so any external
              deep-links to /farmer-settings keep resolving — but the
              gear icon and primary route land on Settings.
            */}
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
            <Route path="/community" element={<CommunityFeedPage />} />
            <Route path="/farmer-settings" element={<FarmerSettingsPage />} />
            {/* App Store launch audit: /scan-crop → /scan canonical
                redirect per spec §8. The legacy CameraScanPage is
                marked DEPRECATED in its own file header and the
                import is no longer wired (active-path audit cleanup),
                so the only path that ever rendered it is this
                Navigate. All deep links + the existing voice-assistant
                nav ("scan crop" command) land on the canonical /scan
                surface (ScanPage). */}
            <Route path="/scan-crop" element={<Navigate to="/scan" replace />} />
            <Route path="/land-check" element={<LandCheckPage />} />
            <Route path="/crop-recommendations" element={<CropRecommendations />} />
            <Route path="/crop-summary" element={<CropSummary />} />
            <Route path="/pest-risk-check" element={<PestRiskCheck />} />
            <Route path="/pest-risk-result" element={<PestRiskResult />} />
            <Route path="/field-hotspots" element={<FieldHotspotAlert />} />
            <Route path="/regional-watch" element={<RegionalWatch />} />
            <Route path="/treatment-feedback" element={<TreatmentFeedback />} />
          </Route>

          {/* V1 legacy routes (Bearer token auth) */}
          <Route path="/v1/login" element={<LoginPage />} />
          <Route path="/farmer-register" element={<FarmerRegisterPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/v1/profile/setup" element={<ProtectedRoute allowSetup><ProfileSetupPage /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="farmers" element={<RoleRoute roles={STAFF_ROLES}><FarmersPage /></RoleRoute>} />
            <Route path="farmers/:id" element={<RoleRoute roles={STAFF_ROLES}><FarmerDetailPage /></RoleRoute>} />
            <Route path="applications" element={<RoleRoute roles={STAFF_ROLES}><ApplicationsPage /></RoleRoute>} />
            <Route path="applications/new" element={<RoleRoute roles={STAFF_ROLES}><NewApplicationPage /></RoleRoute>} />
            <Route path="applications/:id" element={<RoleRoute roles={STAFF_ROLES}><ApplicationDetailPage /></RoleRoute>} />
            <Route path="farmer-registrations" element={<RoleRoute roles={REGISTRATION_ROLES}><PendingRegistrationsPage /></RoleRoute>} />
            <Route path="verification-queue" element={<RoleRoute roles={REVIEW_ROLES}><VerificationQueuePage /></RoleRoute>} />
            <Route path="fraud-queue" element={<RoleRoute roles={REVIEW_ROLES}><FraudQueuePage /></RoleRoute>} />
            <Route path="officer-validation" element={<RoleRoute roles={STAFF_ROLES}><OfficerValidationPage /></RoleRoute>} />
            <Route path="farmer-home/:farmerId" element={<RoleRoute roles={STAFF_ROLES}><FarmerHomePage /></RoleRoute>}>
              <Route index element={<FarmerOverviewTab />} />
              <Route path="activities" element={<FarmerActivitiesTab />} />
              <Route path="reminders" element={<FarmerRemindersTab />} />
              <Route path="notifications" element={<FarmerNotificationsTab />} />
              <Route path="storage" element={<FarmerStorageTab />} />
              <Route path="market" element={<FarmerMarketTab />} />
              <Route path="progress" element={<FarmerProgressTab />} />
            </Route>
            <Route path="investor/farmers/:farmerId" element={<RoleRoute roles={[...STAFF_ROLES, 'investor_viewer']}><InvestorIntelligencePage /></RoleRoute>} />
            {/* Remove Mobile Dashboard Experience §5 — /portfolio
                and /reports use chart-style analytics and must NOT
                be reachable by normal farmers/gardeners. Gated to
                staff + admin + investor roles. The CI guard
                check:no-farmer-dashboard enforces this lock.

                Role-route absolute-path manifest (read by the
                check:role-route-guards gate). Each of the routes
                below is mounted as a nested child of the parent
                "/" Route, so the React-router runtime resolves
                them to these absolute paths under <RoleRoute>:
                  "/portfolio"
                  "/reports"
                  "/audit"
                  "/admin/users"
                  "/admin/organizations"
                  "/admin/analytics"
                  "/admin/control"
                  "/admin/security"
                  "/admin/sync-queue"
                  "/buyer"
                  "/sell-readiness"
                  "/organization"
                Every absolute path above maps to a nested route
                wrapped in <RoleRoute>. */}
            <Route path="portfolio" element={
              <RoleRoute roles={[...STAFF_ROLES, 'investor_viewer']}>
                <PortfolioPage />
              </RoleRoute>
            } />
            <Route path="reports" element={
              <RoleRoute roles={[...STAFF_ROLES, 'investor_viewer']}>
                <ReportsPage />
              </RoleRoute>
            } />
            <Route path="reports/print" element={<RoleRoute roles={STAFF_ROLES}><PrintableReportPage /></RoleRoute>} />
            <Route path="audit" element={<RoleRoute roles={ADMIN_ROLES}><AuditPage /></RoleRoute>} />
            <Route path="admin/users" element={<RoleRoute roles={ADMIN_ROLES}><AdminUsersPage /></RoleRoute>} />
            <Route path="admin/registrations" element={<RoleRoute roles={REGISTRATION_ROLES}><PendingRegistrationsPage /></RoleRoute>} />
            <Route path="admin/organizations" element={<RoleRoute roles={ADMIN_ROLES}><AdminOrganizationsPage /></RoleRoute>} />
            <Route path="admin/organizations/:orgId" element={<RoleRoute roles={ADMIN_ROLES}><OrganizationDashboardPage /></RoleRoute>} />
            <Route path="admin/sync-queue" element={<RoleRoute roles={ADMIN_ROLES}><AdminSyncQueuePage /></RoleRoute>} />
            <Route path="admin/control" element={<RoleRoute roles={ADMIN_ROLES}><AdminControlPage /></RoleRoute>} />
            <Route path="admin/security" element={<RoleRoute roles={ADMIN_ROLES}><SecurityRequestsPage /></RoleRoute>} />
            {/* Buyer dashboard (Wave 14): browse buyer-visible
                listings. Mounted at "/buyer" — guarded for
                buyer + admin roles by <RoleRoute>. */}
            <Route path="buyer" element={<RoleRoute roles={['buyer', ...ADMIN_ROLES]}><BrowseListingsPage /></RoleRoute>} />
            {/* Sell-readiness surface — grower-side "mark ready to
                sell" flow. Per Wave-14 spec §1: farmer/gardener/
                grower/admin ONLY. (The earlier staff+investor wrap
                was incorrect — that's the BUYER view; sell-readiness
                is the SELLER side.) */}
            <Route path="sell-readiness" element={<RoleRoute roles={['farmer', 'gardener', 'grower', ...ADMIN_ROLES]}><BuyerView /></RoleRoute>} />
            {/* NGO / organization dashboard (Wave 14). Per spec §1:
                ngo_admin / field_officer / organization_viewer / admin.
                The earlier 'ngo' / 'institutional_admin' labels do
                not match the RBAC role contract — corrected here. */}
            <Route path="organization" element={<RoleRoute roles={['ngo_admin', 'field_officer', 'organization_viewer', ...ADMIN_ROLES]}><OrganizationDashboardPage /></RoleRoute>} />
            {/* Wave 17 — Bulk farmer onboarding (spec roles only;
                farmer/gardener/grower/buyer are intentionally
                excluded — these surfaces enroll farmers, not
                farmers themselves). */}
            <Route path="organization/onboarding"                  element={<RoleRoute roles={['ngo_admin', 'field_officer', 'organization_viewer', 'organization_admin', ...ADMIN_ROLES]}><OnboardingHome /></RoleRoute>} />
            <Route path="organization/onboarding/import"           element={<RoleRoute roles={['ngo_admin', 'field_officer', 'organization_viewer', 'organization_admin', ...ADMIN_ROLES]}><OnboardingImport /></RoleRoute>} />
            <Route path="organization/onboarding/batches"          element={<RoleRoute roles={['ngo_admin', 'field_officer', 'organization_viewer', 'organization_admin', ...ADMIN_ROLES]}><OnboardingBatches /></RoleRoute>} />
            <Route path="organization/onboarding/batches/:batchId" element={<RoleRoute roles={['ngo_admin', 'field_officer', 'organization_viewer', 'organization_admin', ...ADMIN_ROLES]}><OnboardingBatchDetail /></RoleRoute>} />
            <Route path="organization/onboarding/add-farmer"       element={<RoleRoute roles={['ngo_admin', 'field_officer', 'organization_viewer', 'organization_admin', ...ADMIN_ROLES]}><AddFarmerPage /></RoleRoute>} />
            <Route path="admin/notifications" element={<RoleRoute roles={ADMIN_ROLES}><AutoNotificationsPage /></RoleRoute>} />
            <Route path="admin/pilot-qa" element={<RoleRoute roles={ADMIN_ROLES}><PilotQAPage /></RoleRoute>} />
            <Route path="admin/issues" element={<RoleRoute roles={ADMIN_ROLES}><AdminIssuesPage /></RoleRoute>} />
            <Route path="admin/ops" element={<RoleRoute roles={ADMIN_ROLES}><AdminOpsPage /></RoleRoute>} />
            <Route path="admin/supply" element={<RoleRoute roles={ADMIN_ROLES}><SupplyReadinessPage /></RoleRoute>} />
            <Route path="admin/buyers" element={<RoleRoute roles={ADMIN_ROLES}><BuyerManagementPage /></RoleRoute>} />
            <Route path="admin/buyer-trust" element={<RoleRoute roles={ADMIN_ROLES}><BuyerTrustPage /></RoleRoute>} />
            {/* Read-only buyer / market-access view of farms ready
                to sell. Mirrors `/admin/supply` but stripped down to
                the discovery surface (no buyer-link workflow). */}
            {/* /buyers — buyer-facing supply index. Spec §7 calls
                for the route to be "exposed". Widened from
                ADMIN_ROLES (super_admin + institutional_admin only)
                to the full institutional staff set + investor_viewer
                so field officers, reviewers, and investors can also
                browse ready-to-sell supply. There is no `buyer`
                role in this system; non-staff visibility would
                require a public-buyer auth flow that's out of scope
                for this UI-only sprint. */}
            <Route path="buyers" element={<RoleRoute roles={[...STAFF_ROLES, 'investor_viewer']}><BuyerView /></RoleRoute>} />
            <Route path="admin/analytics" element={<RoleRoute roles={ADMIN_ROLES}><AdminAnalyticsPage /></RoleRoute>} />
            {/* Phase 3 §C — soft-launch ops dashboard. */}
            <Route path="admin/monitoring" element={<RoleRoute roles={ADMIN_ROLES}><MonitoringDashboardPage /></RoleRoute>} />
            {/* Live Admin Issue Dashboard — alert-shaped view of
                the same metrics envelope. Same admin-only gate. */}
            <Route path="admin/issues"     element={<RoleRoute roles={ADMIN_ROLES}><AdminIssueDashboardPage /></RoleRoute>} />
            <Route path="admin/feedback"  element={<RoleRoute roles={ADMIN_ROLES}><FeedbackDashboard /></RoleRoute>} />
            <Route path="admin/ngo-dashboard" element={<RoleRoute roles={ADMIN_ROLES}><AdminDashboard /></RoleRoute>} />
            <Route path="admin/ngo-program" element={<RoleRoute roles={ADMIN_ROLES}><NgoDashboardPage /></RoleRoute>} />
            <Route path="admin/import-farmers" element={<RoleRoute roles={ADMIN_ROLES}><AdminImportFarmersPage /></RoleRoute>} />
            <Route path="admin/intelligence/regional-risk" element={<RoleRoute roles={ADMIN_ROLES}><AdminRegionalRiskMap /></RoleRoute>} />
            <Route path="admin/intelligence/high-risk-farms" element={<RoleRoute roles={ADMIN_ROLES}><AdminHighRiskFarms /></RoleRoute>} />
            <Route path="admin/intelligence/hotspots" element={<RoleRoute roles={ADMIN_ROLES}><AdminHotspotInspector /></RoleRoute>} />
            <Route path="admin/intelligence/alerts" element={<RoleRoute roles={ADMIN_ROLES}><AdminAlertControlCenter /></RoleRoute>} />
            <Route path="admin/intelligence/interventions" element={<RoleRoute roles={ADMIN_ROLES}><AdminInterventionEffectiveness /></RoleRoute>} />
            <Route path="admin/intelligence/queues" element={<RoleRoute roles={ADMIN_ROLES}><AdminOperationalQueues /></RoleRoute>} />
            <Route path="pilot-metrics" element={<RoleRoute roles={[...ADMIN_ROLES, 'investor_viewer', 'field_officer']}><PilotMetricsPage /></RoleRoute>} />
            <Route path="impact" element={<RoleRoute roles={[...ADMIN_ROLES, 'investor_viewer']}><ImpactDashboardPage /></RoleRoute>} />
            <Route path="account" element={<AccountPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      </LazyLoadErrorBoundary>
      {/* Floating voice-first navigator — fixed bottom-centre. The
          mic FAB is now scoped to the /scan route so it doesn't
          clutter Home / My Farm / My Grow / Tasks / Progress. The
          bottom-nav already includes a Scan tab, so users always
          have one tap to reach the voice + camera surface. */}
      <ScanOnlyVoiceAssistant />
      {/* Tiny status pill for the lightweight offline queue at
          src/offline/*. Coexists with the existing OfflineBanner
          (which serves the heavy IndexedDB sync engine). */}
      <OfflineSyncBanner />
      {/* FEATURE_OFFLINE_SAFE: focused offline status strip.
          Shows "Offline mode — changes will save on this device."
          and "Back online — syncing safely." (auto-hides 3s).
          Coexists with OfflineSyncBanner (different data source). */}
      {FEATURE_OFFLINE_SAFE && <OfflineSafeStatusBanner />}
      {/* Global ephemeral toast host. The store lives in
          src/lib/globalToast.js so non-React callers (task
          completion, sync recovery) can fire toasts without
          owning a component handle. Single mount-point. */}
      <GlobalToastHost />
      {/* Nature-dark theme tinter. Reads useWeather() — must
          live inside WeatherProvider, which the wrapping
          providers above already establish. Pure observer:
          renders nothing, just toggles a `theme-*` class on
          <body>. */}
      <AppShellTheme />
      {/* Role theme applicator. Reads useAuthOrNull(); never
          throws outside the provider. Toggles a `role-*` class
          on <body> independently of the weather class so the
          two systems compose. Pure observer. */}
      <RoleThemeApplicator />
      </AuthLoadingGate>
      </AppCrashBoundaryWithLocation>
      </SeasonProvider>
      </MarketProvider>
      </ForecastProvider>
      </WeatherProvider>
      </UserModeProvider>
      </V2ProfileProvider>
      </AuthProvider>
      </AppPrefsProvider>
      </NetworkProvider>
    </BrowserRouter>
  );
}
