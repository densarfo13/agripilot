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
// Weather intelligence — adapts the base task when conditions
// warrant (storm/rain/dry/heat) and produces a "Weather impact"
// line + a smart-button label. Both helpers are pure; null-safe
// when weather is unavailable so the card falls back to the base
// task verbatim (spec §7).
import { useWeather } from '../../context/WeatherContext.jsx';
import { mapWeatherToSpec } from '../../services/weatherService.js';
import {
  adaptTaskForWeather, buildWeatherImpactLine, pickAdaptedCtaLabel,
} from '../../logic/taskEngine.js';
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

  // Centralized weather state (auto-refreshed every 20 min by the
  // WeatherContext provider; see /context/WeatherContext.jsx). Read
  // defensively — the provider exposes `weather` as null until the
  // first fetch completes, and this card renders before that.
  let liveWeather = null;
  try {
    const ctx = useWeather();
    liveWeather = (ctx && ctx.weather) || null;
  } catch { /* outside the provider — no-op fallback */ }
  // Prefer farm-attached weather when present (older surfaces seed
  // it that way), otherwise fall back to the live context value.
  const rawWeather = farm?.weather || liveWeather || null;
  const weatherSpec = mapWeatherToSpec(rawWeather);

  // Production task engine — never returns null, always renderable.
  // Receives the farm + whatever it knows; weather / risks /
  // activity / funding / buyer signals are passed through when the
  // parent has them. Today the parent (MyFarmPage) only has farm
  // data here, so the engine falls through to its crop-stage or
  // default rule based on what's set up.
  const task = useTodayTask({
    farm,
    weather: rawWeather,
    risks: farm?.risks || null,
    activity: farm?.activity || null,
    fundingMatches: farm?.fundingMatches || null,
    buyerSignals: farm?.buyerSignals || null,
  });

  // Layer the weather adaptation on top of the production engine's
  // output. When weatherSpec is null this is a no-op (returns base
  // task), so the card never crashes when the weather service fails
  // (spec §7).
  const adapted = adaptTaskForWeather({
    crop:     farm?.crop || null,
    stage:    farm?.cropStage || farm?.stage || null,
    weather:  weatherSpec,
    baseTask: task,
  });
  const weatherImpactLine = buildWeatherImpactLine(weatherSpec);
  const adaptedCtaLabel   = pickAdaptedCtaLabel(adapted);

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

  // Body line is the adapted task's title — this is either the
  // weather override ("Pause planting", "Delay field work", etc.)
  // OR the base engine title when no rule fires. Detail text uses
  // the adapted action when present, falling back to the base
  // engine instruction.
  const bodyText   = adapted.title || task.title;
  const detailText = adapted.action || task.instruction || '';

  // CTA route comes from the engine's source rule (setup →
  // /edit-farm, harvest → /sell, funding → /opportunities,
  // default → /tasks) so the button leads to the right surface
  // for what the farmer needs next.
  //
  // CTA label: usually "Act now" (the unified primary label)
  // EXCEPT for setup-incomplete state — when the farmer hasn't
  // finished onboarding their farm, "Complete setup" reads as
  // a clearer next step than the generic "Act now". When the
  // adapter flags the task as blocked by weather, the label
  // swaps to "Wait" (storm) or "Check again later" (rain) so
  // the farmer never taps a green CTA into wet field work
  // (spec §5).
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
  if (adaptedCtaLabel) {
    // Weather-blocked override. Keep the route as-is so the farmer
    // can still navigate through and review; only the wording shifts.
    ctaKey      = adaptedCtaLabel === 'Wait'
      ? 'farm.next.cta.wait'
      : 'farm.next.cta.checkLater';
    ctaFallback = adaptedCtaLabel;
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
      {/* Weather impact (Apr 2026 spec): one short line below the
          task that explains why the farmer should/shouldn't act
          today. Hidden when there's nothing weather-driven to say
          so the card stays calm in good conditions (no clutter). */}
      {weatherImpactLine ? (
        <p
          style={{
            ...S.weatherImpact,
            ...(adapted.blocked ? S.weatherImpactBlocked : null),
          }}
          data-testid="next-best-action-weather"
        >
          {tSafe('farm.next.weatherImpact', weatherImpactLine)}
        </p>
      ) : null}

      <button
        type="button"
        style={{
          ...S.cta,
          ...(adapted.blocked ? S.ctaBlocked : null),
        }}
        data-testid="next-best-action-cta"
        data-adapted={adapted.source}
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
  // Weather impact line — small inline note below the detail
  // text. Subtle by default so good-condition farms don't have a
  // loud chip; switches to amber when the adapter flagged the
  // task as blocked.
  weatherImpact: {
    margin: '0 0 12px',
    padding: '6px 10px',
    borderRadius: 8,
    background: 'rgba(56,189,248,0.08)',
    border: '1px solid rgba(56,189,248,0.20)',
    fontSize: '0.8125rem',
    lineHeight: 1.35,
    color: '#7DD3FC',
    fontWeight: 600,
  },
  weatherImpactBlocked: {
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
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
  // Blocked-CTA tone — amber, calmer shadow. Reads as "wait, not
  // proceed" without disabling the button (the farmer can still
  // tap through to /tasks for context).
  ctaBlocked: {
    background: '#F59E0B',
    boxShadow: '0 6px 16px rgba(245,158,11,0.22)',
  },
};
