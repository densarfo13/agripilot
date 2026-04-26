import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';
import { CREATOR_ROLES } from '../utils/roles.js';
import CountrySelect from '../components/CountrySelect.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import { AccessBadge, InviteBadge } from '../components/InviteAccessBadge.jsx';
import { FarmerAvatarSmall } from '../components/FarmerAvatar.jsx';
import ProgressScoreChip from '../components/farmer/ProgressScoreChip.jsx';
import CropSelect from '../components/CropSelect.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import { UNIT_OPTIONS, computeLandSizeFields, formatLandSize } from '../utils/landSize.js';
import { useDraft } from '../utils/useDraft.js';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'disabled', label: 'Disabled' },
];

// Operational quick-filters — computed client-side from loaded farmers
function computeQuickFilterCounts(allFarmers, currentUserId) {
  let noOfficer = 0, invitePending = 0, noApps = 0, needsAttention = 0, noData = 0, myFarmers = 0;
  for (const f of allFarmers) {
    if (f.registrationStatus === 'approved' && !f.assignedOfficerId) noOfficer++;
    if (!f.selfRegistered && f.inviteStatus && f.inviteStatus !== 'ACCEPTED' && f.inviteStatus !== 'NOT_SENT') invitePending++;
    if (f.registrationStatus === 'approved' && (!f._count?.applications || f._count.applications === 0)) noApps++;
    const isExpired = f.inviteStatus === 'EXPIRED';
    const isCancelled = f.inviteStatus === 'CANCELLED';
    const isStuck = f.registrationStatus === 'approved' && !f.userAccount && (isExpired || isCancelled || f.inviteStatus === 'NOT_SENT');
    if (isExpired || isCancelled || isStuck || (f.registrationStatus === 'approved' && !f.assignedOfficerId)) needsAttention++;
    if (f.registrationStatus === 'approved' && f.userAccount && (!f._count?.applications || f._count.applications === 0)) noData++;
    if (currentUserId && f.assignedOfficerId === currentUserId) myFarmers++;
  }
  return { noOfficer, invitePending, noApps, needsAttention, noData, myFarmers };
}

export default function FarmersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [farmers, setFarmers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [quickFilter, setQuickFilter] = useState(searchParams.get('filter') || ''); // '', 'no_officer', 'invite_pending', 'no_apps', 'needs_attention'
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [quickCounts, setQuickCounts] = useState({ noOfficer: 0, invitePending: 0, noApps: 0 });
  const [batchResending, setBatchResending] = useState(false);
  const [batchResult, setBatchResult] = useState(null); // { refreshed, skipped }
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
      .then(r => {
        setFarmers(r.data.farmers);
        setTotal(r.data.total);
        setLoadError('');
        setQuickCounts(computeQuickFilterCounts(r.data.farmers, user?.sub));
      })
      .catch(() => setLoadError('Failed to load farmers list'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, selectedOrgId]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuickFilter('');
    load(1, search, statusFilter);
  };

  const handleStatusFilter = (value) => {
    setStatusFilter(value);
    setQuickFilter('');
    setPage(1);
    load(1, search, value);
  };

  const handleQuickFilter = (value) => {
    setQuickFilter(qf => qf === value ? '' : value);
  };

  // Apply client-side quick filter on top of server results
  const displayFarmers = quickFilter ? farmers.filter(f => {
    if (quickFilter === 'no_officer') return f.registrationStatus === 'approved' && !f.assignedOfficerId;
    if (quickFilter === 'invite_pending') return !f.selfRegistered && f.inviteStatus && f.inviteStatus !== 'ACCEPTED' && f.inviteStatus !== 'NOT_SENT';
    if (quickFilter === 'no_apps') return f.registrationStatus === 'approved' && (!f._count?.applications || f._count.applications === 0);
    if (quickFilter === 'needs_attention') {
      const isExpired = f.inviteStatus === 'EXPIRED';
      const isCancelled = f.inviteStatus === 'CANCELLED';
      const isStuck = f.registrationStatus === 'approved' && !f.userAccount && (isExpired || isCancelled || f.inviteStatus === 'NOT_SENT');
      return isExpired || isCancelled || isStuck || (f.registrationStatus === 'approved' && !f.assignedOfficerId);
    }
    if (quickFilter === 'no_data') return f.registrationStatus === 'approved' && f.userAccount && (!f._count?.applications || f._count.applications === 0);
    if (quickFilter === 'my_farmers') return f.assignedOfficerId === user?.sub;
    return true;
  }) : farmers;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Farmers ({total})</h1>
          {!isSuperAdmin && user?.organization?.name && (
            <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>{user.organization.name}</div>
          )}
        </div>
        <div className="flex gap-1">
          <form onSubmit={handleSearch} className="flex gap-1">
            <input
              className="form-input"
              style={{ width: 240 }}
              placeholder="Search name, phone, or farmer ID…"
              aria-label="Search farmers"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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
                padding: '0.45rem 0.9rem', borderRadius: 20, fontSize: '0.82rem', cursor: 'pointer',
                minHeight: '44px',
                border: statusFilter === f.value ? '1.5px solid #22C55E' : '1.5px solid #243041',
                background: statusFilter === f.value ? 'rgba(34,197,94,0.15)' : '#162033',
                color: statusFilter === f.value ? '#22C55E' : '#A1A1AA',
                fontWeight: statusFilter === f.value ? 600 : 400,
              }}
            >{f.label}</button>
          ))}
        </div>

        {/* Operational quick-filters — highlight common action items */}
        {!loading && farmers.length > 0 && (quickCounts.myFarmers > 0 || quickCounts.noOfficer > 0 || quickCounts.invitePending > 0 || quickCounts.noApps > 0) && (
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: '#71717A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginRight: '0.25rem' }}>Quick filters:</span>
            {user?.role === 'field_officer' && quickCounts.myFarmers > 0 && (
              <button
                onClick={() => handleQuickFilter('my_farmers')}
                style={{
                  padding: '0.25rem 0.7rem', borderRadius: 16, fontSize: '0.78rem', cursor: 'pointer',
                  border: quickFilter === 'my_farmers' ? '1.5px solid #22C55E' : '1.5px solid #243041',
                  background: quickFilter === 'my_farmers' ? 'rgba(34,197,94,0.15)' : '#162033',
                  color: quickFilter === 'my_farmers' ? '#22C55E' : '#A1A1AA',
                  fontWeight: quickFilter === 'my_farmers' ? 600 : 400,
                }}
              >My Farmers ({quickCounts.myFarmers})</button>
            )}
            {quickCounts.noOfficer > 0 && (
              <button
                onClick={() => handleQuickFilter('no_officer')}
                style={{
                  padding: '0.25rem 0.7rem', borderRadius: 16, fontSize: '0.78rem', cursor: 'pointer',
                  border: quickFilter === 'no_officer' ? '1.5px solid #F59E0B' : '1.5px solid #243041',
                  background: quickFilter === 'no_officer' ? 'rgba(245,158,11,0.15)' : '#162033',
                  color: quickFilter === 'no_officer' ? '#F59E0B' : '#A1A1AA',
                  fontWeight: quickFilter === 'no_officer' ? 600 : 400,
                }}
              >No Officer ({quickCounts.noOfficer})</button>
            )}
            {quickCounts.invitePending > 0 && (
              <button
                onClick={() => handleQuickFilter('invite_pending')}
                style={{
                  padding: '0.25rem 0.7rem', borderRadius: 16, fontSize: '0.78rem', cursor: 'pointer',
                  border: quickFilter === 'invite_pending' ? '1.5px solid #F59E0B' : '1.5px solid #243041',
                  background: quickFilter === 'invite_pending' ? 'rgba(245,158,11,0.15)' : '#162033',
                  color: quickFilter === 'invite_pending' ? '#F59E0B' : '#A1A1AA',
                  fontWeight: quickFilter === 'invite_pending' ? 600 : 400,
                }}
              >Invite Pending ({quickCounts.invitePending})</button>
            )}
            {quickCounts.noApps > 0 && (
              <button
                onClick={() => handleQuickFilter('no_apps')}
                style={{
                  padding: '0.25rem 0.7rem', borderRadius: 16, fontSize: '0.78rem', cursor: 'pointer',
                  border: quickFilter === 'no_apps' ? '1.5px solid #0891B2' : '1.5px solid #243041',
                  background: quickFilter === 'no_apps' ? 'rgba(8,145,178,0.15)' : '#162033',
                  color: quickFilter === 'no_apps' ? '#0891B2' : '#A1A1AA',
                  fontWeight: quickFilter === 'no_apps' ? 600 : 400,
                }}
              >No Applications ({quickCounts.noApps})</button>
            )}
            {quickCounts.needsAttention > 0 && (
              <button
                onClick={() => handleQuickFilter('needs_attention')}
                style={{
                  padding: '0.25rem 0.7rem', borderRadius: 16, fontSize: '0.78rem', cursor: 'pointer',
                  border: quickFilter === 'needs_attention' ? '1.5px solid #EF4444' : '1.5px solid #243041',
                  background: quickFilter === 'needs_attention' ? 'rgba(239,68,68,0.15)' : '#162033',
                  color: quickFilter === 'needs_attention' ? '#EF4444' : '#A1A1AA',
                  fontWeight: quickFilter === 'needs_attention' ? 600 : 400,
                }}
              >Needs Attention ({quickCounts.needsAttention})</button>
            )}
            {quickCounts.noData > 0 && (
              <button
                onClick={() => handleQuickFilter('no_data')}
                style={{
                  padding: '0.25rem 0.7rem', borderRadius: 16, fontSize: '0.78rem', cursor: 'pointer',
                  border: quickFilter === 'no_data' ? '1.5px solid #71717A' : '1.5px solid #243041',
                  background: quickFilter === 'no_data' ? 'rgba(113,113,122,0.15)' : '#162033',
                  color: quickFilter === 'no_data' ? '#A1A1AA' : '#71717A',
                  fontWeight: quickFilter === 'no_data' ? 600 : 400,
                }}
              >No Data Yet ({quickCounts.noData})</button>
            )}
            {quickFilter && (
              <button
                onClick={() => setQuickFilter('')}
                style={{ padding: '0.2rem 0.5rem', borderRadius: 12, fontSize: '0.72rem', cursor: 'pointer', border: '1px solid #374151', background: '#1E293B', color: '#A1A1AA' }}
              >Clear</button>
            )}
          </div>
        )}

        {/* Batch resend — visible when invite_pending filter is active */}
        {quickFilter === 'invite_pending' && displayFarmers.length > 0 && canCreate && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem',
            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: 8, padding: '0.6rem 1rem',
          }}>
            <span style={{ fontSize: '0.82rem', color: '#F59E0B', flex: 1 }}>
              {displayFarmers.length} farmer{displayFarmers.length !== 1 ? 's' : ''} with pending invites
            </span>
            {batchResult && (
              <span style={{ fontSize: '0.78rem', color: '#22C55E' }}>
                {batchResult.refreshed} refreshed{batchResult.skipped > 0 ? `, ${batchResult.skipped} rate-limited` : ''}
              </span>
            )}
            <button
              className="btn btn-outline btn-sm"
              disabled={batchResending}
              onClick={async () => {
                setBatchResending(true);
                setBatchResult(null);
                try {
                  const ids = displayFarmers.map(f => f.id);
                  const r = await api.post('/farmers/batch-resend-invites', { farmerIds: ids });
                  setBatchResult(r.data);
                  load(); // refresh list
                } catch { setBatchResult({ refreshed: 0, skipped: 0, error: true }); }
                setBatchResending(false);
              }}
              style={{ color: '#F59E0B', borderColor: '#F59E0B', whiteSpace: 'nowrap' }}
            >
              {batchResending ? 'Resending...' : 'Resend All Invites'}
            </button>
          </div>
        )}

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
                      <th>Score</th>
                      <th>Applications</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayFarmers.map(f => (
                      <tr key={f.id} onClick={() => navigate(`/farmers/${f.id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FarmerAvatarSmall fullName={f.fullName} profileImageUrl={f.profileImageUrl} />
                            <span>{f.fullName}</span>
                          </div>
                        </td>
                        <td>{f.phone}</td>
                        <td>{f.region}</td>
                        <td><AccessBadge value={f.accessStatus} /></td>
                        <td>{!f.selfRegistered ? <InviteBadge value={f.inviteStatus} /> : <span className="text-sm text-muted">—</span>}</td>
                        {isSuperAdmin && <td className="text-sm text-muted">{f.organization?.name || '-'}</td>}
                        <td>{f.primaryCrop ? getCropLabelSafe(f.primaryCrop) : '-'}</td>
                        <td>{f.landSizeValue ? formatLandSize(f.landSizeValue, f.landSizeUnit) : f.farmSizeAcres ? `${f.farmSizeAcres} ${f.countryCode === 'TZ' ? 'ha' : 'ac'}` : '-'}</td>
                        <td>
                          {/* Progress score chip — pure-function compute on
                              whatever signals the farmer payload exposes.
                              Missing inputs are gracefully treated as 0
                              (the chip surfaces "data incomplete" via its
                              own tooltip). Server-side aggregation would
                              be the next step; for now this compiles a
                              live signal from existing fields. */}
                          <ProgressScoreChip
                            taskCompletionRate={f.taskCompletionRate}
                            cropHealthScore={f.cropHealthScore}
                            consistencyScore={f.consistencyScore}
                            weatherAdaptationScore={f.weatherAdaptationScore}
                          />
                        </td>
                        <td>{f._count?.applications || 0}</td>
                        <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          {f.inviteStatus === 'LINK_GENERATED' && <RowCopyLinkButton farmerId={f.id} />}
                          {(f.inviteStatus === 'EXPIRED' || f.inviteStatus === 'NOT_SENT' || f.inviteStatus === 'CANCELLED') && f.registrationStatus === 'approved' && !f.userAccount && (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ fontSize: '0.72rem', padding: '0.3rem 0.6rem' }}
                              onClick={() => navigate(`/farmers/${f.id}`)}
                              title="Resend invite or create login"
                            >Recover</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {displayFarmers.length === 0 && !quickFilter && (
                      <tr><td colSpan={isSuperAdmin ? 10 : 9}>
                        <EmptyState
                          icon="👨‍🌾"
                          title={search || statusFilter ? 'No farmers match your search' : 'No farmers yet'}
                          message={search || statusFilter
                            ? 'Try broadening your search terms or changing the status filter.'
                            : 'Start by inviting farmers or importing them from a CSV file.'}
                          action={search || statusFilter
                            ? { label: 'Clear Search', onClick: () => { setSearch(''); setStatusFilter(''); load(1, '', ''); } }
                            : canCreate ? { label: 'Invite Farmer', onClick: () => setShowInvite(true) } : undefined}
                          compact
                        />
                      </td></tr>
                    )}
                    {displayFarmers.length === 0 && quickFilter && (
                      <tr><td colSpan={isSuperAdmin ? 10 : 9}>
                        <EmptyState
                          icon="🔍"
                          title="No farmers match this filter"
                          message="Try a different filter or clear to see all farmers."
                          action={{ label: 'Clear Filter', onClick: () => setQuickFilter('') }}
                          compact
                        />
                      </td></tr>
                    )}
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
    <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.75rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#22C55E', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: expiresAt ? '0.35rem' : 0 }}>
        <input
          readOnly
          value={url}
          onClick={e => e.target.select()}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', padding: '0.35rem 0.5rem', border: '1px solid #243041', borderRadius: 4, background: '#0F172A', color: '#FFFFFF', cursor: 'text' }}
        />
        <button
          type="button"
          onClick={copy}
          className="btn btn-outline btn-sm"
          style={{ whiteSpace: 'nowrap', color: copied ? '#22C55E' : undefined, borderColor: copied ? '#22C55E' : undefined }}
        >
          {copied ? '✓ Copied' : 'Copy Link'}
        </button>
      </div>
      {expiresAt && (
        <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>
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
      style={{ fontSize: '0.75rem', color: state === 'copied' ? '#22C55E' : state === 'error' ? '#EF4444' : '#22C55E', borderColor: state === 'copied' ? '#22C55E' : state === 'error' ? '#EF4444' : undefined }}
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
                background: done ? '#22C55E' : active ? '#22C55E' : '#243041',
                color: (done || active) ? '#fff' : '#A1A1AA',
              }}>{done ? '✓' : num}</div>
              <div style={{ fontSize: '0.7rem', marginTop: '0.2rem', color: active ? '#22C55E' : done ? '#22C55E' : '#A1A1AA', fontWeight: active ? 600 : 400 }}>{label}</div>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#22C55E' : '#243041', marginBottom: '1rem' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CreateFarmerModal({ onClose, onCreated }) {
  const submitGuardRef = useRef(false);
  const [step, setStep] = useState(1);
  const CREATE_FARMER_INITIAL = {
    fullName: '', phone: '', region: '', district: '', village: '',
    countryCode: 'KE', primaryCrop: '', farmSizeAcres: '', landSizeUnit: 'ACRE', yearsExperience: '',
    nationalId: '', preferredLanguage: 'en',
    accessMode: 'invite_link', // 'record_only' | 'invite_link' | 'create_now'
    channel: 'link',           // 'link' | 'email' | 'phone'
    contactEmail: '',          // for email channel delivery (not the future login email)
    email: '', password: '',
  };
  const { state: form, setState: setForm, clearDraft: clearCreateDraft, draftRestored: createDraftRestored } = useDraft('create-farmer', CREATE_FARMER_INITIAL);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null); // { duplicates: [...] }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Step 1 validation
  const step1Valid = form.fullName.trim() && form.phone.trim() && form.region.trim();
  // Step 2 validation
  const step2Valid = form.accessMode === 'record_only'
    ? true
    : form.accessMode === 'create_now'
    ? (form.email.trim() && form.password.length >= 8)
    : form.channel !== 'email' || form.contactEmail.trim();

  const handleSubmit = async () => {
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setSaving(true);
    setError('');
    try {
      const ls = form.farmSizeAcres ? computeLandSizeFields(form.farmSizeAcres, form.landSizeUnit) : {};
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
        landSizeValue: ls.landSizeValue ?? undefined,
        landSizeUnit: ls.landSizeUnit ?? undefined,
        yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined,
        preferredLanguage: form.preferredLanguage,
        email: form.accessMode === 'create_now' ? form.email : undefined,
        password: form.accessMode === 'create_now' ? form.password : undefined,
        channel: form.accessMode === 'invite_link' ? form.channel : undefined,
        contactEmail: form.accessMode === 'invite_link' && form.channel === 'email' ? form.contactEmail : undefined,
        recordOnly: form.accessMode === 'record_only' ? true : undefined,
      };
      const res = await api.post('/farmers', { ...payload, confirmDuplicate: duplicateWarning ? true : undefined });
      setDuplicateWarning(null);
      clearCreateDraft();
      setSuccess({
        farmerName: form.fullName,
        credentialsCreated: res.data.credentialsCreated,
        inviteToken: res.data.inviteToken,
        inviteExpiresAt: res.data.inviteExpiresAt,
        deliveryStatus: res.data.deliveryStatus,
        deliveryChannel: res.data.deliveryChannel,
        deliveryNote: res.data.deliveryNote,
      });
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.requiresConfirmation) {
        setDuplicateWarning({ duplicates: err.response.data.duplicates || [] });
        setError(err.response.data.error);
      } else {
        setDuplicateWarning(null);
        // Translate common backend failure shapes into clear, calm
        // English instead of leaking the raw error payload.
        const s = err.response?.status;
        const serverMsg = err.response?.data?.error;
        let msg = 'We could not create this farmer. Please try again.';
        if (s === 400 && typeof serverMsg === 'string' && serverMsg.length < 160) {
          msg = serverMsg;   // 400 messages are usually already safe
        } else if (s === 401 || s === 403) {
          msg = 'You do not have permission to create farmers in this program.';
        } else if (s === 409) {
          msg = 'A farmer with these details already exists.';
        } else if (s >= 500) {
          msg = 'The server had a problem. Please try again in a moment.';
        } else if (String(err.message || '').toLowerCase().includes('network')) {
          msg = 'We could not reach the server. Check your connection and try again.';
        }
        setError(msg);
      }
    } finally { setSaving(false); submitGuardRef.current = false; }
  };

  // ── Success screen ────────────────────────────────────────
  if (success) {
    const inviteUrl = success.inviteToken ? `${window.location.origin}/accept-invite?token=${success.inviteToken}` : null;
    const delivered = success.deliveryStatus === 'email_sent' || success.deliveryStatus === 'phone_sent';
    return (
      <div className="modal-overlay" onClick={() => onCreated()}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">Farmer Created <button className="btn btn-outline btn-sm" onClick={() => onCreated()}>X</button></div>
          <div className="modal-body">
            <div className="alert-inline alert-inline-success" style={{ padding: '1rem', borderRadius: 8 }}>
              <strong>{success.farmerName}</strong> has been added to Farroway.
            </div>
            <div style={{
              background: success.credentialsCreated ? 'rgba(34,197,94,0.15)' : delivered ? 'rgba(34,197,94,0.15)' : '#1E293B',
              color: success.credentialsCreated ? '#22C55E' : delivered ? '#22C55E' : '#F59E0B',
              padding: '0.75rem', borderRadius: 6, fontSize: '0.85rem', marginBottom: inviteUrl ? '0.75rem' : 0,
            }}>
              <strong>
                {success.credentialsCreated ? 'Login Account Created'
                  : delivered ? (success.deliveryChannel === 'email' ? 'Invite Email Sent' : 'Invite SMS Sent')
                  : 'Invite Link Generated'}
              </strong>
              {success.deliveryNote && <p style={{ margin: '0.5rem 0 0' }}>{success.deliveryNote}</p>}
              {!delivered && !success.credentialsCreated && inviteUrl && (
                <p style={{ margin: '0.5rem 0 0', fontWeight: 600 }}>⚠ You must copy and share this link manually with the farmer.</p>
              )}
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
          {createDraftRestored && !success && (
            <div className="alert-inline alert-inline-info" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
              Draft restored from your previous session. <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }} onClick={() => { clearCreateDraft(); setForm(CREATE_FARMER_INITIAL); setStep(1); }}>Discard draft</button>
            </div>
          )}
          {error && !duplicateWarning && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}

          {duplicateWarning && (
            <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ color: '#F59E0B', fontWeight: 600, marginBottom: '0.5rem' }}>Possible Duplicate Detected</div>
              <div style={{ color: '#A1A1AA', marginBottom: '0.5rem' }}>{error}</div>
              {duplicateWarning.duplicates.map(d => (
                <div key={d.id} style={{ background: '#1E293B', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.35rem', fontSize: '0.8rem', color: '#E2E8F0' }}>
                  {d.fullName} &middot; {d.phone} &middot; {d.region} &middot; <span style={{ color: '#71717A' }}>{d.status}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button className="btn btn-outline btn-sm" style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)' }} onClick={() => { handleSubmit(); }}>Create Anyway</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setDuplicateWarning(null); setError(''); }}>Cancel</button>
              </div>
            </div>
          )}

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
                  <CropSelect
                    value={form.primaryCrop}
                    onChange={(v) => setVal('primaryCrop', v)}
                    countryCode={form.countryCode}
                    placeholder="Select crop (optional)"
                    optional
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Farm Size</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="form-input" style={{ flex: 1 }} type="number" step="0.1" min="0" value={form.farmSizeAcres} onChange={set('farmSizeAcres')} />
                    <select className="form-input" style={{ width: 'auto', minWidth: '7rem' }} value={form.landSizeUnit} onChange={set('landSizeUnit')}>
                      {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
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
              <p style={{ fontSize: '0.875rem', color: '#FFFFFF', marginBottom: '1rem' }}>
                How will <strong>{form.fullName}</strong> get access to Farroway?
              </p>
              <div
                onClick={() => setVal('accessMode', 'record_only')}
                style={{
                  border: `2px solid ${form.accessMode === 'record_only' ? '#22C55E' : '#243041'}`,
                  borderRadius: 8, padding: '0.875rem', marginBottom: '0.75rem', cursor: 'pointer',
                  background: form.accessMode === 'record_only' ? 'rgba(34,197,94,0.15)' : '#162033',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <input type="radio" readOnly checked={form.accessMode === 'record_only'} />
                  <strong style={{ fontSize: '0.9rem' }}>Record Only</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#A1A1AA', paddingLeft: '1.4rem' }}>
                  Create a farmer profile for tracking — no login account. You can invite them later.
                </p>
              </div>
              <div
                onClick={() => setVal('accessMode', 'invite_link')}
                style={{
                  border: `2px solid ${form.accessMode === 'invite_link' ? '#22C55E' : '#243041'}`,
                  borderRadius: 8, padding: '0.875rem', marginBottom: '0.75rem', cursor: 'pointer',
                  background: form.accessMode === 'invite_link' ? 'rgba(34,197,94,0.15)' : '#162033',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <input type="radio" readOnly checked={form.accessMode === 'invite_link'} />
                  <strong style={{ fontSize: '0.9rem' }}>Generate Invite Link</strong>
                  <span className="badge badge-link-generated" style={{ marginLeft: 'auto' }}>Recommended</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#A1A1AA', paddingLeft: '1.4rem' }}>
                  A secure link is generated. Share it via WhatsApp, SMS, or email — the farmer sets their own email and password.
                </p>
                {form.accessMode === 'invite_link' && (
                  <div onClick={e => e.stopPropagation()} style={{ paddingLeft: '1.4rem', marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.4rem' }}>Delivery method</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {[
                        { value: 'link', label: 'Manual Share' },
                        { value: 'email', label: 'Send via Email' },
                        { value: 'phone', label: 'Send via SMS' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setVal('channel', opt.value)}
                          style={{
                            padding: '0.45rem 0.75rem', borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer',
                            minHeight: '44px',
                            border: `1.5px solid ${form.channel === opt.value ? '#22C55E' : '#243041'}`,
                            background: form.channel === opt.value ? '#22C55E' : '#162033',
                            color: form.channel === opt.value ? '#fff' : '#FFFFFF',
                            fontWeight: form.channel === opt.value ? 600 : 400,
                          }}
                        >{opt.label}</button>
                      ))}
                    </div>
                    {form.channel === 'email' && (
                      <div className="form-group" style={{ marginTop: '0.6rem' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Farmer's email address *</label>
                        <input
                          className="form-input"
                          type="email"
                          placeholder="farmer@example.com"
                          value={form.contactEmail}
                          onChange={set('contactEmail')}
                          style={{ fontSize: '0.85rem' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.2rem' }}>The invite link will be sent here via email.</div>
                      </div>
                    )}
                    {form.channel === 'phone' && (
                      <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.4rem' }}>
                        The invite link will be sent as an SMS to <strong>{form.phone || 'the phone number from Step 1'}</strong>.
                      </div>
                    )}
                    {form.channel === 'link' && (
                      <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.4rem' }}>
                        The invite link will be shown after creation — copy and share it manually.
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div
                onClick={() => setVal('accessMode', 'create_now')}
                style={{
                  border: `2px solid ${form.accessMode === 'create_now' ? '#22C55E' : '#243041'}`,
                  borderRadius: 8, padding: '0.875rem', cursor: 'pointer',
                  background: form.accessMode === 'create_now' ? 'rgba(34,197,94,0.15)' : '#162033',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <input type="radio" readOnly checked={form.accessMode === 'create_now'} />
                  <strong style={{ fontSize: '0.9rem' }}>Create Login Now</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#A1A1AA', paddingLeft: '1.4rem' }}>
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
              <div style={{ background: '#1E293B', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#FFFFFF' }}>Farmer Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem' }}>
                  {[['Name', form.fullName], ['Phone', form.phone], ['Region', form.region], ['Country', form.countryCode],
                    form.district && ['District', form.district], form.village && ['Village', form.village],
                    form.nationalId && ['National ID', form.nationalId], form.primaryCrop && ['Crop', getCropLabelSafe(form.primaryCrop)],
                    form.farmSizeAcres && ['Farm Size', formatLandSize(form.farmSizeAcres, form.landSizeUnit)],
                    form.yearsExperience && ['Experience', `${form.yearsExperience} yrs`],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', gap: '0.35rem' }}>
                      <span style={{ color: '#A1A1AA', minWidth: 80 }}>{k}:</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '0.875rem', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.25rem', color: '#22C55E' }}>
                  {form.accessMode === 'record_only' ? 'Record Only — No Login'
                    : form.accessMode === 'invite_link' ? 'Invite Link will be generated'
                    : 'Login Account will be created'}
                </div>
                <p style={{ margin: 0, color: '#FFFFFF' }}>
                  {form.accessMode === 'record_only'
                    ? 'Farmer profile will be created for tracking. You can invite them to log in later.'
                    : form.accessMode === 'invite_link'
                    ? form.channel === 'email'
                      ? `Invite link will be emailed to ${form.contactEmail}`
                      : form.channel === 'phone'
                        ? `Invite link will be sent via SMS to ${form.phone}`
                        : 'A secure invite link will be ready to share after creation.'
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
  const submitGuardRef = useRef(false);
  const INVITE_FARMER_INITIAL = {
    fullName: '', phone: '', email: '', password: '', region: '', district: '', village: '',
    countryCode: 'KE', primaryCrop: '', farmSizeAcres: '', landSizeUnit: 'ACRE', preferredLanguage: 'en',
    channel: 'link', contactEmail: '',
  };
  const { state: form, setState: setForm, clearDraft: clearInviteDraft, draftRestored: inviteDraftRestored } = useDraft('invite-farmer', INVITE_FARMER_INITIAL);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [success, setSuccess] = useState(null);
  const [inviteDupWarning, setInviteDupWarning] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setVal = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setSaving(true);
    setError('');
    try {
      const lsInv = form.farmSizeAcres ? computeLandSizeFields(form.farmSizeAcres, form.landSizeUnit) : {};
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        region: form.region,
        district: form.district || undefined,
        village: form.village || undefined,
        countryCode: form.countryCode,
        primaryCrop: form.primaryCrop || undefined,
        farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : undefined,
        landSizeValue: lsInv.landSizeValue ?? undefined,
        landSizeUnit: lsInv.landSizeUnit ?? undefined,
        preferredLanguage: form.preferredLanguage,
        channel: !createAccount ? form.channel : undefined,
        contactEmail: !createAccount && form.channel === 'email' ? form.contactEmail : undefined,
        confirmDuplicate: inviteDupWarning ? true : undefined,
      };
      if (createAccount && form.email && form.password) {
        payload.email = form.email;
        payload.password = form.password;
      }
      const res = await api.post('/farmers/invite', payload);
      setInviteDupWarning(null);
      clearInviteDraft();
      setSuccess({
        credentialsCreated: res.data.credentialsCreated,
        deliveryNote: res.data.deliveryNote,
        deliveryStatus: res.data.deliveryStatus,
        deliveryChannel: res.data.deliveryChannel,
        farmerName: form.fullName,
        inviteToken: res.data.inviteToken,
        inviteExpiresAt: res.data.inviteExpiresAt,
      });
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.requiresConfirmation) {
        setInviteDupWarning({ duplicates: err.response.data.duplicates || [] });
        setError(err.response.data.error);
      } else {
        setInviteDupWarning(null);
        setError(err.response?.data?.error || 'Failed to invite farmer');
      }
    } finally { setSaving(false); submitGuardRef.current = false; }
  };

  if (success) {
    const inviteUrl = success.inviteToken ? `${window.location.origin}/accept-invite?token=${success.inviteToken}` : null;
    const delivered = success.deliveryStatus === 'email_sent' || success.deliveryStatus === 'phone_sent';
    return (
      <div className="modal-overlay" onClick={() => { onCreated(); }}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">Farmer Invited <button className="btn btn-outline btn-sm" onClick={() => onCreated()}>X</button></div>
          <div className="modal-body">
            <div className="alert-inline alert-inline-success" style={{ padding: '1rem', borderRadius: 8 }}>
              <strong>{success.farmerName}</strong> has been successfully invited to Farroway.
            </div>
            <div style={{
              background: success.credentialsCreated ? 'rgba(34,197,94,0.15)' : delivered ? 'rgba(34,197,94,0.15)' : '#1E293B',
              color: success.credentialsCreated ? '#22C55E' : delivered ? '#22C55E' : '#F59E0B',
              padding: '0.75rem', borderRadius: 6, fontSize: '0.85rem', marginBottom: inviteUrl ? '0.75rem' : 0,
            }}>
              <strong>
                {success.credentialsCreated ? 'Login Account Created'
                  : delivered ? (success.deliveryChannel === 'email' ? 'Invite Email Sent' : 'Invite SMS Sent')
                  : 'No Login Account'}
              </strong>
              <p style={{ margin: '0.5rem 0 0' }}>{success.deliveryNote}</p>
              {!delivered && !success.credentialsCreated && inviteUrl && (
                <p style={{ margin: '0.5rem 0 0', fontWeight: 600, color: '#F59E0B' }}>⚠ You must copy and share this link manually with the farmer.</p>
              )}
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
            {inviteDraftRestored && !success && (
              <div className="alert-inline alert-inline-info" style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                Draft restored from your previous session. <button type="button" className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }} onClick={() => { clearInviteDraft(); setForm(INVITE_FARMER_INITIAL); }}>Discard draft</button>
              </div>
            )}
            {error && !inviteDupWarning && <div className="alert alert-danger">{error}</div>}
            {inviteDupWarning && (
              <div style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                <div style={{ color: '#F59E0B', fontWeight: 600, marginBottom: '0.5rem' }}>Possible Duplicate</div>
                <div style={{ color: '#A1A1AA', marginBottom: '0.5rem' }}>{error}</div>
                {inviteDupWarning.duplicates.map(d => (
                  <div key={d.id} style={{ background: '#1E293B', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '0.35rem', fontSize: '0.8rem', color: '#E2E8F0' }}>
                    {d.fullName} &middot; {d.phone} &middot; {d.region} &middot; <span style={{ color: '#71717A' }}>{d.status}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-outline btn-sm" style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.3)' }} onClick={() => handleSubmit()}>Invite Anyway</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { setInviteDupWarning(null); setError(''); }}>Cancel</button>
                </div>
              </div>
            )}
            <div className="alert-inline alert-inline-success" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
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
                <CropSelect
                  value={form.primaryCrop}
                  onChange={(v) => setVal('primaryCrop', v)}
                  countryCode={form.countryCode}
                  placeholder="Select crop (optional)"
                  optional
                />
              </div>
              <div className="form-group">
                <label className="form-label">Farm Size</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input className="form-input" style={{ flex: 1 }} type="number" step="0.1" min="0" value={form.farmSizeAcres} onChange={set('farmSizeAcres')} />
                  <select className="form-input" style={{ width: 'auto', minWidth: '7rem' }} value={form.landSizeUnit} onChange={set('landSizeUnit')}>
                    {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Language</label>
              <select className="form-select" value={form.preferredLanguage} onChange={set('preferredLanguage')}>
                <option value="en">English</option>
                <option value="sw">Swahili</option>
              </select>
            </div>

            {/* Invite delivery channel (shown when not creating an account) */}
            {!createAccount && (
              <div style={{ borderTop: '1px solid #243041', marginTop: '1rem', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '0.5rem' }}>Invite delivery</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {[
                    { value: 'link', label: 'Manual Share' },
                    { value: 'email', label: 'Send via Email' },
                    { value: 'phone', label: 'Send via SMS' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setVal('channel', opt.value)}
                      style={{
                        padding: '0.45rem 0.75rem', borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer',
                        minHeight: '44px',
                        border: `1.5px solid ${form.channel === opt.value ? '#22C55E' : '#243041'}`,
                        background: form.channel === opt.value ? '#22C55E' : '#162033',
                        color: form.channel === opt.value ? '#fff' : '#FFFFFF',
                        fontWeight: form.channel === opt.value ? 600 : 400,
                      }}
                    >{opt.label}</button>
                  ))}
                </div>
                {form.channel === 'email' && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Farmer's email address *</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="farmer@example.com"
                      value={form.contactEmail}
                      onChange={set('contactEmail')}
                      required
                    />
                    <div style={{ fontSize: '0.75rem', color: '#A1A1AA', marginTop: '0.2rem' }}>The invite link will be sent to this address.</div>
                  </div>
                )}
                {form.channel === 'phone' && form.phone && (
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>
                    Invite SMS will be sent to <strong>{form.phone}</strong>.
                  </div>
                )}
                {form.channel === 'link' && (
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>
                    Copy the link after inviting and share it manually.
                  </div>
                )}
              </div>
            )}

            {/* Optional: create login account */}
            <div style={{ borderTop: '1px solid #243041', marginTop: '1rem', paddingTop: '1rem' }}>
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
                <p style={{ fontSize: '0.8rem', color: '#A1A1AA', margin: '0.5rem 0 0' }}>
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
