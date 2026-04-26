import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ScoreBar from '../components/ScoreBar.jsx';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import { useTranslation } from '../i18n/index.js';

const COLORS = ['#22C55E', '#22C55E', '#F59E0B', '#EF4444', '#0891b2', '#7c3aed', '#be185d', '#059669'];

export default function PortfolioPage() {
  const { lang } = useTranslation();
  const [data, setData] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [snapshotError, setSnapshotError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/portfolio/summary'),
      api.get('/portfolio/snapshots?limit=10'),
    ]).then(([s, h]) => { setData(s.data); setSnapshots(h.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const takeSnapshot = async () => {
    setSnapping(true);
    setSnapshotError('');
    try {
      const res = await api.post('/portfolio/snapshot');
      setSnapshots(prev => [res.data, ...prev]);
    } catch (err) {
      setSnapshotError(err.response?.data?.error || 'Failed to save snapshot. Please try again.');
    } finally {
      setSnapping(false);
    }
  };

  if (loading) return <div className="loading">Loading portfolio...</div>;
  if (!data) return (
    <div className="page-body">
      <div className="alert alert-danger">Unable to load portfolio data. <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={() => window.location.reload()}>Retry</button></div>
    </div>
  );

  const fmt = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : n?.toLocaleString() || '0';

  return (
    <>
      <div className="page-header">
        <h1>Portfolio Overview</h1>
        <button className="btn btn-primary" onClick={takeSnapshot} disabled={snapping}>{snapping ? 'Saving...' : 'Take Snapshot'}</button>
      </div>
      {snapshotError && <div className="alert alert-danger" style={{ margin: '0 1.5rem 1rem' }}>{snapshotError}</div>}
      <div className="page-body">
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-label">Total Applications</div><div className="stat-value">{data.totalApplications}</div></div>
          <div className="stat-card"><div className="stat-label">Total Requested</div><div className="stat-value">{fmt(data.totalRequestedAmount)}</div></div>
          <div className="stat-card"><div className="stat-label">Total Recommended</div><div className="stat-value">{fmt(data.totalRecommendedAmount)}</div></div>
          <div className="stat-card"><div className="stat-label">Avg Verification</div><div className="stat-value">{Math.round(data.avgVerificationScore)}/100</div></div>
          <div className="stat-card"><div className="stat-label">Avg Farm Size</div><div className="stat-value">{data.avgFarmSizeAcres?.toFixed(1)} acres</div></div>
        </div>

        {/* Demographics breakdown */}
        {data.demographics && data.demographics.totalFarmers > 0 && (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#A1A1AA', flexShrink: 0 }}>
              Demographics
            </span>
            {[
              ['Total Farmers', data.demographics.totalFarmers, '#22C55E'],
              ['Women', `${data.demographics.womenFarmers} (${data.demographics.womenPercent}%)`, '#7c3aed'],
              ['Youth (<35)', `${data.demographics.youthFarmers} (${data.demographics.youthPercent}%)`, '#0891b2'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ background: '#1E293B', border: '1px solid #243041', borderRadius: 8, padding: '0.4rem 0.9rem', textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: '1rem', fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: '0.7rem', color: '#A1A1AA' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Status Distribution</div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.statusBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243041" />
                  <XAxis dataKey="status" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22C55E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Risk Distribution</div>
            <div className="card-body">
              {data.riskBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.riskBreakdown} dataKey="count" nameKey="level" cx="50%" cy="50%" outerRadius={100} label={({ level, count }) => `${level} (${count})`}>
                      {data.riskBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="empty-state">No risk data yet</div>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">Crop Breakdown</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Crop</th><th>Count</th><th>Total Amount</th><th>Avg Amount</th></tr></thead>
                <tbody>
                  {data.cropBreakdown.map(c => (
                    <tr key={c.crop}>
                      <td style={{ fontWeight: 500 }}>{getCropLabelSafe(c.crop, lang) || c.crop}</td>
                      <td>{c.count}</td>
                      <td>{fmt(c.totalAmount)}</td>
                      <td>{fmt(c.avgAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Regional Distribution</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Region</th><th>Farmers</th></tr></thead>
                <tbody>
                  {data.regionBreakdown.map(r => (
                    <tr key={r.region}>
                      <td style={{ fontWeight: 500 }}>{r.region}</td>
                      <td>{r.farmerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {snapshots.length > 0 && (
          <div className="card">
            <div className="card-header">Snapshot History</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead><tr><th>Date</th><th>Applications</th><th>Requested</th><th>Recommended</th><th>Avg Score</th></tr></thead>
                <tbody>
                  {snapshots.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.snapshotDate).toLocaleString()}</td>
                      <td>{s.totalApplications}</td>
                      <td>{fmt(s.totalRequestedAmount)}</td>
                      <td>{fmt(s.totalRecommendedAmount)}</td>
                      <td>{s.avgVerificationScore ? Math.round(s.avgVerificationScore) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
