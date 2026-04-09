import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import api from '../api/client.js';

const COLORS = ['#22C55E', '#22C55E', '#F59E0B', '#EF4444', '#0891b2', '#7c3aed', '#be185d', '#059669'];

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
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #243041', marginBottom: '1.25rem', background: '#162033', borderRadius: '8px 8px 0 0', padding: '0 0.5rem' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.75rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t.key ? '#22C55E' : '#A1A1AA',
              borderBottom: tab === t.key ? '2px solid #22C55E' : '2px solid transparent',
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
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/applications/stats'),
      api.get('/portfolio/summary'),
    ]).then(([sRes, pRes]) => {
      setStats(sRes.data);
      setPortfolio(pRes.data);
    }).catch(() => { setLoadError('Failed to load system overview'); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading system overview...</div>;
  if (loadError) return <div className="alert-inline alert-inline-danger">{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => window.location.reload()}>Retry</button></div>;

  const statusMap = {};
  if (stats?.statusCounts) stats.statusCounts.forEach(s => { statusMap[s.status] = s._count; });
  const total = stats?.aggregates?._count || 0;

  // Pipeline stages
  const pipeline = [
    { label: 'Draft', count: statusMap.draft || 0, color: '#71717A' },
    { label: 'Submitted', count: statusMap.submitted || 0, color: '#22C55E' },
    { label: 'Under Review', count: statusMap.under_review || 0, color: '#0891b2' },
    { label: 'Needs Evidence', count: statusMap.needs_more_evidence || 0, color: '#F59E0B' },
    { label: 'Field Review', count: statusMap.field_review_required || 0, color: '#0891b2' },
    { label: 'Fraud Hold', count: statusMap.fraud_hold || 0, color: '#EF4444' },
    { label: 'Escalated', count: statusMap.escalated || 0, color: '#ea580c' },
    { label: 'Approved', count: statusMap.approved || 0, color: '#22C55E' },
    { label: 'Conditional', count: statusMap.conditional_approved || 0, color: '#059669' },
    { label: 'Disbursed', count: statusMap.disbursed || 0, color: '#047857' },
    { label: 'Rejected', count: statusMap.rejected || 0, color: '#be185d' },
  ];

  const activeQueue = (statusMap.submitted || 0) + (statusMap.under_review || 0);
  const fraudQueue = statusMap.fraud_hold || 0;
  const escalatedQueue = statusMap.escalated || 0;
  const approvalRate = total > 0 ? (((statusMap.approved || 0) + (statusMap.conditional_approved || 0)) / total * 100).toFixed(1) : 0;

  // Compute attention items from pipeline data
  const needsEvidenceCount = statusMap.needs_more_evidence || 0;
  const fieldReviewCount = statusMap.field_review_required || 0;
  const pendingCount = (statusMap.submitted || 0) + (statusMap.under_review || 0);
  const attentionItems = [];
  if (escalatedQueue > 0) attentionItems.push({
    urgent: true, href: '/verification-queue',
    label: `${escalatedQueue} escalated application${escalatedQueue > 1 ? 's' : ''} need a senior decision`,
  });
  if (fraudQueue > 0) attentionItems.push({
    urgent: true, href: '/fraud-queue',
    label: `${fraudQueue} application${fraudQueue > 1 ? 's' : ''} on fraud hold — review required`,
  });
  if (fieldReviewCount > 0) attentionItems.push({
    urgent: true, href: '/verification-queue',
    label: `${fieldReviewCount} application${fieldReviewCount > 1 ? 's' : ''} require a field officer visit`,
  });
  if (needsEvidenceCount > 0) attentionItems.push({
    urgent: false, href: '/verification-queue',
    label: `${needsEvidenceCount} application${needsEvidenceCount > 1 ? 's' : ''} waiting for evidence from farmers`,
  });
  if (pendingCount > 20) attentionItems.push({
    urgent: false, href: '/verification-queue',
    label: `${pendingCount} applications in the verification queue — consider bulk scoring`,
  });

  return (
    <>
      {/* Needs Attention */}
      {attentionItems.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem', border: '1px solid #243041' }}>
          <div className="card-header" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 700 }}>
            Needs Attention ({attentionItems.length})
          </div>
          <div className="card-body" style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {attentionItems.map((item, i) => (
              <div
                key={i}
                onClick={() => navigate(item.href)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.55rem 1rem', cursor: 'pointer',
                  borderBottom: i < attentionItems.length - 1 ? '1px solid #243041' : 'none',
                  background: item.urgent ? 'rgba(245,158,11,0.15)' : '#162033',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block', background: item.urgent ? '#EF4444' : '#F59E0B' }} />
                <span style={{ fontSize: '0.875rem', color: '#FFFFFF', flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: '0.8rem', color: '#22C55E', fontWeight: 600, flexShrink: 0 }}>View →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick action banners */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div onClick={() => navigate('/verification-queue')} style={{ cursor: 'pointer', flex: 1, minWidth: 200, background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22C55E' }}>{activeQueue}</div>
          <div style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>Awaiting Verification</div>
        </div>
        <div onClick={() => navigate('/fraud-queue')} style={{ cursor: 'pointer', flex: 1, minWidth: 200, background: 'rgba(239,68,68,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#EF4444' }}>{fraudQueue}</div>
          <div style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>Fraud Hold</div>
        </div>
        <div onClick={() => navigate('/verification-queue')} style={{ cursor: 'pointer', flex: 1, minWidth: 200, background: 'rgba(245,158,11,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#F59E0B' }}>{escalatedQueue}</div>
          <div style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>Escalated</div>
        </div>
        <div style={{ flex: 1, minWidth: 200, background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 8, padding: '1rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#22C55E' }}>{approvalRate}%</div>
          <div style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>Approval Rate</div>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
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
  const [loadError, setLoadError] = useState('');

  const loadCountry = (code) => {
    setSelectedCountry(code);
    setLoading(true);
    setLoadError('');
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
    }).catch(() => { setLoadError('Failed to load region config'); }).finally(() => setLoading(false));
  };

  useEffect(() => { loadCountry('KE'); }, []);

  if (loading) return <div className="loading">Loading region config...</div>;
  if (loadError) return <div className="alert-inline alert-inline-danger">{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => loadCountry(selectedCountry)}>Retry</button></div>;

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
                <div className="detail-row"><span className="detail-label">Season</span><span className="detail-value" style={{ fontWeight: 600, color: '#22C55E' }}>{season.name || season.season}</span></div>
                <div className="detail-row"><span className="detail-label">Period</span><span className="detail-value">{season.months || season.period || '-'}</span></div>
                {season.description && <div className="detail-row"><span className="detail-label">Description</span><span className="detail-value">{season.description}</span></div>}
              </>
            ) : (
              <div className="empty-state">No season data</div>
            )}
            {cfg.seasons && (
              <div style={{ marginTop: '1rem' }}>
                <strong style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>All Seasons:</strong>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {Object.entries(cfg.seasons).map(([key, val]) => (
                    <div key={key} style={{ padding: '0.5rem 0.75rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 6, fontSize: '0.85rem' }}>
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
                  <span key={i} style={{ padding: '0.35rem 0.75rem', background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 20, fontSize: '0.85rem', color: '#22C55E', fontWeight: 500 }}>
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
                  <span key={i} style={{ padding: '0.35rem 0.75rem', background: 'rgba(34,197,94,0.15)', border: '1px solid #243041', borderRadius: 20, fontSize: '0.85rem', color: '#22C55E' }}>
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
  const [loadError, setLoadError] = useState('');

  const load = () => {
    setLoading(true);
    setLoadError('');
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
    }).catch(() => { setLoadError('Failed to load demand data'); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="loading">Loading demand intelligence...</div>;
  if (loadError) return <div className="alert-inline alert-inline-danger">{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={load}>Retry</button></div>;

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
                        <span key={region} style={{ padding: '0.25rem 0.6rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 4, fontSize: '0.85rem' }}>
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
                        <span key={region} style={{ padding: '0.25rem 0.6rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 4, fontSize: '0.85rem' }}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
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
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    fetch('/api/localization/languages')
      .then(r => r.json())
      .then(setLanguages)
      .catch(() => { setLoadError('Failed to load languages'); })
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
  if (loadError) return <div className="alert-inline alert-inline-danger">{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => window.location.reload()}>Retry</button></div>;

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
                  border: selectedLang === lang.code ? '2px solid #22C55E' : '1px solid #243041',
                  background: selectedLang === lang.code ? 'rgba(34,197,94,0.15)' : '#162033',
                  minWidth: 150, textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{lang.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#A1A1AA' }}>{lang.code}</div>
                <div style={{ fontSize: '0.85rem', color: '#22C55E', marginTop: '0.25rem' }}>{lang.keyCount} keys</div>
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
                <h4 style={{ margin: '0 0 0.5rem', color: '#FFFFFF', borderBottom: '1px solid #243041', paddingBottom: '0.25rem' }}>
                  {prefix} ({keys.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1.5rem' }}>
                  {keys.map(({ key, value }) => (
                    <div key={key} style={{ display: 'flex', gap: '0.5rem', padding: '0.2rem 0', fontSize: '0.85rem' }}>
                      <span style={{ color: '#A1A1AA', minWidth: 200, fontFamily: 'monospace', fontSize: '0.8rem' }}>{key}</span>
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
