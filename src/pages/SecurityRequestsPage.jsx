import React, { useEffect, useState, useCallback } from 'react';
import api, { formatApiError } from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import AdminNotice from '../components/admin/AdminNotice.jsx';
import {
  ErrorState, SessionExpiredState, MfaRequiredState, NetworkErrorState,
  InlineFormError,
} from '../components/admin/AdminState.jsx';
import { classifyAdminError, API_ERROR_TYPES } from '../utils/adminErrors.js';

const TYPE_LABELS = {
  season_reopen:    'Season Reopen',
  farmer_disable:   'Farmer Disable',
  role_escalation:  'Role Escalation',
  user_org_transfer:'Org Transfer',
  privileged_reset: 'Privileged PW Reset',
};

// Which field on an ApprovalRequest holds the target resource ID for each type
const TARGET_ID_FIELD = {
  season_reopen:    'targetSeasonId',
  farmer_disable:   'targetFarmerId',
  role_escalation:  'targetUserId',
  user_org_transfer:'targetUserId',
  privileged_reset: 'targetUserId',
};

const TARGET_LABEL = {
  season_reopen:    'Season',
  farmer_disable:   'Farmer',
  role_escalation:  'User',
  user_org_transfer:'User',
  privileged_reset: 'User',
};

const TYPE_EXPIRY = {
  season_reopen:    '4 hours',
  farmer_disable:   '24 hours',
  role_escalation:  '24 hours',
  user_org_transfer:'24 hours',
  privileged_reset: '1 hour',
};

const STATUS_STYLE = {
  pending:  { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  rejected: { bg: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  expired:  { bg: '#1E293B', color: '#71717A' },
  revoked:  { bg: '#1E293B', color: '#71717A' },
  executed: { bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
};

function timeLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt) - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SecurityRequestsPage() {
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  // Classified error so AdminNotice can render auth/MFA CTAs.
  const [error, setError]           = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [modal, setModal]           = useState(null); // { req, action }
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionSaving, setActionSaving]       = useState(false);
  const [actionError, setActionError]         = useState('');
  const currentUser = useAuthStore(s => s.user);
  const isSuperAdmin   = currentUser?.role === 'super_admin';
  const isInstAdmin    = currentUser?.role === 'institutional_admin';
  const canApproveAny  = isSuperAdmin || isInstAdmin;

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (typeFilter)   params.requestType = typeFilter;
    api.get('/security/requests', { params })
      .then(r => { setRequests(r.data.requests ?? r.data ?? []); setError(null); })
      .catch(err => setError(classifyAdminError(err)))
      .finally(() => setLoading(false));
  }, [statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openModal = (req, action) => {
    setModal({ req, action });
    setRejectionReason('');
    setActionError('');
  };

  const submitAction = async () => {
    if (!modal) return;
    const { req, action } = modal;
    if ((action === 'reject') && !rejectionReason.trim()) {
      setActionError('Rejection reason is required');
      return;
    }
    setActionSaving(true);
    setActionError('');
    try {
      if (action === 'approve') {
        await api.post(`/security/requests/${req.id}/approve`);
      } else if (action === 'reject') {
        await api.post(`/security/requests/${req.id}/reject`, { rejectionReason });
      } else if (action === 'revoke') {
        await api.post(`/security/requests/${req.id}/revoke`);
      }
      setModal(null);
      load();
    } catch (err) {
      setActionError(formatApiError(err, `Failed to ${action} request`));
    } finally {
      setActionSaving(false);
    }
  };

  const copyId = (id) => {
    navigator.clipboard?.writeText(id).catch(() => {});
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Security Requests</h1>
          <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '0.15rem' }}>
            Separation of Duties — approval queue for sensitive operations
          </div>
        </div>
        <button className="btn btn-outline" onClick={load}>Refresh</button>
      </div>

      <div className="page-body">
        {error && (
          <div style={{ marginBottom: '1rem' }}>
            {error.errorType === API_ERROR_TYPES.SESSION_EXPIRED ? (
              <SessionExpiredState testId="security-requests-load-error" />
            ) : error.errorType === API_ERROR_TYPES.MFA_REQUIRED ? (
              <MfaRequiredState testId="security-requests-load-error" />
            ) : error.errorType === API_ERROR_TYPES.NETWORK_ERROR ? (
              <NetworkErrorState onRetry={load}
                                 testId="security-requests-load-error" />
            ) : (
              <ErrorState
                message="We could not load security requests. Try again in a moment."
                onRetry={load}
                testId="security-requests-load-error"
              />
            )}
          </div>
        )}

        {/* Info banner */}
        <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#22C55E' }}>
          <strong>How it works:</strong> Sensitive actions require a second admin to approve before they can be executed.
          Pending requests below need review. Approved requests have a limited execution window after which they expire.
          If you requested an action and it has been approved, copy the Request ID and use it in the original page to execute.
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto', minWidth: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="executed">Executed</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
          <select className="form-select" style={{ width: 'auto', minWidth: 170 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {(statusFilter || typeFilter) && (
            <button className="btn btn-sm btn-outline" onClick={() => { setStatusFilter(''); setTypeFilter(''); }}>
              Clear Filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">Loading requests...</div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Target</th>
                      <th>Requested By</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Window</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map(r => {
                      const sc      = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
                      const isSelf  = r.requestedById === currentUser?.id;
                      const canAct  = canApproveAny && !isSelf;
                      const tl      = r.status === 'approved' ? timeLeft(r.expiresAt) : null;
                      const expired = tl === 'Expired';
                      return (
                        <tr key={r.id}>
                          <td>
                            <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>
                              {TYPE_LABELS[r.requestType] ?? r.requestType}
                            </span>
                            {isSelf && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: '#71717A', marginTop: '0.1rem' }}>
                                Your request
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {(() => {
                              const field = TARGET_ID_FIELD[r.requestType];
                              const id    = field && r[field];
                              const label = TARGET_LABEL[r.requestType] ?? 'Resource';
                              if (!id) return <span style={{ color: '#71717A' }}>—</span>;
                              return (
                                <span title={id}>
                                  <span style={{ color: '#A1A1AA', marginRight: '0.25rem' }}>{label}:</span>
                                  <code style={{ fontFamily: 'monospace', fontSize: '0.75rem', background: '#1E293B', padding: '0.1rem 0.3rem', borderRadius: 3 }}>
                                    {id.slice(0, 8)}…
                                  </code>
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {r.requestedBy?.fullName ?? '—'}
                          </td>
                          <td style={{ fontSize: '0.85rem', maxWidth: 200 }}>
                            <span title={r.reason}>
                              {r.reason?.length > 60 ? r.reason.slice(0, 60) + '…' : r.reason}
                            </span>
                            {r.rejectionReason && (
                              <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: '0.2rem' }}>
                                Rejected: {r.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ padding: '0.2rem 0.6rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, background: sc.bg, color: sc.color }}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: '#A1A1AA', whiteSpace: 'nowrap' }}>
                            {new Date(r.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {tl ? (
                              <span style={{ color: expired ? '#EF4444' : '#22C55E', fontWeight: 600 }}>
                                {tl}
                              </span>
                            ) : r.status === 'approved' && r.expiresAt ? (
                              <span style={{ color: '#EF4444', fontWeight: 600 }}>Expired</span>
                            ) : (
                              TYPE_EXPIRY[r.requestType] ? (
                                <span style={{ color: '#71717A', fontSize: '0.75rem' }}>
                                  {TYPE_EXPIRY[r.requestType]} on approval
                                </span>
                              ) : '—'
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                              {/* Approver actions */}
                              {r.status === 'pending' && canAct && (
                                <>
                                  <button className="btn btn-sm btn-success" onClick={() => openModal(r, 'approve')}>
                                    Approve
                                  </button>
                                  <button className="btn btn-sm btn-warning" onClick={() => openModal(r, 'reject')}>
                                    Reject
                                  </button>
                                </>
                              )}

                              {/* Requester: copy ID to use at the action site */}
                              {r.status === 'approved' && isSelf && !expired && (
                                <button
                                  className="btn btn-sm btn-outline"
                                  style={{ color: '#22C55E', borderColor: '#22C55E', fontSize: '0.78rem' }}
                                  onClick={() => copyId(r.id)}
                                  title={`Request ID: ${r.id}`}
                                >
                                  Copy ID
                                </button>
                              )}

                              {/* Revoke — super_admin can revoke any; requester can revoke their own */}
                              {r.status === 'approved' && (isSuperAdmin || isSelf) && !expired && (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  style={{ fontSize: '0.78rem' }}
                                  onClick={() => openModal(r, 'revoke')}
                                >
                                  Revoke
                                </button>
                              )}

                              {/* Nothing to do for terminal statuses */}
                              {['executed', 'expired', 'revoked', 'rejected'].includes(r.status) && !canAct && (
                                <span style={{ fontSize: '0.75rem', color: '#71717A' }}>—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {requests.length === 0 && (
                      <tr>
                        <td colSpan={8} className="empty-state">
                          No security requests found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action confirmation modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              {modal.action === 'approve' && 'Approve Request'}
              {modal.action === 'reject'  && 'Reject Request'}
              {modal.action === 'revoke'  && 'Revoke Approval'}
              <button className="btn btn-outline btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Inline modal action error — InlineFormError is
                  the compact v3 variant (single line, small
                  padding) so it doesn't overpower the modal's
                  Approve/Reject controls below. */}
              <InlineFormError
                message={actionError}
                style={{ marginBottom: '0.75rem' }}
                testId="security-modal-action-error"
              />
              <div style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: 600 }}>{TYPE_LABELS[modal.req.requestType]}</span>
                {' '}requested by{' '}
                <span style={{ fontWeight: 600 }}>{modal.req.requestedBy?.fullName ?? 'unknown'}</span>
              </div>
              <div style={{ background: '#1E293B', border: '1px solid #243041', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#A1A1AA' }}>Reason: </span>
                {modal.req.reason}
              </div>

              {modal.action === 'approve' && (
                <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#22C55E' }}>
                  Approving creates a timed execution window ({TYPE_EXPIRY[modal.req.requestType] ?? 'limited time'}).
                  The requester must execute the action within that window or it will expire.
                </div>
              )}

              {(modal.action === 'reject' || modal.action === 'revoke') && (
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label className="form-label">
                    {modal.action === 'reject' ? 'Rejection Reason *' : 'Reason for Revocation (optional)'}
                  </label>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    placeholder="Explain why..."
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button
                className={`btn ${modal.action === 'approve' ? 'btn-success' : modal.action === 'reject' ? 'btn-warning' : modal.action === 'revoke' ? 'btn-outline-danger' : 'btn-outline'}`}
                onClick={submitAction}
                disabled={actionSaving}
              >
                {actionSaving
                  ? 'Processing…'
                  : modal.action === 'approve' ? 'Approve'
                  : modal.action === 'reject'  ? 'Reject'
                  : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
