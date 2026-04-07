import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { CREATOR_ROLES } from '../utils/roles.js';
import CountrySelect from '../components/CountrySelect.jsx';
import PhoneInput from '../components/PhoneInput.jsx';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'disabled', label: 'Disabled' },
];

export default function FarmersPage() {
  const [farmers, setFarmers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const { selectedOrgId } = useOrgStore();
  const isSuperAdmin = user?.role === 'super_admin';
  const canCreate = CREATOR_ROLES.includes(user?.role);

  const load = (p = page, s = search, status = statusFilter) => {
    setLoading(true);
    api.get('/farmers', { params: {
      page: p, limit: 20,
      search: s || undefined,
      registrationStatus: status || undefined,
    }})
      .then(r => { setFarmers(r.data.farmers); setTotal(r.data.total); setLoadError(''); })
      .catch(() => setLoadError('Failed to load farmers list'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, selectedOrgId]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search, statusFilter);
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
    load(1, search, value);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Farmers ({total})</h1>
          {!isSuperAdmin && user?.organization?.name && (
            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>{user.organization.name}</div>
          )}
        </div>
        <div className="flex gap-1">
          <form onSubmit={handleSearch} className="flex gap-1">
            <input className="form-input" style={{ width: 220 }} placeholder="Search name, phone, ID..." value={search} onChange={e => setSearch(e.target.value)} />
            <button type="submit" className="btn btn-outline">Search</button>
          </form>
          {canCreate && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Farmer</button>}
          {canCreate && <button className="btn btn-outline" onClick={() => setShowInvite(true)}>Invite Farmer</button>}
        </div>
      </div>
      <div className="page-body">
        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => handleStatusFilter(f.value)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: 20, fontSize: '0.82rem', cursor: 'pointer',
                border: statusFilter === f.value ? '1.5px solid #2563eb' : '1.5px solid #e5e7eb',
                background: statusFilter === f.value ? '#eff6ff' : '#fff',
                color: statusFilter === f.value ? '#1d4ed8' : '#6b7280',
                fontWeight: statusFilter === f.value ? 600 : 400,
              }}
            >{f.label}</button>
          ))}
        </div>

        {loadError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{loadError}</div>}
        {loading ? <div className="loading">Loading...</div> : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Region</th>
                      <th>Status</th>
                      <th>Invite</th>
                      {isSuperAdmin && <th>Organization</th>}
                      <th>Primary Crop</th>
                      <th>Farm Size</th>
                      <th>Applications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmers.map(f => (
                      <tr key={f.id} onClick={() => navigate(`/farmers/${f.id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{f.fullName}</td>
                        <td>{f.phone}</td>
                        <td>{f.region}</td>
                        <td><RegistrationBadge status={f.registrationStatus} /></td>
                        <td>{!f.selfRegistered ? <InviteStatusBadge status={f.inviteDeliveryStatus} hasAccount={!!f.userId} /> : <span className="text-sm text-muted">—</span>}</td>
                        {isSuperAdmin && <td className="text-sm text-muted">{f.organization?.name || '-'}</td>}
                        <td>{f.primaryCrop || '-'}</td>
                        <td>{f.farmSizeAcres ? `${f.farmSizeAcres} ${f.countryCode === 'TZ' ? 'ha' : 'ac'}` : '-'}</td>
                        <td>{f._count?.applications || 0}</td>
                      </tr>
                    ))}
                    {farmers.length === 0 && <tr><td colSpan={isSuperAdmin ? 9 : 8} className="empty-state">No farmers found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {total > 20 && (
          <div className="pagination">
            <span>Showing {(page-1)*20+1}-{Math.min(page*20, total)} of {total}</span>
            <div className="flex gap-1">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
              <button className="btn btn-outline btn-sm" disabled={page * 20 >= total} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          </div>
        )}

        {showCreate && <CreateFarmerModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(1, search); }} />}
        {showInvite && <InviteFarmerModal onClose={() => setShowInvite(false)} onCreated={() => { setShowInvite(false); load(1, search); }} />}
      </div>
    </>
  );
}

// Shared: copyable invite link box shown after farmer create/invite
function InviteLinkBox({ url, label, expiresAt }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {});
  };
  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '0.75rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: expiresAt ? '0.35rem' : 0 }}>
        <input
          readOnly
          value={url}
          onClick={e => e.target.select()}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', padding: '0.35rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', color: '#374151', cursor: 'text' }}
        />
        <button
          type="button"
          onClick={copy}
          className="btn btn-outline btn-sm"
          style={{ whiteSpace: 'nowrap', color: copied ? '#16a34a' : undefined, borderColor: copied ? '#16a34a' : undefined }}
        >
          {copied ? '✓ Copied' : 'Copy Link'}
        </button>
      </div>
      {expiresAt && (
        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
          Link expires: {new Date(expiresAt).toLocaleDateString()} — resend from Farmer Detail if needed
        </div>
      )}
    </div>
  );
}

function RegistrationBadge({ status }) {
  const map = {
    pending_approval: { cls: 'badge-submitted', label: 'Pending' },
    approved: { cls: 'badge-approved', label: 'Active' },
    rejected: { cls: 'badge-rejected', label: 'Rejected' },
    disabled: { cls: '', label: 'Disabled' },
  };
  const { cls, label } = map[status] || { cls: '', label: status?.replace(/_/g, ' ') || '-' };
  return <span className={`badge ${cls}`}>{label}</span>;
}

/**
 * Invite delivery status badge for invited (non-self-registered) farmers.
 * Shows a concise label based on inviteDeliveryStatus + whether they have a linked account.
 */
function InviteStatusBadge({ status, hasAccount }) {
  if (hasAccount) {
    return <span className="badge badge-approved" title="Farmer has a login account">Activated</span>;
  }
  const map = {
    manual_share_ready: { cls: 'badge-draft', label: 'Link Ready' },
    email_sent:         { cls: 'badge-submitted', label: 'Email Sent' },
    phone_sent:         { cls: 'badge-submitted', label: 'SMS Sent' },
    accepted:           { cls: 'badge-approved', label: 'Accepted' },
    expired:            { cls: 'badge-rejected', label: 'Expired' },
  };
  const { cls, label } = map[status] || { cls: 'badge-draft', label: 'Pending' };
  return <span className={`badge ${cls}`}>{label}</span>;
}

function CreateFarmerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', phone: '', region: '', district: '', village: '', countryCode: 'KE', primaryCrop: '', farmSizeAcres: '', yearsExperience: '', nationalId: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [success, setSuccess] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : undefined,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined,
        email: createAccount && form.email ? form.email : undefined,
        password: createAccount && form.password ? form.password : undefined,
      };
      const res = await api.post('/farmers', payload);
      setSuccess({ credentialsCreated: res.data.credentialsCreated, inviteToken: res.data.inviteToken, inviteExpiresAt: res.data.inviteExpiresAt, deliveryNote: res.data.deliveryNote, farmerName: form.fullName });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create farmer');
    } finally { setSaving(false); }
  };

  if (success) {
    const inviteUrl = success.inviteToken ? `${window.location.origin}/accept-invite?token=${success.inviteToken}` : null;
    return (
      <div className="modal-overlay" onClick={() => onCreated()}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">Farmer Created <button className="btn btn-outline btn-sm" onClick={() => onCreated()}>X</button></div>
          <div className="modal-body">
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
              <strong>{success.farmerName}</strong> has been added to AgriPilot.
            </div>
            <div style={{ background: success.credentialsCreated ? '#eff6ff' : '#fffbeb', color: success.credentialsCreated ? '#1e40af' : '#92400e', padding: '0.75rem', borderRadius: 6, fontSize: '0.85rem', marginBottom: inviteUrl ? '0.75rem' : 0 }}>
              <strong>{success.credentialsCreated ? 'Login Account Created' : 'No Login Account'}</strong>
              <p style={{ margin: '0.5rem 0 0' }}>{success.deliveryNote}</p>
            </div>
            {inviteUrl && (
              <InviteLinkBox url={inviteUrl} label="Share this link with the farmer to complete registration:" expiresAt={success.inviteExpiresAt} />
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => onCreated()}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">New Farmer <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <CountrySelect
                  className="form-select"
                  searchClassName="form-input"
                  value={form.countryCode}
                  onChange={set('countryCode')}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <PhoneInput
                  className="form-input"
                  value={form.phone}
                  onChange={set('phone')}
                  countryCode={form.countryCode}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Region *</label>
                <input className="form-input" required value={form.region} onChange={set('region')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">National ID</label>
                <input className="form-input" value={form.nationalId} onChange={set('nationalId')} />
              </div>
              <div className="form-group" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-input" value={form.district} onChange={set('district')} />
              </div>
              <div className="form-group">
                <label className="form-label">Village</label>
                <input className="form-input" value={form.village} onChange={set('village')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Primary Crop</label>
                <input className="form-input" value={form.primaryCrop} onChange={set('primaryCrop')} />
              </div>
              <div className="form-group">
                <label className="form-label">Farm Size (acres)</label>
                <input className="form-input" type="number" step="0.1" value={form.farmSizeAcres} onChange={set('farmSizeAcres')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Years of Experience</label>
              <input className="form-input" type="number" value={form.yearsExperience} onChange={set('yearsExperience')} />
            </div>

            {/* Optional: create login account */}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={createAccount} onChange={e => setCreateAccount(e.target.checked)} />
                Create login account now (optional)
              </label>
              {createAccount && (
                <div className="form-row" style={{ marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" required={createAccount} value={form.email} onChange={set('email')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temporary Password *</label>
                    <input className="form-input" type="password" required={createAccount} minLength={8} value={form.password} onChange={set('password')} placeholder="Min 8 chars" />
                  </div>
                </div>
              )}
              {!createAccount && (
                <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0 0' }}>
                  An invite link will be generated so the farmer can self-register later.
                </p>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Farmer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteFarmerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    fullName: '', phone: '', email: '', password: '', region: '', district: '', village: '',
    countryCode: 'KE', primaryCrop: '', farmSizeAcres: '', preferredLanguage: 'en',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [success, setSuccess] = useState(null); // holds { credentialsCreated, deliveryNote }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        region: form.region,
        district: form.district || undefined,
        village: form.village || undefined,
        countryCode: form.countryCode,
        primaryCrop: form.primaryCrop || undefined,
        farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : undefined,
        preferredLanguage: form.preferredLanguage,
      };
      if (createAccount && form.email && form.password) {
        payload.email = form.email;
        payload.password = form.password;
      }
      const res = await api.post('/farmers/invite', payload);
      setSuccess({ credentialsCreated: res.data.credentialsCreated, deliveryNote: res.data.deliveryNote, farmerName: form.fullName, inviteToken: res.data.inviteToken, inviteExpiresAt: res.data.inviteExpiresAt });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to invite farmer');
    } finally { setSaving(false); }
  };

  if (success) {
    const inviteUrl = success.inviteToken ? `${window.location.origin}/accept-invite?token=${success.inviteToken}` : null;
    return (
      <div className="modal-overlay" onClick={() => { onCreated(); }}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">Farmer Invited <button className="btn btn-outline btn-sm" onClick={() => onCreated()}>X</button></div>
          <div className="modal-body">
            <div style={{ background: '#ecfdf5', color: '#065f46', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
              <strong>{success.farmerName}</strong> has been successfully invited to AgriPilot.
            </div>
            <div style={{ background: success.credentialsCreated ? '#eff6ff' : '#fffbeb', color: success.credentialsCreated ? '#1e40af' : '#92400e', padding: '0.75rem', borderRadius: 6, fontSize: '0.85rem', marginBottom: inviteUrl ? '0.75rem' : 0 }}>
              <strong>{success.credentialsCreated ? 'Login Account Created' : 'No Login Account'}</strong>
              <p style={{ margin: '0.5rem 0 0' }}>{success.deliveryNote}</p>
            </div>
            {inviteUrl && (
              <InviteLinkBox url={inviteUrl} label="Share this link with the farmer to complete registration:" expiresAt={success.inviteExpiresAt} />
            )}
          </div>
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={() => onCreated()}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Invite Farmer <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div style={{ background: '#eff6ff', color: '#1e40af', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.8rem' }}>
              Invited farmers are pre-approved and can begin using the system immediately once they have login credentials.
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <CountrySelect
                  className="form-select"
                  searchClassName="form-input"
                  value={form.countryCode}
                  onChange={set('countryCode')}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <PhoneInput
                  className="form-input"
                  value={form.phone}
                  onChange={set('phone')}
                  countryCode={form.countryCode}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Region *</label>
                <input className="form-input" required value={form.region} onChange={set('region')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-input" value={form.district} onChange={set('district')} />
              </div>
              <div className="form-group">
                <label className="form-label">Village</label>
                <input className="form-input" value={form.village} onChange={set('village')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Primary Crop</label>
                <input className="form-input" value={form.primaryCrop} onChange={set('primaryCrop')} />
              </div>
              <div className="form-group">
                <label className="form-label">Farm Size ({form.countryCode === 'TZ' ? 'hectares' : 'acres'})</label>
                <input className="form-input" type="number" step="0.1" value={form.farmSizeAcres} onChange={set('farmSizeAcres')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Language</label>
              <select className="form-select" value={form.preferredLanguage} onChange={set('preferredLanguage')}>
                <option value="en">English</option>
                <option value="sw">Swahili</option>
              </select>
            </div>

            {/* Optional: create login account */}
            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input type="checkbox" checked={createAccount} onChange={e => setCreateAccount(e.target.checked)} />
                Create login account now (optional)
              </label>
              {createAccount && (
                <div className="form-row" style={{ marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" required={createAccount} value={form.email} onChange={set('email')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temporary Password *</label>
                    <input className="form-input" type="password" required={createAccount} minLength={8} value={form.password} onChange={set('password')} placeholder="Min 8 chars" />
                  </div>
                </div>
              )}
              {!createAccount && (
                <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '0.5rem 0 0' }}>
                  Farmer profile will be created without a login account. The farmer can later self-register with matching phone number.
                </p>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Inviting...' : 'Invite Farmer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
