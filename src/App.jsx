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

// Soft Ochre / Beige unified system — page loader uses the locked
// background + ochre primary spinner so cold-start matches the rest
// of the app instead of flashing the legacy dark-navy + neon-green.
const PageLoader = () => (
  <div style={{ minHeight: '100vh', background: '#F6F1E7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(36,49,58,0.10)', borderTopColor: '#C8944D', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2933' }}>Farroway</span>
    </div>
  </div>
);

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
  if (authLoading) return <PageLoader />;
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Marketing landing page (farroway.app homepage).
              Both /welcome and /landing render the same v3
              page so external links keep working. */}
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />

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
              enforces the internal gate; the route is public so
              authorised users can reach it via direct URL. */}
          <Route path="/internal/founder" element={<FounderDashboard />} />
          {/* Internal release-lock dashboard. The page renders an
              "internal only" empty state for normal users — the
              route is registered globally so admins can deep-link. */}
          <Route path="/internal/release-lock" element={<ReleaseLockPage />} />
          {/* Enterprise Agriculture Platform. Same internal-gate
              pattern; full OrganizationMember role check ships
              with the Prisma migration. */}
          <Route path="/enterprise" element={<EnterpriseHome />} />
          <Route path="/start" element={<FarmerEntry />} />

          {/* Farmer-first entry (phone OTP, Google, offline) */}
          <Route path="/farmer-welcome" element={<FarmerWelcome />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />

          {/* V2 enterprise auth routes (cookie-based, httpOnly) */}
          <Route path="/login" element={<V2Login />} />
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
            <Route path="/progress" element={
              <SafeRouteShell routeName="progress">
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
                when investorMetrics flag is off. */}
            <Route path="/internal/metrics" element={
              <RC1RouteGate flag="investorMetrics">
                <MetricsDashboard />
              </RC1RouteGate>
            } />
            {/* /internal/release — RC1 release readiness dashboard.
                Gated behind investorMetrics so it only renders on
                internal builds. Surfaces __farrowayBuild,
                __scanRuntimeHealthV8, __queueHealth,
                __continuityHealth, __offlineHealth,
                __appStoreReadiness without DevTools. */}
            <Route path="/internal/release" element={
              <RC1RouteGate flag="investorMetrics">
                <ReleaseReadiness />
              </RC1RouteGate>
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
              <SafeRouteShell routeName="buyer-interests">
                <FeatureGated flag="FEATURE_BUYER_INTEREST" feature="buyer-interest">
                  <BackyardGuard surface="sell"><MyInterestsPage /></BackyardGuard>
                </FeatureGated>
              </SafeRouteShell>
            } />
            <Route path="/buyer/notifications" element={
              <SafeRouteShell routeName="buyer-notifications">
                <FeatureGated flag="FEATURE_BUYER" feature="buyer">
                  <BackyardGuard surface="sell"><BuyerNotificationsPage /></BackyardGuard>
                </FeatureGated>
              </SafeRouteShell>
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
            <Route path="/program-dashboard" element={<ProgramDashboardPage />} />
            {/*
              /settings now resolves to the unified Settings page
              (notifications + communication + farmer ID), backed by
              the farroway_settings store. The legacy
              FarmerSettingsPage stays exported so any external
              deep-links to /farmer-settings keep resolving — but the
              gear icon and primary route land on Settings.
            */}
            <Route path="/settings" element={<Settings />} />
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
                check:no-farmer-dashboard enforces this lock. */}
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
