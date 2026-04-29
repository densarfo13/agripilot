/**
 * NextBestActionCard — top card on My Farm. Answers the farmer's
 * first three questions in a single panel:
 *
 *   "What is my farm status?"      → status pill (On track / Needs
 *                                      attention / Setup incomplete)
 *   "What should I do next?"       → today's primary task title, or
 *                                      a contextual fallback
 *   "What can I do from here?"     → a single green CTA that routes
 *                                      to the most useful place
 *
 * Data sources (all already on the page or in stores)
 * ───────────────────────────────────────────────────
 *   • `getTodayTasks(...)` — same call MyFarmPage already makes for
 *     the notification scheduler. Returns { tasks: [...] }.
 *   • `getFarmStatus(farm, tasks, risks)` — fallback helper.
 *
 * Renders nothing during initial profile load (handled by the
 * parent's skeleton). Defensive on every input; never crashes.
 *
 * Visible text via tStrict. Lucide-style icons only.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getTodayTasks } from '../../lib/dailyTasks/taskScheduler.js';
import { getFarmStatus } from '../../lib/farm/farmFallbacks.js';
import { CheckCircle, AlertTriangle, Sprout, ArrowRight } from '../icons/lucide.jsx';

const TONE_STYLES = Object.freeze({
  ok:   { background: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.45)',  fg: '#86EFAC', icon: CheckCircle },
  warn: { background: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.45)', fg: '#FDE68A', icon: AlertTriangle },
  info: { background: 'rgba(255,255,255,0.04)',border: '#1F3B5C',                fg: 'rgba(255,255,255,0.85)', icon: Sprout },
});

export default function NextBestActionCard({ farm }) {
  // Subscribe to language change.
  useTranslation();
  const navigate = useNavigate();
  const [todayPlan, setTodayPlan] = useState(null);

  // Run the same getTodayTasks call MyFarmPage uses for its
  // notification scheduler — but here we keep the result in state
  // so the card can render the first task title. The call is
  // synchronous + offline-safe; the existing scheduler would have
  // failed silently if the call threw.
  useEffect(() => {
    if (!farm || !farm.id) { setTodayPlan(null); return; }
    try {
      const plan = getTodayTasks({
        farm: {
          id:          farm.id,
          crop:        farm.crop,
          farmType:    farm.farmType,
          cropStage:   farm.cropStage,
          countryCode: farm.countryCode || farm.country,
        },
        weather: farm.weather || null,
      });
      setTodayPlan(plan && Array.isArray(plan.tasks) ? plan : { tasks: [] });
    } catch {
      setTodayPlan({ tasks: [] });
    }
    // re-run when the farm id changes; intentional narrow dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm && farm.id]);

  const tasks = todayPlan?.tasks || [];
  const status = getFarmStatus(farm, tasks, /* risks */ []);
  const tone = TONE_STYLES[status.tone] || TONE_STYLES.info;
  const StatusIcon = tone.icon;

  // Pick the first non-completed task as the "next best action".
  // Fall back to a localised stub when nothing is available.
  const firstPending = tasks.find(t =>
    t && !(t.completed || t.completedAt || t.done),
  ) || null;

  const taskTitleKey = firstPending?.titleKey || null;
  const taskTitle = firstPending?.title
    || (taskTitleKey ? tStrict(taskTitleKey, '') : '');

  // Body line:
  //   • If there's a pending task → its title (or i18n key).
  //   • If there's no farm setup → setup-prompt fallback.
  //   • Otherwise → "Your farm is being prepared" stub.
  const bodyText = taskTitle
    || (status.code === 'setup_incomplete'
        ? tStrict('farm.next.setupBody',
            'Add your crop and location to get daily guidance.')
        : tStrict('farm.next.preparingBody',
            'Your farm is being prepared. Check back soon or update your farm.'));

  // CTA route + label depend on what we found.
  let ctaKey, ctaFallback, ctaRoute;
  if (taskTitle) {
    ctaKey      = 'farm.next.cta.goToTask';
    ctaFallback = 'Go to Today\u2019s Task';
    ctaRoute    = '/tasks';
  } else if (status.code === 'setup_incomplete') {
    ctaKey      = 'farm.next.cta.updateFarm';
    ctaFallback = 'Update farm';
    ctaRoute    = '/edit-farm';
  } else {
    ctaKey      = 'farm.next.cta.viewTasks';
    ctaFallback = 'View tasks';
    ctaRoute    = '/tasks';
  }

  return (
    <section style={S.card} data-testid="next-best-action-card">
      <header style={S.header}>
        <span style={{ ...S.statusPill, background: tone.background, borderColor: tone.border, color: tone.fg }}>
          <StatusIcon size={14} />
          <span style={{ marginLeft: 6 }}>
            {tStrict(status.key, status.fallback)}
          </span>
        </span>
        <h2 style={S.title}>
          {tStrict('farm.next.title', 'Next best action')}
        </h2>
      </header>

      <p style={S.body}>{bodyText}</p>

      <button
        type="button"
        style={S.cta}
        data-testid="next-best-action-cta"
        onClick={() => { try { navigate(ctaRoute); } catch { /* ignore */ } }}
      >
        <span>{tStrict(ctaKey, ctaFallback)}</span>
        <span aria-hidden="true" style={{ display: 'inline-flex', marginLeft: 6 }}>
          <ArrowRight size={16} />
        </span>
      </button>
    </section>
  );
}

const S = {
  card: {
    background: '#102C47',
    border: '1px solid #1F3B5C',
    borderRadius: 14,
    padding: '16px 18px',
    margin: '0 0 12px 0',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 8,
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    alignSelf: 'flex-start',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    border: '1px solid',
  },
  title: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#fff',
  },
  body: {
    margin: '0 0 12px',
    fontSize: '0.95rem',
    lineHeight: 1.45,
    color: 'rgba(255,255,255,0.85)',
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: 10,
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: 48,
    boxShadow: '0 6px 16px rgba(34,197,94,0.22)',
  },
};
