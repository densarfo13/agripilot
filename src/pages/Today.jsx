/**
 * Today — optimised single-task farmer screen.
 *
 *   /today/quick
 *
 * Layout (top -> bottom):
 *   1. Greeting
 *   2. Main task card        (one task, one line)
 *   3. Action buttons        (Listen + Done)
 *   4. Risk indicator        (only HIGH risks)
 *   5. Progress              (streak + tasks today)
 *
 * Composes the existing Farroway core stack rather than
 * inventing parallel logic - reuses farmStore / taskEngine /
 * progressStore / streak / dailyCheckin / riskEngine /
 * LabelPrompt + the post-task labeling hook.
 *
 * Strict-rule audit
 *   * shows ONE main task: MainTaskCard prop is a single
 *     string; the engine only returns one mainTask
 *   * loads instantly: every read on first render is sync
 *     (getCurrentFarm, getStreak, getCompletedCount, the
 *     pure cluster engine + computeFarmRisks). No Suspense,
 *     no fetch.
 *   * works offline: every read goes against the local
 *     mirror / synchronous helpers
 *   * supports low literacy: emoji-first buttons + voice +
 *     minimal text
 *   * no clutter: 5 elements, no ads, no upsell
 *   * fallback task: "Check your farm today" when the
 *     engine returns null (no farm or no crop set yet)
 */

import React, { useState } from 'react';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';
// Core farroway stack
import { getCurrentFarm } from '../core/farroway/farmStore.js';
import { generateDailyTask } from '../core/farroway/taskEngine.js';
import { getTaskMessage } from '../core/farroway/taskMessages.js';
import { markTaskDone } from '../core/farroway/progressStore.js';
import { getCompletedCount } from '../core/farroway/progressStore.js';
import { speak } from '../core/farroway/voice.js';
// Streak + dailyCheckin
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

function _greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return { key: 'today.greeting.morning',   fb: 'Good morning' };
  if (h < 17) return { key: 'today.greeting.afternoon', fb: 'Good afternoon' };
  return       { key: 'today.greeting.evening',  fb: 'Good evening' };
}

export default function Today() {
  const { t } = useTranslation();

  // Sync first-paint reads. Wrap each in try/catch so a
  // missing helper can never blank the page.
  let farm = null;
  try { farm = getCurrentFarm(); } catch { /* keep null */ }
  let data = null;
  try { data = generateDailyTask(farm); } catch { /* keep null */ }

  // Resolve task / reason / icon. Spec section 9: never show an
  // empty screen - fall back to "check your farm today" with a
  // sprout icon.
  const taskId   = data && data.mainTask ? data.mainTask : 'check_farm';
  const taskMsg  = getTaskMessage(taskId);
  const greeting = _greetingKey();

  // Risk computation. Pure + sync; cluster engine is O(N) over
  // the local outbreak mirror.
  let risks = { drought: 'LOW', pest: 'LOW', top: { kind: null, level: 'LOW' } };
  try {
    const reports  = getOutbreakReports();
    const farmsArr = farm ? [farm] : [];
    const clusters = detectActiveClusters(reports, farmsArr);
    const matched  = farm ? getAlertsForFarm(farm, clusters) : [];
    const cluster  = matched && matched.length ? matched[0] : null;
    risks = computeFarmRisks(farm, cluster);
  } catch { /* keep defaults */ }

  // Streak + completed count - both sync mirrors.
  let streak = 0;
  try { streak = getStreak(); } catch { /* keep 0 */ }
  let tasksDone = 0;
  try {
    const all = getCompletedCount();
    // Filter to "today only" via a same-day stamp on the
    // stored entries. The progress mirror keeps date as a
    // ms timestamp; we count entries with ToDateString match.
    const today = new Date().toDateString();
    // Lazy import to avoid pulling another module at top level
    // when most renders won't use it.
    /* eslint-disable global-require */
    // Re-implement the count locally using the mirror -
    // cheaper than awaiting hydrateProgress here.
    const raw = (typeof localStorage !== 'undefined')
      ? (localStorage.getItem('farroway_progress') || '')
      : '';
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.done)) {
          tasksDone = parsed.done.filter((e) => {
            try { return new Date(e.date).toDateString() === today; }
            catch { return false; }
          }).length;
        }
      } catch { tasksDone = all; }
    } else {
      tasksDone = all;
    }
    /* eslint-enable global-require */
  } catch { /* keep 0 */ }

  // Post-task label prompt. Hook handles dedupe + sampling.
  const farmIdForPrompt = farm && farm.id ? farm.id : null;
  const { promptOpen, openPrompt, closePrompt } =
    usePostTaskLabelPrompt({ farmId: farmIdForPrompt });

  const [busy, setBusy]       = useState(false);
  const [success, setSuccess] = useState(false);

  function handleListen() {
    try { speak(taskMsg); }
    catch { /* swallow */ }
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
    try { speak(tSafe('farroway.today.praise', 'Good job')); }
    catch { /* swallow */ }
    try { openPrompt(); }
    catch { /* swallow */ }
  }

  return (
    <main style={S.page} data-testid="today-quick-page">
      <div style={S.container}>

        {/* 1. Greeting */}
        <header style={S.greetingRow} data-testid="today-greeting">
          <span style={S.greetingIcon} aria-hidden="true">{'\uD83C\uDF1E'}</span>
          <h1 style={S.greeting}>
            {tSafe(greeting.key, greeting.fb)}
          </h1>
        </header>

        {/* 2. Main task card */}
        <MainTaskCard task={taskMsg} />

        {/* 3. Action buttons */}
        <TaskActions
          onListen={handleListen}
          onDone={handleDone}
          busy={busy}
        />

        {/* Confirmation pulse after a Done tap. Stays on
            screen briefly so the farmer sees something happen
            even though the LabelPrompt may also open. */}
        {success && (
          <div style={S.success} role="status" aria-live="polite" data-testid="today-success">
            <span style={S.successIcon} aria-hidden="true">{'\u2713'}</span>
            <span>{tSafe('farroway.today.praise', 'Good job')}</span>
          </div>
        )}

        {/* 4. Risk indicator (only HIGH risks rendered) */}
        <RiskBadge pest={risks.pest} drought={risks.drought} />

        {/* 5. Progress */}
        <ProgressBar streak={streak} tasksDone={tasksDone} />
      </div>

      <LabelPrompt
        open={promptOpen}
        farmId={farmIdForPrompt}
        taskType={taskId}
        onClose={closePrompt}
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
  greetingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  greetingIcon: { fontSize: '1.5rem', lineHeight: 1 },
  greeting: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  success: {
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
  },
  successIcon: {
    fontSize: '1rem',
    fontWeight: 800,
  },
};
