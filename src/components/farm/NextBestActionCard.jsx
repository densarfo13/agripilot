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
import { tSafe } from '../../i18n/tSafe.js';
import { getFarmStatus } from '../../lib/farm/farmFallbacks.js';
import useTodayTask from '../../hooks/useTodayTask.js';
import { getEffectiveStreak } from '../../lib/loop/dailyLoop.js';
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

  // Streak chip (Apr 2026): subtle motivation read directly from
  // the localStorage-backed dailyLoop store. getEffectiveStreak
  // already returns 0 when the streak has lapsed (>1 day gap), so
  // the hide-on-zero rule is a single comparison below.
  let streakDays = 0;
  try { streakDays = getEffectiveStreak() || 0; } catch { /* ignore */ }

  // Body line is the engine's resolved title (always non-empty per
  // contract). The engine's `instruction` is also available; the
  // card renders it as a secondary line when present.
  const bodyText = task.title;
  const detailText = task.instruction || '';

  // CTA route comes from the engine's source rule (setup →
  // /edit-farm, harvest → /sell, funding → /opportunities,
  // default → /tasks) so the button leads to the right surface
  // for what the farmer needs next.
  //
  // CTA label: usually "Act now" (the unified primary label)
  // EXCEPT for setup-incomplete state — when the farmer hasn't
  // finished onboarding their farm, "Complete setup" reads as
  // a clearer next step than the generic "Act now". Same green
  // primary styling either way; only the wording adapts.
  let ctaRoute;
  let ctaKey;
  let ctaFallback;
  if (task.source === 'setup_incomplete') {
    ctaRoute    = '/edit-farm';
    ctaKey      = 'farm.next.cta.completeSetup';
    ctaFallback = 'Complete setup';
  } else {
    if (task.source === 'harvest_sell') {
      ctaRoute = '/sell';
    } else if (task.source === 'funding_match') {
      ctaRoute = '/opportunities';
    } else {
      ctaRoute = '/tasks';
    }
    ctaKey      = 'farm.next.cta.doThisNow';
    ctaFallback = 'Act now';
  }

  return (
    <section style={S.card} data-testid="next-best-action-card">
      <header style={S.header}>
        <div style={S.headerTopRow}>
          <span style={{ ...S.statusPill, background: tone.background, borderColor: tone.border, color: tone.fg }}>
            <StatusIcon size={14} />
            <span style={{ marginLeft: 6 }}>
              {tStrict(status.key, status.fallback)}
            </span>
          </span>
          {/* Streak chip — small, subtle, top-right. Hidden when
              the farmer has no active streak so a first-day user
              never sees a misleading "0-day" indicator. */}
          {streakDays > 0 && (
            <span style={S.streakChip} data-testid="next-action-streak-chip">
              {tSafe('streak.day', '\uD83D\uDD25 {n}-day streak', { n: streakDays })
                .replace('{n}', String(streakDays))}
            </span>
          )}
        </div>
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
  headerTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Streak chip — small subtle amber pill, no background flash so
  // it sits beside the status pill without competing for attention.
  streakChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#FB923C',
    background: 'rgba(251,146,60,0.10)',
    border: '1px solid rgba(251,146,60,0.30)',
    whiteSpace: 'nowrap',
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
