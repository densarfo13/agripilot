import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function VerificationQueuePage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState({});
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [submitted, underReview] = await Promise.all([
        api.get('/applications', { params: { status: 'submitted', limit: 100 } }),
        api.get('/applications', { params: { status: 'under_review', limit: 100 } }),
      ]);
      const all = [
        ...(submitted.data.applications || []),
        ...(underReview.data.applications || []),
      ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setApps(all);
    } catch {
      // ignore
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
      alert(err.response?.data?.error || 'Verification scoring failed');
    } finally {
      setScoring(s => ({ ...s, [appId]: false }));
    }
  };

  const runAll = async () => {
    const unscored = apps.filter(a => !a.verificationResult);
    for (const a of unscored) {
      setScoring(s => ({ ...s, [a.id]: true }));
      try {
        await api.post(`/applications/${a.id}/score-verification`);
      } catch {
        // continue with others
      }
      setScoring(s => ({ ...s, [a.id]: false }));
    }
    load();
  };

  const unscoredCount = apps.filter(a => !a.verificationResult).length;

  return (
    <>
      <div className="page-header">
        <h1>Verification Queue ({apps.length})</h1>
        <div className="flex gap-1">
          {unscoredCount > 0 && (
            <button className="btn btn-primary" onClick={runAll}>
              Score All Unscored ({unscoredCount})
            </button>
          )}
          <button className="btn btn-outline" onClick={load}>Refresh</button>
        </div>
      </div>
      <div className="page-body">
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
                      <th>Region</th>
                      <th>Crop</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Verification</th>
                      <th>Days Waiting</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map(a => {
                      const days = Math.floor((Date.now() - new Date(a.createdAt)) / 86400000);
                      return (
                        <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)} style={{ cursor: 'pointer' }}>
                          <td style={{ fontWeight: 500 }}>{a.farmer?.fullName}</td>
                          <td>{a.farmer?.region}</td>
                          <td>{a.cropType}</td>
                          <td>{a.currencyCode || 'KES'} {a.requestedAmount?.toLocaleString()}</td>
                          <td><StatusBadge value={a.status} /></td>
                          <td>
                            {a.verificationResult
                              ? <span style={{ fontWeight: 600, color: a.verificationResult.verificationScore >= 70 ? '#16a34a' : a.verificationResult.verificationScore >= 40 ? '#d97706' : '#dc2626' }}>
                                  {a.verificationResult.verificationScore}/100
                                </span>
                              : <span className="text-muted">Not scored</span>
                            }
                          </td>
                          <td>
                            <span style={{ color: days > 7 ? '#dc2626' : days > 3 ? '#d97706' : '#6b7280', fontWeight: days > 3 ? 600 : 400 }}>
                              {days}d
                            </span>
                          </td>
                          <td>
                            {!a.verificationResult && (
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
