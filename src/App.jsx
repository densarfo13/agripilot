import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { loadTranslations, getCurrentLang } from './utils/i18n.js';

import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import FarmersPage from './pages/FarmersPage.jsx';
import FarmerDetailPage from './pages/FarmerDetailPage.jsx';
import ApplicationsPage from './pages/ApplicationsPage.jsx';
import NewApplicationPage from './pages/NewApplicationPage.jsx';
import ApplicationDetailPage from './pages/ApplicationDetailPage.jsx';
import PortfolioPage from './pages/PortfolioPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import VerificationQueuePage from './pages/VerificationQueuePage.jsx';
import FraudQueuePage from './pages/FraudQueuePage.jsx';
import FarmerHomePage from './pages/FarmerHomePage.jsx';
import FarmerOverviewTab from './pages/FarmerOverviewTab.jsx';
import FarmerActivitiesTab from './pages/FarmerActivitiesTab.jsx';
import FarmerRemindersTab from './pages/FarmerRemindersTab.jsx';
import FarmerNotificationsTab from './pages/FarmerNotificationsTab.jsx';
import FarmerStorageTab from './pages/FarmerStorageTab.jsx';
import FarmerMarketTab from './pages/FarmerMarketTab.jsx';
import AdminControlPage from './pages/AdminControlPage.jsx';
import FarmerRegisterPage from './pages/FarmerRegisterPage.jsx';
import FarmerDashboardPage from './pages/FarmerDashboardPage.jsx';
import PendingRegistrationsPage from './pages/PendingRegistrationsPage.jsx';
import { STAFF_ROLES, REVIEW_ROLES, ADMIN_ROLES, REGISTRATION_ROLES } from './utils/roles.js';

function ProtectedRoute({ children }) {
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  if (!token) return <Navigate to="/login" replace />;
  // Farmer-role users get their own limited dashboard
  if (user?.role === 'farmer') return <FarmerDashboardPage />;
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
          </Route>
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="audit" element={<RoleRoute roles={ADMIN_ROLES}><AuditPage /></RoleRoute>} />
          <Route path="admin/users" element={<RoleRoute roles={ADMIN_ROLES}><AdminUsersPage /></RoleRoute>} />
          <Route path="admin/registrations" element={<RoleRoute roles={REGISTRATION_ROLES}><PendingRegistrationsPage /></RoleRoute>} />
          <Route path="admin/control" element={<RoleRoute roles={ADMIN_ROLES}><AdminControlPage /></RoleRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
