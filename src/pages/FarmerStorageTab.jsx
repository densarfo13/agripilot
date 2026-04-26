import React, { useEffect, useRef, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api from '../api/client.js';
import { tStorageMethod, tStorageCondition } from '../utils/i18n.js';
import { DEFAULT_COUNTRY_CODE } from '../utils/constants.js';
import EmptyState from '../components/EmptyState.jsx';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import { useTranslation } from '../i18n/index.js';
import { tStrict } from '../i18n/strictT.js';

const STORAGE_METHODS = ['sealed_bags', 'hermetic_bag', 'open_air', 'warehouse', 'silo', 'traditional', 'cold_storage', 'other'];
const STORAGE_CONDITIONS = ['good', 'fair', 'poor', 'deteriorating', 'unknown'];

const CONDITION_COLORS = {
  good: '#16a34a',
  fair: '#d97706',
  poor: '#dc2626',
  deteriorating: '#dc2626',
  unknown: '#9ca3af',
};

export default function FarmerStorageTab() {
  const { lang } = useTranslation();
  const { farmerId, farmer } = useFarmerContext();
  const [dashboard, setDashboard] = useState(null);
  const [guidance, setGuidance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    cropType: '', quantityKg: '', harvestDate: '', storageMethod: 'sealed_bags',
    storageCondition: 'good', readyToSell: false, notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const [error, setError] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(null);

  const loadDashboard = () => {
    setLoading(true);
    api.get(`/post-harvest/storage/farmer/${farmerId}/dashboard`)
      .then(r => { setDashboard(r.data); setError(''); })
      .catch(() => setError('Failed to load storage data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDashboard(); }, [farmerId]);

  const loadGuidance = (cropType) => {
    setSelectedCrop(cropType);
    api.get(`/post-harvest/guidance/${cropType}`, { params: { country: farmer?.countryCode || DEFAULT_COUNTRY_CODE } })
      .then(r => setGuidance(r.data))
      .catch(() => setGuidance(null));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setError('');
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/post-harvest/storage/farmer/${farmerId}`, {
        ...form,
        quantityKg: form.quantityKg ? parseFloat(form.quantityKg) : undefined,
        readyToSell: form.readyToSell,
      });
      setShowForm(false);
      setForm({ cropType: '', quantityKg: '', harvestDate: '', storageMethod: 'sealed_bags', storageCondition: 'good', readyToSell: false, notes: '' });
      loadDashboard();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update storage status');
    } finally {
      submitGuardRef.current = false;
      setSubmitting(false);
    }
  };

  const editItem = (item) => {
    setForm({
      cropType: item.cropType,
      quantityKg: item.quantityKg || '',
      harvestDate: item.harvestDate ? item.harvestDate.split('T')[0] : '',
      storageMethod: item.storageMethod || 'sealed_bags',
      storageCondition: item.storageCondition || 'good',
      readyToSell: item.readyToSell || false,
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      {/* Summary stats */}
      {dashboard && dashboard.totalItems > 0 && (
        <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-label">Stored Crops</div>
            <div className="stat-value">{dashboard.totalItems}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Quantity</div>
            <div className="stat-value">{dashboard.totalQuantityKg?.toLocaleString() || 0} kg</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">{tStrict('farmerActions.readyToSell', 'Ready to Sell')}</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>{dashboard.readyToSell}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Condition Issues</div>
            <div className="stat-value" style={{ color: (dashboard.conditionBreakdown?.poor || 0) + (dashboard.conditionBreakdown?.deteriorating || 0) > 0 ? '#dc2626' : '#16a34a' }}>
              {(dashboard.conditionBreakdown?.poor || 0) + (dashboard.conditionBreakdown?.deteriorating || 0)}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Storage Status</h3>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setForm({ cropType: '', quantityKg: '', harvestDate: '', storageMethod: 'sealed_bags', storageCondition: 'good', readyToSell: false, notes: '' }); }}>
          {showForm ? 'Cancel' : '+ Add / Update Storage'}
        </button>
      </div>

      {/* Upsert form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">Storage Status Update</div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {error && <div className="alert-inline alert-inline-danger">{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Crop Type *</label>
                  <input className="form-input" value={form.cropType} onChange={e => setForm({ ...form, cropType: e.target.value })} placeholder="e.g. maize" required />
                </div>
                <div>
                  <label className="form-label">Quantity (kg)</label>
                  <input className="form-input" type="number" step="0.1" value={form.quantityKg} onChange={e => setForm({ ...form, quantityKg: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Harvest Date</label>
                  <input className="form-input" type="date" value={form.harvestDate} onChange={e => setForm({ ...form, harvestDate: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Storage Method</label>
                  <select className="form-select" value={form.storageMethod} onChange={e => setForm({ ...form, storageMethod: e.target.value })}>
                    {STORAGE_METHODS.map(m => <option key={m} value={m}>{tStorageMethod(m)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Condition</label>
                  <select className="form-select" value={form.storageCondition} onChange={e => setForm({ ...form, storageCondition: e.target.value })}>
                    {STORAGE_CONDITIONS.map(c => <option key={c} value={c}>{tStorageCondition(c)}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
                  <input type="checkbox" id="readyToSell" checked={form.readyToSell} onChange={e => setForm({ ...form, readyToSell: e.target.checked })} />
                  <label htmlFor="readyToSell">{tStrict('farmerActions.readyToSell', 'Ready to sell')}</label>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Storage items */}
      {error && !showForm && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
      {loading ? <div className="loading">Loading storage data...</div> : (
        <>
          {/* Proactive alerts for items over storage limit or in poor condition */}
          {dashboard?.items?.filter(i => i.isOverStorageLimit).length > 0 && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
              <strong>Storage limit exceeded:</strong> {dashboard.items.filter(i => i.isOverStorageLimit).map(i => `${getCropLabelSafe(i.cropType, lang) || i.cropType} (${i.daysSinceHarvest}/${i.maxRecommendedDays} days)`).join(', ')}. Consider selling to avoid quality loss.
            </div>
          )}
          {dashboard?.items?.filter(i => ['poor', 'deteriorating'].includes(i.storageCondition)).length > 0 && (
            <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
              <strong>Condition alert:</strong> {dashboard.items.filter(i => ['poor', 'deteriorating'].includes(i.storageCondition)).map(i => `${getCropLabelSafe(i.cropType, lang) || i.cropType} (${tStorageCondition(i.storageCondition)})`).join(', ')}. Check storage and consider selling or improving conditions.
            </div>
          )}
          {(!dashboard || dashboard.totalItems === 0) ? (
            <div className="card"><div className="card-body"><EmptyState icon="🏪" title="No stored produce tracked" message="Start tracking your stored harvest to monitor conditions and quantities." action={{ label: 'Add / Update Storage', onClick: () => setShowForm(true) }} compact /></div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {dashboard.items.map(item => (
                <div key={item.id} className="card">
                  <div className="card-body" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                          <strong style={{ fontSize: '1.1rem' }}>{getCropLabelSafe(item.cropType, lang) || item.cropType}</strong>
                          <span style={{ color: CONDITION_COLORS[item.storageCondition], fontWeight: 600, fontSize: '0.85rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: `${CONDITION_COLORS[item.storageCondition]}15`, border: `1px solid ${CONDITION_COLORS[item.storageCondition]}30` }}>
                            {tStorageCondition(item.storageCondition)}
                          </span>
                          {item.readyToSell && (
                            <span style={{ color: '#16a34a', fontSize: '0.85rem', fontWeight: 500 }}>{tStrict('farmerActions.readyToSell', 'Ready to sell')}</span>
                          )}
                          {item.isOverStorageLimit && (
                            <span style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>Over storage limit!</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#A1A1AA' }}>
                          {item.quantityKg && <span><strong>Qty:</strong> {item.quantityKg.toLocaleString()} kg</span>}
                          {item.storageMethod && <span><strong>Method:</strong> {tStorageMethod(item.storageMethod)}</span>}
                          {item.daysSinceHarvest !== null && (
                            <span style={{ color: item.isOverStorageLimit ? '#dc2626' : undefined }}>
                              <strong>Days stored:</strong> {item.daysSinceHarvest} / {item.maxRecommendedDays}
                            </span>
                          )}
                          {item.notes && <span><strong>Notes:</strong> {item.notes}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button className="btn btn-outline btn-sm" onClick={() => loadGuidance(item.cropType)}>Guidance</button>
                        <button className="btn btn-outline btn-sm" onClick={() => editItem(item)}>Update</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Guidance panel */}
          {guidance && selectedCrop && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                Storage Guidance: {getCropLabelSafe(guidance.cropType, lang) || guidance.cropType}
                <button className="btn btn-outline btn-sm" onClick={() => { setGuidance(null); setSelectedCrop(null); }}>Close</button>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div><strong>Recommended Method:</strong><br />{guidance.recommendedMethod?.replace(/_/g, ' ')}</div>
                  <div><strong>Max Storage:</strong><br />{guidance.maxDays} days</div>
                  <div><strong>Optimal Moisture:</strong><br />{guidance.optimalMoisture}</div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Tips:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0 }}>
                    {guidance.tips?.map((tip, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{tip}</li>)}
                  </ul>
                </div>
                <div>
                  <strong>Risks:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1.25rem', padding: 0, color: '#dc2626' }}>
                    {guidance.risks?.map((risk, i) => <li key={i} style={{ marginBottom: '0.25rem' }}>{risk}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
