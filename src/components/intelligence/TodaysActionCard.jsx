/**
 * TodaysActionCard.jsx — single daily action surface per spec.
 *
 * Spec V1: one clear daily action. Avoid complexity.
 *
 *   <TodaysActionCard />            default — fetches /api/daily-action
 *   <TodaysActionCard onStart={fn} onScan={fn} />
 *
 * Renders:
 *   - Priority badge (HIGH / MEDIUM / LOW)
 *   - Action sentence
 *   - Why (single line)
 *   - Time required
 *   - Confidence
 *   - Start button (calls onStart or navigates to /tasks)
 *   - Scan button (navigates to /scan?intent=camera)
 *   - Follow-up date hint
 *
 * Pure render. SSR-safe. Never throws.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import {
  fetchDailyAction, startDailyAction,
  completeDailyAction, recordDailyActionOutcome,
} from '../../runtime/dailyAction/RecommendationEngine';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _priorityLabel(p) {
  if (p === 'high')   return 'HIGH PRIORITY';
  if (p === 'medium') return 'MEDIUM PRIORITY';
  return 'LOW PRIORITY';
}

function _priorityColor(p) {
  if (p === 'high')   return '#a13a3a';
  if (p === 'medium') return '#9a6a00';
  return '#2f7a3a';
}

function TodaysActionCardInner({ onStart, onScan }) {
  const navigate = useNavigate();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  // Funnel state: 'idle' | 'starting' | 'started' | 'completed'
  //               | 'outcome_recorded'
  const [funnelStage, setFunnelStage] = React.useState('idle');
  const [taskId, setTaskId] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const env = await fetchDailyAction();
      if (cancelled) return;
      setData(env); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleStart = React.useCallback(async () => {
    if (typeof onStart === 'function') {
      _safe(() => onStart(data), null);
      return;
    }
    if (!data || !data.action || funnelStage !== 'idle') return;
    setFunnelStage('starting');
    const res = await startDailyAction({
      actionId:         data.actionId,
      action:           data.action,
      category:         data.category,
      priority:         data.priority,
      estimatedMinutes: data.estimatedMinutes,
      followUpDate:     data.followUpDate,
    });
    if (res && res.ok) {
      setTaskId(res.taskId || '');
      setFunnelStage('started');
    } else {
      // Fall back to navigation if the server can't reach us.
      _safe(() => navigate('/tasks'), null);
      setFunnelStage('idle');
    }
  }, [data, funnelStage, onStart, navigate]);

  const handleMarkComplete = React.useCallback(async () => {
    if (!data || funnelStage !== 'started') return;
    const res = await completeDailyAction({
      actionId: data.actionId, taskId,
    });
    if (res && res.ok) setFunnelStage('completed');
  }, [data, funnelStage, taskId]);

  const handleOutcome = React.useCallback(async (outcome) => {
    if (!data || funnelStage !== 'completed') return;
    const res = await recordDailyActionOutcome({
      actionId: data.actionId, taskId,
      outcome,
    });
    if (res && res.ok) setFunnelStage('outcome_recorded');
  }, [data, funnelStage, taskId]);

  const handleScan = React.useCallback(() => {
    if (typeof onScan === 'function') {
      _safe(() => onScan(), null);
      return;
    }
    _safe(() => navigate('/scan?intent=camera'), null);
  }, [onScan, navigate]);

  if (loading && !data) {
    return (
      <section style={S.wrap} data-testid="todays-action-loading"
        data-consumes="dailyAction">
        <p style={S.eyebrow}>{tSafe('todaysAction.eyebrow', "Today's Action")}</p>
        <p style={S.loading}>{tSafe('todaysAction.loading', 'Computing…')}</p>
      </section>
    );
  }

  // Engine contract guarantees `action` is always present — but we
  // still render a tolerant fallback so a network blip doesn't blank
  // the card.
  const action = (data && data.action)
    || 'Walk the field for 5 minutes and note anything unusual.';
  const priority = (data && data.priority) || 'low';
  const reason = (data && data.reason) || '';
  const estimatedTime = (data && data.estimatedTime) || '5 minutes';
  const confidence = (data && data.confidence != null) ? data.confidence : 30;
  const followUpDate = data && data.followUpDate;

  return (
    <section
      style={S.wrap}
      data-testid="todays-action-card"
      data-consumes="dailyAction"
      data-surface="todays-action"
      data-priority={priority}>
      <header style={S.head}>
        <span
          style={{ ...S.priorityBadge, color: _priorityColor(priority) }}
          data-testid="todays-action-priority">
          {_priorityLabel(priority)}
        </span>
        <span style={S.time} data-testid="todays-action-time">
          {tSafe('todaysAction.time', 'Time')}: {estimatedTime}
        </span>
      </header>

      <h2 style={S.action} data-testid="todays-action-text">{action}</h2>

      {reason ? (
        <p style={S.reason} data-testid="todays-action-reason">
          <span style={S.reasonLabel}>
            {tSafe('todaysAction.why', 'Why')}:
          </span>{' '}
          {reason}
        </p>
      ) : null}

      <div style={S.metaRow}>
        <span style={S.confidence} data-testid="todays-action-confidence">
          {tSafe('todaysAction.confidence', 'Confidence')}: {confidence}%
        </span>
        {followUpDate ? (
          <span style={S.followUp} data-testid="todays-action-followup">
            {tSafe('todaysAction.followUp', 'Follow-up')}: {followUpDate}
          </span>
        ) : null}
      </div>

      {/* Funnel-aware action row.
          idle           → Start + Scan buttons (spec)
          starting       → spinner / disabled state
          started        → "Mark complete" button
          completed      → Better / Same / Worse outcome prompt
          outcome_recorded → green confirmation row */}
      {funnelStage === 'idle' || funnelStage === 'starting' ? (
        <div style={S.btnRow}>
          <button type="button" style={S.btnStart}
            onClick={handleStart}
            disabled={funnelStage === 'starting'}
            data-testid="todays-action-start">
            {funnelStage === 'starting'
              ? tSafe('todaysAction.starting', 'Starting…')
              : tSafe('todaysAction.start', 'Start')}
          </button>
          <button type="button" style={S.btnScan}
            onClick={handleScan}
            data-testid="todays-action-scan">
            {tSafe('todaysAction.scan', 'Scan')}
          </button>
        </div>
      ) : null}

      {funnelStage === 'started' ? (
        <div style={S.btnRow} data-testid="todays-action-started-row">
          <button type="button" style={S.btnStart}
            onClick={handleMarkComplete}
            data-testid="todays-action-complete">
            {tSafe('todaysAction.markComplete', 'Mark complete')}
          </button>
          <span style={S.startedHint}>
            {tSafe('todaysAction.taskCreated',
              'Task + follow-up + outcome path created.')}
          </span>
        </div>
      ) : null}

      {funnelStage === 'completed' ? (
        <div style={S.outcomeWrap} data-testid="todays-action-outcome-prompt">
          <p style={S.outcomeQ}>
            {tSafe('todaysAction.outcomeQ', 'Did conditions improve?')}
          </p>
          <div style={S.btnRow}>
            <button type="button" style={S.btnBetter}
              onClick={() => handleOutcome('better')}
              data-testid="todays-action-outcome-better">
              {tSafe('todaysAction.better', 'Better')}
            </button>
            <button type="button" style={S.btnSame}
              onClick={() => handleOutcome('same')}
              data-testid="todays-action-outcome-same">
              {tSafe('todaysAction.same', 'Same')}
            </button>
            <button type="button" style={S.btnWorse}
              onClick={() => handleOutcome('worse')}
              data-testid="todays-action-outcome-worse">
              {tSafe('todaysAction.worse', 'Worse')}
            </button>
          </div>
        </div>
      ) : null}

      {funnelStage === 'outcome_recorded' ? (
        <p style={S.done} data-testid="todays-action-done">
          ✓ {tSafe('todaysAction.done',
            'Outcome recorded. See you tomorrow.')}
        </p>
      ) : null}

      <p style={S.footnote}>
        {tSafe('todaysAction.footnote', 'Decision support, not a guarantee.')}
      </p>
    </section>
  );
}

export default class TodaysActionCard extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return null;
    try { return <TodaysActionCardInner {...this.props} />; }
    catch { return null; }
  }
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.95)',
    border: '1px solid rgba(60,72,55,0.12)',
    borderRadius: 14, padding: '16px 18px',
    display: 'flex', flexDirection: 'column', gap: 10,
    fontFamily: 'system-ui',
    margin: '12px 0',
  },
  eyebrow: { margin: 0, fontSize: 10, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'rgba(60,72,55,0.55)' },
  head: { display: 'flex', flexDirection: 'row', gap: 12,
    alignItems: 'baseline', flexWrap: 'wrap',
    justifyContent: 'space-between' },
  priorityBadge: { fontSize: 11, fontWeight: 800,
    letterSpacing: '0.08em', textTransform: 'uppercase' },
  time: { fontSize: 12, color: 'rgba(60,72,55,0.7)', fontWeight: 600 },
  action: { margin: 0, fontSize: 18, fontWeight: 800,
    color: '#1F2933', lineHeight: 1.3 },
  reason: { margin: 0, fontSize: 13, color: '#1F2933', lineHeight: 1.4 },
  reasonLabel: { fontWeight: 700, color: 'rgba(60,72,55,0.7)' },
  metaRow: { display: 'flex', flexDirection: 'row', gap: 12,
    flexWrap: 'wrap', fontSize: 12 },
  confidence: { color: 'rgba(60,72,55,0.8)', fontWeight: 600 },
  followUp: { color: 'rgba(60,72,55,0.7)' },
  btnRow: { display: 'flex', flexDirection: 'row', gap: 8,
    flexWrap: 'wrap' },
  btnStart: { minHeight: 40, padding: '0 18px', borderRadius: 10,
    border: 'none', background: '#2f7a3a', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer', flex: 1,
    minWidth: 120 },
  btnScan: { minHeight: 40, padding: '0 18px', borderRadius: 10,
    border: '1px solid rgba(60,72,55,0.20)', background: '#fff',
    color: '#1F2933', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', flex: 1, minWidth: 120 },
  loading: { margin: 0, fontSize: 12, color: 'rgba(60,72,55,0.6)' },
  footnote: { margin: 0, fontSize: 10,
    color: 'rgba(60,72,55,0.5)', textAlign: 'right' },
  startedHint: { fontSize: 11, color: 'rgba(60,72,55,0.65)',
    alignSelf: 'center' },
  outcomeWrap: {
    display: 'flex', flexDirection: 'column', gap: 8,
    borderTop: '1px solid rgba(60,72,55,0.08)', paddingTop: 10,
  },
  outcomeQ: { margin: 0, fontSize: 13, fontWeight: 700,
    color: '#1F2933' },
  btnBetter: { minHeight: 36, padding: '0 14px', borderRadius: 8,
    border: 'none', background: '#2f7a3a', color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    flex: 1, minWidth: 80 },
  btnSame: { minHeight: 36, padding: '0 14px', borderRadius: 8,
    border: 'none', background: '#9a6a00', color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    flex: 1, minWidth: 80 },
  btnWorse: { minHeight: 36, padding: '0 14px', borderRadius: 8,
    border: 'none', background: '#a13a3a', color: '#fff',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    flex: 1, minWidth: 80 },
  done: { margin: 0, fontSize: 13, fontWeight: 700, color: '#2f7a3a' },
};
