import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { formatApiError } from '../api/client.js';
import { useDraft } from '../utils/useDraft.js';
import CropSelect from '../components/CropSelect.jsx';

export default function NewApplicationPage() {
  const [searchParams] = useSearchParams();
  const farmerIdParam = searchParams.get('farmerId') || '';

  const initialForm = {
    farmerId: farmerIdParam,
    cropType: '',
    farmSizeAcres: '',
    requestedAmount: '',
    purpose: '',
    season: '',
  };

  const { state: form, setState: setFormDraft, clearDraft, draftRestored } = useDraft(
    `new-application${farmerIdParam ? ':' + farmerIdParam : ''}`,
    initialForm,
  );

  // Convenience setter that also persists to draft
  const set = (k) => (e) => setFormDraft(f => ({ ...f, [k]: e.target.value }));

  const [farmers, setFarmers] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    api.get('/farmers', { params: { limit: 100 } })
      .then(r => setFarmers(r.data.farmers))
      .catch(err => setLoadError(formatApiError(err, 'Failed to load farmer list. Please refresh the page.')));
  }, []);

  // Derive currency and area unit from selected farmer's country
  const selectedFarmer = farmers.find(f => f.id === form.farmerId);
  const currency = selectedFarmer?.countryCode === 'TZ' ? 'TZS' : 'KES';
  const areaUnit = selectedFarmer?.countryCode === 'TZ' ? 'hectares' : 'acres';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const acres = parseFloat(form.farmSizeAcres);
    const amount = parseFloat(form.requestedAmount);
    if (isNaN(acres) || acres <= 0) { setError('Farm size must be a positive number'); setSaving(false); return; }
    if (isNaN(amount) || amount <= 0) { setError('Requested amount must be a positive number'); setSaving(false); return; }
    try {
      const res = await api.post('/applications', {
        ...form,
        farmSizeAcres: acres,
        requestedAmount: amount,
      });
      clearDraft();
      navigate(`/applications/${res.data.id}`);
    } catch (err) {
      setError(formatApiError(err, 'Failed to create application'));
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="page-header">
        <h1>New Application</h1>
        <button className="btn btn-outline" onClick={() => { clearDraft(); navigate('/applications'); }}>Cancel</button>
      </div>
      <div className="page-body">
        <div className="card" style={{ maxWidth: 640 }}>
          <form onSubmit={handleSubmit}>
            <div className="card-body">
              {draftRestored && (
                <div className="alert-inline alert-inline-success">
                  <span style={{ flex: 1 }}>Draft restored — your previous entry was saved automatically.</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { clearDraft(); setFormDraft(initialForm); }}>Clear</button>
                </div>
              )}
              {loadError && <div className="alert alert-danger">{loadError}</div>}
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="form-group">
                <label className="form-label">Farmer *</label>
                <select className="form-select" required value={form.farmerId} onChange={set('farmerId')}>
                  <option value="">Select farmer...</option>
                  {farmers.map(f => <option key={f.id} value={f.id}>{f.fullName} — {f.region} ({f.phone})</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Crop Type *</label>
                  <CropSelect
                    value={form.cropType}
                    onChange={(v) => setForm(f => ({ ...f, cropType: v }))}
                    countryCode={selectedFarmer?.countryCode}
                    required
                    placeholder="Search crops..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Farm Size ({areaUnit}) *</label>
                  <input className="form-input" type="number" step="0.1" required value={form.farmSizeAcres} onChange={set('farmSizeAcres')} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Requested Amount ({currency}) *</label>
                  <input className="form-input" type="number" required value={form.requestedAmount} onChange={set('requestedAmount')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Season</label>
                  <input className="form-input" value={form.season} onChange={set('season')} placeholder="e.g. 2024-long-rains" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Purpose</label>
                <textarea className="form-textarea" value={form.purpose} onChange={set('purpose')} placeholder="Describe what the loan will be used for..." />
              </div>
            </div>
            <div className="modal-footer">
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Application'}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
