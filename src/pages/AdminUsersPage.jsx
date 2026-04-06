import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { INSTITUTIONAL_ROLES } from '../utils/roles.js';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [actionError, setActionError] = useState('');

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => { setUsers(r.data); setActionError(''); }).catch(() => setActionError('Failed to load users')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const [resetTarget, setResetTarget] = useState(null);

  const toggleActive = async (userId) => {
    setActionError('');
    try {
      await api.patch(`/users/${userId}/toggle-active`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to update user');
    }
  };

  // Org context subtitle
  const orgLabel = !isSuperAdmin && currentUser?.organization?.name
    ? currentUser.organization.name
    : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          {orgLabel && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{orgLabel}</div>}
        </div>
        {isSuperAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New User</button>}
      </div>
      <div className="page-body">
        {actionError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{actionError}</div>}
        {loading ? <div className="loading">Loading...</div> : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Created</th>
                    {isSuperAdmin && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td><span className="badge badge-submitted">{u.role.replace(/_/g, ' ')}</span></td>
                      <td className="text-sm text-muted">{u.organization?.name || <span style={{ color: '#d97706' }}>Unassigned</span>}</td>
                      <td>{u.active ? <span className="badge badge-approved">Active</span> : <span className="badge badge-rejected">Inactive</span>}</td>
                      <td className="text-sm text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                      {isSuperAdmin && (
                        <td style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className={`btn btn-sm ${u.active ? 'btn-warning' : 'btn-success'}`} onClick={() => toggleActive(u.id)}>
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => setResetTarget(u)}>
                            Reset Password
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={7} className="empty-state">No users found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
        {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
      </div>
    </>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number');
    }
    setSaving(true);
    try {
      await api.patch(`/users/${user.id}/reset-password`, { newPassword });
      setSuccess(`Password reset for ${user.fullName}`);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Reset Password for {user.fullName} <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success" style={{ background: '#d4edda', color: '#155724', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}
            <div className="form-group">
              <label className="form-label">New Password for {user.email}</label>
              <input className="form-input" type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Resetting...' : 'Reset Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'field_officer', organizationId: '' });
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch orgs for assignment dropdown
    api.get('/organizations', { params: { orgId: undefined } })
      .then(r => setOrgs(r.data))
      .catch(() => {});
  }, []);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/users', {
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        organizationId: form.organizationId || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">New User <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" required value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" required minLength={8} value={form.password} onChange={set('password')} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-select" value={form.role} onChange={set('role')}>
                  {INSTITUTIONAL_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Organization</label>
                <select className="form-select" value={form.organizationId} onChange={set('organizationId')}>
                  <option value="">Inherit from creator</option>
                  {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
