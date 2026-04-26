import React, { useEffect, useRef, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api from '../api/client.js';
import { DEFAULT_COUNTRY_CODE } from '../utils/constants.js';
import CropSelect from '../components/CropSelect.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { getCropLabel } from '../utils/crops.js';
import { useTranslation } from '../i18n/index.js';
import SellReadinessInput from '../components/SellReadinessInput.jsx';

export default function FarmerMarketTab() {
  const { lang } = useTranslation();
  const { farmerId, farmer } = useFarmerContext();
  const country = farmer?.countryCode || DEFAULT_COUNTRY_CODE;
  const [prices, setPrices] = useState([]);
  const [buyerTypes, setBuyerTypes] = useState([]);
  const [interests, setInterests] = useState([]);
  const [tips, setTips] = useState(null);
  const [selectedCrop, setSelectedCrop] = useState('');
  const [loading, setLoading] = useState(true);

  // Interest form
  const [showInterest, setShowInterest] = useState(false);
  const [interestForm, setInterestForm] = useState({ cropType: '', quantityKg: '', preferredBuyerType: '', priceExpectation: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const loadData = () => {
    setLoading(true);
    setLoadError('');
    Promise.all([
      api.get('/market-guidance/prices', { params: { country } }),
      api.get('/market-guidance/buyer-types', { params: { country } }),
      api.get(`/buyer-interest/farmer/${farmerId}`),
    ]).then(([pRes, bRes, iRes]) => {
      setPrices(pRes.data?.crops || pRes.data || []);
      setBuyerTypes(bRes.data?.buyerTypes || bRes.data || []);
      setInterests(iRes.data || []);
    }).catch(() => setLoadError('Failed to load market data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [farmerId, country]);

  const loadTips = (crop) => {
    setSelectedCrop(crop);
    api.get(`/market-guidance/selling-tips/${crop}`, { params: { country } })
      .then(r => {
        // Response may be { tips: [...], cropType } or a plain array
        const data = Array.isArray(r.data) ? { tips: r.data, cropType: crop } : r.data;
        setTips(data);
      })
      .catch(() => setTips(null));
  };

  const handleExpressInterest = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setError('');
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/buyer-interest/farmer/${farmerId}`, {
        ...interestForm,
        quantityKg: interestForm.quantityKg ? parseFloat(interestForm.quantityKg) : undefined,
        priceExpectation: interestForm.priceExpectation ? parseFloat(interestForm.priceExpectation) : undefined,
      });
      setShowInterest(false);
      setInterestForm({ cropType: '', quantityKg: '', preferredBuyerType: '', priceExpectation: '', notes: '' });
      // Reload interests
      const iRes = await api.get(`/buyer-interest/farmer/${farmerId}`);
      setInterests(iRes.data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to express interest');
    } finally {
      submitGuardRef.current = false;
      setSubmitting(false);
    }
  };

  const withdrawInterest = async (id) => {
    try {
      await api.patch(`/buyer-interest/${id}/withdraw`);
      setInterests(prev => prev.map(i => i.id === id ? { ...i, status: 'withdrawn' } : i));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to withdraw interest');
    }
  };

  if (loading) return <div className="loading">Loading market data...</div>;

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      {loadError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={loadData}>Retry</button></div>}
      {/* Advisory disclaimer */}
      <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#F59E0B' }}>
        <strong>Advisory only:</strong> Prices shown are estimated ranges for general guidance. They are not live market prices. Always verify current prices with local buyers before making selling decisions.
      </div>

      {/* Ready to sell — buyer-matching signal. Mounts the existing
          SellReadinessInput component (was orphan in the codebase
          before this sprint) so the farmer can flip a yes/no flag
          + capture quantity / harvest date / price expectation. The
          backend at POST /api/v2/supply-readiness/mine handles
          persistence + admin discovery. We do NOT build a new
          marketplace pipeline. */}
      <div style={{ marginBottom: '1.25rem' }}>
        <SellReadinessInput />
      </div>

      {/* Market prices */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header">Estimated Price Ranges ({country})</div>
        <div className="card-body" style={{ padding: 0 }}>
          {Array.isArray(prices) && prices.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Min Price</th>
                    <th>Max Price</th>
                    <th>Unit</th>
                    <th>Season Advice</th>
                    <th>Tips</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p, i) => (
                    <tr key={i}>
                      {/* Language-aware crop label so Hindi / Hausa /
                          Twi / Swahili farmers don't see raw codes. */}
                      <td style={{ fontWeight: 500 }}>{getCropLabel(p.crop, lang) || p.crop}</td>
                      <td>{p.currency || 'KES'} {p.minPrice?.toLocaleString()}</td>
                      <td>{p.currency || 'KES'} {p.maxPrice?.toLocaleString()}</td>
                      <td>{p.unit || 'per kg'}</td>
                      <td className="text-sm">{p.seasonAdvice || '-'}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => loadTips(p.crop)}>
                          View Tips
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="📊" title="No price data available" message="Market prices will appear here when available for your region." compact />
          )}
        </div>
      </div>

      {/* Selling tips panel */}
      {tips && selectedCrop && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            Selling Tips: {getCropLabel(tips.cropType || selectedCrop, lang)}
            <button className="btn btn-outline btn-sm" onClick={() => { setTips(null); setSelectedCrop(''); }}>Close</button>
          </div>
          <div className="card-body">
            {tips.tips?.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {tips.tips.map((tip, i) => <li key={i} style={{ marginBottom: '0.35rem' }}>{tip}</li>)}
              </ul>
            ) : (
              <p className="text-muted">No specific tips available for this crop.</p>
            )}
          </div>
        </div>
      )}

      {/* Buyer types */}
      {Array.isArray(buyerTypes) && buyerTypes.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">Buyer Types</div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {buyerTypes.map((bt, i) => (
                <div key={i} style={{ padding: '0.75rem 1rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 8, minWidth: 180 }}>
                  <strong>{bt.type || bt.name}</strong>
                  {bt.description && <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#A1A1AA' }}>{bt.description}</p>}
                  {bt.suitableFor && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#22C55E' }}>Best for: {Array.isArray(bt.suitableFor) ? bt.suitableFor.join(', ') : bt.suitableFor}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Buyer interest section */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          My Selling Interests
          <span style={{ fontSize: '0.8rem', color: '#A1A1AA', fontWeight: 400 }}>Tracked for demand analysis — not a marketplace</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowInterest(!showInterest)}>
            {showInterest ? 'Cancel' : '+ Express Interest'}
          </button>
        </div>
        <div className="card-body" style={{ padding: showInterest || interests.length > 0 ? undefined : undefined }}>
          {showInterest && (
            <form onSubmit={handleExpressInterest} style={{ marginBottom: '1rem', padding: '1rem', background: '#1E293B', borderRadius: 8, border: '1px solid #243041' }}>
              {error && <div className="alert-inline alert-inline-danger">{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">Crop Type *</label>
                  <CropSelect
                    value={interestForm.cropType}
                    onChange={(v) => setInterestForm({ ...interestForm, cropType: v })}
                    countryCode={farmer?.countryCode}
                    required
                    placeholder="Search crops..."
                  />
                </div>
                <div>
                  <label className="form-label">Quantity (kg)</label>
                  <input className="form-input" type="number" step="0.1" value={interestForm.quantityKg} onChange={e => setInterestForm({ ...interestForm, quantityKg: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Price Expectation</label>
                  <input className="form-input" type="number" step="0.01" value={interestForm.priceExpectation} onChange={e => setInterestForm({ ...interestForm, priceExpectation: e.target.value })} placeholder="per kg" />
                </div>
                <div>
                  <label className="form-label">Preferred Buyer Type</label>
                  <input className="form-input" value={interestForm.preferredBuyerType} onChange={e => setInterestForm({ ...interestForm, preferredBuyerType: e.target.value })} placeholder="e.g. cooperative, export" />
                </div>
                <div style={{ gridColumn: '2 / -1' }}>
                  <label className="form-label">Notes</label>
                  <input className="form-input" value={interestForm.notes} onChange={e => setInterestForm({ ...interestForm, notes: e.target.value })} placeholder="Any additional information" />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowInterest(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Express Interest'}</button>
              </div>
            </form>
          )}

          {interests.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Crop</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Buyer Type</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {interests.map(interest => (
                    <tr key={interest.id}>
                      <td style={{ fontWeight: 500 }}>{getCropLabel(interest.cropType, lang)}</td>
                      <td>{interest.quantityKg ? `${interest.quantityKg} kg` : '-'}</td>
                      <td>{interest.priceExpectation ? `${interest.currencyCode || 'KES'} ${interest.priceExpectation}` : '-'}</td>
                      <td>{interest.preferredBuyerType || '-'}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500,
                          color: interest.status === 'expressed' ? '#22C55E' : interest.status === 'matched' ? '#16a34a' : '#9ca3af',
                          background: interest.status === 'expressed' ? 'rgba(34,197,94,0.1)' : interest.status === 'matched' ? 'rgba(22,163,106,0.1)' : '#1E293B',
                          border: `1px solid ${interest.status === 'expressed' ? 'rgba(34,197,94,0.3)' : interest.status === 'matched' ? 'rgba(34,197,94,0.3)' : '#243041'}`,
                        }}>
                          {interest.status}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{new Date(interest.createdAt).toLocaleDateString()}</td>
                      <td>
                        {interest.status === 'expressed' && (
                          <button className="btn btn-outline-danger btn-sm" onClick={() => withdrawInterest(interest.id)}>
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !showInterest && <EmptyState icon="🤝" title="No selling interests yet" message="Express interest to connect with buyers for your crops." compact />
          )}
        </div>
      </div>
    </div>
  );
}
