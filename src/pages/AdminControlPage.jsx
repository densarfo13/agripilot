import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/client.js';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#7c3aed', '#be185d', '#059669'];

export default function AdminControlPage() {
  const [tab, setTab] = useState('overview');
  const navigate = useNavigate();

  const tabs = [
    { key: 'overview', label: 'System Overview' },
    { key: 'regions', label: 'Region Config' },
    { key: 'demand', label: 'Demand Intelligence' },
    { key: 'i18n', label: 'Languages' },
  ];

  return (
    <>
      <div className="page-header"><h1>Admin Control Center</h1></div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e7eb', marginBottom: '1.25rem', background: '#fff', borderRadius: '8px 8px 0 0', padding: '0 0.5rem' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.75rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.key ? '#2563eb' : '#6b7280',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              fontWeight: tab === t.key ? 600 : 400, marginBottom: '-2px', fontSize: '0.9rem',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="page-body" style={{ paddingTop: 0 }}>
        {tab === 'overview' && <SystemOverview navigate={navigate} />}
        {tab === 'regions' && <RegionConfig />}
        {tab === 'demand' && <DemandIntelligence />}
        {tab === 'i18n' && <LanguagePanel />}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  TAB 1: System Overview
// ═══════════════════════════════════════════════════════
function SystemOverview({ navigate }) {
  const [stats, setStats] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/applications/stats'),
      api.get('/portfolio/summary'),
    ]).then(([sRes, pRes]) => {
      setStats(sRes.data);
      setPortfolio(pRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading system overview...</div>;

  const statusMap = {};
  if (stats?.statusCounts) stats.statusCounts.forEach(s => { statusMap[s.status] = s._count; });
  const total = stats?.aggregates?._count || 0;

  // Pipeline stages
  const pipeline = [
    { label: 'Draft', count: statusMap.draft || 0, color: '#9ca3af' },
    { label: 'Submitted', count: statusMap.submitted || 0, color: '#2563eb' },
    { label: 'Under Review', count: statusMap.under_review || 0, color: '#0891b2' },
    { label: 'Needs Evidence', count: statusMap.needs_more_evidence || 0, color: '#d97706' },
    { label: 'Field Review', count: statusMap.field_review_required || 0, color: '#0891b2' },
    { label: 'Fraud Hold', count: statusMap.fraud_hold || 0, color: '#dc2626' },
    { label: 'Escalated', count: statusMap.escalated || 0, color: '#ea580c' },
    { label: 'Approved', count: statusMap.approved || 0, color: '#16a34a' },
    { label: 'Conditional', count: statusMap.conditional_approved || 0, color: '#059669' },
    { label: 'Disbursed', count: statusMap.disbursed || 0, color: '#047857' },
    { label: 'Rejected', count: statusMap.rejected || 0, color: '#be185d' },
  ];

  const activeQueue = (statusMap.submitted || 0) + (statusMap.under_review || 0);
  const fraudQueue = statusMap.fraud_hold || 0;
  const escalatedQueue = statusMap.escalated || 0;
  const approvalRate = total > 0 ? (((statusMap.approved || 0) + (statusMap.conditional_approved || 0)) / total * 100).toFixed(1) : 0;

  return (
    <>
      {/* Quick action banners */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div onClick={() => navigate('/verification-queue')} style={{ cursor: 'pointer', flex: 1, minWidth: 200, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#2563eb' }}>{activeQueue}</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Awaiting Verification</div>
        </div>
        <div onClick={() => navigate('/fraud-queue')} style={{ cursor: 'pointer', flex: 1, minWidth: 200, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#dc2626' }}>{fraudQueue}</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Fraud Hold</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#d97706' }}>{escalatedQueue}</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Escalated</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#16a34a' }}>{approvalRate}%</div>
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Approval Rate</div>
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">Application Pipeline ({total} total)</div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem' }}>
            {pipeline.filter(p => p.count > 0).map(p => (
              <div key={p.label} style={{
                flex: p.count, background: p.color, color: '#fff', padding: '0.5rem',
                textAlign: 'center', fontSize: '0.75rem', borderRadius: 4, minWidth: 40,
              }}>
                <div style={{ fontWeight: 700 }}>{p.count}</div>
                <div>{p.label}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pipeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {pipeline.map((p, i) => <Cell key={i} fill={p.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Portfolio highlights */}
      {portfolio && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Requested</div>
            <div className="stat-value">{(portfolio.totalRequestedAmount / 1000000).toFixed(2)}M</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Recommended</div>
            <div className="stat-value">{(portfolio.totalRecommendedAmount / 1000000).toFixed(2)}M</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Verification</div>
            <div className="stat-value">{Math.round(portfolio.avgVerificationScore || 0)}/100</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Crops Tracked</div>
            <div className="stat-value">{portfolio.cropBreakdown?.length || 0}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  TAB 2: Region Configuration
// ═══════════════════════════════════════════════════════
function RegionConfig() {
  const [configs, setConfigs] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('KE');
  const [season, setSeason] = useState(null);
  const [crops, setCrops] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCountry = (code) => {
    setSelectedCountry(code);
    setLoading(true);
    Promise.all([
      api.get(`/region-config/${code}`),
      api.get(`/region-config/${code}/season`),
      api.get(`/region-config/${code}/crops`),
      api.get(`/region-config/${code}/regions`),
    ]).then(([cfgRes, sRes, cRes, rRes]) => {
      setConfigs([cfgRes.data]);
      setSeason(sRes.data);
      setCrops(cRes.data);
      setRegions(rRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadCountry('KE'); }, []);

  if (loading) return <div className="loading">Loading region config...</div>;

  const cfg = configs[0] || {};

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['KE', 'TZ'].map(c => (
          <button key={c} className={`btn ${selectedCountry === c ? 'btn-primary' : 'btn-outline'}`} onClick={() => loadCountry(c)}>
            {c === 'KE' ? 'Kenya' : 'Tanzania'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* General config */}
        <div className="card">
          <div className="card-header">Configuration — {cfg.country || selectedCountry}</div>
          <div className="card-body">
            <div className="detail-row"><span className="detail-label">Currency</span><span className="detail-value">{cfg.currencyCode}</span></div>
            <div className="detail-row"><span className="detail-label">Area Unit</span><span className="detail-value">{cfg.areaUnit}</span></div>
            <div className="detail-row"><span className="detail-label">Languages</span><span className="detail-value">{cfg.languages?.join(', ')}</span></div>
            <div className="detail-row"><span className="detail-label">Default Language</span><span className="detail-value">{cfg.defaultLanguage}</span></div>
            <div className="detail-row"><span className="detail-label">Verification Threshold</span><span className="detail-value">{cfg.verificationThreshold}</span></div>
            <div className="detail-row"><span className="detail-label">Max Loan</span><span className="detail-value">{cfg.currencyCode} {cfg.maxLoanAmount?.toLocaleString()}</span></div>
            <div className="detail-row"><span className="detail-label">Min Loan</span><span className="detail-value">{cfg.currencyCode} {cfg.minLoanAmount?.toLocaleString()}</span></div>
          </div>
        </div>

        {/* Current season */}
        <div className="card">
          <div className="card-header">Current Season</div>
          <div className="card-body">
            {season ? (
              <>
                <div className="detail-row"><span className="detail-label">Season</span><span className="detail-value" style={{ fontWeight: 600, color: '#2563eb' }}>{season.name || season.season}</span></div>
                <div className="detail-row"><span className="detail-label">Period</span><span className="detail-value">{season.months || season.period || '-'}</span></div>
                {season.description && <div className="detail-row"><span className="detail-label">Description</span><span className="detail-value">{season.description}</span></div>}
              </>
            ) : (
              <div className="empty-state">No season data</div>
            )}
            {cfg.seasons && (
              <div style={{ marginTop: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#6b7280' }}>All Seasons:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.entries(cfg.seasons).map(([key, val]) => (
                    <div key={key} style={{ padding: '0.5rem 0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.85rem' }}>
                      <strong>{key.replace(/_/g, ' ')}</strong>
                      <div className="text-muted">{typeof val === 'object' ? val.months || JSON.stringify(val) : val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Supported crops */}
        <div className="card">
          <div className="card-header">Supported Crops ({Array.isArray(crops) ? crops.length : 0})</div>
          <div className="card-body">
            {Array.isArray(crops) && crops.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {crops.map((c, i) => (
                  <span key={i} style={{ padding: '0.35rem 0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: '0.85rem', color: '#16a34a', fontWeight: 500 }}>
                    {typeof c === 'string' ? c : c.name || c.crop}
                  </span>
                ))}
              </div>
            ) : <div className="empty-state">No crop data</div>}
          </div>
        </div>

        {/* Regions */}
        <div className="card">
          <div className="card-header">Regions ({Array.isArray(regions) ? regions.length : 0})</div>
          <div className="card-body">
            {Array.isArray(regions) && regions.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {regions.map((r, i) => (
                  <span key={i} style={{ padding: '0.35rem 0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, fontSize: '0.85rem', color: '#2563eb' }}>
                    {typeof r === 'string' ? r : r.name || r.region}
                  </span>
                ))}
              </div>
            ) : <div className="empty-state">No region data</div>}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  TAB 3: Demand Intelligence
// ═══════════════════════════════════════════════════════
function DemandIntelligence() {
  const [demandKE, setDemandKE] = useState(null);
  const [demandTZ, setDemandTZ] = useState(null);
  const [cropDemand, setCropDemand] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/buyer-interest/demand/summary?country=KE'),
      api.get('/buyer-interest/demand/summary?country=TZ'),
      // Load per-crop for common crops
      ...['maize', 'wheat', 'rice', 'coffee', 'tea', 'cashew'].map(c =>
        api.get(`/buyer-interest/demand/summary?cropType=${c}`).catch(() => ({ data: { cropType: c, totalInterests: 0 } }))
      ),
    ]).then(([keRes, tzRes, ...cropResults]) => {
      setDemandKE(keRes.data);
      setDemandTZ(tzRes.data);
      setCropDemand(cropResults.map(r => r.data).filter(d => d.totalInterests > 0));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading demand intelligence...</div>;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
        {/* Kenya demand */}
        <div className="card">
          <div className="card-header">Kenya Demand Summary</div>
          <div className="card-body">
            {demandKE ? (
              <>
                <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                  <div className="stat-card"><div className="stat-label">Active Interests</div><div className="stat-value">{demandKE.totalInterests}</div></div>
                  <div className="stat-card"><div className="stat-label">Total Quantity</div><div className="stat-value">{(demandKE.totalQuantityKg || 0).toLocaleString()} kg</div></div>
                </div>
                {demandKE.byRegion && Object.keys(demandKE.byRegion).length > 0 && (
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>By Region:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {Object.entries(demandKE.byRegion).map(([region, count]) => (
                        <span key={region} style={{ padding: '0.25rem 0.6rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.85rem' }}>
                          {region}: <strong>{count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <div className="empty-state">No Kenya demand data</div>}
          </div>
        </div>

        {/* Tanzania demand */}
        <div className="card">
          <div className="card-header">Tanzania Demand Summary</div>
          <div className="card-body">
            {demandTZ ? (
              <>
                <div className="stats-grid" style={{ marginBottom: '1rem' }}>
                  <div className="stat-card"><div className="stat-label">Active Interests</div><div className="stat-value">{demandTZ.totalInterests}</div></div>
                  <div className="stat-card"><div className="stat-label">Total Quantity</div><div className="stat-value">{(demandTZ.totalQuantityKg || 0).toLocaleString()} kg</div></div>
                </div>
                {demandTZ.byRegion && Object.keys(demandTZ.byRegion).length > 0 && (
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>By Region:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                      {Object.entries(demandTZ.byRegion).map(([region, count]) => (
                        <span key={region} style={{ padding: '0.25rem 0.6rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.85rem' }}>
                          {region}: <strong>{count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : <div className="empty-state">No Tanzania demand data</div>}
          </div>
        </div>
      </div>

      {/* Crop demand breakdown */}
      {cropDemand.length > 0 && (
        <div className="card">
          <div className="card-header">Demand by Crop</div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={cropDemand}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="cropType" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="totalInterests" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Interests" />
              </BarChart>
            </ResponsiveContainer>
            <div className="table-wrap" style={{ marginTop: '1rem' }}>
              <table>
                <thead><tr><th>Crop</th><th>Interests</th><th>Total Qty (kg)</th><th>Avg Price Expectation</th></tr></thead>
                <tbody>
                  {cropDemand.map(d => (
                    <tr key={d.cropType}>
                      <td style={{ fontWeight: 500 }}>{d.cropType}</td>
                      <td>{d.totalInterests}</td>
                      <td>{d.totalQuantityKg?.toLocaleString() || 0}</td>
                      <td>{d.averagePriceExpectation ? d.averagePriceExpectation.toFixed(2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {cropDemand.length === 0 && (
        <div className="card"><div className="card-body"><div className="empty-state">No crop-specific demand data yet. Farmer buyer interest expressions will appear here.</div></div></div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════
//  TAB 4: Language Panel
// ═══════════════════════════════════════════════════════
function LanguagePanel() {
  const [languages, setLanguages] = useState([]);
  const [selectedLang, setSelectedLang] = useState(null);
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/localization/languages')
      .then(r => r.json())
      .then(setLanguages)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadTranslations = (lang) => {
    setSelectedLang(lang);
    fetch(`/api/localization/translations/${lang}`)
      .then(r => r.json())
      .then(setTranslations)
      .catch(() => setTranslations({}));
  };

  if (loading) return <div className="loading">Loading languages...</div>;

  // Group translations by prefix
  const grouped = {};
  for (const [key, val] of Object.entries(translations)) {
    const prefix = key.split('.')[0];
    if (!grouped[prefix]) grouped[prefix] = [];
    grouped[prefix].push({ key, value: val });
  }

  return (
    <>
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">Supported Languages</div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {languages.map(lang => (
              <div
                key={lang.code}
                onClick={() => loadTranslations(lang.code)}
                style={{
                  cursor: 'pointer', padding: '1rem 1.5rem', borderRadius: 8,
                  border: selectedLang === lang.code ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  background: selectedLang === lang.code ? '#eff6ff' : '#fff',
                  minWidth: 150, textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{lang.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{lang.code}</div>
                <div style={{ fontSize: '0.85rem', color: '#2563eb', marginTop: '0.25rem' }}>{lang.keyCount} keys</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedLang && Object.keys(grouped).length > 0 && (
        <div className="card">
          <div className="card-header">Translations — {selectedLang} ({Object.keys(translations).length} keys)</div>
          <div className="card-body">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([prefix, keys]) => (
              <div key={prefix} style={{ marginBottom: '1.25rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', color: '#374151', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem' }}>
                  {prefix} ({keys.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1.5rem' }}>
                  {keys.map(({ key, value }) => (
                    <div key={key} style={{ display: 'flex', gap: '0.5rem', padding: '0.2rem 0', fontSize: '0.85rem' }}>
                      <span style={{ color: '#6b7280', minWidth: 200, fontFamily: 'monospace', fontSize: '0.8rem' }}>{key}</span>
                      <span style={{ fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
