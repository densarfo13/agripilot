import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from 'recharts';
import api from '../api/client.js';
import { useOrgStore } from '../store/orgStore.js';

// ─── Labels & Colors ────────────────────────────────────

const GENDER_LABELS = {
  male: 'Male', female: 'Female', other: 'Other',
  prefer_not_to_say: 'Prefer not to say', unknown: 'Not specified',
};
const REG_STATUS_LABELS = {
  pending_approval: 'Pending Approval', approved: 'Approved',
  rejected: 'Rejected', disabled: 'Disabled',
};
const GENDER_COLORS = {
  male: '#3B82F6', female: '#EC4899', other: '#8B5CF6',
  prefer_not_to_say: '#6B7280', unknown: '#374151',
};
const AGE_LABELS = {
  '18-24': '18-24', '25-34': '25-34', '35-44': '35-44',
  '45-54': '45-54', '55+': '55+', unknown: 'Unknown',
};
const FILTER_LABELS = {
  gender: 'Gender', ageGroup: 'Age', region: 'Region',
  crop: 'Crop', registrationStatus: 'Reg. Status', dateFrom: 'From', dateTo: 'To',
};
const FILTER_DISPLAY = {
  gender: v => GENDER_LABELS[v] || v,
  registrationStatus: v => REG_STATUS_LABELS[v] || v,
};

const CHART_TOOLTIP = {
  contentStyle: { background: '#1E293B', border: '1px solid #334155', borderRadius: 8, fontSize: '0.82rem' },
};

const EMPTY_FILTERS = { gender: '', ageGroup: '', crop: '', region: '', registrationStatus: '', dateFrom: '', dateTo: '' };

// ─── Page ───────────────────────────────────────────────

export default function ImpactDashboardPage() {
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState(null);
  const [trendsError, setTrendsError] = useState(false);
  const [filterOpts, setFilterOpts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { selectedOrgName } = useOrgStore();
  const navigate = useNavigate();
  const loaded = useRef(false);

  // Fetch filter options + trends once on mount (org-wide, not filter-dependent)
  useEffect(() => {
    api.get('/impact/filters').then(r => setFilterOpts(r.data)).catch(() => {});
    api.get('/impact/trends').then(r => setTrends(r.data)).catch(() => setTrendsError(true));
  }, []);

  // Fetch dashboard data (responds to filter changes)
  useEffect(() => {
    const fetchDashboard = async () => {
      if (loaded.current) setRefreshing(true); else setLoading(true);
      setError('');
      try {
        const p = new URLSearchParams();
        Object.entries(applied).forEach(([k, v]) => { if (v) p.set(k, v); });
        const qs = p.toString() ? `?${p}` : '';
        const r = await api.get(`/impact/dashboard${qs}`);
        setData(r.data);
        loaded.current = true;
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load impact data.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    fetchDashboard();
  }, [applied]);

  const applyFilters = () => { setApplied({ ...filters }); setFiltersOpen(false); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setApplied({}); };
  const removeFilter = (key) => {
    const next = { ...applied, [key]: '' };
    setFilters(f => ({ ...f, [key]: '' }));
    setApplied(next);
  };
  const retry = () => setApplied(prev => ({ ...prev }));
  const hasFilters = Object.values(applied).some(Boolean);
  const activeFilterCount = Object.values(applied).filter(Boolean).length;

  // ── Export ──
  const exportCSV = async () => {
    setExporting(true);
    setExportDone(false);
    try {
      const p = new URLSearchParams();
      Object.entries(applied).forEach(([k, v]) => { if (v) p.set(k, v); });
      const qs = p.toString() ? `?${p}` : '';
      const res = await api.get(`/impact/export${qs}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `impact-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ─── Loading state (first load) ───────────────────────

  if (loading && !data) {
    return (
      <div className="page-body">
        <div className="page-header"><h1>Impact Dashboard</h1></div>
        <div className="stats-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="stat-card skeleton" style={{ height: 96 }} />)}
        </div>
      </div>
    );
  }

  // ─── Error state with retry ───────────────────────────

  if (error && !data) {
    return (
      <div className="page-body">
        <div className="page-header"><h1>Impact Dashboard</h1></div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ color: '#EF4444', marginBottom: '0.75rem' }}>{error}</div>
            <button className="btn btn-primary btn-sm" onClick={() => retry()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const s = data?.summary || {};
  const demo = data?.demographics || {};
  const part = data?.participation || {};
  const attn = data?.needsAttention || {};
  const trendPts = trends?.trends || [];
  const isEmpty = s.totalFarmers === 0;

  // Chart data
  const genderData = Object.entries(demo.gender || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: GENDER_LABELS[k] || k, value: v, fill: GENDER_COLORS[k] || '#6B7280' }));

  const ageData = Object.entries(demo.ageGroup || {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: AGE_LABELS[k] || k, value: v }));

  const activeByGender = Object.entries(part.activeRateByGender || {})
    .filter(([, v]) => v.total > 0)
    .map(([k, v]) => ({ name: GENDER_LABELS[k] || k, ...v }));

  const activeByAge = Object.entries(part.activeRateByAge || {})
    .filter(([, v]) => v.total > 0)
    .map(([k, v]) => ({ name: AGE_LABELS[k] || k, ...v }));

  return (
    <div className="page-body">

      {/* ── Header ───────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Impact Dashboard</h1>
          {selectedOrgName && <span style={{ color: '#A1A1AA', fontSize: '0.85rem' }}>{selectedOrgName}</span>}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {refreshing && <span style={{ fontSize: '0.78rem', color: '#A1A1AA' }}>Updating...</span>}
          {exportDone && <span style={{ fontSize: '0.78rem', color: '#22C55E' }}>Exported!</span>}
          <button className="btn btn-outline btn-sm" onClick={exportCSV} disabled={exporting || isEmpty}>
            {exporting ? 'Exporting...' : 'Export Report'}
          </button>
        </div>
      </div>

      {/* ── Filters toggle + panel ───────────────────────── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div
          className="card-header hover-row"
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Filters
            {activeFilterCount > 0 && (
              <span style={{ background: '#3B82F6', color: '#FFF', borderRadius: 10, padding: '0 0.45rem', fontSize: '0.72rem', fontWeight: 600 }}>
                {activeFilterCount}
              </span>
            )}
          </span>
          <span style={{ fontSize: '0.78rem', color: '#71717A' }}>{filtersOpen ? '▲' : '▼'}</span>
        </div>
        {filtersOpen && (
          <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}>
            <Sel label="Gender" value={filters.gender} onChange={v => setFilters(f => ({ ...f, gender: v }))}
              options={(filterOpts?.genders || []).map(g => ({ v: g, l: GENDER_LABELS[g] || g }))} />
            <Sel label="Age Group" value={filters.ageGroup} onChange={v => setFilters(f => ({ ...f, ageGroup: v }))}
              options={(filterOpts?.ageGroups || []).map(a => ({ v: a, l: a }))} />
            <Sel label="Region" value={filters.region} onChange={v => setFilters(f => ({ ...f, region: v }))}
              options={(filterOpts?.regions || []).map(r => ({ v: r, l: r }))} />
            <Sel label="Crop" value={filters.crop} onChange={v => setFilters(f => ({ ...f, crop: v }))}
              options={(filterOpts?.crops || []).map(c => ({ v: c, l: c }))} />
            <Sel label="Reg. Status" value={filters.registrationStatus} onChange={v => setFilters(f => ({ ...f, registrationStatus: v }))}
              options={(filterOpts?.registrationStatuses || []).map(s => ({ v: s, l: REG_STATUS_LABELS[s] || s }))} />
            <DateIn label="From" value={filters.dateFrom} onChange={v => setFilters(f => ({ ...f, dateFrom: v }))} />
            <DateIn label="To" value={filters.dateTo} onChange={v => setFilters(f => ({ ...f, dateTo: v }))} />
            <button className="btn btn-primary btn-sm" onClick={applyFilters}>Apply</button>
            {hasFilters && <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear</button>}
          </div>
        )}
      </div>

      {/* ── Active filter chips ──────────────────────────── */}
      {hasFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {Object.entries(applied).filter(([, v]) => v).map(([k, v]) => (
            <span
              key={k}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: '#1E293B', border: '1px solid #334155', borderRadius: 12,
                padding: '0.2rem 0.5rem', fontSize: '0.75rem', color: '#E2E8F0',
              }}
            >
              <span style={{ color: '#A1A1AA' }}>{FILTER_LABELS[k] || k}:</span>
              {(FILTER_DISPLAY[k] || (x => x))(v)}
              <span
                onClick={() => removeFilter(k)}
                style={{ cursor: 'pointer', color: '#71717A', marginLeft: 2, fontSize: '0.82rem', lineHeight: 1 }}
              >×</span>
            </span>
          ))}
          <span
            onClick={clearFilters}
            style={{ fontSize: '0.75rem', color: '#71717A', cursor: 'pointer', padding: '0.2rem 0.3rem', alignSelf: 'center' }}
          >Clear all</span>
        </div>
      )}

      {/* ── Inline error (shows when data exists but re-fetch failed) ── */}
      {error && data && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '1rem', fontSize: '0.82rem', color: '#EF4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button className="btn btn-outline btn-sm" style={{ color: '#EF4444', borderColor: '#EF4444' }} onClick={() => retry()}>Retry</button>
        </div>
      )}

      {/* ── Part 1: KPI Summary Cards ────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <KPI label="Total Farmers" value={s.totalFarmers} color="#22C55E" />
        <KPI label="Women Farmers" value={s.womenFarmers} pct={s.totalFarmers ? rate(s.womenFarmers, s.totalFarmers) : null} color="#EC4899" />
        <KPI label="Youth (15-35)" value={s.youthFarmers} pct={s.totalFarmers ? rate(s.youthFarmers, s.totalFarmers) : null} color="#8B5CF6" />
        <KPI label="Active (30d)" value={s.activeFarmers} pct={s.totalFarmers ? rate(s.activeFarmers, s.totalFarmers) : null} color="#3B82F6" />
        <KPI label="Validated" value={s.validatedRecords} pct={s.totalFarmers ? rate(s.validatedRecords, s.totalFarmers) : null} color="#22C55E" />
        <KPI label="Needs Attention" value={s.needsAttention} color={s.needsAttention > 0 ? '#EF4444' : '#22C55E'} />
      </div>

      {/* ── Empty state with action guidance ─────────────── */}
      {isEmpty && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>No farmer data yet</div>
            <div style={{ color: '#A1A1AA', fontSize: '0.88rem', marginBottom: '1rem', lineHeight: 1.5 }}>
              {hasFilters
                ? 'No farmers match these filters. Try adjusting or clearing them.'
                : 'Register farmers or send invites to start seeing impact data here.'}
            </div>
            {hasFilters ? (
              <button className="btn btn-outline btn-sm" onClick={clearFilters}>Clear Filters</button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/farmers')}>Go to Farmers</button>
            )}
          </div>
        </div>
      )}

      {/* ── Part 2: Demographics ─────────────────────────── */}
      {!isEmpty && (
        <div className="dashboard-charts-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Gender Distribution</div>
            <div className="card-body">
              {genderData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={75} innerRadius={40}
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine={{ stroke: '#475569' }}>
                      {genderData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty msg="No gender data recorded yet. Add gender when registering farmers." />}
            </div>
          </div>
          <div className="card">
            <div className="card-header">Age Group Distribution</div>
            <div className="card-body">
              {ageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ageData} margin={{ top: 5, right: 15, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#A1A1AA" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#A1A1AA" tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Farmers" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty msg="No date of birth recorded yet. Add birthdate when registering farmers." />}
            </div>
          </div>
        </div>
      )}

      {/* ── Part 3: Participation ────────────────────────── */}
      {!isEmpty && (
        <div className="dashboard-charts-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Active Rate by Gender</div>
            <div className="card-body">
              {activeByGender.length > 0 ? <RateTable rows={activeByGender} label="Active" /> : <Empty msg="Activity data will appear once farmers start logging updates." />}
            </div>
          </div>
          <div className="card">
            <div className="card-header">Active Rate by Age Group</div>
            <div className="card-body">
              {activeByAge.length > 0 ? <RateTable rows={activeByAge} label="Active" /> : <Empty msg="Activity data will appear once farmers start logging updates." />}
            </div>
          </div>
        </div>
      )}

      {/* ── Part 4: Needs Attention ──────────────────────── */}
      {!isEmpty && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Needs Attention</span>
            <span style={{ fontSize: '0.78rem', color: s.needsAttention > 0 ? '#EF4444' : '#A1A1AA' }}>
              {s.needsAttention} farmer{s.needsAttention !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="card-body">
            {s.needsAttention === 0 ? (
              <Empty msg="All farmers are on track. No action needed right now." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                <AttentionList
                  title="No Updates"
                  totalCount={attn.noUpdateCount || 0}
                  hint="These farmers have seasons but haven't logged any progress yet."
                  items={attn.noUpdate || []} navigate={navigate} color="#F59E0B" />
                <AttentionList
                  title="Not Validated"
                  totalCount={attn.notValidatedCount || 0}
                  hint="These farmers need an officer field validation."
                  items={attn.notValidated || []} navigate={navigate} color="#EF4444" />
                <AttentionList
                  title="Inactive (30d)"
                  totalCount={attn.inactiveCount || 0}
                  hint="Active season with no activity in 30 days."
                  items={attn.inactive || []} navigate={navigate} color="#6B7280" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Part 5: Trends ───────────────────────────────── */}
      {trendPts.length > 1 ? (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Trends</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendPts} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="period" stroke="#A1A1AA" tick={{ fontSize: 12 }} />
                <YAxis stroke="#A1A1AA" tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP} />
                <Legend />
                <Line type="monotone" dataKey="activeFarmers" stroke="#3B82F6" name="Active Farmers" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="validatedFarmers" stroke="#22C55E" name="Validated" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : trendsError && !isEmpty ? (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">Trends</div>
          <div className="card-body">
            <Empty msg="Trend data could not be loaded. Refresh the page to try again." />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function KPI({ label, value, pct, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: color || '#FFF', fontSize: '1.8rem', lineHeight: 1.1 }}>
        {value ?? '-'}
      </div>
      {pct !== null && pct !== undefined && (
        <div style={{ fontSize: '0.82rem', color: '#A1A1AA', marginTop: 4 }}>{pct}%</div>
      )}
    </div>
  );
}

function RateTable({ rows, label }) {
  return (
    <table style={{ width: '100%', fontSize: '0.84rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid #334155' }}>
          <th style={TH}>Group</th>
          <th style={{ ...TH, textAlign: 'right' }}>{label}</th>
          <th style={{ ...TH, textAlign: 'right' }}>Total</th>
          <th style={{ ...TH, textAlign: 'right' }}>Rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name} style={{ borderBottom: '1px solid #1E293B' }}>
            <td style={TD}>{r.name}</td>
            <td style={{ ...TD, textAlign: 'right' }}>{r.count}</td>
            <td style={{ ...TD, textAlign: 'right', color: '#A1A1AA' }}>{r.total}</td>
            <td style={{ ...TD, textAlign: 'right' }}><RateBar v={r.rate} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RateBar({ v }) {
  const clr = v >= 70 ? '#22C55E' : v >= 40 ? '#F59E0B' : '#EF4444';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 52, height: 6, background: '#1E293B', borderRadius: 3, overflow: 'hidden' }}>
        <span style={{ display: 'block', width: `${Math.min(v, 100)}%`, height: '100%', background: clr, borderRadius: 3 }} />
      </span>
      <span style={{ minWidth: 36, textAlign: 'right' }}>{v}%</span>
    </span>
  );
}

function AttentionList({ title, totalCount, hint, items, navigate, color }) {
  if (totalCount === 0 && (!items || items.length === 0)) return null;
  const showing = items.length;
  const hasMore = totalCount > showing;
  return (
    <div>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color, marginBottom: '0.2rem' }}>
        {title} ({totalCount})
      </div>
      {hint && <div style={{ fontSize: '0.72rem', color: '#71717A', marginBottom: '0.4rem' }}>{hint}</div>}
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {items.map(f => (
          <div
            key={f.id}
            onClick={() => navigate(`/farmers/${f.id}`)}
            style={{
              padding: '0.35rem 0.5rem',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.82rem',
              borderBottom: '1px solid #1E293B',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            className="hover-row"
          >
            <span>{f.name}</span>
            <span style={{ fontSize: '0.72rem', color: '#71717A' }}>{f.region}</span>
          </div>
        ))}
      </div>
      {hasMore && (
        <div
          onClick={() => navigate('/farmers')}
          style={{ fontSize: '0.75rem', color: '#3B82F6', cursor: 'pointer', textAlign: 'center', padding: '0.4rem 0', marginTop: '0.25rem' }}
          className="hover-row"
        >
          Showing {showing} of {totalCount} — view all farmers →
        </div>
      )}
    </div>
  );
}

function Sel({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{label}</label>
      <select className="form-input" value={value} onChange={e => onChange(e.target.value)}
        style={{ minWidth: 110, padding: '0.3rem 0.5rem', fontSize: '0.82rem' }}>
        <option value="">All</option>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function DateIn({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <label style={{ fontSize: '0.72rem', color: '#A1A1AA' }}>{label}</label>
      <input type="date" className="form-input" value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '0.3rem 0.5rem', fontSize: '0.82rem' }} />
    </div>
  );
}

function Empty({ msg }) {
  return <div style={{ textAlign: 'center', color: '#71717A', padding: '1.5rem', fontSize: '0.85rem' }}>{msg || 'No data yet'}</div>;
}

// ─── Helpers ────────────────────────────────────────────

function rate(n, d) { return d ? (Math.round((n / d) * 1000) / 10).toString() : '0'; }
const TH = { textAlign: 'left', padding: '0.4rem 0.5rem', color: '#A1A1AA', fontWeight: 500, fontSize: '0.78rem' };
const TD = { padding: '0.4rem 0.5rem' };
