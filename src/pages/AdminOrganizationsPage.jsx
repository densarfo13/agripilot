import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';

const ORG_TYPES = ['NGO', 'LENDER', 'COOPERATIVE', 'INVESTOR', 'DEVELOPMENT_PARTNER', 'INTERNAL'];

const TYPE_COLORS = {
  NGO: { bg: '#dbeafe', color: '#1d4ed8' },
  LENDER: { bg: '#d1fae5', color: '#065f46' },
  COOPERATIVE: { bg: '#fef3c7', color: '#92400e' },
  INVESTOR: { bg: '#ede9fe', color: '#5b21b6' },
  DEVELOPMENT_PARTNER: { bg: '#fce7f3', color: '#be185d' },
  INTERNAL: { bg: '#f3f4f6', color: '#4b5563' },
};

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  const load = () => {
    setLoading(true);
    // Fetch without org filter to see all orgs (super_admin)
    api.get('/organizations', { params: { orgId: undefined } })
      .then(r => { setOrgs(r.data); setError(''); })
      .catch(() => setError('Failed to load organizations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="page-header">
        <h1>Organizations</h1>
        {isSuperAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Organization</button>}
      </div>
      <div className="page-body">
        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

        {loading ? <div className="loading">Loading organizations...</div> : orgs.length === 0 ? (
          <div className="card">
            <div className="card-body empty-state">
              No organizations found. {isSuperAdmin ? 'Create the first one to get started.' : 'Contact your administrator.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {orgs.map(org => {
              const tc = TYPE_COLORS[org.type] || TYPE_COLORS.INTERNAL;
              return (
                <div key={org.id} className="card" style={{ cursor: isSuperAdmin ? 'pointer' : 'default' }} onClick={() => isSuperAdmin && setEditOrg(org)}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{org.name}</div>
                        <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.6rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: tc.bg, color: tc.color }}>
                          {org.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                        background: org.isActive ? '#d1fae5' : '#fee2e2',
                        color: org.isActive ? '#065f46' : '#991b1b',
                      }}>
                        {org.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#f9fafb', borderRadius: 6 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{org._count?.users ?? 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>Users</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#f9fafb', borderRadius: 6 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{org._count?.farmers ?? 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>Farmers</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#f9fafb', borderRadius: 6 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{org._count?.applications ?? 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>Applications</div>
                      </div>
                    </div>

                    {org.countryCode && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                        Country: <strong>{org.countryCode}</strong>
                        {org.regionCode && <span> | Region: <strong>{org.regionCode}</strong></span>}
                      </div>
                    )}

                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                      Created {new Date(org.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showCreate && <CreateOrgModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
        {editOrg && <EditOrgModal org={editOrg} onClose={() => setEditOrg(null)} onUpdated={() => { setEditOrg(null); load(); }} />}
      </div>
    </>
  );
}

function CreateOrgModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'INTERNAL', countryCode: '', regionCode: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/organizations', {
        name: form.name,
        type: form.type,
        countryCode: form.countryCode || undefined,
        regionCode: form.regionCode || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create organization');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">New Organization <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input className="form-input" required value={form.name} onChange={set('name')} placeholder="e.g., CARE Ghana Program" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={set('type')}>
                {ORG_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Country Code</label>
                <select className="form-select" value={form.countryCode} onChange={set('countryCode')}>
                  <option value="">Not specified</option>
                  <option value="KE">Kenya (KE)</option>
                  <option value="TZ">Tanzania (TZ)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Region Code</label>
                <input className="form-input" value={form.regionCode} onChange={set('regionCode')} placeholder="Optional" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Organization'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditOrgModal({ org, onClose, onUpdated }) {
  const [form, setForm] = useState({
    name: org.name,
    type: org.type,
    countryCode: org.countryCode || '',
    regionCode: org.regionCode || '',
    isActive: org.isActive,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/organizations/${org.id}`, {
        name: form.name,
        type: form.type,
        countryCode: form.countryCode || null,
        regionCode: form.regionCode || null,
        isActive: form.isActive,
      });
      onUpdated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update organization');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Edit Organization <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input className="form-input" required value={form.name} onChange={set('name')} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={set('type')}>
                {ORG_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Country Code</label>
                <select className="form-select" value={form.countryCode} onChange={set('countryCode')}>
                  <option value="">Not specified</option>
                  <option value="KE">Kenya (KE)</option>
                  <option value="TZ">Tanzania (TZ)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Region Code</label>
                <input className="form-input" value={form.regionCode} onChange={set('regionCode')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                Organization is active
              </label>
            </div>
            <div style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: 6, fontSize: '0.8rem', color: '#6b7280' }}>
              ID: <code style={{ fontSize: '0.7rem' }}>{org.id}</code>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
