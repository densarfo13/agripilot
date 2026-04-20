/**
 * FarmerTodayPage — action-first Today screen.
 *
 * Render order (top → bottom):
 *   1. Header         "Today on your farm"
 *   2. Primary Task
 *   3. Secondary Tasks (max 2)
 *   4. Risk Alerts
 *   5. Progress Summary
 *   6. Crop Stage Card
 *   7. Support Section
 *
 * Tasks regenerate automatically when the language changes because
 * every title/detail flows through t() on render.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import { getTodayFeed, completeCycleTask, skipCycleTask, reportCycleIssue, submitCycleHarvest, listCropCycles } from '../../hooks/useCropCycles.js';
import { usePreferenceSync } from '../../hooks/usePreferenceSync.js';
import { localizeServerTask } from '../../utils/generateLocalizedTask.js';
import { evaluateCropFit } from '../../utils/cropFit.js';
import PrimaryTaskCard from '../../components/farmer/PrimaryTaskCard.jsx';
import SecondaryTaskList from '../../components/farmer/SecondaryTaskList.jsx';
import RiskAlertsPanel from '../../components/farmer/RiskAlertsPanel.jsx';
import ProgressSummaryCard from '../../components/farmer/ProgressSummaryCard.jsx';
import CropStageCard from '../../components/farmer/CropStageCard.jsx';
import SupportSection from '../../components/farmer/SupportSection.jsx';
import FeedbackModal from '../../components/farmer/FeedbackModal.jsx';
import TaskFeedbackModal from '../../components/farmer/TaskFeedbackModal.jsx';
import CompletionBanner from '../../components/farmer/CompletionBanner.jsx';
import TodayContextHeader from '../../components/farmer/TodayContextHeader.jsx';
import {
  saveTaskCompletion,
  saveFeedback,
  drainQueue,
  defaultSender,
  getActiveFarmId,
  getTaskCompletions,
  getFeedback,
} from '../../store/farrowayLocal.js';
import { computeProgress, STATUS_LABEL_KEY } from '../../lib/progress/progressEngine.js';
import { generateTasks } from '../../lib/tasks/taskEngine.js';
import {
  computeDailyLoopFacts,
  touchLastVisit,
  markTaskCompletedForStreak,
  pickReinforcementKey,
  pickNextDayHint,
} from '../../lib/loop/dailyLoop.js';
import { getLastActivity } from '../../lib/ngo/analytics.js';
import { formatRelativeTime } from '../../lib/time/relativeTime.js';
import NextHint from '../../components/farmer/NextHint.jsx';
import DoneStateCard from '../../components/farmer/DoneStateCard.jsx';
import OptionalChecksSection from '../../components/farmer/OptionalChecksSection.jsx';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';
import { getTodayScreenState } from '../../utils/getTodayScreenState.js';
import { getAppMode } from '../../utils/getAppMode.js';
import { shapeTodayPayloadForMode } from '../../utils/modeAwareTasks.js';

export default function FarmerTodayPage() {
  const { t, language, region } = useAppSettings();
  // Side-effect hook — hydrates language + region from the backend
  // profile on mount, and PATCHes the profile when either changes.
  // Fire-and-forget; never blocks the UI.
  usePreferenceSync();
  const [state, setState] = useState({ loading: true, today: null, cycles: null, error: null });

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [today, cycles] = await Promise.all([getTodayFeed(), listCropCycles()]);
      setState({ loading: false, today, cycles, error: null });
    } catch (err) {
      setState({ loading: false, today: null, cycles: null, error: err?.code || 'error' });
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // Offline-first sync drain — attempt on mount and whenever the
  // browser reports we're back online. Silently no-ops offline.
  useEffect(() => {
    const run = () => { drainQueue(defaultSender).catch(() => {}); };
    run();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', run);
      return () => window.removeEventListener('online', run);
    }
  }, []);

  // "Did this help?" prompt state — opens right after a successful
  // complete, non-blocking (user can dismiss by tapping outside).
  const [taskFeedback, setTaskFeedback] = useState({ open: false, taskId: null });

  // Positive-reinforcement banner shown briefly after every successful
  // complete. Fades itself out — does not block flow.
  const [completionBanner, setCompletionBanner] = useState(false);
  const [reinforcementKey, setReinforcementKey] = useState(null);

  // Mark today as "visited" so the daily-entry helper can tell
  // first-open from continuing session on the next render cycle.
  useEffect(() => { touchLastVisit(); }, []);

  // Tick counter — bumped after each action so useMemo re-reads the
  // localStorage-backed completions and refreshes the progress snapshot
  // without a page reload.
  const [progressTick, setProgressTick] = useState(0);
  const bumpProgress = () => setProgressTick((n) => n + 1);

  // Re-derive localized tasks whenever the language or the raw today
  // payload changes. Using useMemo keeps the re-render cheap.
  // Dual-mode derivation: take farmType off the freshest farm row
  // we have. Defaults to farm so existing users don't lose any
  // features silently.
  const currentMode = useMemo(() => {
    const firstFarm = state.cycles?.cycles?.[0];
    return getAppMode({ farmType: firstFarm?.farmType || firstFarm?.summary?.farmType || 'small_farm' });
  }, [state.cycles]);

  const { primaryTask, secondaryTasks, riskAlerts, weatherAlerts, weatherBadge } = useMemo(() => {
    const rawToday = state.today;
    const today = shapeTodayPayloadForMode(rawToday, currentMode, t);
    if (!today) {
      return { primaryTask: null, secondaryTasks: [], riskAlerts: [], weatherAlerts: [], weatherBadge: null };
    }
    const wr = today.weatherRisk || null;
    const badge = wr
      ? {
          level: wr.overallWeatherRisk || 'low',
          labelKey:
            wr.overallWeatherRisk === 'high' ? 'weather.badge.high' :
            wr.overallWeatherRisk === 'medium' ? 'weather.badge.medium' :
            'weather.badge.low',
          color:
            wr.overallWeatherRisk === 'high' ? '#EF4444' :
            wr.overallWeatherRisk === 'medium' ? '#F59E0B' :
            '#22C55E',
        }
      : null;
    return {
      primaryTask: today.primaryTask ? localizeServerTask(today.primaryTask, t) : null,
      secondaryTasks: (today.secondaryTasks || []).map((task) => localizeServerTask(task, t)),
      riskAlerts: today.riskAlerts || [],
      weatherAlerts: today.weatherAlerts || [],
      weatherBadge: badge,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.today, language]);

  const activeCycle = state.cycles?.cycles?.find(
    (c) => !['harvested', 'failed'].includes(c.lifecycleStatus || ''),
  );

  const warning = useMemo(() => {
    if (!activeCycle) return { show: false };
    return evaluateCropFit({
      crop: activeCycle.cropType,
      stateCode: region?.stateCode,
      country: region?.country || 'US',
    });
  }, [activeCycle, region]);

  const [modal, setModal] = useState({ open: false, mode: null, task: null });

  async function handleComplete(task) {
    if (!task?.id || task.source?.startsWith('override:')) return;
    // Offline-first: always persist locally + queue for sync first,
    // so a refresh preserves the completion even if the network call
    // below never reaches the server.
    const farmId = activeCycle?.farmId || activeCycle?.id || getActiveFarmId();
    saveTaskCompletion({ taskId: task.id, farmId });
    try {
      await completeCycleTask(task.id);
    } catch { /* offline / server error — local + queue already cover it */ }
    await reload();
    // Daily-loop streak bookkeeping — deterministic, once per day,
    // tied to the active farm's local completions.
    markTaskCompletedForStreak();
    // Rotate a short reinforcement message (varied but deterministic
    // per task so the same completion renders the same copy).
    setReinforcementKey(pickReinforcementKey(task.id));
    // Positive reinforcement first (non-blocking banner), then the
    // optional "Did this help?" prompt. Farmer can dismiss either
    // without impacting flow.
    setCompletionBanner(true);
    setTaskFeedback({ open: true, taskId: task.id });
    // Opportunistic drain — if we're online now, flush the queue.
    drainQueue(defaultSender).catch(() => {});
    // Recompute progress immediately (no refresh needed).
    bumpProgress();
  }

  function handleTaskFeedback(value) {
    if (!taskFeedback.taskId) return;
    saveFeedback({ taskId: taskFeedback.taskId, feedback: value });
    drainQueue(defaultSender).catch(() => {});
    bumpProgress();
  }

  // PrimaryTaskCard calls these to open the modal; the modal's
  // onSubmit actually performs the request. This avoids window.prompt
  // entirely and keeps the interaction localized + accessible.
  function openSkipModal(task) {
    if (!task?.id || task.source?.startsWith('override:')) return;
    setModal({ open: true, mode: 'skip', task });
  }
  function openIssueModal() {
    if (!activeCycle?.id) return;
    setModal({ open: true, mode: 'issue', task: null });
  }
  function openHarvestModal() {
    if (!activeCycle?.id) return;
    setModal({ open: true, mode: 'harvest', task: null });
  }

  async function handleModalSubmit(data) {
    let harvestResponse = null;
    try {
      if (modal.mode === 'skip' && modal.task) {
        await skipCycleTask(modal.task.id, data.reason);
      } else if (modal.mode === 'issue' && activeCycle?.id) {
        await reportCycleIssue(activeCycle.id, data);
      } else if (modal.mode === 'harvest' && activeCycle?.id) {
        harvestResponse = await submitCycleHarvest(activeCycle.id, data);
      }
    } finally {
      await reload();
    }
    // After a successful harvest, replace the "silent reload" with a
    // landing on the post-harvest summary page, handing over the
    // server's summary + next-cycle options via router state so the
    // page can render without re-fetching.
    if (modal.mode === 'harvest' && harvestResponse?.summary && activeCycle?.id) {
      navigate(`/harvest/${activeCycle.id}/summary`, {
        state: {
          summary: harvestResponse.summary,
          nextCycle: harvestResponse.nextCycle || null,
        },
      });
    }
  }

  const harvestEligible = ['harvest_ready', 'flowering'].includes(
    activeCycle?.lifecycleStatus || '',
  );

  if (state.loading) {
    return <Shell><p style={S.muted}>{t('common.loading')}</p></Shell>;
  }

  const tasksDone = state.cycles?.cycles?.reduce(
    (n, c) => n + (c.summary?.completed || 0), 0,
  ) || 0;
  const cyclesActive = state.cycles?.cycles?.filter(
    (c) => !['harvested', 'failed'].includes(c.lifecycleStatus || ''),
  ).length || 0;

  // ─── Compose the context header (location • crop • stage) ──
  const locationLabel = [region?.city, region?.stateCode, region?.country]
    .filter(Boolean).join(', ') || null;
  const cropLabel = activeCycle?.cropType
    ? getCropDisplayName(activeCycle.cropType, language, { bilingual: 'auto' })
    : null;
  const stageLabel = activeCycle?.lifecycleStatus
    ? t(`cropStage.${activeCycle.lifecycleStatus}`)
    : null;

  // Progress — rough but honest: fraction of task rows the farmer has
  // actually completed, overlaid with the overall risk level so the
  // status pill can flip from "On track" to "Needs attention" when
  // something material is wrong.
  const totalTasks = state.cycles?.cycles?.reduce(
    (n, c) => n + (c.summary?.total || 0), 0,
  ) || 0;
  const progressPercent = totalTasks > 0
    ? Math.round((tasksDone / totalTasks) * 100)
    : null;
  const overallRiskLevel = state.today?.overallRisk?.level || 'low';
  const overdueTasksCount = state.today?.overdueTasksCount || 0;

  // ─── 2-state resolver ─────────────────────────────────────
  // Single source of truth for whether the farmer has required work
  // left today (ACTIVE) or not (DONE). When DONE, optional checks
  // surface in their own clearly-optional section instead of
  // masquerading as unfinished tasks.
  const screen = useMemo(() => getTodayScreenState({
    primaryTask,
    secondaryTasks,
    riskAlerts,
    weatherAlerts,
    overdueCount: state.today?.overdueTasksCount || 0,
    tasksDone,
    totalTasks: state.cycles?.cycles?.reduce((n, c) => n + (c.summary?.total || 0), 0) || 0,
    riskLevel: state.today?.overallRisk?.level || 'low',
    serverHint: state.today?.nextActionSummary || null,
  }), [primaryTask, secondaryTasks, riskAlerts, weatherAlerts, state.today, tasksDone, state.cycles]);

  const nextHintText = screen.nextHint?.text
    || (screen.nextHint?.textKey ? t(screen.nextHint.textKey) : null);

  // ─── Task Engine snapshot (deterministic, offline-first) ───
  // Generates stage + crop + weather-aware tasks from pure inputs.
  // Used as the source of truth when the server feed has no primary
  // task, and always piped into the Progress Engine below so
  // nextBestAction stays aligned with the current farming context.
  const weatherSummary = useMemo(() => {
    const wr = state.today?.weatherRisk || null;
    if (!wr) return null;
    const level = wr.overallWeatherRisk;
    return {
      rainSoon:  level === 'medium' || level === 'high',
      heavyRain: level === 'high',
      dry:       level === 'dry',
      severe:    level === 'severe',
    };
  }, [state.today]);

  const engineSnapshot = useMemo(() => generateTasks({
    farm:     activeCycle || null,
    crop:     activeCycle?.cropType || null,
    stage:    activeCycle?.lifecycleStatus || null,
    weather:  weatherSummary,
    location: region || null,
    completions: getTaskCompletions(),
  }), [activeCycle, weatherSummary, region, progressTick]);

  // ─── Progress Engine snapshot ──────────────────────────────
  // Reads locally-persisted task completions + feedback. Prefers the
  // server-driven task list; falls back to the engine's output
  // (spec §7 offline-first). `progressTick` bumps after every
  // handleComplete / feedback so both snapshots refresh without a
  // page reload.
  // Daily loop facts — streak, last visit, missed-day, first-visit-today.
  // Re-read on every progressTick so completing a task immediately
  // updates the streak chip without a reload.
  const loopFacts = useMemo(
    () => computeDailyLoopFacts({ completions: getTaskCompletions() }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressTick],
  );

  // Trust signal (spec §7) — last activity time for the active farm,
  // derived from the NGO event log so it reflects actual recorded
  // actions, not UI-only state.
  const lastActivityPayload = useMemo(() => {
    const ts = getLastActivity(getActiveFarmId());
    return formatRelativeTime(ts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressTick]);

  const progressSnapshot = useMemo(() => {
    const serverTasks = [
      primaryTask ? { id: primaryTask.id, title: primaryTask.title, priority: 'high',
                       overdue: !!primaryTask.overdue } : null,
      ...((secondaryTasks || []).map((t2) => ({
        id: t2.id, title: t2.title, priority: 'normal', overdue: !!t2.overdue,
      }))),
    ].filter(Boolean);
    const engineTasks = [
      engineSnapshot.primaryTask && engineSnapshot.primaryTask.kind === 'task'
        ? { id: engineSnapshot.primaryTask.id,
            titleKey: engineSnapshot.primaryTask.titleKey,
            priority: engineSnapshot.primaryTask.priority }
        : null,
      ...(engineSnapshot.secondaryTasks || []).map((t2) => ({
        id: t2.id, titleKey: t2.titleKey, priority: t2.priority,
      })),
    ].filter(Boolean);
    const mergedTasks = serverTasks.length > 0 ? serverTasks : engineTasks;
    return computeProgress({
      farm: { cropStage: activeCycle?.lifecycleStatus || null },
      tasks: mergedTasks,
      completions: getTaskCompletions(),
      feedback: getFeedback(),
      // Surface daily-loop facts on the snapshot so consumers only
      // call computeProgress once (spec §7).
      streak:    loopFacts.streak,
      lastVisit: loopFacts.lastVisit,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryTask, secondaryTasks, activeCycle, engineSnapshot, loopFacts, progressTick]);

  // Next-day hint — shown in the DONE state so completion is never a
  // dead end. Pulled from the task engine's remaining queue.
  const nextDayHint = useMemo(
    () => pickNextDayHint({
      engineSnapshot,
      completions: getTaskCompletions(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engineSnapshot, progressTick],
  );

  const progressStatusLabel = t(STATUS_LABEL_KEY[progressSnapshot.status])
    || progressSnapshot.status;
  const nextBestActionText = progressSnapshot.nextBestAction.kind === 'bridge'
    ? (t(progressSnapshot.nextBestAction.bridgeKey) || null)
    : (progressSnapshot.nextBestAction.title
        || (progressSnapshot.nextBestAction.titleKey
            ? t(progressSnapshot.nextBestAction.titleKey)
            : null));

  function handleOptionalCheck(item) {
    // Re-use the issue-reporter modal for "Scan crop for issues" so
    // farmers who spot something can report it in one tap; the other
    // checks just navigate to detail screens we don't force routing
    // on here.
    if (item.code === 'scan_crop') openIssueModal();
  }

  return (
    <Shell>
      <h1 style={S.pageTitle}>{t('actionHome.todayHeader')}</h1>

      {/* 1. Small context header (both states) */}
      <TodayContextHeader
        locationLabel={locationLabel}
        cropLabel={cropLabel}
        stageLabel={stageLabel}
      />

      <FeedbackModal
        open={modal.open}
        mode={modal.mode}
        onClose={() => setModal({ open: false, mode: null, task: null })}
        onSubmit={handleModalSubmit}
      />

      <TaskFeedbackModal
        open={taskFeedback.open}
        taskId={taskFeedback.taskId}
        onAnswer={handleTaskFeedback}
        onClose={() => setTaskFeedback({ open: false, taskId: null })}
      />

      {/* Positive-reinforcement banner — non-blocking, auto-hides.
          Uses a varied-but-deterministic message key picked on complete. */}
      <CompletionBanner
        open={completionBanner}
        messageKey={reinforcementKey || 'actionHome.completion.positive'}
        onClose={() => setCompletionBanner(false)}
      />

      {/* Daily loop header — streak pill + entry message + last
          activity (spec §7). First row shown every render; no layout
          jumps between states. */}
      <div style={S.loopRow} data-testid="daily-loop-row">
        <span style={S.streakPill} data-testid="streak-pill">
          {loopFacts.streak > 0
            ? (t('loop.streak_label', { days: loopFacts.streak })
                || `${loopFacts.streak}-day streak`)
            : (t('loop.streak_start') || 'Start your streak today')}
        </span>
        <span style={S.loopEntry} data-testid="loop-entry-message">
          {t(loopFacts.entryMessageKey) || ''}
        </span>
        <span style={S.trustSignal} data-testid="trust-last-activity">
          {t('trust.last_activity', {
            ago: (t(lastActivityPayload.key, lastActivityPayload.vars)
                   || lastActivityPayload.fallback),
          }) || `Last activity: ${lastActivityPayload.fallback}`}
        </span>
      </div>

      {/* Micro progress summary — always visible, lightweight. */}
      <div style={S.microRow} data-testid="micro-progress">
        <span style={S.microCount}>
          {t('actionHome.progress.summary', {
            done: progressSnapshot.completedCount,
            total: progressSnapshot.totalCount,
          }) || `${progressSnapshot.completedCount} of ${progressSnapshot.totalCount} tasks completed`}
        </span>
        <span style={{ ...S.microStatus, ...microStatusStyleFor(progressSnapshot.status) }}>
          {progressStatusLabel}
        </span>
      </div>

      {screen.state === 'active' ? (
        <>
          {state.today?.nextActionSummary && (
            <p style={S.pageSummary}>{state.today.nextActionSummary}</p>
          )}

          {/* 2. PRIMARY TASK CARD — server task preferred; if missing,
              fall back to the engine's stage/crop/weather-aware primary
              so the farmer always sees ONE clear action + WHY. */}
          <PrimaryTaskCard
            task={resolvePrimaryTaskForCard(screen.primaryTask, engineSnapshot, t)}
            warning={warning}
            onComplete={handleComplete}
            onSkip={openSkipModal}
            onReportIssue={openIssueModal}
            onHarvest={openHarvestModal}
            harvestEligible={harvestEligible}
          />

          {/* 3. RISK ALERTS — panel self-hides when empty */}
          <RiskAlertsPanel alerts={riskAlerts} weatherAlerts={weatherAlerts} weatherBadge={weatherBadge} />

          {/* 4. SECONDARY TASKS (max 2) */}
          <SecondaryTaskList tasks={screen.secondaryTasks} />

          {/* 5. LIGHT PROGRESS */}
          <ProgressSummaryCard
            tasksDone={tasksDone}
            cyclesActive={cyclesActive}
            percent={progressPercent}
            overdueCount={overdueTasksCount}
            riskLevel={overallRiskLevel}
          />

          {/* 5b. Progress Engine status chip (deterministic score + state). */}
          <div style={S.progressChip} data-testid="progress-engine-chip">
            <span style={S.progressChipLabel}>{progressStatusLabel}</span>
            <span style={S.progressChipScore}>
              {progressSnapshot.progressScore}/100
            </span>
          </div>

          {/* 6. NEXT HINT */}
          <NextHint text={nextHintText} />
        </>
      ) : (
        <>
          {/* DONE state — completion card dominates. No "All done"
              above task-looking cards; optional checks live in their
              own clearly-labeled section below. */}
          <DoneStateCard
            progressPercent={progressPercent}
            donePill={screen.progress.total
              ? t('today.done.donePill', { done: screen.progress.done, total: screen.progress.total })
                || `${screen.progress.done} of ${screen.progress.total} done`
              : null}
          />

          {/* Risk alerts — still render in DONE if weather / issues
              genuinely raise risk; the panel self-hides otherwise. */}
          <RiskAlertsPanel alerts={riskAlerts} weatherAlerts={weatherAlerts} weatherBadge={weatherBadge} />

          <OptionalChecksSection
            items={screen.optionalChecks}
            onPick={handleOptionalCheck}
          />

          {/* Progress Engine status + bridge action — avoids a dead end
              after all tasks are done; always gives the farmer a next
              step to look at. */}
          <div style={S.progressChip} data-testid="progress-engine-chip">
            <span style={S.progressChipLabel}>{progressStatusLabel}</span>
            <span style={S.progressChipScore}>
              {progressSnapshot.progressScore}/100
            </span>
          </div>
          {nextBestActionText && (
            <div style={S.bridgeCard} data-testid="next-best-action">
              <span style={S.bridgeLabel}>
                {t('progress.next_best_action') || 'Next best action'}
              </span>
              <span style={S.bridgeText}>{nextBestActionText}</span>
            </div>
          )}

          {/* Next-day preview — retention trigger (spec §4). Shown
              in DONE so the farmer always sees what "tomorrow" brings. */}
          {nextDayHint && (
            <div style={S.bridgeCard} data-testid="next-day-preview">
              <span style={S.bridgeLabel}>
                {t('loop.check_tomorrow') || 'Next: check tomorrow'}
              </span>
              <span style={S.bridgeText}>
                {nextDayHint.kind === 'bridge'
                  ? (t(nextDayHint.bridgeKey) || '')
                  : (t('loop.tomorrow_preview',
                       { task: (nextDayHint.titleKey && t(nextDayHint.titleKey)) || '' })
                     || '')}
              </span>
            </div>
          )}

          <NextHint text={nextHintText} />
        </>
      )}

      <CropStageCard
        stage={activeCycle?.lifecycleStatus}
        cropKey={activeCycle?.cropType}
        cropName={activeCycle?.cropDisplayName}
      />

      <SupportSection />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={S.page}>
      <div style={S.container}>{children}</div>
    </div>
  );
}

// Merge urgency + whyKey-resolved text into the server task before
// handing it to PrimaryTaskCard. If the server didn't supply a
// primary, fall back to the engine's task-kind primary (bridge
// actions surface elsewhere via the DONE state).
function resolvePrimaryTaskForCard(serverTask, engineSnapshot, t) {
  if (serverTask) {
    const eng = engineSnapshot?.primaryTask;
    return {
      ...serverTask,
      urgency: serverTask.urgency
        || (eng && eng.urgency) || 'normal',
      detail: serverTask.detail
        || (serverTask.whyKey && t && t(serverTask.whyKey))
        || null,
    };
  }
  const eng = engineSnapshot?.primaryTask;
  if (!eng || eng.kind !== 'task') return null;
  return {
    id:      eng.id,
    title:   (t && t(eng.titleKey)) || '',
    detail:  (t && eng.whyKey && t(eng.whyKey)) || null,
    urgency: eng.urgency || 'normal',
    whyKey:  eng.whyKey || null,
  };
}

function microStatusStyleFor(code) {
  if (code === 'on_track')     return { color: '#86EFAC', background: 'rgba(34,197,94,0.14)' };
  if (code === 'slight_delay') return { color: '#FDE68A', background: 'rgba(245,158,11,0.14)' };
  return                              { color: '#FCA5A5', background: 'rgba(239,68,68,0.14)' };
}

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  pageSummary: { color: '#9FB3C8', fontSize: '0.9375rem', margin: '0 0 0.5rem', lineHeight: 1.45 },
  muted: { color: '#9FB3C8' },
  progressChip: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.5rem 0.875rem', borderRadius: '999px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.18)',
    fontSize: '0.8125rem',
  },
  progressChipLabel: { color: '#86EFAC', fontWeight: 700 },
  progressChipScore: { color: '#EAF2FF', fontWeight: 600 },
  bridgeCard: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    padding: '0.75rem 1rem', borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  bridgeLabel: {
    fontSize: '0.6875rem', fontWeight: 700, color: '#6F8299',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  bridgeText: { fontSize: '0.9375rem', fontWeight: 600, color: '#EAF2FF' },
  microRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    fontSize: '0.8125rem',
  },
  microCount: { color: '#EAF2FF', fontWeight: 600 },
  microStatus: {
    padding: '0.125rem 0.5rem', borderRadius: '999px',
    fontSize: '0.6875rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  loopRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
    padding: '0.375rem 0',
  },
  streakPill: {
    padding: '0.25rem 0.625rem', borderRadius: '999px',
    background: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.28)',
    color: '#FDE68A',
    fontSize: '0.75rem', fontWeight: 700,
  },
  loopEntry: {
    color: '#9FB3C8',
    fontSize: '0.8125rem',
    fontWeight: 500,
  },
  trustSignal: {
    marginLeft: 'auto',
    color: '#6F8299',
    fontSize: '0.75rem',
    fontWeight: 500,
  },
};
