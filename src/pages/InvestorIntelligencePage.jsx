import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';

const CLASSIFICATION_COLORS = {
  on_track: { bg: '#d1fae5', color: '#065f46', label: 'On Track' },
  slight_delay: { bg: '#fef3c7', color: '#92400e', label: 'Slight Delay' },
  at_risk: { bg: '#fed7aa', color: '#9a3412', label: 'At Risk' },
  critical: { bg: '#fee2e2', color: '#991b1b', label: 'Critical' },
};

export default function InvestorIntelligencePage() {
  const { farmerId } = useParams();
  const [data, setData] = useState(null);
  const [credSummary, setCredSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/seasons/investor/farmers/${farmerId}/intelligence`),
      api.get(`/seasons/farmer/${farmerId}/credibility-summary`).catch(() => ({ data: null })),
    ])
      .then(([iRes, cRes]) => { setData(iRes.data); setCredSummary(cRes.data); })
      .catch(err => setError(err.response?.data?.error || 'Failed to load intelligence data'))
      .finally(() => setLoading(false));
  }, [farmerId]);

  if (loading) return <div className="loading">Loading investor intelligence...</div>;
  if (error) return (
    <div className="page-body">
      <div className="alert alert-danger">{error}</div>
      <button className="btn btn-outline" onClick={() => navigate(-1)}>Back</button>
    </div>
  );
  if (!data) return null;

  const { farmer, summary, yieldHistory, reliabilitySignals, seasonOutcomes } = data;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Farmer Intelligence</h1>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>
            {farmer.fullName} | {farmer.region}{farmer.district ? `, ${farmer.district}` : ''} | {farmer.country}
          </span>
        </div>
        <button className="btn btn-outline" onClick={() => navigate(-1)}>Back</button>
      </div>

      <div className="page-body">
        {/* Farmer overview — no sensitive data */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">Farmer Overview</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.875rem' }}>
              <DetailRow label="Primary Crop" value={farmer.primaryCrop || '-'} />
              <DetailRow label="Farm Size" value={farmer.farmSizeAcres ? `${farmer.farmSizeAcres} acres` : '-'} />
              <DetailRow label="Experience" value={farmer.yearsExperience ? `${farmer.yearsExperience} years` : '-'} />
              <DetailRow label="Region" value={`${farmer.region}${farmer.district ? `, ${farmer.district}` : ''}`} />
              <DetailRow label="Country" value={farmer.country} />
              <DetailRow label="Registration" value={farmer.registrationStatus} />
            </div>
          </div>
        </div>

        {/* Performance summary */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">Performance Summary</div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <MetricCard label="Total Seasons" value={summary.totalSeasons} />
              <MetricCard label="Completed" value={summary.completedSeasons} />
              <MetricCard label="Active" value={summary.activeSeasons} />
              <MetricCard label="Avg Score" value={summary.avgProgressScore !== null ? `${summary.avgProgressScore}/100` : 'N/A'} />
              <MetricCard label="Consistency" value={summary.consistencyRate !== null ? `${summary.consistencyRate}%` : 'N/A'} />
              <MetricCard
                label="Trend"
                value={summary.productivityTrend === 'improving' ? 'Improving' : summary.productivityTrend === 'declining' ? 'Declining' : summary.productivityTrend === 'stable' ? 'Stable' : 'Insufficient'}
                color={summary.productivityTrend === 'improving' ? '#16a34a' : summary.productivityTrend === 'declining' ? '#dc2626' : '#6b7280'}
              />
            </div>
          </div>
        </div>

        {/* Reliability signals */}
        {reliabilitySignals.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header">Reliability Signals</div>
            <div className="card-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {reliabilitySignals.map((s, i) => (
                  <span key={i} style={{
                    display: 'inline-block', padding: '0.3rem 0.75rem', borderRadius: 16,
                    fontSize: '0.8rem', fontWeight: 500,
                    background: s.positive ? '#d1fae5' : '#fee2e2',
                    color: s.positive ? '#065f46' : '#991b1b',
                  }}>
                    {s.positive ? '+' : '-'} {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Credibility & Trust */}
        {credSummary?.overallCredibility && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header">Data Credibility</div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <MetricCard
                  label="Credibility Score"
                  value={credSummary.overallCredibility.avgScore !== null ? `${credSummary.overallCredibility.avgScore}/100` : 'N/A'}
                  color={credSummary.overallCredibility.level === 'high_confidence' ? '#16a34a' : credSummary.overallCredibility.level === 'medium_confidence' ? '#d97706' : '#dc2626'}
                />
                <MetricCard
                  label="Confidence Level"
                  value={(credSummary.overallCredibility.level || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                />
                <MetricCard
                  label="Credibility Trend"
                  value={(credSummary.overallCredibility.trend || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  color={credSummary.overallCredibility.trend === 'improving' ? '#16a34a' : credSummary.overallCredibility.trend === 'declining' ? '#dc2626' : '#6b7280'}
                />
                <MetricCard label="Assessed" value={`${credSummary.overallCredibility.seasonsAssessed}/${credSummary.overallCredibility.totalSeasons} seasons`} />
              </div>
              {Object.keys(credSummary.recurringFlags || {}).length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Recurring Flags</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {Object.entries(credSummary.recurringFlags).map(([flag, count]) => (
                      <span key={flag} style={{
                        padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 500,
                        background: '#fee2e2', color: '#991b1b',
                      }}>
                        {flag.replace(/_/g, ' ')} ({count}x)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(credSummary.recurringFlags || {}).length === 0 && credSummary.overallCredibility.avgScore >= 70 && (
                <div style={{ fontSize: '0.85rem', color: '#065f46' }}>No recurring data quality issues detected.</div>
              )}
            </div>
          </div>
        )}

        {/* Yield history */}
        {yieldHistory.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header">Yield History</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr><th>Crop</th><th>Planted</th><th>Farm Size</th><th>Yield/Acre</th><th>Total Harvest (kg)</th></tr>
                </thead>
                <tbody>
                  {yieldHistory.map((y, i) => (
                    <tr key={i}>
                      <td>{y.cropType}</td>
                      <td>{new Date(y.plantingDate).toLocaleDateString()}</td>
                      <td>{y.farmSizeAcres} acres</td>
                      <td style={{ fontWeight: 600 }}>{y.yieldPerAcre}</td>
                      <td>{y.totalHarvestKg.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Season outcomes */}
        {seasonOutcomes.length > 0 && (
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-header">Season Outcomes</div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr><th>Crop</th><th>Planted</th><th>Acres</th><th>Status</th><th>Score</th><th>Classification</th><th>Harvest (kg)</th></tr>
                </thead>
                <tbody>
                  {seasonOutcomes.map((s, i) => {
                    const cls = s.progressScore?.classification;
                    const clsInfo = CLASSIFICATION_COLORS[cls];
                    return (
                      <tr key={i}>
                        <td>{s.cropType}</td>
                        <td>{new Date(s.plantingDate).toLocaleDateString()}</td>
                        <td>{s.farmSizeAcres}</td>
                        <td>
                          <span style={{
                            padding: '0.2rem 0.5rem', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                            background: s.status === 'completed' ? '#d1fae5' : s.status === 'active' ? '#dbeafe' : '#f3f4f6',
                            color: s.status === 'completed' ? '#065f46' : s.status === 'active' ? '#1e40af' : '#6b7280',
                          }}>{s.status}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{s.progressScore?.score ?? '-'}</td>
                        <td>
                          {clsInfo ? (
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, background: clsInfo.bg, color: clsInfo.color }}>
                              {clsInfo.label}
                            </span>
                          ) : '-'}
                        </td>
                        <td>{s.harvestReport?.totalHarvestKg?.toLocaleString() ?? '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {seasonOutcomes.length === 0 && (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
              No season data available for this farmer yet.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', padding: '0.35rem 0' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '0.75rem', textAlign: 'center' }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: color || '#111827' }}>{value}</div>
    </div>
  );
}
