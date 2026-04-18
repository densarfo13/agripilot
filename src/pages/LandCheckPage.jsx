/**
 * LandCheckPage — the guided land-check flow (spec §3).
 *
 * Phases:
 *   ENTRY     — short reassurance + Begin CTA
 *   STEPS     — 6 tap-first questions (+ optional photo / area)
 *   RESULT    — single land-aware task card with Save / Fix / Later CTAs
 *
 * Answers persist to sessionStorage on every step so a refresh or
 * network loss doesn't lose progress. On Save, the land profile is
 * updated and — if the rule engine produced a task — it's pushed
 * into the same temporaryTasks store camera uses, so Home surfaces
 * it as a land_check hero automatically.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import { safeTrackEvent } from '../lib/analytics.js';
import {
  saveFieldProfile, getActiveFieldProfile,
  saveLandCheckDraft, loadLandCheckDraft, clearLandCheckDraft,
  SOIL_MOISTURE, SLOPE, DRAINAGE, AREA_UNIT,
} from '../services/landProfile.js';
import { resolveLandTask } from '../engine/landAwareRules.js';
import { addTemporaryTask } from '../services/temporaryTasks.js';

const PHASE = { ENTRY: 'entry', STEPS: 'steps', RESULT: 'result' };

// Six core question steps + optional extras.
const STEPS = [
  {
    key: 'cleared',
    questionKey: 'land.q.cleared',
    options: [
      { value: true,  labelKey: 'common.yes' },
      { value: false, labelKey: 'common.no' },
    ],
  },
  {
    key: 'weedsPresent',
    questionKey: 'land.q.weeds',
    options: [
      { value: true,  labelKey: 'common.yes' },
      { value: false, labelKey: 'common.no' },
    ],
  },
  {
    key: 'soilMoistureState',
    questionKey: 'land.q.soilMoisture',
    options: [
      { value: SOIL_MOISTURE.DRY,     labelKey: 'land.soil.dry' },
      { value: SOIL_MOISTURE.MOIST,   labelKey: 'land.soil.moist' },
      { value: SOIL_MOISTURE.WET,     labelKey: 'land.soil.wet' },
      { value: SOIL_MOISTURE.UNKNOWN, labelKey: 'land.soil.unknown' },
    ],
  },
  {
    key: 'drainage',
    questionKey: 'land.q.drainage',
    options: [
      { value: DRAINAGE.POOR,    labelKey: 'common.yes' },          // "Yes, water stays" → poor
      { value: DRAINAGE.GOOD,    labelKey: 'common.no' },
      { value: DRAINAGE.UNKNOWN, labelKey: 'land.soil.unknown' },
    ],
  },
  {
    key: 'slope',
    questionKey: 'land.q.slope',
    options: [
      { value: SLOPE.FLAT,    labelKey: 'land.slope.flat' },
      { value: SLOPE.GENTLE,  labelKey: 'land.slope.gentle' },
      { value: SLOPE.STEEP,   labelKey: 'land.slope.steep' },
      { value: SLOPE.UNKNOWN, labelKey: 'land.slope.unknown' },
    ],
  },
  {
    key: 'irrigationAvailable',
    questionKey: 'land.q.irrigation',
    options: [
      { value: true,  labelKey: 'common.yes' },
      { value: false, labelKey: 'common.no' },
    ],
  },
];

export default function LandCheckPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { profile } = useProfile();
  const { weather } = useWeather() || {};

  const [phase, setPhase] = useState(PHASE.ENTRY);
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState(() => ({ ...(getActiveFieldProfile() || {}) }));
  const [photoUri, setPhotoUri] = useState(null);
  const [approximateArea, setApproximateArea] = useState('');
  const [areaUnit, setAreaUnit] = useState(AREA_UNIT.ACRE);
  const [resultTask, setResultTask] = useState(null);
  const [savedAsTask, setSavedAsTask] = useState(false);
  const photoRef = useRef(null);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadLandCheckDraft();
    if (draft) {
      setAnswers(draft.answers || {});
      setStepIdx(Math.min(Math.max(draft.stepIdx || 0, 0), STEPS.length - 1));
      setApproximateArea(draft.approximateArea || '');
      setAreaUnit(draft.areaUnit || AREA_UNIT.ACRE);
      if (draft.photoUri) setPhotoUri(draft.photoUri);
    }
    safeTrackEvent('land.check_shown', {});
  }, []);

  function persistDraft(next) {
    saveLandCheckDraft({
      answers: next.answers ?? answers,
      stepIdx: next.stepIdx ?? stepIdx,
      approximateArea: next.approximateArea ?? approximateArea,
      areaUnit: next.areaUnit ?? areaUnit,
      photoUri: next.photoUri ?? photoUri,
    });
  }

  function begin() {
    setPhase(PHASE.STEPS);
    safeTrackEvent('land.check_started', {});
  }

  function answerStep(value) {
    const step = STEPS[stepIdx];
    const nextAnswers = { ...answers, [step.key]: value };
    const nextStepIdx = stepIdx + 1;
    setAnswers(nextAnswers);
    if (nextStepIdx >= STEPS.length) {
      finalize(nextAnswers);
    } else {
      setStepIdx(nextStepIdx);
      persistDraft({ answers: nextAnswers, stepIdx: nextStepIdx });
    }
  }

  function goBack() {
    if (stepIdx > 0) {
      setStepIdx(stepIdx - 1);
      persistDraft({ stepIdx: stepIdx - 1 });
    } else {
      setPhase(PHASE.ENTRY);
    }
  }

  function handlePhotoPicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Downscale to a thumbnail so we don't blow localStorage quotas
    (async () => {
      const thumb = await fileToThumb(file, 480).catch(() => null);
      setPhotoUri(thumb);
      persistDraft({ photoUri: thumb });
    })();
  }

  function captureGps() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setAnswers((a) => {
        const next = { ...a, coordinates: coords };
        persistDraft({ answers: next });
        return next;
      });
      safeTrackEvent('land.gps_captured', {});
    }, () => { /* permission denied — silent */ });
  }

  function finalize(finalAnswers) {
    // Persist the land profile
    const cropStage = profile?.cropStage || 'land_preparation';
    const areaNum = parseFloat(String(approximateArea).replace(',', '.'));
    const savedProfile = saveFieldProfile({
      farmerId: profile?.id || null,
      countryCode: profile?.country || null,
      regionOrState: profile?.region || profile?.regionOrState || null,
      coordinates: finalAnswers.coordinates || undefined,
      approximateArea: Number.isFinite(areaNum) && areaNum > 0 ? areaNum : undefined,
      areaUnit: Number.isFinite(areaNum) && areaNum > 0 ? areaUnit : undefined,
      cleared: finalAnswers.cleared,
      weedsPresent: finalAnswers.weedsPresent,
      soilMoistureState: finalAnswers.soilMoistureState,
      slope: finalAnswers.slope,
      drainage: finalAnswers.drainage,
      irrigationAvailable: finalAnswers.irrigationAvailable,
      landPhotoUri: photoUri || undefined,
      lastLandCheckAt: Date.now(),
    });

    const task = resolveLandTask({
      land: savedProfile,
      cropStage,
      weather: weather ? { rainExpected24h: !!weather.rainTodayLikely || !!weather.rainTomorrowLikely } : null,
    });
    setResultTask(task);
    setPhase(PHASE.RESULT);
    clearLandCheckDraft();
    safeTrackEvent('land.check_completed', {
      hasTask: !!task,
      taskType: task?.type || null,
    });
  }

  function handleSaveTask() {
    if (!resultTask) { navigate('/dashboard'); return; }
    addTemporaryTask({
      source: 'land_check',
      issueType: resultTask.type,
      titleKey: resultTask.titleKey,
      whyKey: resultTask.whyKey,
      stepsKey: resultTask.stepsKey,
      tipKey: resultTask.tipKey,
      urgency: resultTask.urgency || 'today',
      priority: resultTask.priority || 'high',
      icon: resultTask.icon,
      expiresInHours: 48,
    });
    setSavedAsTask(true);
    safeTrackEvent('land.task_saved', { taskType: resultTask.type });
    // Home listens for this event to repaint without a reload.
    try { window.dispatchEvent(new CustomEvent('farroway:camera_task_changed')); } catch {}
    setTimeout(() => navigate('/dashboard'), 900);
  }

  function handleLater() {
    safeTrackEvent('land.task_later', {});
    navigate('/dashboard');
  }

  // ─── Render ─────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.container}>
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>

        {phase === PHASE.ENTRY && (
          <EntryPhase t={t} onBegin={begin} />
        )}

        {phase === PHASE.STEPS && (
          <StepsPhase
            t={t}
            step={STEPS[stepIdx]}
            stepIdx={stepIdx}
            total={STEPS.length}
            answers={answers}
            onPick={answerStep}
            onBack={goBack}
            photoUri={photoUri}
            onPickPhoto={() => photoRef.current?.click()}
            onCaptureGps={captureGps}
            approximateArea={approximateArea}
            onAreaChange={(v) => { setApproximateArea(v); persistDraft({ approximateArea: v }); }}
            areaUnit={areaUnit}
            onAreaUnitChange={(u) => { setAreaUnit(u); persistDraft({ areaUnit: u }); }}
            coordinates={answers.coordinates}
          />
        )}

        {phase === PHASE.RESULT && (
          <ResultPhase
            t={t}
            task={resultTask}
            savedAsTask={savedAsTask}
            onSave={handleSaveTask}
            onLater={handleLater}
            onRestart={() => { setPhase(PHASE.ENTRY); setStepIdx(0); }}
          />
        )}

        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoPicked}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}

// ─── Phases ─────────────────────────────────────────────────

function EntryPhase({ t, onBegin }) {
  return (
    <div style={S.card}>
      <span style={S.heroIcon} aria-hidden="true">{'\uD83C\uDF3E'}</span>
      <h1 style={S.title}>{t('land.entry.title')}</h1>
      <p style={S.subtitle}>{t('land.entry.body')}</p>
      <button type="button" onClick={onBegin} style={S.primaryBtn} data-testid="land-begin">
        {t('land.entry.cta')}
      </button>
    </div>
  );
}

function StepsPhase({
  t, step, stepIdx, total, answers, onPick, onBack,
  photoUri, onPickPhoto, onCaptureGps,
  approximateArea, onAreaChange,
  areaUnit, onAreaUnitChange,
  coordinates,
}) {
  return (
    <div style={S.card}>
      <div style={S.stepBadge}>{stepIdx + 1} / {total}</div>
      <h2 style={S.question}>{t(step.questionKey)}</h2>
      <div style={S.options}>
        {step.options.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onPick(opt.value)}
            style={{
              ...S.optionBtn,
              ...(answers[step.key] === opt.value ? S.optionSelected : {}),
            }}
            data-testid={`land-option-${String(opt.value)}`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      {/* Optional extras, surfaced only on the last step */}
      {stepIdx === total - 1 && (
        <div style={S.extras}>
          <div style={S.extrasLabel}>{t('land.optional')}</div>

          <button type="button" onClick={onPickPhoto} style={S.extraBtn}>
            {'\uD83D\uDCF7'} {photoUri ? t('land.retakePhoto') : t('land.addPhoto')}
          </button>
          {photoUri && <img src={photoUri} alt="" style={S.photoThumb} />}

          <button type="button" onClick={onCaptureGps} style={S.extraBtn}>
            {'\uD83D\uDCCD'} {coordinates ? t('land.gpsSaved') : t('land.saveGps')}
          </button>

          <div style={S.areaRow}>
            <input
              type="number"
              inputMode="decimal"
              value={approximateArea}
              onChange={(e) => onAreaChange(e.target.value)}
              placeholder={t('land.areaPlaceholder')}
              style={S.areaInput}
            />
            <button
              type="button"
              onClick={() => onAreaUnitChange(areaUnit === 'acre' ? 'hectare' : 'acre')}
              style={S.unitBtn}
            >
              {t(`land.unit.${areaUnit}`)}
            </button>
          </div>
        </div>
      )}

      <button type="button" onClick={onBack} style={S.backInlineBtn}>
        {'\u2190'} {t('common.back')}
      </button>
    </div>
  );
}

function ResultPhase({ t, task, savedAsTask, onSave, onLater, onRestart }) {
  const steps = task?.stepsKey ? t(task.stepsKey).split('|').map(s => s.trim()).filter(Boolean) : [];
  return (
    <div style={S.card}>
      <div style={S.todayLabel}>{t('home.hero.todaysAction')}</div>

      {task ? (
        <>
          <h2 style={S.resultTitle}>{t(task.titleKey)}</h2>
          {task.whyKey && (
            <div style={S.whySection}>
              <span style={S.whyLabel}>{t('camera.result.why')}</span>
              <span style={S.whyText}>{t(task.whyKey)}</span>
            </div>
          )}
          {steps.length > 0 && (
            <div style={S.stepsSection}>
              <span style={S.whyLabel}>{t('camera.result.steps')}</span>
              <ol style={S.stepsList}>
                {steps.map((s, i) => <li key={i} style={S.stepItem}>{s}</li>)}
              </ol>
            </div>
          )}
          {task.tipKey && (
            <div style={S.tipRow}>
              <span style={S.tipIcon}>{'\uD83D\uDCA1'}</span>
              <span style={S.tipText}>{t(task.tipKey)}</span>
            </div>
          )}
          {savedAsTask ? (
            <div style={S.addedBadge}>{'\u2714\uFE0F'} {t('camera.result.taskAdded')}</div>
          ) : (
            <>
              <button type="button" onClick={onSave} style={S.primaryBtn} data-testid="land-save-task">
                {t('camera.result.addToTasks')}
              </button>
              <button type="button" onClick={onLater} style={S.secondaryBtn}>
                {t('camera.result.later')}
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <h2 style={S.resultTitle}>{t('land.result.noIssueTitle')}</h2>
          <p style={S.subtitle}>{t('land.result.noIssueBody')}</p>
          <button type="button" onClick={onLater} style={S.primaryBtn}>
            {t('common.continue')}
          </button>
        </>
      )}

      <button type="button" onClick={onRestart} style={S.ghostBtn}>
        {t('land.checkAgain')}
      </button>
    </div>
  );
}

// ─── Thumbnail helper (shared with camera page pattern) ───
async function fileToThumb(file, maxDim = 480) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i); i.onerror = reject; i.src = url;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale); const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  return canvas.toDataURL('image/jpeg', 0.6);
}

// ─── Styles ─────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', color: '#EAF2FF', padding: '1rem 0 3rem' },
  container: { maxWidth: '28rem', margin: '0 auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  backBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  card: { borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', animation: 'farroway-fade-in 0.25s ease-out' },
  heroIcon: { fontSize: '2.5rem', lineHeight: 1, textAlign: 'center' },
  title: { fontSize: '1.375rem', fontWeight: 800, margin: 0, color: '#EAF2FF', textAlign: 'center' },
  subtitle: { fontSize: '0.9375rem', color: '#9FB3C8', lineHeight: 1.45, textAlign: 'center', margin: 0 },
  stepBadge: { fontSize: '0.6875rem', fontWeight: 800, color: '#6F8299', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' },
  question: { fontSize: '1.125rem', fontWeight: 800, margin: '0.25rem 0 0.75rem', color: '#EAF2FF', textAlign: 'center' },
  options: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  optionBtn: { padding: '0.875rem 1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left', minHeight: '48px' },
  optionSelected: { background: 'rgba(34,197,94,0.1)', borderColor: '#22C55E', color: '#22C55E' },
  extras: { marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(255,255,255,0.06)' },
  extrasLabel: { fontSize: '0.6875rem', fontWeight: 800, color: '#6F8299', letterSpacing: '0.06em', textTransform: 'uppercase' },
  extraBtn: { padding: '0.625rem 0.875rem', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', background: 'transparent', color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer', textAlign: 'left' },
  photoThumb: { width: '96px', height: '96px', objectFit: 'cover', borderRadius: '10px', marginTop: '0.25rem' },
  areaRow: { display: 'flex', gap: '0.5rem', alignItems: 'stretch' },
  areaInput: { flex: 1, padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.875rem', outline: 'none' },
  unitBtn: { padding: '0.625rem 0.875rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' },
  backInlineBtn: { marginTop: '0.5rem', background: 'none', border: 'none', color: '#6F8299', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' },

  todayLabel: { fontSize: '0.6875rem', fontWeight: 800, color: '#6F8299', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'center' },
  resultTitle: { fontSize: '1.25rem', fontWeight: 800, color: '#EAF2FF', textAlign: 'center', margin: 0, lineHeight: 1.3 },
  whySection: { display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' },
  whyLabel: { fontSize: '0.6875rem', fontWeight: 800, color: '#6F8299', letterSpacing: '0.06em', textTransform: 'uppercase' },
  whyText: { fontSize: '0.875rem', color: '#EAF2FF', lineHeight: 1.4, fontWeight: 500 },
  stepsSection: { display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' },
  stepsList: { margin: '0.375rem 0 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  stepItem: { fontSize: '0.875rem', color: '#EAF2FF', lineHeight: 1.4 },
  tipRow: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.625rem 0.75rem', borderRadius: '10px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' },
  tipIcon: { fontSize: '0.875rem', flexShrink: 0, lineHeight: 1.4 },
  tipText: { fontSize: '0.8125rem', color: '#FCD34D', lineHeight: 1.4, fontWeight: 500 },

  primaryBtn: { padding: '1rem', borderRadius: '16px', background: '#22C55E', color: '#fff', border: 'none', fontSize: '1.0625rem', fontWeight: 800, cursor: 'pointer', minHeight: '56px', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  secondaryBtn: { padding: '0.875rem 1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px' },
  ghostBtn: { padding: '0.625rem', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', background: 'transparent', color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  addedBadge: { alignSelf: 'center', padding: '0.375rem 0.75rem', borderRadius: '999px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)', color: '#86EFAC', fontSize: '0.75rem', fontWeight: 700 },
};
