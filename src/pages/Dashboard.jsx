import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeTrackEvent } from '../lib/analytics.js';
import { languageToVoiceCode, speakText } from '../lib/voice.js';
import { useTranslation } from '../i18n/index.js';
import { calculateFarmScore } from '../lib/farmScore.js';
import { getLandBoundaries, getSeedScans, getFarmTasks } from '../lib/api.js';
import { completeTaskSafe } from '../services/taskService.js';
import { useAppPrefs } from '../context/AppPrefsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useNetwork } from '../context/NetworkContext.jsx';
import { useSeason } from '../context/SeasonContext.jsx';
import { useWeather } from '../context/WeatherContext.jsx';
// Advanced cards lazy-loaded inside expanded tools section
import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx';
import FarmSwitcher from '../components/FarmSwitcher.jsx';
import FarmEditModal from '../components/FarmEditModal.jsx';
import CropStageModal from '../components/CropStageModal.jsx';
import SeasonalTimingModal from '../components/SeasonalTimingModal.jsx';
import FarmPicker from '../components/FarmPicker.jsx';
import FarmWeatherCard from '../components/FarmWeatherCard.jsx';
import FarmPestRiskCard from '../components/FarmPestRiskCard.jsx';
import FarmHarvestCard from '../components/FarmHarvestCard.jsx';
import YieldRecordsCard from '../components/YieldRecordsCard.jsx';
import FarmEconomicsCard from '../components/FarmEconomicsCard.jsx';
import FarmBenchmarkCard from '../components/FarmBenchmarkCard.jsx';
import FarmerHeader from '../components/FarmerHeader.jsx';
import NextActionCard from '../components/NextActionCard.jsx';
import WeatherStatusCard from '../components/WeatherStatusCard.jsx';
import QuickActionsRow from '../components/QuickActionsRow.jsx';
import WeeklyProgressCard from '../components/WeeklyProgressCard.jsx';
import TaskActionModal from '../components/TaskActionModal.jsx';
import { useUserMode } from '../context/UserModeContext.jsx';
import ModeIndicator from '../components/ModeIndicator.jsx';
import ActionFeedbackBanner from '../components/ActionFeedbackBanner.jsx';
import { useFarmDecision } from '../hooks/useFarmDecision.js';

// Lazy-load mode-specific components
const BasicFarmerHome = lazy(() => import('../components/farmer/BasicFarmerHome.jsx'));
const FarmerSettingsPanel = lazy(() => import('../components/FarmerSettingsPanel.jsx'));

// Lazy-load advanced features
const LandBoundaryCapture = lazy(() => import('../components/LandBoundaryCapture.jsx'));
const SeedScanFlow = lazy(() => import('../components/SeedScanFlow.jsx'));
const SellReadinessInput = lazy(() => import('../components/SellReadinessInput.jsx'));

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
  const { weather } = useWeather();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { isOnline } = useNetwork();
  const farmScore = calculateFarmScore(profile || {});
  const setupComplete = farmScore.isReady === true;

  // Decision engine — recalculates automatically when inputs change

  const [showUpdateFlow, setShowUpdateFlow] = useState(false);
  const [showFarmPicker, setShowFarmPicker] = useState(false);
  const [selectedUpdateFarm, setSelectedUpdateFarm] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [boundaries, setBoundaries] = useState([]);
  const [seedScans, setSeedScans] = useState([]);
  const [farmDataLoading, setFarmDataLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState(null); // 'tasks' | 'harvest' | 'money' | 'tools' | null

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
  const prevFarmIdRef = useRef(null); // null on mount — ensures first load always triggers

  // Decision engine hook — provides primaryAction, todaysPlan, farmStatus
  const farmDecision = useFarmDecision({
    profile, primaryTask, taskCount, completedCount, weather, isOnline, taskLoading,
  });

  // ─── Farm-scoped data loading (skip in basic mode for perf) ──
  const loadFarmScopedData = useCallback(async (farmId) => {
    if (!setupComplete || !isOnline || isBasic) return;
    setFarmDataLoading(true);
    try {
      const [bData, sData] = await Promise.all([
        getLandBoundaries(farmId),
        getSeedScans(farmId),
      ]);
      setBoundaries(bData.boundaries || []);
      setSeedScans(sData.scans || []);
    } catch { /* non-blocking */ }
    finally { setFarmDataLoading(false); }
  }, [setupComplete, isOnline]);

  // ─── Primary task fetch (priority: high > medium > low) ────
  // Server returns only pending tasks (completed ones filtered out in DB)
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
      setBoundaries([]);
      setSeedScans([]);
      setPrimaryTask(null);
      prevFarmIdRef.current = currentFarmId;
      loadFarmScopedData(currentFarmId);
      loadPrimaryTask(currentFarmId);
    } else if (currentFarmId && !prevFarmIdRef.current) {
      prevFarmIdRef.current = currentFarmId;
      loadFarmScopedData(currentFarmId);
      loadPrimaryTask(currentFarmId);
    }
  }, [currentFarmId, loadFarmScopedData, loadPrimaryTask]);

  useEffect(() => {
    if (currentFarmId && setupComplete && isOnline) {
      loadFarmScopedData(currentFarmId);
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

  function toggleSection(name) {
    setExpandedSection((prev) => (prev === name ? null : name));
  }

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
      setFeedbackMessage(`\u2705 ${task.title}`);
      setFeedbackStatus(result.offline ? 'offline' : 'success');
      if (navigator.vibrate) try { navigator.vibrate(result.offline ? [30, 30, 30] : 50); } catch {}
      setTimeout(() => { setTaskSuccess(false); setFeedbackMessage(null); }, 3000);
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

  // Weekly progress: completedCount from server, taskCount = pending
  const doneThisWeek = completedCount;
  const weekTotal = taskCount + completedCount;

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
          {/* Header + mode badge */}
          <div style={S.headerRow}>
            <FarmerHeader user={user} profile={profile} t={t} />
            <ModeIndicator />
          </div>
          <FarmSwitcher />
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
                profile={profile}
                user={user}
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

  // ─── STANDARD MODE: icon + text, quick actions ────────────
  return (
    <div style={S.page}>
      <div style={S.container}>

        {/* ═══ 1. Welcome header ═══ */}
        <FarmerHeader user={user} profile={profile} t={t} />

        {/* Setup banner removed — NextActionCard now handles the setup state
           as the primary guided action, avoiding duplicate CTAs. */}

        {/* ═══ Farm switcher (compact) ═══ */}
        <FarmSwitcher />

        {farmSwitching && (
          <div style={S.switchLoading}>
            <div style={S.loadingText}>{t('farm.switchingFarm')}</div>
          </div>
        )}

        {/* ═══ Empty state: no farms ═══ */}
        {!profile && !profileLoading && (
          <div style={S.emptyState}>
            <span style={{ fontSize: '3rem' }}>{'\uD83C\uDF3E'}</span>
            <div style={S.emptyTitle}>{t('farm.noFarmsTitle')}</div>
            <div style={S.emptyDesc}>{t('farm.noFarmsDesc')}</div>
            <button onClick={() => navigate('/profile/setup')} style={S.emptyBtn}>
              {t('farm.createFirst')}
            </button>
          </div>
        )}

        {/* ═══ Task feedback (success / offline / failed) ═══ */}
        <ActionFeedbackBanner
          status={feedbackStatus}
          message={feedbackMessage}
          onDismiss={() => { setFeedbackStatus(null); setFeedbackMessage(null); }}
          onRetry={() => primaryTask && handleCompleteTask(primaryTask)}
        />

        {/* ═══ GUIDED NEXT ACTION (decision engine) ═══ */}
        {profile && !farmSwitching && (
          <NextActionCard
            decision={farmDecision}
            loading={farmDecision.loading}
            onDoThisNow={() => primaryTask && setShowTaskAction(true)}
            onSetStage={() => setShowStageModal(true)}
            onGoToSetup={() => navigate('/profile/setup')}
            onAddUpdate={handleStartUpdate}
            t={t}
          />
        )}

        {/* ═══ 3. WEATHER GUIDANCE ═══ */}
        {profile && !farmSwitching && setupComplete && (
          <WeatherStatusCard guidance={farmDecision.weatherGuidance} t={t} />
        )}

        {/* ═══ 4. QUICK LINKS (compact, secondary) ═══ */}
        {profile && !farmSwitching && setupComplete && (
          <div style={S.quickLinks}>
            <button onClick={() => navigate('/my-farm')} style={S.quickLink}>
              {'\uD83C\uDFE1'} {t('dashboard.myFarm')}
            </button>
            <button onClick={() => navigate('/tasks')} style={S.quickLink}>
              {'\uD83D\uDCCB'} {t('dashboard.allTasks')}
              {taskCount > 0 && <span style={S.quickBadge}>{taskCount}</span>}
            </button>
            <button onClick={() => navigate('/pest-risk-check')} style={S.quickLink}>
              {'\uD83D\uDC1B'} {t('dashboard.checkPests')}
            </button>
          </div>
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

        {showEditModal && profile && (
          <FarmEditModal
            farm={profile}
            onClose={() => setShowEditModal(false)}
            onSaved={() => {
              setShowEditModal(false);
              // Re-run engine after farm edit (crop type, name, etc. may affect decisions)
              if (currentFarmId) loadPrimaryTask(currentFarmId);
            }}
          />
        )}

        {showStageModal && profile && (
          <CropStageModal
            farm={profile}
            onClose={() => setShowStageModal(false)}
            onSaved={() => {
              setShowStageModal(false);
              // Refresh tasks after stage change — new stage may generate new tasks
              if (currentFarmId) loadPrimaryTask(currentFarmId);
            }}
          />
        )}

        {showSeasonModal && profile && (
          <SeasonalTimingModal
            farm={profile}
            onClose={() => setShowSeasonModal(false)}
            onSaved={() => {
              setShowSeasonModal(false);
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
    background: '#0F172A',
    color: '#fff',
    padding: '0.75rem 0.75rem 2rem',
  },
  container: {
    maxWidth: '42rem',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  // ─── Crop stage status bar ──────
  stageStatusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    background: 'rgba(34,197,94,0.08)',
    border: '1px solid rgba(34,197,94,0.2)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    color: '#fff',
    WebkitTapHighlightColor: 'transparent',
    minHeight: '52px',
  },
  stageStatusIcon: {
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  stageStatusText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
  },
  stageStatusLabel: {
    fontSize: '0.9375rem',
    fontWeight: 700,
    color: '#86EFAC',
  },
  stageStatusHint: {
    fontSize: '0.6875rem',
    color: 'rgba(255,255,255,0.4)',
  },
  stageStatusArrow: {
    fontSize: '1.5rem',
    color: 'rgba(34,197,94,0.5)',
    fontWeight: 700,
    flexShrink: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  compactRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  card: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '1.25rem',
    boxShadow: '0 10px 15px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  // ─── Success feedback ────────
  successBanner: {
    borderRadius: '14px',
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    padding: '0.875rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    color: '#86EFAC',
  },
  // ─── Setup banner ───────────
  setupBanner: {
    borderRadius: '14px',
    background: 'rgba(250,204,21,0.08)',
    border: '1px solid rgba(250,204,21,0.25)',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    color: '#fff',
    WebkitTapHighlightColor: 'transparent',
  },
  bannerTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: '#FDE68A',
  },
  bannerDesc: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.55)',
    marginTop: '0.1rem',
  },
  bannerArrow: {
    fontSize: '1.5rem',
    color: '#FDE68A',
    fontWeight: 700,
  },
  // ─── Expanded sections ──────
  expandedSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  collapseBtn: {
    padding: '0.6rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
    WebkitTapHighlightColor: 'transparent',
  },
  // ─── More section ───────────
  quickLinks: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  quickLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: '36px',
    position: 'relative',
    WebkitTapHighlightColor: 'transparent',
  },
  quickBadge: {
    fontSize: '0.5625rem',
    fontWeight: 700,
    color: '#fff',
    background: '#EF4444',
    borderRadius: '6px',
    padding: '1px 4px',
    minWidth: '14px',
    textAlign: 'center',
  },
  moreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.875rem 1rem',
    background: '#1B2330',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    textAlign: 'left',
    minHeight: '48px',
    WebkitTapHighlightColor: 'transparent',
  },
  moreBtnLabel: {
    flex: 1,
    fontWeight: 600,
  },
  moreArrow: {
    fontSize: '1.2rem',
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 700,
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
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  loadingText: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.6)',
  },
  switchLoading: {
    borderRadius: '14px',
    background: '#1B2330',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center',
  },
  // ─── Empty state ────────────
  emptyState: {
    borderRadius: '16px',
    background: '#1B2330',
    padding: '2rem 1.5rem',
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
  },
  emptyDesc: {
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.5,
  },
  emptyBtn: {
    marginTop: '0.5rem',
    borderRadius: '12px',
    background: '#22C55E',
    padding: '0.75rem 1.5rem',
    fontWeight: 700,
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    minHeight: '48px',
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
    borderRadius: '16px 16px 0 0',
    WebkitOverflowScrolling: 'touch',
  },
};
