import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import CountrySelect from '../components/CountrySelect.jsx';
import { getCountryName } from '../utils/countries.js';
import { useTranslation } from '../i18n/index.js';

const ORG_TYPES = ['NGO', 'LENDER', 'COOPERATIVE', 'INVESTOR', 'DEVELOPMENT_PARTNER', 'INTERNAL'];

const TYPE_COLORS = {
  NGO: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  LENDER: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  COOPERATIVE: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  INVESTOR: { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
  DEVELOPMENT_PARTNER: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  INTERNAL: { bg: '#1E293B', color: '#A1A1AA' },
};

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrg, setEditOrg] = useState(null);
  const user = useAuthStore(s => s.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const { t } = useTranslation();

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
        <h1>{t('admin.organizations')}</h1>
        {isSuperAdmin && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>{'+ ' + t('admin.newOrganization')}</button>}
      </div>
      <div className="page-body">
        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

        {loading ? <div className="loading">{t('admin.loading')}</div> : orgs.length === 0 ? (
          <div className="card">
            <div className="card-body empty-state">
              {t('admin.noResults')} {isSuperAdmin ? 'Create the first one to get started.' : 'Contact your administrator.'}
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
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#FFFFFF' }}>{org.name}</div>
                        <span className="badge" style={{ marginTop: '0.25rem', background: tc.bg, color: tc.color }}>
                          {org.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className={`badge ${org.isActive ? 'badge-active' : 'badge-disabled'}`}>
                        {org.isActive ? t('admin.active') : t('admin.inactive')}
                      </span>
                    </div>
                    <a
                      href={`/admin/organizations/${org.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-block', marginBottom: '0.75rem',
                        padding: '4px 10px', borderRadius: 6,
                        background: 'rgba(34,197,94,0.14)',
                        color: '#86EFAC', fontSize: '0.8rem',
                        fontWeight: 600, textDecoration: 'none',
                      }}
                      data-testid={`org-dashboard-link-${org.id}`}
                    >
                      {t('admin.viewDashboard') !== 'admin.viewDashboard'
                        ? t('admin.viewDashboard') : 'View dashboard →'}
                    </a>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#1E293B', borderRadius: 6 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>{org._count?.users ?? 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#A1A1AA', fontWeight: 500 }}>{t('admin.users')}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#1E293B', borderRadius: 6 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>{org._count?.farmers ?? 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#A1A1AA', fontWeight: 500 }}>{t('admin.farmers')}</div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem', background: '#1E293B', borderRadius: 6 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF' }}>{org._count?.applications ?? 0}</div>
                        <div style={{ fontSize: '0.7rem', color: '#A1A1AA', fontWeight: 500 }}>{t('admin.applications')}</div>
                      </div>
                    </div>

                    {org.countryCode && (
                      <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#A1A1AA' }}>
                        {t('admin.country')} <strong>{getCountryName(org.countryCode)}</strong>
                        {org.regionCode && <span> | {t('admin.region')} <strong>{org.regionCode}</strong></span>}
                      </div>
                    )}

                    <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#71717A' }}>
                      {t('admin.created')} {new Date(org.createdAt).toLocaleDateString()}
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
  const { t } = useTranslation();

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
        <div className="modal-header">{t('admin.newOrganization')} <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">{t('admin.name')}</label>
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
                <label className="form-label">Country</label>
                <CountrySelect
                  className="form-select"
                  searchClassName="form-input"
                  value={form.countryCode}
                  onChange={set('countryCode')}
                  includeEmpty
                  emptyLabel="Not specified"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Region Code</label>
                <input className="form-input" value={form.regionCode} onChange={set('regionCode')} placeholder="Optional" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.creating') : t('admin.create') + ' ' + t('admin.organization')}</button>
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
  const { t } = useTranslation();

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
        <div className="modal-header">{t('admin.edit') + ' ' + t('admin.organization')} <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">{t('admin.name')}</label>
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
                <label className="form-label">Country</label>
                <CountrySelect
                  className="form-select"
                  searchClassName="form-input"
                  value={form.countryCode}
                  onChange={set('countryCode')}
                  includeEmpty
                  emptyLabel="Not specified"
                />
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
            <div style={{ padding: '0.5rem 0.75rem', background: '#1E293B', borderRadius: 6, fontSize: '0.8rem', color: '#A1A1AA' }}>
              ID: <code style={{ fontSize: '0.7rem' }}>{org.id}</code>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.saving') : t('admin.save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
