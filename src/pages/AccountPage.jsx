import React, { useEffect, useState } from 'react';
import api, { formatApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'sw', label: 'Swahili' },
  { value: 'fr', label: 'French' },
  { value: 'am', label: 'Amharic' },
  { value: 'ha', label: 'Hausa' },
];

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  institutional_admin: 'Institutional Admin',
  reviewer: 'Reviewer',
  field_officer: 'Field Officer',
  investor_viewer: 'Investor Viewer',
  farmer: 'Farmer',
};

export default function AccountPage() {
  const { user: authUser, setAuth, token } = useAuthStore();

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Profile form
  const [form, setForm] = useState({ fullName: '', preferredLanguage: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  // Password change
  const [showPw, setShowPw] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
    api.get('/auth/me')
      .then(r => {
        setMe(r.data);
        setForm({ fullName: r.data.fullName || '', preferredLanguage: r.data.preferredLanguage || '' });
      })
      .catch(err => setLoadError(formatApiError(err, 'Failed to load account details')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaving(true);
    try {
      const updated = await api.patch('/auth/me', {
        fullName: form.fullName,
        preferredLanguage: form.preferredLanguage || undefined,
      });
      setSaveSuccess('Profile updated successfully');
      // Refresh auth store so sidebar name reflects changes immediately
      if (authUser) {
        setAuth({ ...authUser, fullName: updated.data.fullName }, token);
      }
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      setSaveError(formatApiError(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const handlePwChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pw.newPassword !== pw.confirmPassword) return setPwError('New passwords do not match');
    if (pw.newPassword.length < 8) return setPwError('Password must be at least 8 characters');
    setPwSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      setPwSuccess('Password changed successfully');
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => { setPwSuccess(''); setShowPw(false); }, 2000);
    } catch (err) {
      setPwError(formatApiError(err, 'Failed to change password'));
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) return <div className="loading">Loading account...</div>;

  if (loadError) return (
    <div className="page-body">
      <div className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{loadError}</span>
        <button className="btn btn-sm btn-outline" onClick={load}>Try again</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <h1>My Account</h1>
      </div>
      <div className="page-body" style={{ maxWidth: 600 }}>

        {/* Read-only identity summary */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Account Details</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: '0.2rem' }}>EMAIL</div>
                <div style={{ fontWeight: 500 }}>{me?.email}</div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: '0.2rem' }}>ROLE</div>
                <span className="badge badge-submitted">{ROLE_LABELS[me?.role] || me?.role}</span>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: '0.2rem' }}>ORGANIZATION</div>
                <div style={{ fontWeight: 500 }}>
                  {me?.organization?.name || <span style={{ color: '#d97706' }}>Unassigned</span>}
                </div>
              </div>
              <div>
                <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: '0.2rem' }}>LAST LOGIN</div>
                <div>{me?.lastLoginAt ? new Date(me.lastLoginAt).toLocaleString() : 'N/A'}</div>
              </div>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: '0.75rem 0 0' }}>
              Email, role, and organization can only be changed by an administrator.
            </p>
          </div>
        </div>

        {/* Editable profile */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Edit Profile</div>
          <div className="card-body">
            <form onSubmit={handleSave}>
              {saveError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{saveError}</div>}
              {saveSuccess && (
                <div style={{ background: '#d4edda', color: '#155724', padding: '0.65rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>
                  {saveSuccess}
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-input"
                  required
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Preferred Language</label>
                <select
                  className="form-select"
                  value={form.preferredLanguage}
                  onChange={e => setForm(f => ({ ...f, preferredLanguage: e.target.value }))}
                >
                  <option value="">Not set</option>
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Password change */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Password</span>
            <button className="btn btn-outline btn-sm" onClick={() => { setShowPw(s => !s); setPwError(''); setPwSuccess(''); }}>
              {showPw ? 'Cancel' : 'Change Password'}
            </button>
          </div>
          {showPw && (
            <div className="card-body">
              <form onSubmit={handlePwChange}>
                {pwError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{pwError}</div>}
                {pwSuccess && (
                  <div style={{ background: '#d4edda', color: '#155724', padding: '0.65rem 1rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {pwSuccess}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input className="form-input" type="password" required
                    value={pw.currentPassword} onChange={e => setPw(p => ({ ...p, currentPassword: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input className="form-input" type="password" required minLength={8}
                    value={pw.newPassword} onChange={e => setPw(p => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Min 8 chars, 1 upper, 1 lower, 1 number" />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input className="form-input" type="password" required minLength={8}
                    value={pw.confirmPassword} onChange={e => setPw(p => ({ ...p, confirmPassword: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                    {pwSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
