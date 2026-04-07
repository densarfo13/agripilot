import React, { useEffect, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api, { formatApiError } from '../api/client.js';

export default function FarmerRemindersTab() {
  const { farmerId, refresh, activeSeason } = useFarmerContext();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState({});
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ cropType: '', plantingDate: '' });
  const [genLoading, setGenLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', message: '', dueDate: '', reminderType: 'custom' });
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadReminders = () => {
    setLoading(true);
    const params = {};
    if (filter === 'pending') params.status = 'pending';
    else if (filter === 'done') params.status = 'done';
    else if (filter === 'overdue') params.overdue = 'true';
    api.get(`/reminders/farmer/${farmerId}`, { params })
      .then(r => { setReminders(r.data); setError(''); })
      .catch(err => setError(formatApiError(err, 'Failed to load reminders')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReminders(); }, [farmerId, filter]);

  const markDone = async (id) => {
    setActionLoading(s => ({ ...s, [id]: 'done' }));
    try {
      await api.patch(`/reminders/${id}/done`);
      loadReminders();
      refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to mark reminder as done'));
    } finally {
      setActionLoading(s => ({ ...s, [id]: null }));
    }
  };

  const dismiss = async (id) => {
    setActionLoading(s => ({ ...s, [id]: 'dismiss' }));
    try {
      await api.patch(`/reminders/${id}/dismiss`);
      loadReminders();
      refresh();
    } catch (err) {
      setError(formatApiError(err, 'Failed to dismiss reminder'));
    } finally {
      setActionLoading(s => ({ ...s, [id]: null }));
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setGenLoading(true);
    try {
      const res = await api.post(`/reminders/farmer/${farmerId}/generate`, {
        cropType: genForm.cropType,
        plantingDate: genForm.plantingDate,
      });
      setShowGenerate(false);
      setGenForm({ cropType: '', plantingDate: '' });
      loadReminders();
      refresh();
      setSuccess(`Generated ${res.data.generated} reminders for ${genForm.cropType}`);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate reminders');
    } finally {
      setGenLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setCreateLoading(true);
    try {
      await api.post(`/reminders/farmer/${farmerId}`, createForm);
      setShowCreate(false);
      setCreateForm({ title: '', message: '', dueDate: '', reminderType: 'custom' });
      loadReminders();
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create reminder');
    } finally {
      setCreateLoading(false);
    }
  };

  const isOverdue = (r) => !r.completed && new Date(r.dueDate) < new Date();

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="flex gap-1">
          {['pending', 'overdue', 'done', 'all'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button className="btn btn-outline" onClick={() => {
            if (!showGenerate && activeSeason) {
              // Prefill from active season so farmer doesn't re-type crop/date
              setGenForm({
                cropType: activeSeason.cropType || '',
                plantingDate: activeSeason.plantingDate ? activeSeason.plantingDate.split('T')[0] : '',
              });
            }
            setShowGenerate(s => !s);
            setShowCreate(false);
          }}>
            Generate Crop Reminders
          </button>
          <button className="btn btn-primary" onClick={() => { setShowCreate(!showCreate); setShowGenerate(false); }}>
            + Custom Reminder
          </button>
        </div>
      </div>

      {success && <div style={{ background: '#d4edda', color: '#155724', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9rem' }}>{success}</div>}
      {error && !showGenerate && !showCreate && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button className="btn btn-sm btn-outline" style={{ flexShrink: 0, marginLeft: '0.75rem' }} onClick={loadReminders}>Try again</button>
        </div>
      )}

      {/* Generate crop lifecycle reminders */}
      {showGenerate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">Generate Crop Lifecycle Reminders</div>
          <div className="card-body">
            <form onSubmit={handleGenerate}>
              {error && <div style={{ color: '#dc2626', marginBottom: '0.75rem', padding: '0.5rem', background: '#fef2f2', borderRadius: 4 }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Crop Type *</label>
                  <input className="form-input" value={genForm.cropType} onChange={e => setGenForm({ ...genForm, cropType: e.target.value })} placeholder="e.g. maize, wheat, rice, coffee" required />
                </div>
                <div>
                  <label className="form-label">Planting Date *</label>
                  <input className="form-input" type="date" value={genForm.plantingDate} onChange={e => setGenForm({ ...genForm, plantingDate: e.target.value })} required />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowGenerate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={genLoading}>{genLoading ? 'Generating...' : 'Generate'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create custom reminder */}
      {showCreate && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">Create Custom Reminder</div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              {error && <div style={{ color: '#dc2626', marginBottom: '0.75rem', padding: '0.5rem', background: '#fef2f2', borderRadius: 4 }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Title *</label>
                  <input className="form-input" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} required />
                </div>
                <div>
                  <label className="form-label">Due Date *</label>
                  <input className="form-input" type="date" value={createForm.dueDate} onChange={e => setCreateForm({ ...createForm, dueDate: e.target.value })} required />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Message *</label>
                  <input className="form-input" value={createForm.message} onChange={e => setCreateForm({ ...createForm, message: e.target.value })} required />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createLoading}>{createLoading ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder list */}
      {loading ? <div className="loading">Loading reminders...</div> : (
        <div className="card">
          <div className="card-header">Reminders ({reminders.length})</div>
          <div className="card-body" style={{ padding: reminders.length ? 0 : undefined }}>
            {reminders.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Due Date</th>
                      <th>Type</th>
                      <th>Title</th>
                      <th>Message</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminders.map(r => (
                      <tr key={r.id} style={{ background: isOverdue(r) ? '#fef2f2' : r.completed ? '#f0fdf4' : undefined }}>
                        <td className="text-sm" style={{ color: isOverdue(r) ? '#dc2626' : undefined, fontWeight: isOverdue(r) ? 600 : 400 }}>
                          {new Date(r.dueDate).toLocaleDateString()}
                          {isOverdue(r) && <span style={{ display: 'block', fontSize: '0.75rem' }}>OVERDUE</span>}
                        </td>
                        <td><span className={`badge badge-${r.reminderType}`}>{r.reminderType?.replace(/_/g, ' ')}</span></td>
                        <td style={{ fontWeight: 500 }}>{r.title}</td>
                        <td className="text-sm text-muted">{r.message}</td>
                        <td>{r.completed ? <span style={{ color: '#16a34a', fontWeight: 500 }}>Done</span> : <span style={{ color: '#d97706' }}>Pending</span>}</td>
                        <td>
                          {!r.completed && (
                            <div className="flex gap-1">
                              <button
                                className="btn btn-outline btn-sm"
                                title="Mark as completed — you did this task"
                                disabled={!!actionLoading[r.id]}
                                onClick={() => markDone(r.id)}
                              >
                                {actionLoading[r.id] === 'done' ? '...' : '✓ Done'}
                              </button>
                              <button
                                className="btn btn-outline btn-sm"
                                style={{ color: '#9ca3af' }}
                                title="Skip this reminder — remove it without marking as done"
                                disabled={!!actionLoading[r.id]}
                                onClick={() => dismiss(r.id)}
                              >
                                {actionLoading[r.id] === 'dismiss' ? '...' : 'Skip'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                {filter === 'overdue' ? 'No overdue reminders' : filter === 'done' ? 'No completed reminders' : 'No reminders yet'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
