import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

// Compute a single human-readable "next action" for each application
function getNextAction(app) {
  const days = Math.floor((Date.now() - new Date(app.createdAt)) / 86400000);
  const score = app.verificationResult?.verificationScore;

  if (app.status === 'needs_more_evidence') {
    return { label: 'Waiting for evidence', color: '#d97706', urgent: false };
  }
  if (app.status === 'field_review_required') {
    return { label: 'Field visit needed', color: '#0891b2', urgent: true };
  }
  if (app.status === 'escalated') {
    return { label: 'Senior review needed', color: '#ea580c', urgent: true };
  }
  if (!app.verificationResult) {
    return { label: 'Score first', color: '#2563eb', urgent: days > 3 };
  }
  if (app.status === 'under_review') {
    if (score >= 70) return { label: 'Approve or reject', color: '#16a34a', urgent: true };
    if (score >= 40) return { label: 'Review carefully', color: '#d97706', urgent: days > 5 };
    return { label: 'Consider rejecting', color: '#dc2626', urgent: false };
  }
  if (app.status === 'submitted') {
    if (score >= 70) return { label: 'Move to review', color: '#16a34a', urgent: true };
    if (score >= 40) return { label: 'Move to review', color: '#d97706', urgent: false };
    return { label: 'Score low — review', color: '#dc2626', urgent: false };
  }
  return { label: '—', color: '#9ca3af', urgent: false };
}

export default function VerificationQueuePage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState({});
  const [error, setError] = useState('');
  const [bulkProgress, setBulkProgress] = useState(null); // { done, total, failed }
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [submitted, underReview, needsEvidence, fieldReview, escalated] = await Promise.all([
        api.get('/applications', { params: { status: 'submitted', limit: 100 } }),
        api.get('/applications', { params: { status: 'under_review', limit: 100 } }),
        api.get('/applications', { params: { status: 'needs_more_evidence', limit: 100 } }),
        api.get('/applications', { params: { status: 'field_review_required', limit: 50 } }),
        api.get('/applications', { params: { status: 'escalated', limit: 50 } }),
      ]);
      // Sort: urgent items (no score + aging, or decision-ready) first, then by age
      const urgencyScore = (a) => {
        const action = getNextAction(a);
        const days = Math.floor((Date.now() - new Date(a.createdAt)) / 86400000);
        if (action.urgent) return 1000 + days;
        return days;
      };
      const all = [
        ...(submitted.data.applications || []),
        ...(underReview.data.applications || []),
        ...(needsEvidence.data.applications || []),
        ...(fieldReview.data.applications || []),
        ...(escalated.data.applications || []),
      ].sort((a, b) => urgencyScore(b) - urgencyScore(a));
      setApps(all);
    } catch {
      setError('Failed to load verification queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runVerification = async (appId, e) => {
    e.stopPropagation();
    setScoring(s => ({ ...s, [appId]: true }));
    try {
      await api.post(`/applications/${appId}/score-verification`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Verification scoring failed');
    } finally {
      setScoring(s => ({ ...s, [appId]: false }));
    }
  };

  const runAll = async () => {
    const unscored = apps.filter(a => !a.verificationResult);
    let done = 0;
    let failed = 0;
    setBulkProgress({ done: 0, total: unscored.length, failed: 0 });
    for (const a of unscored) {
      setScoring(s => ({ ...s, [a.id]: true }));
      try {
        await api.post(`/applications/${a.id}/score-verification`);
      } catch {
        failed++;
      }
      done++;
      setScoring(s => ({ ...s, [a.id]: false }));
      setBulkProgress({ done, total: unscored.length, failed });
    }
    await load();
    // Keep result visible for 5 s then clear
    setTimeout(() => setBulkProgress(null), 5000);
  };

  const unscoredCount = apps.filter(a => !a.verificationResult && a.status === 'submitted').length;
  const urgentCount = apps.filter(a => getNextAction(a).urgent).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Verification Queue ({apps.length})</h1>
          {urgentCount > 0 && (
            <div style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600, marginTop: '0.15rem' }}>
              {urgentCount} item{urgentCount > 1 ? 's' : ''} need immediate attention
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {unscoredCount > 0 && (
            <button className="btn btn-primary" onClick={runAll} disabled={bulkProgress !== null && bulkProgress.done < bulkProgress.total}>
              {bulkProgress !== null && bulkProgress.done < bulkProgress.total
                ? `Scoring ${bulkProgress.done}/${bulkProgress.total}...`
                : `Score All Unscored (${unscoredCount})`}
            </button>
          )}
          <button className="btn btn-outline" onClick={load}>Refresh</button>
        </div>
      </div>
      <div className="page-body">
        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
        {bulkProgress && (
          <div style={{
            background: bulkProgress.done < bulkProgress.total ? '#eff6ff' : bulkProgress.failed > 0 ? '#fef3c7' : '#d1fae5',
            border: `1px solid ${bulkProgress.done < bulkProgress.total ? '#bfdbfe' : bulkProgress.failed > 0 ? '#fde68a' : '#a7f3d0'}`,
            borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            {bulkProgress.done < bulkProgress.total ? (
              <>
                <span style={{ fontWeight: 600 }}>Scoring in progress...</span>
                <span>{bulkProgress.done} / {bulkProgress.total} done</span>
                {/* Progress bar */}
                <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#2563eb', borderRadius: 3, width: `${Math.round(bulkProgress.done / bulkProgress.total * 100)}%`, transition: 'width 0.2s' }} />
                </div>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 600 }}>{bulkProgress.failed === 0 ? 'All scored successfully' : `Scoring complete`}</span>
                <span>{bulkProgress.done - bulkProgress.failed} scored</span>
                {bulkProgress.failed > 0 && <span style={{ color: '#b45309' }}>{bulkProgress.failed} failed — refresh to retry</span>}
              </>
            )}
          </div>
        )}
        {loading ? <div className="loading">Loading...</div> : apps.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty-state">No applications awaiting verification</div></div></div>
        ) : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Farmer</th>
                      <th>Region / Org</th>
                      <th>Crop</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Score</th>
                      <th>Age</th>
                      <th>Next Action</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map(a => {
                      const days = Math.floor((Date.now() - new Date(a.createdAt)) / 86400000);
                      const nextAction = getNextAction(a);
                      const score = a.verificationResult?.verificationScore;
                      return (
                        <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)} style={{ cursor: 'pointer', background: nextAction.urgent ? '#fffbeb' : undefined }}>
                          <td style={{ fontWeight: 500 }}>{a.farmer?.fullName}</td>
                          <td>
                            <div>{a.farmer?.region || '-'}</div>
                            {a.farmer?.organization?.name && (
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{a.farmer.organization.name}</div>
                            )}
                          </td>
                          <td>{a.cropType}</td>
                          <td>{a.currencyCode || 'KES'} {a.requestedAmount?.toLocaleString()}</td>
                          <td><StatusBadge value={a.status} /></td>
                          <td>
                            {score != null
                              ? <span style={{ fontWeight: 600, color: score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626' }}>
                                  {score}/100
                                </span>
                              : <span className="text-muted" style={{ fontSize: '0.8rem' }}>Unscored</span>
                            }
                          </td>
                          <td>
                            <span style={{ color: days > 7 ? '#dc2626' : days > 3 ? '#d97706' : '#6b7280', fontWeight: days > 3 ? 600 : 400 }}>
                              {days}d{days > 7 ? ' ⚠' : ''}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', fontWeight: nextAction.urgent ? 700 : 500, color: nextAction.color }}>
                              {nextAction.urgent ? '→ ' : ''}{nextAction.label}
                            </span>
                          </td>
                          <td>
                            {a.status === 'submitted' && !a.verificationResult && (
                              <button
                                className="btn btn-outline btn-sm"
                                disabled={scoring[a.id]}
                                onClick={(e) => runVerification(a.id, e)}
                              >
                                {scoring[a.id] ? 'Scoring...' : 'Score'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
