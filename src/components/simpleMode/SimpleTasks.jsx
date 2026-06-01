/**
 * SimpleTasks.jsx — full-screen Simple Mode Tasks renderer.
 *
 * Hard-split partner of StandardTasks. Renders only large action cards:
 * up to 3 visible tasks (Today / Overdue / Next) — no filters, no
 * table, no analytics. Each row is a <SimpleActionCard> with Done +
 * Skip + Remind me + voice. Hard-cap at 3 actions per §4 of the
 * Simple Mode spec.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import SimpleActionCard from './SimpleActionCard.jsx';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Map a daily-plan task into a SimpleAction. Mirrors the projection used
// by SimpleModeHomeSection so the two surfaces stay consistent.
function _toAction(task, surface) {
  return _safe(() => {
    if (!task) return null;
    const priority = task.urgency === 'critical' ? 'red'
      : task.urgency === 'recommended' ? 'yellow' : 'green';
    const icon = priority === 'red' ? '⚠️' : priority === 'yellow' ? '🌿' : '🌱';
    const actionDefault = task.title || tSafe('simple.tasks.fallback.action', 'Care for your plants.');
    const reasonDefault = task.explanation || tSafe('simple.tasks.fallback.reason', 'Daily care helps.');
    return {
      id: String(task.id || ''),
      surface: surface || 'tasks',
      icon, priority,
      actionKey: task.titleKey || 'simple.tasks.fallback.actionKey',
      actionDefault,
      reasonKey: '', reasonDefault,
      whenKey: 'simple.when.today', whenLabel: 'today',
      whenDefault: tSafe('simple.when.today', 'Today'),
      voiceKey: '',
      voiceDefault: `${tSafe('simple.label.doThisNow', 'Do this now')}. ${actionDefault}`,
      buttons: [{ id: 'done', labelKey: 'simple.button.done', labelDefault: 'Done', primary: true }],
      source: task.source || 'daily_plan',
    };
  }, null);
}

function SimpleTasksInner() {
  const navigate = useNavigate();
  const [plan, setPlan] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    import('../../runtime/dailyPlan/DailyFarmPlanRuntime')
      .then((m) => {
        const built = _safe(() => m.buildDailyPlan({}), null);
        if (alive && built) setPlan(built);
      })
      .catch(() => { /* swallow */ });
    return () => { alive = false; };
  }, []);

  const tasks = _safe(() => Array.isArray(plan && plan.tasks) ? plan.tasks.slice(0, 3) : [], []);
  const actions = tasks.map((t) => _toAction(t, 'tasks')).filter(Boolean);
  const goScan = () => _safe(() => navigate('/scan'), null);

  return (
    <div style={S.page} data-testid="simple-tasks" data-renderer="simple">
      <div style={S.shell}>
        <header style={S.head}>
          <h1 style={S.title}>{tSafe('simple.tasks.title', 'Your Tasks')}</h1>
          <p style={S.sub}>{tSafe('simple.tasks.sub', 'Tap Done after each task.')}</p>
        </header>

        {actions.length === 0 ? (
          <SimpleActionCard
            action={{
              id: 'tasks-empty',
              surface: 'tasks',
              icon: '🌱',
              priority: 'green',
              actionKey: 'simple.tasks.empty.action',
              actionDefault: 'Add a plant to start your tasks.',
              reasonKey: 'simple.tasks.empty.reason',
              reasonDefault: 'You get daily tasks when a plant is added.',
              whenKey: 'simple.when.today', whenLabel: 'today',
              whenDefault: tSafe('simple.when.today', 'Today'),
              voiceKey: 'simple.tasks.empty.voice',
              voiceDefault: 'Add a plant today. Your daily tasks will start tomorrow.',
              buttons: [{ id: 'done', labelKey: 'simple.button.done', labelDefault: 'Done', primary: true }],
              source: 'daily_plan',
            }}
            onScan={goScan}
            testId="simple-tasks-empty"
          />
        ) : (
          actions.map((a, i) => (
            <SimpleActionCard
              key={a.id || i}
              action={a}
              onDone={() => { /* SimpleActionCompleted artifact written inside card */ }}
              onRemindLater={() => { /* SimpleReminderRequested artifact */ }}
              onScan={goScan}
              testId={`simple-tasks-row-${i}`}
            />
          ))
        )}

        <p style={S.footnote}>{tSafe('simple.tasks.footnote', 'Three at a time. No rush.')}</p>
      </div>
    </div>
  );
}

export default class SimpleTasks extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow */ }
  render() {
    if (this.state.failed) return <div data-testid="simple-tasks-fallback" />;
    try { return <SimpleTasksInner />; } catch { return null; }
  }
}

const S = {
  page: { minHeight: '100vh', background: '#FAF7F0', color: '#2C3A26',
    fontFamily: 'system-ui', padding: '20px 16px 96px' },
  shell: { maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' },
  head: { marginBottom: 6 },
  title: { margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.01em' },
  sub: { margin: '0.4rem 0 0', fontSize: '0.95rem', color: 'rgba(60,72,55,0.72)' },
  footnote: { margin: '1.2rem 0 0', fontSize: '0.84rem', color: 'rgba(60,72,55,0.62)',
    textAlign: 'center', fontStyle: 'italic' },
};
