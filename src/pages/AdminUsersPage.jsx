import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

const ROLES = ['super_admin', 'institutional_admin', 'reviewer', 'field_officer', 'investor_viewer'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const currentUser = useAuthStore(s => s.user);
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (userId) => {
    try {
      await api.patch(`/users/${userId}/toggle-active`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user');
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>User Management</h1>
        {isSuperAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New User</button>}
      </div>
      <div className="page-body">
        {loading ? <div className="loading">Loading...</div> : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th>{isSuperAdmin && <th>Actions</th>}</tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td><span className="badge badge-submitted">{u.role.replace(/_/g, ' ')}</span></td>
                      <td>{u.active ? <span className="badge badge-approved">Active</span> : <span className="badge badge-rejected">Inactive</span>}</td>
                      <td className="text-sm text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                      {isSuperAdmin && (
                        <td>
                          <button className={`btn btn-sm ${u.active ? 'btn-warning' : 'btn-success'}`} onClick={() => toggleActive(u.id)}>
                            {u.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      </div>
    </>
  );
}

function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'field_officer' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/users', form);
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
              <input className="form-input" type="password" required minLength={6} value={form.password} onChange={set('password')} />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <select className="form-select" value={form.role} onChange={set('role')}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
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
