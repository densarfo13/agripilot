import React, { useEffect, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api from '../api/client.js';

const ACTIVITY_TYPES = ['planting', 'fertilizing', 'weeding', 'spraying', 'harvesting', 'soil_preparation', 'irrigation', 'other'];

export default function FarmerActivitiesTab() {
  const { farmerId, refresh } = useFarmerContext();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ activityType: 'planting', cropType: '', description: '', quantityKg: '', activityDate: new Date().toISOString().split('T')[0] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadActivities = () => {
    setLoading(true);
    const params = {};
    if (filterType) params.type = filterType;
    api.get(`/activities/farmer/${farmerId}`, { params })
      .then(r => setActivities(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadActivities(); }, [farmerId, filterType]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post(`/activities/farmer/${farmerId}`, {
        activityType: form.activityType,
        cropType: form.cropType || undefined,
        description: form.description || undefined,
        quantityKg: form.quantityKg ? parseFloat(form.quantityKg) : undefined,
        activityDate: form.activityDate || undefined,
      });
      setShowForm(false);
      setForm({ activityType: 'planting', cropType: '', description: '', quantityKg: '', activityDate: new Date().toISOString().split('T')[0] });
      loadActivities();
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log activity');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <select className="form-select" style={{ width: 200 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Log Activity'}
        </button>
      </div>

      {/* Log activity form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">Log New Activity</div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {error && <div style={{ color: '#dc2626', marginBottom: '0.75rem', padding: '0.5rem', background: '#fef2f2', borderRadius: 4 }}>{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Activity Type *</label>
                  <select className="form-select" value={form.activityType} onChange={e => setForm({ ...form, activityType: e.target.value })}>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Crop Type {['planting', 'harvesting'].includes(form.activityType) ? '*' : ''}</label>
                  <input className="form-input" value={form.cropType} onChange={e => setForm({ ...form, cropType: e.target.value })} placeholder="e.g. maize" />
                </div>
                <div>
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.activityDate} onChange={e => setForm({ ...form, activityDate: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Quantity (kg)</label>
                  <input className="form-input" type="number" step="0.1" value={form.quantityKg} onChange={e => setForm({ ...form, quantityKg: e.target.value })} placeholder="Optional" />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Description</label>
                  <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Log Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Activity list */}
      {loading ? <div className="loading">Loading activities...</div> : (
        <div className="card">
          <div className="card-header">Activities ({activities.length})</div>
          <div className="card-body" style={{ padding: activities.length ? 0 : undefined }}>
            {activities.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Crop</th>
                      <th>Quantity</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map(a => (
                      <tr key={a.id}>
                        <td className="text-sm">{new Date(a.activityDate).toLocaleDateString()}</td>
                        <td><span className={`badge badge-${a.activityType}`}>{a.activityType?.replace(/_/g, ' ')}</span></td>
                        <td>{a.cropType || '-'}</td>
                        <td>{a.quantityKg ? `${a.quantityKg} kg` : '-'}</td>
                        <td className="text-sm text-muted">{a.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No activities logged yet. Click "Log Activity" to get started.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
