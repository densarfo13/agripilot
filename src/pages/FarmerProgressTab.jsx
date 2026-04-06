import React, { useEffect, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api from '../api/client.js';

const STAGES = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];
const STAGE_LABELS = {
  pre_planting: 'Pre-Planting', planting: 'Planting', vegetative: 'Vegetative',
  flowering: 'Flowering', harvest: 'Harvest', post_harvest: 'Post-Harvest',
};
const STAGE_COLORS = {
  pre_planting: '#6b7280', planting: '#16a34a', vegetative: '#059669',
  flowering: '#d97706', harvest: '#ea580c', post_harvest: '#7c3aed',
};
const CONDITION_COLORS = { good: '#16a34a', average: '#d97706', poor: '#dc2626' };
const CLASS_COLORS = { on_track: '#16a34a', slight_delay: '#d97706', at_risk: '#dc2626', critical: '#7f1d1d' };
const CLASS_LABELS = { on_track: 'On Track', slight_delay: 'Slight Delay', at_risk: 'At Risk', critical: 'Critical' };
const ACTIVITY_TYPES = ['planting', 'spraying', 'fertilizing', 'irrigation', 'weeding', 'harvesting', 'storage', 'selling', 'other'];
const IMAGE_STAGES = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];

export default function FarmerProgressTab() {
  const { farmerId } = useFarmerContext();
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [entries, setEntries] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(true);

  // Forms
  const [showSeasonForm, setShowSeasonForm] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [showConditionForm, setShowConditionForm] = useState(false);
  const [showStageConfirm, setShowStageConfirm] = useState(false);
  const [showHarvestForm, setShowHarvestForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadSeasons = () => {
    setLoading(true);
    api.get(`/seasons/farmer/${farmerId}`)
      .then(r => {
        setSeasons(r.data);
        const active = r.data.find(s => s.status === 'active');
        if (active) {
          setActiveSeason(active);
          return Promise.all([
            api.get(`/seasons/${active.id}/progress`),
            api.get(`/seasons/${active.id}/comparison`).catch(() => ({ data: null })),
            api.get(`/seasons/${active.id}/progress-score`).catch(() => ({ data: null })),
          ]).then(([pRes, cRes, sRes]) => {
            setEntries(pRes.data);
            setComparison(cRes.data);
            setScore(sRes.data);
          });
        } else {
          setActiveSeason(null);
          setEntries([]);
          setComparison(null);
          setScore(null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSeasons(); }, [farmerId]);

  // ─── Season Setup Form ────────────────────────────
  const [seasonForm, setSeasonForm] = useState({ cropType: '', farmSizeAcres: '', plantingDate: '', seedType: '', seedQuantity: '', declaredIntent: '' });

  const handleCreateSeason = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/seasons/farmer/${farmerId}`, seasonForm);
      setShowSeasonForm(false);
      setSeasonForm({ cropType: '', farmSizeAcres: '', plantingDate: '', seedType: '', seedQuantity: '', declaredIntent: '' });
      loadSeasons();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create season');
    }
    setSubmitting(false);
  };

  // ─── Progress Entry Form ──────────────────────────
  const [progressForm, setProgressForm] = useState({ activityType: '', description: '', quantity: '', unit: '', followedAdvice: '', adviceNotes: '' });

  const handleLogProgress = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/progress`, { ...progressForm, entryType: 'activity' });
      setShowProgressForm(false);
      setProgressForm({ activityType: '', description: '', quantity: '', unit: '', followedAdvice: '', adviceNotes: '' });
      loadSeasons();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
    setSubmitting(false);
  };

  // ─── Condition Update Form ────────────────────────
  const [condForm, setCondForm] = useState({ cropCondition: '', conditionNotes: '' });

  const handleCondition = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/condition`, condForm);
      setShowConditionForm(false);
      setCondForm({ cropCondition: '', conditionNotes: '' });
      loadSeasons();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
    setSubmitting(false);
  };

  // ─── Stage Confirmation ───────────────────────────
  const [stageForm, setStageForm] = useState({ confirmedStage: '', note: '' });

  const handleStageConfirm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/stage-confirmation`, stageForm);
      setShowStageConfirm(false);
      setStageForm({ confirmedStage: '', note: '' });
      loadSeasons();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
    setSubmitting(false);
  };

  // ─── Harvest Report Form ──────────────────────────
  const [harvestForm, setHarvestForm] = useState({ totalHarvestKg: '', salesAmount: '', notes: '' });

  const handleHarvest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/harvest-report`, harvestForm);
      setShowHarvestForm(false);
      setHarvestForm({ totalHarvestKg: '', salesAmount: '', notes: '' });
      loadSeasons();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed');
    }
    setSubmitting(false);
  };

  if (loading) return <div className="loading">Loading progress...</div>;

  return (
    <div>
      {/* ─── No active season → prompt setup ─────── */}
      {!activeSeason && !showSeasonForm && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <h3 style={{ margin: '0 0 0.5rem' }}>No Active Season</h3>
          <p className="text-muted">Start a new farming season to begin tracking progress.</p>
          <button className="btn btn-primary" onClick={() => setShowSeasonForm(true)}>Start New Season</button>
        </div>
      )}

      {/* ─── Season Setup Form ───────────────────── */}
      {showSeasonForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">New Season Setup</div>
          <div className="card-body">
            <form onSubmit={handleCreateSeason}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Crop Type *</label>
                  <input className="form-input" required value={seasonForm.cropType} onChange={e => setSeasonForm(f => ({ ...f, cropType: e.target.value }))} placeholder="e.g. maize" />
                </div>
                <div>
                  <label className="form-label">Farm Size (acres) *</label>
                  <input className="form-input" type="number" step="0.1" required value={seasonForm.farmSizeAcres} onChange={e => setSeasonForm(f => ({ ...f, farmSizeAcres: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Planting Date *</label>
                  <input className="form-input" type="date" required value={seasonForm.plantingDate} onChange={e => setSeasonForm(f => ({ ...f, plantingDate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Seed Type</label>
                  <input className="form-input" value={seasonForm.seedType} onChange={e => setSeasonForm(f => ({ ...f, seedType: e.target.value }))} placeholder="e.g. hybrid, OPV" />
                </div>
                <div>
                  <label className="form-label">Seed Quantity (kg)</label>
                  <input className="form-input" type="number" step="0.1" value={seasonForm.seedQuantity} onChange={e => setSeasonForm(f => ({ ...f, seedQuantity: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">What I am planting this season</label>
                  <input className="form-input" value={seasonForm.declaredIntent} onChange={e => setSeasonForm(f => ({ ...f, declaredIntent: e.target.value }))} placeholder="e.g. Maize for food and sale" />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Start Season'}</button>
                <button className="btn btn-outline" type="button" onClick={() => setShowSeasonForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Active Season Dashboard ─────────────── */}
      {activeSeason && (
        <>
          {/* Season header + score */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Season: {activeSeason.cropType} ({activeSeason.farmSizeAcres} {activeSeason.areaUnit || 'acres'})</span>
              {score?.performanceClassification && (
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, background: CLASS_COLORS[score.performanceClassification] + '18', color: CLASS_COLORS[score.performanceClassification] }}>
                  {CLASS_LABELS[score.performanceClassification]} — {score.progressScore}/100
                </span>
              )}
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div><span className="text-muted" style={{ fontSize: '0.8rem' }}>Planted</span><div style={{ fontWeight: 600 }}>{new Date(activeSeason.plantingDate).toLocaleDateString()}</div></div>
                <div><span className="text-muted" style={{ fontSize: '0.8rem' }}>Expected Harvest</span><div style={{ fontWeight: 600 }}>{activeSeason.expectedHarvestDate ? new Date(activeSeason.expectedHarvestDate).toLocaleDateString() : '—'}</div></div>
                <div><span className="text-muted" style={{ fontSize: '0.8rem' }}>Progress Entries</span><div style={{ fontWeight: 600 }}>{activeSeason._count?.progressEntries || entries.length}</div></div>
              </div>

              {/* Stage timeline bar */}
              {comparison && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>Growth Stage</div>
                  <div style={{ display: 'flex', gap: 2, marginBottom: '0.3rem' }}>
                    {STAGES.filter(s => s !== 'pre_planting').map(s => {
                      const isExpected = s === comparison.expectedStage;
                      const isActual = s === comparison.dimensions?.stageAlignment?.actualStage;
                      return (
                        <div key={s} style={{
                          flex: 1, height: 8, borderRadius: 4,
                          background: isActual ? STAGE_COLORS[s] : isExpected ? STAGE_COLORS[s] + '40' : '#e5e7eb',
                        }} title={`${STAGE_LABELS[s]}${isExpected ? ' (expected)' : ''}${isActual ? ' (actual)' : ''}`} />
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>
                    Expected: <strong>{STAGE_LABELS[comparison.expectedStage]}</strong>
                    {comparison.dimensions?.stageAlignment?.actualStage && (
                      <> | Actual: <strong>{STAGE_LABELS[comparison.dimensions.stageAlignment.actualStage]}</strong></>
                    )}
                  </div>
                </div>
              )}

              {/* Stage confirmation prompt */}
              {comparison && !showStageConfirm && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Does your farm look like it is at the <strong>{STAGE_LABELS[comparison.expectedStage]}</strong> stage?</span>
                  <button className="btn btn-sm btn-outline" onClick={() => { setStageForm({ confirmedStage: comparison.expectedStage, note: '' }); setShowStageConfirm(true); }}>Confirm Stage</button>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-primary" onClick={() => setShowProgressForm(true)}>Log Activity</button>
                <button className="btn btn-sm btn-outline" onClick={() => setShowConditionForm(true)}>Update Condition</button>
                <button className="btn btn-sm btn-outline" style={{ borderColor: '#ea580c', color: '#ea580c' }} onClick={() => setShowHarvestForm(true)}>Submit Harvest Report</button>
              </div>
            </div>
          </div>

          {/* ─── Stage Confirmation Form ───────────── */}
          {showStageConfirm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Confirm Growth Stage</div>
              <div className="card-body">
                <form onSubmit={handleStageConfirm}>
                  <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 0.75rem' }}>
                    The system expects your crop to be at <strong>{STAGE_LABELS[comparison?.expectedStage]}</strong>. Select the stage that matches what you see:
                  </p>
                  <select className="form-input" required value={stageForm.confirmedStage} onChange={e => setStageForm(f => ({ ...f, confirmedStage: e.target.value }))}>
                    {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                  </select>
                  <textarea className="form-input" style={{ marginTop: '0.5rem' }} rows={2} placeholder="Optional note..." value={stageForm.note} onChange={e => setStageForm(f => ({ ...f, note: e.target.value }))} />
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>Confirm</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowStageConfirm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Progress Entry Form ───────────────── */}
          {showProgressForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Log Activity</div>
              <div className="card-body">
                <form onSubmit={handleLogProgress}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Activity Type *</label>
                      <select className="form-input" required value={progressForm.activityType} onChange={e => setProgressForm(f => ({ ...f, activityType: e.target.value }))}>
                        <option value="">Select...</option>
                        {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Quantity</label>
                      <input className="form-input" type="number" step="0.1" value={progressForm.quantity} onChange={e => setProgressForm(f => ({ ...f, quantity: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Description</label>
                      <textarea className="form-input" rows={2} value={progressForm.description} onChange={e => setProgressForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">Followed advice?</label>
                      <select className="form-input" value={progressForm.followedAdvice} onChange={e => setProgressForm(f => ({ ...f, followedAdvice: e.target.value }))}>
                        <option value="">N/A</option>
                        <option value="yes">Yes</option>
                        <option value="partial">Partial</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Unit</label>
                      <input className="form-input" value={progressForm.unit} onChange={e => setProgressForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, bags, litres" />
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowProgressForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Condition Update Form ────────────── */}
          {showConditionForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Update Crop Condition</div>
              <div className="card-body">
                <form onSubmit={handleCondition}>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {['good', 'average', 'poor'].map(c => (
                      <label key={c} style={{
                        flex: 1, textAlign: 'center', padding: '0.75rem', borderRadius: 8, cursor: 'pointer',
                        border: condForm.cropCondition === c ? `2px solid ${CONDITION_COLORS[c]}` : '2px solid #e5e7eb',
                        background: condForm.cropCondition === c ? CONDITION_COLORS[c] + '12' : '#fff',
                        fontWeight: condForm.cropCondition === c ? 600 : 400,
                      }}>
                        <input type="radio" name="cond" value={c} checked={condForm.cropCondition === c} onChange={() => setCondForm(f => ({ ...f, cropCondition: c }))} style={{ display: 'none' }} />
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </label>
                    ))}
                  </div>
                  <textarea className="form-input" rows={2} placeholder="Notes (pests, drought, disease...)" value={condForm.conditionNotes} onChange={e => setCondForm(f => ({ ...f, conditionNotes: e.target.value }))} />
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting || !condForm.cropCondition}>Save</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowConditionForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Harvest Report Form ──────────────── */}
          {showHarvestForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Submit Harvest Report</div>
              <div className="card-body">
                <p style={{ fontSize: '0.85rem', color: '#555', margin: '0 0 0.75rem' }}>This will close the current season.</p>
                <form onSubmit={handleHarvest}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Total Harvest (kg) *</label>
                      <input className="form-input" type="number" step="0.1" required value={harvestForm.totalHarvestKg} onChange={e => setHarvestForm(f => ({ ...f, totalHarvestKg: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">Sales Amount</label>
                      <input className="form-input" type="number" step="0.01" value={harvestForm.salesAmount} onChange={e => setHarvestForm(f => ({ ...f, salesAmount: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Notes</label>
                      <textarea className="form-input" rows={2} value={harvestForm.notes} onChange={e => setHarvestForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Harvest Report'}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowHarvestForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Comparison Dimensions ────────────── */}
          {comparison?.dimensions && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Progress Comparison</div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Dimension</th><th>Status</th><th>Details</th></tr></thead>
                    <tbody>
                      {Object.entries(comparison.dimensions).map(([key, dim]) => (
                        <tr key={key}>
                          <td style={{ fontWeight: 500 }}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</td>
                          <td>
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                              background: dim.status === 'on_track' ? '#d1fae5' : dim.status === 'slight_delay' ? '#fef3c7' : dim.status === 'at_risk' ? '#fee2e2' : '#f3f4f6',
                              color: dim.status === 'on_track' ? '#065f46' : dim.status === 'slight_delay' ? '#92400e' : dim.status === 'at_risk' ? '#991b1b' : '#6b7280',
                            }}>{dim.status?.replace(/_/g, ' ')}</span>
                          </td>
                          <td className="text-muted" style={{ fontSize: '0.85rem' }}>{dim.label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Recent Progress Entries ──────────── */}
          {entries.length > 0 && (
            <div className="card">
              <div className="card-header">Recent Progress Entries</div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Date</th><th>Type</th><th>Activity</th><th>Condition</th><th>Advice</th></tr></thead>
                    <tbody>
                      {entries.slice(0, 15).map(e => (
                        <tr key={e.id}>
                          <td className="text-sm">{new Date(e.entryDate).toLocaleDateString()}</td>
                          <td>{e.entryType}</td>
                          <td>{e.activityType || '—'}{e.description ? `: ${e.description}` : ''}</td>
                          <td>{e.cropCondition ? <span style={{ color: CONDITION_COLORS[e.cropCondition], fontWeight: 600 }}>{e.cropCondition}</span> : '—'}</td>
                          <td>{e.followedAdvice || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── Past Seasons ────────────────────────── */}
      {seasons.filter(s => s.status !== 'active').length > 0 && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="card-header">Past Seasons</div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Crop</th><th>Planted</th><th>Status</th><th>Harvest</th><th>Score</th></tr></thead>
                <tbody>
                  {seasons.filter(s => s.status !== 'active').map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.cropType}</td>
                      <td className="text-sm">{new Date(s.plantingDate).toLocaleDateString()}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{s.status}</span></td>
                      <td>{s.harvestReport ? `${s.harvestReport.totalHarvestKg} kg` : '—'}</td>
                      <td>{s.progressScore ? (
                        <span style={{ color: CLASS_COLORS[s.progressScore.performanceClassification], fontWeight: 600 }}>
                          {s.progressScore.progressScore}/100
                        </span>
                      ) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* New season button at bottom for completed seasons */}
      {!activeSeason && seasons.length > 0 && !showSeasonForm && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={() => setShowSeasonForm(true)}>Start New Season</button>
        </div>
      )}
    </div>
  );
}
