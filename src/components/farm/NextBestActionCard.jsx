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
import {
  mapWeatherToSpec, extractForecastDays,
} from '../../services/weatherService.js';
import {
  adaptTaskForWeather,
} from '../../logic/taskEngine.js';
// 3-day predictive action window. Reads the forecast and the base
// task; returns a "what to do, when, and why" summary the Home
// card renders. Never throws; safely degrades to "Check your farm
// today" when the forecast is missing (spec §6).
import {
  getBestActionWindow, formatActionWindowLine,
} from '../../intelligence/actionWindow.js';
import { CheckCircle, AlertTriangle, Sprout, ArrowRight } from '../icons/lucide.jsx';

// Slugify the action-window's CTA wording into a stable i18n key
// suffix so callers don't have to maintain a rule-→-key map.
//   "Act now"            → "actNow"
//   "Plan task"          → "planTask"
//   "Check again later"  → "checkAgainLater"
function _slugCta(text) {
  if (!text) return 'actNow';
  const parts = String(text).trim().split(/\s+/);
  return parts.map((p, i) => {
    const w = p.toLowerCase();
    return i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1);
  }).join('');
}

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

  // 3-day predictive timing (Apr 2026 spec). Builds a forecast
  // array from whatever the weather context exposes; the action
  // window helper handles a missing/empty forecast by returning
  // a safe "Check your farm today" fallback.
  const forecastDays = extractForecastDays(rawWeather, 3);
  const window = getBestActionWindow({
    farm,
    forecast: forecastDays,
    task:     adapted,
  });
  const intelligenceLine = formatActionWindowLine(window);

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
  // default → /tasks). The CTA wording, however, is owned by
  // the action-window helper for non-setup tasks: it picks
  // between Act now / Wait / Check again later / Plan task /
  // View safe task / Start early based on a 3-day read.
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
    // Window button text always wins for action tasks. The
    // fallback "Act now" matches the prior default when the
    // window degrades to its safe fallback (spec §6).
    ctaFallback = window.buttonText || 'Act now';
    // i18n key derived from the wording so translators don't
    // have to know about the rule chain.
    ctaKey = 'farm.next.cta.' + _slugCta(ctaFallback);
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
      {/* Weather intelligence (Apr 2026 spec §4): two short
          lines — what's happening today + when to act. Pulled
          from the action-window helper so the card never shows
          raw forecast tables (spec §5). Hidden when the window
          has nothing actionable to add (good-conditions farms
          stay uncluttered). */}
      {intelligenceLine ? (
        <div
          style={{
            ...S.weatherImpact,
            ...(window.blockedToday ? S.weatherImpactBlocked : null),
          }}
          data-testid="next-best-action-weather"
        >
          <div style={S.weatherImpactLabel}>
            {tSafe('farm.next.weatherIntel', 'Weather intelligence')}
          </div>
          <div style={S.weatherImpactBody}>
            {tSafe('farm.next.weatherIntelLine', intelligenceLine)}
          </div>
          {window.riskIfDelayed ? (
            <div style={S.weatherImpactRisk}>
              {tSafe('farm.next.weatherIntelRisk', window.riskIfDelayed)}
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        style={{
          ...S.cta,
          ...(window.blockedToday ? S.ctaBlocked : null),
        }}
        data-testid="next-best-action-cta"
        data-adapted={adapted.source}
        data-window={window.buttonText}
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
  // Weather intelligence panel — small two-line block below the
  // detail text. "Weather intelligence" eyebrow + a one-sentence
  // recommendation. Subtle by default; switches to amber when the
  // action window flags today as blocked. Spec §5 keeps it lean
  // — no graphs, no tables, no hourly numbers.
  weatherImpact: {
    margin: '0 0 12px',
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(56,189,248,0.08)',
    border: '1px solid rgba(56,189,248,0.20)',
    fontSize: '0.8125rem',
    lineHeight: 1.35,
    color: '#7DD3FC',
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  weatherImpactBlocked: {
    background: 'rgba(245,158,11,0.10)',
    border: '1px solid rgba(245,158,11,0.32)',
    color: '#FDE68A',
  },
  weatherImpactLabel: {
    fontSize: '0.625rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    opacity: 0.7,
  },
  weatherImpactBody: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  weatherImpactRisk: {
    fontSize: '0.75rem',
    fontWeight: 500,
    opacity: 0.85,
    fontStyle: 'italic',
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
