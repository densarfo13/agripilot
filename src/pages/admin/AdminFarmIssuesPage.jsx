/**
 * AdminFarmIssuesPage — NGO / admin inbox for farmer-reported issues.
 *
 * Deliberately separate from the existing /admin/issues page, which
 * tracks product bugs (BUG / DATA_ISSUE / FEATURE_REQUEST etc.). This
 * page is for the crop/farm-issue pipeline:
 *
 *   /admin/farm-issues
 *     • filters: status, crop, severity, location, program
 *     • metrics row: total / open / assigned / resolved / high severity
 *     • assignment: admin picks a field officer id → assignIssue(...)
 *     • re-assignment on escalated issues
 *
 * Field officer registry is intentionally minimal for v1 — the admin
 * types or picks an officer id they know. A proper registry lives in
 * the server invite system and can be wired later without changing
 * the page's contract.
 */

import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from '../../i18n/index.js';
import {
  getIssuesForRole,
  getIssueMetrics,
  assignIssue,
  updateIssueStatus,
  subscribeIssues,
  ISSUE_STATUS,
  ISSUE_SEVERITY,
  ISSUE_TYPES,
} from '../../lib/issues/issueStore.js';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

function useIssues() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeIssues(() => setTick((n) => n + 1));
    return unsub;
  }, []);
  return tick;
}

export default function AdminFarmIssuesPage() {
  const { t } = useTranslation();
  const tick = useIssues();

  const [filters, setFilters] = useState({
    status: '', crop: '', severity: '', location: '', program: '',
  });
  const [assignDraft, setAssignDraft] = useState({}); // { [issueId]: 'officer_id' }

  const issues = useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const _ = tick;
    return getIssuesForRole('admin', {
      status:   filters.status   || null,
      crop:     filters.crop     || null,
      severity: filters.severity || null,
      location: filters.location || null,
      program:  filters.program  || null,
    });
  }, [tick, filters]);

  const metrics = useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const _ = tick;
    // Metrics read from the full store, not the filtered view, so the
    // row above the table reflects the program, not whatever slice is
    // currently visible.
    return getIssueMetrics();
  }, [tick]);

  // Derive filter option lists from the current dataset so the
  // dropdowns never offer a value that doesn't exist.
  const allIssues = useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const _ = tick;
    return getIssuesForRole('admin');
  }, [tick]);
  const cropOptions     = unique(allIssues.map((i) => i.crop).filter(Boolean));
  const locationOptions = unique(allIssues.map((i) => i.location).filter(Boolean));
  const programOptions  = unique(allIssues.map((i) => i.program).filter(Boolean));

  function handleAssign(issueId) {
    const officerId = (assignDraft[issueId] || '').trim();
    if (!officerId) return;
    assignIssue(issueId, officerId, { adminId: 'admin' });
    setAssignDraft((d) => ({ ...d, [issueId]: '' }));
  }

  function handleStatus(issueId, next) {
    updateIssueStatus(issueId, next, { authorRole: 'admin', authorId: 'admin' });
  }

  const titleLbl      = resolve(t, 'issues.admin.title',    'Farm issues');
  const subLbl        = resolve(t, 'issues.admin.subtitle', 'Triage, assign, and follow up.');
  const emptyLbl      = resolve(t, 'issues.admin.empty',    'No issues match these filters.');
  const filterBarLbl  = resolve(t, 'issues.admin.filters',  'Filters');
  const assignBtnLbl  = resolve(t, 'issues.admin.assign',   'Assign');
  const resolveBtnLbl = resolve(t, 'issues.admin.resolve',  'Mark resolved');
  const officerIdPlaceholder = resolve(t, 'issues.admin.officerIdPlaceholder',
    'Officer id (e.g. ofc_1)');

  return (
    <main style={S.page} data-screen="admin-farm-issues">
      <h1 style={S.title}>{titleLbl}</h1>
      <p style={S.sub}>{subLbl}</p>

      <section style={S.metricsRow} data-testid="admin-issue-metrics">
        <Metric label={resolve(t, 'issues.admin.metrics.total',    'Total')}    value={metrics.total} />
        <Metric label={resolve(t, 'issues.admin.metrics.open',     'Open')}     value={metrics.open}    tone="warn" />
        <Metric label={resolve(t, 'issues.admin.metrics.assigned', 'Assigned')} value={metrics.assigned} tone="info" />
        <Metric label={resolve(t, 'issues.admin.metrics.resolved', 'Resolved')} value={metrics.resolved} tone="good" />
        <Metric label={resolve(t, 'issues.admin.metrics.high',     'High severity')} value={metrics.highSeverity} tone="danger" />
        {metrics.avgResponseMs != null && (
          <Metric
            label={resolve(t, 'issues.admin.metrics.avgResponse', 'Avg response')}
            value={formatDuration(metrics.avgResponseMs)}
          />
        )}
      </section>

      <section style={S.filterBar} data-testid="admin-issue-filters">
        <div style={S.filterLbl}>{filterBarLbl}</div>
        <Select
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          label={resolve(t, 'issues.admin.filter.status', 'Status')}
          options={['', ...Object.values(ISSUE_STATUS)]}
          optionLabel={(v) => v ? resolve(t, `issues.status.${v}`, humanize(v)) : resolve(t, 'common.all', 'All')}
          testId="admin-filter-status"
        />
        <Select
          value={filters.crop}
          onChange={(v) => setFilters((f) => ({ ...f, crop: v }))}
          label={resolve(t, 'issues.admin.filter.crop', 'Crop')}
          options={['', ...cropOptions]}
          optionLabel={(v) => v || resolve(t, 'common.all', 'All')}
          testId="admin-filter-crop"
        />
        <Select
          value={filters.severity}
          onChange={(v) => setFilters((f) => ({ ...f, severity: v }))}
          label={resolve(t, 'issues.admin.filter.severity', 'Severity')}
          options={['', ...Object.values(ISSUE_SEVERITY)]}
          optionLabel={(v) => v ? resolve(t, `issues.severity.${v}`, humanize(v)) : resolve(t, 'common.all', 'All')}
          testId="admin-filter-severity"
        />
        <Select
          value={filters.location}
          onChange={(v) => setFilters((f) => ({ ...f, location: v }))}
          label={resolve(t, 'issues.admin.filter.location', 'Location')}
          options={['', ...locationOptions]}
          optionLabel={(v) => v || resolve(t, 'common.all', 'All')}
          testId="admin-filter-location"
        />
        <Select
          value={filters.program}
          onChange={(v) => setFilters((f) => ({ ...f, program: v }))}
          label={resolve(t, 'issues.admin.filter.program', 'Program')}
          options={['', ...programOptions]}
          optionLabel={(v) => v || resolve(t, 'common.all', 'All')}
          testId="admin-filter-program"
        />
      </section>

      {issues.length === 0 ? (
        <p style={S.empty} data-testid="admin-issues-empty">{emptyLbl}</p>
      ) : (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <Th>{resolve(t, 'issues.admin.col.farmer',    'Farmer')}</Th>
                <Th>{resolve(t, 'issues.admin.col.crop',      'Crop')}</Th>
                <Th>{resolve(t, 'issues.admin.col.location',  'Location')}</Th>
                <Th>{resolve(t, 'issues.admin.col.severity',  'Severity')}</Th>
                <Th>{resolve(t, 'issues.admin.col.status',    'Status')}</Th>
                <Th>{resolve(t, 'issues.admin.col.assignedTo','Assigned to')}</Th>
                <Th>{resolve(t, 'issues.admin.col.createdAt', 'Created')}</Th>
                <Th>{resolve(t, 'issues.admin.col.actions',   'Actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} data-testid={`admin-issue-row-${issue.id}`}>
                  <Td>{issue.farmerName || issue.farmerId || '—'}</Td>
                  <Td>{issue.crop || '—'}</Td>
                  <Td>{issue.location || '—'}</Td>
                  <Td>
                    <span style={{ ...S.pill, ...severityStyle(issue.severity) }}>
                      {resolve(t, `issues.severity.${issue.severity}`, humanize(issue.severity))}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ ...S.pill, ...statusStyle(issue.status) }}>
                      {resolve(t, `issues.status.${issue.status}`, humanize(issue.status))}
                    </span>
                  </Td>
                  <Td>{issue.assignedTo || '—'}</Td>
                  <Td>{formatDate(issue.createdAt)}</Td>
                  <Td>
                    <div style={S.actionsCell}>
                      {(issue.status === ISSUE_STATUS.OPEN
                        || issue.status === ISSUE_STATUS.ESCALATED
                        || issue.status === ISSUE_STATUS.ASSIGNED) && (
                        <div style={S.assignRow}>
                          <input
                            type="text"
                            value={assignDraft[issue.id] || ''}
                            onChange={(e) => setAssignDraft((d) => ({ ...d, [issue.id]: e.target.value }))}
                            placeholder={officerIdPlaceholder}
                            style={S.smallInput}
                            data-testid={`admin-assign-input-${issue.id}`}
                          />
                          <button
                            type="button"
                            onClick={() => handleAssign(issue.id)}
                            style={S.smallPrimary}
                            data-testid={`admin-assign-btn-${issue.id}`}
                          >
                            {assignBtnLbl}
                          </button>
                        </div>
                      )}
                      {issue.status !== ISSUE_STATUS.RESOLVED && (
                        <button
                          type="button"
                          onClick={() => handleStatus(issue.id, ISSUE_STATUS.RESOLVED)}
                          style={S.smallGhost}
                          data-testid={`admin-resolve-${issue.id}`}
                        >
                          {resolveBtnLbl}
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// ─── Small helpers ───────────────────────────────────────────────
function unique(xs) {
  const seen = new Set();
  const out = [];
  for (const x of xs) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}
function humanize(s) { return String(s || '').replace(/_/g, ' '); }
function formatDate(ts) {
  try { return new Date(ts).toLocaleDateString(); } catch { return ''; }
}
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const h = Math.round(ms / (1000 * 60 * 60));
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}
function severityStyle(sev) {
  switch (sev) {
    case 'high':   return { background: 'rgba(239,68,68,0.15)',  color: '#FCA5A5' };
    case 'medium': return { background: 'rgba(245,158,11,0.15)', color: '#FDE68A' };
    default:       return { background: 'rgba(34,197,94,0.15)',  color: '#86EFAC' };
  }
}
function statusStyle(status) {
  switch (status) {
    case 'resolved':    return { background: 'rgba(34,197,94,0.15)',  color: '#86EFAC' };
    case 'in_progress': return { background: 'rgba(245,158,11,0.15)', color: '#FDE68A' };
    case 'assigned':    return { background: 'rgba(59,130,246,0.15)', color: '#93C5FD' };
    case 'escalated':   return { background: 'rgba(239,68,68,0.15)',  color: '#FCA5A5' };
    default:            return { background: 'rgba(255,255,255,0.08)', color: '#CBD5E1' };
  }
}

function Metric({ label, value, tone }) {
  const toneExtra =
    tone === 'warn'   ? { borderColor: 'rgba(245,158,11,0.4)',  background: 'rgba(245,158,11,0.08)' }
  : tone === 'info'   ? { borderColor: 'rgba(59,130,246,0.4)',  background: 'rgba(59,130,246,0.08)' }
  : tone === 'good'   ? { borderColor: 'rgba(34,197,94,0.4)',   background: 'rgba(34,197,94,0.08)'  }
  : tone === 'danger' ? { borderColor: 'rgba(239,68,68,0.4)',   background: 'rgba(239,68,68,0.08)'  }
  : null;
  return (
    <div style={{ ...S.metric, ...toneExtra }}>
      <div style={S.metricLabel}>{label}</div>
      <div style={S.metricValue}>{value}</div>
    </div>
  );
}

function Select({ label, value, onChange, options, optionLabel, testId }) {
  return (
    <label style={S.filterLabel}>
      <span style={S.filterLabelText}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={S.smallSelect}
        data-testid={testId}
      >
        {options.map((opt) => (
          <option key={opt || '__all__'} value={opt}>
            {optionLabel ? optionLabel(opt) : (opt || 'All')}
          </option>
        ))}
      </select>
    </label>
  );
}

function Th({ children }) {
  return <th style={S.th}>{children}</th>;
}
function Td({ children }) {
  return <td style={S.td}>{children}</td>;
}

const S = {
  page:    { maxWidth: 1000, margin: '0 auto', padding: '24px 20px 40px',
             minHeight: '100vh', background: '#0B1D34', color: '#fff',
             boxSizing: 'border-box' },
  title:   { margin: '0 0 6px', fontSize: 22, fontWeight: 700 },
  sub:     { margin: '0 0 18px', color: 'rgba(255,255,255,0.65)', fontSize: 14 },
  metricsRow: { display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 10, marginBottom: 18 },
  metric:  { padding: '0.875rem 1rem', borderRadius: 12,
             border: '1px solid rgba(255,255,255,0.08)',
             background: 'rgba(255,255,255,0.04)' },
  metricLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 },
  metricValue: { fontSize: 22, fontWeight: 700, marginTop: 4 },
  filterBar: { display: 'flex', gap: 10, flexWrap: 'wrap',
               alignItems: 'flex-end', marginBottom: 14,
               padding: '10px 12px', borderRadius: 12,
               background: 'rgba(255,255,255,0.04)',
               border: '1px solid rgba(255,255,255,0.08)' },
  filterLbl: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
               width: '100%' },
  filterLabel: { display: 'flex', flexDirection: 'column', gap: 4 },
  filterLabelText: { fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600 },
  smallSelect: { padding: '6px 10px', borderRadius: 8,
                 border: '1px solid rgba(255,255,255,0.15)',
                 background: 'rgba(255,255,255,0.05)', color: '#fff',
                 fontSize: 13 },
  smallInput:  { padding: '6px 8px', borderRadius: 8,
                 border: '1px solid rgba(255,255,255,0.15)',
                 background: 'rgba(255,255,255,0.05)', color: '#fff',
                 fontSize: 13, maxWidth: 140 },
  smallPrimary: { padding: '6px 10px', borderRadius: 8, border: 'none',
                  background: '#22C55E', color: '#000', fontSize: 12,
                  fontWeight: 700, cursor: 'pointer' },
  smallGhost:   { padding: '6px 10px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'transparent', color: 'rgba(255,255,255,0.85)',
                  fontSize: 12, cursor: 'pointer' },
  assignRow:   { display: 'flex', gap: 6, flexWrap: 'wrap' },
  actionsCell: { display: 'flex', flexDirection: 'column', gap: 4 },
  tableWrap: { overflowX: 'auto' },
  table:    { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:       { textAlign: 'left', padding: '8px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.12)',
              fontWeight: 700, color: 'rgba(255,255,255,0.8)',
              fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  td:       { padding: '8px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.88)', verticalAlign: 'top' },
  pill:     { display: 'inline-block', padding: '2px 8px', borderRadius: 999,
              fontSize: 11, fontWeight: 700, letterSpacing: 0.3 },
  empty:    { padding: '1rem', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.65)', textAlign: 'center' },
};
