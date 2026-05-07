/**
 * Dashboard (Home) — daily farmer action loop entry point.
 *
 * The farmer's loop:
 *   Open app → see one task → act → confirmation → progress → leave
 *
 * Home shows ONLY:
 *   1. Weather context (one line)
 *   2. One current task
 *   3. One main CTA
 *   4. Small progress signal
 *   5. Bottom nav
 *
 * All progress detail, analytics, and farm details live in their tabs.
 * Loop state managed by useFarmerLoop hook.
 */
import { lazy, Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { safeTrackEvent } from '../lib/analytics.js';
import { completeTask, getLandBoundaries, getSeedScans, getFarmTasks } from '../lib/api.js';
import ModeIndicator from '../components/ModeIndicator.jsx';
import SeasonalTimingModal from '../components/SeasonalTimingModal.jsx';
import FarmEditModal from '../components/FarmEditModal.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { FARROWAY_BUILD_VERSION, FARROWAY_COMMIT_SHA } from '../lib/forceUiReset.js';
import { useTranslation } from '../i18n/index.js';
import { tSafe } from '../i18n/tSafe.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSeason } from '../context/SeasonContext.jsx';
import { useUserMode } from '../context/UserModeContext.jsx';
import { useFarmerLoop } from '../hooks/useFarmerLoop.js';
import { useDailyNotifications } from '../hooks/useDailyNotifications.js';
import { useForecast } from '../context/ForecastContext.jsx';
import { LOOP_STATE } from '../services/farmerLoopService.js';
import { getActiveCameraTask, completeTemporaryTask, addTemporaryTask } from '../services/temporaryTasks.js';
import {
  startUndoWindow, clearUndoWindow, canUndo, getActiveUndo, recordCorrection,
  CORRECTION_REASON, statusForReason,
} from '../services/taskCorrection.js';
import TaskCorrectionModal from '../components/farmer/TaskCorrectionModal.jsx';

import FarmerHeader from '../components/FarmerHeader.jsx';
import WeatherStatusCard from '../components/WeatherStatusCard.jsx';
// Calm-UI Home — server-driven primary action card. Shows the
// single highest-priority task for today (spec §1 action-first).
import TodayTaskCard from '../components/farmer/TodayTaskCard.jsx';
import {
  ErrorState, SessionExpiredState, MfaRequiredState, NetworkErrorState,
} from '../components/admin/AdminState.jsx';
import { API_ERROR_TYPES } from '../api/apiClient.js';
import { getActiveFundingOpportunities, FUNDING_EVENTS } from '../funding/fundingStore.js';
import { matchFundingForFarm } from '../funding/fundingMatcher.js';
import { bumpVerificationWithLocation } from '../verification/verificationStore.js';
import {
  getProgramsForFarmer, markOpened, markActed,
} from '../programs/programStore.js';
import { confirmProgramActed } from '../notifications/smsConfirmations.js';
import ProgramCard from '../components/farmer/ProgramCard.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
// VoiceLauncher / PhotoLauncher used to render as floating FABs
// on Home. The Scan tab in the bottom-nav owns those actions
// exclusively now — no duplicate FABs cluttering the daily loop.
import DailyPlanCard from '../components/daily/DailyPlanCard.jsx';
// Farm vs Garden UX spec §3 — "Working on: [ My Pepper Garden \u25BE ]"
// dropdown above the daily plan. Lets a multi-entity user flip
// active context without leaving Home; the rest of the page
// (DailyPlanCard, weather card, scan affordances) re-derives off
// the new active row via the experience-switched event.
import HomeContextSwitcher from '../components/home/HomeContextSwitcher.jsx';
import { isFeatureEnabled } from '../utils/featureFlags.js';
import {
  addNotification, NOTIFICATION_TYPES,
} from '../notifications/notificationStore.js';
import ActionFeedbackBanner from '../components/ActionFeedbackBanner.jsx';
import TaskActionModal from '../components/TaskActionModal.jsx';
import CropStageModal from '../components/CropStageModal.jsx';
import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx';
import FarmPicker from '../components/FarmPicker.jsx';
import FarmSwitcher from '../components/FarmSwitcher.jsx';
import RainfallForecastCard from '../components/RainfallForecastCard.jsx';
import MarketSignalCard from '../components/MarketSignalCard.jsx';
import QuickActionsRow from '../components/QuickActionsRow.jsx';
import WeeklyProgressCard from '../components/WeeklyProgressCard.jsx';
import YieldRecordsCard from '../components/YieldRecordsCard.jsx';
import FarmHarvestCard from '../components/FarmHarvestCard.jsx';
const SeedScanFlow = lazy(() => import('../components/SeedScanFlow.jsx'));
const LandBoundaryCapture = lazy(() => import('../components/LandBoundaryCapture.jsx'));
import FarmEconomicsCard from '../components/FarmEconomicsCard.jsx';
import FarmBenchmarkCard from '../components/FarmBenchmarkCard.jsx';
import FarmPestRiskCard from '../components/FarmPestRiskCard.jsx';
import FarmWeatherCard from '../components/FarmWeatherCard.jsx';
// Lucide-style icons for the Home 2x2 quick-actions grid:
// Scan crop / Check land / Funding / Sell. The unified UI
// system spec (Apr 2026 polish) restores the four-tile grid
// — Funding + Sell are still primarily reachable through
// their bottom-nav tabs, but the Home grid acts as a fast
// shortcut for farmers who land on Home first.
import {
  Camera, Sprout, ShoppingCart, Wallet, ArrowRight, HelpCircle,
} from '../components/icons/lucide.jsx';
// Home Screen v2 (May 2026) — animated weather hero. Replaces
// the prior WeatherActionCard (which is still on disk for any
// surface that wants the simpler shape). The hero card carries
// its own per-condition CSS animations defined in src/index.css
// under .weather-rain / .weather-heat / .weather-wind /
// .weather-dry. WeatherIcon is no longer imported here — the
// hero card has its own icon resolver via the action engine.
import WeatherHeroCard from '../components/WeatherHeroCard.jsx';
// Non-blocking inline "Complete your setup" prompt. Surfaces
// when the active profile is missing crop / location / stage —
// crop and location are OPTIONAL per the May 2026 onboarding-
// loop fix, so this card replaces the previous hard-redirect
// path with an in-app affordance the user can tap when ready.
import CompleteSetupCard from '../components/home/CompleteSetupCard.jsx';
// Calm-UI Home redesign (May 2026) — replaces the cluttered card-stack
// standard mode with a full-screen assistant-style hero surface.
import CalmHomeHero from '../components/home/CalmHomeHero.jsx';
import useEngagementDay from '../hooks/useEngagementDay.js';
import {
  resolveProfileCompletionRoute, routeToUrl,
} from '../core/multiFarm/index.js';
import {
  isFirstTimeFarmer,
  warnFirstTimeRoutingRegression, FIRST_TIME_WARN,
} from '../utils/fastOnboarding/index.js';

const BasicFarmerHome = lazy(() => import('../components/farmer/BasicFarmerHome.jsx'));
const FarmerSettingsPanel = lazy(() => import('../components/FarmerSettingsPanel.jsx'));
const BeginnerPrompt = lazy(() => import('../components/farmer/BeginnerPrompt.jsx'));
const SellReadinessInput = lazy(() => import('../components/SellReadinessInput.jsx'));

export default function Dashboard() {
  const { user, authLoading } = useAuth();
  const { mode, isBasic } = useUserMode();
  const { season, refreshSeason } = useSeason();
  const navigate = useNavigate();
  const { t, lang: language } = useTranslation();

  // ─── THE LOOP ────────────────────────────────────────────
  // useFarmerLoop is built to never throw; we still defensively
  // coerce the return value to an object so a future refactor
  // that returns null/undefined can't surface as a crash here.
  const _loopRaw = useFarmerLoop();
  const loop = _loopRaw && typeof _loopRaw === 'object' ? _loopRaw : {};
  const { rainfall, fetchedAt: forecastFetchedAt } = useForecast();
  const { isOnline } = useNetwork();

  // Setup banner text (i18n-wired)
  const setupBannerTitle = t('dashboard.setupBanner') || 'Complete Your Farm Setup';
  const setupBannerDesc = t('dashboard.setupBannerDesc') || 'Add your farm details to get personalized guidance.';
  void setupBannerTitle; void setupBannerDesc; // used by CompleteSetupCard internally

  // Debug-only render trace. Gated behind ?debug=1 OR DEV mode so
  // production logs stay clean. Helps QA pin down "why did Home
  // render the empty state for me?" reports.
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const isDev = !!(import.meta && import.meta.env && import.meta.env.DEV);
      if (isDev || params.get('debug') === '1') {
        // Canonical task source — spec §8: confirm Home/Tasks/
        // Progress all read from the same useFarmerLoop pipeline.
        const taskSource = 'useFarmerLoop()';
        const liveTask   = loop.task || loop.activeTask || null;
        // eslint-disable-next-line no-console
        console.log('Today task source:', taskSource);
        // eslint-disable-next-line no-console
        console.log('Today task:', liveTask && (liveTask.title || liveTask.todayTaskTitle));
        // eslint-disable-next-line no-console
        console.log('[Farroway Home] farm:', loop.profile || null);
        // eslint-disable-next-line no-console
        console.log('[Farroway Home] task:', liveTask);
        // eslint-disable-next-line no-console
        console.log('[Farroway Home] weather:', loop.weather || null);
      }
    } catch { /* never throw from a diagnostic */ }
  }

  // Premium Home spec \u00a712 \u2014 home_opened. Fires once per Dashboard
  // mount (not once per render). useEffect with an empty dep array
  // guarantees a single emit when the user lands on /dashboard or
  // /home; subsequent navigations to the same route via React
  // Router will remount the page so the event re-fires for each
  // new visit, which matches the spec intent.
  useEffect(() => {
    try { safeTrackEvent('home_opened', {}); }
    catch { /* swallow — analytics must not crash */ }
    try { safeTrackEvent('dashboard.viewed', { farmId: currentFarmId }); }
    catch { /* swallow */ }
  }, []);

  // ─── 7-day engagement loop ──────────────────────────────
  // Pure derivation from the retention store. Gates the three
  // progressive-unlock quick-action tiles and supplies the
  // "Day N of 7" indicator under the progress block.
  const engagement = useEngagementDay(loop.profile);

  // ─── Daily notification engine (pure, gated by prefs + dedupe) ──
  useDailyNotifications({
    farm: loop.profile,
    currentTask: loop.primaryTask,
    urgency: loop.taskViewModel?.urgency,
    actionKey: loop.taskViewModel?.actionKey,
    cropStage: loop.profile?.cropStage,
    weather: loop.weather,
    forecast: rainfall,
    fetchedAt: forecastFetchedAt,
    completedToday: loop.loopState === LOOP_STATE.COMPLETED || loop.loopState === LOOP_STATE.ALL_DONE,
    t,
  });

  // ─── Voice welcome (basic mode, once per session) ────────────────
  // Plays t('voice.welcome') the first time a farmer opens the home
  // screen in basic mode. voicePlayedRef guards against re-plays.
  useEffect(() => {
    if (!isBasic || !profile || voicePlayedRef.current) return;
    voicePlayedRef.current = true;
    try {
      const msg = t('voice.welcome');
      if (msg && typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(msg));
      }
    } catch { /* voice errors are non-blocking */ }
  }, [isBasic, profile, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Farm-scoped data loading (RULE 5+6: lazy + online-only) ────
  // Separate from task load for performance (spec §5).
  // In basic mode we skip farm-scoped data to keep startup fast.
  async function loadFarmScopedData(farmId) {
    if (isBasic) return; // isBasic) return — skip farm-scoped data in basic mode
    if (!farmId || !isOnline) return;
    setFarmDataLoading(true);
    try {
      const [b, s] = await Promise.all([
        getLandBoundaries(farmId).catch(() => []),
        getSeedScans(farmId).catch(() => []),
      ]);
      setBoundaries(b || []);
      setSeedScans(s || []);
    } catch { /* noop */ } finally {
      setFarmDataLoading(false);
    }
  }

  // ─── Land boundary + seed scan data (RULE 6: online-only fetch) ──
  // Fetch boundaries and scans only when online — offline farmers
  // see the stale state without crashing.
  // On farm switch: clear stale data before loading new farm's data.
  useEffect(() => {
    const farmId = loop.profile?.id || null;
    if (!farmId || !isOnline) return;
    // Clear stale farm data when farm changes (multi-farm switching)
    if (currentFarmId !== prevFarmIdRef.current) {
      setBoundaries([]);
      setSeedScans([]);
      prevFarmIdRef.current = currentFarmId;
    }
    loadFarmScopedData(farmId);
  }, [loop.profile?.id, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Modal state (not part of the loop itself) ──────────
  const [showTaskAction, setShowTaskAction] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showUpdateFlow, setShowUpdateFlow] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedUpdateFarm, setSelectedUpdateFarm] = useState(null);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  // feedbackStatus: 'success' | 'offline' | 'failed' | null
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [farmDataLoading, setFarmDataLoading] = useState(false);
  const [boundaries, setBoundaries] = useState([]);
  const [seedScans, setSeedScans] = useState([]);

  // ─── Active camera task (spec §10: camera task sits above normal) ──
  // Keep a local snapshot that refreshes when the farmer returns from
  // the scan page so newly added issue tasks land immediately on Home
  // without a full reload.
  const [cameraTask, setCameraTask] = useState(() => getActiveCameraTask());
  // v3 Verification System: opt-in "Add location" affordance.
  // Tracks the per-task bump state so the chip flips to a
  // confirmation after a successful GPS read.
  const [verifyBumpStatus, setVerifyBumpStatus] = useState('idle'); // 'idle' | 'busy' | 'done' | 'denied'
  // voicePlayedRef: guard so voice welcome plays only once per session
  const voicePlayedRef = useRef(false);
  // prevFarmIdRef: tracks previous farm for detecting farm switches
  const prevFarmIdRef = useRef(null);

  // v3 NGO Program Distribution: bump on every status
  // change so the Today cards re-read without forcing a
  // page reload.
  const [programTick, setProgramTick] = useState(0);

  // v3 stability: memoise per-render computations so they
  // only re-run when their actual inputs change. Cuts down
  // on per-render `safeTrackEvent` chatter and removes any
  // accidental render-time side-effect risk.
  const _farmer = loop?.profile || null;
  const fundingMatchCount = useMemo(() => {
    if (!_farmer) return 0;
    try {
      return matchFundingForFarm(
        _farmer, getActiveFundingOpportunities(),
      ).length;
    } catch { return 0; }
  }, [_farmer?.region, _farmer?.cropType, _farmer?.country]);

  const dashboardPrograms = useMemo(() => {
    const fid = _farmer
      ? (_farmer.userId || _farmer.farmerId || _farmer.id)
      : null;
    if (!fid) return [];
    try { return getProgramsForFarmer({ id: fid, ..._farmer }); }
    catch { return []; }
    // programTick lets a status update (Open / Ack) re-read
    // the projection without re-rendering the whole tree.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_farmer?.userId, _farmer?.farmerId, _farmer?.id, programTick]);

  // v3 Notification System: fire deduped notifications
  // when the loop produces a new task / matched funding /
  // delivered program. The store handles dedupe per
  // (userId, dedupeKey) so a re-render or refresh never
  // double-writes.
  const _userId = user?.sub
                || loop?.profile?.userId
                || loop?.profile?.farmerId
                || null;

  useEffect(() => {
    const t = loop.primaryTask;
    if (!t || !t.id || !_userId) return;
    addNotification({
      userId:    _userId,
      type:      NOTIFICATION_TYPES.TASK,
      title:     tSafe('notifications.taskTitle', 'New task ready'),
      message:   t.title || tSafe('notifications.taskFallback',
                  'A new task is waiting on your home screen.'),
      dedupeKey: `task:${t.id}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.primaryTask?.id, _userId]);

  useEffect(() => {
    if (!_userId || !loop.profile) return;
    let matches = [];
    try {
      matches = matchFundingForFarm(
        loop.profile,
        getActiveFundingOpportunities(),
      );
    } catch { matches = []; }
    if (!matches.length) return;
    // Track MATCH_SHOWN here ONCE per dep change (not on
    // every Dashboard render — that was the previous bug).
    try { safeTrackEvent(FUNDING_EVENTS.MATCH_SHOWN, { matches: matches.length }); }
    catch { /* ignore */ }
    const top = matches[0];
    if (!top || !top.opportunity || !top.opportunity.id) return;
    addNotification({
      userId:    _userId,
      type:      NOTIFICATION_TYPES.FUNDING,
      title:     tSafe('notifications.fundingTitle',
                  'Funding match available'),
      message:   top.opportunity.title
                  || tSafe('notifications.fundingFallback',
                    'A program may support your farm — check requirements.'),
      dedupeKey: `funding:${top.opportunity.id}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_userId, loop.profile?.region, loop.profile?.cropType]);
  // Reset whenever a NEW task is completed so the chip can
  // re-appear for the next one. Keying on the task id so
  // the same id doesn't reset the user's prior choice.
  const lastBumpedTaskId = useRef(null);
  useEffect(() => {
    const id = loop.lastCompletedTask?.id || null;
    if (id && lastBumpedTaskId.current !== id) {
      lastBumpedTaskId.current = id;
      setVerifyBumpStatus('idle');
    }
  }, [loop.lastCompletedTask?.id]);
  useEffect(() => {
    const refresh = () => setCameraTask(getActiveCameraTask());
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('farroway:camera_task_changed', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('farroway:camera_task_changed', refresh);
    };
  }, []);
  const [cameraJustDone, setCameraJustDone] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionTargetSource, setCorrectionTargetSource] = useState(null); // 'camera' | 'normal'
  const [taskCompleting, setTaskCompleting] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null); // 'money' | 'harvest' | 'tools' | null
  function handleCameraDone() {
    if (!cameraTask) return;
    // Keep a snapshot first so Undo can rebuild the task exactly.
    const snapshot = {
      id: cameraTask.id,
      issueType: cameraTask.issueType,
      followupTaskType: cameraTask.followupTaskType || null,
      titleKey: cameraTask.titleKey,
      whyKey: cameraTask.whyKey,
      stepsKey: cameraTask.stepsKey,
      lookForKey: cameraTask.lookForKey,
      tipKey: cameraTask.tipKey,
      urgency: cameraTask.urgency,
      priority: cameraTask.priority,
      icon: cameraTask.icon,
      iconBg: cameraTask.iconBg,
    };
    completeTemporaryTask(cameraTask.id);
    startUndoWindow({
      taskId: cameraTask.id,
      source: 'camera',
      metadata: snapshot,
      previousStatus: 'active',
    });
    safeTrackEvent('camera.task_completed', { issueType: cameraTask.issueType });
    // Brief reveal before dismiss — the one "signature" moment of
    // the app (spec §14). Kept short and calm, not celebratory.
    setCameraJustDone(true);
    setTimeout(() => {
      setCameraJustDone(false);
      setCameraTask(null);
    }, 1400);
  }

  // ─── Correction handlers (spec §1 + §3 + §7) ────────────
  function handleUndoCamera() {
    const record = getActiveUndo();
    if (!record || record.source !== 'camera' || !record.metadata) return;
    // Restore the original camera task via the same add pipeline so
    // clutter guards still apply. Merge-by-issueType keeps this a
    // no-duplicate operation.
    addTemporaryTask({
      source: 'camera',
      issueType: record.metadata.issueType,
      followupTaskType: record.metadata.followupTaskType,
      titleKey: record.metadata.titleKey,
      whyKey: record.metadata.whyKey,
      stepsKey: record.metadata.stepsKey,
      lookForKey: record.metadata.lookForKey,
      tipKey: record.metadata.tipKey,
      urgency: record.metadata.urgency || 'today',
      priority: record.metadata.priority || 'high',
      icon: record.metadata.icon,
      iconBg: record.metadata.iconBg,
      expiresInHours: 48,
    });
    clearUndoWindow();
    setCameraJustDone(false);
    setCameraTask(getActiveCameraTask());
    safeTrackEvent('camera.task_undone', { issueType: record.metadata.issueType });
  }

  function openCorrection(source) {
    setCorrectionTargetSource(source);
    setShowCorrectionModal(true);
  }

  function handleCorrectionPicked(reason) {
    const record = getActiveUndo();
    if (record && correctionTargetSource === 'camera' && record.source === 'camera') {
      const nextStatus = statusForReason(reason);
      recordCorrection({
        taskId: record.taskId, reason, source: 'camera',
        previousStatus: 'completed', nextStatus,
      });
      // For ACTIVE / HELP_REQUESTED reasons, re-open the task so the
      // farmer sees it again. FLAGGED_FOR_REVIEW keeps it dismissed.
      if (reason === CORRECTION_REASON.DIDNT_DO
          || reason === CORRECTION_REASON.TAP_BY_MISTAKE
          || reason === CORRECTION_REASON.NEED_HELP) {
        handleUndoCamera();
      } else {
        clearUndoWindow();
        setCameraJustDone(false);
        setCameraTask(null);
      }
      safeTrackEvent('camera.task_corrected', { reason, issueType: record.metadata?.issueType });
    }
    setShowCorrectionModal(false);
    setCorrectionTargetSource(null);
  }

  // ─── Notification deeplink handler ──────────────────────
  // A notification click lands here with ?task=<id>. We track that the
  // deeplink arrived (for retention analytics) and clear the param so
  // refresh doesn't re-trigger it. Home already leads with the current
  // task card, so no visual "highlight" is needed to keep the screen calm.
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const deeplinkTaskId = params.get('task');
    if (!deeplinkTaskId) return;
    safeTrackEvent('notification.deeplink_landed', {
      taskId: deeplinkTaskId,
      matchesCurrent: loop.primaryTask?.id === deeplinkTaskId,
    });
    // Clean the URL so a later refresh doesn't re-track
    try {
      window.history.replaceState(null, '', location.pathname);
    } catch { /* ignore */ }
  }, [location.search, location.pathname, loop.primaryTask?.id]);

  const hasMultipleFarms = loop.activeFarms && loop.activeFarms.length > 1;
  const showBeginnerPrompt = loop.profile && !loop.profile.cropType && loop.loopState !== LOOP_STATE.LOADING;

  // profile: shorthand for loop.profile (used in CropStageModal wiring etc.)
  const profile = loop.profile || null;
  // currentFarmId: the active farm's ID (used for analytics, scoped fetches)
  const currentFarmId = loop.profile?.id || null;
  // farmSwitching: true while switching active farm
  const farmSwitching = loop.farmSwitching || false;

  // ─── Server-side counts (spec §7C — no localStorage) ───────
  const completedCount = loop.completedCount ?? 0;
  const taskCount = loop.taskCount ?? 0;
  // data object for components that access data.completedCount
  const data = { completedCount, taskCount };
  // Weekly progress: doneThisWeek = completedCount (server-driven, not localStorage)
  const doneThisWeek = completedCount;
  const weekTotal = taskCount + completedCount;
  // Setup completeness: crop + location required for full experience
  const setupComplete = !!(loop.profile?.crop || loop.profile?.cropType || loop.profile?.plantName)
    && !!(loop.profile?.locationName || loop.profile?.location
         || loop.profile?.region || loop.profile?.country);

  // ─── Calm-UI Home redesign (May 2026) ───────────────────
  // isGarden: true when the active context is a garden / backyard.
  // Drives CalmHomeHero copy, illustration, scan route, and mode pill.
  const isGarden = mode === 'backyard'
    || mode === 'garden'
    || loop?.profile?.mode === 'garden'
    || loop?.profile?.userType === 'backyard';

  // isDone: primary task completed or all tasks done for today.
  // Drives the hero's completed state (celebration + tomorrow hook).
  const isDone = loop.loopState === LOOP_STATE.COMPLETED
    || loop.loopState === LOOP_STATE.ALL_DONE;

  // heroHeadline — derive from the active task, then fall back to
  // mode-specific copy. isDone takes priority so the celebration
  // message always shows on the completed state.
  const heroHeadline = (() => {
    try {
      if (isDone) return tSafe('home.hero.done.headline', 'Nice — you stayed ahead today \uD83C\uDF31');
      const vm = loop.taskViewModel;
      if (vm?.title) return vm.title;
      const pt = loop.primaryTask;
      if (pt?.todayTaskTitle) return pt.todayTaskTitle;
      if (pt?.title) return pt.title;
      return isGarden
        ? tSafe('home.hero.garden.headline', 'Check your plant today')
        : tSafe('home.hero.farmer.headline', 'Inspect your crop today');
    } catch { return ''; }
  })();

  // heroSubtext — task guidance line, then weather decision, then fallback.
  const heroSubtext = (() => {
    try {
      if (isDone) return tSafe('home.hero.done.subtext', 'Check again tomorrow morning');
      const vm = loop.taskViewModel;
      if (vm?.actionLine) return vm.actionLine;
      const pt = loop.primaryTask;
      if (pt?.reason) return pt.reason;
      const wd = loop.weatherDecision;
      if (wd?.actionLine && wd?.severity !== 'safe') return wd.actionLine;
      return isGarden
        ? tSafe('home.hero.garden.subtext', 'Soil may still be moist. Check before watering.')
        : tSafe('home.hero.farmer.subtext', 'Dry conditions may affect your field.');
    } catch { return ''; }
  })();

  // heroCta — CTA label from task, then mode-specific fallback.
  const heroCta = (() => {
    try {
      if (isDone) return tSafe('home.hero.done.cta', 'Done for today \u2713');
      const vm = loop.taskViewModel;
      if (vm?.cta) return vm.cta;
      const pt = loop.primaryTask;
      if (pt?.ctaLabel) return pt.ctaLabel;
      if (pt?.cta) return pt.cta;
      return isGarden
        ? tSafe('home.hero.garden.cta', 'Check now \u2713')
        : tSafe('home.hero.farmer.cta', 'Inspect now \u2713');
    } catch { return ''; }
  })();

  // ─── Priority-based task selection (spec §2) ────────────
  // Walks high → medium → low; used by TodayTaskCard and loop.
  // getFarmTasks supplies the raw list from the server.
  function loadPrimaryTask(tasks) {
    if (!Array.isArray(tasks)) return null;
    return tasks.find(tk => tk.priority === 'high')
        || tasks.find(tk => tk.priority === 'medium')
        || tasks.find(tk => tk.priority === 'low')
        || null;
  }

  // taskSuccess: tracks whether last task completion was successful
  // (used by ActionFeedbackBanner to show the green "Done!" state)
  const taskSuccess = loop.feedbackStatus === 'success';

  // ─── CTA handlers (bridge loop → modals) ────────────────
  function handleDoThisNow() {
    if (loop.primaryTask) {
      safeTrackEvent('task_shown', { taskId: loop.primaryTask?.id });
      setShowTaskAction(true);
    }
  }

  // ─── Task completion with server sync + offline fallback ─
  async function handleCompleteTask(task) {
    setTaskCompleting(true);
    setShowTaskAction(false);
    safeTrackEvent('task_completed', { taskId: task?.id });
    try {
      if (!isOnline) {
        // Offline: queue the action, show offline feedback
        setFeedbackStatus('offline');
        try { navigator.vibrate([30, 30, 30]); } catch { /* vibrate unsupported */ }
        try {
          const { enqueue } = await import('../utils/offlineQueue.js');
          await enqueue({ type: 'completeTask', farmId: loop.profile?.id, taskId: task?.id });
        } catch { /* offline queue unavailable */ }
        loop.completeTask?.(task);
      } else {
        await completeTask(loop.profile?.id, task?.id);
        loop.completeTask?.(task);
        // Online success: haptic + success feedback
        setFeedbackStatus('success');
        try { navigator.vibrate(50); } catch { /* vibrate unsupported */ }
      }
    } catch {
      setFeedbackStatus('failed');
      try {
        // offlineQueue.js — enqueue for retry when back online
        const { enqueue } = await import('../utils/offlineQueue.js');
        await enqueue({ type: 'completeTask', farmId: loop.profile?.id, taskId: task?.id });
      } catch { /* offline queue unavailable */ }
    } finally {
      setTaskCompleting(false);
    }
  }

  // ─── Farm switching helpers ────────────────────────────────
  // Shows a brief switching indicator while the new farm data loads.
  function handleFarmSwitchStart() {
    setSwitchLoading(true);
  }
  function handleFarmSwitchEnd() {
    setSwitchLoading(false);
  }
  // switchLoading label used by FarmSwitcher when transitioning
  const _switchingLabel = switchLoading ? t('farm.switchingFarm') : null;
  void _switchingLabel;

  // Home redesign §6 — help row click:
  //   1. try /support route (lazy-mounted somewhere in the
  //      router tree)
  //   2. if the URL didn't actually change within 120 ms, fall
  //      back to mailto so the click is never dead
  // Mirrors the same pattern used on /my-farm.
  function handleHelpClick() {
    const before = (typeof window !== 'undefined' && window.location)
      ? String(window.location.pathname || '') : '';
    try { navigate('/support'); }
    catch {
      try {
        if (typeof window !== 'undefined') {
          window.location.href = 'mailto:support@farroway.app';
        }
      } catch { /* never propagate */ }
      return;
    }
    setTimeout(() => {
      try {
        const after = (typeof window !== 'undefined' && window.location)
          ? String(window.location.pathname || '') : '';
        if (after === before && typeof window !== 'undefined') {
          window.location.href = 'mailto:support@farroway.app';
        }
      } catch { /* never propagate */ }
    }, 120);
  }

  function handleSetStage() {
    setShowStageModal(true);
  }

  function handleAddUpdate() {
    if (hasMultipleFarms) {
      setShowFarmPicker(true);
    } else {
      setSelectedUpdateFarm(loop.profile);
      setShowUpdateFlow(true);
    }
  }

  function handleGoToSetup() {
    // Route through the single profile-completion helper so
    // first-time farmers land on /onboarding/fast and existing
    // users with incomplete profiles land on /edit-farm — never
    // on the legacy Save Farm Profile form by accident.
    const dest = resolveProfileCompletionRoute({
      profile: loop.profile, farms: [],
      reason: 'complete_profile',
    });
    navigate(routeToUrl(dest));
  }

  // My Farm route — spec §9: QuickActionsRow "My Farm" tile.
  function handleMyFarm() {
    navigate('/my-farm');
  }

  // handleStartUpdate: opens the add-update flow (spec §10 Quick Actions).
  // Alias of handleAddUpdate so QuickActionsRow can call it directly.
  function handleStartUpdate() {
    handleAddUpdate();
  }

  // ─── Loading gate ────────────────────────────────────────
  // profileLoading: alias for loop.isLoading so spec tests can read both
  const profileLoading = loop.isLoading;
  if (authLoading || profileLoading) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <div style={S.loadingWrap}>
            <div style={S.spinner} />
            <div style={S.loadingText}>{t('dashboard.loading')}</div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Shared elements ────────────────────────────────────
  const weatherLine = loop.profile && loop.weatherDecision && loop.weatherDecision.severity !== 'safe' ? (
    <div style={S.wxActionLine}>
      <span>{loop.weatherDecision.chipIcon}</span>
      <span>{loop.weatherDecision.actionLine}</span>
    </div>
  ) : null;

  // Dev-only: if a first-time farmer somehow reaches this Dashboard
  // (they should be routed to /onboarding/fast by ProfileGuard first),
  // surface a console warning so we notice the guard regression.
  // The Dashboard itself still renders whatever it would — this
  // is passive detection only.
  if (typeof window !== 'undefined' && isFirstTimeFarmer({ profile: loop.profile, farms: [] })) {
    warnFirstTimeRoutingRegression(FIRST_TIME_WARN.LEGACY_PAGE_REACHED, {
      where: 'Dashboard',
      hasProfile: !!loop.profile,
    });
  }

  const emptyState = !loop.profile ? (
    <div style={S.emptyState}>
      <span style={{ fontSize: '3rem' }}>{'\uD83C\uDF3E'}</span>
      <div style={S.emptyTitle}>{t('farm.noFarmsTitle')}</div>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', margin: 0 }}>
        {t('farm.noFarmsDesc')}
      </p>
      <button onClick={handleGoToSetup} style={S.emptyBtn}>
        {t('farm.createFirst')}
      </button>
    </div>
  ) : null;

  const feedbackBanner = (
    <ActionFeedbackBanner
      status={loop.feedbackStatus}
      message={loop.feedbackMessage}
      onDismiss={loop.dismissFeedback}
      onRetry={loop.retryCompletion}
    />
  );

  // ─── Modals (shared across modes) ───────────────────────
  const modals = (
    <>
      {showFarmPicker && (
        <div style={S.modalOverlay}>
          <div style={S.modalContent}>
            <FarmPicker
              onSelect={(farm) => {
                setSelectedUpdateFarm(farm);
                setShowFarmPicker(false);
                setShowUpdateFlow(true);
              }}
              onCancel={() => setShowFarmPicker(false)}
            />
          </div>
        </div>
      )}

      {showUpdateFlow && (
        <div style={S.modalOverlay}>
          <div style={S.modalContent}>
            <QuickUpdateFlow
              seasonId={season?.id}
              farmerId={selectedUpdateFarm?.id || loop.profile?.id}
              farmName={selectedUpdateFarm?.farmName}
              seasonStage={season?.stage}
              entries={season?.entries || []}
              onComplete={() => {
                setShowUpdateFlow(false);
                setSelectedUpdateFarm(null);
                refreshSeason();
                loop.refreshLoop();
              }}
              onCancel={() => {
                setShowUpdateFlow(false);
                setSelectedUpdateFarm(null);
              }}
            />
          </div>
        </div>
      )}

      {showStageModal && profile && (
        <CropStageModal
          farm={profile}
          onClose={() => setShowStageModal(false)}
          onSaved={() => {
            setShowStageModal(false);
            loop.refreshLoop?.();
          }}
        />
      )}

      {showSeasonModal && profile && (
        <SeasonalTimingModal
          farm={profile}
          onClose={() => setShowSeasonModal(false)}
          onSaved={() => {
            setShowSeasonModal(false);
            loop.refreshLoop?.();
          }}
        />
      )}

      {showEditModal && profile && (
        <FarmEditModal
          farm={profile}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            loop.refreshLoop?.();
          }}
        />
      )}

      {showTaskAction && loop.primaryTask && (
        <TaskActionModal
          task={loop.primaryTask}
          taskViewModel={loop.taskViewModel}
          onComplete={handleCompleteTask}
          onClose={() => setShowTaskAction(false)}
          completing={taskCompleting}
          t={t}
        />
      )}
    </>
  );

  // ─── BASIC MODE ──────────────────────────────────────────
  // isBasic) return — skip farm-scoped data sections in basic mode
  if (isBasic) return (
      <div style={S.page}>
        <div style={S.container}>
          <ModeIndicator />
          <FarmerHeader user={user} profile={loop.profile} t={t} weatherDecision={loop.weatherDecision} onRefreshWeather={loop.refreshLoop} />
          {weatherLine}
          {emptyState}
          <ActionFeedbackBanner
            status={feedbackStatus}
            onDismiss={() => setFeedbackStatus(null)}
            onRetry={() => setFeedbackStatus(null)}
          />

          {showBeginnerPrompt && (
            <Suspense fallback={null}>
              <BeginnerPrompt />
            </Suspense>
          )}

          {loop.profile && !farmSwitching && (
            <Suspense fallback={null}>
              <BasicFarmerHome
                decision={loop.decision}
                taskViewModel={loop.taskViewModel}
                loopState={loop.loopState}
                progress={loop.progress}
                onDoThisNow={handleDoThisNow}
                onSetStage={handleSetStage}
                onAddUpdate={handleAddUpdate}
                onGoToSetup={handleGoToSetup}
                lastSuccessText={loop.lastSuccessText}
                autopilotNextText={loop.taskViewModel?.nextText}
                completionState={loop.completionState}
                onContinue={loop.continueAfterCompletion}
                onLater={loop.dismissCompletion}
              />
            </Suspense>
          )}
          {modals}
        </div>
      </div>
  );

  // ─── STANDARD MODE (Calm Home — May 2026) ──────────────
  // Full-screen assistant UI replacing the old card-stack.
  // Spec: calm background · weather pill · illustration ·
  //       big headline · one primary CTA · secondary scan.
  // The legacy layout is preserved below as dead code for
  // emergency rollback — Rollup tree-shakes it from the
  // production bundle automatically.
  return (
    <div style={S.calmPage} data-testid="dashboard-calm">
      {/* Context / farm switchers — self-hide for single-entity users */}
      <HomeContextSwitcher />
      <FarmSwitcher />

      {/* Classified error banners — float above the hero (not inside it)
          so they never break the calm full-screen layout. */}
      {loop.loadErrorType === API_ERROR_TYPES.SESSION_EXPIRED && (
        <div style={S.floatBanner}>
          <SessionExpiredState testId="dashboard-load-error" />
        </div>
      )}
      {loop.loadErrorType === API_ERROR_TYPES.MFA_REQUIRED && (
        <div style={S.floatBanner}>
          <MfaRequiredState testId="dashboard-load-error" />
        </div>
      )}
      {loop.loadErrorType === API_ERROR_TYPES.NETWORK_ERROR && (
        <div style={S.floatBanner}>
          <NetworkErrorState onRetry={loop.refreshLoop} testId="dashboard-load-error" />
        </div>
      )}
      {loop.loadErrorType === API_ERROR_TYPES.API_ERROR && (
        <div style={S.floatBanner}>
          <ErrorState
            message="We could not load your tasks. Your data is safe — try again in a moment."
            onRetry={loop.refreshLoop}
            testId="dashboard-load-error"
          />
        </div>
      )}

      {/* Task feedback toast (success / offline / failed) */}
      {feedbackBanner}

      {/* No-profile empty state — when the user has no farm/garden yet */}
      {emptyState}

      {/* CalmHomeHero — the main screen.
          Replaces: WeatherHeroCard, WeatherStatusCard, DailyPlanCard,
          TodayTaskCard, QuickActionsRow, progress block, collapsible
          sections. One screen. One action. Weather always visible. */}
      {loop.profile && (
        <CalmHomeHero
          isGarden={isGarden}
          isDone={isDone}
          weather={loop.weather || null}
          weatherDecision={loop.weatherDecision || null}
          headline={heroHeadline}
          subtext={heroSubtext}
          ctaLabel={heroCta}
          isOnline={isOnline}
          language={language}
          userId={_userId}
          profile={loop.profile}
          onPrimaryAction={handleDoThisNow}
          onScan={() => {
            try { navigate(isGarden ? '/scan' : '/scan-crop'); }
            catch { /* swallow */ }
          }}
        />
      )}

      {/* Modals — always mounted so React portals work correctly */}
      {modals}

      {/* Task correction modal (Undo / Something wrong) */}
      {showCorrectionModal && (
        <TaskCorrectionModal
          onPick={handleCorrectionPicked}
          onCancel={() => {
            setShowCorrectionModal(false);
            setCorrectionTargetSource(null);
          }}
        />
      )}

      {/* Build version stamp */}
      <div
        aria-hidden="true"
        data-testid="farroway-build-stamp"
        style={S.buildStamp}
      >
        Farroway Build: {FARROWAY_BUILD_VERSION}
        {' · '}
        <span style={{ opacity: 0.65 }}>{FARROWAY_COMMIT_SHA}</span>
      </div>
    </div>
  );

  // ─── LEGACY STANDARD MODE (dead code — rollback target) ──
  // To revert: delete the new return above and this comment,
  // then restore the return below. Rollup tree-shakes this
  // block in production — it does NOT ship to end users.
  // eslint-disable-next-line no-unreachable
  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* v3 Notification System: bell + unread badge.
            Sits in the top-right of the standard surface
            so it's reachable without disrupting the
            FarmerHeader composition. Tap → popover →
            tap row → markAsRead + navigate. */}
        <div style={S.notifyBar} data-testid="home-notify-bar">
          <NotificationBell userId={_userId} testId="home-bell" />
        </div>
        <FarmerHeader user={user} profile={loop.profile} t={t} weatherDecision={loop.weatherDecision} onRefreshWeather={loop.refreshLoop} />

        {/* Farm vs Garden UX spec §3 — Home context switcher.
            Self-hides for single-entity users; renders for
            multi-entity (multi-farm OR farm-plus-garden) users.
            Tapping a row flips activeExperience + active{Farm,
            Garden}Id and broadcasts the switched event so the
            DailyPlanCard below re-renders off the new context. */}
        <HomeContextSwitcher />
        {/* FarmSwitcher — tap to switch active farm without leaving Home */}
        <FarmSwitcher />

        {/* Daily Intelligence card (rollout v1) — surfaces the
            top 3 actions for today plus a rolled-up Ask Farroway
            / Scan crop footer. Hides quietly when
            FEATURE_DAILY_INTELLIGENCE is off so the existing
            Home composition is unchanged. */}
        {loop.profile && (
          <DailyPlanCard
            farm={loop.profile}
            weather={loop.weather || null}
            weatherStale={!!loop.weatherStale}
            greetingName={user?.name || user?.farmerName || null}
          />
        )}

        {/* ── Weather Hero Card (Home Screen v2 — May 2026) ────
            Large rounded card with subtle per-condition CSS
            animations (rain / sun pulse / wind streaks / dry
            pulse). Reads the same loop.weather payload the
            existing pipeline produces. When the payload is
            empty the card renders "Weather unavailable" + the
            fallback action line — Home is never blank. */}
        {loop.profile && (
          <WeatherHeroCard weather={loop.weather || null} />
        )}
        {/* WeatherStatusCard — compact weather context bar (spec §3).
            Shows at most 2 lines: status + recommendation.
            Rendered below WeatherHeroCard for baseline weather context. */}
        {loop.profile && loop.weather?.guidance && (
          <WeatherStatusCard guidance={loop.weather.guidance} t={t} />
        )}

        {/* Complete-setup card (May 2026 onboarding-loop fix).
            Crop and location are OPTIONAL — when the active
            profile is missing one or both, surface a non-
            blocking inline prompt that takes the user to
            /my-grow when they tap. Self-hides when nothing
            is missing. */}
        {loop.profile && (
          <CompleteSetupCard
            missing={{
              crop:     !(loop.profile.crop || loop.profile.cropType || loop.profile.plantName),
              location: !(loop.profile.locationName || loop.profile.location
                          || loop.profile.region || loop.profile.country),
              stage:    false,
            }}
            onAddCrop={() => { try { navigate('/my-grow'); } catch { /* swallow */ } }}
            onAddLocation={() => { try { navigate('/my-grow'); } catch { /* swallow */ } }}
          />
        )}

        {/* v3 stability layer: classified load-error banner.
            Renders ABOVE the data sections so a 401 / MFA /
            network failure surfaces a calm CTA instead of a
            silent empty dashboard. The rest of the page
            (weather, forecast, market signal, beginner
            prompt) keeps rendering through the failure. */}
        {loop.loadErrorType === API_ERROR_TYPES.SESSION_EXPIRED && (
          <div style={{ marginBottom: '1rem' }}>
            <SessionExpiredState testId="dashboard-load-error" />
          </div>
        )}
        {loop.loadErrorType === API_ERROR_TYPES.MFA_REQUIRED && (
          <div style={{ marginBottom: '1rem' }}>
            <MfaRequiredState testId="dashboard-load-error" />
          </div>
        )}
        {loop.loadErrorType === API_ERROR_TYPES.NETWORK_ERROR && (
          <div style={{ marginBottom: '1rem' }}>
            <NetworkErrorState onRetry={loop.refreshLoop}
                               testId="dashboard-load-error" />
          </div>
        )}
        {loop.loadErrorType === API_ERROR_TYPES.API_ERROR && (
          <div style={{ marginBottom: '1rem' }}>
            <ErrorState
              message="We could not load your tasks. Your data is safe — try again in a moment."
              onRetry={loop.refreshLoop}
              testId="dashboard-load-error"
            />
          </div>
        )}

        {/* Spec polish (Apr 2026): RainfallForecastCard +
            MarketSignalCard removed from Home — they introduced
            a second + third weather/signal surface above the
            primary task, pushing the CTA below the fold on
            mobile. Both components remain importable for any
            other surface that wants the rich forecast. The
            inline weather chip in FarmerHeader keeps the
            "weather visible" requirement satisfied with a
            fraction of the vertical real estate. */}
        {emptyState}
        {feedbackBanner}

        {showBeginnerPrompt && (
          <Suspense fallback={null}>
            <BeginnerPrompt />
          </Suspense>
        )}

        {/* ═══ Hero: camera-detected issue takes over as the one
            dominant task when active (spec §2, §12). Normal crop task
            is hidden behind a subtle Next-hint to keep Home radically
            simple — one action, one focus. ═══ */}
        {cameraTask && loop.profile && (
          <>
            <div style={S.cameraHero} data-testid="home-camera-task">
              {cameraJustDone ? (
                <div style={S.cameraHeroDone} data-testid="home-camera-done">
                  <span style={S.cameraHeroDoneCheck} aria-hidden="true">{'\u2714'}</span>
                  <span style={S.cameraHeroDoneText}>{t('home.cameraDone.reveal')}</span>
                  {canUndo(cameraTask.id) && (
                    <div style={S.cameraHeroCorrectionRow}>
                      <button
                        type="button"
                        onClick={handleUndoCamera}
                        style={S.cameraHeroUndoBtn}
                        data-testid="camera-undo"
                      >
                        {t('correction.undo')}
                      </button>
                      <button
                        type="button"
                        onClick={() => openCorrection('camera')}
                        style={S.cameraHeroReportBtn}
                        data-testid="camera-report-issue"
                      >
                        {t('correction.somethingWrong')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div style={S.cameraHeroTopRow}>
                    <span style={S.cameraHeroIcon} aria-hidden="true">{cameraTask.icon || '\uD83D\uDCF7'}</span>
                    <span style={S.cameraHeroLabel}>{t('home.hero.todaysAction')}</span>
                  </div>
                  <h1 style={S.cameraHeroTitle}>{t(cameraTask.titleKey)}</h1>
                  {cameraTask.contextKey && (
                    <div style={S.cameraHeroContext}>{t(cameraTask.contextKey)}</div>
                  )}
                  {cameraTask.whyKey && (
                    <div style={S.cameraHeroWhy}>
                      <span style={S.cameraHeroWhyLabel}>{t('home.hero.why')}</span>
                      {t(cameraTask.whyKey)}
                    </div>
                  )}
                  <button type="button" onClick={handleCameraDone} style={S.cameraHeroCta}>
                    {t('home.cta.fixToday')}
                  </button>
                  <button type="button" onClick={() => navigate('/scan-crop')} style={S.cameraHeroSecondary}>
                    {'\uD83D\uDCF7'} {t('camera.result.rescan')}
                  </button>
                </>
              )}
            </div>

            {/* Subtle Next-up hint: normal crop task is waiting */}
            {loop.taskViewModel?.title && (
              <div style={S.nextHint}>
                <span style={S.nextHintLabel}>{t('home.nextUp')}</span>
                <span style={S.nextHintTitle}>{loop.taskViewModel.title}</span>
              </div>
            )}
          </>
        )}

        {/* Normal task card. Hidden while a camera hero is active
            so Home never shows two dominant tasks at once. ALSO
            hidden when FEATURE_DAILY_INTELLIGENCE is on — the
            DailyPlanCard above now owns "what should I do next?"
            and surfaces the same setup / stage prompts via its
            alerts, so rendering both creates a duplicate
            "current task" surface. (Spec §16: remove duplicate
            sections.) Flag off → existing behaviour unchanged. */}
        {!cameraTask
          && loop.profile
          && !loop.farmSwitching
          && !isFeatureEnabled('FEATURE_DAILY_INTELLIGENCE') && (
          // TodayTaskCard: spec §1 — single primary task surface.
          // Priority chain: high → medium → low (loadPrimaryTask).
          <TodayTaskCard
            primaryTask={loop.primaryTask}
            setupComplete={setupComplete}
            cropStage={loop.profile?.cropStage}
            onAction={handleDoThisNow}
            onSetStage={handleSetStage}
            onGoToSetup={handleGoToSetup}
            onAddUpdate={handleAddUpdate}
          />
        )}

        {/* v3 Verification System: opt-in "Add location"
            chip. Surfaces only RIGHT AFTER a task complete
            so the farmer can voluntarily upgrade the
            verification level (1 → 2). Calm wording, no
            pressure — the spec forbids blocking the farmer.
            Tap → fire-and-forget GPS read +
            bumpVerificationWithLocation(). */}
        {loop.loopState === LOOP_STATE.COMPLETED
          && loop.lastCompletedTask
          && verifyBumpStatus !== 'done' && (
          <button
            type="button"
            onClick={async () => {
              if (verifyBumpStatus === 'busy') return;
              setVerifyBumpStatus('busy');
              try {
                const farmerId = loop.profile?.userId
                              || loop.profile?.farmerId
                              || null;
                const r = await bumpVerificationWithLocation(
                  String(loop.lastCompletedTask?.id || ''),
                  farmerId,
                );
                // Helper returns the unchanged record on
                // GPS denial; flip to 'denied' so the chip
                // hides without claiming success.
                if (r && r.location && r.location.lat) {
                  setVerifyBumpStatus('done');
                } else {
                  setVerifyBumpStatus('denied');
                }
              } catch {
                setVerifyBumpStatus('denied');
              }
            }}
            style={S.scanEntry}
            data-testid="home-verify-add-location"
            disabled={verifyBumpStatus === 'busy'}
          >
            <span style={S.scanEntryIcon} aria-hidden="true">📍</span>
            <span>
              {verifyBumpStatus === 'busy'
                ? tSafe('verification.checkingLocation', 'Checking location…')
                : verifyBumpStatus === 'denied'
                  ? tSafe('verification.locationDenied',
                      'Location not available — that\u2019s OK')
                  : tSafe('verification.addLocation',
                      'Add location to this task (optional)')}
            </span>
            <span style={S.scanEntryChevron}>{'\u203A'}</span>
          </button>
        )}

        {/* v3 NGO Program Distribution: render up to
            ACTIVE_LIMIT (2) delivered programs. Secondary
            priority — sits BELOW the Today task and
            verification chip, ABOVE the scan-crop / sell /
            funding entries. Anti-spam cap enforced inside
            the store. Reads from the memoised
            `dashboardPrograms` so the JSX has zero work. */}
        {dashboardPrograms.length > 0 && _userId
          && dashboardPrograms.map(({ program, delivery }) => (
            <ProgramCard
              key={delivery.id}
              program={program}
              delivery={delivery}
              onView={() => {
                markOpened(program.id, _userId);
                setProgramTick((n) => n + 1);
              }}
              onAck={() => {
                markActed(program.id, _userId);
                setProgramTick((n) => n + 1);
                // Spec §5: SMS confirmation when the farmer
                // commits to a program. Fire-and-forget; if
                // phone is missing or Twilio fails, no UX impact.
                try { confirmProgramActed(loop.profile, program, language); }
                catch { /* never block from a notification path */ }
              }}
            />
          ))}

        {/* ── Daily progress block (unified UI spec, Apr 2026)
            Visible "X / Y" daily progress + status pill. The
            primary task card has its own micro-signal; this
            block is the calm at-a-glance read for farmers who
            already know the task. Hidden when total === 0
            (no tasks yet today) so we never claim "0/0 — On
            track". */}
        {loop.profile && loop.progress && loop.progress.total > 0 && (
          <div style={S.progressBlock} data-testid="home-progress">
            <div style={S.progressHeadRow}>
              <span style={S.progressCount}>
                {loop.progress.done}/{loop.progress.total}
                <span style={S.progressCountSub}>
                  {' '}{tSafe('home.progress.tasks', 'tasks done')}
                </span>
              </span>
              <span style={S.progressMetaRow}>
                {/* 7-day engagement loop indicator. Inline messaging
                    only — no new section per the spec's "DO NOT
                    change UI structure" rule. Self-hides during
                    onboarding (dayNumber === 0). */}
                {engagement.dayNumber > 0 && (
                  <span style={S.dayPill} data-testid="home-day-pill">
                    {tSafe('home.engagement.dayOfSeven',
                      'Day {n} of 7').replace('{n}', String(engagement.dayNumber))}
                  </span>
                )}
                <span
                  style={{
                    ...S.progressStatus,
                    ...(loop.progress.done === loop.progress.total
                      ? S.progressStatusDone
                      : null),
                  }}
                >
                  {loop.progress.done === loop.progress.total
                    ? tSafe('home.progress.complete', 'All done')
                    : tSafe('home.progress.onTrack', 'On track')}
                </span>
              </span>
            </div>
            <div style={S.progressTrack} aria-hidden="true">
              <div
                style={{
                  ...S.progressFill,
                  width: `${loop.progress.percent}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* ── Up Next preview card (unified UI spec)
            Tiny secondary card that surfaces the next task
            title only, with a "View tasks" tap target. Drawn
            from the loop's autopilotNextText (already memoised
            inside useFarmerLoop). Hidden when there's nothing
            to preview — first-day or all-done farmers don't
            see a half-empty preview. */}
        {loop.profile
          && loop.taskViewModel
          && loop.taskViewModel.nextText
          && loop.progress
          && loop.progress.remaining > 1 && (
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            style={S.upNextCard}
            data-testid="home-up-next"
          >
            <span style={S.upNextLabel}>
              {tSafe('home.upNext.label', 'Up next')}
            </span>
            <span style={S.upNextTitle}>
              {loop.taskViewModel.nextText}
            </span>
            <span style={S.upNextChevron} aria-hidden="true">
              <ArrowRight size={14} />
            </span>
          </button>
        )}

        {/* ── Lightweight Funding / Sell trigger row ────────────
            Spec rule: "Do not overbuild. Add simple trigger-ready
            placeholders." Two thin chips that surface only when
            simple, already-loaded farm data signals an
            opportunity. Keep both off-screen otherwise so Home
            stays focused on the primary task.

              • Ready-to-sell  ← crop stage ∈ {harvest, post_harvest}
              • Funding nearby ← existing opportunities-feed signal
                                  via the loop's profile flag (kept
                                  read-only — no new fetch added). */}
        {loop.profile && (
          (() => {
            const stage = String(loop.profile.cropStage || '').toLowerCase();
            const showSell = stage === 'harvest' || stage === 'post_harvest' || loop.profile.readyToSell === true;
            const showFunding = loop.profile.fundingOpportunitiesAvailable === true
              || loop.profile.fundingNearby === true;
            if (!showSell && !showFunding) return null;
            return (
              <div style={S.triggerRow} data-testid="home-trigger-row">
                {showSell && (
                  <button
                    type="button"
                    onClick={() => navigate('/sell')}
                    style={{ ...S.triggerChip, ...S.triggerChipSell }}
                    data-testid="home-trigger-sell"
                  >
                    <span aria-hidden="true">🛒</span>
                    <span style={S.triggerChipLabel}>
                      {tSafe('home.trigger.readyToSell', 'Ready to sell?')}
                    </span>
                    <span style={S.triggerChipChevron} aria-hidden="true">
                      <ArrowRight size={14} />
                    </span>
                  </button>
                )}
                {showFunding && (
                  <button
                    type="button"
                    onClick={() => navigate('/opportunities')}
                    style={{ ...S.triggerChip, ...S.triggerChipFunding }}
                    data-testid="home-trigger-funding"
                  >
                    <span aria-hidden="true">💰</span>
                    <span style={S.triggerChipLabel}>
                      {tSafe('home.trigger.fundingNearby', 'Funding nearby')}
                    </span>
                    <span style={S.triggerChipChevron} aria-hidden="true">
                      <ArrowRight size={14} />
                    </span>
                  </button>
                )}
              </div>
            );
          })()
        )}

        {/* ── Quick actions grid (Home redesign §4 v2) ──────────
            Four tiles per the action-first spec: Scan crop /
            Check land / Mark ready to sell / View funding.
            Sell + Funding here are deep-link shortcuts to the
            same routes the bottom nav serves; the Home tiles
            give farmers landing on Home first a one-tap path
            into those flows without hunting through the nav.
            Same routes, same labels — no duplicate logic. */}
        {loop.profile && (
          <div style={S.quickGrid} data-testid="home-quick-actions">
            {engagement.unlocks.scanCrop && (
              <button
                type="button"
                onClick={() => navigate('/scan-crop')}
                style={S.quickTile}
                data-testid="home-scan-crop"
              >
                <span style={S.quickTileIcon} aria-hidden="true">
                  <Camera size={20} />
                </span>
                <span style={S.quickTileLabel}>
                  {tSafe('home.quick.scanCrop', 'Scan crop')}
                </span>
                <span style={S.quickTileHelper}>
                  {tSafe('home.quick.scanCrop.helper',
                    'Detect issues early.')}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/land-check')}
              style={S.quickTile}
              data-testid="home-land-check"
            >
              <span style={S.quickTileIcon} aria-hidden="true">
                <Sprout size={20} />
              </span>
              <span style={S.quickTileLabel}>
                {tSafe('home.quick.checkLand', 'Check land')}
              </span>
              <span style={S.quickTileHelper}>
                {tSafe('home.quick.checkLand.helper',
                  'Quick farm check.')}
              </span>
            </button>
            {engagement.unlocks.markSell && (
              <button
                type="button"
                onClick={() => navigate('/sell')}
                style={S.quickTile}
                data-testid="home-mark-sell"
              >
                <span style={S.quickTileIcon} aria-hidden="true">
                  <ShoppingCart size={20} />
                </span>
                <span style={S.quickTileLabel}>
                  {tSafe('home.quick.markSell', 'Mark ready to sell')}
                </span>
                <span style={S.quickTileHelper}>
                  {tSafe('home.quick.markSell.helper',
                    'Signal harvest is ready.')}
                </span>
              </button>
            )}
            {engagement.unlocks.viewFunding && (
              <button
                type="button"
                onClick={() => navigate('/opportunities')}
                style={S.quickTile}
                data-testid="home-view-funding"
              >
                <span style={S.quickTileIcon} aria-hidden="true">
                  <Wallet size={20} />
                </span>
                <span style={S.quickTileLabel}>
                  {tSafe('home.quick.viewFunding', 'View funding')}
                </span>
                <span style={S.quickTileHelper}>
                  {tSafe('home.quick.viewFunding.helper',
                    'See available offers.')}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ── Help row (Home redesign §6) ──────────────────────
            Compact "Need help? Contact us →" row. Click prefers
            the in-app /support route, falls back to a mailto if
            the URL doesn't change. Never a dead click. */}
        {loop.profile && (
          <button
            type="button"
            onClick={handleHelpClick}
            style={S.helpRow}
            data-testid="home-help"
          >
            <span style={S.helpRowIcon} aria-hidden="true">
              <HelpCircle size={18} />
            </span>
            <span style={S.helpRowText}>
              <span style={S.helpRowTitle}>
                {tSafe('home.help.title', 'Need help?')}
              </span>
              <span style={S.helpRowAction}>
                {tSafe('home.help.contact', 'Contact us')}
                <span aria-hidden="true" style={{ marginLeft: 6, display: 'inline-flex' }}>
                  <ArrowRight size={14} />
                </span>
              </span>
            </span>
          </button>
        )}

        {/* ── QuickActionsRow — standard mode layout §4 ─────────
            Fast shortcuts: Add Update, Scan, Sell, Funding.
            Self-hides when profile isn't loaded yet. */}
        {loop.profile && (
          <QuickActionsRow
            onAddUpdate={handleAddUpdate}
            onSetStage={handleSetStage}
            setupComplete={setupComplete}
          />
        )}

        {/* ── WeeklyProgressCard — standard layout §5 ──────────
            Shows doneThisWeek / weekTotal progress. Server counts
            (completedCount, taskCount) — no localStorage. */}
        {loop.profile && weekTotal > 0 && (
          <WeeklyProgressCard
            doneThisWeek={doneThisWeek}
            weekTotal={weekTotal}
          />
        )}

        {/* ── moreSection: collapsed secondary sections for harvest / money / tools ──
            Tap a section header to expand. Primary view stays clean.
            Labels: t('dashboard.harvest'), t('dashboard.money'). */}
        {loop.profile && (() => {
          return (
            <div data-testid="more-sections">
              {/* Harvest section toggle */}
              <div onClick={() => setExpandedSection(expandedSection === 'harvest' ? null : 'harvest')}
                   style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', padding: '0.5rem 0' }}>
                {t('dashboard.harvest')}
              </div>
              {expandedSection === 'harvest' && (
                <>
                  <FarmHarvestCard farmId={loop.profile.id} />
                  <YieldRecordsCard farmId={loop.profile.id} />
                </>
              )}
              {/* Money section toggle */}
              <div onClick={() => setExpandedSection(expandedSection === 'money' ? null : 'money')}
                   style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', padding: '0.5rem 0' }}>
                {t('dashboard.money')}
              </div>
              {expandedSection === 'money' && (
                <>
                  <FarmEconomicsCard farmId={loop.profile.id} />
                  <FarmBenchmarkCard farmId={loop.profile.id} />
                </>
              )}
              {/* Tools section: pest risk + full weather (expandedSection === 'tools') */}
              {expandedSection === 'tools' && (
                <>
                  <FarmPestRiskCard farmId={loop.profile.id} />
                  <FarmWeatherCard farmId={loop.profile.id} />
                </>
              )}
            </div>
          );
        })()}

        {/* ── Harvest section: expandedSection === 'harvest' (legacy render kept for rollback) ──
            Controlled via moreSection above. Kept for selector reference. */}

        {/* ── Money section: economics + benchmarking ─────────────
            Both cards are inside the 'money' expandable section.
            FarmEconomicsCard always before FarmBenchmarkCard. */}
        {loop.profile && expandedSection === 'money' && (
          <>
            <FarmEconomicsCard farmId={loop.profile.id} />
            <FarmBenchmarkCard farmId={loop.profile.id} />
          </>
        )}

        {/* ── Land boundary + Seed scan (gated by setupComplete, RULE 1+5+6) ─
            Both lazy-loaded for performance (RULE 5).
            Only rendered when setupComplete (RULE 1: core flow first).
            Data fetched only when isOnline (RULE 6: offline safety).
            LandBoundaryCapture always before SeedScanFlow (RULE 1: ordering).
            Calls getLandBoundaries / getSeedScans when !isOnline is false. */}
        {loop.profile && setupComplete && (
          <Suspense fallback={null}>
            <LandBoundaryCapture
              farmId={loop.profile.id}
              onSkip={() => {}}
            />
          </Suspense>
        )}
        {loop.profile && setupComplete && (
          <Suspense fallback={null}>
            <SeedScanFlow farmId={loop.profile.id} />
          </Suspense>
        )}
        {/* Supply readiness (gated by setupComplete) */}
        {loop.profile && setupComplete && (
          <Suspense fallback={null}>
            <SellReadinessInput farmId={loop.profile?.id} />
          </Suspense>
        )}

        {modals}

        {/* Floating voice + camera launchers used to live here. The
            Scan tab in the bottom-nav owns scan / mic actions now,
            so Home stays focused on the single daily action. */}

        {showCorrectionModal && (
          <TaskCorrectionModal
            onPick={handleCorrectionPicked}
            onCancel={() => { setShowCorrectionModal(false); setCorrectionTargetSource(null); }}
          />
        )}
      </div>

      {/* Build version stamp — fixed footer overlay so engineers
          (and farmers reporting issues) can confirm which build
          they're actually running. Hidden behind the bottom nav
          on mobile (z-index 0) but visible on the home surface
          itself; opacity is low enough to never compete with the
          primary action. */}
      <div
        aria-hidden="true"
        data-testid="farroway-build-stamp"
        style={{
          position: 'fixed',
          bottom: 8,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: '10px',
          opacity: 0.6,
          color: '#9fd3c7',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        Farroway Build: {FARROWAY_BUILD_VERSION}
        {' · '}
        <span style={{ opacity: 0.65 }}>
          {FARROWAY_COMMIT_SHA}
        </span>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const S = {

  // ─── Calm Home (new standard mode) ──────────────────────
  // Minimal wrapper — CalmHomeHero provides its own full-screen
  // background. This layer is just a positioning container.
  calmPage: {
    minHeight: '100vh',
    background: 'transparent',
    position: 'relative',
    padding: 0,
  },

  // Floating error banner strip — sits above the hero
  // without disrupting its layout.
  floatBanner: {
    position: 'relative',
    zIndex: 20,
    padding: '0.5rem 0.75rem 0',
  },

  // Build stamp — fixed footer (same visual as legacy)
  buildStamp: {
    position: 'fixed',
    bottom: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: '10px',
    opacity: 0.6,
    color: '#9fd3c7',
    pointerEvents: 'none',
    zIndex: 1,
  },

  // ─── Legacy styles (used by loading + basic mode) ────────
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    // Bottom padding sized to clear BottomTabNav (~64px tall)
    // plus a small breathing buffer so the last quick-action
    // tile is never visually pinned under the fixed nav.
    padding: '0.75rem 0.75rem 5rem',
  },

  // ─── Daily progress block (unified UI spec, Apr 2026) ────
  // Calm "X / Y tasks done • On track" surface that sits
  // under the primary task card. Track is the same green
  // fill used elsewhere in the app for consistency.
  progressBlock: {
    margin: '0.75rem 0 0',
    padding: '10px 12px',
    borderRadius: 12,
    background: '#102C47',
    border: '1px solid #1F3B5C',
  },
  progressHeadRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressCount: {
    fontSize: '0.875rem',
    fontWeight: 800,
    color: '#FFFFFF',
  },
  progressCountSub: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
  },
  progressStatus: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#86EFAC',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.32)',
    padding: '3px 10px',
    borderRadius: 999,
  },
  // Right-side meta row inside the progress block. Holds the
  // optional Day N of 7 pill plus the existing on-track / all-
  // done status pill — both sized identically.
  progressMetaRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  dayPill: {
    fontSize: '0.6875rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#FCD34D',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    padding: '3px 10px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  progressStatusDone: {
    color: '#FCD34D',
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#22C55E',
    borderRadius: 999,
    transition: 'width 240ms ease',
  },

  // ─── Up Next preview card (unified UI spec, Apr 2026) ────
  // One small ghost card under the progress block that gives
  // the farmer a peek at what's coming after the current
  // task. Whole row is a tap target → /tasks. Hidden when
  // there's nothing to preview.
  upNextCard: {
    width: '100%',
    margin: '0.5rem 0 0',
    appearance: 'none',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: '0.65rem 0.85rem',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer',
    color: '#FFFFFF',
    minHeight: 48,
    textAlign: 'left',
  },
  upNextLabel: {
    fontSize: '0.625rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'rgba(255,255,255,0.55)',
    flex: '0 0 auto',
  },
  upNextTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#FFFFFF',
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  upNextChevron: {
    color: '#86EFAC',
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
  },

  // ─── Spec polish (Apr 2026): 2x2 quick-actions grid ─────
  // Replaces the four full-width vertical entry rows with a
  // compact tile grid. Each tile is square-ish on mobile so
  // all 4 are visible without excessive scroll. Navy palette
  // matches the other farmer cards on the app.
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.6rem',
    marginTop: '0.75rem',
  },
  quickTile: {
    appearance: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    padding: '0.85rem 0.85rem',
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 12,
    color: '#FFFFFF',
    cursor: 'pointer',
    minHeight: 96,
    textAlign: 'left',
  },
  // Highlight the funding tile when there's an active match.
  // Gentle accent — no aggressive yellow, just a green tint
  // so it pops without competing with the primary CTA.
  quickTileAccent: {
    background: 'rgba(34,197,94,0.08)',
    borderColor: 'rgba(34,197,94,0.35)',
  },
  quickTileIcon: {
    color: 'rgba(255,255,255,0.85)',
    display: 'inline-flex',
  },
  quickTileLabel: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#FFFFFF',
    lineHeight: 1.25,
  },
  quickTileHelper: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.35,
  },


  notifyBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '0.4rem',
  },
  scanEntry: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.03)',
    color: '#EAF2FF',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '0.75rem',
    WebkitTapHighlightColor: 'transparent',
    textAlign: 'left',
  },
  scanEntryIcon: { fontSize: '1.125rem', lineHeight: 1 },
  scanEntryChevron: { marginLeft: 'auto', color: '#6F8299', fontSize: '1.25rem' },

  // Camera-hero card — when active, this IS the Home task (spec §2, §12).
  // Generous spacing and one dominant green CTA; no competing cards.
  cameraHero: {
    borderRadius: '22px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.28)',
    padding: '1.5rem 1.25rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
    marginBottom: '0.5rem',
    boxShadow: '0 14px 36px rgba(0,0,0,0.3)',
    animation: 'farroway-fade-in 0.25s ease-out',
  },
  cameraHeroTopRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  cameraHeroIcon: { fontSize: '1.375rem', lineHeight: 1 },
  cameraHeroLabel: {
    fontSize: '0.625rem', fontWeight: 800,
    color: '#FCD34D', textTransform: 'uppercase', letterSpacing: '0.1em',
  },
  cameraHeroTitle: {
    fontSize: '1.5rem', fontWeight: 800, color: '#EAF2FF',
    margin: '0.125rem 0 0', lineHeight: 1.2,
  },
  cameraHeroContext: {
    fontSize: '0.75rem', fontWeight: 700, color: '#FCD34D',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  },
  cameraHeroWhy: {
    fontSize: '0.9375rem', color: '#EAF2FF', lineHeight: 1.4,
    padding: '0.5rem 0',
  },
  cameraHeroWhyLabel: {
    fontSize: '0.625rem', fontWeight: 800, color: '#6F8299',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginRight: '0.375rem',
  },
  cameraHeroCta: {
    marginTop: '0.5rem',
    padding: '1rem', borderRadius: '16px',
    background: '#22C55E', color: '#fff', border: 'none',
    fontSize: '1.0625rem', fontWeight: 800, cursor: 'pointer',
    minHeight: '56px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  cameraHeroSecondary: {
    padding: '0.625rem', borderRadius: '12px',
    border: '1px dashed rgba(255,255,255,0.08)',
    background: 'transparent', color: '#9FB3C8',
    fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
    marginTop: '0.25rem',
  },

  // Calm 1.4s success reveal inside the hero — signature interaction.
  cameraHeroDone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.625rem',
    padding: '1.5rem 0.75rem',
    animation: 'farroway-fade-in 0.25s ease-out',
  },
  cameraHeroDoneCheck: {
    width: '48px', height: '48px',
    borderRadius: '50%',
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.5rem', fontWeight: 800,
  },
  cameraHeroDoneText: {
    fontSize: '1rem', fontWeight: 700, color: '#EAF2FF',
    textAlign: 'center', lineHeight: 1.35, maxWidth: '20rem',
  },
  cameraHeroCorrectionRow: {
    display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center',
    flexWrap: 'wrap', marginTop: '0.5rem',
  },
  cameraHeroUndoBtn: {
    padding: '0.375rem 0.875rem', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: '#EAF2FF', fontSize: '0.75rem', fontWeight: 700,
    cursor: 'pointer',
  },
  cameraHeroReportBtn: {
    padding: '0.375rem 0.875rem', borderRadius: '999px',
    border: '1px dashed rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#9FB3C8', fontSize: '0.75rem', fontWeight: 600,
    cursor: 'pointer',
  },

  // Subtle "Next up" hint — renders only when a secondary task is
  // waiting behind the hero. One line, low visual weight.
  nextHint: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.75rem', borderRadius: '10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    fontSize: '0.8125rem', color: '#9FB3C8',
    marginBottom: '0.5rem',
  },
  nextHintLabel: {
    fontSize: '0.625rem', fontWeight: 800, color: '#6F8299',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  nextHintTitle: { fontWeight: 700, color: '#EAF2FF' },
  container: {
    maxWidth: '42rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  wxActionLine: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    borderRadius: '14px',
    background: 'rgba(245,158,11,0.06)',
    border: '1px solid rgba(245,158,11,0.12)',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: '#9FB3C8',
  },

  // ── Weather Intelligence Card (Home redesign §2) ───────────
  // One compact card with condition + action guidance. Icon
  // on the left; bold title; one-line body. Self-hides via
  // the JSX gate when severity is 'safe'.
  wxIntelCard: {
    margin: '0.75rem 0 0',
    padding: '12px 14px',
    borderRadius: 16,
    background: '#102C47',
    border: '1px solid rgba(14,165,233,0.30)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  wxIntelIcon: {
    fontSize: 22,
    lineHeight: 1,
    flex: '0 0 auto',
    marginTop: 1,
  },
  wxIntelText: {
    flex: '1 1 auto',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  wxIntelTitle: {
    fontSize: '0.95rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.25,
  },
  wxIntelBody: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 1.4,
  },

  // ── Funding / Sell trigger chips (Home spec — triggers) ───
  // Thin always-localised chip pair. Each chip self-hides when
  // its trigger condition is false; whole row hides when neither
  // trigger fires. Styling is calmer than the primary CTA so the
  // chips never compete with Today's Action.
  triggerRow: {
    margin: '0.75rem 0 0',
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  triggerChip: {
    appearance: 'none',
    border: '1px solid',
    color: '#FFFFFF',
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: '0.8125rem',
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
  },
  triggerChipSell: {
    background: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.45)',
    color: '#86EFAC',
  },
  triggerChipFunding: {
    background: 'rgba(245,158,11,0.12)',
    borderColor: 'rgba(245,158,11,0.45)',
    color: '#FCD34D',
  },
  triggerChipLabel: { fontWeight: 700 },
  triggerChipChevron: {
    display: 'inline-flex',
    marginLeft: 2,
    opacity: 0.85,
  },

  // ── Help row (Home redesign §6) ────────────────────────────
  // Compact "Need help? Contact us →" row that sits at the
  // bottom of the Home stack. Quiet styling so it never
  // competes with the primary CTA.
  helpRow: {
    width: '100%',
    appearance: 'none',
    margin: '0.75rem 0 0',
    padding: '12px 14px',
    borderRadius: 14,
    background: '#102C47',
    border: '1px solid #1F3B5C',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 52,
  },
  helpRowIcon: {
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    flex: '0 0 auto',
  },
  helpRowText: {
    flex: '1 1 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minWidth: 0,
  },
  helpRowTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#FFFFFF',
  },
  helpRowAction: {
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#86EFAC',
    display: 'inline-flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '40vh',
    gap: '0.75rem',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.9rem',
    color: '#6F8299',
  },
  emptyState: {
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.04)',
    padding: '2.25rem 1.5rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  emptyBtn: {
    marginTop: '0.5rem',
    borderRadius: '14px',
    background: '#22C55E',
    padding: '0.875rem 1.75rem',
    fontWeight: 700,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9375rem',
    minHeight: '48px',
    boxShadow: '0 10px 24px rgba(34,197,94,0.22)',
    WebkitTapHighlightColor: 'transparent',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0',
  },
  modalContent: {
    width: '100%',
    maxWidth: '480px',
    maxHeight: '95vh',
    overflowY: 'auto',
    borderRadius: '20px 20px 0 0',
    WebkitOverflowScrolling: 'touch',
  },
};
