import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuthStore } from '../store/authStore.js';
import { ADMIN_ROLES, CREATOR_ROLES } from '../utils/roles.js';

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
          <button className="btn btn-outline" onClick={() => navigate('/farmers')}>Back to Farmers</button>
        </div>
      </div>
      <div className="page-body">
        {/* Access & Assignment Section */}
        {(isAdmin || isCreator) && (
          <AccessAssignmentSection farmer={farmer} isAdmin={isAdmin} isCreator={isCreator} onUpdate={load} />
        )}

        <div className="detail-grid">
          <div className="card">
            <div className="card-header">Farmer Information</div>
            <div className="card-body">
              <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{farmer.phone}</span></div>
              <div className="detail-row"><span className="detail-label">National ID</span><span className="detail-value">{farmer.nationalId || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Region</span><span className="detail-value">{farmer.region}</span></div>
              <div className="detail-row"><span className="detail-label">District</span><span className="detail-value">{farmer.district || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Village</span><span className="detail-value">{farmer.village || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Country</span><span className="detail-value">{farmer.countryCode === 'TZ' ? 'Tanzania' : 'Kenya'}</span></div>
              <div className="detail-row"><span className="detail-label">Primary Crop</span><span className="detail-value">{farmer.primaryCrop || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Farm Size</span><span className="detail-value">{farmer.farmSizeAcres ? `${farmer.farmSizeAcres} ${farmer.countryCode === 'TZ' ? 'hectares' : 'acres'}` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Experience</span><span className="detail-value">{farmer.yearsExperience ? `${farmer.yearsExperience} years` : '-'}</span></div>
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
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then(r => {
        setOfficers(r.data.filter(u => u.role === 'field_officer' && u.active));
      }).catch(() => {});
    }
  }, [isAdmin]);

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

  const handleDisable = () => doAction(async () => {
    await api.patch(`/farmers/${farmer.id}/access-status`, { status: 'disabled' });
    setActionSuccess('Farmer access disabled');
  });

  const handleReactivate = () => doAction(async () => {
    await api.patch(`/farmers/${farmer.id}/access-status`, { status: 'approved' });
    setActionSuccess('Farmer access reactivated');
  });

  const handleReopenPending = () => doAction(async () => {
    await api.patch(`/farmers/${farmer.id}/access-status`, { status: 'pending_approval' });
    setActionSuccess('Registration reopened for review');
  });

  const handleResendInvite = () => doAction(async () => {
    await api.post(`/farmers/${farmer.id}/resend-invite`);
    setActionSuccess('Invite resent');
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
      primaryAction = { label: 'Reactivate', onClick: handleReactivate, className: 'btn-success' };
    } else if (status === 'rejected') {
      primaryAction = { label: 'Reopen for Review', onClick: handleReopenPending, className: 'btn-primary' };
    }
  }

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div className="card-header">Access & Assignment</div>
      <div className="card-body">
        {actionError && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{actionError}</div>}
        {actionSuccess && <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.5rem 0.75rem', borderRadius: 6, marginBottom: '0.75rem', fontSize: '0.875rem' }}>{actionSuccess}</div>}

        {/* Status badges row */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, background: sc.bg, color: sc.color }}>
            {sc.label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, background: '#ede9fe', color: '#5b21b6' }}>
            {farmer.selfRegistered ? 'Self-Registered' : 'Invited'}
          </span>
          {farmer.userAccount && (
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, background: farmer.userAccount.active ? '#d1fae5' : '#fee2e2', color: farmer.userAccount.active ? '#065f46' : '#991b1b' }}>
              Account {farmer.userAccount.active ? 'Active' : 'Inactive'}
            </span>
          )}
          {!farmer.userAccount && (
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.3rem 0.7rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 500, background: '#fef3c7', color: '#92400e' }}>
              No Login Account
            </span>
          )}
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
              <button className="btn btn-sm btn-outline" onClick={handleDisable} disabled={processing}
                style={{ color: '#dc2626', borderColor: '#dc2626' }}>Disable Access</button>
            )}
            {!farmer.selfRegistered && farmer.invitedAt && (
              <button className="btn btn-sm btn-outline" onClick={handleResendInvite} disabled={processing}>Resend Invite</button>
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
    </div>
  );
}

// ─── Modals ─────────────────────────────────────────────

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
        rejectionReason: reason || undefined,
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
              <label className="form-label">Rejection Reason (optional)</label>
              <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)}
                placeholder="e.g., Incomplete information, outside service area..." />
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
