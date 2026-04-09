import React, { useEffect, useState } from 'react';
import api from '../api/client.js';

const ISSUE_TYPES = [
  { value: '', label: 'All Types' }, { value: 'BUG', label: 'Bug' },
  { value: 'DATA_ISSUE', label: 'Data Issue' }, { value: 'ACCESS_ISSUE', label: 'Access Issue' },
  { value: 'FEATURE_REQUEST', label: 'Feature Request' },
];
const CATEGORIES = [
  { value: '', label: 'All Categories' }, { value: 'BLOCKER', label: 'Blocker' },
  { value: 'FRICTION', label: 'Friction' }, { value: 'TRUST', label: 'Trust' },
  { value: 'FEATURE', label: 'Feature' },
];
const PRIORITIES = [
  { value: '', label: 'All Priorities' }, { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' },
];
const STATUSES = [
  { value: '', label: 'All Statuses' }, { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' }, { value: 'FIXED', label: 'Fixed' },
  { value: 'VERIFIED', label: 'Verified' },
];

const STATUS_STYLE = {
  OPEN: { background: 'rgba(239,68,68,0.15)', color: '#EF4444' },
  IN_PROGRESS: { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  FIXED: { background: 'rgba(34,197,94,0.15)', color: '#22C55E' },
  VERIFIED: { background: 'rgba(34,197,94,0.25)', color: '#059669' },
};
const STATUS_LABEL = { OPEN: 'Open', IN_PROGRESS: 'In Progress', FIXED: 'Fixed', VERIFIED: 'Verified' };
const PRIORITY_DOT = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#71717A' };
const CAT_LABEL = { BLOCKER: 'Blocker', FRICTION: 'Friction', TRUST: 'Trust', FEATURE: 'Feature' };
const CAT_COLOR = { BLOCKER: '#EF4444', FRICTION: '#F59E0B', TRUST: '#0891b2', FEATURE: '#A1A1AA' };
const TYPE_LABEL = { BUG: 'Bug', DATA_ISSUE: 'Data Issue', ACCESS_ISSUE: 'Access Issue', FEATURE_REQUEST: 'Feature Request' };
const SEL = { background: '#1E293B', color: '#fff', border: '1px solid #243041', borderRadius: 6, padding: '0.45rem 0.75rem', fontSize: '0.85rem' };

export default function AdminIssuesPage() {
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [distribution, setDistribution] = useState({});
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [prioFilter, setPrioFilter] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [noteEditing, setNoteEditing] = useState(null);
  const [resEditing, setResEditing] = useState(null);
  const [showInsights, setShowInsights] = useState(false);
  const limit = 30;

  const load = () => {
    setLoading(true); setLoadError('');
    const params = { limit, page };
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.issueType = typeFilter;
    if (catFilter) params.category = catFilter;
    if (prioFilter) params.priority = prioFilter;

    api.get('/issues', { params })
      .then((res) => { setIssues(res.data.items); setTotal(res.data.total); setDistribution(res.data.distribution || {}); })
      .catch(() => { setLoadError('Failed to load issues'); })
      .finally(() => setLoading(false));
  };

  const loadInsights = () => {
    api.get('/issues/insights').then((res) => setInsights(res.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [page, statusFilter, typeFilter, catFilter, prioFilter]);
  useEffect(() => { loadInsights(); }, []);

  const updateIssue = async (id, data) => {
    setActionLoading((s) => ({ ...s, [id]: true })); setActionError('');
    try {
      const res = await api.patch(`/issues/${id}`, data);
      setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...res.data } : i)));
      if (data.status) { load(); loadInsights(); }
      if (data.adminNote !== undefined) setNoteEditing(null);
      if (data.resolutionNote !== undefined) setResEditing(null);
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to update issue');
    } finally {
      setActionLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const totalPages = Math.ceil(total / limit);
  const hasFilters = statusFilter || typeFilter || catFilter || prioFilter;

  return (
    <>
      <div className="page-header">
        <h1>Issues ({total})</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${showInsights ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setShowInsights(!showInsights)}>Insights</button>
          <button className="btn btn-outline" onClick={() => { load(); loadInsights(); }}>Refresh</button>
        </div>
      </div>
      <div className="page-body">

        {/* ── Insights Panel ── */}
        {showInsights && insights && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header">Issue Insights</div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                {/* By Category */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>By Category</div>
                  {['BLOCKER', 'FRICTION', 'TRUST', 'FEATURE'].map((c) => (
                    <div key={c} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.15rem 0', cursor: 'pointer' }}
                      onClick={() => { setCatFilter(c); setShowInsights(false); }}>
                      <span style={{ color: CAT_COLOR[c] }}>{CAT_LABEL[c]}</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{insights.byCategory?.[c] || 0}</span>
                    </div>
                  ))}
                </div>
                {/* By Priority */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>By Priority</div>
                  {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                    <div key={p} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.15rem 0', cursor: 'pointer' }}
                      onClick={() => { setPrioFilter(p); setShowInsights(false); }}>
                      <span style={{ color: PRIORITY_DOT[p] }}>{p}</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{insights.byPriority?.[p] || 0}</span>
                    </div>
                  ))}
                </div>
                {/* By Status */}
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>By Status</div>
                  {['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED'].map((s) => (
                    <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '0.15rem 0', cursor: 'pointer' }}
                      onClick={() => { setStatusFilter(s); setShowInsights(false); }}>
                      <span style={{ color: STATUS_STYLE[s]?.color }}>{STATUS_LABEL[s]}</span>
                      <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{insights.byStatus?.[s] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Frequent issues */}
              {insights.frequent && insights.frequent.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Most Frequent (open/in-progress)
                  </div>
                  {insights.frequent.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem', padding: '0.25rem 0', borderBottom: '1px solid #243041' }}>
                      <span style={{ color: '#FFFFFF', fontWeight: 600, minWidth: 20 }}>{f.count}x</span>
                      <span style={{ color: CAT_COLOR[f.category] || '#A1A1AA', fontSize: '0.7rem', minWidth: 55 }}>{CAT_LABEL[f.category]}</span>
                      <span style={{ color: '#E5E7EB', flex: 1 }}>{f.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Status Cards ── */}
        <div className="stats-grid" style={{ marginBottom: '1rem' }}>
          {['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED'].map((s) => (
            <div key={s} className="stat-card" onClick={() => setStatusFilter(s === statusFilter ? '' : s)} style={{ cursor: 'pointer' }}>
              <div className="stat-label">{STATUS_LABEL[s]}</div>
              <div className="stat-value" style={{ color: STATUS_STYLE[s]?.color }}>{distribution[s] || 0}</div>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }} style={SEL}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={catFilter} onChange={(e) => { setPage(1); setCatFilter(e.target.value); }} style={SEL}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={prioFilter} onChange={(e) => { setPage(1); setPrioFilter(e.target.value); }} style={SEL}>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={typeFilter} onChange={(e) => { setPage(1); setTypeFilter(e.target.value); }} style={SEL}>
            {ISSUE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {hasFilters && (
            <button className="btn btn-outline btn-sm" onClick={() => { setStatusFilter(''); setTypeFilter(''); setCatFilter(''); setPrioFilter(''); setPage(1); }}>
              Clear
            </button>
          )}
        </div>

        {actionError && (
          <div className="alert-inline alert-inline-danger" style={{ marginBottom: '0.75rem' }}>
            {actionError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => setActionError('')}>Dismiss</button>
          </div>
        )}
        {loadError && (
          <div className="alert-inline alert-inline-danger" style={{ marginBottom: '0.75rem' }}>
            {loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={load}>Retry</button>
          </div>
        )}

        {loading ? <div className="loading">Loading issues...</div> : issues.length === 0 ? (
          <div className="card"><div className="card-body" style={{ textAlign: 'center', color: '#71717A', padding: '2rem' }}>
            {hasFilters ? 'No issues match the current filters.' : 'No issues reported yet.'}
          </div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {issues.map((issue) => {
              const sStyle = STATUS_STYLE[issue.status] || {};
              const isExpanded = expandedId === issue.id;
              const pColor = PRIORITY_DOT[issue.priority] || PRIORITY_DOT.MEDIUM;
              return (
                <div key={issue.id} className="card" style={{ cursor: 'pointer', borderLeft: `3px solid ${CAT_COLOR[issue.category] || '#243041'}` }}
                  onClick={() => setExpandedId(isExpanded ? null : issue.id)}>
                  <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                          <span style={{ ...sStyle, padding: '0.15rem 0.55rem', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            {STATUS_LABEL[issue.status]}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: CAT_COLOR[issue.category], fontWeight: 600 }}>
                            {CAT_LABEL[issue.category]}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{TYPE_LABEL[issue.issueType]}</span>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: pColor, display: 'inline-block' }}
                            title={`Priority: ${issue.priority}`} />
                          <span style={{ fontSize: '0.68rem', color: pColor }}>{issue.priority}</span>
                          {issue.organization && <span style={{ fontSize: '0.72rem', color: '#71717A' }}>{issue.organization.name}</span>}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#FFFFFF', lineHeight: 1.4 }}>
                          {isExpanded ? issue.description : (issue.description.length > 120 ? issue.description.slice(0, 120) + '...' : issue.description)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#71717A', marginTop: '0.35rem' }}>
                          {issue.user?.fullName || 'Unknown'}{issue.user?.email ? ` (${issue.user.email})` : ''}
                          {' \u00B7 '}{new Date(issue.createdAt).toLocaleDateString()}{' \u00B7 '}{issue.pageRoute || 'N/A'}
                        </div>

                        {isExpanded && (
                          <div style={{ marginTop: '0.6rem' }} onClick={(e) => e.stopPropagation()}>
                            {/* Admin note */}
                            {noteEditing?.id === issue.id ? (
                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                <textarea value={noteEditing.text} onChange={(e) => setNoteEditing({ id: issue.id, text: e.target.value })}
                                  placeholder="Admin note (visible to reporter)..." rows={2}
                                  style={{ flex: 1, padding: '0.5rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 4, color: '#fff', fontSize: '0.82rem', resize: 'vertical' }} autoFocus />
                                <button className="btn btn-primary btn-sm" disabled={actionLoading[issue.id]}
                                  onClick={() => updateIssue(issue.id, { adminNote: noteEditing.text || '' })}>Save</button>
                                <button className="btn btn-outline btn-sm" onClick={() => setNoteEditing(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ marginBottom: '0.5rem' }}>
                                {issue.adminNote ? (
                                  <div style={{ fontSize: '0.8rem', color: '#A1A1AA', padding: '0.5rem', background: '#1E293B', borderRadius: 4 }}>
                                    <strong>Note:</strong> {issue.adminNote}
                                    <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}
                                      onClick={() => setNoteEditing({ id: issue.id, text: issue.adminNote || '' })}>Edit</button>
                                  </div>
                                ) : (
                                  <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                                    onClick={() => setNoteEditing({ id: issue.id, text: '' })}>+ Note</button>
                                )}
                              </div>
                            )}
                            {/* Resolution note */}
                            {resEditing?.id === issue.id ? (
                              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                                <textarea value={resEditing.text} onChange={(e) => setResEditing({ id: issue.id, text: e.target.value })}
                                  placeholder="What was done to fix this?" rows={2}
                                  style={{ flex: 1, padding: '0.5rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 4, color: '#fff', fontSize: '0.82rem', resize: 'vertical' }} autoFocus />
                                <button className="btn btn-primary btn-sm" disabled={actionLoading[issue.id]}
                                  onClick={() => updateIssue(issue.id, { resolutionNote: resEditing.text || '' })}>Save</button>
                                <button className="btn btn-outline btn-sm" onClick={() => setResEditing(null)}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ marginBottom: '0.5rem' }}>
                                {issue.resolutionNote ? (
                                  <div style={{ fontSize: '0.8rem', color: '#0891b2', padding: '0.5rem', background: '#1E293B', borderRadius: 4 }}>
                                    <strong>Resolution:</strong> {issue.resolutionNote}
                                    <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}
                                      onClick={() => setResEditing({ id: issue.id, text: issue.resolutionNote || '' })}>Edit</button>
                                  </div>
                                ) : (
                                  <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                                    onClick={() => setResEditing({ id: issue.id, text: '' })}>+ Resolution</button>
                                )}
                              </div>
                            )}
                            {/* Category + Priority change */}
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ color: '#A1A1AA' }}>Cat:</span>
                                {['BLOCKER', 'FRICTION', 'TRUST', 'FEATURE'].map((c) => (
                                  <button key={c} className="btn btn-outline btn-sm" disabled={issue.category === c || actionLoading[issue.id]}
                                    style={{ fontSize: '0.68rem', ...(issue.category === c ? { background: CAT_COLOR[c], color: '#fff', borderColor: CAT_COLOR[c] } : {}) }}
                                    onClick={() => updateIssue(issue.id, { category: c })}>{CAT_LABEL[c]}</button>
                                ))}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ color: '#A1A1AA' }}>Priority:</span>
                                {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                                  <button key={p} className="btn btn-outline btn-sm" disabled={issue.priority === p || actionLoading[issue.id]}
                                    style={{ fontSize: '0.68rem', ...(issue.priority === p ? { background: PRIORITY_DOT[p], color: '#fff', borderColor: PRIORITY_DOT[p] } : {}) }}
                                    onClick={() => updateIssue(issue.id, { priority: p })}>{p}</button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Status workflow buttons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                        {issue.status === 'OPEN' && (
                          <button className="btn btn-outline btn-sm" style={{ color: '#F59E0B', borderColor: '#F59E0B', fontSize: '0.72rem' }}
                            disabled={actionLoading[issue.id]} onClick={() => updateIssue(issue.id, { status: 'IN_PROGRESS' })}>
                            {actionLoading[issue.id] ? '...' : 'Start'}
                          </button>
                        )}
                        {issue.status === 'IN_PROGRESS' && (
                          <button className="btn btn-outline btn-sm" style={{ color: '#22C55E', borderColor: '#22C55E', fontSize: '0.72rem' }}
                            disabled={actionLoading[issue.id]} onClick={() => updateIssue(issue.id, { status: 'FIXED' })}>
                            {actionLoading[issue.id] ? '...' : 'Fixed'}
                          </button>
                        )}
                        {issue.status === 'FIXED' && (
                          <button className="btn btn-outline btn-sm" style={{ color: '#059669', borderColor: '#059669', fontSize: '0.72rem' }}
                            disabled={actionLoading[issue.id]} onClick={() => updateIssue(issue.id, { status: 'VERIFIED' })}>
                            {actionLoading[issue.id] ? '...' : 'Verify'}
                          </button>
                        )}
                        {(issue.status === 'FIXED' || issue.status === 'VERIFIED') && (
                          <button className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem' }}
                            disabled={actionLoading[issue.id]} onClick={() => updateIssue(issue.id, { status: 'OPEN' })}>
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
