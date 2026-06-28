import React, { useEffect, useRef, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api from '../runtime/apiRuntime.js';
import { DEFAULT_COUNTRY_CODE } from '../utils/constants.js';
import CropSelect from '../components/CropSelect.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { getCropLabel, getCropLabelSafe } from '../utils/crops.js';
import { useTranslation } from '../i18n/index.js';
import { formatDate } from '../i18n/format.js';
import { tSafe } from '../i18n/tSafe.js';
import SellReadinessInput from '../components/SellReadinessInput.jsx';

export default function FarmerMarketTab() {
  const { t, lang } = useTranslation();
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
    }).catch(() => setLoadError(tSafe(t, 'market.errorLoadFailed', 'Failed to load market data')))
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
      setError(err.response?.data?.error || tSafe(t, 'market.errorExpressFailed', 'Failed to express interest'));
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
      setError(err.response?.data?.error || tSafe(t, 'market.errorWithdrawFailed', 'Failed to withdraw interest'));
    }
  };

  if (loading) return <div className="loading">{tSafe(t, 'market.loadingPrices', 'Loading market data...')}</div>;

  return (
    <div className="page-body" style={{ paddingTop: 0 }}>
      {loadError && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{loadError} <button className="btn btn-outline btn-sm" style={{ marginLeft: '0.5rem' }} onClick={loadData}>{tSafe(t, 'common.retry', 'Retry')}</button></div>}
      {/* Advisory disclaimer */}
      <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#F59E0B' }}>
        <strong>{tSafe(t, 'market.advisoryLabel', 'Advisory only:')}</strong> {tSafe(t, 'market.advisoryBody', 'Prices shown are estimated ranges for general guidance. They are not live market prices. Always verify current prices with local buyers before making selling decisions.')}
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
        <div className="card-header">{tSafe(t, 'market.priceRangesHeader', 'Estimated Price Ranges')} ({country})</div>
        <div className="card-body" style={{ padding: 0 }}>
          {Array.isArray(prices) && prices.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tSafe(t, 'market.tableCropHeader', 'Crop')}</th>
                    <th>{tSafe(t, 'market.tableMinPriceHeader', 'Min Price')}</th>
                    <th>{tSafe(t, 'market.tableMaxPriceHeader', 'Max Price')}</th>
                    <th>{tSafe(t, 'market.tableUnitHeader', 'Unit')}</th>
                    <th>{tSafe(t, 'market.tableSeasonAdviceHeader', 'Season Advice')}</th>
                    <th>{tSafe(t, 'market.tableTipsHeader', 'Tips')}</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p, i) => (
                    <tr key={i}>
                      {/* Language-aware crop label so Hindi / Hausa /
                          Twi / Swahili farmers don't see raw codes. */}
                      <td style={{ fontWeight: 500 }}>{getCropLabelSafe(p.crop, lang) || p.crop}</td>
                      <td>{p.currency || 'KES'} {p.minPrice?.toLocaleString()}</td>
                      <td>{p.currency || 'KES'} {p.maxPrice?.toLocaleString()}</td>
                      <td>{p.unit || tSafe(t, 'market.perKg', 'per kg')}</td>
                      <td className="text-sm">{p.seasonAdvice || '-'}</td>
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => loadTips(p.crop)}>
                          {tSafe(t, 'market.viewTipsCta', 'View Tips')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon="📊" title={tSafe(t, 'market.noPriceDataTitle', 'No price data available')} message={tSafe(t, 'market.noPriceDataMessage', 'Market prices will appear here when available for your region.')} compact />
          )}
        </div>
      </div>

      {/* Selling tips panel */}
      {tips && selectedCrop && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            {tSafe(t, 'market.sellingTipsLabel', 'Selling Tips:')} {getCropLabelSafe(tips.cropType || selectedCrop, lang)}
            <button className="btn btn-outline btn-sm" onClick={() => { setTips(null); setSelectedCrop(''); }}>{tSafe(t, 'common.close', 'Close')}</button>
          </div>
          <div className="card-body">
            {tips.tips?.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {tips.tips.map((tip, i) => <li key={i} style={{ marginBottom: '0.35rem' }}>{tip}</li>)}
              </ul>
            ) : (
              <p className="text-muted">{tSafe(t, 'market.noSpecificTips', 'No specific tips available for this crop.')}</p>
            )}
          </div>
        </div>
      )}

      {/* Buyer types */}
      {Array.isArray(buyerTypes) && buyerTypes.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">{tSafe(t, 'market.buyerTypesHeader', 'Buyer Types')}</div>
          <div className="card-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {buyerTypes.map((bt, i) => (
                <div key={i} style={{ padding: '0.75rem 1rem', background: '#1E293B', border: '1px solid #243041', borderRadius: 8, minWidth: 180 }}>
                  <strong>{bt.type || bt.name}</strong>
                  {bt.description && <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#A1A1AA' }}>{bt.description}</p>}
                  {bt.suitableFor && <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#C8944D' }}>{tSafe(t, 'market.bestForLabel', 'Best for:')} {Array.isArray(bt.suitableFor) ? bt.suitableFor.join(', ') : bt.suitableFor}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Buyer interest section */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          {tSafe(t, 'market.mySellingInterestsHeader', 'My Selling Interests')}
          <span style={{ fontSize: '0.8rem', color: '#A1A1AA', fontWeight: 400 }}>{tSafe(t, 'market.trackingNote', 'Tracked for demand analysis — not a marketplace')}</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowInterest(!showInterest)}>
            {showInterest ? tSafe(t, 'common.cancel', 'Cancel') : tSafe(t, 'market.expressInterestCta', '+ Express Interest')}
          </button>
        </div>
        <div className="card-body" style={{ padding: showInterest || interests.length > 0 ? undefined : undefined }}>
          {showInterest && (
            <form onSubmit={handleExpressInterest} style={{ marginBottom: '1rem', padding: '1rem', background: '#1E293B', borderRadius: 8, border: '1px solid #243041' }}>
              {error && <div className="alert-inline alert-inline-danger">{error}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label">{tSafe(t, 'market.cropTypeLabelRequired', 'Crop Type *')}</label>
                  <CropSelect
                    value={interestForm.cropType}
                    onChange={(v) => setInterestForm({ ...interestForm, cropType: v })}
                    countryCode={farmer?.countryCode}
                    required
                    placeholder={tSafe(t, 'market.searchCropsPlaceholder', 'Search crops...')}
                  />
                </div>
                <div>
                  <label className="form-label">{tSafe(t, 'market.quantityKgLabel', 'Quantity (kg)')}</label>
                  <input className="form-input" type="number" step="0.1" value={interestForm.quantityKg} onChange={e => setInterestForm({ ...interestForm, quantityKg: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">{tSafe(t, 'market.priceExpectationLabel', 'Price Expectation')}</label>
                  <input className="form-input" type="number" step="0.01" value={interestForm.priceExpectation} onChange={e => setInterestForm({ ...interestForm, priceExpectation: e.target.value })} placeholder={tSafe(t, 'market.perKg', 'per kg')} />
                </div>
                <div>
                  <label className="form-label">{tSafe(t, 'market.preferredBuyerTypeLabel', 'Preferred Buyer Type')}</label>
                  <input className="form-input" value={interestForm.preferredBuyerType} onChange={e => setInterestForm({ ...interestForm, preferredBuyerType: e.target.value })} placeholder={tSafe(t, 'market.preferredBuyerTypePlaceholder', 'e.g. cooperative, export')} />
                </div>
                <div style={{ gridColumn: '2 / -1' }}>
                  <label className="form-label">{tSafe(t, 'market.notesLabel', 'Notes')}</label>
                  <input className="form-input" value={interestForm.notes} onChange={e => setInterestForm({ ...interestForm, notes: e.target.value })} placeholder={tSafe(t, 'market.notesPlaceholder', 'Any additional information')} />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowInterest(false)}>{tSafe(t, 'common.cancel', 'Cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? tSafe(t, 'market.submittingCta', 'Submitting...') : tSafe(t, 'market.expressInterestSubmitCta', 'Express Interest')}</button>
              </div>
            </form>
          )}

          {interests.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tSafe(t, 'market.tableCropHeader', 'Crop')}</th>
                    <th>{tSafe(t, 'market.tableQuantityHeader', 'Quantity')}</th>
                    <th>{tSafe(t, 'market.tablePriceHeader', 'Price')}</th>
                    <th>{tSafe(t, 'market.tableBuyerTypeHeader', 'Buyer Type')}</th>
                    <th>{tSafe(t, 'market.tableStatusHeader', 'Status')}</th>
                    <th>{tSafe(t, 'market.tableDateHeader', 'Date')}</th>
                    <th>{tSafe(t, 'market.tableActionHeader', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {interests.map(interest => (
                    <tr key={interest.id}>
                      <td style={{ fontWeight: 500 }}>{getCropLabelSafe(interest.cropType, lang)}</td>
                      <td>{interest.quantityKg ? `${interest.quantityKg} kg` : '-'}</td>
                      <td>{interest.priceExpectation ? `${interest.currencyCode || 'KES'} ${interest.priceExpectation}` : '-'}</td>
                      <td>{interest.preferredBuyerType || '-'}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.85rem', fontWeight: 500,
                          color: interest.status === 'expressed' ? '#C8944D' : interest.status === 'matched' ? '#B9853F' : '#9ca3af',
                          background: interest.status === 'expressed' ? 'rgba(200,148,77,0.1)' : interest.status === 'matched' ? 'rgba(22,163,106,0.1)' : '#1E293B',
                          border: `1px solid ${interest.status === 'expressed' ? 'rgba(200,148,77,0.3)' : interest.status === 'matched' ? 'rgba(200,148,77,0.3)' : '#243041'}`,
                        }}>
                          {tSafe(t, `market.status.${interest.status}`, interest.status)}
                        </span>
                      </td>
                      <td className="text-sm text-muted">{formatDate(interest.createdAt, lang)}</td>
                      <td>
                        {interest.status === 'expressed' && (
                          <button className="btn btn-outline-danger btn-sm" onClick={() => withdrawInterest(interest.id)}>
                            {tSafe(t, 'market.withdrawCta', 'Withdraw')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !showInterest && <EmptyState icon="🤝" title={tSafe(t, 'market.noInterestsTitle', 'No selling interests yet')} message={tSafe(t, 'market.noInterestsMessage', 'Express interest to connect with buyers for your crops.')} compact />
          )}
        </div>
      </div>
    </div>
  );
}
