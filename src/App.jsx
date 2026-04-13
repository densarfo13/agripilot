import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { loadTranslations, getCurrentLang } from './utils/i18n.js';
import { initAutoSync } from './utils/offlineQueue.js';
import api from './api/client.js';

import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StepUpModal from './components/StepUpModal.jsx';
import SyncStatus from './components/SyncStatus.jsx';

// Landing page (marketing homepage)
const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));

// V2 enterprise auth pages — Login is NOT lazy (prevents Suspense flash on first load)
import V2Login from './pages/Login.jsx';
const V2Register = lazy(() => import('./pages/Register.jsx'));
const V2ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const V2ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const V2VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'));
const V2ProfileSetup = lazy(() => import('./pages/ProfileSetup.jsx'));
const V2Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
// ProtectedLayout is NOT lazy — it's the auth/profile gate and must stay mounted
// while inner lazy children (Dashboard, etc.) load via their own Suspense boundary.
import V2ProtectedLayout from './layouts/ProtectedLayout.jsx';
const V2SeasonStart = lazy(() => import('./pages/SeasonStart.jsx'));

// Lazy-loaded pages — split into separate chunks for faster initial load
const FarmersPage = lazy(() => import('./pages/FarmersPage.jsx'));
const FarmerDetailPage = lazy(() => import('./pages/FarmerDetailPage.jsx'));
const ApplicationsPage = lazy(() => import('./pages/ApplicationsPage.jsx'));
const NewApplicationPage = lazy(() => import('./pages/NewApplicationPage.jsx'));
const ApplicationDetailPage = lazy(() => import('./pages/ApplicationDetailPage.jsx'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage.jsx'));
const ReportsPage = lazy(() => import('./pages/ReportsPage.jsx'));
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
const FarmerRegisterPage = lazy(() => import('./pages/FarmerRegisterPage.jsx'));
const FarmerDashboardPage = lazy(() => import('./pages/FarmerDashboardPage.jsx'));
const PendingRegistrationsPage = lazy(() => import('./pages/PendingRegistrationsPage.jsx'));
const InvestorIntelligencePage = lazy(() => import('./pages/InvestorIntelligencePage.jsx'));
const PilotMetricsPage = lazy(() => import('./pages/PilotMetricsPage.jsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.jsx'));
const SecurityRequestsPage = lazy(() => import('./pages/SecurityRequestsPage.jsx'));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage.jsx'));
const PilotQAPage = lazy(() => import('./pages/PilotQAPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const AutoNotificationsPage = lazy(() => import('./pages/AutoNotificationsPage.jsx'));
const ImpactDashboardPage = lazy(() => import('./pages/ImpactDashboardPage.jsx'));
const AdminIssuesPage = lazy(() => import('./pages/AdminIssuesPage.jsx'));
const AdminOpsPage = lazy(() => import('./pages/AdminOpsPage.jsx'));
const SupplyReadinessPage = lazy(() => import('./pages/SupplyReadinessPage.jsx'));
const BuyerManagementPage = lazy(() => import('./pages/BuyerManagementPage.jsx'));
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
import { WeatherProvider } from './context/WeatherContext.jsx';
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
  const user = useAuthStore(s => s.user);
  // V2 cookie-auth users have no V1 token — send them to /dashboard (not /login)
  // so the V2 auth guard handles them correctly without a redirect loop.
  if (!token) {
    try {
      const cached = localStorage.getItem('farroway:session_cache');
      if (cached && JSON.parse(cached)?.user) return <Navigate to="/dashboard" replace />;
    } catch { /* ignore */ }
    return <Navigate to="/login" replace />;
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
  const user = useAuthStore(s => s.user);
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
  }, []);

  return (
    <BrowserRouter>
      <NetworkProvider>
      <AppPrefsProvider>
      <AuthProvider>
      <V2ProfileProvider>
      <WeatherProvider>
      <SeasonProvider>
      {stepUpRequired && <StepUpModal />}
      <SyncStatus />
      <AuthLoadingGate>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Marketing landing page (farroways.com homepage) */}
          <Route path="/welcome" element={<LandingPage />} />

          {/* V2 enterprise auth routes (cookie-based, httpOnly) */}
          <Route path="/login" element={<V2Login />} />
          <Route path="/register" element={<V2Register />} />
          <Route path="/forgot-password" element={<V2ForgotPassword />} />
          <Route path="/reset-password" element={<V2ResetPassword />} />
          <Route path="/verify-email" element={<V2VerifyEmail />} />
          <Route path="/profile/setup" element={<V2ProfileSetup />} />
          <Route element={<V2ProtectedLayout />}>
            <Route path="/dashboard" element={<V2Dashboard />} />
            <Route path="/season/start" element={<V2SeasonStart />} />
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
            <Route path="audit" element={<RoleRoute roles={ADMIN_ROLES}><AuditPage /></RoleRoute>} />
            <Route path="admin/users" element={<RoleRoute roles={ADMIN_ROLES}><AdminUsersPage /></RoleRoute>} />
            <Route path="admin/registrations" element={<RoleRoute roles={REGISTRATION_ROLES}><PendingRegistrationsPage /></RoleRoute>} />
            <Route path="admin/organizations" element={<RoleRoute roles={ADMIN_ROLES}><AdminOrganizationsPage /></RoleRoute>} />
            <Route path="admin/control" element={<RoleRoute roles={ADMIN_ROLES}><AdminControlPage /></RoleRoute>} />
            <Route path="admin/security" element={<RoleRoute roles={ADMIN_ROLES}><SecurityRequestsPage /></RoleRoute>} />
            <Route path="admin/notifications" element={<RoleRoute roles={ADMIN_ROLES}><AutoNotificationsPage /></RoleRoute>} />
            <Route path="admin/pilot-qa" element={<RoleRoute roles={ADMIN_ROLES}><PilotQAPage /></RoleRoute>} />
            <Route path="admin/issues" element={<RoleRoute roles={ADMIN_ROLES}><AdminIssuesPage /></RoleRoute>} />
            <Route path="admin/ops" element={<RoleRoute roles={ADMIN_ROLES}><AdminOpsPage /></RoleRoute>} />
            <Route path="admin/supply" element={<RoleRoute roles={ADMIN_ROLES}><SupplyReadinessPage /></RoleRoute>} />
            <Route path="admin/buyers" element={<RoleRoute roles={ADMIN_ROLES}><BuyerManagementPage /></RoleRoute>} />
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
      </AuthLoadingGate>
      </SeasonProvider>
      </WeatherProvider>
      </V2ProfileProvider>
      </AuthProvider>
      </AppPrefsProvider>
      </NetworkProvider>
    </BrowserRouter>
  );
}
