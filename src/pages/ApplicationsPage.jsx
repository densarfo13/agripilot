import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

const STATUSES = ['', 'draft', 'submitted', 'under_review', 'needs_more_evidence', 'field_review_required', 'fraud_hold', 'approved', 'conditional_approved', 'rejected', 'escalated', 'disbursed'];

export default function ApplicationsPage() {
  const [apps, setApps] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/applications', { params: { page, limit: 20, status: status || undefined, search: search || undefined } })
      .then(r => { setApps(r.data.applications); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page, status]);

  return (
    <>
      <div className="page-header">
        <h1>Applications ({total})</h1>
        <div className="flex gap-1">
          <select className="form-select" style={{ width: 180 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <form onSubmit={e => { e.preventDefault(); load(); }} className="flex gap-1">
            <input className="form-input" style={{ width: 200 }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            <button type="submit" className="btn btn-outline">Search</button>
          </form>
          <button className="btn btn-primary" onClick={() => navigate('/applications/new')}>+ New Application</button>
        </div>
      </div>
      <div className="page-body">
        {loading ? <div className="loading">Loading...</div> : (
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
                      <th>Fraud Risk</th>
                      <th>Decision</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map(a => (
                      <tr key={a.id} onClick={() => navigate(`/applications/${a.id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{a.farmer?.fullName}</td>
                        <td>{a.farmer?.region}</td>
                        <td>{a.cropType}</td>
                        <td>{a.currencyCode || 'KES'} {a.requestedAmount?.toLocaleString()}</td>
                        <td><StatusBadge value={a.status} /></td>
                        <td>{a.verificationResult ? `${a.verificationResult.verificationScore}/100` : '-'}</td>
                        <td>{a.fraudResult ? <StatusBadge value={a.fraudResult.fraudRiskLevel} /> : '-'}</td>
                        <td>{a.decisionResult ? <StatusBadge value={a.decisionResult.decision} /> : '-'}</td>
                        <td className="text-sm text-muted">{new Date(a.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                    {apps.length === 0 && <tr><td colSpan={9} className="empty-state">No applications found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {total > 20 && (
          <div className="pagination">
            <span>Page {page} of {Math.ceil(total / 20)}</span>
            <div className="flex gap-1">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
              <button className="btn btn-outline btn-sm" disabled={page * 20 >= total} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
