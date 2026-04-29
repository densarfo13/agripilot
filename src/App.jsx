import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { loadTranslations, getCurrentLang } from './utils/i18n.js';
import { initAutoSync } from './utils/offlineQueue.js';
import api from './api/client.js';
// Demo-readiness: one-line call populates the local store with a
// plausible NGO roster (farmers, farms, activity, issues) the first
// time the app boots in demo mode. Production boots are unaffected
// because `isDemoMode()` is false and the helper no-ops.
import { ensureDemoSeed } from './lib/demo/demoSeed.js';

import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StepUpModal from './components/StepUpModal.jsx';
import SyncStatus from './components/SyncStatus.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import VoiceAssistant from './components/VoiceAssistant.jsx';
import OfflineSyncBanner from './components/OfflineSyncBanner.jsx';
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

// Landing page (marketing homepage)
//
// LandingPage.jsx is the v3 marketing surface (white bg,
// global pilot copy). It serves both /welcome and /landing
// so external links to either path land on the canonical
// page. The earlier Landing.jsx (dark v2 design language)
// is retained in tree as a backup but no longer routed.
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));

// Buyer + Funding/Impact layer (v3 merge, local-first)
//   /sell           — farmer creates a produce listing
//   /marketplace    — buyer browses available produce
//   /ngo/impact     — NGO funding + impact + market activity
//   /opportunities  — farmer funding & support matches
//   /admin/funding  — admin manages funding catalog
//   /ngo/funding    — same management page, NGO entry point
const Sell           = lazy(() => import('./pages/Sell.jsx'));
const Marketplace    = lazy(() => import('./pages/Marketplace.jsx'));
const NgoImpactPage  = lazy(() => import('./pages/NgoImpactPage.jsx'));
const Opportunities  = lazy(() => import('./pages/Opportunities.jsx'));
const FundingOpportunityDetail = lazy(() =>
  import('./pages/FundingOpportunityDetail.jsx'));
const FundingAdmin   = lazy(() => import('./pages/admin/FundingAdmin.jsx'));
const CreateProgram  = lazy(() => import('./pages/admin/CreateProgram.jsx'));

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
const CameraScanPage = lazy(() => import('./pages/CameraScanPage.jsx'));
const LandCheckPage = lazy(() => import('./pages/LandCheckPage.jsx'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp.jsx'));
// ProtectedLayout is NOT lazy — it's the auth/profile gate and must stay mounted
// while inner lazy children (Dashboard, etc.) load via their own Suspense boundary.
import V2ProtectedLayout from './layouts/ProtectedLayout.jsx';
const V2SeasonStart = lazy(() => import('./pages/SeasonStart.jsx'));
const AllTasksPage = lazy(() => import('./pages/AllTasksPage.jsx'));
const MyFarmPage = lazy(() => import('./pages/MyFarmPage.jsx'));
const FarmerProgressPage = lazy(() => import('./pages/FarmerProgressPage.jsx'));
const CropFitIntake = lazy(() => import('./pages/CropFitIntake.jsx'));
const CropRecommendations = lazy(() => import('./pages/CropRecommendations.jsx'));
const USCropRecommendations = lazy(() => import('./pages/USCropRecommendations.jsx'));
const CropPlan = lazy(() => import('./pages/CropPlan.jsx'));
const NGOOverview = lazy(() => import('./pages/NGOOverview.jsx'));
const InterventionCenter = lazy(() => import('./pages/ngo/InterventionCenter.jsx'));
const FarmerScoring = lazy(() => import('./pages/ngo/FarmerScoring.jsx'));
const FundingReadiness = lazy(() => import('./pages/ngo/FundingReadiness.jsx'));
const FarmerTodayPage = lazy(() => import('./pages/farmer/FarmerTodayPage.jsx'));
const PostHarvestSummaryPage = lazy(() => import('./pages/farmer/PostHarvestSummaryPage.jsx'));
const FarmerOnboardingPage = lazy(() => import('./pages/onboarding/FarmerOnboardingPage.jsx'));
const FastOnboardingRoute = lazy(() => import('./pages/onboarding/fast/FastOnboardingRoute.jsx'));
const OnboardingV3 = lazy(() => import('./pages/onboarding/OnboardingV3.jsx'));
const EditFarmScreen = lazy(() => import('./pages/EditFarmScreen.jsx'));
const NewFarmScreen  = lazy(() => import('./pages/NewFarmScreen.jsx'));
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
const FarmerDashboardPage = lazy(() => import('./pages/FarmerDashboardPage.jsx'));
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

const PageLoader = () => (
  <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ width: '2rem', height: '2rem', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22C55E' }}>Farroway</span>
    </div>
  </div>
);

function ProtectedRoute({ children, allowSetup }) {
  const token = useAuthStore(s => s.token);
  const storeUser = useAuthStore(s => s.user);
  const { user: v2User, authLoading } = useAuth();
  const location = useLocation();

  console.log('[GUARD]', Date.now(), 'ProtectedRoute:', {
    v1Token: !!token, v1Role: storeUser?.role, v2Role: v2User?.role,
    authLoading, path: window.location.pathname,
  });

  // Bridge V2 cookie-auth user into the V1 zustand store SYNCHRONOUSLY so
  // RoleRoute and DashboardPage see the user on the very first render.
  // Do NOT set a fake token — V1 API calls now use httpOnly cookies directly.
  if (v2User && v2User.role && v2User.role !== 'farmer' && !storeUser) {
    console.log('[GUARD]', Date.now(), 'Bridging V2 user to V1 store, role:', v2User.role);
    useAuthStore.setState({ user: v2User });
  }

  // Re-read after potential sync write
  const user = useAuthStore.getState().user || v2User;
  const hasSession = useAuthStore.getState().token || (v2User && v2User.role);

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
  // Farmer-role users get their own limited dashboard
  if (user?.role === 'farmer') {
    // Wrap farmer routes in legacy ProfileProvider for shared profile state
    if (allowSetup) return <LegacyProfileProvider>{children}</LegacyProfileProvider>;
    // ProfileGuard redirects to /profile/setup if profile is incomplete
    return <LegacyProfileProvider><LegacyProfileGuard><Suspense fallback={<PageLoader />}><FarmerDashboardPage /></Suspense></LegacyProfileGuard></LegacyProfileProvider>;
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

  useEffect(() => {
    loadTranslations(getCurrentLang())
      .then(() => setI18nReady(true))
      .catch(() => setI18nReady(true)); // proceed even if translations fail — fallbacks work
    // Initialize offline sync — replays queued mutations when back online
    initAutoSync(api);
    // Demo mode: populate the local store so every admin/NGO page
    // renders real data on first load. No-ops outside demo mode and
    // when the store already has real data (see demoSeed.isStoreEmpty).
    try { ensureDemoSeed(); } catch { /* never blocks app boot */ }
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

  return (
    <BrowserRouter>
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
      <AuthLoadingGate>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Marketing landing page (farroway.app homepage).
              Both /welcome and /landing render the same v3
              page so external links keep working. */}
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />

          {/* Public Marketplace — buyers browse without an
              account. Interest forms route to platform/admin
              via marketStore.saveBuyerInterest; farmer phone
              is never exposed publicly. */}
          <Route path="/marketplace" element={<Marketplace />} />

          {/* Farmer-first entry: Welcome gate (auto-routes if session exists) */}
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
              without changing the UI shape. */}
          <Route path="/report-issue"     element={<ReportIssuePage />} />
          <Route path="/my-issues"        element={<MyIssuesPage />} />
          <Route path="/admin/farm-issues" element={<AdminFarmIssuesPage />} />
          <Route path="/officer/issues"   element={<OfficerIssuesPage />} />
          <Route path="/verify-email" element={<V2VerifyEmail />} />
          <Route path="/profile/setup" element={<V2ProfileSetup />} />
          {/* Public pricing page - reachable without auth so it can
              be demo'd / linked from sales emails. The companion
              /ngo/value dashboard sits inside the protected layout
              below since it reads the user's farm roster. */}
          <Route path="/pricing" element={<Pricing />} />
          <Route element={<V2ProtectedLayout />}>
            {/* Frictionless welcome screen - the new first-time
                destination. Legacy /onboarding + /onboarding/fast
                routes remain reachable for users / scripts that
                deep-link to them. */}
            <Route path="/onboarding/quick" element={<QuickStart />} />
            <Route path="/onboarding/farmer-type" element={<V2FarmerType />} />
            <Route path="/onboarding/starter-guide" element={<V2StarterGuide />} />
            <Route path="/dashboard" element={<V2Dashboard />} />
            <Route path="/tasks" element={<AllTasksPage />} />
            <Route path="/my-farm" element={<MyFarmPage />} />
            <Route path="/progress" element={<FarmerProgressPage />} />
            <Route path="/season/start" element={<V2SeasonStart />} />
            <Route path="/beginner-reassurance" element={<BeginnerReassurance />} />
            <Route path="/crop-fit" element={<CropFitIntake />} />
            <Route path="/crop-fit/us" element={<USCropRecommendations />} />
            <Route path="/crop-plan" element={<CropPlan />} />
            <Route path="/ngo" element={<NGOOverview />} />
            <Route path="/ngo/interventions" element={<InterventionCenter />} />
            <Route path="/ngo/scores" element={<FarmerScoring />} />
            {/* /ngo/funding now renders the v3 FundingAdmin
                management surface (see route below). The
                legacy FundingReadiness page is kept reachable
                at /ngo/funding-readiness for any internal
                links that still point at it. */}
            <Route path="/ngo/funding-readiness" element={<FundingReadiness />} />
            {/* Monetisation layer (additive). Distinct from the
                server-fed NGOOverview above; reads local metrics
                + pricing config so it works in demos / offline.
                /pricing itself lives outside this protected block
                so it can be demo'd without an account. */}
            <Route path="/ngo/value"   element={<NgoValueDashboard />} />
            <Route path="/ngo/control" element={<NgoControlPanel />} />
            <Route path="/today" element={<FarmerTodayPage />} />
            <Route path="/today/quick" element={<TodayQuick />} />

            {/* Buyer + Funding/Impact layer — v3 local-first
                routes mounted alongside the legacy
                /farmer/listings* + /market/* surfaces (those
                stay for backend-driven flows).
                /ngo/impact is staff-only (NGO operators
                + super_admin) so a regular farmer who
                stumbles onto the URL is redirected. */}
            <Route path="/sell"               element={<Sell />} />
            <Route path="/opportunities"      element={<Opportunities />} />
            <Route path="/opportunities/:id"  element={<FundingOpportunityDetail />} />
            <Route path="/ngo/impact"
                   element={
                     <RoleRoute roles={STAFF_ROLES}>
                       <NgoImpactPage />
                     </RoleRoute>
                   } />
            {/* Funding Opportunities admin — same page on
                /admin/funding and /ngo/funding so both staff
                personas land on the same management surface. */}
            <Route path="/admin/funding"
                   element={
                     <RoleRoute roles={STAFF_ROLES}>
                       <FundingAdmin />
                     </RoleRoute>
                   } />
            <Route path="/ngo/funding"
                   element={
                     <RoleRoute roles={STAFF_ROLES}>
                       <FundingAdmin />
                     </RoleRoute>
                   } />

            {/* NGO Program Distribution — Send a program
                to matched farmers. Same surface mounted
                on both /admin/programs and /ngo/programs. */}
            <Route path="/admin/programs"
                   element={
                     <RoleRoute roles={STAFF_ROLES}>
                       <CreateProgram />
                     </RoleRoute>
                   } />
            <Route path="/ngo/programs"
                   element={
                     <RoleRoute roles={STAFF_ROLES}>
                       <CreateProgram />
                     </RoleRoute>
                   } />
            <Route path="/harvest/:cycleId/summary" element={<PostHarvestSummaryPage />} />
            <Route path="/farmer/listings" element={<MyListingsPage />} />
            <Route path="/farmer/listings/new" element={<CreateListingPage />} />
            <Route path="/farmer/notifications" element={<NotificationsPage />} />
            <Route path="/market/browse" element={<BrowseListingsPage />} />
            <Route path="/market/listings/:id" element={<ListingDetailPage />} />
            <Route path="/buyer/interests" element={<MyInterestsPage />} />
            <Route path="/buyer/notifications" element={<BuyerNotificationsPage />} />
            <Route path="/onboarding/smart" element={<FarmerOnboardingPage />} />
            <Route path="/onboarding/fast" element={<FastOnboardingRoute />} />
            {/* Canonical 3-step flow — replaces the heavy wizard for
                new signups. Legacy /fast + /smart kept for back-compat
                with any in-flight sessions but all new entry points
                (FarmerRegister, ProfileGuard) point here. */}
            <Route path="/onboarding"    element={<OnboardingV3 />} />
            <Route path="/onboarding/v3" element={<OnboardingV3 />} />
            <Route path="/edit-farm" element={<EditFarmScreen />} />
            <Route path="/farm/new" element={<NewFarmScreen />} />
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
            <Route path="/scan-crop" element={<CameraScanPage />} />
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
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="reports" element={<ReportsPage />} />
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
      {/* Floating voice-first navigator — fixed bottom-centre across
          every route. Hides itself when speech I/O is unavailable
          (Firefox / iOS Safari today). */}
      <VoiceAssistant />
      {/* Tiny status pill for the lightweight offline queue at
          src/offline/*. Coexists with the existing OfflineBanner
          (which serves the heavy IndexedDB sync engine). */}
      <OfflineSyncBanner />
      </AuthLoadingGate>
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
