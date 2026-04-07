import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { AccessBadge, InviteBadge } from '../components/InviteAccessBadge.jsx';
import { useAuthStore } from '../store/authStore.js';
import { ADMIN_ROLES, CREATOR_ROLES } from '../utils/roles.js';
import { getCountryName } from '../utils/countries.js';

const STATUS_COLORS = {
  pending_approval: { bg: '#fef3c7', color: '#92400e', label: 'Pending Approval' },
  approved: { bg: '#d1fae5', color: '#065f46', label: 'Active' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
  disabled: { bg: '#f3f4f6', color: '#6b7280', label: 'Disabled' },
};

export default function FarmerDetailPage() {
  const { id } = useParams();
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const isCreator = CREATOR_ROLES.includes(user?.role);

  const load = () => {
    setLoading(true);
    setLoadError('');
    api.get(`/farmers/${id}`)
      .then(r => setFarmer(r.data))
      .catch(() => setLoadError('Failed to load farmer'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="loading">Loading farmer...</div>;
  if (loadError) return (
    <div className="page-body">
      <div className="alert alert-danger">{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={load}>Retry</button></div>
    </div>
  );
  if (!farmer) return null;

  return (
    <>
      <div className="page-header">
        <h1>{farmer.fullName}</h1>
        <div className="flex gap-1">
          <button className="btn btn-primary" onClick={() => navigate(`/farmer-home/${id}`)}>Farmer Home</button>
          {farmer.registrationStatus === 'approved' && (
            <button className="btn btn-outline" onClick={() => navigate(`/farmer-home/${id}/progress`)}>
              View Progress
            </button>
          )}
          <button className="btn btn-outline" onClick={() => navigate('/farmers')}>Back</button>
        </div>
      </div>
      <div className="page-body">
        {/* Access & Assignment Section */}
        {(isAdmin || isCreator) && (
          <AccessAssignmentSection farmer={farmer} isAdmin={isAdmin} isCreator={isCreator} onUpdate={load} />
        )}

        {/* Performance Profile Section — visible to staff & investor_viewer */}
        <PerformanceProfileSection farmerId={farmer.id} />

        <div className="detail-grid">
          <div className="card">
            <div className="card-header">Farmer Information</div>
            <div className="card-body">
              <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{farmer.phone}</span></div>
              <div className="detail-row"><span className="detail-label">National ID</span><span className="detail-value">{farmer.nationalId || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Region</span><span className="detail-value">{farmer.region}</span></div>
              <div className="detail-row"><span className="detail-label">District</span><span className="detail-value">{farmer.district || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Village</span><span className="detail-value">{farmer.village || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Country</span><span className="detail-value">{getCountryName(farmer.countryCode)}</span></div>
              <div className="detail-row"><span className="detail-label">Primary Crop</span><span className="detail-value">{farmer.primaryCrop || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Farm Size</span><span className="detail-value">{farmer.farmSizeAcres ? `${farmer.farmSizeAcres} ${farmer.countryCode === 'TZ' ? 'hectares' : 'acres'}` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Experience</span><span className="detail-value">{farmer.yearsExperience ? `${farmer.yearsExperience} years` : '-'}</span></div>
              {farmer.organization && (
                <div className="detail-row"><span className="detail-label">Organization</span><span className="detail-value">{farmer.organization.name} <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>({farmer.organization.type.replace(/_/g, ' ')})</span></span></div>
              )}
              <div className="detail-row"><span className="detail-label">Created By</span><span className="detail-value">{farmer.createdBy?.fullName}</span></div>
              <div className="detail-row"><span className="detail-label">Created At</span><span className="detail-value">{new Date(farmer.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              Applications ({farmer.applications?.length || 0})
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/applications/new?farmerId=${farmer.id}`)}>+ New Application</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr><th>Crop</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {farmer.applications?.map(app => (
                    <tr key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{app.cropType}</td>
                      <td>{app.currencyCode || 'KES'} {app.requestedAmount?.toLocaleString()}</td>
                      <td><StatusBadge value={app.status} /></td>
                      <td className="text-sm text-muted">{new Date(app.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!farmer.applications || farmer.applications.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>No applications yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Access & Assignment Section ────────────────────────

function AccessAssignmentSection({ farmer, isAdmin, isCreator, onUpdate }) {
  const [officers, setOfficers] = useState([]);
  const [inviteStatus, setInviteStatus] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [resendInviteToken, setResendInviteToken] = useState(null);
  const [resendInviteExpiry, setResendInviteExpiry] = useState(null);
  const [showCreateLoginModal, setShowCreateLoginModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then(r => {
        setOfficers(r.data.filter(u => u.role === 'field_officer' && u.active));
      }).catch(() => {});
    }
  }, [isAdmin]);

  // Fetch invite/activation status for invited farmers
  useEffect(() => {
    if (!farmer.selfRegistered) {
      api.get(`/farmers/${farmer.id}/invite-status`)
        .then(r => setInviteStatus(r.data))
        .catch(() => {}); // non-critical — degrades gracefully
    }
  }, [farmer.id, farmer.selfRegistered]);

  const clearMessages = () => { setActionError(''); setActionSuccess(''); };

  const doAction = async (fn) => {
    clearMessages();
    setProcessing(true);
    try {
      await fn();
      onUpdate();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  // handleDisable is now SoD-protected — opens DisableFarmerModal instead of calling API directly

  const handleReactivate = () => doAction(async () => {
    await api.patch(`/farmers/${farmer.id}/access-status`, { status: 'approved' });
    setActionSuccess('Farmer access reactivated');
  });

  const handleReopenPending = () => doAction(async () => {
    await api.patch(`/farmers/${farmer.id}/access-status`, { status: 'pending_approval' });
    setActionSuccess('Registration reopened for review');
  });

  const handleResendInvite = () => doAction(async () => {
    const res = await api.post(`/farmers/${farmer.id}/resend-invite`);
    setResendInviteToken(res.data.inviteToken || null);
    setResendInviteExpiry(res.data.inviteExpiresAt || null);
    setActionSuccess('Invite resent. Copy the new link below and share it with the farmer.');
  });

  const status = farmer.registrationStatus;
  const sc = STATUS_COLORS[status] || STATUS_COLORS.pending_approval;

  // Find assigned officer name
  const assignedOfficerName = officers.find(o => o.id === farmer.assignedOfficerId)?.fullName;

  // Determine primary action
  let primaryAction = null;
  if (isAdmin) {
    if (status === 'pending_approval') {
      primaryAction = { label: 'Approve', onClick: () => setShowApproveModal(true), className: 'btn-success' };
    } else if (status === 'approved' && !farmer.assignedOfficerId) {
      primaryAction = { label: 'Assign Field Officer', onClick: () => setShowAssignModal(true), className: 'btn-primary' };
    } else if (status === 'disabled') {
      primaryAction = { label: 'Reactivate', onClick: () => setShowReactivateConfirm(true), className: 'btn-success' };
    } else if (status === 'rejected') {
      primaryAction = { label: 'Reopen for Review', onClick: handleReopenPending, className: 'btn-primary' };
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header">Access & Assignment</div>
      <div className="card-body">
        {actionError && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{actionError}</div>}
        {actionSuccess && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: '0.875rem', marginBottom: resendInviteToken ? '0.5rem' : 0 }}>{actionSuccess}</div>
            {resendInviteToken && (
              <ResendInviteLinkBox url={`${window.location.origin}/accept-invite?token=${resendInviteToken}`} expiresAt={resendInviteExpiry} />
            )}
          </div>
        )}

        {/* Status badges row */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <AccessBadge value={farmer.accessStatus} />
          {!farmer.selfRegistered && <InviteBadge value={inviteStatus?.inviteStatus || farmer.inviteStatus} />}
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, background: '#ede9fe', color: '#5b21b6' }}>
            {farmer.selfRegistered ? 'Self-Registered' : 'Invited'}
          </span>
        </div>

        {/* Metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.875rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
            <span style={{ color: '#6b7280' }}>Assigned Officer</span>
            <span style={{ fontWeight: 500 }}>{assignedOfficerName || farmer.assignedOfficerId ? (assignedOfficerName || 'Assigned') : 'Unassigned'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
            <span style={{ color: '#6b7280' }}>Login Email</span>
            <span style={{ fontWeight: 500 }}>{farmer.userAccount?.email || 'None'}</span>
          </div>
          {farmer.invitedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
              <span style={{ color: '#6b7280' }}>Invited</span>
              <span>{new Date(farmer.invitedAt).toLocaleDateString()}</span>
            </div>
          )}
          {farmer.approvedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
              <span style={{ color: '#6b7280' }}>Approved</span>
              <span>{new Date(farmer.approvedAt).toLocaleDateString()}</span>
            </div>
          )}
          {farmer.rejectedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
              <span style={{ color: '#6b7280' }}>Rejected</span>
              <span>{new Date(farmer.rejectedAt).toLocaleDateString()}</span>
            </div>
          )}
          {farmer.rejectionReason && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0', gridColumn: '1 / -1' }}>
              <span style={{ color: '#6b7280' }}>Rejection Reason</span>
              <span>{farmer.rejectionReason}</span>
            </div>
          )}
          {inviteStatus?.inviteExpiresAt && !inviteStatus?.inviteAcceptedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
              <span style={{ color: '#6b7280' }}>Invite Expires</span>
              <span style={{ color: new Date() > new Date(inviteStatus.inviteExpiresAt) ? '#dc2626' : undefined }}>
                {new Date(inviteStatus.inviteExpiresAt).toLocaleDateString()}
                {new Date() > new Date(inviteStatus.inviteExpiresAt) ? ' (expired)' : ''}
              </span>
            </div>
          )}
          {inviteStatus?.inviteAcceptedAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
              <span style={{ color: '#6b7280' }}>Invite Accepted</span>
              <span style={{ color: '#16a34a' }}>{new Date(inviteStatus.inviteAcceptedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {primaryAction && (
              <button className={`btn btn-sm ${primaryAction.className}`} onClick={primaryAction.onClick} disabled={processing}>
                {primaryAction.label}
              </button>
            )}

            {/* Secondary actions */}
            {status === 'pending_approval' && (
              <button className="btn btn-sm btn-warning" onClick={() => setShowRejectModal(true)} disabled={processing}>Reject</button>
            )}
            {status === 'approved' && farmer.assignedOfficerId && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowAssignModal(true)} disabled={processing}>Reassign Officer</button>
            )}
            {status === 'approved' && !farmer.assignedOfficerId && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowAssignModal(true)} disabled={processing}>Assign Officer</button>
            )}
            {status === 'approved' && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowDisableModal(true)} disabled={processing}
                style={{ color: '#dc2626', borderColor: '#dc2626' }}>Disable Access</button>
            )}
            {!farmer.selfRegistered && farmer.invitedAt && (
              <button className="btn btn-sm btn-outline" onClick={handleResendInvite} disabled={processing}>Resend Invite</button>
            )}
            {!farmer.selfRegistered && inviteStatus?.inviteStatus === 'LINK_GENERATED' && inviteStatus?.inviteToken && (
              <CopyInviteLinkButton token={inviteStatus.inviteToken} />
            )}
            {!farmer.userAccount && (
              <button className="btn btn-sm btn-outline" onClick={() => setShowCreateLoginModal(true)} disabled={processing}
                style={{ color: '#2563eb', borderColor: '#2563eb' }}>Create Login</button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAssignModal && (
        <AssignOfficerModal
          farmerId={farmer.id}
          currentOfficerId={farmer.assignedOfficerId}
          officers={officers}
          onClose={() => setShowAssignModal(false)}
          onDone={() => { setShowAssignModal(false); onUpdate(); setActionSuccess('Field officer assigned'); }}
        />
      )}
      {showApproveModal && (
        <ApproveModal
          farmer={farmer}
          officers={officers}
          onClose={() => setShowApproveModal(false)}
          onDone={() => { setShowApproveModal(false); onUpdate(); setActionSuccess('Farmer approved'); }}
        />
      )}
      {showRejectModal && (
        <RejectModal
          farmer={farmer}
          onClose={() => setShowRejectModal(false)}
          onDone={() => { setShowRejectModal(false); onUpdate(); setActionSuccess('Registration rejected'); }}
        />
      )}
      {showReactivateConfirm && (
        <div className="modal-overlay" onClick={() => setShowReactivateConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">Confirm Reactivation <button className="btn btn-outline btn-sm" onClick={() => setShowReactivateConfirm(false)}>X</button></div>
            <div className="modal-body">
              <p style={{ margin: 0 }}>Reactivate access for <strong>{farmer.fullName}</strong>? Their account will be restored to active status and they will be able to log in again.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowReactivateConfirm(false)}>Cancel</button>
              <button
                className="btn btn-success"
                disabled={processing}
                onClick={() => { setShowReactivateConfirm(false); handleReactivate(); }}
              >
                {processing ? 'Reactivating...' : 'Yes, Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDisableModal && (
        <DisableFarmerModal
          farmer={farmer}
          onClose={() => setShowDisableModal(false)}
          onDisabled={() => { setShowDisableModal(false); onUpdate(); setActionSuccess('Farmer access disabled'); }}
        />
      )}
      {showCreateLoginModal && (
        <CreateLoginModal
          farmer={farmer}
          onClose={() => setShowCreateLoginModal(false)}
          onDone={(inviteToken, inviteExpiresAt) => {
            setShowCreateLoginModal(false);
            onUpdate();
            setResendInviteToken(inviteToken || null);
            setResendInviteExpiry(inviteExpiresAt || null);
            setActionSuccess('Login account created. Share the credentials with the farmer.');
          }}
        />
      )}
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────

// ── SoD: Disable Farmer Modal ─────────────────────────────
// Two-phase: (1) create an ApprovalRequest, (2) execute with approved request ID
function DisableFarmerModal({ farmer, onClose, onDisabled }) {
  const [mode, setMode]       = useState('request'); // 'request' | 'execute'
  const [reason, setReason]   = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [created, setCreated] = useState(null); // created ApprovalRequest

  const submitRequest = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Please provide a meaningful reason (at least 5 characters)');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/security/requests', {
        requestType: 'farmer_disable',
        targetFarmerId: farmer.id,
        reason: reason.trim(),
      });
      setCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create approval request');
    } finally {
      setSaving(false);
    }
  };

  const executeDisable = async (e) => {
    e.preventDefault();
    if (!approvalId.trim()) {
      setError('Please enter the Approval Request ID');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/farmers/${farmer.id}/access-status`, {
        status: 'disabled',
        approvalRequestId: approvalId.trim(),
      });
      onDisabled();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to disable farmer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          Disable Farmer Access — {farmer.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {/* SoD notice */}
          <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#92400e', marginBottom: '1rem' }}>
            <strong>Separation of Duties required.</strong> Disabling a farmer requires approval from a second administrator.
            Submit a request below, then ask another admin to approve it at <em>Admin → Security Requests</em>.
            Once approved, return here and enter the Request ID to execute.
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}

          {/* Phase toggle */}
          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
            <button
              type="button"
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: mode === 'request' ? 700 : 400, background: mode === 'request' ? '#2563eb' : '#fff', color: mode === 'request' ? '#fff' : '#374151', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('request'); setError(''); }}
            >
              1. Create Request
            </button>
            <button
              type="button"
              style={{ flex: 1, padding: '0.4rem', fontSize: '0.82rem', fontWeight: mode === 'execute' ? 700 : 400, background: mode === 'execute' ? '#2563eb' : '#fff', color: mode === 'execute' ? '#fff' : '#374151', border: 'none', cursor: 'pointer' }}
              onClick={() => { setMode('execute'); setError(''); }}
            >
              2. Execute (have ID)
            </button>
          </div>

          {mode === 'request' && !created && (
            <form onSubmit={submitRequest}>
              <div className="form-group">
                <label className="form-label">Reason for disabling *</label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why this farmer's access needs to be disabled..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}

          {mode === 'request' && created && (
            <div>
              <div style={{ background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#065f46', marginBottom: '0.75rem' }}>
                <strong>Request submitted successfully.</strong> Another admin must approve it before you can execute.
              </div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.83rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#6b7280' }}>Request ID: </span>
                <code style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{created.id}</code>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                Once approved, switch to the <strong>Execute</strong> tab and paste the ID above to disable access.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {mode === 'execute' && (
            <form onSubmit={executeDisable}>
              <div className="form-group">
                <label className="form-label">Approved Request ID *</label>
                <input
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  required
                  value={approvalId}
                  onChange={e => setApprovalId(e.target.value)}
                  placeholder="Paste the approved Request ID here"
                />
                <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.3rem' }}>
                  Find this ID on <em>Admin → Security Requests</em> once your request has been approved.
                </div>
              </div>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.83rem', color: '#991b1b', marginBottom: '0.75rem' }}>
                This will immediately disable <strong>{farmer.fullName}</strong>'s access. This action is audited and cannot be undone without a separate reactivation.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-outline" style={{ color: '#dc2626', borderColor: '#dc2626' }} disabled={saving}>
                  {saving ? 'Disabling…' : 'Execute Disable'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignOfficerModal({ farmerId, currentOfficerId, officers, onClose, onDone }) {
  const [officerId, setOfficerId] = useState(currentOfficerId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmerId}/assign-officer`, { officerId: officerId || null });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign officer');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Assign Field Officer <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Field Officer</label>
              <select className="form-select" value={officerId} onChange={e => setOfficerId(e.target.value)}>
                <option value="">No assignment</option>
                {officers.map(o => <option key={o.id} value={o.id}>{o.fullName} ({o.email})</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Assign'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ApproveModal({ farmer, officers, onClose, onDone }) {
  const [officerId, setOfficerId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmer.id}/approve-registration`, {
        assignedOfficerId: officerId || undefined,
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Approve: {farmer.fullName} <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div style={{ background: '#f8f9fa', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Phone:</strong> {farmer.phone}</div>
              <div><strong>Region:</strong> {farmer.region}{farmer.district ? `, ${farmer.district}` : ''}</div>
              {farmer.primaryCrop && <div><strong>Crop:</strong> {farmer.primaryCrop}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Assign Field Officer (optional)</label>
              <select className="form-select" value={officerId} onChange={e => setOfficerId(e.target.value)}>
                <option value="">No assignment</option>
                {officers.map(o => <option key={o.id} value={o.id}>{o.fullName} ({o.email})</option>)}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Approving...' : 'Approve Farmer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Performance Profile Section ───────────────────────

function PerformanceProfileSection({ farmerId }) {
  const [profile, setProfile] = useState(null);
  const [credSummary, setCredSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/seasons/farmer/${farmerId}/performance-profile`),
      api.get(`/seasons/farmer/${farmerId}/credibility-summary`).catch(() => ({ data: null })),
    ])
      .then(([pRes, cRes]) => { setProfile(pRes.data); setCredSummary(cRes.data); })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [farmerId]);

  if (loading) return <div className="card" style={{ marginBottom: '1.25rem' }}><div className="card-body"><span className="text-muted">Loading performance profile...</span></div></div>;
  if (!profile) return null;

  const { summary, yieldHistory, reliabilitySignals, seasons } = profile;

  const CLASSIFICATION_COLORS = {
    on_track: { bg: '#d1fae5', color: '#065f46' },
    slight_delay: { bg: '#fef3c7', color: '#92400e' },
    at_risk: { bg: '#fed7aa', color: '#9a3412' },
    critical: { bg: '#fee2e2', color: '#991b1b' },
  };

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Performance Profile</span>
        <button className="btn btn-outline btn-sm" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <div className="card-body">
        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={metricBox}>
            <div style={metricLabel}>Seasons</div>
            <div style={metricValue}>{summary.totalSeasons} total / {summary.completedSeasons} completed</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Avg Score</div>
            <div style={metricValue}>{summary.avgProgressScore ?? 'N/A'}{summary.avgProgressScore ? '/100' : ''}</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Consistency</div>
            <div style={metricValue}>{summary.consistencyRate !== null ? `${summary.consistencyRate}%` : 'N/A'}</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Trend</div>
            <div style={{ ...metricValue, color: summary.productivityTrend === 'improving' ? '#16a34a' : summary.productivityTrend === 'declining' ? '#dc2626' : '#6b7280' }}>
              {summary.productivityTrend === 'improving' ? 'Improving' : summary.productivityTrend === 'declining' ? 'Declining' : summary.productivityTrend === 'stable' ? 'Stable' : 'Insufficient data'}
            </div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Activities</div>
            <div style={metricValue}>{summary.totalActivities}</div>
          </div>
          <div style={metricBox}>
            <div style={metricLabel}>Crops</div>
            <div style={metricValue}>{summary.cropTypes.join(', ') || 'None'}</div>
          </div>
        </div>

        {/* Reliability signals */}
        {reliabilitySignals.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Reliability Signals</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {reliabilitySignals.map((s, i) => (
                <span key={i} style={{
                  display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: 12,
                  fontSize: '0.75rem', fontWeight: 500,
                  background: s.positive ? '#d1fae5' : '#fee2e2',
                  color: s.positive ? '#065f46' : '#991b1b',
                }}>{s.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* Credibility summary */}
        {credSummary?.overallCredibility && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Data Credibility</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem' }}>
              <div style={metricBox}>
                <div style={metricLabel}>Credibility</div>
                <div style={{ ...metricValue, color: credSummary.overallCredibility.level === 'high_confidence' ? '#16a34a' : credSummary.overallCredibility.level === 'medium_confidence' ? '#d97706' : '#dc2626' }}>
                  {credSummary.overallCredibility.avgScore ?? 'N/A'}{credSummary.overallCredibility.avgScore ? '/100' : ''}
                </div>
              </div>
              <div style={metricBox}>
                <div style={metricLabel}>Level</div>
                <div style={metricValue}>{(credSummary.overallCredibility.level || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
              </div>
              <div style={metricBox}>
                <div style={metricLabel}>Trend</div>
                <div style={{ ...metricValue, color: credSummary.overallCredibility.trend === 'improving' ? '#16a34a' : credSummary.overallCredibility.trend === 'declining' ? '#dc2626' : '#6b7280' }}>
                  {(credSummary.overallCredibility.trend || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              </div>
            </div>
            {Object.keys(credSummary.recurringFlags || {}).length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>Recurring Flags</span>
                  <a
                    href={`/farmer-home/${farmerId}/progress`}
                    style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                  >
                    View in Progress Tab →
                  </a>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {Object.entries(credSummary.recurringFlags).map(([flag, count]) => (
                    <span key={flag} style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 500, background: '#fee2e2', color: '#991b1b' }}>
                      {flag.replace(/_/g, ' ')} ({count}x)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Expanded: yield history + season table */}
        {expanded && (
          <>
            {yieldHistory.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>Yield History</div>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>
                    <th style={thStyle}>Crop</th><th style={thStyle}>Planted</th><th style={thStyle}>Yield/Acre</th><th style={thStyle}>Total Kg</th>
                  </tr></thead>
                  <tbody>
                    {yieldHistory.map((y, i) => (
                      <tr key={i}>
                        <td style={tdStyle}>{y.cropType}</td>
                        <td style={tdStyle}>{new Date(y.plantingDate).toLocaleDateString()}</td>
                        <td style={tdStyle}>{y.yieldPerAcre}</td>
                        <td style={tdStyle}>{y.totalHarvestKg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {seasons.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.4rem' }}>All Seasons</div>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead><tr style={{ background: '#f9fafb' }}>
                    <th style={thStyle}>Crop</th><th style={thStyle}>Planted</th><th style={thStyle}>Status</th>
                    <th style={thStyle}>Score</th><th style={thStyle}>Classification</th><th style={thStyle}>Entries</th>
                  </tr></thead>
                  <tbody>
                    {seasons.map(s => {
                      const cls = s.progressScore?.classification;
                      const clsColor = CLASSIFICATION_COLORS[cls] || { bg: '#f3f4f6', color: '#6b7280' };
                      return (
                        <tr key={s.id}>
                          <td style={tdStyle}>{s.cropType}</td>
                          <td style={tdStyle}>{new Date(s.plantingDate).toLocaleDateString()}</td>
                          <td style={tdStyle}><StatusBadge value={s.status} /></td>
                          <td style={tdStyle}>{s.progressScore?.score ?? '-'}</td>
                          <td style={tdStyle}>
                            {cls ? <span style={{ padding: '0.15rem 0.5rem', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, background: clsColor.bg, color: clsColor.color }}>
                              {cls.replace('_', ' ')}
                            </span> : '-'}
                          </td>
                          <td style={tdStyle}>{s.progressEntries}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const metricBox = { background: '#f9fafb', borderRadius: 6, padding: '0.6rem', textAlign: 'center' };
const metricLabel = { fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.2rem' };
const metricValue = { fontSize: '0.85rem', fontWeight: 600, color: '#111827' };
const thStyle = { padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #e5e7eb' };
const tdStyle = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #f3f4f6' };

// ─── Modals ─────────────────────────────────────────────

function RejectModal({ farmer, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmer.id}/reject-registration`, {
        rejectionReason: reason,
      });
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Rejection failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">Reject: {farmer.fullName} <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label">Rejection Reason *</label>
              <textarea className="form-input" rows={3} required value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g., Incomplete information, outside service area..." />
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>Required — the farmer will see this explanation.</div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-warning" disabled={saving}>{saving ? 'Rejecting...' : 'Reject Registration'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal for creating a login account for a farmer that doesn't have one
function CreateLoginModal({ farmer, onClose, onDone }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/farmers/${farmer.id}/create-login`, { email, password });
      onDone(null, null); // No invite token since we created credentials directly
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create login account');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          Create Login: {farmer.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>X</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div style={{ background: '#eff6ff', color: '#1e40af', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '1rem', fontSize: '0.8rem' }}>
              Creates a login account linked to this farmer profile. Share the email and password with the farmer securely.
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="farmer@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Temporary Password *</label>
              <input className="form-input" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Login'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Compact button to copy the existing invite link (shown when status = LINK_GENERATED)
function CopyInviteLinkButton({ token }) {
  const [copied, setCopied] = React.useState(false);
  const url = `${window.location.origin}/accept-invite?token=${token}`;
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {});
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="btn btn-sm btn-outline"
      style={{ color: copied ? '#16a34a' : '#2563eb', borderColor: copied ? '#16a34a' : '#2563eb' }}
    >
      {copied ? '✓ Link Copied' : 'Copy Invite Link'}
    </button>
  );
}

// Inline copyable link box for resend invite result
function ResendInviteLinkBox({ url, expiresAt }) {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => {});
  };
  return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '0.6rem 0.75rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#166534', marginBottom: '0.35rem' }}>
        Share this invite link with the farmer (email, WhatsApp, SMS):
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: expiresAt ? '0.3rem' : 0 }}>
        <input
          readOnly
          value={url}
          onClick={e => e.target.select()}
          style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.75rem', padding: '0.3rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', color: '#374151', cursor: 'text' }}
        />
        <button
          type="button"
          onClick={copy}
          className="btn btn-outline btn-sm"
          style={{ whiteSpace: 'nowrap', color: copied ? '#16a34a' : undefined, borderColor: copied ? '#16a34a' : undefined }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {expiresAt && (
        <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
          Expires: {new Date(expiresAt).toLocaleDateString()} — resend to refresh
        </div>
      )}
    </div>
  );
}
