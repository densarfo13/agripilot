import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { useOrgStore } from '../store/orgStore.js';

// ─── Status config ────────────────────────────────────────

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', bg: '#f3f4f6', color: '#4b5563' },
  pass:         { label: 'Pass',        bg: '#d1fae5', color: '#065f46' },
  fail:         { label: 'Fail',        bg: '#fee2e2', color: '#991b1b' },
  blocked:      { label: 'Blocked',     bg: '#fef3c7', color: '#92400e' },
  not_applicable:{ label: 'N/A',        bg: '#ede9fe', color: '#5b21b6' },
};

const STATUS_OPTIONS = ['not_started', 'pass', 'fail', 'blocked', 'not_applicable'];

const CATEGORY_META = {
  org_setup:          { label: 'A. Organization Setup',   color: '#1d4ed8' },
  user_onboarding:    { label: 'B. User Onboarding',      color: '#059669' },
  invite_delivery:    { label: 'C. Invite Delivery',      color: '#0891b2' },
  farmer_first_use:   { label: 'D. Farmer First Use',     color: '#7c3aed' },
  officer_workflow:   { label: 'E. Officer Workflow',     color: '#d97706' },
  reviewer_workflow:  { label: 'F. Reviewer Workflow',    color: '#be185d' },
  admin_visibility:   { label: 'G. Admin Visibility',     color: '#374151' },
  security_access:    { label: 'H. Security & Access',    color: '#dc2626' },
  country_phone:      { label: 'I. Country & Phone',      color: '#2563eb' },
  season_lifecycle:   { label: 'J. Season Lifecycle',     color: '#16a34a' },
  image_evidence:     { label: 'K. Image & Evidence',     color: '#ea580c' },
  monitoring_failure: { label: 'L. Monitoring & Failures',color: '#6366f1' },
};

// Quick-link destinations for categories where a direct follow-up page exists
const CATEGORY_LINKS = {
  invite_delivery:    { to: '/farmers',            label: 'Farmers List' },
  farmer_first_use:   { to: '/farmers',            label: 'Farmers List' },
  officer_workflow:   { to: '/pilot-metrics',      label: 'Needs Attention' },
  reviewer_workflow:  { to: '/verification-queue', label: 'Verification Queue' },
  admin_visibility:   { to: '/pilot-metrics',      label: 'Pilot Metrics' },
  security_access:    { to: '/admin/security',     label: 'Security Requests' },
  monitoring_failure: { to: '/audit',              label: 'Audit Trail' },
};

// ─── Helper components ────────────────────────────────────

function StatusBadge({ status, small }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  return (
    <span style={{
      display: 'inline-block',
      padding: small ? '0.1rem 0.5rem' : '0.2rem 0.6rem',
      borderRadius: 12,
      fontSize: small ? '0.7rem' : '0.75rem',
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function HealthTile({ label, value, sub, warn }) {
  return (
    <div style={{
      background: warn ? '#fffbeb' : '#f9fafb',
      border: `1px solid ${warn ? '#fde68a' : '#e5e7eb'}`,
      borderRadius: 8, padding: '0.5rem 0.9rem', textAlign: 'center', minWidth: 90,
    }}>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: warn ? '#92400e' : '#111827' }}>{value ?? '—'}</div>
      <div style={{ fontSize: '0.68rem', color: '#6b7280', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{sub}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function PilotQAPage() {
  const [items, setItems] = useState([]);
  const [health, setHealth] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState({});
  const [expanded, setExpanded] = useState({});  // { [category]: bool }
  const [noteOpen, setNoteOpen] = useState({});  // { [itemKey]: bool }
  const [noteDraft, setNoteDraft] = useState({}); // { [itemKey]: string }
  const [reportOpen, setReportOpen] = useState(true);

  const user = useAuthStore(s => s.user);
  const { selectedOrgId } = useOrgStore();
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';

  // Effective org ID to scope requests
  const orgParam = isSuperAdmin && selectedOrgId ? `?orgId=${selectedOrgId}` : '';

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/pilot-qa/checklist${orgParam}`),
      api.get(`/pilot-qa/health${orgParam}`),
      api.get(`/pilot-qa/report${orgParam}`),
    ])
      .then(([cRes, hRes, rRes]) => {
        setItems(cRes.data);
        setHealth(hRes.data);
        setReport(rRes.data);
      })
      .catch(() => setError('Failed to load pilot QA data'))
      .finally(() => setLoading(false));
  }, [orgParam]);

  useEffect(() => { load(); }, [load]);

  // Group items by category (preserves CATEGORY_META order)
  const grouped = useMemo(() => {
    const g = {};
    for (const item of items) {
      if (!g[item.category]) g[item.category] = [];
      g[item.category].push(item);
    }
    return g;
  }, [items]);

  const categoryOrder = Object.keys(CATEGORY_META);

  // Save a single item
  const saveItem = async (itemKey, patch) => {
    setSaving(s => ({ ...s, [itemKey]: true }));
    try {
      const body = { ...patch };
      if (isSuperAdmin && selectedOrgId) body.organizationId = selectedOrgId;
      const res = await api.patch(`/pilot-qa/checklist/${encodeURIComponent(itemKey)}`, body);
      setItems(prev => prev.map(i =>
        i.itemKey === itemKey
          ? { ...i, status: res.data.status, notes: res.data.notes, updatedAt: res.data.updatedAt, updatedBy: res.data.updatedBy, suggestedStatus: null }
          : i
      ));
      // Refresh report silently
      api.get(`/pilot-qa/report${orgParam}`).then(r => setReport(r.data)).catch(() => {});
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(s => ({ ...s, [itemKey]: false }));
    }
  };

  const toggleCategory = (cat) => setExpanded(e => ({ ...e, [cat]: !e[cat] }));
  const expandAll  = () => setExpanded(Object.fromEntries(categoryOrder.map(c => [c, true])));
  const collapseAll = () => setExpanded({});

  const catStats = useMemo(() => {
    const stats = {};
    for (const cat of categoryOrder) {
      const catItems = grouped[cat] ?? [];
      stats[cat] = {
        total: catItems.length,
        pass: catItems.filter(i => i.status === 'pass').length,
        fail: catItems.filter(i => i.status === 'fail').length,
        blocked: catItems.filter(i => i.status === 'blocked').length,
      };
    }
    return stats;
  }, [grouped]);

  if (loading) return <div className="loading">Loading Pilot QA...</div>;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Pilot QA Checklist</h1>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}>
            Internal pilot readiness &amp; field validation — admin only
          </div>
        </div>
        <div className="flex gap-1">
          <button className="btn btn-outline btn-sm" onClick={expandAll}>Expand All</button>
          <button className="btn btn-outline btn-sm" onClick={collapseAll}>Collapse All</button>
          <button className="btn btn-primary btn-sm" onClick={load}>Refresh</button>
        </div>
      </div>

      <div className="page-body">
        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* ── Health Indicators ── */}
        {health && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: '0.5rem' }}>
              Live Health Indicators
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <HealthTile
                label="Invites Accepted"
                value={`${health.invitesAccepted}/${health.invitesSent}`}
                sub={health.inviteAcceptRate !== null ? `${health.inviteAcceptRate}%` : null}
                warn={health.invitesSent > 0 && health.inviteAcceptRate < 50}
              />
              <HealthTile label="First Update" value={health.farmersFirstUpdate} />
              <HealthTile label="Active Seasons" value={health.activeSeasons} />
              <HealthTile label="Stale Seasons" value={health.staleSeasons} warn={health.staleSeasons > 0} />
              <HealthTile label="Overdue Validations" value={health.overdueValidations} warn={health.overdueValidations > 0} />
              <HealthTile label="Pending Reviews" value={health.pendingReviews} warn={health.pendingReviews > 5} />
              <HealthTile label="Checklist Fail" value={health.checklistFail} warn={health.checklistFail > 0} />
              <HealthTile label="Checklist Blocked" value={health.checklistBlocked} warn={health.checklistBlocked > 0} />
            </div>
          </div>
        )}

        {/* ── Validation Report ── */}
        {report && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div
              className="card-header"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setReportOpen(o => !o)}
            >
              <span>Validation Report</span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {report.passRate !== null && (
                  <span style={{
                    padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700,
                    background: report.passRate >= 80 ? '#d1fae5' : report.passRate >= 50 ? '#fef3c7' : '#fee2e2',
                    color:      report.passRate >= 80 ? '#065f46' : report.passRate >= 50 ? '#92400e'  : '#991b1b',
                  }}>
                    {report.passRate}% pass rate
                  </span>
                )}
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{reportOpen ? '▲' : '▼'}</span>
              </div>
            </div>
            {reportOpen && (
              <div className="card-body">
                {/* Summary row */}
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {[
                    ['Total', report.total, '#374151'],
                    ['Pass', report.pass, '#065f46'],
                    ['Fail', report.fail, '#991b1b'],
                    ['Blocked', report.blocked, '#92400e'],
                    ['Not Started', report.not_started, '#4b5563'],
                    ['N/A', report.not_applicable, '#5b21b6'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{val}</div>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  {/* Top failures */}
                  {report.topFailCategories.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.35rem' }}>Top Failures</div>
                      {report.topFailCategories.map(c => (
                        <div key={c.category} style={{ fontSize: '0.8rem', color: '#374151', marginBottom: '0.2rem' }}>
                          {c.label} <span style={{ color: '#991b1b', fontWeight: 600 }}>({c.count})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Top blocked */}
                  {report.topBlockedCategories.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', marginBottom: '0.35rem' }}>Top Blocked</div>
                      {report.topBlockedCategories.map(c => (
                        <div key={c.category} style={{ fontSize: '0.8rem', color: '#374151', marginBottom: '0.2rem' }}>
                          {c.label} <span style={{ color: '#92400e', fontWeight: 600 }}>({c.count})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Key risks */}
                  {report.keyRisks.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.35rem' }}>Untested Areas</div>
                      {report.keyRisks.map(c => (
                        <div key={c.category} style={{ fontSize: '0.8rem', color: '#374151', marginBottom: '0.2rem' }}>
                          {c.label} <span style={{ color: '#6b7280' }}>({c.untested} untested)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Checklist Categories ── */}
        {categoryOrder.map(cat => {
          const catItems = grouped[cat] ?? [];
          if (catItems.length === 0) return null;
          const meta  = CATEGORY_META[cat];
          const stats = catStats[cat];
          const isOpen = !!expanded[cat];
          const link = CATEGORY_LINKS[cat];

          return (
            <div key={cat} className="card" style={{ marginBottom: '0.75rem' }}>
              {/* Category header */}
              <div
                className="card-header"
                style={{ cursor: 'pointer', userSelect: 'none', borderLeft: `3px solid ${meta.color}` }}
                onClick={() => toggleCategory(cat)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: meta.color }}>{meta.label}</span>
                  {link && (
                    <span
                      onClick={e => { e.stopPropagation(); navigate(link.to); }}
                      style={{ fontSize: '0.7rem', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      {link.label} →
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 600 }}>{stats.pass}/{stats.total} pass</span>
                  {stats.fail > 0 && <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>{stats.fail} fail</span>}
                  {stats.blocked > 0 && <span style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600 }}>{stats.blocked} blocked</span>}
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Items table */}
              {isOpen && (
                <div className="card-body" style={{ padding: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {catItems.map((item, idx) => {
                        const isSaving = !!saving[item.itemKey];
                        const noteIsOpen = !!noteOpen[item.itemKey];
                        const draft = noteDraft[item.itemKey] ?? item.notes ?? '';

                        return (
                          <React.Fragment key={item.itemKey}>
                            <tr style={{
                              borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
                              background: item.status === 'fail' ? '#fff5f5' : item.status === 'blocked' ? '#fffdf0' : 'white',
                            }}>
                              {/* Label + description */}
                              <td style={{ padding: '0.6rem 1rem', width: '40%' }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{item.label}</div>
                                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.1rem' }}>{item.description}</div>
                                {item.suggestedStatus && (
                                  <div style={{ marginTop: '0.25rem' }}>
                                    <span style={{
                                      fontSize: '0.68rem', fontWeight: 600, padding: '0.1rem 0.4rem', borderRadius: 10,
                                      background: item.suggestedStatus === 'pass' ? '#d1fae5' : '#fee2e2',
                                      color: item.suggestedStatus === 'pass' ? '#065f46' : '#991b1b',
                                    }}>
                                      auto: {item.suggestedStatus}
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Status select */}
                              <td style={{ padding: '0.6rem 0.5rem', width: '160px' }}>
                                <select
                                  value={item.status}
                                  disabled={isSaving}
                                  onChange={e => saveItem(item.itemKey, { status: e.target.value, notes: item.notes })}
                                  style={{
                                    padding: '0.3rem 0.5rem', fontSize: '0.8rem', borderRadius: 6, cursor: 'pointer',
                                    border: '1px solid #d1d5db', width: '100%',
                                    background: STATUS_CONFIG[item.status]?.bg || '#f3f4f6',
                                    color: STATUS_CONFIG[item.status]?.color || '#374151',
                                    fontWeight: 600, opacity: isSaving ? 0.6 : 1,
                                  }}
                                >
                                  {STATUS_OPTIONS.map(s => (
                                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Notes toggle + last updated */}
                              <td style={{ padding: '0.6rem 0.5rem' }}>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => {
                                    setNoteOpen(n => ({ ...n, [item.itemKey]: !n[item.itemKey] }));
                                    if (!noteOpen[item.itemKey]) {
                                      setNoteDraft(d => ({ ...d, [item.itemKey]: item.notes ?? '' }));
                                    }
                                  }}
                                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                                >
                                  {item.notes ? '📝 Note' : '+ Note'}
                                </button>
                              </td>

                              {/* Last updated */}
                              <td style={{ padding: '0.6rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                {item.updatedAt && (
                                  <div style={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                                    {new Date(item.updatedAt).toLocaleDateString()}
                                    {item.updatedBy && <span> · {item.updatedBy.fullName}</span>}
                                  </div>
                                )}
                                {isSaving && <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>saving…</span>}
                              </td>
                            </tr>

                            {/* Inline notes row */}
                            {noteIsOpen && (
                              <tr style={{ background: '#fafafa', borderTop: '1px dashed #e5e7eb' }}>
                                <td colSpan={4} style={{ padding: '0.5rem 1rem 0.75rem' }}>
                                  <textarea
                                    rows={2}
                                    value={draft}
                                    onChange={e => setNoteDraft(d => ({ ...d, [item.itemKey]: e.target.value }))}
                                    placeholder="Add notes, test date, tester name, observed issue…"
                                    className="form-input"
                                    style={{ width: '100%', fontSize: '0.8rem', resize: 'vertical', minHeight: 52 }}
                                  />
                                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      disabled={isSaving}
                                      onClick={() => {
                                        saveItem(item.itemKey, { status: item.status, notes: draft });
                                        setNoteOpen(n => ({ ...n, [item.itemKey]: false }));
                                      }}
                                    >
                                      Save Note
                                    </button>
                                    <button
                                      className="btn btn-outline btn-sm"
                                      onClick={() => setNoteOpen(n => ({ ...n, [item.itemKey]: false }))}
                                    >
                                      Cancel
                                    </button>
                                    {item.notes && (
                                      <button
                                        className="btn btn-outline btn-sm"
                                        style={{ color: '#6b7280' }}
                                        disabled={isSaving}
                                        onClick={() => {
                                          saveItem(item.itemKey, { status: item.status, notes: null });
                                          setNoteOpen(n => ({ ...n, [item.itemKey]: false }));
                                          setNoteDraft(d => ({ ...d, [item.itemKey]: '' }));
                                        }}
                                      >
                                        Clear Note
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
