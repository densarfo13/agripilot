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
import { useTranslation } from '../i18n/index.js';
import VoiceBar from '../components/VoiceBar.jsx';
import { getFarmerLifecycleState, canStartSeason, FARMER_STATE } from '../utils/farmerLifecycle.js';

const STAGES = ['pre_planting', 'planting', 'vegetative', 'flowering', 'harvest', 'post_harvest'];
function getStageLabels(t) {
  return {
    pre_planting: t('stageLabel.prePlanting'), planting: t('stageLabel.planting'), vegetative: t('stageLabel.vegetative'),
    flowering: t('stageLabel.flowering'), harvest: t('stageLabel.harvest'), post_harvest: t('stageLabel.postHarvest'),
  };
}
const STAGE_COLORS = {
  pre_planting: '#6b7280', planting: '#16a34a', vegetative: '#059669',
  flowering: '#d97706', harvest: '#ea580c', post_harvest: '#7c3aed',
};
const CONDITION_COLORS = { good: '#16a34a', average: '#d97706', poor: '#dc2626' };
const CLASS_COLORS = { on_track: '#16a34a', slight_delay: '#d97706', at_risk: '#dc2626', critical: '#7f1d1d' };
function getClassLabels(t) {
  return { on_track: t('classLabel.onTrack'), slight_delay: t('classLabel.slightDelay'), at_risk: t('classLabel.atRisk'), critical: t('classLabel.critical') };
}
const ACTIVITY_TYPES = ['planting', 'spraying', 'fertilizing', 'irrigation', 'weeding', 'harvesting', 'storage', 'selling', 'other'];
function getActivityOptions(t) {
  return [
    { value: 'planting', label: t('activity.planting'), icon: '\uD83C\uDF31' },
    { value: 'spraying', label: t('activity.spraying'), icon: '\uD83D\uDCA7' },
    { value: 'fertilizing', label: t('activity.fertilizing'), icon: '\uD83E\uDEBB' },
    { value: 'irrigation', label: t('activity.irrigation'), icon: '\uD83D\uDEB0' },
    { value: 'weeding', label: t('activity.weeding'), icon: '\uD83C\uDF3F' },
    { value: 'harvesting', label: t('activity.harvesting'), icon: '\uD83C\uDF3E' },
    { value: 'storage', label: t('activity.storage'), icon: '\uD83C\uDFE0' },
    { value: 'selling', label: t('activity.selling'), icon: '\uD83D\uDCB0' },
    { value: 'other', label: t('activity.other'), icon: '\u2699\uFE0F' },
  ];
}
function getImageStageOptions(t) {
  return [
    { value: 'early_growth', label: t('imageStage.earlyGrowth'), icon: '\uD83C\uDF31' },
    { value: 'mid_stage', label: t('imageStage.midStage'), icon: '\uD83C\uDF3F' },
    { value: 'pre_harvest', label: t('imageStage.preHarvest'), icon: '\uD83C\uDF3C' },
    { value: 'harvest', label: t('imageStage.harvest'), icon: '\uD83C\uDF3E' },
    { value: 'storage', label: t('imageStage.storage'), icon: '\uD83C\uDFE0' },
  ];
}
function getAdviceOptions(t) {
  return [
    { value: '', label: t('advice.na') },
    { value: 'yes', label: t('advice.yes'), color: '#22C55E' },
    { value: 'partial', label: t('advice.partial'), color: '#F59E0B' },
    { value: 'no', label: t('advice.no'), color: '#EF4444' },
  ];
}
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

  // ─── Lifecycle guard: block season creation for incomplete profiles ──
  const [farmProfile, setFarmProfile] = useState(null);
  useEffect(() => {
    api.get('/farm-profiles', { params: { farmerId } })
      .then(r => { const profiles = Array.isArray(r.data) ? r.data : r.data?.profiles || []; setFarmProfile(profiles[0] || null); })
      .catch(() => setFarmProfile(null));
  }, [farmerId]);
  const lifecycle = getFarmerLifecycleState({ farmProfile, countryCode: farmer?.countryCode });
  const setupComplete = canStartSeason(lifecycle);

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
  const { t } = useTranslation();

  // ─── Localized option sets (rebuilt on language change) ────
  const STAGE_LABELS = getStageLabels(t);
  const CLASS_LABELS = getClassLabels(t);
  const ACTIVITY_OPTIONS = getActivityOptions(t);
  const IMAGE_STAGE_OPTIONS = getImageStageOptions(t);
  const ADVICE_OPTIONS = getAdviceOptions(t);

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
      .catch(() => setPageError(t('progress.loadError')))
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
      showSuccess(t('progress.seasonCreated'));
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, t('progress.createSeasonError')));
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
      setFormError(t('progress.duplicateWarning'));
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
        ? t('progress.firstActivityRecorded')
        : t('progress.activityRecorded'));
      loadSeasons();
    } catch (err) {
      trackPilotEvent('update_failed', { farmerId, type: 'activity', error: err?.response?.data?.error || err.message });
      // Form data is preserved via useDraft — user can retry without re-entering
      setFormError(formatApiError(err, t('progress.saveActivityError')));
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
      showSuccess(t('progress.conditionSaved'));
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, t('progress.conditionError')));
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
      showSuccess(t('progress.stageConfirmed'));
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, t('progress.stageError')));
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
      showSuccess(t('progress.harvestSubmitted'));
      loadSeasons();
    } catch (err) {
      setFormError(formatApiError(err, t('progress.harvestError')));
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
      showSuccess(t('progress.photoUploaded'));
      loadSeasons();
    } catch (err) {
      trackPilotEvent('photo_failed', { farmerId, error: err?.response?.data?.error || err.message });
      setFormError(formatApiError(err, t('progress.photoError')));
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
      setPageError(err.response?.data?.error || t('progress.updateError'));
    } finally {
      submitGuardRef.current = false;
    }
  };

  if (loading) return <div className="loading">{t('progress.loading')}</div>;

  return (
    <div>
      <VoiceBar voiceKey={showQuickUpdate ? 'progress.chooseStage' : 'progress.start'} compact />
      {successMsg && (
        <InlineAlert variant="success" onDismiss={() => setSuccessMsg('')}>
          &#10003; {successMsg}
        </InlineAlert>
      )}
      {pageError && (
        <InlineAlert variant="danger" onDismiss={() => setPageError('')} action={{ label: t('common.retry'), onClick: loadSeasons }}>
          {pageError}
        </InlineAlert>
      )}

      {/* ─── Quick Update Flow (tap-first wizard) ── */}
      {showQuickUpdate && activeSeason && (
        <QuickUpdateFlow
          seasonId={activeSeason.id}
          farmerId={farmerId}
          seasonStage={activeSeason.stage}
          entries={entries}
          onComplete={() => { setShowQuickUpdate(false); loadSeasons(); showSuccess(t('progress.updateSavedOk')); }}
          onCancel={() => setShowQuickUpdate(false)}
        />
      )}

      {/* ─── No active season → prompt setup (lifecycle-gated) ─────── */}
      {!activeSeason && !showSeasonForm && (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</div>
          <h3 style={{ margin: '0 0 0.35rem' }}>{t('progress.noActiveSeason')}</h3>
          {setupComplete ? (
            <>
              <p className="text-muted" style={{ marginBottom: '1rem' }}>{t('progress.startNewSeasonDesc')}</p>
              <button className="btn btn-primary" onClick={openSeasonForm}>{t('progress.startNewSeason')}</button>
            </>
          ) : (
            <div data-testid="setup-required-banner" style={{ padding: '0.75rem', background: '#2D1B00', borderRadius: '8px', marginTop: '0.5rem' }}>
              <p style={{ color: '#F59E0B', fontWeight: 600, margin: '0 0 0.25rem' }}>{t('progress.setupRequired')}</p>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                {t('progress.completeSetupFirst')}{lifecycle.missing.length > 0 ? ` ${t('home.missing')} ${lifecycle.missing.join(', ')}.` : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── Season Setup Form ───────────────────── */}
      {showSeasonForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-header">{t('progress.newSeasonSetup')}</div>
          <div className="card-body">
            <form onSubmit={handleCreateSeason}>
              {seasonPrefilled && (
                <InlineAlert variant="info">ℹ️ {t('progress.prefilledFromLast')}</InlineAlert>
              )}
              {formError && (
                <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">{t('progress.cropType') + ' *'}</label>
                  <CropSelect
                    value={seasonForm.cropType}
                    onChange={(v) => setSeasonForm(f => ({ ...f, cropType: v }))}
                    countryCode={farmer?.countryCode}
                    required
                    placeholder={t('onboarding.searchCrops')}
                  />
                </div>
                <div>
                  <label className="form-label">{t('progress.farmSize') + ' *'}</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="form-input" style={{ flex: 1 }} type="number" step="0.1" required value={seasonForm.farmSizeAcres} onChange={e => setSeasonForm(f => ({ ...f, farmSizeAcres: e.target.value }))} />
                    <select className="form-input" style={{ width: 'auto', minWidth: '7rem' }} value={seasonForm.landSizeUnit} onChange={e => setSeasonForm(f => ({ ...f, landSizeUnit: e.target.value }))}>
                      {UNIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="form-label">{t('progress.plantingDate') + ' *'}</label>
                  <input className="form-input" type="date" required value={seasonForm.plantingDate} onChange={e => setSeasonForm(f => ({ ...f, plantingDate: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">{t('progress.seedType')}</label>
                  <input className="form-input" value={seasonForm.seedType} onChange={e => setSeasonForm(f => ({ ...f, seedType: e.target.value }))} placeholder={t('progress.egHybrid')} />
                </div>
                <div>
                  <label className="form-label">{t('progress.seedQuantity')}</label>
                  <input className="form-input" type="number" step="0.1" value={seasonForm.seedQuantity} onChange={e => setSeasonForm(f => ({ ...f, seedQuantity: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">{t('progress.plantingIntent')}</label>
                  <input className="form-input" value={seasonForm.declaredIntent} onChange={e => setSeasonForm(f => ({ ...f, declaredIntent: e.target.value }))} placeholder={t('progress.egMaizeForFood')} />
                </div>
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? t('common.creating') : t('progress.startSeason')}</button>
                <button className="btn btn-outline" type="button" onClick={() => setShowSeasonForm(false)}>{t('common.cancel')}</button>
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
              <span>{t('progress.season')} {getCropLabel(activeSeason.cropType)} ({activeSeason.landSizeValue ? formatLandSize(activeSeason.landSizeValue, activeSeason.landSizeUnit) : `${activeSeason.farmSizeAcres} ${activeSeason.areaUnit || 'acres'}`})</span>
              {score?.performanceClassification && (
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.8rem', fontWeight: 600, background: CLASS_COLORS[score.performanceClassification] + '18', color: CLASS_COLORS[score.performanceClassification] }}>
                  {CLASS_LABELS[score.performanceClassification]} — {score.progressScore}/100
                </span>
              )}
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                <div><span className="text-muted" style={{ fontSize: '0.8rem' }}>{t('progress.planted')}</span><div style={{ fontWeight: 600 }}>{new Date(activeSeason.plantingDate).toLocaleDateString()}</div></div>
                <div><span className="text-muted" style={{ fontSize: '0.8rem' }}>{t('progress.expectedHarvest')}</span><div style={{ fontWeight: 600 }}>{activeSeason.expectedHarvestDate ? new Date(activeSeason.expectedHarvestDate).toLocaleDateString() : '—'}</div></div>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>{t('progress.progressEntries')}</span>
                  <div style={{ fontWeight: 600 }}>{activeSeason._count?.progressEntries || entries.length}</div>
                  {entries.length > 0 && (
                    <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                      {t('progress.submitted')}
                    </span>
                  )}
                  {entries.length === 0 && (
                    <span style={{ display: 'inline-block', marginTop: '0.25rem', padding: '0.15rem 0.5rem', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#d97706' }}>
                      {t('progress.noEntriesYet')}
                    </span>
                  )}
                </div>
              </div>

              {/* Stage timeline bar */}
              {comparison && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>{t('progress.growthStage')}</div>
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
                    {t('progress.expected')} <strong>{STAGE_LABELS[comparison.expectedStage]}</strong>
                    {comparison.dimensions?.stageAlignment?.actualStage && (
                      <> | {t('progress.actual')} <strong>{STAGE_LABELS[comparison.dimensions.stageAlignment.actualStage]}</strong></>
                    )}
                  </div>
                </div>
              )}

              {/* Stage confirmation prompt */}
              {comparison && !showStageConfirm && (
                <div style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 8, padding: '0.75rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem' }}>{t('progress.doesFarmLookLike')} <strong>{STAGE_LABELS[comparison.expectedStage]}</strong> {t('progress.stageLabel')}</span>
                  <button className="btn btn-sm btn-outline" onClick={() => { setStageForm({ confirmedStage: comparison.expectedStage, note: '' }); openForm(setShowStageConfirm); }}>{t('progress.confirmStage')}</button>
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
                const label = isHigh ? t('progress.strong') : isMed ? t('progress.moderate') : t('progress.needsAttention');
                const FLAG_LABELS = {
                  burst_submissions: t('flag.burstSubmissions'),
                  update_gap_detected: t('flag.updateGap'),
                  no_updates_logged: t('flag.noUpdates'),
                  stage_regression: t('flag.stageRegression'),
                  impossible_fast_progression: t('flag.fastProgression'),
                  high_stage_mismatch: t('flag.highStageMismatch'),
                  entries_before_planting: t('flag.entriesBeforePlanting'),
                  future_dated_entries: t('flag.futureDatedEntries'),
                  harvest_too_early: t('flag.harvestTooEarly'),
                  implausible_yield: t('flag.implausibleYield'),
                  very_low_yield: t('flag.veryLowYield'),
                  condition_rapid_recovery: t('flag.conditionRapidRecovery'),
                  advice_always_yes: t('flag.adviceAlwaysYes'),
                  advice_never_followed: t('flag.adviceNeverFollowed'),
                  crop_failure_reported: t('flag.cropFailure'),
                  partial_harvest_reported: t('flag.partialHarvest'),
                  season_abandoned: t('flag.seasonAbandoned'),
                  harvest_image_too_early: t('flag.harvestImageTooEarly'),
                  early_image_in_post_harvest: t('flag.earlyImagePostHarvest'),
                  image_stage_incoherent: t('flag.imageStageIncoherent'),
                };
                return (
                  <div style={{ border: `1px solid ${borderColor}`, background: bg, borderRadius: 8, marginBottom: '0.75rem', overflow: 'hidden' }}>
                    <div style={{ padding: '0.5rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{t('progress.dataQuality')}</strong>{' '}
                        <span style={{ color: labelColor, fontWeight: 600 }}>{label}</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#A1A1AA' }}>
                          — {t('progress.howConsistent')}
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
                            {t('progress.tipImprove')}
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
                    {t('progress.harvestOverdue', { days: daysOverdue, s: daysOverdue !== 1 ? 's' : '' })}
                  </div>
                );
                return null;
              })()}

              {/* Missing update prompt */}
              {activeSeason.lastActivityDate && (() => {
                const daysSince = Math.floor((Date.now() - new Date(activeSeason.lastActivityDate)) / 86400000);
                if (daysSince >= 14) return (
                  <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '0.6rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
                    {t('progress.missingUpdateDays', { days: daysSince })}
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
                <span style={{ fontSize: '1.3rem' }}>📝</span> {t('progress.addUpdate')}
              </button>

              {/* Detailed action buttons — secondary */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm btn-outline" onClick={() => openForm(setShowProgressForm)}>{t('progress.logActivity')}</button>
                <button className="btn btn-sm btn-outline" onClick={() => openForm(setShowConditionForm)}>{t('progress.updateCondition')}</button>
                <button className="btn btn-sm btn-outline" style={{ borderColor: '#22C55E', color: '#22C55E' }} onClick={() => openForm(setShowImageForm)}>{t('progress.addPhoto')}</button>
                <button className="btn btn-sm btn-outline" style={{ borderColor: '#ea580c', color: '#ea580c' }} onClick={() => openForm(setShowHarvestForm)}>{t('progress.submitHarvestReport')}</button>
              </div>

              {/* Edge-case flags */}
              {!activeSeason.cropFailureReported && !activeSeason.partialHarvest && (
                <div style={{ marginTop: '0.5rem' }}>
                  {!confirmCropFailure ? (
                    <button className="btn btn-sm btn-outline-danger" style={{ fontSize: '0.75rem' }} onClick={() => setConfirmCropFailure(true)}>
                      {t('progress.reportCropFailure')}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--danger-light)', borderRadius: 6, fontSize: '0.85rem', color: 'var(--danger)' }}>
                      <span>{t('progress.confirmCropFailure')}</span>
                      <button className="btn btn-sm btn-outline-danger" style={{ padding: '0.4rem 0.75rem' }} onClick={() => handleEdgeCase('cropFailureReported')}>{t('progress.yesReport')}</button>
                      <button className="btn btn-sm btn-outline" style={{ padding: '0.4rem 0.75rem' }} onClick={() => setConfirmCropFailure(false)}>{t('common.cancel')}</button>
                    </div>
                  )}
                </div>
              )}
              {activeSeason.cropFailureReported && (
                <div className="alert-inline alert-inline-danger" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  {t('progress.cropFailureReported')}
                </div>
              )}
            </div>
          </div>

          {/* ─── Stage Confirmation Form ───────────── */}
          {showStageConfirm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">{t('progress.confirmGrowthStage')}</div>
              <div className="card-body">
                <form onSubmit={handleStageConfirm}>
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  <p style={{ fontSize: '0.875rem', color: '#FFFFFF', margin: '0 0 0.5rem' }}>
                    {t('progress.weExpectCropAt')} <strong style={{ color: STAGE_COLORS[comparison?.expectedStage] }}>{STAGE_LABELS[comparison?.expectedStage]}</strong>
                  </p>
                  <p style={{ fontSize: '0.82rem', color: '#A1A1AA', margin: '0 0 0.75rem' }}>
                    {t('progress.whatStageActually')}
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
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting || !stageForm.confirmedStage}>{submitting ? t('common.saving') : t('progress.confirmStage')}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowStageConfirm(false)}>{t('common.cancel')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Progress Entry Form ───────────────── */}
          {showProgressForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">{t('progress.logActivity')}</div>
              <div className="card-body">
                <form onSubmit={handleLogProgress}>
                  {progressDraftRestored && (
                    <div style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 6, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#0EA5E9', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('progress.draftRestored')}</span>
                      <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0EA5E9', fontSize: '0.8rem', textDecoration: 'underline', padding: 0 }} onClick={() => { clearProgressDraft(); setProgressForm(PROGRESS_DRAFT_INITIAL); }}>{t('common.clear')}</button>
                    </div>
                  )}
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  {/* Required fields first */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <TapSelector
                      label={t('progress.activityType') + ' *'}
                      options={ACTIVITY_OPTIONS}
                      value={progressForm.activityType}
                      onChange={(v) => setProgressForm(f => ({ ...f, activityType: v }))}
                      columns={3}
                      required
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">{t('progress.date')}</label>
                      <input className="form-input" type="date" value={progressForm.entryDate} onChange={e => setProgressForm(f => ({ ...f, entryDate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">{t('progress.notes')} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({t('progress.optional')})</span></label>
                      <textarea className="form-input" rows={2} placeholder={t('progress.whatDidYouDo')} value={progressForm.description} onChange={e => setProgressForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                  {/* Optional details — collapsed */}
                  <details style={{ marginTop: '0.5rem' }}>
                    <summary style={{ fontSize: '0.82rem', color: '#A1A1AA', cursor: 'pointer', padding: '0.4rem 0', minHeight: '44px', display: 'flex', alignItems: 'center' }}>
                      {t('progress.moreDetails')}
                    </summary>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                      <div>
                        <label className="form-label">{t('progress.quantity')} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({t('progress.optional')})</span></label>
                        <input className="form-input" type="number" step="0.1" inputMode="decimal" value={progressForm.quantity} onChange={e => setProgressForm(f => ({ ...f, quantity: e.target.value }))} />
                      </div>
                      <div>
                        <label className="form-label">{t('progress.unit')} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({t('progress.optional')})</span></label>
                        <input className="form-input" value={progressForm.unit} onChange={e => setProgressForm(f => ({ ...f, unit: e.target.value }))} placeholder={t('progress.kgBagsLitres')} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <TapSelector
                          label={t('progress.followedAdvice')}
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
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>{submitting ? t('common.saving') : t('progress.saveActivity')}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowProgressForm(false)}>{t('common.cancel')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Condition Update Form ────────────── */}
          {showConditionForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">{t('progress.updateCropCondition')}</div>
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
                        {c === 'good' ? t('progress.good') : c === 'average' ? t('progress.average') : t('progress.poor')}
                      </label>
                    ))}
                  </div>
                  <textarea className="form-input" rows={2} placeholder={t('progress.conditionNotes')} value={condForm.conditionNotes} onChange={e => setCondForm(f => ({ ...f, conditionNotes: e.target.value }))} />
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting || !condForm.cropCondition}>{t('common.save')}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowConditionForm(false)}>{t('common.cancel')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Harvest Report Form ──────────────── */}
          {showHarvestForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">{t('progress.submitHarvestReport')}</div>
              <div className="card-body">
                <p style={{ fontSize: '0.85rem', color: '#A1A1AA', margin: '0 0 0.75rem' }}>
                  {t('progress.thisWillCloseSeason')}
                  {activeSeason.cropFailureReported && (
                    <span style={{ display: 'block', marginTop: '0.25rem', color: '#b45309', fontWeight: 500 }}>
                      {t('progress.cropFailureRecorded')}
                    </span>
                  )}
                </p>
                <form onSubmit={handleHarvest}>
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">{t('progress.totalHarvestKg') + ' *'}</label>
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
                      <label className="form-label">{t('progress.salesAmount')}</label>
                      <input className="form-input" type="number" step="0.01" value={harvestForm.salesAmount} onChange={e => setHarvestForm(f => ({ ...f, salesAmount: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">{t('progress.notes')} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({t('progress.optional')})</span></label>
                      <textarea className="form-input" rows={2} placeholder={t('progress.qualityNotes')} value={harvestForm.notes} onChange={e => setHarvestForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>{submitting ? t('progress.submitting') : t('progress.submitHarvestReport')}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowHarvestForm(false)}>{t('common.cancel')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Image Upload Form ──────────────── */}
          {showImageForm && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">{t('progress.addProgressPhoto')}</div>
              <div className="card-body">
                <form onSubmit={handleImageUpload}>
                  {formError && <InlineAlert variant="danger" onDismiss={() => setFormError('')}>{formError}</InlineAlert>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">{t('progress.imageUrl') + ' *'}</label>
                      <input className="form-input" required value={imageForm.imageUrl} onChange={e => setImageForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <TapSelector
                        label={t('progress.growthStage')}
                        options={IMAGE_STAGE_OPTIONS}
                        value={imageForm.imageStage}
                        onChange={(v) => setImageForm(f => ({ ...f, imageStage: v }))}
                        columns={3}
                        compact
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">{t('progress.description')}</label>
                      <input className="form-input" value={imageForm.description} onChange={e => setImageForm(f => ({ ...f, description: e.target.value }))} placeholder={t('progress.whatPhotoShow')} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">{t('progress.photoLocation')} <span style={{ color: '#71717A', fontWeight: 400 }}>{t('progress.optional')}</span></label>
                      <LocationDetect
                        compact
                        label={t('progress.tagWithLocation')}
                        onDetected={(loc) => setImageForm(f => ({ ...f, latitude: loc.latitude, longitude: loc.longitude }))}
                      />
                      {imageForm.latitude && (
                        <div style={{ fontSize: '0.72rem', color: '#22C55E', marginTop: '0.25rem' }}>
                          {t('location.capturedCheck')}
                          <span onClick={() => setImageForm(f => ({ ...f, latitude: null, longitude: null }))} style={{ color: '#71717A', cursor: 'pointer', marginLeft: '0.5rem' }}>{t('common.clear')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-sm btn-primary" type="submit" disabled={submitting}>{submitting ? t('common.saving') : t('progress.savePhoto')}</button>
                    <button className="btn btn-sm btn-outline" type="button" onClick={() => setShowImageForm(false)}>{t('common.cancel')}</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ─── Comparison Dimensions ────────────── */}
          {comparison?.dimensions && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">{t('progress.progressComparison')}</div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('progress.dimension')}</th><th>{t('progress.status')}</th><th>{t('progress.details')}</th></tr></thead>
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
              <div className="card-header">{t('progress.recentProgressEntries')}</div>
              <div className="card-body" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('progress.date')}</th><th>{t('progress.type')}</th><th>{t('progress.activity')}</th><th>{t('progress.condition')}</th><th>{t('progress.advice')}</th></tr></thead>
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
          <div className="card-header">{t('progress.pastSeasons')}</div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('progress.crop')}</th><th>{t('progress.planted')}</th><th>{t('progress.status')}</th><th>{t('progress.harvest')}</th><th>{t('progress.score')}</th>
                    {isAdmin && <th>{t('progress.admin')}</th>}
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
                            {t('progress.reopen')}
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

      {/* New season button at bottom for completed seasons (lifecycle-gated) */}
      {!activeSeason && seasons.length > 0 && !showSeasonForm && setupComplete && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-primary" onClick={openSeasonForm}>{t('progress.startNewSeason')}</button>
        </div>
      )}
    </div>
  );
}

// ─── SoD: Reopen Season Modal ────────────────────────────────────────────────
// Two-phase: (1) create ApprovalRequest, (2) execute reopen with approved ID
function ReopenSeasonModal({ season, onClose, onReopened }) {
  const { t } = useTranslation();
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
          {t('reopen.title')} — {getCropLabel(season.cropType)}
          <button className="btn btn-outline btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#F59E0B', marginBottom: '1rem' }}>
            <strong>{t('reopen.sodRequired')}.</strong> {t('reopen.sodExplain')}
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
              1. {t('reopen.createRequest')}
            </button>
            <button
              type="button"
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem', fontWeight: mode === 'execute' ? 700 : 400, background: mode === 'execute' ? '#22C55E' : '#162033', color: mode === 'execute' ? '#FFFFFF' : '#FFFFFF', border: 'none', cursor: 'pointer', minHeight: '36px' }}
              onClick={() => { setMode('execute'); setError(''); }}
            >
              2. {t('reopen.executeHaveId')}
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
