import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { CREATOR_ROLES } from '../utils/roles.js';
import CountrySelect from '../components/CountrySelect.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import { AccessBadge, InviteBadge } from '../components/InviteAccessBadge.jsx';

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
                      <th>Access</th>
                      <th>Invite</th>
                      {isSuperAdmin && <th>Organization</th>}
                      <th>Primary Crop</th>
                      <th>Farm Size</th>
                      <th>Applications</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmers.map(f => (
                      <tr key={f.id} onClick={() => navigate(`/farmers/${f.id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{f.fullName}</td>
                        <td>{f.phone}</td>
                        <td>{f.region}</td>
                        <td><AccessBadge value={f.accessStatus} /></td>
                        <td>{!f.selfRegistered ? <InviteBadge value={f.inviteStatus} /> : <span className="text-sm text-muted">—</span>}</td>
                        {isSuperAdmin && <td className="text-sm text-muted">{f.organization?.name || '-'}</td>}
                        <td>{f.primaryCrop || '-'}</td>
                        <td>{f.farmSizeAcres ? `${f.farmSizeAcres} ${f.countryCode === 'TZ' ? 'ha' : 'ac'}` : '-'}</td>
                        <td>{f._count?.applications || 0}</td>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          {f.inviteStatus === 'LINK_GENERATED' && <RowCopyLinkButton farmerId={f.id} />}
                        </td>
                      </tr>
                    ))}
                    {farmers.length === 0 && <tr><td colSpan={isSuperAdmin ? 10 : 9} className="empty-state">No farmers found</td></tr>}
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


// ─── Row quick-action: Copy Invite Link ─────────────────────
function RowCopyLinkButton({ farmerId }) {
  const [state, setState] = useState('idle'); // idle | loading | copied | error
  const handle = async (e) => {
    e.stopPropagation();
    setState('loading');
    try {
      const res = await api.get(`/farmers/${farmerId}/invite-status`);
      const token = res.data.inviteToken;
      if (!token) { setState('error'); setTimeout(() => setState('idle'), 2000); return; }
      const url = `${window.location.origin}/accept-invite?token=${token}`;
      await navigator.clipboard.writeText(url);
      setState('copied');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };
  return (
    <button
      className="btn btn-outline btn-sm"
      onClick={handle}
      disabled={state === 'loading'}
      style={{ fontSize: '0.75rem', color: state === 'copied' ? '#16a34a' : state === 'error' ? '#dc2626' : '#2563eb', borderColor: state === 'copied' ? '#16a34a' : state === 'error' ? '#dc2626' : undefined }}
    >
      {state === 'loading' ? '…' : state === 'copied' ? '✓ Copied' : state === 'error' ? 'Failed' : 'Copy Link'}
    </button>
  );
}

// ─── Stepped Create Farmer Modal ─────────────────────────────
// Step 1: Farmer Info  →  Step 2: Account Access  →  Step 3: Review & Create
const STEP_LABELS = ['Farmer Info', 'Account Access', 'Review'];

function StepIndicator({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.25rem' }}>
      {STEP_LABELS.map((label, i) => {
        const num = i + 1;
        const active = num === step;
        const done = num < step;
        return (
          <React.Fragment key={num}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700,
                background: done ? '#16a34a' : active ? '#2563eb' : '#e5e7eb',
                color: (done || active) ? '#fff' : '#6b7280',
              }}>{done ? '✓' : num}</div>
              <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: active ? '#1d4ed8' : done ? '#15803d' : '#6b7280', fontWeight: active ? 600 : 400 }}>{label}</div>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#16a34a' : '#e5e7eb', marginBottom: '1rem' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CreateFarmerModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    fullName: '', phone: '', region: '', district: '', village: '',
    countryCode: 'KE', primaryCrop: '', farmSizeAcres: '', yearsExperience: '',
    nationalId: '', preferredLanguage: 'en',
    accessMode: 'invite_link', // 'invite_link' | 'create_now'
    email: '', password: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Step 1 validation
  const step1Valid = form.fullName.trim() && form.phone.trim() && form.region.trim();
  // Step 2 validation
  const step2Valid = form.accessMode === 'invite_link' ||
    (form.email.trim() && form.password.length >= 8);

  const handleSubmit = async () => {
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
        nationalId: form.nationalId || undefined,
        primaryCrop: form.primaryCrop || undefined,
        farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : undefined,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined,
        preferredLanguage: form.preferredLanguage,
        email: form.accessMode === 'create_now' ? form.email : undefined,
        password: form.accessMode === 'create_now' ? form.password : undefined,
      };
      const res = await api.post('/farmers', payload);
      setSuccess({
        farmerName: form.fullName,
        credentialsCreated: res.data.credentialsCreated,
        inviteToken: res.data.inviteToken,
        inviteExpiresAt: res.data.inviteExpiresAt,
        deliveryNote: res.data.deliveryNote,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create farmer');
    } finally { setSaving(false); }
  };

  // ── Success screen ────────────────────────────────────────
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
              <strong>{success.credentialsCreated ? 'Login Account Created' : 'Invite Link Generated'}</strong>
              {success.deliveryNote && <p style={{ margin: '0.5rem 0 0' }}>{success.deliveryNote}</p>}
            </div>
            {inviteUrl && (
              <InviteLinkBox url={inviteUrl} label="Share this link with the farmer to activate their account:" expiresAt={success.inviteExpiresAt} />
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
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">New Farmer <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <div className="modal-body">
          <StepIndicator step={step} />
          {error && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}

          {/* ── Step 1: Farmer Info ── */}
          {step === 1 && (
            <div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" required value={form.fullName} onChange={set('fullName')} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <CountrySelect className="form-select" searchClassName="form-input" value={form.countryCode} onChange={set('countryCode')} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone *</label>
                  <PhoneInput className="form-input" value={form.phone} onChange={set('phone')} countryCode={form.countryCode} required />
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
                  <label className="form-label">National ID</label>
                  <input className="form-input" value={form.nationalId} onChange={set('nationalId')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Preferred Language</label>
                  <select className="form-select" value={form.preferredLanguage} onChange={set('preferredLanguage')}>
                    <option value="en">English</option>
                    <option value="sw">Swahili</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Primary Crop</label>
                  <input className="form-input" value={form.primaryCrop} onChange={set('primaryCrop')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Farm Size ({form.countryCode === 'TZ' ? 'ha' : 'acres'})</label>
                  <input className="form-input" type="number" step="0.1" value={form.farmSizeAcres} onChange={set('farmSizeAcres')} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Years of Experience</label>
                <input className="form-input" type="number" min="0" value={form.yearsExperience} onChange={set('yearsExperience')} />
              </div>
            </div>
          )}

          {/* ── Step 2: Account Access ── */}
          {step === 2 && (
            <div>
              <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '1rem' }}>
                How will <strong>{form.fullName}</strong> get access to AgriPilot?
              </p>
              <div
                onClick={() => setVal('accessMode', 'invite_link')}
                style={{
                  border: `2px solid ${form.accessMode === 'invite_link' ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 8, padding: '0.875rem', marginBottom: '0.75rem', cursor: 'pointer',
                  background: form.accessMode === 'invite_link' ? '#eff6ff' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <input type="radio" readOnly checked={form.accessMode === 'invite_link'} />
                  <strong style={{ fontSize: '0.9rem' }}>Generate Invite Link</strong>
                  <span className="badge badge-link-generated" style={{ marginLeft: 'auto' }}>Recommended</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', paddingLeft: '1.4rem' }}>
                  A secure link is generated. Share it via WhatsApp, SMS, or email — the farmer sets their own email and password.
                </p>
              </div>
              <div
                onClick={() => setVal('accessMode', 'create_now')}
                style={{
                  border: `2px solid ${form.accessMode === 'create_now' ? '#2563eb' : '#e5e7eb'}`,
                  borderRadius: 8, padding: '0.875rem', cursor: 'pointer',
                  background: form.accessMode === 'create_now' ? '#eff6ff' : '#fff',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <input type="radio" readOnly checked={form.accessMode === 'create_now'} />
                  <strong style={{ fontSize: '0.9rem' }}>Create Login Now</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280', paddingLeft: '1.4rem' }}>
                  Set an email and temporary password for the farmer. They can change it after first login.
                </p>
                {form.accessMode === 'create_now' && (
                  <div className="form-row" style={{ marginTop: '0.75rem', paddingLeft: '1.4rem' }} onClick={e => e.stopPropagation()}>
                    <div className="form-group">
                      <label className="form-label">Email *</label>
                      <input className="form-input" type="email" value={form.email} onChange={set('email')} autoFocus />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Temporary Password *</label>
                      <input className="form-input" type="password" minLength={8} value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <div>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#374151' }}>Farmer Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem' }}>
                  {[['Name', form.fullName], ['Phone', form.phone], ['Region', form.region], ['Country', form.countryCode],
                    form.district && ['District', form.district], form.village && ['Village', form.village],
                    form.nationalId && ['National ID', form.nationalId], form.primaryCrop && ['Crop', form.primaryCrop],
                    form.farmSizeAcres && ['Farm Size', `${form.farmSizeAcres} ${form.countryCode === 'TZ' ? 'ha' : 'ac'}`],
                    form.yearsExperience && ['Experience', `${form.yearsExperience} yrs`],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: '0.35rem' }}>
                      <span style={{ color: '#6b7280', minWidth: 80 }}>{k}:</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: form.accessMode === 'invite_link' ? '#eff6ff' : '#f0fdf4', border: `1px solid ${form.accessMode === 'invite_link' ? '#bfdbfe' : '#bbf7d0'}`, borderRadius: 8, padding: '0.875rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: form.accessMode === 'invite_link' ? '#1e40af' : '#065f46' }}>
                  {form.accessMode === 'invite_link' ? 'Invite Link will be generated' : 'Login Account will be created'}
                </div>
                <p style={{ margin: 0, color: '#374151' }}>
                  {form.accessMode === 'invite_link'
                    ? 'A secure invite link will be ready to share after creation.'
                    : `Login email: ${form.email}`}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && <button type="button" className="btn btn-outline" onClick={() => { setError(''); setStep(s => s - 1); }}>Back</button>}
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ marginLeft: step === 1 ? 0 : 'auto' }}>Cancel</button>
          {step < 3 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={step === 1 ? !step1Valid : !step2Valid}
              onClick={() => setStep(s => s + 1)}
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSubmit}>
              {saving ? 'Creating...' : 'Create Farmer'}
            </button>
          )}
        </div>
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
