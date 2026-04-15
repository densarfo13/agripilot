/**
 * FarmerProgressPage — simple farmer-facing progress view at /progress.
 *
 * Shows:
 *   1. Tasks completed today (count + list)
 *   2. Crop progress (stage + visual)
 *   3. Weekly activity summary
 *
 * Keeps it simple — no heavy analytics. Focus on what farmers understand quickly.
 * Dark theme, inline styles, all text via useTranslation().
 */

import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getFarmTasks } from '../lib/api.js';
import { getCropLabel } from '../utils/crops.js';
import { STAGE_EMOJIS, STAGE_KEYS } from '../utils/cropStages.js';
import { SECTION_ICONS } from '../lib/farmerIcons.js';

// Crop stage progression order for the visual indicator
const STAGE_ORDER = [
  'planning', 'land_preparation', 'planting', 'germination',
  'vegetative', 'flowering', 'fruiting', 'harvest', 'post_harvest',
];

export default function FarmerProgressPage() {
  const { currentFarmId, profile } = useProfile();
  const { t } = useTranslation();
  const { isOnline } = useNetwork();

  const [taskCount, setTaskCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentFarmId) return;
    setLoading(true);
    try {
      const data = await getFarmTasks(currentFarmId);
      setTaskCount((data.tasks || []).length);
      setCompletedCount(data.completedCount || 0);
    } catch {
      // Non-blocking — show whatever we have
    } finally {
      setLoading(false);
    }
  }, [currentFarmId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalTasks = taskCount + completedCount;
  const pct = totalTasks > 0 ? Math.min(100, Math.round((completedCount / totalTasks) * 100)) : 0;

  const cropType = profile?.cropType || profile?.crop || '';
  const cropStage = profile?.cropStage || '';
  const stageIndex = STAGE_ORDER.indexOf(cropStage);
  const stageProgress = stageIndex >= 0 ? Math.round(((stageIndex + 1) / STAGE_ORDER.length) * 100) : 0;

  if (!profile) return null;

  return (
    <div style={S.page} data-testid="farmer-progress-page">
      {/* Page title */}
      <div style={S.pageHeader}>
        <span style={S.pageIcon}>{SECTION_ICONS.completed}</span>
        <h1 style={S.pageTitle}>{t('progress.title') || 'My Progress'}</h1>
      </div>

      {/* Loading */}
      {loading && (
        <div style={S.loadingWrap}>
          <span style={S.spinner} />
        </div>
      )}

      {!loading && (
        <div style={S.sections}>

          {/* ═══ 1. TASKS COMPLETED ═══ */}
          <div style={S.card}>
            <div style={S.sectionHeader}>
              <span style={S.sectionIcon}>{SECTION_ICONS.completed}</span>
              <span style={S.sectionLabel}>{t('progress.tasksCompleted') || 'Tasks completed'}</span>
            </div>
            <div style={S.statRow}>
              <span style={S.statNumber}>{completedCount}</span>
              <span style={S.statOf}>{t('dashboard.of') || 'of'}</span>
              <span style={S.statTotal}>{totalTasks}</span>
            </div>
            <div style={S.progressTrack}>
              <div style={{ ...S.progressFill, width: `${pct}%` }} />
            </div>
            <div style={S.progressLabel}>
              {pct}% {t('progress.complete') || 'complete'}
            </div>
            {taskCount > 0 && (
              <div style={S.remainingNote}>
                {SECTION_ICONS.nextTasks} {taskCount} {t('progress.remaining') || 'remaining'}
              </div>
            )}
            {taskCount === 0 && completedCount > 0 && (
              <div style={S.allDoneNote}>
                {SECTION_ICONS.completed} {t('progress.allDone') || 'All caught up!'}
              </div>
            )}
          </div>

          {/* ═══ 2. CROP PROGRESS ═══ */}
          {cropType && (
            <div style={S.card}>
              <div style={S.sectionHeader}>
                <span style={S.sectionIcon}>{SECTION_ICONS.crop}</span>
                <span style={S.sectionLabel}>{t('progress.cropProgress') || 'Crop progress'}</span>
              </div>
              <div style={S.cropRow}>
                <span style={S.cropName}>{getCropLabel(cropType)}</span>
                {cropStage && (
                  <span style={S.stageBadge}>
                    {STAGE_EMOJIS[cropStage] || SECTION_ICONS.growth}{' '}
                    {t(STAGE_KEYS[cropStage]) || cropStage.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              {cropStage && stageIndex >= 0 && (
                <>
                  <div style={S.stageTrack}>
                    <div style={{ ...S.stageFill, width: `${stageProgress}%` }} />
                  </div>
                  <div style={S.stageSteps}>
                    {STAGE_ORDER.map((s, i) => (
                      <div
                        key={s}
                        style={{
                          ...S.stepDot,
                          background: i <= stageIndex ? '#22C55E' : 'rgba(255,255,255,0.12)',
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══ 3. WEEKLY ACTIVITY ═══ */}
          <div style={S.card}>
            <div style={S.sectionHeader}>
              <span style={S.sectionIcon}>{SECTION_ICONS.weeklyActivity}</span>
              <span style={S.sectionLabel}>{t('progress.weeklyActivity') || 'This week'}</span>
            </div>
            <div style={S.activityGrid}>
              <div style={S.activityItem}>
                <span style={S.activityIcon}>{SECTION_ICONS.completed}</span>
                <span style={S.activityValue}>{completedCount}</span>
                <span style={S.activityLabel}>{t('progress.done') || 'Done'}</span>
              </div>
              <div style={S.activityItem}>
                <span style={S.activityIcon}>{SECTION_ICONS.currentTask}</span>
                <span style={S.activityValue}>{taskCount}</span>
                <span style={S.activityLabel}>{t('progress.pending') || 'Pending'}</span>
              </div>
              <div style={S.activityItem}>
                <span style={S.activityIcon}>{SECTION_ICONS.onTrack}</span>
                <span style={S.activityValue}>{pct}%</span>
                <span style={S.activityLabel}>{t('progress.rate') || 'Rate'}</span>
              </div>
            </div>
          </div>

          {/* ═══ 4. INSIGHT BLOCK (motivational) ═══ */}
          <div style={S.insightCard}>
            <span style={S.insightIcon}>
              {pct >= 80 ? '\uD83C\uDF1F' : pct >= 50 ? '\uD83D\uDCAA' : '\uD83C\uDF31'}
            </span>
            <div style={S.insightText}>
              <span style={S.insightTitle}>
                {pct >= 80
                  ? (t('progress.insightGreat') || 'Great work!')
                  : pct >= 50
                    ? (t('progress.insightGood') || 'Keep it up!')
                    : (t('progress.insightStart') || 'Getting started')}
              </span>
              <span style={S.insightDesc}>
                {pct >= 80
                  ? (t('progress.insightGreatDesc') || 'You\'re ahead of most farmers this week.')
                  : pct >= 50
                    ? (t('progress.insightGoodDesc') || 'You\'re making good progress on your tasks.')
                    : (t('progress.insightStartDesc') || 'Complete your tasks to keep your farm on track.')}
              </span>
            </div>
          </div>

          {/* Offline note */}
          {!isOnline && (
            <div style={S.offlineNote}>
              {t('progress.offlineNote') || 'Some data may be outdated while offline.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
    padding: '0 0 5rem 0',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    padding: '1.125rem 1.25rem',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  pageIcon: {
    fontSize: '1.25rem',
  },
  pageTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    margin: 0,
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 0',
  },
  spinner: {
    display: 'inline-block',
    width: '1.5rem',
    height: '1.5rem',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTopColor: '#22C55E',
    borderRadius: '50%',
    animation: 'farroway-spin 0.8s linear infinite',
  },
  sections: {
    padding: '0.75rem 1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '18px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  sectionIcon: {
    fontSize: '1rem',
  },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  // Task stats
  statRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.375rem',
    marginBottom: '0.625rem',
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#22C55E',
    lineHeight: 1,
  },
  statOf: {
    fontSize: '0.875rem',
    color: '#6F8299',
  },
  statTotal: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#9FB3C8',
  },
  progressTrack: {
    height: '8px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '4px',
    background: '#22C55E',
    transition: 'width 0.3s ease',
    minWidth: '4px',
  },
  progressLabel: {
    fontSize: '0.75rem',
    color: '#6F8299',
    fontWeight: 600,
  },
  remainingNote: {
    marginTop: '0.5rem',
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    fontWeight: 500,
  },
  allDoneNote: {
    marginTop: '0.5rem',
    fontSize: '0.8125rem',
    color: '#EAF2FF',
    fontWeight: 600,
  },
  // Crop progress
  cropRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  cropName: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  stageBadge: {
    fontSize: '0.75rem',
    color: '#EAF2FF',
    fontWeight: 600,
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.06)',
  },
  stageTrack: {
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  stageFill: {
    height: '100%',
    borderRadius: '3px',
    background: 'linear-gradient(90deg, #22C55E, #86EFAC)',
    transition: 'width 0.3s ease',
  },
  stageSteps: {
    display: 'flex',
    gap: '4px',
    justifyContent: 'space-between',
  },
  stepDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  // Weekly activity
  activityGrid: {
    display: 'flex',
    gap: '0.5rem',
  },
  activityItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.875rem 0.5rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.04)',
  },
  activityIcon: {
    fontSize: '1.125rem',
  },
  activityValue: {
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#EAF2FF',
    lineHeight: 1,
  },
  activityLabel: {
    fontSize: '0.625rem',
    fontWeight: 600,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  // ─── Insight block ───────
  insightCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '1.125rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    animation: 'farroway-fade-in 0.4s ease-out',
  },
  insightIcon: {
    fontSize: '1.75rem',
    flexShrink: 0,
  },
  insightText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
  },
  insightTitle: {
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#EAF2FF',
  },
  insightDesc: {
    fontSize: '0.75rem',
    color: '#9FB3C8',
    fontWeight: 500,
    lineHeight: 1.4,
  },
  offlineNote: {
    fontSize: '0.75rem',
    color: 'rgba(245,158,11,0.6)',
    textAlign: 'center',
    padding: '0.5rem',
  },
};
