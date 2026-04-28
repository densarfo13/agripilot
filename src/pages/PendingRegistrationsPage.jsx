import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { formatLandSize } from '../utils/landSize.js';
import EmptyState from '../components/EmptyState.jsx';
import AdminNotice from '../components/admin/AdminNotice.jsx';
import useAdminData from '../hooks/useAdminData.js';

export default function PendingRegistrationsPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState('pending');
  const [actionTarget, setActionTarget] = useState(null);
  const [officers, setOfficers] = useState([]);

  // The defensive useAdminData hook owns the lifecycle:
  //   * runs the fetcher on mount + on every filter change
  //   * never throws into render — every error is caught
  //     and surfaced via `loadError` (the message string)
  //   * `_error` carries the FULL classified shape
  //     (isAuthError / isMfaRequired) so AdminNotice can
  //     render the right CTA (Sign-in / Verify-MFA / Retry).
  //   * `retry` is a stable callback the AdminNotice button
  //     wires to.
  const {
    data: registrations = [],
    loading,
    error: loadError,
    isAuthError,
    isMfaRequired,
    retry: load,
  } = useAdminData(
    () => {
      const endpoint = filter === 'pending'
        ? '/farmers/pending-registrations'
        : '/farmers/self-registered';
      return api.get(endpoint).then((r) => r.data || []);
    },
    {
      fallback: [],
      deps:     [filter],
    },
  );

  useEffect(() => {
    // Load field officers for assignment. Failures here are
    // non-fatal — the assignment dropdown just becomes empty
    // and the rest of the page keeps working.
    api.get('/users').then(r => {
      setOfficers(r.data.filter(u => u.role === 'field_officer' && u.active));
    }).catch(() => {});
  }, []);

  return (
    <>
      <div className="page-header">
        <h1>Farmer Registrations</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('pending')}>
            Pending
          </button>
          <button className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>
            All Self-Registered
          </button>
        </div>
      </div>
      <div className="page-body">
        {loadError && (
          <div style={{ marginBottom: '1rem' }}>
            <AdminNotice
              type={isAuthError ? 'auth'
                  : isMfaRequired ? 'mfa'
                  : 'error'}
              message={
                isAuthError || isMfaRequired
                  ? undefined
                  : 'We could not load registrations. Your data is safe — try again in a moment.'
              }
              onRetry={isAuthError || isMfaRequired ? undefined : load}
              testId="registrations-load-error"
            />
          </div>
        )}
        {loading ? <div className="loading">Loading registrations...</div> : registrations.length === 0 ? (
          <div className="card">
            <div className="card-body">
              {filter === 'pending' ? (
                <EmptyState
                  icon="✅"
                  title="No pending registrations"
                  message="All farmer registrations have been processed. New registrations will appear here automatically."
                  variant="success"
                />
              ) : (
                <EmptyState
                  icon="👤"
                  title="No self-registered farmers yet"
                  message="Farmers who sign up on their own will appear here for review."
                />
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Region</th>
                    <th>Crop</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.fullName}</td>
                      <td>{r.phone}</td>
                      <td className="text-sm">{r.userAccount?.email || '—'}</td>
                      <td>{r.region}{r.district ? `, ${r.district}` : ''}</td>
                      <td>{r.primaryCrop || '—'}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(r.registrationStatus)}`}>
                          {r.registrationStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        {r.registrationStatus === 'pending_approval' && ['super_admin', 'institutional_admin'].includes(currentUser?.role) && (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-sm btn-success" onClick={() => setActionTarget({ farmer: r, action: 'approve' })}>
                              Approve
                            </button>
                            <button className="btn btn-sm btn-warning" onClick={() => setActionTarget({ farmer: r, action: 'reject' })}>
                              Reject
                            </button>
                          </div>
                        )}
                        {r.registrationStatus === 'pending_approval' && currentUser?.role === 'field_officer' && (
                          <span className="text-sm text-muted">Awaiting admin review</span>
                        )}
                        {r.registrationStatus === 'approved' && (
                          <span className="text-sm text-muted">Approved</span>
                        )}
                        {r.registrationStatus === 'rejected' && (
                          <span className="text-sm text-muted">Rejected</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {actionTarget && (
          <ActionModal
            farmer={actionTarget.farmer}
            action={actionTarget.action}
            officers={officers}
            onClose={() => setActionTarget(null)}
            onDone={() => { setActionTarget(null); load(); }}
          />
        )}
      </div>
    </>
  );
}

function statusBadgeClass(status) {
  switch (status) {
    case 'pending_approval': return 'badge-submitted';
    case 'approved': return 'badge-approved';
    case 'rejected': return 'badge-rejected';
    default: return '';
  }
}

function ActionModal({ farmer, action, officers, onClose, onDone }) {
  const [officerId, setOfficerId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (action === 'approve') {
        await api.post(`/farmers/${farmer.id}/approve-registration`, {
          assignedOfficerId: officerId || undefined,
        });
      } else {
        await api.post(`/farmers/${farmer.id}/reject-registration`, {
          rejectionReason: reason || undefined,
        });
      }
      onDone();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {action === 'approve' ? 'Approve' : 'Reject'} Registration: {farmer.fullName}
          <button className="btn btn-outline btn-sm" onClick={onClose}>X</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div style={{ background: '#1E293B', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <div><strong>Phone:</strong> {farmer.phone}</div>
              <div><strong>Region:</strong> {farmer.region}{farmer.district ? `, ${farmer.district}` : ''}</div>
              {farmer.primaryCrop && <div><strong>Crop:</strong> {farmer.primaryCrop}</div>}
              {(farmer.landSizeValue || farmer.farmSizeAcres) && <div><strong>Farm Size:</strong> {formatLandSize(farmer.landSizeValue || farmer.farmSizeAcres, farmer.landSizeUnit)}</div>}
            </div>

            {action === 'approve' ? (
              <div className="form-group">
                <label className="form-label">Assign Field Officer (optional)</label>
                <select className="form-select" value={officerId} onChange={e => setOfficerId(e.target.value)}>
                  <option value="">No assignment</option>
                  {officers.map(o => (
                    <option key={o.id} value={o.id}>{o.fullName} ({o.email})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Rejection Reason (optional)</label>
                <textarea className="form-input" rows={3} value={reason} onChange={e => setReason(e.target.value)}
                  placeholder="e.g., Incomplete information, outside service area..." />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn ${action === 'approve' ? 'btn-success' : 'btn-warning'}`} disabled={saving}>
              {saving ? 'Processing...' : action === 'approve' ? 'Approve Farmer' : 'Reject Registration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
