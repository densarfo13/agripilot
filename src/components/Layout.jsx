import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
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
  ]},
  { section: 'Admin', roles: ADMIN_ROLES, items: [
    { to: '/admin/control', label: 'Control Center', icon: 'C' },
    { to: '/audit', label: 'Audit Trail', icon: 'T' },
    { to: '/admin/users', label: 'User Management', icon: 'U' },
  ] },
];

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.newPassword !== form.confirmPassword) {
      return setError('New passwords do not match');
    }
    if (form.newPassword.length < 8) {
      return setError('Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number');
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setSuccess('Password changed successfully!');
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Change Password <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success" style={{ background: '#d4edda', color: '#155724', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input className="form-input" type="password" required value={form.currentPassword} onChange={set('currentPassword')} />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" required minLength={8} value={form.newPassword} onChange={set('newPassword')} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" required minLength={8} value={form.confirmPassword} onChange={set('confirmPassword')} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">AgriPilot</div>
        {user?.organization?.name && (
          <div className="sidebar-org" title={`Organization: ${user.organization.name} (${user.organization.type})`}>
            {user.organization.name}
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
          <button onClick={() => setShowChangePassword(true)} className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', color: '#9ca3af', borderColor: '#4b5563' }}>
            Change Password
          </button>
          <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center', color: '#9ca3af', borderColor: '#4b5563' }}>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
