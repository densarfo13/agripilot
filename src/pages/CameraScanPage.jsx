/**
 * CameraScanPage — farmer-facing crop scan flow.
 *
 * Phases:
 *   ENTRY   → tap "Scan your crop" (opens device camera)
 *   LOADING → "Analyzing your crop..."
 *   RESULT  → action card (title, why, steps, Mark done / Add to my tasks / Later)
 *
 * The file input carries `capture="environment"` so mobile browsers
 * open the rear camera directly, no extra permissions dance. On desktop
 * it falls back to the normal file picker.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { diagnoseCropImage, DIAGNOSIS_CATEGORY, SCAN_FAILED_ACTION } from '../engine/cameraDiagnosis.js';
import { addScanEntry, getScanHistory } from '../services/cameraDiagnosisHistory.js';
import { addTemporaryTask } from '../services/temporaryTasks.js';
import { maybeScheduleFollowup } from '../services/cameraFollowup.js';

const PHASE = { ENTRY: 'entry', LOADING: 'loading', RESULT: 'result' };

export default function CameraScanPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [phase, setPhase] = useState(PHASE.ENTRY);
  const [action, setAction] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [taskAdded, setTaskAdded] = useState(false);
  const [history, setHistory] = useState(() => getScanHistory());

  useEffect(() => {
    safeTrackEvent('camera.scan_shown', {});
    // Spec §7: opportunistically drop a recheck task when a scan from
    // yesterday is still open. Pure no-op if nothing qualifies.
    try {
      const recheck = maybeScheduleFollowup();
      if (recheck) safeTrackEvent('camera.followup_scheduled', { issueType: recheck.issueType });
    } catch { /* ignore */ }
  }, []);

  function triggerPicker() {
    fileRef.current?.click();
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhase(PHASE.LOADING);
    setTaskAdded(false);
    safeTrackEvent('camera.scan_started', { size: file.size });

    // Read thumbnail for UI + optional history save
    const thumbUrl = await fileToThumb(file);
    setThumb(thumbUrl);

    const diagnosis = await diagnoseCropImage(file);
    const a = diagnosis.action || SCAN_FAILED_ACTION;
    setAction(a);

    addScanEntry({
      category: a.category || 'scan_failed',
      titleKey: a.titleKey,
      thumbDataUrl: thumbUrl,
      taskAdded: false,
    });
    setHistory(getScanHistory());
    safeTrackEvent('camera.scan_result', { category: a.category });
    setPhase(PHASE.RESULT);

    // Clear the input so the same photo can be re-scanned
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleAddToTasks() {
    if (!action) return;
    addTemporaryTask({
      source: 'camera',
      issueType: action.issueType,
      followupTaskType: action.followupTaskType || null,
      titleKey: action.titleKey,
      whyKey: action.whyKey,
      stepsKey: action.stepsKey,
      lookForKey: action.lookForKey,
      tipKey: action.tipKey,
      urgency: action.urgency || 'today',
      priority: action.priority || 'high',
      icon: action.icon,
      iconBg: action.iconBg,
      expiresInHours: 48,
    });
    setTaskAdded(true);
    safeTrackEvent('camera.scan_task_added', {
      category: action.category, issueType: action.issueType,
    });
  }

  function handleMarkDone() {
    safeTrackEvent('camera.scan_marked_done', { category: action?.category });
    resetFlow();
  }

  function handleLater() {
    safeTrackEvent('camera.scan_later', { category: action?.category });
    resetFlow();
  }

  function resetFlow() {
    setPhase(PHASE.ENTRY);
    setAction(null);
    setThumb(null);
    setTaskAdded(false);
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <button type="button" onClick={() => navigate(-1)} style={S.backBtn}>
          {'\u2190'} {t('common.back')}
        </button>

        <h1 style={S.title}>{t('camera.pageTitle')}</h1>

        {phase === PHASE.ENTRY && (
          <EntryPhase t={t} onScan={triggerPicker} history={history} />
        )}

        {phase === PHASE.LOADING && (
          <LoadingPhase t={t} thumb={thumb} />
        )}

        {phase === PHASE.RESULT && action && (
          <ResultPhase
            t={t} action={action} thumb={thumb} taskAdded={taskAdded}
            onAddToTasks={handleAddToTasks}
            onMarkDone={handleMarkDone}
            onLater={handleLater}
            onRescan={triggerPicker}
          />
        )}

        {/* Hidden file input — opens rear camera on mobile */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFile}
          style={{ display: 'none' }}
          data-testid="camera-file-input"
        />
      </div>
    </div>
  );
}

// ─── Phases ────────────────────────────────────────────────

function EntryPhase({ t, onScan, history }) {
  return (
    <>
      <div style={S.card}>
        <span style={S.bigIcon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
        <h2 style={S.h2}>{t('camera.entry.title')}</h2>
        <p style={S.muted}>{t('camera.entry.body')}</p>
        <button type="button" onClick={onScan} style={S.primaryBtn} data-testid="camera-start">
          {t('camera.entry.cta')}
        </button>
      </div>

      {history.length > 0 && (
        <div style={S.card}>
          <h3 style={S.h3}>{t('camera.history.title')}</h3>
          <div style={S.historyList}>
            {history.map(entry => (
              <div key={entry.id} style={S.historyRow}>
                {entry.thumbDataUrl ? (
                  <img src={entry.thumbDataUrl} alt="" style={S.historyThumb} />
                ) : (
                  <div style={{ ...S.historyThumb, background: 'rgba(255,255,255,0.06)' }} />
                )}
                <div style={S.historyInfo}>
                  <div style={S.historyTitle}>{t(entry.titleKey)}</div>
                  <div style={S.historyTime}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function LoadingPhase({ t, thumb }) {
  return (
    <div style={S.card}>
      <div style={S.loadingWrap}>
        {thumb && <img src={thumb} alt="" style={S.thumbLarge} />}
        <div style={S.spinner} />
        <span style={S.loadingLabel}>{t('camera.loading')}</span>
      </div>
    </div>
  );
}

function ResultPhase({ t, action, thumb, taskAdded, onAddToTasks, onMarkDone, onLater, onRescan }) {
  const isHealthy = action.category === DIAGNOSIS_CATEGORY.NO_ISSUE_DETECTED;
  const isFailure = !!action.isFailure;
  const steps = action.stepsKey ? t(action.stepsKey).split('|').map(s => s.trim()).filter(Boolean) : [];
  const lookForItems = action.lookForKey ? t(action.lookForKey).split('|').map(s => s.trim()).filter(Boolean) : [];
  const primaryCtaKey = action.primaryCtaKey || (isHealthy ? 'camera.cta.continueCare' : 'camera.cta.addToToday');

  return (
    <>
      <div style={S.card}>
        <div style={S.resultHeader}>
          {thumb && <img src={thumb} alt="" style={S.thumbResult} />}
          <div style={{ ...S.iconWrap, background: action.iconBg || 'rgba(255,255,255,0.06)' }}>
            <span style={S.iconLarge}>{action.icon}</span>
          </div>
        </div>

        <div style={S.todayLabel}>{t('camera.result.todaysAction')}</div>
        <h2 style={S.resultTitle}>{t(action.titleKey)}</h2>

        {action.whyKey && (
          <div style={S.whySection}>
            <span style={S.whyLabel}>{t('camera.result.why')}</span>
            <span style={S.whyText}>{t(action.whyKey)}</span>
          </div>
        )}

        {lookForItems.length > 0 && (
          <div style={S.stepsSection}>
            <span style={S.whyLabel}>
              {isHealthy ? t('camera.result.whatToDo') : t('camera.result.lookFor')}
            </span>
            <ul style={S.lookForList}>
              {lookForItems.map((item, i) => (
                <li key={i} style={S.stepItem}>{item}</li>
              ))}
            </ul>
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

        {action.tipKey && (
          <div style={S.tipRow}>
            <span style={S.tipIcon}>{'\uD83D\uDCA1'}</span>
            <span style={S.tipText}>{t(action.tipKey)}</span>
          </div>
        )}

        {taskAdded && (
          <div style={S.addedBadge}>{'\u2714\uFE0F'} {t('camera.result.taskAdded')}</div>
        )}

        {/* CTAs */}
        {isHealthy ? (
          <button type="button" onClick={onMarkDone} style={S.primaryBtn}>
            {t(primaryCtaKey)}
          </button>
        ) : (
          <>
            {!taskAdded && !isFailure && (
              <button type="button" onClick={onAddToTasks} style={S.primaryBtn} data-testid="camera-add-task">
                {t(primaryCtaKey)}
              </button>
            )}
            <div style={S.actionRow}>
              <button type="button" onClick={onMarkDone} style={S.secondaryBtn}>
                {t('camera.result.markDone')}
              </button>
              <button type="button" onClick={onLater} style={S.secondaryBtn}>
                {t('camera.result.later')}
              </button>
            </div>
          </>
        )}

        <button type="button" onClick={onRescan} style={S.ghostBtn}>
          {'\uD83D\uDCF7'} {t('camera.result.rescan')}
        </button>
      </div>
    </>
  );
}

// ─── Thumbnail helper ──────────────────────────────────────
async function fileToThumb(file, maxDim = 320) {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/jpeg', 0.6);
  } catch {
    return null;
  }
}

// ─── Styles ────────────────────────────────────────────────
const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', color: '#EAF2FF', padding: '1rem 0 3rem' },
  container: { maxWidth: '28rem', margin: '0 auto', padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  backBtn: { alignSelf: 'flex-start', background: 'none', border: 'none', color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' },
  title: { fontSize: '1.375rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  card: { borderRadius: '20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  bigIcon: { fontSize: '3rem', lineHeight: 1, textAlign: 'center' },
  h2: { fontSize: '1.125rem', fontWeight: 800, margin: 0, color: '#EAF2FF', textAlign: 'center' },
  h3: { fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: '#EAF2FF' },
  muted: { fontSize: '0.875rem', color: '#9FB3C8', margin: 0, textAlign: 'center', lineHeight: 1.5 },

  primaryBtn: { padding: '1rem', borderRadius: '16px', background: '#22C55E', color: '#fff', border: 'none', fontSize: '1.0625rem', fontWeight: 800, cursor: 'pointer', minHeight: '56px', boxShadow: '0 10px 24px rgba(34,197,94,0.22)' },
  secondaryBtn: { flex: 1, padding: '0.875rem 1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#EAF2FF', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', minHeight: '48px' },
  ghostBtn: { padding: '0.625rem', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.08)', background: 'transparent', color: '#9FB3C8', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginTop: '0.25rem' },
  actionRow: { display: 'flex', gap: '0.625rem' },

  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.875rem', padding: '1.25rem' },
  spinner: { width: '2.5rem', height: '2.5rem', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: '#22C55E', borderRadius: '50%', animation: 'farroway-spin 0.8s linear infinite' },
  loadingLabel: { fontSize: '0.9375rem', color: '#9FB3C8', fontWeight: 600 },
  thumbLarge: { width: '120px', height: '120px', borderRadius: '12px', objectFit: 'cover', marginBottom: '0.25rem' },

  resultHeader: { display: 'flex', alignItems: 'center', gap: '0.875rem', justifyContent: 'center' },
  thumbResult: { width: '72px', height: '72px', borderRadius: '12px', objectFit: 'cover' },
  iconWrap: { width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconLarge: { fontSize: '2rem', lineHeight: 1 },
  todayLabel: { fontSize: '0.6875rem', fontWeight: 800, color: '#6F8299', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', marginTop: '0.5rem' },
  resultTitle: { fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#EAF2FF', textAlign: 'center', lineHeight: 1.3 },

  whySection: { display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' },
  whyLabel: { fontSize: '0.6875rem', fontWeight: 800, color: '#6F8299', textTransform: 'uppercase', letterSpacing: '0.06em' },
  whyText: { fontSize: '0.875rem', color: '#EAF2FF', lineHeight: 1.4, fontWeight: 500 },

  stepsSection: { display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' },
  stepsList: { margin: '0.375rem 0 0', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' },
  lookForList: { margin: '0.375rem 0 0', paddingLeft: '1.125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  stepItem: { fontSize: '0.875rem', color: '#EAF2FF', lineHeight: 1.4 },
  tipRow: {
    display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
    padding: '0.625rem 0.75rem', borderRadius: '10px',
    background: 'rgba(251,191,36,0.06)',
    border: '1px solid rgba(251,191,36,0.18)',
  },
  tipIcon: { fontSize: '0.875rem', flexShrink: 0, lineHeight: 1.4 },
  tipText: { fontSize: '0.8125rem', color: '#FCD34D', lineHeight: 1.4, fontWeight: 500 },

  addedBadge: { display: 'inline-block', alignSelf: 'center', padding: '0.375rem 0.75rem', borderRadius: '999px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.28)', color: '#86EFAC', fontSize: '0.75rem', fontWeight: 700 },

  historyList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  historyRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)' },
  historyThumb: { width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 },
  historyInfo: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: '0.8125rem', fontWeight: 700, color: '#EAF2FF' },
  historyTime: { fontSize: '0.6875rem', color: '#6F8299', marginTop: '0.125rem' },
};
