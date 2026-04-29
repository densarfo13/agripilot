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

import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getFarmStatus } from '../../lib/farm/farmFallbacks.js';
import useTodayTask from '../../hooks/useTodayTask.js';
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

  // Production task engine — never returns null, always renderable.
  // Receives the farm + whatever it knows; weather / risks /
  // activity / funding / buyer signals are passed through when the
  // parent has them. Today the parent (MyFarmPage) only has farm
  // data here, so the engine falls through to its crop-stage or
  // default rule based on what's set up.
  const task = useTodayTask({
    farm,
    weather: farm?.weather || null,
    risks: farm?.risks || null,
    activity: farm?.activity || null,
    fundingMatches: farm?.fundingMatches || null,
    buyerSignals: farm?.buyerSignals || null,
  });

  // Status pill — derived independently of the engine so the chip
  // tone reflects setup-completeness directly.
  const status = getFarmStatus(farm, [], /* risks */ []);
  const tone = TONE_STYLES[status.tone] || TONE_STYLES.info;
  const StatusIcon = tone.icon;

  // Body line is the engine's resolved title (always non-empty per
  // contract). The engine's `instruction` is also available; the
  // card renders it as a secondary line when present.
  const bodyText = task.title;
  const detailText = task.instruction || '';

  // CTA route + label come from the engine's source rule. Setup →
  // /edit-farm to fix the gap; everything else routes to /tasks
  // which already has the rich task UI.
  let ctaKey, ctaFallback, ctaRoute;
  if (task.source === 'setup_incomplete') {
    ctaKey      = 'farm.next.cta.updateFarm';
    ctaFallback = 'Update farm';
    ctaRoute    = '/edit-farm';
  } else if (task.source === 'harvest_sell') {
    ctaKey      = 'farm.next.cta.markReady';
    ctaFallback = 'Mark ready to sell';
    ctaRoute    = '/sell';
  } else if (task.source === 'funding_match') {
    ctaKey      = 'farm.next.cta.viewFunding';
    ctaFallback = 'View funding';
    ctaRoute    = '/opportunities';
  } else {
    ctaKey      = 'farm.next.cta.startTask';
    ctaFallback = 'Start task';
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
      {/* Secondary instruction line — renders when the engine
          produced an explainer. Spec §10 (explainability). */}
      {detailText && detailText !== bodyText ? (
        <p style={S.detail}>{detailText}</p>
      ) : null}

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
    margin: '0 0 6px',
    fontSize: '0.95rem',
    fontWeight: 600,
    lineHeight: 1.45,
    color: '#fff',
  },
  detail: {
    margin: '0 0 12px',
    fontSize: '0.85rem',
    lineHeight: 1.4,
    color: 'rgba(255,255,255,0.65)',
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
