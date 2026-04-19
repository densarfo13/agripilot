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
import TodayContextHeader from '../../components/farmer/TodayContextHeader.jsx';
import NextHint from '../../components/farmer/NextHint.jsx';
import DoneStateCard from '../../components/farmer/DoneStateCard.jsx';
import OptionalChecksSection from '../../components/farmer/OptionalChecksSection.jsx';
import { getCropDisplayName } from '../../utils/getCropDisplayName.js';
import { getTodayScreenState } from '../../utils/getTodayScreenState.js';

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

      {screen.state === 'active' ? (
        <>
          {state.today?.nextActionSummary && (
            <p style={S.pageSummary}>{state.today.nextActionSummary}</p>
          )}

          {/* 2. PRIMARY TASK CARD */}
          <PrimaryTaskCard
            task={screen.primaryTask}
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

const S = {
  page: { minHeight: '100vh', background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)', padding: '1rem 0 3rem' },
  container: { maxWidth: '42rem', margin: '0 auto', padding: '0 1rem', color: '#EAF2FF', display: 'flex', flexDirection: 'column', gap: '0.875rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  pageSummary: { color: '#9FB3C8', fontSize: '0.9375rem', margin: '0 0 0.5rem', lineHeight: 1.45 },
  muted: { color: '#9FB3C8' },
};
