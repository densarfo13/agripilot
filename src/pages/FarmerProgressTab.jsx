import React, { useEffect, useRef, useState } from 'react';
import { useFarmerContext } from './FarmerHomePage.jsx';
import api, { formatApiError } from '../api/client.js';
import { useDraft } from '../utils/useDraft.js';
import { useAuthStore } from '../store/authStore.js';
import CropSelect from '../components/CropSelect.jsx';
import TapSelector from '../components/TapSelector.jsx';
import LocationDetect from '../components/LocationDetect.jsx';
import InlineAlert from '../components/InlineAlert.jsx';
import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx';
import { getCropLabel } from '../utils/crops.js';
import { trackPilotEvent } from '../utils/pilotTracker.js';
import { UNIT_OPTIONS, formatLandSize } from '../utils/landSize.js';

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
const ACTIVITY_OPTIONS = [
  { value: 'planting', label: 'Planting', icon: '\uD83C\uDF31' },
  { value: 'spraying', label: 'Spraying', icon: '\uD83D\uDCA7' },
  { value: 'fertilizing', label: 'Fertilizing', icon: '\uD83E\uDEBB' },
  { value: 'irrigation', label: 'Irrigation', icon: '\uD83D\uDEB0' },
  { value: 'weeding', label: 'Weeding', icon: '\uD83C\uDF3F' },
  { value: 'harvesting', label: 'Harvesting', icon: '\uD83C\uDF3E' },
  { value: 'storage', label: 'Storage', icon: '\uD83C\uDFE0' },
  { value: 'selling', label: 'Selling', icon: '\uD83D\uDCB0' },
  { value: 'other', label: 'Other', icon: '\u2699\uFE0F' },
];
const IMAGE_STAGE_OPTIONS = [
  { value: 'early_growth', label: 'Early Growth', icon: '\uD83C\uDF31' },
  { value: 'mid_stage', label: 'Mid Stage', icon: '\uD83C\uDF3F' },
  { value: 'pre_harvest', label: 'Pre-Harvest', icon: '\uD83C\uDF3C' },
  { value: 'harvest', label: 'Harvest', icon: '\uD83C\uDF3E' },
  { value: 'storage', label: 'Storage', icon: '\uD83C\uDFE0' },
];
const ADVICE_OPTIONS = [
  { value: '', label: 'N/A' },
  { value: 'yes', label: 'Yes', color: '#22C55E' },
  { value: 'partial', label: 'Partial', color: '#F59E0B' },
  { value: 'no', label: 'No', color: '#EF4444' },
];
const IMAGE_STAGES = ['early_growth', 'mid_stage', 'pre_harvest', 'harvest', 'storage'];

export default function FarmerProgressTab() {
  const { farmerId, farmer } = useFarmerContext();
  const currentUser  = useAuthStore(s => s.user);
  const isAdmin      = ['super_admin', 'institutional_admin'].includes(currentUser?.role);
  const [seasons, setSeasons] = useState([]);
  const [activeSeason, setActiveSeason] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null); // season being reopened
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
  const [showImageForm, setShowImageForm] = useState(false);
  const [showQuickUpdate, setShowQuickUpdate] = useState(false);
  const [credibility, setCredibility] = useState(null);
  const submitGuardRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [seasonPrefilled, setSeasonPrefilled] = useState(false);
  const [confirmCropFailure, setConfirmCropFailure] = useState(false);

  // Close all panels and open exactly one — prevents multi-form bleed
  const openForm = (setter) => {
    setShowSeasonForm(false);
    setShowProgressForm(false);
    setShowConditionForm(false);
    setShowStageConfirm(false);
    setShowHarvestForm(false);
    setShowImageForm(false);
    setFormError('');
    setter(true);
  };

  const loadSeasons = () => {
    setLoading(true);
    setPageError('');
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
            api.get(`/seasons/${active.id}/credibility`).catch(() => ({ data: null })),
          ]).then(([pRes, cRes, sRes, crRes]) => {
            setEntries(pRes.data);
            setComparison(cRes.data);
            setScore(sRes.data);
            setCredibility(crRes.data);
          });
        } else {
          setActiveSeason(null);
          setEntries([]);
          setComparison(null);
          setScore(null);
        }
      })
      .catch(() => setPageError('Failed to load season data. Check your connection.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSeasons(); }, [farmerId]);

  // ─── Season Setup Form ────────────────────────────
  const SEASON_FORM_INITIAL = { cropType: '', farmSizeAcres: '', landSizeUnit: 'ACRE', plantingDate: '', seedType: '', seedQuantity: '', declaredIntent: '' };
  const { state: seasonForm, setState: setSeasonForm, clearDraft: clearSeasonDraft, draftRestored: seasonDraftRestored } = useDraft(
    `season-form:${farmerId}`,
    SEASON_FORM_INITIAL,
  );

  // Opens season form and prefills from the most recent past season to reduce re-entry
  const openSeasonForm = () => {
    const lastSeason = seasons.filter(s => s.status !== 'active').sort((a, b) => new Date(b.plantingDate) - new Date(a.plantingDate))[0];
    if (lastSeason) {
      setSeasonForm({
        cropType: lastSeason.cropType || '',
        farmSizeAcres: lastSeason.farmSizeAcres || '',
        landSizeUnit: lastSeason.landSizeUnit || 'ACRE',
        plantingDate: new Date().toISOString().split('T')[0],
        seedType: lastSeason.seedType || '',
        seedQuantity: lastSeason.seedQuantity || '',
        declaredIntent: lastSeason.declaredIntent || '',
      });
      setSeasonPrefilled(true);
    } else {
      setSeasonForm({ cropType: '', farmSizeAcres: '', landSizeUnit: 'ACRE', plantingDate: new Date().toISOString().split('T')[0], seedType: '', seedQuantity: '', declaredIntent: '' });
      setSeasonPrefilled(false);
    }
    openForm(setShowSeasonForm);
  };

  const handleCreateSeason = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setFormError('');
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/seasons/farmer/${farmerId}`, seasonForm);
      trackPilotEvent('season_created', { farmerId, crop: seasonForm.cropType });
      clearSeasonDraft();
      setShowSeasonForm(false);
      setSeasonPrefilled(false);
      setSeasonForm(SEASON_FORM_INITIAL);
      showSuccess('Season created. You can now start logging activities.');
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, 'Failed to create season. Please check your details and try again.'));
    }
    setSubmitting(false);
    submitGuardRef.current = false;
  };

  // ─── Progress Entry Form ──────────────────────────
  // Draft key includes farmerId + season so restoring into the wrong season is impossible
  const PROGRESS_DRAFT_INITIAL = { activityType: '', description: '', quantity: '', unit: '', followedAdvice: '', adviceNotes: '', entryDate: new Date().toISOString().split('T')[0] };
  const { state: progressForm, setState: setProgressForm, clearDraft: clearProgressDraft, draftRestored: progressDraftRestored } = useDraft(
    `progress-form:${farmerId}:${activeSeason?.id || 'none'}`,
    PROGRESS_DRAFT_INITIAL,
  );

  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const [dupWarning, setDupWarning] = useState(false);

  const handleLogProgress = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setFormError('');
    // Client-side same-day duplicate warning
    const today = new Date().toISOString().split('T')[0];
    const sameDayEntry = entries.find(en => en.entryDate?.startsWith(today) && en.activityType === progressForm.activityType);
    if (sameDayEntry && !dupWarning) {
      setDupWarning(true);
      setFormError(`Duplicate check: You already logged "${progressForm.activityType}" today (${new Date(sameDayEntry.entryDate).toLocaleDateString()}). If this is a separate activity, click "Save Activity" again to confirm.`);
      return;
    }
    setDupWarning(false);
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/progress`, { ...progressForm, entryType: 'activity' });
      // Detect first-ever update for this farmer
      const isFirstUpdate = entries.length === 0;
      if (isFirstUpdate) trackPilotEvent('first_update_submitted', { farmerId, seasonId: activeSeason.id });
      trackPilotEvent('update_submitted', { farmerId, seasonId: activeSeason.id, type: 'activity' });
      clearProgressDraft();
      setShowProgressForm(false);
      setProgressForm(PROGRESS_DRAFT_INITIAL);
      showSuccess(isFirstUpdate
        ? 'Update submitted — your first activity is recorded! Your progress tracking has begun.'
        : 'Update submitted. Activity recorded successfully.');
      loadSeasons();
    } catch (err) {
      trackPilotEvent('update_failed', { farmerId, type: 'activity', error: err?.response?.data?.error || err.message });
      // Form data is preserved via useDraft — user can retry without re-entering
      setFormError(formatApiError(err, 'Failed to save activity. Your entry is saved locally — please try again.'));
    }
    setSubmitting(false);
    submitGuardRef.current = false;
  };

  // ─── Condition Update Form ────────────────────────
  const [condForm, setCondForm] = useState({ cropCondition: '', conditionNotes: '' });

  const handleCondition = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setFormError('');
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/condition`, condForm);
      setShowConditionForm(false);
      setCondForm({ cropCondition: '', conditionNotes: '' });
      showSuccess('Condition update saved.');
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, 'Failed to save condition update. Please check your connection and try again.'));
    }
    setSubmitting(false);
    submitGuardRef.current = false;
  };

  // ─── Stage Confirmation ───────────────────────────
  const [stageForm, setStageForm] = useState({ confirmedStage: '', note: '' });

  const handleStageConfirm = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setFormError('');
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/stage-confirmation`, stageForm);
      setShowStageConfirm(false);
      setStageForm({ confirmedStage: '', note: '' });
      showSuccess('Stage confirmed.');
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, 'Failed to save stage confirmation. Please check your connection and try again.'));
    }
    setSubmitting(false);
    submitGuardRef.current = false;
  };

  // ─── Harvest Report Form ──────────────────────────
  const [harvestForm, setHarvestForm] = useState({ totalHarvestKg: '', salesAmount: '', notes: '' });

  const handleHarvest = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setFormError('');
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      await api.post(`/seasons/${activeSeason.id}/harvest-report`, harvestForm);
      trackPilotEvent('update_submitted', { farmerId, seasonId: activeSeason.id, type: 'harvest' });
      setShowHarvestForm(false);
      setHarvestForm({ totalHarvestKg: '', salesAmount: '', notes: '' });
      showSuccess('Harvest report submitted.');
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, 'Failed to submit harvest report. Please check your connection and try again.'));
    }
    setSubmitting(false);
    submitGuardRef.current = false;
  };

  // ─── Image Upload Form ────────────────────────
  const [imageForm, setImageForm] = useState({ imageUrl: '', imageStage: '', description: '', latitude: null, longitude: null });

  const handleImageUpload = async (e) => {
    e.preventDefault();
    if (submitGuardRef.current) return;
    setFormError('');
    submitGuardRef.current = true;
    setSubmitting(true);
    try {
      const payload = { ...imageForm };
      if (!payload.latitude) { delete payload.latitude; delete payload.longitude; }
      await api.post(`/seasons/${activeSeason.id}/progress-image`, payload);
      trackPilotEvent('photo_uploaded', { farmerId, seasonId: activeSeason.id });
      setShowImageForm(false);
      setImageForm({ imageUrl: '', imageStage: '', description: '', latitude: null, longitude: null });
      showSuccess('Photo uploaded. Your progress photo has been saved to this season.');
      loadSeasons();
    } catch (err) {
      trackPilotEvent('photo_failed', { farmerId, error: err?.response?.data?.error || err.message });
      setFormError(formatApiError(err, 'Failed to save photo. Please check the image URL and try again.'));
    }
    setSubmitting(false);
    submitGuardRef.current = false;
  };

  // ─── Edge-case flags ─────────────────────────
  const handleEdgeCase = async (flag) => {
    if (!activeSeason) return;
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    setConfirmCropFailure(false);
    setPageError('');
    try {
      await api.patch(`/seasons/${activeSeason.id}`, { [flag]: true });
      loadSeasons();
    } catch (err) {
      setPageError(err.response?.data?.error || 'Failed to update season. Please try again.');
    } finally {
      submitGuardRef.current = false;
    }
  };

  if (loading) return <div className="loading">Loading progress...</div>;

  return (
    <div>
      {successMsg && (
        <InlineAlert variant="success" onDismiss={() => setSuccessMsg('')}>
          &#10003; {successMsg}
        </InlineAlert>
      )}
      {pageError && (
        <InlineAlert variant="danger" onDismiss={() => setPageError('')} action={{ label: 'Retry', onClick: loadSeasons }}>
          {pageError}
        </InlineAlert>
      )}

      {/* ─── Quick Update Flow (tap-first wizard) ── */}
      {showQuickUpdate && activeSeason && (
        <QuickUpdateFlow
          seasonId={activeSeason.id}
          farmerId={farmerId}
          entries={entries}
          onComplete={() => { setShowQuickUpdate(false); loadSeasons(); showSuccess('Update saved successfully!'); }}
          onCancel={() => setShowQuickUpdate(false)}
        />
      )}

      {/* ─── No active season → prompt setup ─────── */}
      {!activeSeason && !showSeasonForm && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
          <h3 style={{ margin: '0 0 0.35rem' }}>No Active Season</h3>
          <p className="text-muted" style={{ marginBottom: '1rem' }}>Start a new farming season to begin tracking your progress, activities, and harvest.</p>
          <button className="btn btn-primary" onClick={openSeasonForm}>Start New Season</button>
        </div>
      )}

      {/* ─── Season Setup Form ───────────────────── */}
      {showSeasonForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">New Season Setup</div>
          <div className="card-body">
            <form onSubmit={handleCreateSeason}>
              {seasonPrefilled && (
                <InlineAlert variant="info">ℹ️ Prefilled from your last season — please review before submitting.</InlineAlert>
              )}
              {formError && (
                <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Crop Type *</label>
                  <CropSelect
                    value={seasonForm.cropType}
                    onChange={(v) => setSeasonForm(f => ({ ...f, cropType: v }))}
                    countryCode={farmer?.countryCode}
                    required
                    placeholder="Search crops..."
                  />
                </div>
                <div>
                  <label className="form-label">Farm Size *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="form-input" style={{ flex: 1 }} type="number" step="0.1" required value={seasonForm.farmSizeAcres} onChange={e => setSeasonForm(f => ({ ...f, farmSizeAcres: e.target.value }))} />
                    <select className="form-input" style={{ width: 'auto', minWidth: '7rem' }} value={seasonForm.landSizeUnit} onChange={e => setSeasonForm(f => ({ ...f, landSizeUnit: e.target.value }))}>
                      {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
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
              <span>Season: {getCropLabel(activeSeason.cropType)} ({activeSeason.landSizeValue ? formatLandSize(activeSeason.landSizeValue, activeSeason.landSizeUnit) : `${activeSeason.farmSizeAcres} ${activeSeason.areaUnit || 'acres'}`})</span>
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
                <div>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>Progress Entries</span>
                  <div style={{ fontWeight: 600 }}>{activeSeason._count?.progressEntries || entries.length}</div>
                  {entries.length > 0 && (
                    <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                      Submitted
                    </span>
                  )}
                  {entries.length === 0 && (
                    <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>
                      No entries yet
                    </span>
                  )}
                </div>
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
                          background: isActual ? STAGE_COLORS[s] : isExpected ? STAGE_COLORS[s] + '40' : '#243041',
                        }} title={`${STAGE_LABELS[s]}${isExpected ? ' (expected)' : ''}${isActual ? ' (actual)' : ''}`} />
                      );
                    })}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#A1A1AA' }}>
                    Expected: <strong>{STAGE_LABELS[comparison.expectedStage]}</strong>
                    {comparison.dimensions?.stageAlignment?.actualStage && (
                      <> | Actual: <strong>{STAGE_LABELS[comparison.dimensions.stageAlignment.actualStage]}</strong></>
                    )}
                  </div>
                </div>
              )}

              {/* Stage confirmation prompt */}
              {comparison && !showStageConfirm && (
                <div style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>Does your farm look like it is at the <strong>{STAGE_LABELS[comparison.expectedStage]}</strong> stage?</span>
                  <button className="btn btn-sm btn-outline" onClick={() => { setStageForm({ confirmedStage: comparison.expectedStage, note: '' }); openForm(setShowStageConfirm); }}>Confirm Stage</button>
                </div>
              )}

              {/* Credibility indicator — expandable with flag details */}
              {credibility && (() => {
                const lvl = credibility.credibilityLevel;
                const isHigh = lvl === 'high_confidence';
                const isMed = lvl === 'medium_confidence';
                const borderColor = isHigh ? 'rgba(34,197,94,0.3)' : isMed ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
                const bg = isHigh ? 'rgba(34,197,94,0.15)' : isMed ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)';
                const labelColor = isHigh ? '#16a34a' : isMed ? '#d97706' : '#dc2626';
                const label = isHigh ? 'Strong' : isMed ? 'Moderate' : 'Needs Attention';
                const FLAG_LABELS = {
                  burst_submissions: 'Several entries submitted in a single day — this can look like backfilling.',
                  update_gap_detected: 'No updates for more than 4 weeks. Log activities regularly.',
                  no_updates_logged: 'No activities logged yet. Start logging to build your record.',
                  stage_regression: 'Crop stage went backward — confirm your current stage.',
                  impossible_fast_progression: 'Stage progression was faster than expected.',
                  high_stage_mismatch: 'Your confirmed stages often differ from the expected stage.',
                  entries_before_planting: 'Some entries are dated before your planting date.',
                  future_dated_entries: 'Entries with future dates were detected.',
                  harvest_too_early: 'Harvest was logged too early in the season.',
                  implausible_yield: 'Reported yield is unusually high — please verify the amount.',
                  very_low_yield: 'Reported yield is unusually low.',
                  condition_rapid_recovery: 'Crop condition improved from poor to good in less than a week.',
                  advice_always_yes: 'All advice marked as followed every time — vary your responses if accurate.',
                  advice_never_followed: 'Advice never marked as followed.',
                  crop_failure_reported: 'Crop failure was reported for this season.',
                  partial_harvest_reported: 'Partial harvest was reported.',
                  season_abandoned: 'This season was abandoned.',
                  harvest_image_too_early: 'A harvest photo was added too early in the season.',
                  early_image_in_post_harvest: 'An early-growth photo was added during post-harvest.',
                  image_stage_incoherent: 'Photo stages are inconsistent with the season timeline.',
                };
                return (
                  <div style={{ border: `1px solid ${borderColor}`, background: bg, borderRadius: 8, marginBottom: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>Data Quality:</strong>{' '}
                        <span style={{ color: labelColor, fontWeight: 600 }}>{label}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#A1A1AA' }}>
                          — how consistent and complete your farm records look
                        </span>
                      </div>
                      {credibility.flags?.length > 0 && (
                        <span style={{ fontSize: '0.78rem', color: labelColor, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '0.5rem' }}>
                          {credibility.flags.length} item{credibility.flags.length > 1 ? 's' : ''} to review ▾
                        </span>
                      )}
                    </div>
                    {credibility.flags?.length > 0 && (
                      <div style={{ borderTop: `1px solid ${borderColor}`, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {credibility.flags.map(flag => (
                          <div key={flag} style={{ fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                            <span style={{ color: labelColor, fontWeight: 700, flexShrink: 0 }}>•</span>
                            <span style={{ color: '#FFFFFF' }}>{FLAG_LABELS[flag] || flag.replace(/_/g, ' ')}</span>
                          </div>
                        ))}
                        {!isHigh && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: '#A1A1AA', borderTop: `1px solid ${borderColor}`, paddingTop: '0.35rem' }}>
                            Tip: Log activities regularly, confirm your growth stage, and add photos to improve your data quality score.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Stale season banner — harvest overdue */}
              {activeSeason.expectedHarvestDate && !activeSeason.cropFailureReported && (() => {
                const daysOverdue = Math.floor((Date.now() - new Date(activeSeason.expectedHarvestDate)) / 86400000);
                if (daysOverdue > 0) return (
                  <div className="alert-inline alert-inline-danger" style={{ borderRadius: 8 }}>
                    Your expected harvest date was <strong>{daysOverdue} day{daysOverdue !== 1 ? 's' : ''} ago</strong>.{' '}
                    If you have harvested, submit a harvest report below.{' '}
                    If the crop failed or harvest is delayed, use the options below.
                  </div>
                );
                return null;
              })()}

              {/* Missing update prompt */}
              {activeSeason.lastActivityDate && (() => {
                const daysSince = Math.floor((Date.now() - new Date(activeSeason.lastActivityDate)) / 86400000);
                if (daysSince >= 14) return (
                  <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    It has been <strong>{daysSince} days</strong> since your last update. Regular updates help build a stronger track record.
                  </div>
                );
                return null;
              })()}

              {/* Quick Update CTA — primary action */}
              <button
                onClick={() => setShowQuickUpdate(true)}
                style={{
                  width: '100%', padding: '1rem', marginBottom: '0.75rem',
                  background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                  color: '#FFFFFF', border: 'none', borderRadius: '14px',
                  fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer',
                  minHeight: '56px', WebkitTapHighlightColor: 'transparent',
                  boxShadow: '0 4px 14px rgba(22,163,74,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
                data-testid="quick-update-cta"
              >
                <span style={{ fontSize: '1.3rem' }}>📝</span> Add Update
              </button>

              {/* Detailed action buttons — secondary */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-outline" onClick={() => openForm(setShowProgressForm)}>Log Activity</button>
                <button className="btn btn-sm btn-outline" onClick={() => openForm(setShowConditionForm)}>Update Condition</button>
                <button className="btn btn-sm btn-outline" style={{ borderColor: '#22C55E', color: '#22C55E' }} onClick={() => openForm(setShowImageForm)}>Add Photo</button>
                <button className="btn btn-sm btn-outline" style={{ borderColor: '#ea580c', color: '#ea580c' }} onClick={() => openForm(setShowHarvestForm)}>Submit Harvest Report</button>
              </div>

              {/* Edge-case flags */}
              {!activeSeason.cropFailureReported && !activeSeason.partialHarvest && (
                <div style={{ marginTop: '0.5rem' }}>
                  {!confirmCropFailure ? (
                    <button className="btn btn-sm btn-outline-danger" style={{ fontSize: '0.75rem' }} onClick={() => setConfirmCropFailure(true)}>
                      Report Crop Failure
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--danger-light)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--danger)' }}>
                      <span>Confirm: report crop failure for this season?</span>
                      <button className="btn btn-sm btn-outline-danger" style={{ padding: '0.4rem 0.75rem' }} onClick={() => handleEdgeCase('cropFailureReported')}>Yes, Report</button>
                      <button className="btn btn-sm btn-outline" style={{ padding: '0.4rem 0.75rem' }} onClick={() => setConfirmCropFailure(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              )}
              {activeSeason.cropFailureReported && (
                <div className="alert-inline alert-inline-danger" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  Crop failure reported for this season
                </div>
              )}
            </div>
          </div>

          {/* ─── Stage Confirmation Form ───────────── */}
          {showStageConfirm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Confirm Growth Stage</div>
              <div className="card-body">
                <form onSubmit={handleStageConfirm}>
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  <p style={{ fontSize: '0.875rem', color: '#FFFFFF', margin: '0 0 0.5rem' }}>
                    We expect your crop to be at: <strong style={{ color: STAGE_COLORS[comparison?.expectedStage] }}>{STAGE_LABELS[comparison?.expectedStage]}</strong>
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#A1A1AA', margin: '0 0 0.75rem' }}>
                    What stage does your farm actually look like?
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    {STAGES.filter(s => s !== 'pre_planting').map(s => (
                      <label key={s} style={{
                        padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem',
                        minHeight: '44px', display: 'inline-flex', alignItems: 'center',
                        border: stageForm.confirmedStage === s ? `2px solid ${STAGE_COLORS[s]}` : '2px solid #243041',
                        background: stageForm.confirmedStage === s ? STAGE_COLORS[s] + '15' : '#162033',
                        fontWeight: stageForm.confirmedStage === s ? 600 : 400,
                        color: stageForm.confirmedStage === s ? STAGE_COLORS[s] : '#FFFFFF',
                        WebkitTapHighlightColor: 'transparent',
                      }}>
                        <input type="radio" name="stage" value={s} checked={stageForm.confirmedStage === s} onChange={() => setStageForm(f => ({ ...f, confirmedStage: s }))} style={{ display: 'none' }} />
                        {STAGE_LABELS[s]}
                        {s === comparison?.expectedStage && <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem', opacity: 0.7 }}>(expected)</span>}
                      </label>
                    ))}
                  </div>
                  <textarea className="form-input" rows={2} placeholder="Note (optional) — e.g. drought, late start..." value={stageForm.note} onChange={e => setStageForm(f => ({ ...f, note: e.target.value }))} />
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting || !stageForm.confirmedStage}>{submitting ? 'Saving...' : 'Confirm Stage'}</button>
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
                  {progressDraftRestored && (
                    <div style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#0EA5E9', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Draft restored — your previous entry was saved.</span>
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0EA5E9', fontSize: '0.8rem', textDecoration: 'underline', padding: 0 }} onClick={() => { clearProgressDraft(); setProgressForm(PROGRESS_DRAFT_INITIAL); }}>Clear</button>
                    </div>
                  )}
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  {/* Required fields first */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <TapSelector
                      label="Activity Type *"
                      options={ACTIVITY_OPTIONS}
                      value={progressForm.activityType}
                      onChange={(v) => setProgressForm(f => ({ ...f, activityType: v }))}
                      columns={3}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Date</label>
                      <input className="form-input" type="date" value={progressForm.entryDate} onChange={e => setProgressForm(f => ({ ...f, entryDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                      <textarea className="form-input" rows={2} placeholder="What did you do? Any issues?" value={progressForm.description} onChange={e => setProgressForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  {/* Optional details — collapsed */}
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{ fontSize: '0.82rem', color: '#A1A1AA', cursor: 'pointer', padding: '0.4rem 0', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                      More details (quantity, unit, advice)
                    </summary>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <div>
                        <label className="form-label">Quantity <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                        <input className="form-input" type="number" step="0.1" inputMode="decimal" value={progressForm.quantity} onChange={e => setProgressForm(f => ({ ...f, quantity: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">Unit <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                        <input className="form-input" value={progressForm.unit} onChange={e => setProgressForm(f => ({ ...f, unit: e.target.value }))} placeholder="kg, bags, litres" />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <TapSelector
                          label="Followed advice?"
                          options={ADVICE_OPTIONS}
                          value={progressForm.followedAdvice}
                          onChange={(v) => setProgressForm(f => ({ ...f, followedAdvice: v }))}
                          columns={4}
                          compact
                        />
                      </div>
                    </div>
                  </details>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Activity'}</button>
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
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {['good', 'average', 'poor'].map(c => (
                      <label key={c} style={{
                        flex: 1, textAlign: 'center', padding: '0.75rem', borderRadius: 8, cursor: 'pointer',
                        minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        WebkitTapHighlightColor: 'transparent',
                        border: condForm.cropCondition === c ? `2px solid ${CONDITION_COLORS[c]}` : '2px solid #243041',
                        background: condForm.cropCondition === c ? CONDITION_COLORS[c] + '12' : '#162033',
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
                <p style={{ fontSize: '0.85rem', color: '#A1A1AA', margin: '0 0 0.75rem' }}>
                  This will close the current season.
                  {activeSeason.cropFailureReported && (
                    <span style={{ display: 'block', marginTop: '0.25rem', color: '#b45309', fontWeight: 500 }}>
                      Crop failure is recorded — you may enter 0 kg if there was no harvest.
                    </span>
                  )}
                </p>
                <form onSubmit={handleHarvest}>
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Total Harvest (kg) *</label>
                      <input
                        className="form-input" type="number" step="0.1"
                        min={activeSeason.cropFailureReported ? '0' : '0.1'}
                        required
                        value={harvestForm.totalHarvestKg}
                        onChange={e => setHarvestForm(f => ({ ...f, totalHarvestKg: e.target.value }))}
                        placeholder={activeSeason.cropFailureReported ? '0 allowed for crop failure' : ''}
                      />
                    </div>
                    <div>
                      <label className="form-label">Sales Amount</label>
                      <input className="form-input" type="number" step="0.01" value={harvestForm.salesAmount} onChange={e => setHarvestForm(f => ({ ...f, salesAmount: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                      <textarea className="form-input" rows={2} placeholder="Any notes about quality, storage, buyer..." value={harvestForm.notes} onChange={e => setHarvestForm(f => ({ ...f, notes: e.target.value }))} />
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

          {/* ─── Image Upload Form ──────────────── */}
          {showImageForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">Add Progress Photo</div>
              <div className="card-body">
                <form onSubmit={handleImageUpload}>
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Image URL *</label>
                      <input className="form-input" required value={imageForm.imageUrl} onChange={e => setImageForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <TapSelector
                        label="Growth Stage"
                        options={IMAGE_STAGE_OPTIONS}
                        value={imageForm.imageStage}
                        onChange={(v) => setImageForm(f => ({ ...f, imageStage: v }))}
                        columns={3}
                        compact
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Description</label>
                      <input className="form-input" value={imageForm.description} onChange={e => setImageForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this photo show?" />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Photo Location <span style={{ color: '#71717A', fontWeight: 400 }}>optional</span></label>
                      <LocationDetect
                        compact
                        label="Tag with current location"
                        onDetected={(loc) => setImageForm(f => ({ ...f, latitude: loc.latitude, longitude: loc.longitude }))}
                      />
                      {imageForm.latitude && (
                        <div style={{ fontSize: '0.72rem', color: '#22C55E', marginTop: '0.25rem' }}>
                          GPS: {imageForm.latitude.toFixed(4)}, {imageForm.longitude.toFixed(4)}
                          <span onClick={() => setImageForm(f => ({ ...f, latitude: null, longitude: null }))} style={{ color: '#71717A', cursor: 'pointer', marginLeft: '0.5rem' }}>clear</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Photo'}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowImageForm(false)}>Cancel</button>
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
                              background: dim.status === 'on_track' ? 'rgba(34,197,94,0.15)' : dim.status === 'slight_delay' ? 'rgba(245,158,11,0.15)' : dim.status === 'at_risk' ? 'rgba(239,68,68,0.15)' : '#1E293B',
                              color: dim.status === 'on_track' ? '#22C55E' : dim.status === 'slight_delay' ? '#F59E0B' : dim.status === 'at_risk' ? '#EF4444' : '#6b7280',
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
                <thead>
                  <tr>
                    <th>Crop</th><th>Planted</th><th>Status</th><th>Harvest</th><th>Score</th>
                    {isAdmin && <th>Admin</th>}
                  </tr>
                </thead>
                <tbody>
                  {seasons.filter(s => s.status !== 'active').map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{getCropLabel(s.cropType)}</td>
                      <td className="text-sm">{new Date(s.plantingDate).toLocaleDateString()}</td>
                      <td><span style={{ textTransform: 'capitalize' }}>{s.status}</span></td>
                      <td>{s.harvestReport ? `${s.harvestReport.totalHarvestKg} kg` : '—'}</td>
                      <td>{s.progressScore ? (
                        <span style={{ color: CLASS_COLORS[s.progressScore.performanceClassification], fontWeight: 600 }}>
                          {s.progressScore.progressScore}/100
                        </span>
                      ) : '—'}</td>
                      {isAdmin && (
                        <td>
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ fontSize: '0.75rem', color: '#22C55E', borderColor: 'rgba(34,197,94,0.3)' }}
                            onClick={() => setReopenTarget(s)}
                          >
                            Reopen
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Season Reopen SoD Modal ─────────────── */}
      {reopenTarget && (
        <ReopenSeasonModal
          season={reopenTarget}
          onClose={() => setReopenTarget(null)}
          onReopened={() => { setReopenTarget(null); loadSeasons(); }}
        />
      )}

      {/* New season button at bottom for completed seasons */}
      {!activeSeason && seasons.length > 0 && !showSeasonForm && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={openSeasonForm}>Start New Season</button>
        </div>
      )}
    </div>
  );
}

// ─── SoD: Reopen Season Modal ────────────────────────────────────────────────
// Two-phase: (1) create ApprovalRequest, (2) execute reopen with approved ID
function ReopenSeasonModal({ season, onClose, onReopened }) {
  const [mode, setMode]         = useState('request');
  const [reason, setReason]     = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [created, setCreated]   = useState(null);
  const reopenGuardRef          = useRef(false);

  const submitRequest = async (e) => {
    e.preventDefault();
    if (reopenGuardRef.current) return;
    if (!reason.trim() || reason.trim().length < 5) {
      setError('Please provide a meaningful reason (at least 5 characters)');
      return;
    }
    reopenGuardRef.current = true;
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/security/requests', {
        requestType: 'season_reopen',
        targetSeasonId: season.id,
        reason: reason.trim(),
      });
      setCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create approval request');
    } finally {
      reopenGuardRef.current = false;
      setSaving(false);
    }
  };

  const executeReopen = async (e) => {
    e.preventDefault();
    if (reopenGuardRef.current) return;
    if (!approvalId.trim()) {
      setError('Please enter the Approval Request ID');
      return;
    }
    reopenGuardRef.current = true;
    setSaving(true);
    setError('');
    try {
      await api.post(`/seasons/${season.id}/reopen`, {
        approvalRequestId: approvalId.trim(),
      });
      onReopened();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reopen season');
    } finally {
      reopenGuardRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          Reopen Season — {getCropLabel(season.cropType)}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#F59E0B', marginBottom: '1rem' }}>
            <strong>Separation of Duties required.</strong> Reopening a season requires a second admin's approval
            (4-hour execution window). Submit a request, ask another admin to approve it at{' '}
            <em>Admin → Security Requests</em>, then return here to execute.
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: '0.75rem' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 0, marginBottom: '1rem', border: '1px solid #243041', borderRadius: 6, overflow: 'hidden' }}>
            <button
              type="button"
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem', fontWeight: mode === 'request' ? 700 : 400, background: mode === 'request' ? '#22C55E' : '#162033', color: mode === 'request' ? '#FFFFFF' : '#FFFFFF', border: 'none', cursor: 'pointer', minHeight: '36px' }}
              onClick={() => { setMode('request'); setError(''); }}
            >
              1. Create Request
            </button>
            <button
              type="button"
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem', fontWeight: mode === 'execute' ? 700 : 400, background: mode === 'execute' ? '#22C55E' : '#162033', color: mode === 'execute' ? '#FFFFFF' : '#FFFFFF', border: 'none', cursor: 'pointer', minHeight: '36px' }}
              onClick={() => { setMode('execute'); setError(''); }}
            >
              2. Execute (have ID)
            </button>
          </div>

          {mode === 'request' && !created && (
            <form onSubmit={submitRequest}>
              <div className="form-group">
                <label className="form-label">Reason for reopening *</label>
                <textarea
                  className="form-input"
                  rows={3}
                  required
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Explain why this season needs to be reopened (e.g. data correction, harvest report error)..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}

          {mode === 'request' && created && (
            <div>
              <div style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '0.75rem', fontSize: '0.85rem', color: '#22C55E', marginBottom: '0.75rem' }}>
                <strong>Request submitted.</strong> Another admin must approve it. Approved requests expire in 4 hours.
              </div>
              <div style={{ background: '#1E293B', border: '1px solid #243041', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.83rem', marginBottom: '0.75rem' }}>
                <span style={{ color: '#A1A1AA' }}>Request ID: </span>
                <code style={{ fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>{created.id}</code>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#A1A1AA' }}>
                Once approved, switch to the <strong>Execute</strong> tab and paste the ID above.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {mode === 'execute' && (
            <form onSubmit={executeReopen}>
              <div className="form-group">
                <label className="form-label">Approved Request ID *</label>
                <input
                  className="form-input"
                  style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  required
                  value={approvalId}
                  onChange={e => setApprovalId(e.target.value)}
                  placeholder="Paste the approved Request ID here"
                />
                <div style={{ fontSize: '0.78rem', color: '#A1A1AA', marginTop: '0.3rem' }}>
                  Find this at <em>Admin → Security Requests</em> after approval. Window: 4 hours.
                </div>
              </div>
              <div style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.83rem', color: '#0EA5E9', marginBottom: '0.75rem' }}>
                This will reopen the <strong>{getCropLabel(season.cropType)}</strong> season (planted{' '}
                {new Date(season.plantingDate).toLocaleDateString()}) for further data entry.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Reopening…' : 'Execute Reopen'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
