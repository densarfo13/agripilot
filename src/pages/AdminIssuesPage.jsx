import React, { useEffect, useState } from 'react';
import api from '../api/client.js';

const ISSUE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'BUG', label: 'Bug' },
  { value: 'DATA_ISSUE', label: 'Data Issue' },
  { value: 'ACCESS_ISSUE', label: 'Access Issue' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const STATUS_STYLE = {
  OPEN: { background: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  IN_PROGRESS: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  RESOLVED: { background: 'rgba(34,197,94,0.15)', color: '#22C55E' },
};

const PRIORITY_DOT = { high: '#EF4444', medium: '#F59E0B', low: '#71717A' };

const TYPE_LABEL = {
  BUG: 'Bug', DATA_ISSUE: 'Data Issue', ACCESS_ISSUE: 'Access Issue', FEATURE_REQUEST: 'Feature Request',
};

const selectStyle = {
  background: '#1E293B', color: '#fff', border: '1px solid #243041',
  borderRadius: 6, padding: '0.45rem 0.75rem', fontSize: '0.85rem',
};

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [distribution, setDistribution] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [noteEditing, setNoteEditing] = useState(null); // { id, text }
  const limit = 30;

  const load = () => {
    setLoading(true);
    setLoadError('');
    const params = { limit, page };
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.issueType = typeFilter;

    api.get('/issues', { params })
      .then((res) => {
        setIssues(res.data.items);
        setTotal(res.data.total);
        setDistribution(res.data.distribution || {});
      })
      .catch(() => { setLoadError('Failed to load issues'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, statusFilter, typeFilter]);

  const updateIssue = async (id, data) => {
    setActionLoading((s) => ({ ...s, [id]: true }));
    setActionError('');
    try {
      const res = await api.patch(`/issues/${id}`, data);
      setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...res.data } : i)));
      if (data.status) load(); // refresh distribution on status change
      if (data.adminNote !== undefined) setNoteEditing(null);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to update issue');
    } finally {
      setActionLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const totalPages = Math.ceil(total / limit);
  const distTotal = (distribution.OPEN || 0) + (distribution.IN_PROGRESS || 0) + (distribution.RESOLVED || 0);

  return (
    <>
      <div className="page-header">
        <h1>Issues ({total})</h1>
        <button className="btn btn-outline" onClick={load}>Refresh</button>
      </div>
      <div className="page-body">
        {/* Distribution summary */}
        {distTotal > 0 && (
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-card" onClick={() => setStatusFilter('OPEN')} style={{ cursor: 'pointer' }}>
              <div className="stat-label">Open</div>
              <div className="stat-value" style={{ color: '#EF4444' }}>{distribution.OPEN || 0}</div>
            </div>
            <div className="stat-card" onClick={() => setStatusFilter('IN_PROGRESS')} style={{ cursor: 'pointer' }}>
              <div className="stat-label">In Progress</div>
              <div className="stat-value" style={{ color: '#F59E0B' }}>{distribution.IN_PROGRESS || 0}</div>
            </div>
            <div className="stat-card" onClick={() => setStatusFilter('RESOLVED')} style={{ cursor: 'pointer' }}>
              <div className="stat-label">Resolved</div>
              <div className="stat-value" style={{ color: '#22C55E' }}>{distribution.RESOLVED || 0}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-select" value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} style={selectStyle}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="form-select" value={typeFilter} onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }} style={selectStyle}>
            {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {(statusFilter || typeFilter) && (
            <button className="btn btn-outline btn-sm" onClick={() => { setStatusFilter(''); setTypeFilter(''); setPage(1); }}>
              Clear Filters
            </button>
          )}
        </div>

        {actionError && (
          <div className="alert-inline alert-inline-danger" style={{ marginBottom: '0.75rem' }}>
            {actionError}
            <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => setActionError('')}>Dismiss</button>
          </div>
        )}

        {loadError && (
          <div className="alert-inline alert-inline-danger" style={{ marginBottom: '0.75rem' }}>
            {loadError}
            <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={load}>Retry</button>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading issues...</div>
        ) : issues.length === 0 ? (
          <div className="card"><div className="card-body" style={{ textAlign: 'center', color: '#71717A', padding: '2rem' }}>
            {statusFilter || typeFilter ? 'No issues match the current filters.' : 'No issues reported yet.'}
          </div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {issues.map((issue) => {
              const sStyle = STATUS_STYLE[issue.status] || {};
              const isExpanded = expandedId === issue.id;
              const pColor = PRIORITY_DOT[issue.priority] || PRIORITY_DOT.medium;
              return (
                <div key={issue.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : issue.id)}>
                  <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{
                            ...sStyle, padding: '0.15rem 0.55rem', borderRadius: '4px',
                            fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase',
                          }}>
                            {issue.status.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#A1A1AA', fontWeight: 600 }}>
                            {TYPE_LABEL[issue.issueType] || issue.issueType}
                          </span>
                          <span title={`Priority: ${issue.priority || 'medium'}`} style={{
                            width: 8, height: 8, borderRadius: '50%', background: pColor, display: 'inline-block',
                          }} />
                          <span style={{ fontSize: '0.68rem', color: pColor, textTransform: 'capitalize' }}>
                            {issue.priority || 'medium'}
                          </span>
                          {issue.organization && (
                            <span style={{ fontSize: '0.72rem', color: '#71717A' }}>{issue.organization.name}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#FFFFFF', lineHeight: 1.4 }}>
                          {isExpanded ? issue.description : (issue.description.length > 120 ? issue.description.slice(0, 120) + '...' : issue.description)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#71717A', marginTop: '0.35rem' }}>
                          {issue.user?.fullName || 'Unknown'}
                          {issue.user?.email ? ` (${issue.user.email})` : ''}
                          {' \u00B7 '}{new Date(issue.createdAt).toLocaleDateString()}
                          {' \u00B7 '}{issue.pageRoute || 'N/A'}
                        </div>

                        {/* Expanded: admin note display/edit + priority change */}
                        {isExpanded && (
                          <div style={{ marginTop: '0.6rem' }} onClick={(e) => e.stopPropagation()}>
                            {/* Admin note */}
                            {noteEditing?.id === issue.id ? (
                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                <textarea
                                  value={noteEditing.text}
                                  onChange={(e) => setNoteEditing({ id: issue.id, text: e.target.value })}
                                  placeholder="Add an admin note (visible to user)..."
                                  rows={2}
                                  style={{
                                    flex: 1, padding: '0.5rem', background: '#1E293B', border: '1px solid #243041',
                                    borderRadius: 4, color: '#fff', fontSize: '0.82rem', resize: 'vertical',
                                  }}
                                  autoFocus
                                />
                                <button
                                  className="btn btn-primary btn-sm"
                                  disabled={actionLoading[issue.id]}
                                  onClick={() => updateIssue(issue.id, { adminNote: noteEditing.text || '' })}
                                >
                                  Save
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => setNoteEditing(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ marginBottom: '0.5rem' }}>
                                {issue.adminNote ? (
                                  <div style={{ fontSize: '0.8rem', color: '#A1A1AA', padding: '0.5rem', background: '#1E293B', borderRadius: 4 }}>
                                    <strong>Admin note:</strong> {issue.adminNote}
                                    <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}
                                      onClick={() => setNoteEditing({ id: issue.id, text: issue.adminNote || '' })}>Edit</button>
                                  </div>
                                ) : (
                                  <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                                    onClick={() => setNoteEditing({ id: issue.id, text: '' })}>
                                    + Add Note
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Priority change */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                              <span style={{ color: '#A1A1AA' }}>Priority:</span>
                              {['low', 'medium', 'high'].map((p) => (
                                <button
                                  key={p}
                                  className="btn btn-outline btn-sm"
                                  disabled={issue.priority === p || actionLoading[issue.id]}
                                  style={{
                                    fontSize: '0.7rem', textTransform: 'capitalize',
                                    ...(issue.priority === p ? { background: PRIORITY_DOT[p], color: '#fff', borderColor: PRIORITY_DOT[p] } : {}),
                                  }}
                                  onClick={() => updateIssue(issue.id, { priority: p })}
                                >
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Status actions */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {issue.status === 'OPEN' && (
                          <button className="btn btn-outline btn-sm"
                            style={{ color: '#F59E0B', borderColor: '#F59E0B', fontSize: '0.75rem' }}
                            disabled={actionLoading[issue.id]}
                            onClick={() => updateIssue(issue.id, { status: 'IN_PROGRESS' })}>
                            {actionLoading[issue.id] ? '...' : 'Start'}
                          </button>
                        )}
                        {(issue.status === 'OPEN' || issue.status === 'IN_PROGRESS') && (
                          <button className="btn btn-outline btn-sm"
                            style={{ color: '#22C55E', borderColor: '#22C55E', fontSize: '0.75rem' }}
                            disabled={actionLoading[issue.id]}
                            onClick={() => updateIssue(issue.id, { status: 'RESOLVED' })}>
                            {actionLoading[issue.id] ? '...' : 'Resolve'}
                          </button>
                        )}
                        {issue.status === 'RESOLVED' && (
                          <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                            disabled={actionLoading[issue.id]}
                            onClick={() => updateIssue(issue.id, { status: 'OPEN' })}>
                            {actionLoading[issue.id] ? '...' : 'Reopen'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
            <span style={{ fontSize: '0.85rem', color: '#A1A1AA', alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
