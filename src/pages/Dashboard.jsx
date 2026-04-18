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
import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSeason } from '../context/SeasonContext.jsx';
import { useUserMode } from '../context/UserModeContext.jsx';
import { useFarmerLoop } from '../hooks/useFarmerLoop.js';
import { LOOP_STATE } from '../services/farmerLoopService.js';

import FarmerHeader from '../components/FarmerHeader.jsx';
import NextActionCard from '../components/NextActionCard.jsx';
import ActionFeedbackBanner from '../components/ActionFeedbackBanner.jsx';
import TaskActionModal from '../components/TaskActionModal.jsx';
import CropStageModal from '../components/CropStageModal.jsx';
import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx';
import FarmPicker from '../components/FarmPicker.jsx';
import RainfallForecastCard from '../components/RainfallForecastCard.jsx';
import MarketSignalCard from '../components/MarketSignalCard.jsx';

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

  // ─── Modal state (not part of the loop itself) ──────────
  const [showTaskAction, setShowTaskAction] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showUpdateFlow, setShowUpdateFlow] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedUpdateFarm, setSelectedUpdateFarm] = useState(null);

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
    navigate('/profile/setup');
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
        {modals}
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
