import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import { useAuthStore } from '../store/authStore.js';
import { CREATOR_ROLES } from '../utils/roles.js';

export default function FarmersPage() {
  const [farmers, setFarmers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const canCreate = CREATOR_ROLES.includes(user?.role);

  const load = (p = page, s = search) => {
    setLoading(true);
    api.get('/farmers', { params: { page: p, limit: 20, search: s || undefined } })
      .then(r => { setFarmers(r.data.farmers); setTotal(r.data.total); setLoadError(''); })
      .catch(() => setLoadError('Failed to load farmers list'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load(1, search);
  };

  return (
    <>
      <div className="page-header">
        <h1>Farmers ({total})</h1>
        <div className="flex gap-1">
          <form onSubmit={handleSearch} className="flex gap-1">
            <input className="form-input" style={{ width: 220 }} placeholder="Search name, phone, ID..." value={search} onChange={e => setSearch(e.target.value)} />
            <button type="submit" className="btn btn-outline">Search</button>
          </form>
          {canCreate && <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Farmer</button>}
        </div>
      </div>
      <div className="page-body">
        {loadError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{loadError}</div>}
        {loading ? <div className="loading">Loading...</div> : (
          <div className="card">
            <div className="card-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Region</th>
                      <th>Primary Crop</th>
                      <th>Farm Size</th>
                      <th>Experience</th>
                      <th>Applications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farmers.map(f => (
                      <tr key={f.id} onClick={() => navigate(`/farmers/${f.id}`)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500 }}>{f.fullName}</td>
                        <td>{f.phone}</td>
                        <td>{f.region}</td>
                        <td>{f.primaryCrop || '-'}</td>
                        <td>{f.farmSizeAcres ? `${f.farmSizeAcres} acres` : '-'}</td>
                        <td>{f.yearsExperience ? `${f.yearsExperience} yrs` : '-'}</td>
                        <td>{f._count?.applications || 0}</td>
                      </tr>
                    ))}
                    {farmers.length === 0 && <tr><td colSpan={7} className="empty-state">No farmers found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {total > 20 && (
          <div className="pagination">
            <span>Showing {(page-1)*20+1}-{Math.min(page*20, total)} of {total}</span>
            <div className="flex gap-1">
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</button>
              <button className="btn btn-outline btn-sm" disabled={page * 20 >= total} onClick={() => setPage(p => p+1)}>Next</button>
            </div>
          </div>
        )}

        {showCreate && <CreateFarmerModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(1, ''); }} />}
      </div>
    </>
  );
}

function CreateFarmerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ fullName: '', phone: '', region: '', district: '', village: '', primaryCrop: '', farmSizeAcres: '', yearsExperience: '', nationalId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/farmers', { ...form, farmSizeAcres: form.farmSizeAcres ? parseFloat(form.farmSizeAcres) : undefined, yearsExperience: form.yearsExperience ? parseInt(form.yearsExperience) : undefined });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create farmer');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">New Farmer <button className="btn btn-outline btn-sm" onClick={onClose}>X</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input className="form-input" required value={form.fullName} onChange={set('fullName')} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone *</label>
                <input className="form-input" required value={form.phone} onChange={set('phone')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Region *</label>
                <input className="form-input" required value={form.region} onChange={set('region')} />
              </div>
              <div className="form-group">
                <label className="form-label">National ID</label>
                <input className="form-input" value={form.nationalId} onChange={set('nationalId')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">District</label>
                <input className="form-input" value={form.district} onChange={set('district')} />
              </div>
              <div className="form-group">
                <label className="form-label">Village</label>
                <input className="form-input" value={form.village} onChange={set('village')} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Primary Crop</label>
                <input className="form-input" value={form.primaryCrop} onChange={set('primaryCrop')} />
              </div>
              <div className="form-group">
                <label className="form-label">Farm Size (acres)</label>
                <input className="form-input" type="number" step="0.1" value={form.farmSizeAcres} onChange={set('farmSizeAcres')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Years of Experience</label>
              <input className="form-input" type="number" value={form.yearsExperience} onChange={set('yearsExperience')} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Farmer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
