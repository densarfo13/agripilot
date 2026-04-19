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

  // Re-derive localized tasks whenever the language or the raw today
  // payload changes. Using useMemo keeps the re-render cheap.
  const { primaryTask, secondaryTasks, riskAlerts, weatherAlerts, weatherBadge } = useMemo(() => {
    const today = state.today;
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
    await completeCycleTask(task.id);
    await reload();
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
    try {
      if (modal.mode === 'skip' && modal.task) {
        await skipCycleTask(modal.task.id, data.reason);
      } else if (modal.mode === 'issue' && activeCycle?.id) {
        await reportCycleIssue(activeCycle.id, data);
      } else if (modal.mode === 'harvest' && activeCycle?.id) {
        await submitCycleHarvest(activeCycle.id, data);
      }
    } finally {
      await reload();
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

  return (
    <Shell>
      <h1 style={S.pageTitle}>{t('actionHome.todayHeader')}</h1>
      {state.today?.nextActionSummary && (
        <p style={S.pageSummary}>{state.today.nextActionSummary}</p>
      )}

      <PrimaryTaskCard
        task={primaryTask}
        warning={warning}
        onComplete={handleComplete}
        onSkip={openSkipModal}
        onReportIssue={openIssueModal}
        onHarvest={openHarvestModal}
        harvestEligible={harvestEligible}
      />

      <FeedbackModal
        open={modal.open}
        mode={modal.mode}
        onClose={() => setModal({ open: false, mode: null, task: null })}
        onSubmit={handleModalSubmit}
      />

      <SecondaryTaskList tasks={secondaryTasks} />

      <RiskAlertsPanel alerts={riskAlerts} weatherAlerts={weatherAlerts} weatherBadge={weatherBadge} />

      <ProgressSummaryCard
        tasksDone={tasksDone}
        cyclesActive={cyclesActive}
      />

      <CropStageCard
        stage={activeCycle?.lifecycleStatus}
        cropName={activeCycle?.cropDisplayName || activeCycle?.cropType}
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

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  pageSummary: { color: '#9FB3C8', fontSize: '0.9375rem', margin: '0 0 0.5rem', lineHeight: 1.45 },
  muted: { color: '#9FB3C8' },
};
