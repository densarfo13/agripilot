import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function FraudQueuePage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/applications', { params: { status: 'on_hold', limit: 100 } });
      setApps(res.data.applications || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAction = async (appId, action, e) => {
    e.stopPropagation();
    const reason = action === 'reject'
      ? prompt('Enter rejection reason:')
      : action === 'escalate'
        ? prompt('Enter escalation reason:')
        : null;
    if ((action === 'reject' || action === 'escalate') && !reason) return;

    setActionLoading(s => ({ ...s, [appId]: action }));
    try {
      await api.post(`/applications/${appId}/${action}`, { reason });
      load();
    } catch (err) {
      alert(err.response?.data?.error || `${action} failed`);
    } finally {
      setActionLoading(s => ({ ...s, [appId]: null }));
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Fraud Review Queue ({apps.length})</h1>
        <button className="btn btn-outline" onClick={load}>Refresh</button>
      </div>
      <div className="page-body">
        {loading ? <div className="loading">Loading...</div> : apps.length === 0 ? (
          <div className="card"><div className="card-body"><div className="empty-state">No applications on fraud hold</div></div></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {apps.map(a => {
              const fraud = a.fraudResult;
              return (
                <div key={a.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/applications/${a.id}`)}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{a.farmer?.fullName}</strong>
                      <span className="text-muted" style={{ marginLeft: '0.75rem' }}>{a.farmer?.region}</span>
                      <span className="text-muted" style={{ marginLeft: '0.75rem' }}>{a.cropType}</span>
                      <span style={{ marginLeft: '0.75rem' }}>{a.currencyCode || 'KES'} {a.requestedAmount?.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <StatusBadge value={a.status} />
                      {fraud && <StatusBadge value={fraud.fraudRiskLevel} />}
                    </div>
                  </div>
                  <div className="card-body">
                    {fraud ? (
                      <div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <strong>Fraud Score:</strong> {fraud.fraudScore}/100
                          <span style={{ marginLeft: '1rem' }}><strong>Risk Level:</strong> {fraud.fraudRiskLevel}</span>
                        </div>
                        {fraud.flags && fraud.flags.length > 0 && (
                          <div style={{ marginBottom: '0.75rem' }}>
                            <strong>Flags:</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.35rem' }}>
                              {fraud.flags.map((f, i) => (
                                <span key={i} style={{ background: '#fef2f2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.85rem', border: '1px solid #fecaca' }}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {fraud.reasons && fraud.reasons.length > 0 && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Details:</strong>
                            <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                              {fraud.reasons.map((r, i) => <li key={i} style={{ fontSize: '0.9rem' }}>{r}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted">No fraud analysis available. Run fraud scoring from the application detail page.</p>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={!!actionLoading[a.id]}
                        onClick={(e) => handleAction(a.id, 'reopen', e)}
                      >
                        {actionLoading[a.id] === 'reopen' ? 'Reopening...' : 'Clear & Reopen'}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: '#d97706', borderColor: '#d97706' }}
                        disabled={!!actionLoading[a.id]}
                        onClick={(e) => handleAction(a.id, 'escalate', e)}
                      >
                        {actionLoading[a.id] === 'escalate' ? 'Escalating...' : 'Escalate'}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ color: '#dc2626', borderColor: '#dc2626' }}
                        disabled={!!actionLoading[a.id]}
                        onClick={(e) => handleAction(a.id, 'reject', e)}
                      >
                        {actionLoading[a.id] === 'reject' ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
