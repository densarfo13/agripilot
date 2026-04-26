import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { FarmerAvatarSmall } from '../components/FarmerAvatar.jsx';
import { SkeletonTable } from '../components/SkeletonLoader.jsx';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import { useTranslation } from '../i18n/index.js';

// Compute a single human-readable "next action" for each application
function getNextAction(app) {
  const days = Math.floor((Date.now() - new Date(app.createdAt)) / 86400000);
  const score = app.verificationResult?.verificationScore;

  if (app.status === 'needs_more_evidence') {
    return { label: 'Waiting for evidence', color: '#F59E0B', urgent: false };
  }
  if (app.status === 'field_review_required') {
    return { label: 'Field visit needed', color: '#0891b2', urgent: true };
  }
  if (app.status === 'escalated') {
    return { label: 'Senior review needed', color: '#F59E0B', urgent: true };
  }
  if (!app.verificationResult) {
    return { label: 'Score first', color: '#22C55E', urgent: days > 3 };
  }
  if (app.status === 'under_review') {
    if (score >= 70) return { label: 'Approve or reject', color: '#22C55E', urgent: true };
    if (score >= 40) return { label: 'Review carefully', color: '#F59E0B', urgent: days > 5 };
    return { label: 'Consider rejecting', color: '#EF4444', urgent: false };
  }
  if (app.status === 'submitted') {
    if (score >= 70) return { label: 'Move to review', color: '#22C55E', urgent: true };
    if (score >= 40) return { label: 'Move to review', color: '#F59E0B', urgent: false };
    return { label: 'Score low — review', color: '#EF4444', urgent: false };
  }
  return { label: '—', color: '#71717A', urgent: false };
}

export default function VerificationQueuePage() {
  const { lang } = useTranslation();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState({});
  const [approving, setApproving] = useState({});
  const [error, setError] = useState('');
  const [bulkProgress, setBulkProgress] = useState(null); // { done, total, failed }
  const [urgencyFilter, setUrgencyFilter] = useState('all'); // 'all' | 'urgent' | 'not_urgent'
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
    let lastFailReason = '';
    const failedIds = [];
    setBulkProgress({ done: 0, total: unscored.length, failed: 0, failedIds: [], lastFailReason: '' });
    for (const a of unscored) {
      setScoring(s => ({ ...s, [a.id]: true }));
      try {
        await api.post(`/applications/${a.id}/score-verification`);
      } catch (err) {
        failed++;
        failedIds.push(a.id);
        lastFailReason = err.response?.data?.error || err.message || 'Unknown error';
      }
      done++;
      setScoring(s => ({ ...s, [a.id]: false }));
      setBulkProgress({ done, total: unscored.length, failed, failedIds: [...failedIds], lastFailReason });
    }
    await load();
    // Keep result visible for 8 s (longer if failures) then clear
    setTimeout(() => setBulkProgress(null), failed > 0 ? 8000 : 5000);
  };

  const quickApprove = async (appId, e) => {
    e.stopPropagation();
    if (!window.confirm('Approve this application? This action will be recorded.')) return;
    setApproving(s => ({ ...s, [appId]: true }));
    try {
      await api.post(`/applications/${appId}/approve`, { reason: 'Quick-approved from queue (score >= 70)' });
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Quick approve failed');
    } finally {
      setApproving(s => ({ ...s, [appId]: false }));
    }
  };

  const unscoredCount = apps.filter(a => !a.verificationResult && a.status === 'submitted').length;
  const urgentCount = apps.filter(a => getNextAction(a).urgent).length;

  // Apply urgency filter
  const filteredApps = urgencyFilter === 'all'
    ? apps
    : urgencyFilter === 'urgent'
      ? apps.filter(a => getNextAction(a).urgent)
      : apps.filter(a => !getNextAction(a).urgent);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Verification Queue ({apps.length})</h1>
          {urgentCount > 0 && (
            <div style={{ fontSize: '0.82rem', color: '#EF4444', fontWeight: 600, marginTop: '0.15rem' }}>
              {urgentCount} item{urgentCount > 1 ? 's' : ''} need immediate attention
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <select
            value={urgencyFilter}
            onChange={e => setUrgencyFilter(e.target.value)}
            style={{
              background: '#1E293B', color: '#E2E8F0', border: '1px solid #243041',
              borderRadius: 6, padding: '0.4rem 0.6rem', fontSize: '0.85rem',
            }}
          >
            <option value="all">All items ({apps.length})</option>
            <option value="urgent">Urgent only ({urgentCount})</option>
            <option value="not_urgent">Non-urgent ({apps.length - urgentCount})</option>
          </select>
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
            background: bulkProgress.done < bulkProgress.total ? 'rgba(34,197,94,0.15)' : bulkProgress.failed > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)',
            border: `1px solid #243041`,
            borderRadius: 8, padding: '0.6rem 1rem', marginBottom: '1rem', fontSize: '0.875rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            {bulkProgress.done < bulkProgress.total ? (
              <>
                <span style={{ fontWeight: 600 }}>Scoring in progress...</span>
                <span>{bulkProgress.done} / {bulkProgress.total} done</span>
                {/* Progress bar */}
                <div style={{ flex: 1, height: 6, background: '#243041', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#22C55E', borderRadius: 3, width: `${Math.round(bulkProgress.done / bulkProgress.total * 100)}%`, transition: 'width 0.2s' }} />
                </div>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 600 }}>{bulkProgress.failed === 0 ? 'All scored successfully' : `Scoring complete`}</span>
                <span>{bulkProgress.done - bulkProgress.failed} scored</span>
                {bulkProgress.failed > 0 && <span style={{ color: '#F59E0B' }}>{bulkProgress.failed} failed — refresh to retry{bulkProgress.lastFailReason ? ` (${bulkProgress.lastFailReason})` : ''}</span>}
              </>
            )}
          </div>
        )}
        {/* Quick summary banner */}
        {!loading && apps.length > 0 && (
          <div style={{
            display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap',
          }}>
            {[
              { label: 'Urgent', count: urgentCount, color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
              { label: 'Unscored', count: unscoredCount, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
              { label: 'Total in queue', count: apps.length, color: '#A1A1AA', bg: '#1E293B' },
            ].filter(s => s.count > 0).map(s => (
              <div key={s.label} style={{
                background: s.bg, border: '1px solid #243041', borderRadius: 8,
                padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: s.color }}>{s.count}</span>
                <span style={{ fontSize: '0.78rem', color: s.color, fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {loading ? <SkeletonTable rows={6} /> : filteredApps.length === 0 && apps.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.3rem' }}>All caught up</div>
              <div style={{ color: 'var(--subtext)', fontSize: '0.875rem' }}>
                No applications awaiting verification. New submissions will appear here automatically.
              </div>
            </div>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <div style={{ color: 'var(--subtext)', fontSize: '0.875rem' }}>
                No {urgencyFilter === 'urgent' ? 'urgent' : 'non-urgent'} items. Try changing the filter above.
              </div>
            </div>
          </div>
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
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map(a => {
                      const days = Math.floor((Date.now() - new Date(a.createdAt)) / 86400000);
                      const nextAction = getNextAction(a);
                      const score = a.verificationResult?.verificationScore;
                      return (
                        <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)} style={{ cursor: 'pointer', background: nextAction.urgent ? 'rgba(245,158,11,0.15)' : undefined }}>
                          <td style={{ fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <FarmerAvatarSmall fullName={a.farmer?.fullName} profileImageUrl={a.farmer?.profileImageUrl} />
                              <span>{a.farmer?.fullName}</span>
                            </div>
                          </td>
                          <td>
                            <div>{a.farmer?.region || '-'}</div>
                            {a.farmer?.organization?.name && (
                              <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>{a.farmer.organization.name}</div>
                            )}
                          </td>
                          <td>{getCropLabelSafe(a.cropType, lang)}</td>
                          <td>{a.currencyCode || 'KES'} {a.requestedAmount?.toLocaleString()}</td>
                          <td><StatusBadge value={a.status} /></td>
                          <td>
                            {score != null
                              ? <span style={{ fontWeight: 600, color: score >= 70 ? '#22C55E' : score >= 40 ? '#F59E0B' : '#EF4444' }}>
                                  {score}/100
                                </span>
                              : <span className="text-muted" style={{ fontSize: '0.8rem' }}>Unscored</span>
                            }
                          </td>
                          <td>
                            <span style={{ color: days > 7 ? '#EF4444' : days > 3 ? '#F59E0B' : '#A1A1AA', fontWeight: days > 3 ? 600 : 400 }}>
                              {days}d{days > 7 ? ' ⚠' : ''}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8rem', fontWeight: nextAction.urgent ? 700 : 500, color: nextAction.color }}>
                              {nextAction.urgent ? '→ ' : ''}{nextAction.label}
                            </span>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {a.status === 'submitted' && !a.verificationResult && (
                              <button
                                className="btn btn-outline btn-sm"
                                disabled={scoring[a.id]}
                                onClick={(e) => runVerification(a.id, e)}
                              >
                                {scoring[a.id] ? 'Scoring...' : 'Score'}
                              </button>
                            )}
                            {score != null && score >= 70 && ['submitted', 'under_review'].includes(a.status) && (
                              <button
                                className="btn btn-sm"
                                style={{ background: '#22C55E', color: '#fff', marginLeft: '0.35rem', fontWeight: 600 }}
                                disabled={approving[a.id]}
                                onClick={(e) => quickApprove(a.id, e)}
                              >
                                {approving[a.id] ? 'Approving...' : 'Approve'}
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
