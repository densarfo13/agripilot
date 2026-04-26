import React, { useMemo } from 'react';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';
import { tSafe } from '../i18n/tSafe.js';
import { buildFarmActionPlan } from '../lib/intelligence/farmActionPlan.js';
import { useTaskCompletion } from '../lib/intelligence/taskCompletion.js';

/**
 * FarmActionPlan — "Your Farm Plan" card.
 *
 * Renders the 4-bucket decision timeline from farmActionPlan.js:
 *   • Now         — what to do today (top 2–3 priority tasks)
 *   • This Week   — what's coming at this stage (3–4 items)
 *   • Coming Up   — next lifecycle stage preview + seasonal cues
 *   • Risk Watch  — top crop-specific risk hints
 *
 * Props
 *   farm           — farm object (required)
 *   weather        — optional weather snapshot; shape matches weatherService
 *   date           — optional date override (defaults to today)
 *   tasks          — optional pre-generated daily tasks (avoids duplication
 *                    when the parent already ran the daily task engine)
 *   yieldEstimate  — optional precomputed yield estimate; when provided,
 *                    the plan reuses its .recommendations bucket instead
 *                    of re-running the yield engine
 *   compact        — boolean; tighter spacing for modal/embedded use
 *   onActionTap    — optional (action) => void callback for "mark done",
 *                    "why this", or deep-linking into task detail
 *
 * The component is memoised on (farm, weather, date, tasks, yieldEstimate)
 * so it stays cheap even on dashboards that re-render often.
 */
export default function FarmActionPlan({
  farm,
  weather = null,
  date = null,
  tasks = null,
  yieldEstimate = null,
  compact = false,
  onActionTap = null,
}) {
  const { t, lang } = useTranslation();

  // Per-farm task-completion store (localStorage, in-memory synced).
  // Enables the "mark done" UX + feeds execution/timing in
  // FarrowayScore + suppresses missed-task alerts in Smart Alerts.
  const { completedIds, toggle } = useTaskCompletion(farm && farm.id);

  const plan = useMemo(
    () => buildFarmActionPlan({ farm, weather, date, tasks, yieldEstimate }),
    [farm, weather, date, tasks, yieldEstimate],
  );

  const styles = buildStyles(compact);
  if (!plan) return null;

  const heading = (k, fallback) => {
    const v = t(k);
    return v && v !== k ? v : fallback;
  };

  const emptyCopy = heading('farmPlan.empty',
    'Your farm plan will fill in as you add a crop, stage, and planting date.');

  const hasAny = plan.now.length + plan.thisWeek.length + plan.comingUp.length
               + plan.riskWatch.length + plan.recommendations.length > 0;

  return (
    <section style={styles.root} data-testid="farm-action-plan"
             aria-label={heading('farmPlan.title', 'Your Farm Plan')}>

      <header style={styles.header}>
        <h2 style={styles.title}>{heading('farmPlan.title', 'Your Farm Plan')}</h2>
        <ConfidencePill level={plan.confidence} t={t} />
      </header>

      {!hasAny && (
        <p style={styles.empty} data-testid="farm-action-plan-empty">{emptyCopy}</p>
      )}

      {plan.now.length > 0 && (
        <Bucket
          title={heading('farmPlan.now', 'Now')}
          subtitle={heading('farmPlan.nowSub', 'What to do today')}
          tone="action"
          testId="farm-plan-now"
          items={plan.now}
          renderItem={(a) => (
            <ActionRow key={a.id} action={a}
                       onTap={onActionTap} t={t} showPriority
                       done={completedIds.has(a.templateId || a.id)}
                       onToggleDone={() => toggle(a.templateId || a.id)} />
          )}
          styles={styles}
        />
      )}

      {plan.thisWeek.length > 0 && (
        <Bucket
          title={heading('farmPlan.thisWeek', 'This Week')}
          subtitle={heading('farmPlan.thisWeekSub', 'Coming up at this stage')}
          tone="plan"
          testId="farm-plan-week"
          items={plan.thisWeek}
          renderItem={(a) => (
            <ActionRow key={a.id} action={a} onTap={onActionTap} t={t} />
          )}
          styles={styles}
        />
      )}

      {plan.comingUp.length > 0 && (
        <Bucket
          title={heading('farmPlan.comingUp', 'Coming Up')}
          subtitle={heading('farmPlan.comingUpSub', 'The next stage of your crop')}
          tone="future"
          testId="farm-plan-future"
          items={plan.comingUp}
          renderItem={(a) => (
            <StageRow key={a.id} action={a} styles={styles} />
          )}
          styles={styles}
        />
      )}

      {plan.riskWatch.length > 0 && (
        <Bucket
          title={heading('farmPlan.riskWatch', 'Risk Watch')}
          subtitle={heading('farmPlan.riskWatchSub', 'Watch for these in your area')}
          tone="risk"
          testId="farm-plan-risk"
          items={plan.riskWatch}
          renderItem={(r) => (
            <RiskRow key={r.id} risk={r} styles={styles} />
          )}
          styles={styles}
        />
      )}

      {plan.recommendations.length > 0 && (
        <Bucket
          title={heading('farmPlan.recommendations',
            'What most affects your yield')}
          subtitle={heading('farmPlan.recommendationsSub',
            'One or two small changes that lift the harvest')}
          tone="rec"
          testId="farm-plan-recs"
          items={plan.recommendations}
          renderItem={(r, i) => (
            <RecRow key={r.id || `rec-${i}`} rec={r} styles={styles} t={t} />
          )}
          styles={styles}
        />
      )}

      {plan.assumptions.length > 0 && (
        <details style={styles.assumptions}>
          <summary style={styles.assumptionsLabel}>
            {heading('farmPlan.why', 'Why this plan?')}
          </summary>
          <ul style={styles.assumptionList}>
            {plan.assumptions.map((a, i) => <li key={i} style={styles.assumptionItem}>{a}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}

function Bucket({ title, subtitle, items, renderItem, tone = 'plan', testId, styles }) {
  return (
    <div style={{ ...styles.bucket, ...styles[`tone_${tone}`] }} data-testid={testId}>
      <div style={styles.bucketHeader}>
        <div style={styles.bucketTitle}>{title}</div>
        {subtitle && <div style={styles.bucketSub}>{subtitle}</div>}
      </div>
      <ul style={styles.list}>
        {items.map((item, i) => renderItem(item, i))}
      </ul>
    </div>
  );
}

function ActionRow({ action, onTap, t, showPriority, done = false, onToggleDone }) {
  const styles = rowStyles;
  const rowStyle = done ? { ...styles.row, ...styles.rowDone } : styles.row;
  const titleStyle = done ? { ...styles.rowTitle, ...styles.rowTitleDone } : styles.rowTitle;
  return (
    <li style={rowStyle}
        data-testid={`action-${action.templateId || action.id}`}>
      {onToggleDone && (
        <button type="button"
                onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
                style={done ? styles.checkDone : styles.check}
                aria-label={done
                  ? tSafe('farmPlan.undo', '')
                  : tSafe('actions.markDone', '')}
                data-testid={`action-done-${action.templateId || action.id}`}>
          {done ? '✓' : ''}
        </button>
      )}
      <div style={styles.rowMain}
           onClick={onTap ? () => onTap(action) : undefined}>
        <div style={styles.rowTitleLine}>
          <span style={titleStyle}>{action.title}</span>
          {showPriority && action.priority === 'high' && !done && (
            <span style={styles.priorityChip}>
              {/* Cleanup §4: route through tSafe so a missing key
                  in non-English UI returns '' rather than the
                  English fallback chip text. */}
              {tSafe('farmPlan.priorityHigh', '')}
            </span>
          )}
          {done && (
            <span style={styles.doneChip}>
              {tSafe('farmPlan.done', '')}
            </span>
          )}
        </div>
        {action.description && (
          <div style={styles.rowSub}>{action.description}</div>
        )}
        {action.why && (
          <div style={styles.rowWhy}>{action.why}</div>
        )}
      </div>
    </li>
  );
}

function StageRow({ action, styles }) {
  return (
    <li style={rowStyles.row} data-testid={`stage-${action.stageKey || 'next'}`}>
      <div style={rowStyles.rowMain}>
        <div style={rowStyles.rowTitleLine}>
          <span style={rowStyles.rowTitle}>{action.title}</span>
          {action.daysUntil != null && (
            <span style={styles.daysPill}>
              ~{action.daysUntil} day{action.daysUntil === 1 ? '' : 's'}
            </span>
          )}
        </div>
        {action.description && <div style={rowStyles.rowSub}>{action.description}</div>}
        {action.why && <div style={rowStyles.rowWhy}>{action.why}</div>}
      </div>
    </li>
  );
}

function RiskRow({ risk, styles }) {
  const sevColor =
    risk.severity === 'high'   ? '#FCA5A5'
  : risk.severity === 'medium' ? '#FCD34D'
                               : '#86EFAC';
  return (
    <li style={rowStyles.row} data-testid={`risk-${risk.id}`}>
      <div style={rowStyles.rowMain}>
        <div style={rowStyles.rowTitleLine}>
          <span style={rowStyles.rowTitle}>{risk.message}</span>
          <span style={{ ...styles.sevDot, background: sevColor }} aria-hidden>•</span>
        </div>
        {risk.why && <div style={rowStyles.rowWhy}>{risk.why}</div>}
      </div>
    </li>
  );
}

function RecRow({ rec, styles, t }) {
  const text = rec.labelKey && t(rec.labelKey) !== rec.labelKey
    ? t(rec.labelKey)
    : rec.label;
  return (
    <li style={rowStyles.row} data-testid={`rec-${rec.id || rec.labelKey || 'rec'}`}>
      <div style={rowStyles.rowMain}>
        <div style={rowStyles.rowTitle}>{text}</div>
        {rec.why && <div style={rowStyles.rowWhy}>{rec.why}</div>}
      </div>
    </li>
  );
}

function ConfidencePill({ level, t }) {
  const label = (level === 'high' && (t('farmPlan.conf.high') !== 'farmPlan.conf.high')) ? t('farmPlan.conf.high')
              : (level === 'medium' && (t('farmPlan.conf.medium') !== 'farmPlan.conf.medium')) ? t('farmPlan.conf.medium')
              : (level === 'low' && (t('farmPlan.conf.low') !== 'farmPlan.conf.low')) ? t('farmPlan.conf.low')
              : level === 'high' ? 'High confidence'
              : level === 'medium' ? 'Medium confidence'
              : 'Low confidence';
  const bg = level === 'high'   ? 'rgba(34,197,94,0.16)'
           : level === 'medium' ? 'rgba(252,211,77,0.16)'
                                : 'rgba(148,163,184,0.16)';
  const fg = level === 'high'   ? '#86EFAC'
           : level === 'medium' ? '#FCD34D'
                                : '#CBD5E1';
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
      background: bg, color: fg,
    }} data-testid="farm-plan-confidence">{label}</span>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const rowStyles = {
  row: {
    listStyle: 'none', padding: '10px 12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', gap: 10, alignItems: 'flex-start',
    cursor: 'pointer',
  },
  rowDone: {
    background: 'rgba(34,197,94,0.06)',
    borderColor: 'rgba(34,197,94,0.22)',
  },
  rowTitleDone: {
    textDecoration: 'line-through',
    color: 'rgba(230,244,234,0.5)',
  },
  check: {
    width: 24, height: 24, borderRadius: 6,
    border: '2px solid rgba(230,244,234,0.4)',
    background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
    padding: 0, color: '#0B1D34',
  },
  checkDone: {
    width: 24, height: 24, borderRadius: 6,
    border: '2px solid #22C55E',
    background: '#22C55E', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
    padding: 0, color: '#0B1D34', fontWeight: 700, fontSize: 14,
  },
  doneChip: {
    padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
    background: 'rgba(34,197,94,0.18)', color: '#86EFAC',
    letterSpacing: 0.3, textTransform: 'uppercase',
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitleLine: {
    display: 'flex', alignItems: 'center', gap: 8,
    flexWrap: 'wrap',
  },
  rowTitle:    { fontSize: 15, fontWeight: 600, color: '#E6F4EA' },
  rowSub:      { fontSize: 13, color: 'rgba(230,244,234,0.78)', marginTop: 2 },
  rowWhy:      { fontSize: 12, color: 'rgba(230,244,234,0.55)', marginTop: 4,
                  fontStyle: 'italic' },
  priorityChip:{
    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
    background: 'rgba(239,68,68,0.16)', color: '#FCA5A5',
  },
};

function buildStyles(compact) {
  const pad = compact ? 12 : 16;
  return {
    root: {
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: pad, borderRadius: 16,
      background: 'linear-gradient(180deg, #0B1D34 0%, #081423 100%)',
      border: '1px solid rgba(255,255,255,0.06)',
      color: '#E6F4EA',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8,
    },
    title: { margin: 0, fontSize: 18, fontWeight: 700, color: '#E6F4EA' },
    empty: {
      margin: 0, padding: 12, borderRadius: 10,
      background: 'rgba(255,255,255,0.04)',
      border: '1px dashed rgba(255,255,255,0.12)',
      fontSize: 13, color: 'rgba(230,244,234,0.7)',
    },
    bucket: {
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: 12, borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
    },
    tone_action: { background: 'rgba(34,197,94,0.08)',  borderColor: 'rgba(34,197,94,0.22)' },
    tone_plan:   { background: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.18)' },
    tone_future: { background: 'rgba(168,85,247,0.06)', borderColor: 'rgba(168,85,247,0.18)' },
    tone_risk:   { background: 'rgba(239,68,68,0.06)',  borderColor: 'rgba(239,68,68,0.18)' },
    tone_rec:    { background: 'rgba(252,211,77,0.06)', borderColor: 'rgba(252,211,77,0.18)' },
    bucketHeader: {},
    bucketTitle:  { fontSize: 14, fontWeight: 700, color: '#E6F4EA', letterSpacing: 0.3 },
    bucketSub:    { fontSize: 12, color: 'rgba(230,244,234,0.65)', marginTop: 2 },
    list: { listStyle: 'none', margin: 0, padding: 0,
            display: 'flex', flexDirection: 'column', gap: 8 },
    daysPill: {
      padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500,
      background: 'rgba(168,85,247,0.16)', color: '#C4B5FD',
    },
    sevDot: {
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      marginLeft: 'auto',
    },
    assumptions: {
      padding: '4px 12px 8px', fontSize: 12,
      color: 'rgba(230,244,234,0.55)',
    },
    assumptionsLabel: { cursor: 'pointer', fontSize: 12 },
    assumptionList:   { margin: '6px 0 0', paddingLeft: 16 },
    assumptionItem:   { marginBottom: 2 },
  };
}
