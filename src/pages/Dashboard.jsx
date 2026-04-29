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
import NextActionCard from '../components/NextActionCard.jsx';
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
import ProgramCard from '../components/farmer/ProgramCard.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import {
  addNotification, NOTIFICATION_TYPES,
} from '../notifications/notificationStore.js';
import ActionFeedbackBanner from '../components/ActionFeedbackBanner.jsx';
import TaskActionModal from '../components/TaskActionModal.jsx';
import CropStageModal from '../components/CropStageModal.jsx';
import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx';
import FarmPicker from '../components/FarmPicker.jsx';
import RainfallForecastCard from '../components/RainfallForecastCard.jsx';
import MarketSignalCard from '../components/MarketSignalCard.jsx';
import {
  resolveProfileCompletionRoute, routeToUrl,
} from '../core/multiFarm/index.js';
import {
  isFirstTimeFarmer,
  warnFirstTimeRoutingRegression, FIRST_TIME_WARN,
} from '../utils/fastOnboarding/index.js';

const BasicFarmerHome = lazy(() => import('../components/farmer/BasicFarmerHome.jsx'));
const BeginnerPrompt = lazy(() => import('../components/farmer/BeginnerPrompt.jsx'));

export default function Dashboard() {
  const { user, authLoading } = useAuth();
  const { mode, isBasic } = useUserMode();
  const { season, refreshSeason } = useSeason();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // ─── THE LOOP ────────────────────────────────────────────
  const loop = useFarmerLoop();
  const { rainfall, fetchedAt: forecastFetchedAt } = useForecast();

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

  // ─── Modal state (not part of the loop itself) ──────────
  const [showTaskAction, setShowTaskAction] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showUpdateFlow, setShowUpdateFlow] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedUpdateFarm, setSelectedUpdateFarm] = useState(null);

  // ─── Active camera task (spec §10: camera task sits above normal) ──
  // Keep a local snapshot that refreshes when the farmer returns from
  // the scan page so newly added issue tasks land immediately on Home
  // without a full reload.
  const [cameraTask, setCameraTask] = useState(() => getActiveCameraTask());
  // v3 Verification System: opt-in "Add location" affordance.
  // Tracks the per-task bump state so the chip flips to a
  // confirmation after a successful GPS read.
  const [verifyBumpStatus, setVerifyBumpStatus] = useState('idle'); // 'idle' | 'busy' | 'done' | 'denied'

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

  // ─── CTA handlers (bridge loop → modals) ────────────────
  function handleDoThisNow() {
    if (loop.primaryTask) setShowTaskAction(true);
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

  // ─── Loading gate ────────────────────────────────────────
  if (authLoading || loop.isLoading) {
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

      {showStageModal && loop.profile && (
        <CropStageModal
          farm={loop.profile}
          onClose={() => setShowStageModal(false)}
          onSaved={() => {
            setShowStageModal(false);
            loop.refreshLoop();
          }}
        />
      )}

      {showTaskAction && loop.primaryTask && (
        <TaskActionModal
          task={loop.primaryTask}
          taskViewModel={loop.taskViewModel}
          onComplete={(task) => {
            setShowTaskAction(false);
            loop.completeTask(task);
          }}
          onClose={() => setShowTaskAction(false)}
          completing={loop.completing}
          t={t}
        />
      )}
    </>
  );

  // ─── BASIC MODE ──────────────────────────────────────────
  if (isBasic) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          <FarmerHeader user={user} profile={loop.profile} t={t} weatherDecision={loop.weatherDecision} onRefreshWeather={loop.refreshLoop} />
          {weatherLine}
          <RainfallForecastCard />
          <MarketSignalCard />
          {emptyState}
          {feedbackBanner}

          {showBeginnerPrompt && (
            <Suspense fallback={null}>
              <BeginnerPrompt />
            </Suspense>
          )}

          {loop.profile && !loop.farmSwitching && (
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
  }

  // ─── STANDARD MODE ──────────────────────────────────────
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
        {weatherLine}

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

        <RainfallForecastCard />
        <MarketSignalCard />
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

        {/* Normal task card — hidden while a camera hero is active so
            Home never shows two dominant tasks at once. */}
        {!cameraTask && loop.profile && !loop.farmSwitching && (
          <NextActionCard
            decision={loop.decision}
            taskViewModel={loop.taskViewModel}
            loading={loop.decision.loading}
            loopState={loop.loopState}
            progress={loop.progress}
            onDoThisNow={handleDoThisNow}
            onSetStage={handleSetStage}
            onGoToSetup={handleGoToSetup}
            onAddUpdate={handleAddUpdate}
            lastSuccessText={loop.lastSuccessText}
            autopilotNextText={loop.taskViewModel?.nextText}
            completionState={loop.completionState}
            onContinue={loop.continueAfterCompletion}
            onLater={loop.dismissCompletion}
            t={t}
            language={loop.language}
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
              }}
            />
          ))}

        {/* Scan-crop entry point — compact, single line, non-intrusive */}
        {loop.profile && (
          <button
            type="button"
            onClick={() => navigate('/scan-crop')}
            style={S.scanEntry}
            data-testid="home-scan-crop"
          >
            <span style={S.scanEntryIcon} aria-hidden="true">{'\uD83D\uDCF7'}</span>
            <span>{t('camera.entry.homeCta')}</span>
            <span style={S.scanEntryChevron}>{'\u203A'}</span>
          </button>
        )}

        {/* Land-check entry point — same style, same hierarchy weight */}
        {loop.profile && (
          <button
            type="button"
            onClick={() => navigate('/land-check')}
            style={S.scanEntry}
            data-testid="home-land-check"
          >
            <span style={S.scanEntryIcon} aria-hidden="true">{'\uD83C\uDF3E'}</span>
            <span>{t('land.entry.homeCta')}</span>
            <span style={S.scanEntryChevron}>{'\u203A'}</span>
          </button>
        )}

        {/* Buyer-layer entry point: secondary "Ready to sell?"
            card. Sits at the same low priority as scan-crop /
            land-check so it never competes with the primary
            Today task. Shown to any farmer with a profile —
            harvest-stage filtering is handled inside Sell.jsx
            (prefills crop) so the card stays useful even
            mid-season when a farmer wants to plan ahead. */}
        {loop.profile && (
          <button
            type="button"
            onClick={() => navigate('/sell')}
            style={S.scanEntry}
            data-testid="home-sell-entry"
          >
            <span style={S.scanEntryIcon} aria-hidden="true">{'\uD83C\uDFF7\uFE0F'}</span>
            <span>
              {tSafe('market.markProduceReady',
                'Ready to sell? Mark produce ready')}
            </span>
            <span style={S.scanEntryChevron}>{'\u203A'}</span>
          </button>
        )}

        {/* Funding opportunities entry — renders only when
            the memoised match count is > 0. The MATCH_SHOWN
            analytics event fires from a useEffect (below)
            so it doesn't run on every render. */}
        {fundingMatchCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/opportunities')}
            style={S.scanEntry}
            data-testid="home-funding-entry"
          >
            <span style={S.scanEntryIcon} aria-hidden="true">{'\uD83C\uDFAF'}</span>
            <span>
              {tSafe('funding.nearbyCardTitle',
                'Funding opportunity nearby')}
            </span>
            <span style={S.scanEntryChevron}>{'\u203A'}</span>
          </button>
        )}

        {modals}

        {showCorrectionModal && (
          <TaskCorrectionModal
            onPick={handleCorrectionPicked}
            onCancel={() => { setShowCorrectionModal(false); setCorrectionTargetSource(null); }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    color: '#EAF2FF',
    padding: '0.75rem 0.75rem 1rem',
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
