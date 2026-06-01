/**
 * SimpleModeHomeSection.jsx — Home top section for Simple Mode (§2).
 *
 * Shows "Today's Action" as ONE primary action + UP TO 2 secondary actions.
 * Reads from the DailyFarmPlanRuntime (already wired) and projects the
 * envelope into SimpleAction shapes. No charts, no analytics, no long
 * weather block — only Action / Why / When / Buttons.
 *
 * Self-contained: dynamic import for the daily plan runtime; wrapped in an
 * error boundary so a render fault never blocks Home.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import SimpleActionCard from './SimpleActionCard.jsx';
import { useNavigate } from 'react-router-dom';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Map a daily-plan task into a SimpleAction shape. Defaults are kept short
// to honor the §9 copy-length rules (≤12 words action, ≤10 words reason).
function _toSimpleAction(task, surface) {
  return _safe(() => {
    if (!task) return null;
    const priority = task.urgency === 'critical' ? 'red'
      : task.urgency === 'recommended' ? 'yellow' : 'green';
    const icon = priority === 'red' ? '⚠️' : priority === 'yellow' ? '🌿' : '🌱';
    const actionDefault = task.title || 'Check on your plants today.';
    const reasonDefault = task.explanation || 'Stay on track with your daily plan.';
    return {
      id: String(task.id || ''),
      surface: surface || 'home',
      icon,
      priority,
      actionKey: task.titleKey || 'simple.action.checkPlants',
      actionDefault,
      reasonKey: '',
      reasonDefault,
      whenKey: 'simple.when.today',
      whenLabel: 'today',
      whenDefault: tSafe('simple.when.today', 'Today'),
      voiceKey: '',
      voiceDefault: `${tSafe('simple.label.doThisNow', 'Do this now')}. ${actionDefault} ${reasonDefault}`,
      buttons: [{ id: 'done', labelKey: 'simple.button.done', labelDefault: 'Done', primary: true }],
      source: task.source || 'daily_plan',
    };
  }, null);
}

function SimpleModeHomeSectionInner() {
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
  const primary = tasks[0] ? _toSimpleAction(tasks[0], 'home') : null;
  const secondaries = tasks.slice(1, 3).map((t) => _toSimpleAction(t, 'home')).filter(Boolean);

  const goScan = () => _safe(() => navigate('/scan'), null);

  return (
    <section style={S.section} data-testid="simple-mode-home-section">
      <p style={S.eyebrow}>{tSafe('simple.home.eyebrow', "Today's Action")}</p>
      {primary ? (
        <SimpleActionCard
          action={primary}
          onDone={() => { /* recorded via SimpleActionCompleted artifact */ }}
          onRemindLater={() => { /* recorded via SimpleReminderRequested artifact */ }}
          onScan={goScan}
          testId="simple-home-primary"
        />
      ) : (
        <SimpleActionCard
          action={{
            id: 'home-empty',
            surface: 'home',
            icon: '🌱',
            priority: 'green',
            actionKey: 'simple.home.empty.action',
            actionDefault: 'Add a plant to start your daily plan.',
            reasonKey: 'simple.home.empty.reason',
            reasonDefault: 'You get a daily action when a plant is added.',
            whenKey: 'simple.when.today',
            whenLabel: 'today',
            whenDefault: tSafe('simple.when.today', 'Today'),
            voiceKey: 'simple.home.empty.voice',
            voiceDefault: 'Add a plant today. Your daily action will start tomorrow.',
            buttons: [{ id: 'done', labelKey: 'simple.button.done', labelDefault: 'Done', primary: true }],
            source: 'daily_plan',
          }}
          onScan={goScan}
          testId="simple-home-empty"
        />
      )}
      {secondaries.length > 0 ? (
        <div style={S.secondaryWrap}>
          <p style={S.secondaryEyebrow}>{tSafe('simple.home.secondaryEyebrow', 'Also today')}</p>
          {secondaries.map((a, i) => (
            <SimpleActionCard
              key={a.id || i}
              action={a}
              onScan={goScan}
              testId={`simple-home-secondary-${i}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

// Error boundary so a render fault never blocks Home.
export default class SimpleModeHomeSection extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — never block Home */ }
  render() {
    if (this.state.failed) return null;
    try { return <SimpleModeHomeSectionInner />; } catch { return null; }
  }
}

const S = {
  section: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 },
  eyebrow: { margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.62)' },
  secondaryWrap: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  secondaryEyebrow: { margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: 'rgba(60,72,55,0.5)' },
};
