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
  const [assignFilter, setAssignFilter] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [comments, setComments] = useState({});
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [showComments, setShowComments] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [attachments, setAttachments] = useState({});
  const [showAttachments, setShowAttachments] = useState(null);
  const [uploading, setUploading] = useState(false);
  const limit = 30;

  const load = () => {
    setLoading(true); setLoadError('');
    const params = { limit, page };
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.issueType = typeFilter;
    if (catFilter) params.category = catFilter;
    if (prioFilter) params.priority = prioFilter;
    if (assignFilter === 'me') params.assignedToMe = 'true';
    else if (assignFilter === 'unassigned') params.unassigned = 'true';
    else if (assignFilter) params.assignedToId = assignFilter;

    api.get('/issues', { params })
      .then((res) => { setIssues(res.data.items); setTotal(res.data.total); setDistribution(res.data.distribution || {}); })
      .catch(() => { setLoadError('Failed to load issues'); })
      .finally(() => setLoading(false));
  };

  const loadInsights = () => {
    api.get('/issues/insights').then((res) => setInsights(res.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [page, statusFilter, typeFilter, catFilter, prioFilter, assignFilter]);
  useEffect(() => { loadInsights(); }, []);
  useEffect(() => {
    api.get('/issues/assignees').then((res) => setAssignees(res.data || [])).catch(() => {});
  }, []);

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

  // ── Bulk Operations ──
  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSelectAll = () => {
    if (selectedIds.length === issues.length) setSelectedIds([]);
    else setSelectedIds(issues.map((i) => i.id));
  };

  const executeBulk = async (action) => {
    if (selectedIds.length === 0) return;
    setBulkLoading(true); setActionError('');
    try {
      const payload = { ids: selectedIds };
      if (action === 'close') payload.status = 'VERIFIED';
      else if (action === 'start') payload.status = 'IN_PROGRESS';
      else if (action.startsWith('assign:')) payload.assignedToId = action.slice(7) || null;
      else if (action === 'unassign') payload.assignedToId = null;
      await api.patch('/issues/bulk', payload);
      setSelectedIds([]);
      setBulkAction('');
      load(); loadInsights();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Bulk action failed');
    } finally {
      setBulkLoading(false);
    }
  };

  // ── Comments ──
  const loadComments = async (issueId) => {
    try {
      const res = await api.get(`/issues/${issueId}/comments`);
      setComments((prev) => ({ ...prev, [issueId]: res.data }));
    } catch { /* ignore */ }
  };

  const addComment = async (issueId) => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    try {
      const res = await api.post(`/issues/${issueId}/comments`, { text: commentText.trim() });
      setComments((prev) => ({ ...prev, [issueId]: [...(prev[issueId] || []), res.data] }));
      setCommentText('');
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  const toggleComments = (issueId) => {
    if (showComments === issueId) { setShowComments(null); return; }
    setShowComments(issueId);
    setCommentText('');
    if (!comments[issueId]) loadComments(issueId);
  };

  // ── SLA helper ──
  const ageLabel = (createdAt) => {
    const hrs = Math.round((Date.now() - new Date(createdAt).getTime()) / 3600000);
    if (hrs < 1) return '<1h';
    if (hrs < 24) return `${hrs}h`;
    return `${Math.round(hrs / 24)}d`;
  };

  // ── Notifications ──
  const loadNotifications = () => {
    api.get('/issues/notifications').then((res) => {
      setNotifications(res.data.items || []);
      setUnreadCount(res.data.unreadCount || 0);
    }).catch(() => {});
  };
  useEffect(() => { loadNotifications(); const iv = setInterval(loadNotifications, 60000); return () => clearInterval(iv); }, []);

  const markAllRead = () => {
    api.patch('/issues/notifications/read', {}).then(() => { setUnreadCount(0); setNotifications((n) => n.map((x) => ({ ...x, read: true }))); }).catch(() => {});
  };

  // ── Attachments ──
  const loadAttachments = async (issueId) => {
    try {
      const res = await api.get(`/issues/${issueId}/attachments`);
      setAttachments((prev) => ({ ...prev, [issueId]: res.data }));
    } catch { /* ignore */ }
  };

  const uploadFile = async (issueId, file) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/issues/${issueId}/attachments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAttachments((prev) => ({ ...prev, [issueId]: [...(prev[issueId] || []), res.data] }));
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const toggleAttachments = (issueId) => {
    if (showAttachments === issueId) { setShowAttachments(null); return; }
    setShowAttachments(issueId);
    if (!attachments[issueId]) loadAttachments(issueId);
  };

  // ── SLA breach check ──
  const isBreached = (issue) => {
    if (issue.status === 'FIXED' || issue.status === 'VERIFIED') return false;
    const thresholds = { HIGH: { response: 4, resolve: 24 }, MEDIUM: { response: 12, resolve: 72 }, LOW: { response: 48, resolve: 168 } };
    const t = thresholds[issue.priority] || thresholds.MEDIUM;
    const ageHrs = (Date.now() - new Date(issue.createdAt).getTime()) / 3600000;
    if (!issue.firstResponseAt && ageHrs > t.response) return 'response';
    if (ageHrs > t.resolve) return 'resolve';
    return false;
  };

  const totalPages = Math.ceil(total / limit);
  const hasFilters = statusFilter || typeFilter || catFilter || prioFilter || assignFilter;

  return (
    <>
      <div className="page-header">
        <h1>Issues ({total})</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className={`btn ${showInsights ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setShowInsights(!showInsights)}>Insights</button>
          <div style={{ position: 'relative' }}>
            <button className={`btn ${showNotifs ? 'btn-primary' : 'btn-outline'} btn-sm`}
              onClick={() => setShowNotifs(!showNotifs)} title="Notifications">
              🔔 {unreadCount > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: '50%', padding: '0 0.35rem', fontSize: '0.68rem', marginLeft: '0.2rem' }}>{unreadCount}</span>}
            </button>
            {showNotifs && (
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 320, maxHeight: 350, overflowY: 'auto', background: '#162033', border: '1px solid #243041', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 100 }}>
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #243041', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>Notifications</span>
                  {unreadCount > 0 && <button className="btn btn-outline btn-sm" style={{ fontSize: '0.68rem' }} onClick={markAllRead}>Mark all read</button>}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#71717A', fontSize: '0.82rem' }}>No notifications</div>
                ) : notifications.map((n) => (
                  <div key={n.id} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #1E293B', background: n.read ? 'transparent' : 'rgba(56,189,248,0.05)' }}>
                    <div style={{ fontSize: '0.78rem', color: '#FFFFFF', fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                    <div style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{n.message}</div>
                    <div style={{ fontSize: '0.65rem', color: '#71717A', marginTop: '0.15rem' }}>{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
              {/* SLA Metrics */}
              {insights.sla && (
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '0.6rem 0', borderTop: '1px solid #243041' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase' }}>Avg First Response</div>
                    <div style={{ fontSize: '1.1rem', color: '#38BDF8', fontWeight: 700 }}>
                      {insights.sla.avgFirstResponseHrs !== null ? `${insights.sla.avgFirstResponseHrs}h` : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#71717A' }}>{insights.sla.sampledResponse} issues</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#A1A1AA', fontWeight: 600, textTransform: 'uppercase' }}>Avg Resolution Time</div>
                    <div style={{ fontSize: '1.1rem', color: '#22C55E', fontWeight: 700 }}>
                      {insights.sla.avgResolveHrs !== null ? `${insights.sla.avgResolveHrs}h` : '—'}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#71717A' }}>{insights.sla.sampledResolved} issues</div>
                  </div>
                  {(insights.sla.breachedResponse > 0 || insights.sla.breachedResolve > 0) && (
                    <div style={{ borderLeft: '3px solid #EF4444', paddingLeft: '0.6rem' }}>
                      <div style={{ fontSize: '0.72rem', color: '#EF4444', fontWeight: 600, textTransform: 'uppercase' }}>SLA Breaches</div>
                      {insights.sla.breachedResponse > 0 && (
                        <div style={{ fontSize: '0.82rem', color: '#EF4444' }}>{insights.sla.breachedResponse} awaiting first response</div>
                      )}
                      {insights.sla.breachedResolve > 0 && (
                        <div style={{ fontSize: '0.82rem', color: '#EF4444' }}>{insights.sla.breachedResolve} past resolution deadline</div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
          <select value={assignFilter} onChange={(e) => { setPage(1); setAssignFilter(e.target.value); }} style={SEL}>
            <option value="">All Assignees</option>
            <option value="me">Assigned to Me</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
          {hasFilters && (
            <button className="btn btn-outline btn-sm" onClick={() => { setStatusFilter(''); setTypeFilter(''); setCatFilter(''); setPrioFilter(''); setAssignFilter(''); setPage(1); }}>
              Clear
            </button>
          )}
        </div>

        {/* ── Bulk Action Bar ── */}
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem', padding: '0.6rem 0.85rem', background: '#1E293B', borderRadius: 6 }}>
            <span style={{ fontSize: '0.82rem', color: '#FFFFFF', fontWeight: 600 }}>{selectedIds.length} selected</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} style={{ ...SEL, fontSize: '0.78rem' }}>
              <option value="">Bulk Action...</option>
              <option value="start">Start All</option>
              <option value="close">Close All</option>
              <option value="unassign">Unassign All</option>
              {assignees.map((u) => <option key={u.id} value={`assign:${u.id}`}>Assign → {u.fullName}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" disabled={!bulkAction || bulkLoading}
              onClick={() => executeBulk(bulkAction)}>{bulkLoading ? '...' : 'Apply'}</button>
            <button className="btn btn-outline btn-sm" onClick={() => { setSelectedIds([]); setBulkAction(''); }}>Cancel</button>
          </div>
        )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.25rem' }}>
              <input type="checkbox" checked={selectedIds.length === issues.length && issues.length > 0}
                onChange={toggleSelectAll} title="Select all" style={{ accentColor: '#22C55E' }} />
              <span style={{ fontSize: '0.75rem', color: '#71717A' }}>Select all on page</span>
            </div>
            {issues.map((issue) => {
              const sStyle = STATUS_STYLE[issue.status] || {};
              const isExpanded = expandedId === issue.id;
              const pColor = PRIORITY_DOT[issue.priority] || PRIORITY_DOT.MEDIUM;
              return (
                <div key={issue.id} className="card" style={{ cursor: 'pointer', borderLeft: `3px solid ${CAT_COLOR[issue.category] || '#243041'}` }}
                  onClick={() => setExpandedId(isExpanded ? null : issue.id)}>
                  <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div onClick={(e) => e.stopPropagation()} style={{ paddingTop: '0.15rem' }}>
                        <input type="checkbox" checked={selectedIds.includes(issue.id)}
                          onChange={() => toggleSelect(issue.id)} style={{ accentColor: '#22C55E' }} />
                      </div>
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
                          {issue.assignedTo && (
                            <span style={{ fontSize: '0.72rem', color: '#38BDF8' }} title="Assigned to">→ {issue.assignedTo.fullName}</span>
                          )}
                          {!issue.assignedToId && (
                            <span style={{ fontSize: '0.68rem', color: '#71717A', fontStyle: 'italic' }}>unassigned</span>
                          )}
                          {issue.organization && <span style={{ fontSize: '0.72rem', color: '#71717A' }}>{issue.organization.name}</span>}
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#FFFFFF', lineHeight: 1.4 }}>
                          {isExpanded ? issue.description : (issue.description.length > 120 ? issue.description.slice(0, 120) + '...' : issue.description)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#71717A', marginTop: '0.35rem' }}>
                          {issue.user?.fullName || 'Unknown'}{issue.user?.email ? ` (${issue.user.email})` : ''}
                          {' · '}{new Date(issue.createdAt).toLocaleDateString()}
                          {' · '}<span style={{ color: issue.status === 'OPEN' || issue.status === 'IN_PROGRESS' ? '#F59E0B' : '#71717A' }}>{ageLabel(issue.createdAt)} old</span>
                          {' · '}{issue.pageRoute || 'N/A'}
                          {issue._count?.comments > 0 && <span style={{ color: '#38BDF8' }}>{' · '}{issue._count.comments} comment{issue._count.comments !== 1 ? 's' : ''}</span>}
                          {isBreached(issue) && <span style={{ color: '#EF4444', fontWeight: 600 }}>{' · '}SLA BREACH</span>}
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span style={{ color: '#A1A1AA' }}>Assign:</span>
                                <select value={issue.assignedToId || ''}
                                  disabled={actionLoading[issue.id]}
                                  onChange={(e) => updateIssue(issue.id, { assignedToId: e.target.value || null })}
                                  style={{ ...SEL, fontSize: '0.72rem', padding: '0.25rem 0.5rem', minWidth: 120 }}>
                                  <option value="">Unassigned</option>
                                  {assignees.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                                </select>
                              </div>
                            </div>
                            {/* Attachments */}
                            <div style={{ marginTop: '0.6rem', borderTop: '1px solid #243041', paddingTop: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem' }}
                                  onClick={() => toggleAttachments(issue.id)}>
                                  {showAttachments === issue.id ? 'Hide Files' : 'Files'}
                                </button>
                                <label className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem', cursor: 'pointer' }}>
                                  {uploading ? '...' : '+ Upload'}
                                  <input type="file" hidden accept="image/*,.pdf,.txt"
                                    onChange={(e) => { if (e.target.files[0]) uploadFile(issue.id, e.target.files[0]); e.target.value = ''; }} />
                                </label>
                              </div>
                              {showAttachments === issue.id && (
                                <div style={{ marginTop: '0.4rem' }}>
                                  {(attachments[issue.id] || []).length === 0 ? (
                                    <div style={{ fontSize: '0.78rem', color: '#71717A' }}>No attachments.</div>
                                  ) : (attachments[issue.id] || []).map((a) => (
                                    <div key={a.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.78rem', padding: '0.25rem 0', borderBottom: '1px solid #1E293B' }}>
                                      <a href={`/uploads/issues/${a.filename}`} target="_blank" rel="noopener noreferrer"
                                        style={{ color: '#38BDF8', textDecoration: 'underline' }}>{a.originalName}</a>
                                      <span style={{ color: '#71717A' }}>{(a.sizeBytes / 1024).toFixed(0)} KB</span>
                                      <span style={{ color: '#71717A' }}>{a.user?.fullName}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {/* Comments thread */}
                            <div style={{ marginTop: '0.5rem', borderTop: '1px solid #243041', paddingTop: '0.5rem' }}>
                              <button className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem' }}
                                onClick={() => toggleComments(issue.id)}>
                                {showComments === issue.id ? 'Hide Comments' : `Comments (${issue._count?.comments || 0})`}
                              </button>
                              {showComments === issue.id && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  {(comments[issue.id] || []).length === 0 && (
                                    <div style={{ fontSize: '0.78rem', color: '#71717A', marginBottom: '0.4rem' }}>No comments yet.</div>
                                  )}
                                  {(comments[issue.id] || []).map((c) => (
                                    <div key={c.id} style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', background: '#1E293B', borderRadius: 4, marginBottom: '0.3rem' }}>
                                      <span style={{ fontWeight: 600, color: '#38BDF8' }}>{c.user?.fullName || 'Unknown'}</span>
                                      <span style={{ color: '#71717A', fontSize: '0.68rem', marginLeft: '0.5rem' }}>{new Date(c.createdAt).toLocaleString()}</span>
                                      <div style={{ color: '#E5E7EB', marginTop: '0.15rem' }}>{c.text}</div>
                                    </div>
                                  ))}
                                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                                    <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                                      placeholder="Add a comment..." maxLength={1000}
                                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(issue.id); } }}
                                      style={{ flex: 1, padding: '0.45rem 0.6rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 4, color: '#fff', fontSize: '0.8rem' }} />
                                    <button className="btn btn-primary btn-sm" disabled={commentLoading || !commentText.trim()}
                                      onClick={() => addComment(issue.id)}>{commentLoading ? '...' : 'Post'}</button>
                                  </div>
                                </div>
                              )}
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
