import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { loadTranslations, getCurrentLang } from './utils/i18n.js';

import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';

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

import { STAFF_ROLES, REVIEW_ROLES, ADMIN_ROLES, REGISTRATION_ROLES } from './utils/roles.js';

const PageLoader = () => <div className="loading">Loading...</div>;

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  if (!token) return <Navigate to="/login" replace />;
  // Farmer-role users get their own limited dashboard
  if (user?.role === 'farmer') return <Suspense fallback={<PageLoader />}><FarmerDashboardPage /></Suspense>;
  return children;
}

// Role-based route guard — redirects unauthorized roles to dashboard
function RoleRoute({ roles, children }) {
  const user = useAuthStore(s => s.user);
  if (!roles.includes(user?.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    loadTranslations(getCurrentLang())
      .then(() => setI18nReady(true))
      .catch(() => setI18nReady(true)); // proceed even if translations fail — fallbacks work
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/farmer-register" element={<FarmerRegisterPage />} />
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
