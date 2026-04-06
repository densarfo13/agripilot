import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ScoreBar from '../components/ScoreBar.jsx';
import { useAuthStore } from '../store/authStore.js';
import { ADMIN_ROLES, REVIEW_ROLES } from '../utils/roles.js';
import { DEFAULT_COUNTRY_CODE } from '../utils/constants.js';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [auditLogs, setAuditLogs] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [actionModal, setActionModal] = useState(null); // {type, title}
  const [actionReason, setActionReason] = useState('');
  const [actionAmount, setActionAmount] = useState('');
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const canRunEngines = REVIEW_ROLES.includes(user?.role);

  const reload = useCallback(() => {
    api.get(`/applications/${id}`).then(r => setApp(r.data)).catch(() => navigate('/applications'));
  }, [id]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/applications/${id}`),
      api.get(`/audit/application/${id}`).catch(() => ({ data: [] })),
    ]).then(([appRes, auditRes]) => {
      setApp(appRes.data);
      setAuditLogs(auditRes.data);
    }).catch(() => navigate('/applications'))
      .finally(() => setLoading(false));
  }, [id]);

  // Engine scoring — uses new nested endpoints
  const runEngine = async (engine, label) => {
    setActionLoading(engine);
    try {
      await api.post(`/applications/${id}/score-${engine}`);
      reload();
      api.get(`/audit/application/${id}`).then(r => setAuditLogs(r.data)).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.error || `Failed to run ${label}`);
    } finally { setActionLoading(''); }
  };

  // Workflow actions
  const runWorkflowAction = async (action, body = {}) => {
    setActionLoading(action);
    try {
      if (action === 'submit') await api.post(`/applications/${id}/submit`);
      else await api.post(`/applications/${id}/${action}`, body);
      reload();
      api.get(`/audit/application/${id}`).then(r => setAuditLogs(r.data)).catch(() => {});
      setActionModal(null);
      setActionReason('');
    } catch (err) {
      alert(err.response?.data?.error || `Failed: ${action}`);
    } finally { setActionLoading(''); }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await api.post(`/reviews/${id}/notes`, { content: noteText });
      setNoteText('');
      reload();
    } catch {}
  };

  if (loading) return <div className="loading">Loading application...</div>;
  if (!app) return null;

  const currency = app.currencyCode || 'KES';
  const TABS = ['overview', 'location', 'evidence', 'engines', 'reviews', 'timeline'];
  if (isAdmin) TABS.push('intelligence');

  // Determine which workflow actions are available based on current status
  const workflowActions = [];
  if (app.status === 'draft') workflowActions.push({ key: 'submit', label: 'Submit', cls: 'btn-primary', needsReason: false });
  if (['under_review', 'escalated'].includes(app.status) && canRunEngines) {
    workflowActions.push({ key: 'approve', label: 'Approve', cls: 'btn-success', needsReason: true });
    workflowActions.push({ key: 'reject', label: 'Reject', cls: 'btn-danger', needsReason: true });
  }
  if (app.status === 'under_review' && canRunEngines) {
    workflowActions.push({ key: 'escalate', label: 'Escalate', cls: 'btn-warning', needsReason: true });
    workflowActions.push({ key: 'request-evidence', label: 'Request Evidence', cls: 'btn-outline', needsReason: true });
  }
  if (['approved', 'conditional_approved'].includes(app.status) && isAdmin) {
    workflowActions.push({ key: 'disburse', label: 'Disburse', cls: 'btn-success', needsReason: false });
  }
  if (['rejected', 'needs_more_evidence', 'escalated', 'fraud_hold'].includes(app.status) && isAdmin) {
    workflowActions.push({ key: 'reopen', label: 'Reopen', cls: 'btn-outline', needsReason: false });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {app.farmer?.fullName} — {app.cropType}
            <StatusBadge value={app.status} />
          </h1>
          <div className="text-sm text-muted" style={{ marginTop: 2 }}>
            {currency} {app.requestedAmount?.toLocaleString()} | {app.farmSizeAcres} acres | {app.season || 'No season'}
            {app.farmer?.countryCode && ` | ${app.farmer.countryCode}`}
          </div>
        </div>
        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
          {workflowActions.map(a => (
            <button key={a.key} className={`btn btn-sm ${a.cls}`} disabled={!!actionLoading}
              onClick={() => {
                if (a.needsReason) {
                  setActionModal({ type: a.key, title: a.label });
                  setActionReason('');
                  // Pre-fill recommended amount from decision engine for approve action
                  setActionAmount(a.key === 'approve' && app.decisionResult?.recommendedAmount ? String(app.decisionResult.recommendedAmount) : '');
                } else {
                  runWorkflowAction(a.key);
                }
              }}>
              {actionLoading === a.key ? '...' : a.label}
            </button>
          ))}
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/applications')}>Back</button>
        </div>
      </div>

      {/* Engine buttons bar */}
      {canRunEngines && app.status !== 'draft' && (
        <div style={{ padding: '0 1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <span className="text-sm text-muted" style={{ alignSelf: 'center', marginRight: '0.25rem' }}>Engines:</span>
          <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => runEngine('verification', 'Verification')}>
            {actionLoading === 'verification' ? '...' : 'Verification'}
          </button>
          <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => runEngine('fraud', 'Fraud')}>
            {actionLoading === 'fraud' ? '...' : 'Fraud'}
          </button>
          <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => runEngine('decision', 'Decision')}>
            {actionLoading === 'decision' ? '...' : 'Decision'}
          </button>
          <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => runEngine('benchmark', 'Benchmark')}>
            {actionLoading === 'benchmark' ? '...' : 'Benchmark'}
          </button>
          {isAdmin && (
            <button className="btn btn-outline btn-sm" disabled={!!actionLoading} onClick={() => runEngine('intelligence', 'Intelligence')}>
              {actionLoading === 'intelligence' ? '...' : 'Intelligence'}
            </button>
          )}
        </div>
      )}

      <div className="page-body">
        <div className="tabs">
          {TABS.map(t => <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>)}
        </div>

        {tab === 'overview' && <OverviewTab app={app} currency={currency} />}
        {tab === 'location' && <LocationTab app={app} />}
        {tab === 'evidence' && <EvidenceTab app={app} />}
        {tab === 'engines' && <EnginesTab app={app} currency={currency} />}
        {tab === 'reviews' && <ReviewsTab app={app} noteText={noteText} setNoteText={setNoteText} addNote={addNote} canRunEngines={canRunEngines} />}
        {tab === 'timeline' && <TimelineTab logs={auditLogs} />}
        {tab === 'intelligence' && <IntelligenceTab app={app} />}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">{actionModal.title} <button className="btn btn-outline btn-sm" onClick={() => setActionModal(null)}>X</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Reason {actionModal.type === 'reject' ? '(required)' : '(optional)'}</label>
                <textarea className="form-textarea" rows={3} value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Enter reason..." />
              </div>
              {actionModal.type === 'approve' && (
                <div className="form-group" style={{ marginTop: '0.75rem' }}>
                  <label className="form-label">Approved Amount ({currency})</label>
                  <input className="form-input" type="number" step="0.01" min="0" value={actionAmount} onChange={e => setActionAmount(e.target.value)} placeholder={`Requested: ${app.requestedAmount?.toLocaleString()}`} />
                  <div className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>
                    Leave blank to approve full requested amount.
                    {app.decisionResult?.recommendedAmount && ` Engine recommended: ${currency} ${app.decisionResult.recommendedAmount.toLocaleString()}`}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setActionModal(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={!!actionLoading || (actionModal.type === 'reject' && !actionReason.trim())}
                onClick={() => runWorkflowAction(actionModal.type, {
                  reason: actionReason,
                  ...(actionModal.type === 'approve' && actionAmount ? { recommendedAmount: parseFloat(actionAmount) } : {}),
                })}>
                {actionLoading ? '...' : `Confirm ${actionModal.title}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OverviewTab({ app, currency }) {
  return (
    <div className="detail-grid">
      <div className="card">
        <div className="card-header">Application Details</div>
        <div className="card-body">
          <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><StatusBadge value={app.status} /></span></div>
          <div className="detail-row"><span className="detail-label">Crop Type</span><span className="detail-value">{app.cropType}</span></div>
          <div className="detail-row"><span className="detail-label">Farm Size</span><span className="detail-value">{app.farmSizeAcres} acres</span></div>
          <div className="detail-row"><span className="detail-label">Requested Amount</span><span className="detail-value">{currency} {app.requestedAmount?.toLocaleString()}</span></div>
          {app.recommendedAmount && <div className="detail-row"><span className="detail-label">Approved Amount</span><span className="detail-value" style={{ fontWeight: 700, color: '#16a34a' }}>{currency} {app.recommendedAmount.toLocaleString()}</span></div>}
          <div className="detail-row"><span className="detail-label">Purpose</span><span className="detail-value">{app.purpose || '-'}</span></div>
          <div className="detail-row"><span className="detail-label">Season</span><span className="detail-value">{app.season || '-'}</span></div>
          <div className="detail-row"><span className="detail-label">Created By</span><span className="detail-value">{app.createdBy?.fullName}</span></div>
          <div className="detail-row"><span className="detail-label">Created At</span><span className="detail-value">{new Date(app.createdAt).toLocaleString()}</span></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header">Farmer Details</div>
        <div className="card-body">
          <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{app.farmer?.fullName}</span></div>
          <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{app.farmer?.phone}</span></div>
          <div className="detail-row"><span className="detail-label">Region</span><span className="detail-value">{app.farmer?.region}</span></div>
          <div className="detail-row"><span className="detail-label">Country</span><span className="detail-value">{app.farmer?.countryCode || DEFAULT_COUNTRY_CODE}</span></div>
          <div className="detail-row"><span className="detail-label">Primary Crop</span><span className="detail-value">{app.farmer?.primaryCrop || '-'}</span></div>
        </div>
      </div>
      {app.decisionResult && (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">Decision Engine Recommendation</div>
          <div className="card-body">
            {/* Banner when decision recommends approval but status is still under_review */}
            {['approve', 'conditional_approve'].includes(app.decisionResult.decision) && app.status === 'under_review' && (
              <div className="alert alert-info" style={{ marginBottom: '1rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                <strong>Human review required:</strong> The decision engine recommends <em>{app.decisionResult.decisionLabel}</em>
                {app.decisionResult.recommendedAmount && <> for {currency} {app.decisionResult.recommendedAmount.toLocaleString()}</>}.
                Use the <strong>Approve</strong> or <strong>Reject</strong> button above to finalize.
              </div>
            )}
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
              <div><div className="stat-label">Recommendation</div><StatusBadge value={app.decisionResult.decision} /></div>
              <div><div className="stat-label">Risk Level</div><StatusBadge value={app.decisionResult.riskLevel} /></div>
              {app.decisionResult.recommendedAmount && <div><div className="stat-label">Recommended Amount</div><div style={{ fontWeight: 700 }}>{currency} {app.decisionResult.recommendedAmount.toLocaleString()}</div></div>}
            </div>
            <div className="text-sm" style={{ fontWeight: 600 }}>{app.decisionResult.decisionLabel}</div>
            {app.decisionResult.reasons?.length > 0 && (
              <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#4b5563' }}>
                {app.decisionResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            )}
            {app.decisionResult.blockers?.length > 0 && (
              <div className="alert alert-warning" style={{ marginTop: '0.75rem' }}>
                <strong>Blockers:</strong>
                <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                  {app.decisionResult.blockers.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Intelligence Summary if available */}
      {app.verificationResult?.intelligenceSummary && (
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">Intelligence Context <span className="text-sm text-muted">(shadow — advisory only)</span></div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
              {app.verificationResult.intelligenceSummary.cropOutlook && <div><span className="detail-label">Crop Outlook</span> {app.verificationResult.intelligenceSummary.cropOutlook}</div>}
              {app.verificationResult.intelligenceSummary.marketOutlook && <div><span className="detail-label">Market</span> {app.verificationResult.intelligenceSummary.marketOutlook}</div>}
              {app.verificationResult.intelligenceSummary.weatherRisk && <div><span className="detail-label">Weather Risk</span> {app.verificationResult.intelligenceSummary.weatherRisk}</div>}
              {app.verificationResult.intelligenceSummary.trustLevel && <div><span className="detail-label">Trust</span> {app.verificationResult.intelligenceSummary.trustLevel}</div>}
              {app.verificationResult.intelligenceSummary.demandLevel && <div><span className="detail-label">Demand</span> {app.verificationResult.intelligenceSummary.demandLevel}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationTab({ app }) {
  const loc = app.farmLocation;
  const boundary = app.farmBoundary;
  return (
    <div className="detail-grid">
      <div className="card">
        <div className="card-header">GPS Location</div>
        <div className="card-body">
          {loc ? (
            <>
              <div className="detail-row"><span className="detail-label">Latitude</span><span className="detail-value">{loc.latitude}</span></div>
              <div className="detail-row"><span className="detail-label">Longitude</span><span className="detail-value">{loc.longitude}</span></div>
              <div className="detail-row"><span className="detail-label">Accuracy</span><span className="detail-value">{loc.accuracy ? `${loc.accuracy}m` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Method</span><span className="detail-value">{loc.gpsMethod || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Captured At</span><span className="detail-value">{new Date(loc.capturedAt).toLocaleString()}</span></div>
            </>
          ) : <div className="empty-state">No GPS data captured</div>}
        </div>
      </div>
      <div className="card">
        <div className="card-header">Farm Boundary</div>
        <div className="card-body">
          {boundary ? (
            <>
              <div className="detail-row"><span className="detail-label">Measured Area</span><span className="detail-value">{boundary.measuredArea ? `${boundary.measuredArea} acres` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Perimeter</span><span className="detail-value">{boundary.perimeterMeters ? `${boundary.perimeterMeters}m` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Points</span><span className="detail-value">{boundary.points?.length || 0} vertices</span></div>
            </>
          ) : <div className="empty-state">No boundary data captured</div>}
        </div>
      </div>
    </div>
  );
}

function EvidenceTab({ app }) {
  const files = app.evidenceFiles || [];
  return (
    <div className="card">
      <div className="card-header">Evidence Files ({files.length})</div>
      <div className="card-body" style={{ padding: files.length ? 0 : undefined }}>
        {files.length === 0 ? <div className="empty-state">No evidence files uploaded</div> : (
          <table>
            <thead><tr><th>Type</th><th>Original Name</th><th>Size</th><th>MIME</th><th>Uploaded</th></tr></thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id}>
                  <td><StatusBadge value={f.type} /></td>
                  <td>{f.originalName}</td>
                  <td>{(f.sizeBytes / 1024).toFixed(0)} KB</td>
                  <td className="text-sm text-muted">{f.mimeType}</td>
                  <td className="text-sm text-muted">{new Date(f.uploadedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function EnginesTab({ app, currency }) {
  const v = app.verificationResult;
  const f = app.fraudResult;
  const d = app.decisionResult;
  const b = app.benchmarkResult;

  return (
    <div className="detail-grid">
      <div className="card">
        <div className="card-header">Verification Engine</div>
        <div className="card-body">
          {v ? (
            <>
              <ScoreBar score={v.verificationScore} label="Verification Score" />
              <div style={{ marginTop: '0.75rem' }}>
                <div className="detail-row"><span className="detail-label">Confidence</span><span className="detail-value"><StatusBadge value={v.confidence} /></span></div>
                <div className="detail-row"><span className="detail-label">Recommendation</span><span className="detail-value">{v.recommendation}</span></div>
              </div>
              {v.flags?.length > 0 && <div className="alert alert-warning" style={{ marginTop: '0.75rem' }}><strong>Flags:</strong> {v.flags.join(', ')}</div>}
              {v.intelligenceSummary && <div className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>Intelligence context attached</div>}
            </>
          ) : <div className="empty-state">Verification not yet run</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Fraud Analysis</div>
        <div className="card-body">
          {f ? (
            <>
              <ScoreBar score={f.fraudRiskScore} label="Fraud Risk Score" />
              <div style={{ marginTop: '0.75rem' }}>
                <div className="detail-row"><span className="detail-label">Risk Level</span><span className="detail-value"><StatusBadge value={f.fraudRiskLevel} /></span></div>
                <div className="detail-row"><span className="detail-label">Action</span><span className="detail-value">{f.action}</span></div>
              </div>
              {f.flags?.length > 0 && <div className="alert alert-danger" style={{ marginTop: '0.75rem' }}><strong>Fraud Flags:</strong> {f.flags.join(', ')}</div>}
              {f.intelligenceSummary && <div className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>Intelligence context attached</div>}
            </>
          ) : <div className="empty-state">Fraud analysis not yet run</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Decision Engine</div>
        <div className="card-body">
          {d ? (
            <>
              <div className="detail-row"><span className="detail-label">Decision</span><span className="detail-value"><StatusBadge value={d.decision} /></span></div>
              <div className="detail-row"><span className="detail-label">Risk Level</span><span className="detail-value"><StatusBadge value={d.riskLevel} /></span></div>
              {d.recommendedAmount && <div className="detail-row"><span className="detail-label">Recommended</span><span className="detail-value">{currency} {d.recommendedAmount.toLocaleString()}</span></div>}
              {d.nextActions?.length > 0 && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div className="text-sm" style={{ fontWeight: 600 }}>Next Actions:</div>
                  <ul style={{ paddingLeft: '1.25rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                    {d.nextActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : <div className="empty-state">Decision engine not yet run</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Benchmarking</div>
        <div className="card-body">
          {b ? (
            <>
              <div className="detail-row"><span className="detail-label">Peer Group Size</span><span className="detail-value">{b.peerGroupSize}</span></div>
              {b.verificationPercentile !== null && <div className="detail-row"><span className="detail-label">Verification Percentile</span><span className="detail-value">{b.verificationPercentile}th</span></div>}
              {b.yieldPercentile !== null && <div className="detail-row"><span className="detail-label">Yield Percentile</span><span className="detail-value">{b.yieldPercentile}th</span></div>}
              {b.strengths?.length > 0 && (
                <div className="alert alert-success" style={{ marginTop: '0.75rem' }}>
                  <strong>Strengths:</strong>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>{b.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              )}
              {b.concerns?.length > 0 && (
                <div className="alert alert-warning" style={{ marginTop: '0.5rem' }}>
                  <strong>Concerns:</strong>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>{b.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}
            </>
          ) : <div className="empty-state">Benchmarking not yet run</div>}
        </div>
      </div>
    </div>
  );
}

function ReviewsTab({ app, noteText, setNoteText, addNote, canRunEngines }) {
  const notes = app.reviewNotes || [];
  const assignments = app.reviewAssignments || [];
  const visits = app.fieldVisits || [];

  return (
    <div className="detail-grid">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="card-header">Review Notes ({notes.length})</div>
        <div className="card-body">
          {canRunEngines && (
            <div className="flex gap-1" style={{ marginBottom: '1rem' }}>
              <textarea className="form-textarea" style={{ minHeight: 60, flex: 1 }} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a review note..." />
              <button className="btn btn-primary" onClick={addNote} style={{ alignSelf: 'flex-end' }}>Add Note</button>
            </div>
          )}
          {notes.map(n => (
            <div key={n.id} style={{ padding: '0.75rem', borderBottom: '1px solid #f3f4f6' }}>
              <div className="flex-between">
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{n.author?.fullName}</span>
                <span className="text-sm text-muted">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              <p style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#374151' }}>{n.content}</p>
            </div>
          ))}
          {notes.length === 0 && <div className="empty-state">No review notes yet</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Review Assignments</div>
        <div className="card-body" style={{ padding: assignments.length ? 0 : undefined }}>
          {assignments.length > 0 ? (
            <table>
              <thead><tr><th>Reviewer</th><th>Status</th><th>Assigned</th></tr></thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id}>
                    <td>{a.reviewer?.fullName}</td>
                    <td><StatusBadge value={a.status} /></td>
                    <td className="text-sm text-muted">{new Date(a.assignedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty-state">No reviewers assigned</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Field Visits</div>
        <div className="card-body" style={{ padding: visits.length ? 0 : undefined }}>
          {visits.length > 0 ? (
            <table>
              <thead><tr><th>Officer</th><th>Date</th><th>Completed</th><th>Notes</th></tr></thead>
              <tbody>
                {visits.map(v => (
                  <tr key={v.id}>
                    <td>{v.officer?.fullName}</td>
                    <td>{new Date(v.visitDate).toLocaleDateString()}</td>
                    <td>{v.completed ? 'Yes' : 'No'}</td>
                    <td className="text-sm">{v.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty-state">No field visits</div>}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ logs }) {
  return (
    <div className="card">
      <div className="card-header">Audit Timeline ({logs.length} events)</div>
      <div className="card-body">
        {logs.length === 0 ? <div className="empty-state">No audit trail</div> : (
          <div className="timeline">
            {logs.map(log => (
              <div key={log.id} className="timeline-item">
                <div className="timeline-time">{new Date(log.createdAt).toLocaleString()}</div>
                <div className="timeline-action">{log.action.replace(/_/g, ' ')}</div>
                <div className="timeline-user">{log.user?.fullName}</div>
                {log.previousStatus && log.newStatus && (
                  <div className="text-sm" style={{ marginTop: 2 }}>
                    <StatusBadge value={log.previousStatus} /> &rarr; <StatusBadge value={log.newStatus} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IntelligenceTab({ app }) {
  const intel = app.intelligenceResult;
  if (!intel) return <div className="card"><div className="card-body"><div className="empty-state">Intelligence not yet run</div></div></div>;

  const SignalCard = ({ title, children }) => (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="card-body">{children}</div>
    </div>
  );

  return (
    <div className="detail-grid">
      <div className="card" style={{ gridColumn: '1 / -1' }}>
        <div className="alert alert-info">This is secondary/shadow intelligence only. It does NOT influence the decision engine.</div>
      </div>

      <SignalCard title="ML Shadow Score">
        {intel.mlShadowScore !== null ? (
          <>
            <ScoreBar score={Math.round(intel.mlShadowScore * 100)} label="Predictive Score" />
            <div className="detail-row" style={{ marginTop: '0.5rem' }}><span className="detail-label">Confidence</span><span className="detail-value">{(intel.mlShadowConfidence * 100).toFixed(0)}%</span></div>
          </>
        ) : <div className="text-muted text-sm">Not enough data</div>}
      </SignalCard>

      <SignalCard title="Relationship Signal">
        {intel.relationshipSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Total Applications</span><span className="detail-value">{intel.relationshipSignal.totalApplications}</span></div>
            <div className="detail-row"><span className="detail-label">Approved</span><span className="detail-value">{intel.relationshipSignal.approvedApplications}</span></div>
            <div className="detail-row"><span className="detail-label">Trust Level</span><span className="detail-value">{intel.relationshipSignal.trustLevel}</span></div>
          </>
        )}
      </SignalCard>

      <SignalCard title="Crop Prediction">
        {intel.cropPredictionSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Season Outlook</span><span className="detail-value">{intel.cropPredictionSignal.seasonOutlook}</span></div>
            <div className="detail-row"><span className="detail-label">Performance</span><span className="detail-value">{intel.cropPredictionSignal.expectedPerformance?.replace(/_/g, ' ')}</span></div>
            {intel.cropPredictionSignal.riskFactors?.length > 0 && (
              <div className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>Risks: {intel.cropPredictionSignal.riskFactors.join(', ')}</div>
            )}
          </>
        )}
      </SignalCard>

      <SignalCard title="Weather Signal">
        {intel.weatherSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Season</span><span className="detail-value">{intel.weatherSignal.currentSeason?.replace(/_/g, ' ')}</span></div>
            <div className="detail-row"><span className="detail-label">Drought Risk</span><span className="detail-value">{intel.weatherSignal.droughtRisk}</span></div>
            <div className="detail-row"><span className="detail-label">Flood Risk</span><span className="detail-value">{intel.weatherSignal.floodRisk}</span></div>
          </>
        )}
      </SignalCard>

      <SignalCard title="Market Signal">
        {intel.marketSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Price Outlook</span><span className="detail-value">{intel.marketSignal.priceOutlook}</span></div>
            <div className="detail-row"><span className="detail-label">Demand</span><span className="detail-value">{intel.marketSignal.demandLevel}</span></div>
            <div className="detail-row"><span className="detail-label">Export</span><span className="detail-value">{intel.marketSignal.exportPotential?.replace(/_/g, ' ')}</span></div>
          </>
        )}
      </SignalCard>

      <SignalCard title="Storage Signal">
        {intel.storageSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Recommended</span><span className="detail-value">{intel.storageSignal.recommendedStorage?.replace(/_/g, ' ')}</span></div>
            <div className="detail-row"><span className="detail-label">Post-Harvest Loss Risk</span><span className="detail-value">{intel.storageSignal.postHarvestLossRisk}</span></div>
          </>
        )}
      </SignalCard>

      <SignalCard title="Buyer Signal">
        {intel.buyerSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Active Interests</span><span className="detail-value">{intel.buyerSignal.activeBuyerInterests}</span></div>
            <div className="detail-row"><span className="detail-label">Demand Level</span><span className="detail-value">{intel.buyerSignal.demandLevel}</span></div>
          </>
        )}
      </SignalCard>

      <SignalCard title="Analytics Signal">
        {intel.analyticsSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Portfolio Approval Rate</span><span className="detail-value">{intel.analyticsSignal.portfolioApprovalRate}%</span></div>
            <div className="detail-row"><span className="detail-label">Crop Concentration</span><span className="detail-value">{intel.analyticsSignal.cropConcentration}%</span></div>
            <div className="detail-row"><span className="detail-label">Region Concentration</span><span className="detail-value">{intel.analyticsSignal.regionConcentration}%</span></div>
          </>
        )}
      </SignalCard>

      <SignalCard title="Anomaly Signal">
        {intel.anomalySignal && (
          <>
            {intel.anomalySignal.amountVsRegionAvg && <div className="detail-row"><span className="detail-label">Amount vs Region Avg</span><span className="detail-value">{intel.anomalySignal.amountVsRegionAvg}x</span></div>}
            {intel.anomalySignal.sizeVsClaimed && <div className="detail-row"><span className="detail-label">Measured vs Claimed</span><span className="detail-value">{intel.anomalySignal.sizeVsClaimed}x</span></div>}
            {intel.anomalySignal.flags?.length > 0 ? (
              <div className="alert alert-warning" style={{ marginTop: '0.5rem' }}>{intel.anomalySignal.flags.map((f, i) => <div key={i}>{f.replace(/_/g, ' ')}</div>)}</div>
            ) : <div className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>No anomalies detected</div>}
          </>
        )}
      </SignalCard>

      <SignalCard title="Satellite Signal">
        {intel.satelliteSignal && (
          <>
            <div className="detail-row"><span className="detail-label">Has Location</span><span className="detail-value">{intel.satelliteSignal.hasLocation ? 'Yes' : 'No'}</span></div>
            {intel.satelliteSignal.ndviEstimate && <div className="detail-row"><span className="detail-label">NDVI</span><span className="detail-value">{intel.satelliteSignal.ndviEstimate.toFixed(2)}</span></div>}
            {intel.satelliteSignal.vegetationHealth && <div className="detail-row"><span className="detail-label">Vegetation</span><span className="detail-value">{intel.satelliteSignal.vegetationHealth}</span></div>}
          </>
        )}
      </SignalCard>
    </div>
  );
}
