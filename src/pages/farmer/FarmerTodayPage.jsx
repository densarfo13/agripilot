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
// Snippet ref §1+§2: greeting + weather alert pill above the
// existing card stack. Both backed by data already on the page —
// useDynamicGreeting consumes the same farmJourney + crop signals
// the page already reads; the weather alert reads the existing
// `liveWeather` state (line ~381) the rest of the engines already
// see, so we don't subscribe to WeatherContext twice.
import { useDynamicGreeting } from '../../hooks/useDynamicGreeting.js';
import { deriveWeatherRisk } from '../../intelligence/weatherRiskModel.js';
import { tStrict } from '../../i18n/strictT.js';
import { CloudRain, AlertTriangle } from '../../components/icons/lucide.jsx';
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
import FarmerActionGrid from '../../components/farmer/FarmerActionGrid.jsx';
import FeedbackModal from '../../components/farmer/FeedbackModal.jsx';
import TaskFeedbackModal from '../../components/farmer/TaskFeedbackModal.jsx';
import { recordOutcome } from '../../lib/outcomes/outcomeStore.js';
import CompletionBanner from '../../components/farmer/CompletionBanner.jsx';
import TodayContextHeader from '../../components/farmer/TodayContextHeader.jsx';
import {
  saveTaskCompletion,
  saveFeedback,
  drainQueue,
  defaultSender,
  getActiveFarmId,
  getActiveFarm,
  getTaskCompletions,
  getFeedback,
  isAlertDismissed,
  dismissAlert,
} from '../../store/farrowayLocal.js';
import { computeProgress, STATUS_LABEL_KEY } from '../../lib/progress/progressEngine.js';
import { generateTasks } from '../../lib/tasks/taskEngine.js';
import { generateDailyTasks } from '../../lib/tasks/dailyTaskEngine.js';
import { inferPlantingStatus } from '../../lib/tasks/plantingStatus.js';
import {
  getJourneyState, setJourneyState,
} from '../../store/farmerJourney.js';
import { deriveJourneyState } from '../../lib/journey/journeySignals.js';
import JourneySummaryCard from '../../components/JourneySummaryCard.jsx';
import { runNotificationChecks } from '../../lib/notifications/notificationGenerator.js';
import NotificationBadge from '../../components/NotificationBadge.jsx';
import { createWeatherService } from '../../lib/weather/weatherService.js';

// Shared live weather service. Open-Meteo, 1h local cache.
// Declared module-level so mounting/unmounting Today doesn't
// spawn fresh services that each re-hit the network.
const weatherService = createWeatherService();
import {
  computeDailyLoopFacts,
  touchLastVisit,
  markTaskCompletedForStreak,
  pickReinforcementKey,
  pickNextDayHint,
} from '../../lib/loop/dailyLoop.js';
import { getLastActivity } from '../../lib/ngo/analytics.js';
import { formatRelativeTime } from '../../lib/time/relativeTime.js';
import { getEvents as getAllFarmEvents } from '../../lib/events/eventLogger.js';
import {
  evaluateReminder, markReminderShown,
  shouldRequestBrowserPermission, requestBrowserPush,
  sendBrowserNotification,
} from '../../lib/notifications/reminderEngine.js';
import NextHint from '../../components/farmer/NextHint.jsx';
import DoneStateCard from '../../components/farmer/DoneStateCard.jsx';
import OptionalChecksSection from '../../components/farmer/OptionalChecksSection.jsx';
import { tSafe } from '../../i18n/tSafe.js';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';
import { getLocalizedTaskTitle } from '../../utils/taskTranslations.js';
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
    // Gap-fix §7: canonical outcome log. Yes → improved, No → worse,
    // Not sure → no_change. Never blocks the user if the mapping
    // fails — recordOutcome returns null and we carry on.
    try {
      recordOutcome({
        farmId:     (state.cycles?.cycles?.[0]?.farmId) || null,
        sourceType: 'task',
        sourceId:   taskFeedback.taskId,
        action:     'task_completed',
        answer:     value,   // 'yes' | 'no' | 'not_sure'
      });
    } catch { /* non-blocking */ }
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

  // ─── Alert dismiss memory + dedup (spec §§4-5) ───────────
  // When the top reminder banner is showing a weather / high-risk
  // message, the RiskAlertsPanel below must NOT repeat the same
  // category — priority rule: critical risk > weather > generic
  // reminder. We also hide the banner when the farmer has dismissed
  // it for the current cycle (day).
  const [dismissBump, setDismissBump] = useState(0);

  function dismissTopAlert(alertId, messageKey) {
    if (!alertId) return;
    dismissAlert(alertId, messageKey || '');
    setDismissBump((n) => n + 1);
  }

  // Is the top reminder banner actually on screen right now? We use
  // this both to pick the <RiskAlertsPanel> suppression set AND to
  // read `dismissBump` so the memo invalidates on every dismiss.
  const topBannerActive = useMemo(() => {
    // eslint-disable-next-line no-unused-vars
    const _bump = dismissBump;
    if (!reminder.show) return false;
    const content = t(reminder.messageKey) || reminderFallback(reminder.kind);
    return !isAlertDismissed(`reminder:${reminder.kind}`, content);
  }, [reminder.show, reminder.kind, reminder.messageKey, dismissBump, t]);
  const topBannerKind = reminder.kind || null;

  // ─── Live weather summary (Open-Meteo via weatherService) ──
  // Fetched once per active-cycle change. Falls back to the
  // server-provided `state.today.weatherRisk` when lat/lng aren't
  // available or the API is unreachable (offline mode).
  const [liveWeather, setLiveWeather] = useState(null);
  useEffect(() => {
    const activeFarm = getActiveFarm();
    const lat = activeCycle?.latitude
      ?? activeFarm?.latitude
      ?? region?.lat
      ?? null;
    const lng = activeCycle?.longitude
      ?? activeFarm?.longitude
      ?? region?.lng
      ?? null;
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      setLiveWeather(null);
      return;
    }
    let cancelled = false;
    weatherService.getSummary({ lat, lng }).then((summary) => {
      if (!cancelled) setLiveWeather(summary || null);
    }).catch(() => { if (!cancelled) setLiveWeather(null); });
    return () => { cancelled = true; };
  }, [activeCycle, region]);

  // ─── Task Engine snapshot (deterministic, offline-first) ───
  // Generates stage + crop + weather-aware tasks from pure inputs.
  // Used as the source of truth when the server feed has no primary
  // task, and always piped into the Progress Engine below so
  // nextBestAction stays aligned with the current farming context.
  const weatherSummary = useMemo(() => {
    // Prefer the live Open-Meteo summary when we have one; otherwise
    // derive from the server-provided weatherRisk.
    if (liveWeather && liveWeather.status && liveWeather.status !== 'unavailable') {
      return {
        rainSoon:  liveWeather.status === 'low_rain' || liveWeather.status === 'dry_ahead',
        heavyRain: false, // reserved — Open-Meteo summary doesn't flag this
        dry:       liveWeather.status === 'low_rain' || liveWeather.status === 'dry_ahead',
        severe:    liveWeather.status === 'excessive_heat',
      };
    }
    const wr = state.today?.weatherRisk || null;
    if (!wr) return null;
    const level = wr.overallWeatherRisk;
    return {
      rainSoon:  level === 'medium' || level === 'high',
      heavyRain: level === 'high',
      dry:       level === 'dry',
      severe:    level === 'severe',
    };
  }, [liveWeather, state.today]);

  const engineSnapshot = useMemo(() => generateTasks({
    farm:     activeCycle || null,
    crop:     activeCycle?.cropType || null,
    stage:    activeCycle?.lifecycleStatus || null,
    weather:  weatherSummary,
    location: region || null,
    completions: getTaskCompletions(),
  }), [activeCycle, weatherSummary, region, progressTick]);

  // ─── Journey state — derived once per render and persisted ──
  // Keeps the single source of truth (farroway.journeyState) in sync
  // with the live signals (profile/farm/cycle) without forcing the
  // user through a recovery route.
  const journeySnapshot = useMemo(() => {
    const stored = getJourneyState();
    const activeFarm = getActiveFarm();
    const derived = deriveJourneyState({
      profile:     null,               // server profile isn't needed on Today
      activeFarm,
      activeCycle: activeCycle || null,
      completions: getTaskCompletions(),
      journeyRecord: stored,
    });
    return derived;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCycle, progressTick]);

  // Persist when the derived state moves forward. Never regresses.
  useEffect(() => {
    const stored = getJourneyState();
    if (stored.state !== journeySnapshot.state
        || stored.crop !== (journeySnapshot.crop || null)
        || stored.farmId !== (journeySnapshot.farmId || null)
        || stored.plantedAt !== (journeySnapshot.plantedAt || null)) {
      setJourneyState({
        state:      journeySnapshot.state,
        crop:       journeySnapshot.crop   || null,
        farmId:     journeySnapshot.farmId || null,
        plantedAt:  journeySnapshot.plantedAt  || null,
        harvestedAt:journeySnapshot.harvestedAt || null,
      });
    }
  }, [journeySnapshot]);

  // ─── Notification checks (spec §6 — run on open) ────────────
  // Fires once per day per rule thanks to the generator's built-in
  // dedup keyed by rule id + day (or week for harvest).
  const [notifTick, setNotifTick] = useState(0);
  useEffect(() => {
    const stored = getJourneyState();
    runNotificationChecks({
      tasks: [
        primaryTask ? { id: primaryTask.id } : null,
        ...(secondaryTasks || []).map((t2) => ({ id: t2.id })),
      ].filter(Boolean),
      completions: getTaskCompletions(),
      loopFacts: {
        lastVisit:   stored.lastUpdatedAt || null,
        missedDays:  null,
        streak:      null,
      },
      journey:     { ...stored, state: journeySnapshot.state, crop: journeySnapshot.crop,
                     plantedAt: journeySnapshot.plantedAt, enteredAt: stored.enteredAt },
      weatherSummary: null,
    });
    setNotifTick((n) => n + 1);
    // Re-run once per navigation + on every progress change so a
    // just-completed task can flip the daily reminder off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeySnapshot, progressTick]);

  // ─── Daily-task engine (v1 starter tasks) ───────────────────
  // Layered below the stage-aware engineSnapshot so newly-onboarded
  // farmers (no active cycle yet) still see a useful today task.
  // Reads crop / country / state from the local active farm when
  // the server cycle hasn't been created yet.
  const dailySnapshot = useMemo(() => {
    const activeFarm = getActiveFarm();
    const crop = activeCycle?.cropType || activeFarm?.crop || null;
    const stage = activeCycle?.lifecycleStatus || null;
    const plantingStatus = inferPlantingStatus({
      cropStage: stage,
      crop,
      country: activeFarm?.country || null,
      state:   activeFarm?.state   || null,
    });
    return generateDailyTasks({
      crop, stage, plantingStatus,
      completions: getTaskCompletions(),
      weather: liveWeather || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCycle, progressTick, liveWeather]);

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

  // Is today's primary task already completed? Checked against the
  // local completions store so the daily reminder can stand down.
  const todayPrimaryDone = useMemo(() => {
    if (!primaryTask?.id) return false;
    const completions = getTaskCompletions();
    const todayIso = new Date().toDateString();
    return completions.some((c) => c && c.completed !== false
      && String(c.taskId) === String(primaryTask.id)
      && new Date(c.timestamp || 0).toDateString() === todayIso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryTask, progressTick]);

  // ─── Daily reminder (offline-first, computed locally) ─────
  // Evaluates the reminderEngine against local completions + the
  // server-derived weather summary so the Today page can surface a
  // single actionable banner.
  const reminder = useMemo(() => {
    // Prefer the live weather summary (Open-Meteo) when available so
    // the reminder engine can surface weather_warning / high_risk
    // banners from real rainfall + temperature signals.
    const weatherForReminder = liveWeather && liveWeather.status !== 'unavailable'
      ? liveWeather
      : weatherSummary;
    return evaluateReminder({
      weather: weatherForReminder,
      riskLevel: state.today?.overallRisk?.level || 'low',
      completions: getTaskCompletions(),
      hasActiveFarm: !!(activeCycle?.id || getActiveFarmId()),
      todayPrimaryDone,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveWeather, weatherSummary, state.today, activeCycle, todayPrimaryDone, progressTick]);

  // Mark the daily reminder as shown once per day so we don't flash
  // it again on every navigation, AND fire a browser notification
  // once (spec §9) when the user has opted in + granted permission.
  useEffect(() => {
    if (!reminder.show) return;
    if (reminder.kind === 'daily') {
      markReminderShown();
    }
    // Fire a single OS notification on the transition. We tag by
    // kind+today so the same reminder doesn't re-notify if React
    // remounts — the browser dedupes by tag.
    const todayStr = new Date().toDateString();
    sendBrowserNotification({
      title: (t && t(reminder.messageKey)) || 'Farroway',
      body:  (t && t('notifications.settings_title')) || '',
      tag:   `farroway.${reminder.kind}.${todayStr}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminder.show, reminder.kind, reminder.messageKey]);

  // Browser-push permission: only ask AFTER engagement signals fire
  // (spec §3). Never on the first-open screen. Uses the NGO event
  // log + the fact that touchLastVisit just ran to detect a second
  // visit.
  const [permissionAsk, setPermissionAsk] = useState(false);
  useEffect(() => {
    const events = getAllFarmEvents();
    const secondVisitOrLater = !!loopFacts.lastVisit
      && loopFacts.lastVisit !== null
      && !loopFacts.firstVisitToday === false; // re-opened today
    const ok = shouldRequestBrowserPermission({
      events,
      secondVisitOrLater: secondVisitOrLater || !loopFacts.firstVisitToday,
    });
    if (ok) setPermissionAsk(true);
  }, [loopFacts.firstVisitToday, loopFacts.lastVisit]);

  async function handleAcceptBrowserPush() {
    setPermissionAsk(false);
    await requestBrowserPush();
  }
  function handleDismissBrowserPush() {
    setPermissionAsk(false);
    // Mark "asked" so we don't re-prompt in the same session.
    // Import updateSettings lazily via the engine.
    import('../../lib/notifications/reminderEngine.js').then((m) => {
      m.updateSettings({ askedBrowserPermission: true });
    }).catch(() => {});
  }

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
    // v1 daily-task fallback — used when both the server feed and the
    // stage-aware engine produced nothing actionable (typical for a
    // farmer who just finished onboarding but has no cycle yet).
    const dailyTasks = (dailySnapshot.today || []).map((dt) => ({
      id: dt.id, titleKey: dt.titleKey, priority: dt.priority,
    }));
    const mergedTasks = serverTasks.length > 0
      ? serverTasks
      : (engineTasks.length > 0 ? engineTasks : dailyTasks);
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
  }, [primaryTask, secondaryTasks, activeCycle, engineSnapshot, dailySnapshot, loopFacts, progressTick]);

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
  // Localise the next-best-action title. Bridge actions use a stable
  // i18n key; task actions come from the server with English titles
  // (or a titleKey on the engine path), so we route through
  // getLocalizedTaskTitle which consults the task-id map first and
  // then the phrase-based fallback (gap-fix bc23833) before giving up.
  const nextBestActionText = (() => {
    const nba = progressSnapshot.nextBestAction;
    if (nba.kind === 'bridge') {
      return t(nba.bridgeKey) || null;
    }
    if (nba.titleKey) {
      const fromKey = t(nba.titleKey);
      if (fromKey) return fromKey;
    }
    return getLocalizedTaskTitle(nba.taskId, nba.title, language) || nba.title || null;
  })();

  function handleOptionalCheck(item) {
    // Re-use the issue-reporter modal for "Scan crop for issues" so
    // farmers who spot something can report it in one tap; the other
    // checks just navigate to detail screens we don't force routing
    // on here.
    if (item.code === 'scan_crop') openIssueModal();
  }

  // ─── Snippet ref §1: dynamic greeting (Good morning / etc.) ──
  // The hook is a thin wrapper around getDynamicGreeting; it
  // returns { title, subtitle } already localised via t(). Inputs
  // are derived from data already on the page so no new fetches.
  const greeting = useDynamicGreeting({
    hasCompletedOnboarding: journeySnapshot.state !== 'onboarding',
    hasActiveCropCycle:     !!activeCycle,
    todayState:
      progressSnapshot?.status === 'great_progress'   ? 'all_done'
      : progressSnapshot?.completedCount > 0          ? 'in_progress'
      :                                                  'no_progress',
    missedDays:             0,
    hasJustCompletedHarvest: journeySnapshot.state === 'harvest_complete',
    cropLabel:              cropLabel || '',
  }, t);

  // ─── Snippet ref §2: weather alert pill ───────────────────────
  // Reuses the page's existing `liveWeather` state (declared
  // above ~line 381) so we don't double-subscribe to the weather
  // context. The page's status enum (`excessive_heat`, `low_rain`,
  // `dry_ahead`) is mapped to the deriveWeatherRisk signal
  // vocabulary so the alert pill reads from the same model the
  // rest of the intelligence layer uses. Hidden on calm days.
  const weatherForAlert = useMemo(() => {
    if (!liveWeather || typeof liveWeather !== 'object') return null;
    const s = liveWeather.status;
    return {
      hot:     s === 'excessive_heat',
      dry:     s === 'low_rain' || s === 'dry_ahead',
      drySpell:s === 'low_rain' || s === 'dry_ahead',
      // Carry whatever booleans the upstream payload set, so a
      // future heavy-rain status enum surfaces automatically.
      heavyRain: !!liveWeather.heavyRain,
      highWind:  !!liveWeather.highWind,
      severe:    !!liveWeather.severe,
    };
  }, [liveWeather]);
  const weatherRisk = useMemo(
    () => deriveWeatherRisk(weatherForAlert),
    [weatherForAlert],
  );
  const HIGH_IMPACT = ['heavy_rain', 'high_wind', 'hot', 'dry_spell'];
  const alertSignal = (weatherRisk?.signals || [])
    .find((s) => HIGH_IMPACT.includes(s));
  const alertText = alertSignal
    ? tStrict(`farm.suggest.weatherRisk.${alertSignal}`,
        tStrict('farm.suggest.weatherRisk', ''))
    : '';

  return (
    <Shell>
      {/* Greeting block — small title + subtitle. Renders only
          when the hook produced text; otherwise silent. */}
      {(greeting?.title || greeting?.subtitle) && (
        <div style={S.greetingWrap} data-testid="today-greeting">
          {greeting.title && (
            <h1 style={S.greetingTitle}>{greeting.title}</h1>
          )}
          {greeting.subtitle && (
            <p style={S.greetingSubtitle}>{greeting.subtitle}</p>
          )}
        </div>
      )}

      {/* Weather alert pill — amber, dismissible-by-context (it
          disappears when the underlying risk subsides). Hidden
          on calm days. */}
      {alertText && (
        <div style={S.weatherAlert} data-testid="today-weather-alert"
             role="status" aria-live="polite">
          <span style={S.weatherAlertIcon} aria-hidden="true">
            {alertSignal === 'heavy_rain'
              ? <CloudRain size={16} />
              : <AlertTriangle size={16} />}
          </span>
          <span>{alertText}</span>
        </div>
      )}

      <h1 style={S.pageTitle}>{t('actionHome.todayHeader')}</h1>

      {/* Top notification — rendered above everything else so high-
          priority alerts are seen first. Hidden when nothing unread. */}
      <NotificationBadge key={`notif-${notifTick}`} />

      {/* 0. Journey summary — single source of truth card. Hidden
          when the farmer still has no crop (onboarding / crop-selection
          states handle routing themselves). */}
      {journeySnapshot.state !== 'onboarding'
        && journeySnapshot.state !== 'crop_selected' && (
        <JourneySummaryCard
          journeyState={journeySnapshot.state}
          cropLabel={cropLabel || journeySnapshot.crop}
          stageLabel={stageLabel}
          progressStatus={progressSnapshot.status}
          progressLabel={progressStatusLabel}
          nextActionText={nextBestActionText}
          stagePercent={progressPercent}
        />
      )}

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

      {/* Reminder banner (spec §4/§5/§6). At most one active card.
          Weather / risk severities win over missed-day / daily. Hidden
          when the farmer has dismissed it for the current cycle — see
          farrowayLocal.isAlertDismissed + §5 "dismiss memory". */}
      {topBannerActive && (
        <div
          style={{
            ...S.reminderBanner,
            ...reminderBannerStyleFor(reminder.severity),
          }}
          role="status"
          aria-live="polite"
          data-testid="reminder-banner"
          data-kind={reminder.kind}
          data-severity={reminder.severity}
        >
          <span style={S.reminderIcon} aria-hidden="true">
            {reminder.severity === 'critical' ? '\u26A0\uFE0F'
              : reminder.severity === 'warning' ? '\uD83D\uDCA1'
              : '\u23F0'}
          </span>
          <span style={S.reminderText}>
            {t(reminder.messageKey) || reminderFallback(reminder.kind)}
          </span>
          <button
            type="button"
            onClick={() => dismissTopAlert(
              `reminder:${reminder.kind}`,
              t(reminder.messageKey) || reminderFallback(reminder.kind),
            )}
            style={S.reminderDismiss}
            aria-label={tSafe('common.dismiss', '')}
            data-testid="reminder-banner-dismiss"
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {/* Browser-push permission ask (spec §3). Delayed until the
          farmer has actual engagement. Dismissal is sticky so we
          don't re-ask on every render. */}
      {permissionAsk && (
        <div style={S.permissionCard} data-testid="browser-permission-ask">
          <span style={S.permissionText}>
            {t('notifications.permission_prompt')
              || tSafe('reminder.permission_ask', '')}
          </span>
          <div style={S.permissionRow}>
            <button
              type="button"
              onClick={handleAcceptBrowserPush}
              style={S.permissionAccept}
              data-testid="browser-permission-accept"
            >
              {tSafe('common.yes', '')}
            </button>
            <button
              type="button"
              onClick={handleDismissBrowserPush}
              style={S.permissionDismiss}
              data-testid="browser-permission-dismiss"
            >
              {tSafe('common.no', '')}
            </button>
          </div>
        </div>
      )}

      {/* Daily loop header — streak pill + entry message + last
          activity (spec §7). First row shown every render; no layout
          jumps between states. */}
      <div style={S.loopRow} data-testid="daily-loop-row">
        <span style={S.streakPill} data-testid="streak-pill">
          {loopFacts.streak > 0
            ? (t('loop.streak_label', { days: loopFacts.streak })
                || `${loopFacts.streak}-day streak`)
            : (tSafe('loop.streak_start', ''))}
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
          <RiskAlertsPanel
            alerts={topBannerActive && topBannerKind === 'high_risk' ? [] : riskAlerts}
            weatherAlerts={topBannerActive && topBannerKind === 'weather' ? [] : weatherAlerts}
            weatherBadge={topBannerActive && topBannerKind === 'weather' ? null : weatherBadge}
          />

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
          <RiskAlertsPanel
            alerts={topBannerActive && topBannerKind === 'high_risk' ? [] : riskAlerts}
            weatherAlerts={topBannerActive && topBannerKind === 'weather' ? [] : weatherAlerts}
            weatherBadge={topBannerActive && topBannerKind === 'weather' ? null : weatherBadge}
          />

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
                {tSafe('progress.next_best_action', '')}
              </span>
              <span style={S.bridgeText}>{nextBestActionText}</span>
            </div>
          )}

          {/* Next-day preview — retention trigger (spec §4). Shown
              in DONE so the farmer always sees what "tomorrow" brings. */}
          {nextDayHint && (
            <div style={S.bridgeCard} data-testid="next-day-preview">
              <span style={S.bridgeLabel}>
                {tSafe('loop.check_tomorrow', '')}
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

      {/* Icon-first action grid for low-literacy farmers — mounts the
          10 primary actions as voice-enabled tiles. The toggle in its
          header switches the whole UI to simple/icon mode. */}
      <FarmerActionGrid />

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

function reminderBannerStyleFor(severity) {
  if (severity === 'critical') return {
    background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)',
    color: '#FCA5A5',
  };
  if (severity === 'warning') return {
    background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)',
    color: '#FDE68A',
  };
  return {
    background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
    color: '#93C5FD',
  };
}

function reminderFallback(kind) {
  if (kind === 'weather_severe') return 'Severe weather — protect your crops.';
  if (kind === 'risk_high')       return 'Rain expected. Prepare today.';
  if (kind === 'missed_day')      return "You missed yesterday. Let's get back on track.";
  return "Today's farm action is ready";
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
  // Snippet ref §1: greeting block above the page title.
  greetingWrap: { margin: '0 0 12px' },
  greetingTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.3,
  },
  greetingSubtitle: {
    margin: '2px 0 0',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.4,
  },
  // Snippet ref §2: amber weather-alert pill. Sits between the
  // greeting and the page title. Only renders when the weather
  // model surfaces a high-impact signal; calm days stay silent.
  weatherAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 0 12px',
    padding: '10px 14px',
    borderRadius: 10,
    background: '#2A1F1F',
    border: '1px solid rgba(245,158,11,0.30)',
    color: '#FDE68A',
    fontSize: '0.85rem',
    lineHeight: 1.4,
  },
  weatherAlertIcon: {
    display: 'inline-flex',
    color: '#FDE68A',
    flex: '0 0 auto',
  },
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
  reminderBanner: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    borderRadius: '14px',
    fontSize: '0.875rem', fontWeight: 600,
  },
  reminderIcon: { fontSize: '1rem', lineHeight: 1 },
  reminderText: { lineHeight: 1.3, flex: 1 },
  reminderDismiss: {
    marginLeft: 'auto', background: 'transparent', border: 'none',
    color: 'rgba(255,255,255,0.7)', fontSize: '1rem', cursor: 'pointer',
    padding: '2px 6px', borderRadius: 6,
  },
  permissionCard: {
    padding: '0.75rem 0.875rem',
    borderRadius: '14px',
    background: 'rgba(14,165,233,0.08)',
    border: '1px solid rgba(14,165,233,0.22)',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
  },
  permissionText: { color: '#EAF2FF', fontSize: '0.875rem', fontWeight: 500 },
  permissionRow: { display: 'flex', gap: '0.5rem' },
  permissionAccept: {
    flex: 1, padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: 'none', background: '#22C55E', color: '#fff',
    fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer',
  },
  permissionDismiss: {
    flex: 1, padding: '0.5rem 0.75rem', borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'transparent', color: '#9FB3C8',
    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  },
};
