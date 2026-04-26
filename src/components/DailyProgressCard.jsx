/**
 * DailyProgressCard — small progress panel for the farm home.
 *
 * Renders:
 *   • streak pill + motivational line
 *   • progress score label (Strong / Good / Fair / Getting started)
 *     with a tiny progress bar
 *   • today summary (X of Y done)
 *   • next best action
 *   • any unseen milestones as a small celebratory strip
 *
 * Mobile-first, Farroway dark theme, matches the existing card family
 * (same outer wrapper style as TodaysTasksCard and FarmInsightCard).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  getDailyProgress, acknowledgeMilestone,
} from '../lib/progress/progressTracker.js';
import { useTranslation } from '../i18n/index.js';

function hasStorage() { return typeof window !== 'undefined' && !!window.localStorage; }

function readCompletions() {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem('farroway.taskCompletions');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function readTodayTasks(farmId) {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem('farroway.dailyTasks.v1');
    const parsed = raw ? JSON.parse(raw) : null;
    const slot = parsed && parsed.byFarm && parsed.byFarm[farmId || 'nofarm'];
    return (slot && Array.isArray(slot.tasks)) ? slot.tasks : [];
  } catch { return []; }
}

function normaliseFarm(farm) {
  if (!farm || typeof farm !== 'object') return null;
  return {
    id:                 farm.id || farm._id || null,
    // `crop` is canonical (canonicalizeFarmPayload in lib/api.js).
    crop:               farm.crop || null,
    farmType:           farm.farmType || 'small_farm',
    cropStage:          farm.cropStage || farm.stage || null,
    normalizedAreaSqm:  farm.normalizedAreaSqm || null,
    size:               farm.size || null,
    sizeUnit:           farm.sizeUnit || null,
    countryCode:        farm.countryCode || farm.country || null,
  };
}

const TONE = {
  strong:  '#86EFAC', good: '#86EFAC',
  fair:    '#FDE68A', low:  '#FDE68A', 'getting': '#FDE68A',
};

export default function DailyProgressCard({
  farm, user = null, issues = [], risk = null, justCompleted = false,
} = {}) {
  const { t } = useTranslation();
  const mapped = useMemo(() => normaliseFarm(farm), [farm]);
  const [tick, setTick] = useState(0);

  // Re-compute when localStorage changes (completing a task elsewhere
  // in the app should reflect here without a full reload).
  useEffect(() => {
    function onStorage(e) {
      if (!e || !e.key) { setTick((n) => n + 1); return; }
      if (e.key === 'farroway.taskCompletions' || e.key === 'farroway.dailyTasks.v1') {
        setTick((n) => n + 1);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const view = useMemo(() => {
    if (!mapped) return null;
    const completions = readCompletions();
    const tasks = readTodayTasks(mapped.id);
    return getDailyProgress({
      user, farm: mapped, tasks, completions,
      issues, risk, justCompleted,
    });
  // tick forces re-evaluation when storage changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapped, user, issues, risk, justCompleted, tick]);

  if (!view) return null;

  const { streak, score, today, nextAction, milestones, motivation } = view;
  const color = TONE[score.label] || TONE.good;

  return (
    <div style={S.wrap} data-testid="daily-progress-panel">
      <div style={S.headerRow}>
        <div style={S.title}>
          {t('progress.title') || 'Today\u2019s progress'}
        </div>
        <div style={{ ...S.streakPill, borderColor: color, color }}>
          <span style={S.streakDot} />
          {streak.currentStreak > 0
            ? `${streak.currentStreak} day streak`
            : (t('progress.streak.noneShort') || 'No streak yet')}
        </div>
      </div>

      {streak.message && streak.message.fallback && (
        <div style={S.streakMsg}>
          {t(streak.message.key) !== streak.message.key
            ? t(streak.message.key)
            : streak.message.fallback}
        </div>
      )}

      {/* Score block */}
      <div style={S.scoreRow}>
        <div style={S.scoreLabelCol}>
          <div style={S.scoreLabel}>
            {t('progress.score.farmStatus') || 'Farm status'}
          </div>
          <div style={{ ...S.scoreValue, color }}>
            {t(score.labelKey) !== score.labelKey ? t(score.labelKey) : score.labelFallback}
          </div>
        </div>
        <div style={S.scoreBarWrap} aria-hidden="true">
          <div style={{ ...S.scoreBarFill, width: `${score.score}%`,
                         background: color }} />
        </div>
      </div>
      <div style={S.explanation}>
        {t(score.explanationKey) !== score.explanationKey
          ? t(score.explanationKey)
          : score.explanation}
      </div>

      {/* Today summary */}
      <div style={S.section}>
        <div style={S.sectionLabel}>
          {t('progress.today.label') || 'Today'}
        </div>
        <div style={S.sectionBody}>
          {t(today.summary.key) !== today.summary.key
            ? t(today.summary.key)
            : today.summary.fallback}
        </div>
      </div>

      {/* Next best action */}
      <div style={S.section}>
        <div style={S.sectionLabel}>
          {t('progress.next.label') || 'Next'}
        </div>
        <div style={S.nextAction}>
          → {t(nextAction.key) !== nextAction.key ? t(nextAction.key) : nextAction.fallback}
        </div>
      </div>

      {/* Motivation line (after-action reinforcement) */}
      {motivation && motivation.fallback && (
        <div style={S.motivation}>
          {t(motivation.key) !== motivation.key ? t(motivation.key) : motivation.fallback}
        </div>
      )}

      {/* Unseen milestones */}
      {milestones.unseen.length > 0 && (
        <div style={S.milestonesStrip}>
          {milestones.unseen.map((m) => (
            <div
              key={m.type}
              style={S.milestoneChip}
              role="button"
              tabIndex={0}
              onClick={() => acknowledgeMilestone(m.type)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  acknowledgeMilestone(m.type);
                }
              }}
              data-testid={`milestone-${m.type}`}
            >
              <span style={S.milestoneTitle}>
                {t(m.titleKey) !== m.titleKey ? t(m.titleKey) : m.title}
              </span>
              <span style={S.milestoneMsg}>
                {t(m.messageKey) !== m.messageKey ? t(m.messageKey) : m.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S = {
  wrap: {
    width: '100%', background: '#111D2E',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px', padding: '1rem 1.125rem 1.125rem',
    marginTop: '1rem', color: '#fff',
    display: 'flex', flexDirection: 'column', gap: '0.75rem',
  },
  headerRow: { display: 'flex', alignItems: 'center',
               justifyContent: 'space-between', gap: '0.5rem' },
  title: { fontSize: '1rem', fontWeight: 700, color: '#E2E8F0' },
  streakPill: {
    fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.02em',
    border: '1px solid', padding: '0.25rem 0.625rem',
    borderRadius: '999px', display: 'inline-flex', alignItems: 'center',
    gap: '0.375rem', background: 'rgba(134,239,172,0.06)',
  },
  streakDot: { width: '6px', height: '6px', borderRadius: '50%',
               background: 'currentColor' },
  streakMsg: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)',
               lineHeight: 1.4 },
  scoreRow: { display: 'flex', alignItems: 'center', gap: '0.75rem',
              marginTop: '0.25rem' },
  scoreLabelCol: { display: 'flex', flexDirection: 'column', minWidth: '7rem' },
  scoreLabel: { fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)',
                textTransform: 'uppercase', letterSpacing: '0.04em' },
  scoreValue: { fontSize: '1.125rem', fontWeight: 700 },
  scoreBarWrap: { flex: 1, height: '8px', background: 'rgba(255,255,255,0.08)',
                   borderRadius: '999px', overflow: 'hidden' },
  scoreBarFill: { height: '100%', borderRadius: '999px',
                  transition: 'width 240ms ease-out' },
  explanation: { fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)',
                 lineHeight: 1.45 },
  section: { display: 'flex', flexDirection: 'column', gap: '0.125rem' },
  sectionLabel: { fontSize: '0.6875rem', color: 'rgba(255,255,255,0.5)',
                   textTransform: 'uppercase', letterSpacing: '0.04em' },
  sectionBody: { fontSize: '0.875rem', color: '#F8FAFC' },
  nextAction: { fontSize: '0.875rem', color: '#F8FAFC', lineHeight: 1.4 },
  motivation: { fontSize: '0.8125rem', color: '#86EFAC', lineHeight: 1.4,
                 padding: '0.5rem 0.625rem',
                 background: 'rgba(134,239,172,0.06)',
                 border: '1px solid rgba(134,239,172,0.18)',
                 borderRadius: '10px' },
  milestonesStrip: { display: 'flex', flexDirection: 'column', gap: '0.5rem',
                     marginTop: '0.125rem' },
  milestoneChip: { cursor: 'pointer', display: 'flex', flexDirection: 'column',
                   gap: '0.125rem', padding: '0.625rem 0.75rem',
                   borderRadius: '12px',
                   background: 'rgba(134,239,172,0.08)',
                   border: '1px solid rgba(134,239,172,0.3)' },
  milestoneTitle: { fontSize: '0.875rem', color: '#86EFAC', fontWeight: 700 },
  milestoneMsg:   { fontSize: '0.75rem', color: 'rgba(255,255,255,0.75)',
                     lineHeight: 1.4 },
};
