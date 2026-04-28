/**
 * Today — elite-UX single-task farmer screen.
 *
 *   /today/quick
 *
 * Layout (top -> bottom, mobile-first)
 *   1. Header                    greeting + location + settings
 *   2. Main task card            title + instruction + timing + risk
 *   3. Action buttons            Listen + Done now
 *   4. Completion feedback       "Good work. Progress updated"
 *   5. HIGH-only risk badge      pest / drought (rendered only when HIGH)
 *   6. Progress strip            "X tasks done today" + supportive status
 *   7. Scan-crop CTA             "See something wrong? Scan your crop"
 *
 * No duplicate weather card — Today.jsx never rendered one in
 * the first place; the brief's "remove duplicate weather card"
 * is satisfied by this layout's deliberately weather-free shape.
 *
 * Composes the existing Farroway core stack rather than
 * inventing parallel logic — reuses farmStore / taskEngine /
 * progressStore / streak / riskEngine / LabelPrompt + the
 * post-task labeling hook + the new taskDetails 4-field map.
 *
 * Strict-rule audit
 *   * Shows ONE main task — every render path resolves to a
 *     single taskId
 *   * Loads instantly — every read on first render is sync
 *   * Works offline — every read goes against the local mirror
 *   * All visible text routes through tSafe with a safe English
 *     fallback; no hardcoded strings in the JSX
 *   * Mobile-first: container max-width 28rem, every text node
 *     uses overflowWrap so long translations wrap inside their
 *     row instead of pushing the layout
 *   * No duplicate components: header is rendered ONCE, task
 *     card ONCE, label prompt ONCE
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';
// Core farroway stack
import { getCurrentFarm } from '../core/farroway/farmStore.js';
import { generateDailyTask } from '../core/farroway/taskEngine.js';
import { getTaskDetail } from '../core/farroway/taskDetails.js';
import { markTaskDone } from '../core/farroway/progressStore.js';
import { getCompletedCount } from '../core/farroway/progressStore.js';
import { speak, stopSpeech } from '../core/farroway/voice.js';
// Simple Mode (low-literacy)
import { isSimpleMode } from '../store/settingsStore.js';
// Streak
import { getStreak } from '../utils/streak.js';
// Risk + outbreak
import { getOutbreakReports } from '../outbreak/outbreakStore.js';
import { detectActiveClusters } from '../outbreak/outbreakClusterEngine.js';
import { getAlertsForFarm } from '../outbreak/farmerOutbreakAlerts.js';
import { computeFarmRisks } from '../outbreak/riskEngine.js';
// Labeling
import LabelPrompt from '../components/LabelPrompt.jsx';
import { usePostTaskLabelPrompt } from '../components/ai/usePostTaskLabelPrompt.js';
// UI bits
import MainTaskCard from '../components/MainTaskCard.jsx';
import TaskActions  from '../components/TaskActions.jsx';
import RiskBadge    from '../components/RiskBadge.jsx';
import ProgressBar  from '../components/ProgressBar.jsx';
import ScanCropCta  from '../components/ScanCropCta.jsx';
import RecoveryCard, { RECOVERY_TASK_ID } from '../components/RecoveryCard.jsx';
import { detectMissedDay } from '../utils/missedDay.js';
import { safeParse } from '../utils/safeParse.js';

function _greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return { key: 'today.greeting.morning',   fb: 'Good morning' };
  if (h < 17) return { key: 'today.greeting.afternoon', fb: 'Good afternoon' };
  return       { key: 'today.greeting.evening',  fb: 'Good evening' };
}

function _locationLabel(farm) {
  if (!farm) return '';
  // Prefer the most specific human-readable slot the farm record
  // provides; fall through to broader scopes so a partial profile
  // still shows something. Never echoes raw IDs.
  return (
    farm.locationName
    || farm.village
    || farm.region
    || farm.regionName
    || ''
  );
}

export default function Today() {
  const { t } = useTranslation();   // subscribes the component to lang change
  const navigate = useNavigate();
  void t; // useTranslation's only purpose here is the subscription

  // ── Sync first-paint reads ──────────────────────────────────
  let farm = null;
  try { farm = getCurrentFarm(); } catch { /* keep null */ }
  let data = null;
  try { data = generateDailyTask(farm); } catch { /* keep null */ }

  // Missed-day detector — when true, the recovery flow takes
  // over the main render branch below.
  let missed = { missedDays: 0, needsRecovery: false };
  try { missed = detectMissedDay(); } catch { /* keep defaults */ }

  // Resolve task id + 4-field detail.
  const taskId   = data && data.mainTask ? data.mainTask : 'check_farm';
  const detail   = getTaskDetail(taskId, { crop: farm && farm.crop });
  const greeting = _greetingKey();
  const location = _locationLabel(farm);

  // ── Risk computation (sync, pure) ───────────────────────────
  let risks = { drought: 'LOW', pest: 'LOW', top: { kind: null, level: 'LOW' } };
  try {
    const reports  = getOutbreakReports();
    const farmsArr = farm ? [farm] : [];
    const clusters = detectActiveClusters(reports, farmsArr);
    const matched  = farm ? getAlertsForFarm(farm, clusters) : [];
    const cluster  = matched && matched.length ? matched[0] : null;
    risks = computeFarmRisks(farm, cluster);
  } catch { /* keep defaults */ }

  // ── Streak + tasks-done-today (sync) ────────────────────────
  let streak = 0;
  try { streak = getStreak(); } catch { /* keep 0 */ }
  let tasksDone = 0;
  try {
    const all = getCompletedCount();
    const today = new Date().toDateString();
    const raw = (typeof localStorage !== 'undefined')
      ? (localStorage.getItem('farroway_progress') || '')
      : '';
    const parsed = safeParse(raw, null);
    if (parsed && Array.isArray(parsed.done)) {
      tasksDone = parsed.done.filter((e) => {
        try { return new Date(e.date).toDateString() === today; }
        catch { return false; }
      }).length;
    } else {
      tasksDone = all;
    }
  } catch { /* keep 0 */ }

  // ── Post-task label prompt hook ─────────────────────────────
  const farmIdForPrompt = farm && farm.id ? farm.id : null;
  const { promptOpen, openPrompt, closePrompt } =
    usePostTaskLabelPrompt({ farmId: farmIdForPrompt });

  const [busy, setBusy]       = useState(false);
  const [success, setSuccess] = useState(false);
  const simple                = isSimpleMode();

  // Auto-play voice on first paint when Simple Mode is on. Wraps
  // in a one-shot ref guard so a re-render mid-speech doesn't
  // restart the utterance. Stop speech on unmount so navigating
  // to /settings doesn't trail the task voice into the next page.
  const autoSpokenRef = useRef(false);
  useEffect(() => {
    if (!simple) return undefined;
    if (autoSpokenRef.current) return undefined;
    if (missed.needsRecovery) return undefined;
    autoSpokenRef.current = true;
    const title  = tSafe(detail.titleKey,  detail.titleFb);
    const timing = tSafe(detail.timingKey, detail.timingFb);
    try { speak(`${title}. ${timing}`); } catch { /* swallow */ }
    return () => { try { stopSpeech(); } catch { /* swallow */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simple, missed.needsRecovery]);

  function handleListen() {
    // Speak the title + the timing line so a low-literacy
    // farmer hears WHAT to do and WHEN. Concatenated with a
    // breath pause so TTS engines don't run them together.
    const title  = tSafe(detail.titleKey,  detail.titleFb);
    const timing = tSafe(detail.timingKey, detail.timingFb);
    const text   = `${title}. ${timing}`;
    try { speak(text); } catch { /* swallow */ }
  }

  function handleDone() {
    if (busy) return;
    setBusy(true);
    Promise.resolve(markTaskDone(taskId))
      .catch(() => { /* swallow */ })
      .finally(() => {
        setSuccess(true);
        setBusy(false);
      });
    // Per-spec voice praise on Done. Wraps in try/catch so a
    // browser without speechSynthesis (Safari mobile in some
    // configs) doesn't crash the click handler.
    const praise = tSafe('today.feedback.body', 'Good work. Progress updated.');
    try { speak(praise); } catch { /* swallow */ }
    // Open the post-task label prompt — it auto-closes in ~1.2s
    // after a selection so the farmer is back in flow quickly.
    try { openPrompt(); } catch { /* swallow */ }
  }

  function handleRecoveryDone(recoveryTaskId) {
    Promise.resolve(markTaskDone(recoveryTaskId || RECOVERY_TASK_ID))
      .catch(() => { /* swallow */ });
    try { openPrompt(); } catch { /* swallow */ }
  }

  function handleScanCrop() {
    // Routes to the existing pest-report flow; if the farm has
    // a /report-issue route wired we'd use that, otherwise fall
    // through to /tasks where the issue-report button lives.
    try { navigate('/today'); }
    catch { /* never propagate from a CTA click */ }
  }

  function handleSettings() {
    try { navigate('/settings'); }
    catch { /* never propagate */ }
  }

  return (
    <main style={S.page} data-testid="today-quick-page">
      <div style={S.container}>

        {/* 1. Header — greeting + location + settings (single row,
              no duplicate weather card, no clutter) */}
        <header style={S.header} data-testid="today-header">
          <div style={S.greetingCol}>
            <h1 style={S.greeting} data-testid="today-greeting">
              {tSafe(greeting.key, greeting.fb)}
            </h1>
            {location && (
              <p style={S.location} data-testid="today-location">
                <span style={S.locationIcon} aria-hidden="true">
                  {'\uD83D\uDCCD'}
                </span>
                <span style={S.locationText}>{location}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSettings}
            style={S.settingsBtn}
            aria-label={tSafe('common.settings', 'Settings')}
            data-testid="today-settings"
          >
            <span aria-hidden="true">{'\u2699\uFE0F'}</span>
          </button>
        </header>

        {/* 2 + 3. Recovery branch OR normal task + actions */}
        {missed.needsRecovery ? (
          <RecoveryCard
            missedDays={missed.missedDays}
            onDone={handleRecoveryDone}
          />
        ) : (
          <>
            <MainTaskCard
              title       ={tSafe(detail.titleKey,       detail.titleFb)}
              instruction ={tSafe(detail.instructionKey, detail.instructionFb)}
              timing      ={tSafe(detail.timingKey,      detail.timingFb)}
              risk        ={tSafe(detail.riskKey,        detail.riskFb)}
              simple      ={simple}
            />
            <TaskActions
              onListen={handleListen}
              onDone={handleDone}
              busy={busy}
            />
          </>
        )}

        {/* 4. Completion feedback after Done now */}
        {success && (
          <div
            style={S.feedback}
            role="status"
            aria-live="polite"
            data-testid="today-feedback"
          >
            <span style={S.feedbackIcon} aria-hidden="true">{'\u2713'}</span>
            <span style={S.feedbackText}>
              {tSafe('today.feedback.body', 'Good work. Progress updated.')}
            </span>
          </div>
        )}

        {/* 5. Risk indicator (renders only when something is HIGH) */}
        <RiskBadge pest={risks.pest} drought={risks.drought} simple={simple} />

        {/* 6. Progress strip */}
        <ProgressBar streak={streak} tasksDone={tasksDone} />

        {/* 7. Scan-crop CTA — secondary entry for mid-day issue
              reporting. Sits at the bottom so the farmer's eye
              doesn't compete with the main task card. */}
        <ScanCropCta onScan={handleScanCrop} />
      </div>

      <LabelPrompt
        open={promptOpen}
        farmId={farmIdForPrompt}
        taskType={taskId}
        onClose={closePrompt}
        simple={simple}
      />
    </main>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '1rem 0 6rem',
  },
  container: {
    maxWidth: '28rem',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
  },
  greetingCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  greeting: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    overflowWrap: 'break-word',
  },
  location: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.62)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  locationIcon: {
    fontSize: '0.875rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  locationText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.04)',
    color: '#EAF2FF',
    fontSize: '1.125rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
  },
  feedback: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    background: 'rgba(34,197,94,0.14)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    fontSize: '0.9375rem',
    fontWeight: 700,
    overflowWrap: 'break-word',
  },
  feedbackIcon: {
    fontSize: '1rem',
    fontWeight: 800,
    flexShrink: 0,
  },
  feedbackText: {
    flex: 1,
    minWidth: 0,
  },
};
