/**
 * Dashboard (Home) — farmer decision screen.
 *
 * Shows ONLY what the farmer needs to act now:
 *   1. Identity + weather header
 *   2. Optional weather insight strip
 *   3. One main task card with CTA
 *
 * All progress, analytics, and farm details live in their respective tabs.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeTrackEvent } from '../lib/analytics.js';
import { languageToVoiceCode, speakText } from '../lib/voice.js';
import { useTranslation } from '../i18n/index.js';
import { calculateFarmScore } from '../lib/farmScore.js';
import { getFarmTasks } from '../lib/api.js';
import { completeTaskSafe } from '../services/taskService.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useSeason } from '../context/SeasonContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx';
import CropStageModal from '../components/CropStageModal.jsx';
import FarmPicker from '../components/FarmPicker.jsx';
import FarmerHeader from '../components/FarmerHeader.jsx';
import NextActionCard from '../components/NextActionCard.jsx';
import TaskActionModal from '../components/TaskActionModal.jsx';
import { useUserMode } from '../context/UserModeContext.jsx';
import ActionFeedbackBanner from '../components/ActionFeedbackBanner.jsx';
import { useFarmDecision } from '../hooks/useFarmDecision.js';
import { getLocalizedTaskTitle } from '../utils/taskTranslations.js';

// Lazy-load simple mode component
const BasicFarmerHome = lazy(() => import('../components/farmer/BasicFarmerHome.jsx'));

// Note: Task completion is now server-side via V2FarmTaskCompletion.
// The GET /farm-tasks/:id/tasks endpoint returns only pending tasks.

// ─── Weather one-liner logic ──────────────────────────────────
// getWeatherLine removed — weather guidance now comes from the decision engine

export default function Dashboard() {
  const { autoVoice, language } = useAppPrefs();
  const { mode, isBasic } = useUserMode();
  const { user, authLoading } = useAuth();
  const { profile, loading: profileLoading, currentFarmId, farmSwitching, activeFarms } = useProfile();
  const { season, refreshSeason } = useSeason();
  const { weather, fetchedAt: weatherFetchedAt, freshness: weatherFreshness, refreshWeather } = useWeather();
  const navigate = useNavigate();
  const { t, lang } = useTranslation();

  const { isOnline } = useNetwork();
  const farmScore = calculateFarmScore(profile || {});
  const setupComplete = farmScore.isReady === true;

  // Decision engine — recalculates automatically when inputs change

  const [showUpdateFlow, setShowUpdateFlow] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedUpdateFarm, setSelectedUpdateFarm] = useState(null);
  const [showStageModal, setShowStageModal] = useState(false);

  // Primary task state
  const [primaryTask, setPrimaryTask] = useState(null);
  const [taskCount, setTaskCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskCompleting, setTaskCompleting] = useState(false);
  const [showTaskAction, setShowTaskAction] = useState(false);
  const [taskSuccess, setTaskSuccess] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState(null); // 'success'|'offline'|'failed'|null
  const [feedbackMessage, setFeedbackMessage] = useState(null); // custom message for banner

  const hasMultipleFarms = activeFarms && activeFarms.length > 1;
  const prevFarmIdRef = useRef(null);

  // Decision engine hook — provides primaryAction, todaysPlan, farmStatus
  const farmDecision = useFarmDecision({
    profile, primaryTask, taskCount, completedCount, weather,
    fetchedAt: weatherFetchedAt, freshness: weatherFreshness,
    isOnline, taskLoading,
  });

  // ─── Primary task fetch (priority: high > medium > low) ────
  const loadPrimaryTask = useCallback(async (farmId) => {
    if (!farmId || !isOnline) return;
    setTaskLoading(true);
    try {
      const data = await getFarmTasks(farmId);
      const tasks = data.tasks || [];
      const completedCount = data.completedCount || 0;
      // Walk priority levels: high, then medium, then low, then anything else
      const pick =
        tasks.find((tk) => tk.priority === 'high') ||
        tasks.find((tk) => tk.priority === 'medium') ||
        tasks.find((tk) => tk.priority === 'low') ||
        tasks[0] || null;
      setPrimaryTask(pick);
      setTaskCount(tasks.length);
      setCompletedCount(completedCount);
      safeTrackEvent('task_shown', { farmId, taskId: pick?.id, taskCount: tasks.length });
    } catch {
      setPrimaryTask(null);
      setTaskCount(0);
    } finally {
      setTaskLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    if (currentFarmId && currentFarmId !== prevFarmIdRef.current) {
      setPrimaryTask(null);
      prevFarmIdRef.current = currentFarmId;
      loadPrimaryTask(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      loadPrimaryTask(currentFarmId);
    }
  }, [currentFarmId, loadPrimaryTask]);

  useEffect(() => {
    if (currentFarmId && setupComplete && isOnline) {
      loadPrimaryTask(currentFarmId);
    }
  }, [setupComplete, isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    safeTrackEvent('dashboard.viewed', { farmId: currentFarmId });
  }, [currentFarmId]);

  // Voice welcome — uses translated text, non-blocking
  const voicePlayedRef = useRef(false);
  useEffect(() => {
    if (autoVoice && !voicePlayedRef.current && !authLoading && !profileLoading) {
      voicePlayedRef.current = true;
      try {
        speakText(t('voice.welcome'), languageToVoiceCode(language));
      } catch { /* voice fail non-blocking */ }
    }
  }, [autoVoice, authLoading, profileLoading, language, t]);

  // ─── Complete task via API (optimistic + offline fallback) ──
  const handleCompleteTask = useCallback(async (task) => {
    if (!task || !currentFarmId || taskCompleting) return;
    setTaskCompleting(true);
    setFeedbackStatus(null);
    setFeedbackMessage(null);

    const result = await completeTaskSafe(currentFarmId, task, { isOnline });

    if (result.success) {
      // Optimistic UI update
      if (result.nextTask) {
        setPrimaryTask(result.nextTask);
        setTaskCount((prev) => Math.max(0, prev - 1));
      } else if (!result.offline) {
        // Server confirmed no more tasks
        setPrimaryTask(null);
        setTaskCount(0);
      } else {
        // Offline: optimistically remove current task
        setPrimaryTask(null);
        setTaskCount((prev) => Math.max(0, prev - 1));
      }
      setCompletedCount((prev) => prev + 1);
      setShowTaskAction(false);
      setTaskSuccess(true);
      // Show completed task + next task preview (localized)
      const localTitle = getLocalizedTaskTitle(task.id, task.title, lang);
      const nextName = result.nextTask ? getLocalizedTaskTitle(result.nextTask.id, result.nextTask.title, lang) : null;
      const msg = nextName
        ? `\u2705 ${localTitle}\n${t('feedback.next')}: ${nextName}`
        : `\u2705 ${localTitle}`;
      setFeedbackMessage(msg);
      setFeedbackStatus(result.offline ? 'offline' : 'success');
      if (navigator.vibrate) try { navigator.vibrate(result.offline ? [30, 30, 30] : 50); } catch {}
      setTimeout(() => { setTaskSuccess(false); setFeedbackMessage(null); }, 3500);
    } else {
      setFeedbackStatus('failed');
    }

    setTaskCompleting(false);
  }, [currentFarmId, taskCompleting, isOnline]);

  function handleStartUpdate() {
    if (hasMultipleFarms) {
      setShowFarmPicker(true);
    } else {
      setSelectedUpdateFarm(profile);
      setShowUpdateFlow(true);
    }
  }

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

  // Weather guidance from decision engine (computed inside useFarmDecision)

  // ─── BASIC MODE: icon-first, voice-guided ─────────────────
  if (isBasic) {
    return (
      <div style={S.page}>
        <div style={S.container}>
          {/* Header with weather chip */}
          <FarmerHeader user={user} profile={profile} t={t} weatherDecision={farmDecision.weatherDecision} onRefreshWeather={refreshWeather} />
          {/* Weather action line (basic mode) */}
          {profile && farmDecision.weatherDecision && farmDecision.weatherDecision.severity !== 'safe' && (
            <div style={S.wxActionLine}>
              <span>{farmDecision.weatherDecision.chipIcon}</span>
              <span>{farmDecision.weatherDecision.actionLine}</span>
            </div>
          )}
          {!profile && !profileLoading && (
            <div style={S.emptyState}>
              <span style={{ fontSize: '3rem' }}>{'\uD83C\uDF3E'}</span>
              <div style={S.emptyTitle}>{t('farm.noFarmsTitle')}</div>
              <button onClick={() => navigate('/profile/setup')} style={S.emptyBtn}>
                {t('farm.createFirst')}
              </button>
            </div>
          )}
          {/* Feedback banner — richer than simple success */}
          <ActionFeedbackBanner
            status={feedbackStatus}
            message={feedbackMessage}
            onDismiss={() => { setFeedbackStatus(null); setFeedbackMessage(null); }}
            onRetry={() => primaryTask && handleCompleteTask(primaryTask)}
          />
          {profile && !farmSwitching && (
            <Suspense fallback={null}>
              <BasicFarmerHome
                decision={farmDecision}
                taskViewModel={farmDecision.taskViewModel}
                onDoThisNow={() => primaryTask && setShowTaskAction(true)}
                onSetStage={() => setShowStageModal(true)}
                onAddUpdate={handleStartUpdate}
                onGoToSetup={() => navigate('/profile/setup')}
              />
            </Suspense>
          )}

          {/* Modals — same for all modes */}
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
                  farmerId={selectedUpdateFarm?.id || profile?.id}
                  farmName={selectedUpdateFarm?.farmName}
                  seasonStage={season?.stage}
                  entries={season?.entries || []}
                  onComplete={() => {
                    setShowUpdateFlow(false);
                    setSelectedUpdateFarm(null);
                    refreshSeason();
                    if (currentFarmId) loadPrimaryTask(currentFarmId);
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
                if (currentFarmId) loadPrimaryTask(currentFarmId);
              }}
            />
          )}
          {showTaskAction && primaryTask && (
            <TaskActionModal
              task={primaryTask}
              taskViewModel={farmDecision.taskViewModel}
              onComplete={handleCompleteTask}
              onClose={() => setShowTaskAction(false)}
              completing={taskCompleting}
              t={t}
            />
          )}
        </div>
      </div>
    );
  }

  // ─── STANDARD MODE: guided farmer home ────────────────────
  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* ═══ 1. HEADER: avatar + name + weather chip ═══ */}
        <FarmerHeader user={user} profile={profile} t={t} weatherDecision={farmDecision.weatherDecision} onRefreshWeather={refreshWeather} />

        {/* ═══ WEATHER ACTION LINE (one line, below header) ═══ */}
        {profile && farmDecision.weatherDecision && farmDecision.weatherDecision.severity !== 'safe' && (
          <div style={S.wxActionLine}>
            <span>{farmDecision.weatherDecision.chipIcon}</span>
            <span>{farmDecision.weatherDecision.actionLine}</span>
          </div>
        )}

        {/* ═══ Empty state ═══ */}
        {!profile && !profileLoading && (
          <div style={S.emptyState}>
            <span style={{ fontSize: '3rem' }}>{'\uD83C\uDF3E'}</span>
            <div style={S.emptyTitle}>{t('farm.noFarmsTitle')}</div>
            <button onClick={() => navigate('/profile/setup')} style={S.emptyBtn}>
              {t('farm.createFirst')}
            </button>
          </div>
        )}

        {/* ═══ 7. SUCCESS FEEDBACK ═══ */}
        <ActionFeedbackBanner
          status={feedbackStatus}
          message={feedbackMessage}
          onDismiss={() => { setFeedbackStatus(null); setFeedbackMessage(null); }}
          onRetry={() => primaryTask && handleCompleteTask(primaryTask)}
        />

        {/* ═══ MAIN TASK CARD (one task, one CTA — the decision) ═══ */}
        {profile && !farmSwitching && (
          <NextActionCard
            decision={farmDecision}
            taskViewModel={farmDecision.taskViewModel}
            loading={farmDecision.loading}
            onDoThisNow={() => primaryTask && setShowTaskAction(true)}
            onSetStage={() => setShowStageModal(true)}
            onGoToSetup={() => navigate('/profile/setup')}
            onAddUpdate={handleStartUpdate}
            t={t}
            language={language}
          />
        )}

        {/* ═══ MODALS (unchanged) ═══ */}
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
                farmerId={selectedUpdateFarm?.id || profile?.id}
                farmName={selectedUpdateFarm?.farmName}
                seasonStage={season?.stage}
                entries={season?.entries || []}
                onComplete={() => {
                  setShowUpdateFlow(false);
                  setSelectedUpdateFarm(null);
                  refreshSeason();
                  // Re-run engine — farm update changes updatedAt and may generate new tasks
                  if (currentFarmId) loadPrimaryTask(currentFarmId);
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
              if (currentFarmId) loadPrimaryTask(currentFarmId);
            }}
          />
        )}

        {/* ═══ Task Action Modal ═══ */}
        {showTaskAction && primaryTask && (
          <TaskActionModal
            task={primaryTask}
            onComplete={handleCompleteTask}
            onClose={() => setShowTaskAction(false)}
            completing={taskCompleting}
            t={t}
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
  // ─── Loading ────────────────
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
  // ─── Empty state ────────────
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
  // ─── Modals ─────────────────
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
