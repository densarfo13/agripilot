import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get('/audit', { params: { page, limit: 50 } })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <div className="page-header"><h1>Audit Trail ({total})</h1></div>
      <div className="page-body">
        {loading ? <div className="loading">Loading...</div> : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Timestamp</th><th>User</th><th>Role</th><th>Action</th><th>Application</th><th>Status Change</th></tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} onClick={() => log.applicationId && navigate(`/applications/${log.applicationId}`)} style={{ cursor: log.applicationId ? 'pointer' : 'default' }}>
                        <td className="text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                        <td style={{ fontWeight: 500 }}>{log.user?.fullName}</td>
                        <td className="text-sm text-muted">{log.user?.role?.replace(/_/g, ' ')}</td>
                        <td>{log.action.replace(/_/g, ' ')}</td>
                        <td className="text-sm">{log.application ? <StatusBadge value={log.application.status} /> : '-'}</td>
                        <td className="text-sm">
                          {log.previousStatus && log.newStatus ? (
                            <>{log.previousStatus.replace(/_/g, ' ')} &rarr; {log.newStatus.replace(/_/g, ' ')}</>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {total > 50 && (
          <div className="pagination">
            <span>Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-1">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
              <button className="btn btn-outline btn-sm" disabled={page * 50 >= total} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
