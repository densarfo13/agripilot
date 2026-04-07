import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import api from '../api/client.js';
import { STAFF_ROLES, REVIEW_ROLES, ADMIN_ROLES, REGISTRATION_ROLES } from '../utils/roles.js';

const NAV = [
  { section: 'Overview', items: [
    { to: '/', label: 'Dashboard', icon: '/' },
  ]},
  { section: 'Operations', roles: STAFF_ROLES, items: [
    { to: '/farmers', label: 'Farmers', icon: 'F' },
    { to: '/applications', label: 'Applications', icon: 'A' },
    { to: '/farmer-registrations', label: 'Farmer Registrations', icon: 'R', roles: REGISTRATION_ROLES },
    { to: '/verification-queue', label: 'Verification Queue', icon: 'V', roles: REVIEW_ROLES },
    { to: '/fraud-queue', label: 'Fraud Queue', icon: '!', roles: REVIEW_ROLES },
  ]},
  { section: 'Analytics', items: [
    { to: '/portfolio', label: 'Portfolio', icon: 'P' },
    { to: '/reports', label: 'Reports', icon: 'R' },
    { to: '/pilot-metrics', label: 'Pilot Metrics', icon: 'M', roles: [...ADMIN_ROLES, 'investor_viewer', 'field_officer'] },
  ]},
  { section: 'Admin', roles: ADMIN_ROLES, items: [
    { to: '/admin/control', label: 'Control Center', icon: 'C' },
    { to: '/admin/organizations', label: 'Organizations', icon: 'O', roles: ADMIN_ROLES },
    { to: '/audit', label: 'Audit Trail', icon: 'T' },
    { to: '/admin/users', label: 'User Management', icon: 'U' },
    { to: '/admin/security', label: 'Security Requests', icon: 'S', roles: ADMIN_ROLES },
  ] },
];

// ─── Super Admin Org Switcher ─────────────────────────

function OrgSwitcher() {
  const { organizations, selectedOrgId, selectedOrgName, setSelectedOrg, clearSelectedOrg, setOrganizations } = useOrgStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Fetch organizations list for the switcher (no orgId filter — super_admin sees all)
    api.get('/organizations', { params: { orgId: undefined } })
      .then(r => setOrganizations(r.data))
      .catch(() => {});
  }, []);

  const handleSelect = (org) => {
    if (org) {
      setSelectedOrg(org.id, org.name);
    } else {
      clearSelectedOrg();
    }
    setOpen(false);
  };

  return (
    <div className="org-switcher">
      <button
        className="org-switcher-btn"
        onClick={() => setOpen(!open)}
        title={selectedOrgId ? `Viewing: ${selectedOrgName}` : 'Viewing: All Organizations'}
      >
        <span className="org-switcher-label">
          {selectedOrgId ? selectedOrgName : 'All Organizations'}
        </span>
        <span className="org-switcher-arrow">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div className="org-switcher-dropdown">
          <div
            className={`org-switcher-option ${!selectedOrgId ? 'active' : ''}`}
            onClick={() => handleSelect(null)}
          >
            All Organizations
          </div>
          {organizations.map(org => (
            <div
              key={org.id}
              className={`org-switcher-option ${selectedOrgId === org.id ? 'active' : ''}`}
              onClick={() => handleSelect(org)}
            >
              <span>{org.name}</span>
              <span className="org-switcher-type">{org.type.replace(/_/g, ' ').toLowerCase()}</span>
            </div>
          ))}
          {organizations.length === 0 && (
            <div className="org-switcher-option" style={{ color: '#9ca3af', fontStyle: 'italic' }}>
              No organizations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  const handleLogout = () => {
    useOrgStore.getState().clearSelectedOrg();
    logout();
    navigate('/login');
  };

  // Determine displayed org context
  const orgName = user?.organization?.name;
  const orgType = user?.organization?.type;

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">AgriPilot</div>

        {/* Org context: super_admin gets switcher, others see read-only org name */}
        {isSuperAdmin ? (
          <OrgSwitcher />
        ) : orgName ? (
          <div className="sidebar-org" title={`Organization: ${orgName}${orgType ? ` (${orgType.replace(/_/g, ' ')})` : ''}`}>
            {orgName}
          </div>
        ) : (
          <div className="sidebar-org" style={{ color: '#f59e0b' }} title="No organization assigned">
            No organization
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV.map((section) => {
            if (section.roles && !section.roles.includes(user?.role)) return null;
            const visibleItems = section.items.filter(item => !item.roles || item.roles.includes(user?.role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.section}>
                <div className="sidebar-section">{section.section}</div>
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-name">{user?.fullName}</div>
          <div className="sidebar-user-role">{user?.role?.replace(/_/g, ' ')}</div>
          <NavLink to="/account" className={({ isActive }) => `btn btn-outline btn-sm${isActive ? ' active' : ''}`} style={{ marginTop: '0.5rem', display: 'block', textAlign: 'center', color: '#9ca3af', borderColor: '#4b5563', textDecoration: 'none' }}>
            My Account
          </NavLink>
          <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', color: '#9ca3af', borderColor: '#4b5563' }}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
