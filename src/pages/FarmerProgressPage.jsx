/**
 * FarmerProgressPage — motivational farmer progress view at /progress.
 *
 * Leads with emotional encouragement, not analytics.
 * Structure:
 *   1. Status headline (emotional — "You're on track", "Great progress!")
 *   2. Simple completion summary (done / left / updated today)
 *   3. Crop progress (visual, not technical)
 *   4. Insight card (short, human-readable)
 *   5. Offline note
 *
 * No dashboard tone. No raw percentages. Farmer-first.
 */

import { useCallback, useEffect, useState } from 'react';
import { useProfile } from '../context/ProfileContext.jsx';
import { useTranslation } from '../i18n/index.js';
import { useNetwork } from '../context/NetworkContext.jsx';
import { getFarmTasks } from '../lib/api.js';
import { getCropLabel } from '../utils/crops.js';
import { STAGE_EMOJIS, STAGE_KEYS } from '../utils/cropStages.js';
import { SECTION_ICONS } from '../lib/farmerIcons.js';

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
      // Non-blocking
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

  // Pick status headline + icon based on progress
  const statusKey = pct >= 60 ? 'progress.statusGreat' : pct >= 1 ? 'progress.statusGood' : 'progress.statusStart';
  const statusIcon = pct >= 60 ? '\u2728' : pct >= 1 ? '\uD83D\uDCAA' : '\uD83C\uDF31';

  if (!profile) return null;

  return (
    <div style={S.page} data-testid="farmer-progress-page">
      {/* Page title */}
      <div style={S.pageHeader}>
        <span style={S.pageIcon}>{SECTION_ICONS.completed}</span>
        <h1 style={S.pageTitle}>{t('progress.title')}</h1>
      </div>

      {loading && (
        <div style={S.loadingWrap}>
          <span style={S.spinner} />
        </div>
      )}

      {!loading && (
        <div style={S.sections}>

          {/* ═══ 1. STATUS HEADLINE ═══ */}
          <div style={S.heroCard}>
            <span style={S.heroIcon}>{statusIcon}</span>
            <div style={S.heroTitle}>{t(statusKey)}</div>
            {completedCount > 0 && (
              <div style={S.heroSubtext}>
                {t('progress.doneToday', { count: completedCount })}
              </div>
            )}
          </div>

          {/* ═══ 2. SIMPLE COMPLETION SUMMARY ═══ */}
          <div style={S.summaryRow}>
            <div style={S.summaryItem}>
              <span style={S.summaryValue}>{completedCount}</span>
              <span style={S.summaryLabel}>{t('progress.done')}</span>
            </div>
            <div style={S.summaryDivider} />
            <div style={S.summaryItem}>
              <span style={S.summaryValue}>{taskCount}</span>
              <span style={S.summaryLabel}>{t('progress.pending')}</span>
            </div>
            {completedCount > 0 && (
              <>
                <div style={S.summaryDivider} />
                <div style={S.summaryItem}>
                  <span style={S.summaryCheck}>{SECTION_ICONS.completed}</span>
                  <span style={S.summaryLabel}>{t('progress.updatedToday')}</span>
                </div>
              </>
            )}
          </div>

          {/* ═══ 3. PROGRESS BAR (simple, no raw %) ═══ */}
          {totalTasks > 0 && (
            <div style={S.barCard}>
              <div style={S.progressTrack}>
                <div style={{ ...S.progressFill, width: `${pct}%` }} />
              </div>
              {taskCount === 0 && completedCount > 0 && (
                <div style={S.allDoneNote}>
                  {SECTION_ICONS.completed} {t('progress.allDone')}
                </div>
              )}
              {taskCount > 0 && (
                <div style={S.remainingNote}>
                  {t('progress.leftToday', { count: taskCount })}
                </div>
              )}
            </div>
          )}

          {/* ═══ 4. CROP PROGRESS ═══ */}
          {cropType && (
            <div style={S.card}>
              <div style={S.sectionHeader}>
                <span style={S.sectionIcon}>{SECTION_ICONS.crop}</span>
                <span style={S.sectionLabel}>{t('progress.cropProgress')}</span>
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
              )}
            </div>
          )}

          {/* ═══ 5. INSIGHT CARD ═══ */}
          <div style={S.insightCard}>
            <span style={S.insightIcon}>
              {pct >= 60 ? '\uD83C\uDF1F' : pct >= 1 ? '\uD83D\uDCAA' : '\uD83C\uDF31'}
            </span>
            <div style={S.insightText}>
              <span style={S.insightTitle}>
                {pct >= 60
                  ? (t('progress.insightGreat') || 'Great work!')
                  : pct >= 1
                    ? (t('progress.insightGood') || 'Keep it up!')
                    : (t('progress.insightStart') || 'Getting started')}
              </span>
              <span style={S.insightDesc}>
                {pct >= 60
                  ? (t('progress.insightGreatDesc') || 'You\'re ahead of most farmers this week.')
                  : pct >= 1
                    ? (t('progress.insightGoodDesc') || 'You\'re making good progress on your tasks.')
                    : (t('progress.insightStartDesc') || 'Complete your tasks to keep your farm on track.')}
              </span>
            </div>
          </div>

          {/* Offline note */}
          {!isOnline && (
            <div style={S.offlineNote}>
              {t('progress.offlineNote')}
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
  pageIcon: { fontSize: '1.25rem' },
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
  // ─── Hero status headline ───
  heroCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '2rem 1.25rem 1.75rem',
    borderRadius: '22px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
    animation: 'farroway-fade-in 0.3s ease-out',
  },
  heroIcon: { fontSize: '2.5rem' },
  heroTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#EAF2FF',
    textAlign: 'center',
  },
  heroSubtext: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#9FB3C8',
    textAlign: 'center',
  },
  // ─── Summary row ───
  summaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.125rem',
  },
  summaryValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#EAF2FF',
    lineHeight: 1,
  },
  summaryCheck: {
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  summaryLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  summaryDivider: {
    width: '1px',
    height: '2rem',
    background: 'rgba(255,255,255,0.08)',
  },
  // ─── Progress bar card ───
  barCard: {
    padding: '1rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  progressTrack: {
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    borderRadius: '3px',
    background: '#22C55E',
    transition: 'width 0.4s ease',
    minWidth: '4px',
  },
  remainingNote: {
    fontSize: '0.8125rem',
    color: '#9FB3C8',
    fontWeight: 500,
    textAlign: 'center',
  },
  allDoneNote: {
    fontSize: '0.8125rem',
    color: '#EAF2FF',
    fontWeight: 600,
    textAlign: 'center',
  },
  // ─── General card ───
  card: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '18px',
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  sectionIcon: { fontSize: '1rem' },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6F8299',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  // ─── Crop progress ───
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
  // ─── Insight card ───
  insightCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    padding: '1.125rem 1.25rem',
    borderRadius: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
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
