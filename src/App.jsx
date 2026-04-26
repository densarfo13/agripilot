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

// Landing page (marketing homepage)
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const Landing = lazy(() => import('./pages/Landing.jsx'));

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
          {/* Marketing landing page (farroways.com homepage) */}
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/landing" element={<Landing />} />

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
          <Route element={<V2ProtectedLayout />}>
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
            <Route path="/ngo/funding" element={<FundingReadiness />} />
            <Route path="/today" element={<FarmerTodayPage />} />
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
            <Route path="/settings" element={<FarmerSettingsPage />} />
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
            <Route path="buyers" element={<RoleRoute roles={ADMIN_ROLES}><BuyerView /></RoleRoute>} />
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
