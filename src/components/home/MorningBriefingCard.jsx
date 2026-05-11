/**
 * MorningBriefingCard — calm, high-value daily summary.
 *
 * Sits at the very top of Home. Composed entirely from existing
 * Context Intelligence Engine outputs + live weather; this
 * component does no rules logic of its own beyond presentation.
 *
 * Inputs (props)
 *   userTypeLabel  — 'Farmer' | 'Gardener' | …  (display only)
 *   weather        — useLiveWeather() result    (weatherType, temp, …)
 *   ctxIntel       — useContextIntelligence()   (todayTask, alert, recommendation)
 *   taskDone       — boolean — completed-today flag from useDailyHabit
 *   now            — Date — used for time-of-day greeting
 *
 * Outputs (always rendered, in this visual order)
 *   1. greeting          — "Good morning, Farmer"
 *   2. estimated-time    — "⏱ 5 mins" pill (top-right)
 *   3. weather summary   — one short line with weather emoji
 *   4. top task          — title + reason (1-2 lines each)
 *   5. recommendation    — calm green line, only when type ≠ 'general'
 *   6. warning chip      — only when alert priority is warning/critical
 *
 * Strict-rule audit (spec)
 *   • No setup prompts — purely care/market actions via ctxIntel.
 *   • No giant warning boxes — warning is a chip, never a banner.
 *   • No blank state — every code path resolves to FALLBACK_BRIEFING.
 *   • No dashboard overload — single card, no nested grids.
 *   • No AI / ML — uses deterministic outputs from contextEngine.
 *
 * Design audit
 *   • Premium card — soft border, subtle shadow, 18px radius.
 *   • Animated weather accent — 4px gradient bar, gentle pulse.
 *   • Mobile-first inline styles, no media queries needed.
 *   • Calm hierarchy: greeting > weather > task > nudge > warning.
 */

import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useStrictTranslation } from '../../i18n/useStrictTranslation.js';
import usePlantIdentity from '../../hooks/usePlantIdentity.js';
import usePlantTimeline from '../../hooks/usePlantTimeline.js';
import { pickMessage } from '../../lib/plant/reassuranceEngine.js';

// Alive-UI pass §1 — inline warning glyph instead of ⚠ emoji.
function _WarnGlyph({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4l9 16H3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M12 11v4M12 17.5v.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Constants ─────────────────────────────────────────────────

// English fallbacks live here. tSafe(key, fallback) returns the
// translation when the active locale has one; otherwise the
// English fallback below renders.
const FALLBACK_BRIEFING = Object.freeze({
  weatherSummary: 'Steady weather today',
  taskTitle:      'Check your crops today and monitor soil moisture.',
  taskReason:     'A short walk-around helps you spot problems early.',
  estimatedTime:  '5 mins',
});

// Weather line definitions — keys + icons + accent class. Each
// `label` is a translation key consumed via tSafe so the headline
// localizes with the active language.
const WEATHER_LINES = Object.freeze({
  rain:    { key: 'briefing.weather.rain',    fallback: 'Rain expected today',         icon: '🌧',  accent: 'cool'    },
  heat:    { key: 'briefing.weather.heat',    fallback: 'Hot weather expected today',  icon: '🔥',  accent: 'hot'     },
  dry:     { key: 'briefing.weather.dry',     fallback: 'Dry conditions today',        icon: '🌵',  accent: 'warm'    },
  sunny:   { key: 'briefing.weather.sunny',   fallback: 'Sunny and clear today',       icon: '☀',   accent: 'warm'    },
  cloudy:  { key: 'briefing.weather.cloudy',  fallback: 'Cloudy and mild today',       icon: '☁',   accent: 'cool'    },
  wind:    { key: 'briefing.weather.wind',    fallback: 'Strong wind today',           icon: '💨',  accent: 'slate'   },
  unknown: { key: 'briefing.weather.unknown', fallback: 'Steady weather today',        icon: '🌤',  accent: 'neutral' },
});

const ACCENT_GRADIENTS = Object.freeze({
  hot:     'linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)',
  warm:    'linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)',
  cool:    'linear-gradient(90deg, #38BDF8 0%, #6366F1 100%)',
  slate:   'linear-gradient(90deg, #64748B 0%, #475569 100%)',
  neutral: 'linear-gradient(90deg, #C8944D 0%, #B9853F 100%)',
});

// ─── Helpers ───────────────────────────────────────────────────

/** Time-of-day greeting. Never throws. Localized via tSafe. */
function _greeting(now, label) {
  let h = 12;
  try {
    const d = (now instanceof Date) ? now : new Date();
    h = d.getHours();
  } catch { /* swallow */ }
  const partKey = h < 12 ? 'briefing.greeting.morning'
                : h < 18 ? 'briefing.greeting.afternoon'
                :          'briefing.greeting.evening';
  const partFallback = h < 12 ? 'Good morning'
                     : h < 18 ? 'Good afternoon'
                     :          'Good evening';
  const part = tSafe(partKey, partFallback);
  const who  = (typeof label === 'string' && label.trim()) ? label.trim() : 'Farmer';
  return `${part}, ${who}`;
}

/** Resolve the weather line + icon + accent for the supplied weather. */
function _weatherLine(weather) {
  const wt = (weather && typeof weather === 'object'
              && typeof weather.weatherType === 'string')
    ? weather.weatherType
    : 'unknown';
  return WEATHER_LINES[wt] || WEATHER_LINES.unknown;
}

/**
 * Map a task → estimated time band, localized.
 * Spec: 2 mins | 5 mins | 10 mins.
 *   • light / low-urgency  → 2 mins
 *   • harvest / weeding    → 10 mins
 *   • everything else      → 5 mins
 */
function _estimateTime(task) {
  if (!task || typeof task !== 'object') return tSafe('briefing.time.5', '5 mins');
  const cat = String(task.category || '').toLowerCase();
  const urg = String(task.urgency  || 'medium').toLowerCase();
  if (cat === 'harvest' || cat === 'weeding') return tSafe('briefing.time.10', '10 mins');
  if (cat === 'light'   || urg === 'low')     return tSafe('briefing.time.2',  '2 mins');
  return tSafe('briefing.time.5', '5 mins');
}

// ─── Component ─────────────────────────────────────────────────

export default function MorningBriefingCard({
  userTypeLabel = 'Farmer',
  weather       = null,
  ctxIntel      = null,
  taskDone      = false,
  now           = null,
}) {
  // Subscribe to language change so the card re-renders when the
  // user picks a different locale — the tSafe lookups below will
  // pick up the new strings on this render.
  useStrictTranslation();

  // Plant companion state — only used in garden mode. Hooks ALWAYS
  // called (rules-of-hooks) but downstream values are gated on
  // ctxIntel.mode === 'garden' so the farm-mode card doesn't pick
  // up garden plant memory. Both stores are localStorage-backed
  // and never throw.
  const { plant } = usePlantIdentity();
  const { count: timelineCount, hasFirstScan, hasFirstFlower, hasFirstFruit } = usePlantTimeline(0);
  const isGarden = !!(ctxIntel && ctxIntel.mode === 'garden');

  // Build the briefing in a single try/catch so a malformed input
  // can never blank Home — every render path resolves to text.
  let greeting, wxLine, wxIcon, accent, taskTitle, taskReason,
      recommendation, warning, estimatedTime;
  try {
    greeting = _greeting(now, userTypeLabel);

    const wx = _weatherLine(weather);
    wxLine   = tSafe(wx.key, wx.fallback);
    wxIcon   = wx.icon;
    accent   = ACCENT_GRADIENTS[wx.accent] || ACCENT_GRADIENTS.neutral;

    const task = ctxIntel && ctxIntel.todayTask;
    taskTitle  = (task && task.title)
      || tSafe('briefing.fallback.task',  FALLBACK_BRIEFING.taskTitle);
    taskReason = (task && task.reason)
      || tSafe('briefing.fallback.reason', FALLBACK_BRIEFING.taskReason);

    const rec = ctxIntel && ctxIntel.recommendation;
    recommendation = (rec && rec.type !== 'general' && rec.text)
      ? rec.text : null;

    const al = ctxIntel && ctxIntel.alert;
    warning = (al
      && (al.priority === 'warning' || al.priority === 'critical')
      && al.title)
      ? al.title : null;

    estimatedTime = _estimateTime(task);

    // Garden Mode polish: prefix the task title with the plant
    // nickname when one has been set, so "Check soil moisture
    // around your tomato" reads "Check soil moisture around
    // Balcony Tomato". Strict opt-in — only when:
    //   • mode is garden (farm mode wording stays operational)
    //   • the user has stamped a custom nickname (not the
    //     'My Plant' fallback)
    //   • the task title contains the bare crop name we can
    //     swap. We don't try to rewrite arbitrary task titles.
    if (isGarden
        && plant && plant.nickname
        && plant.nickname !== 'My Plant'
        && plant.plantType
        && task && typeof task.title === 'string'
        && task.title.toLowerCase().includes(String(plant.plantType).toLowerCase())) {
      // Replace ONE occurrence of the plant type with the nickname,
      // case-preserving via a manual swap.
      const re = new RegExp('\\b' + plant.plantType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      taskTitle = task.title.replace(re, plant.nickname);
    }
  } catch {
    greeting       = `${tSafe('briefing.greeting.morning', 'Good morning')}, ${userTypeLabel || 'Farmer'}`;
    wxLine         = tSafe('briefing.weather.unknown', FALLBACK_BRIEFING.weatherSummary);
    wxIcon         = WEATHER_LINES.unknown.icon;
    accent         = ACCENT_GRADIENTS.neutral;
    taskTitle      = tSafe('briefing.fallback.task',   FALLBACK_BRIEFING.taskTitle);
    taskReason     = tSafe('briefing.fallback.reason', FALLBACK_BRIEFING.taskReason);
    recommendation = null;
    warning        = null;
    estimatedTime  = tSafe('briefing.time.5', FALLBACK_BRIEFING.estimatedTime);
  }

  // Garden Mode emotional layer: derive a single reassurance/recovery/
  // delight message based on plant memory. Returns null in farm mode
  // (the card renders without the new chip). Pure pickMessage call —
  // safe to inline; never throws.
  let reassurance = null;
  if (isGarden) {
    try {
      const ctx = ctxIntel || {};
      reassurance = pickMessage({
        recentScanCategory: ctx.mode === 'garden' && ctx.alert ? null : null, // engine reads from intel internally
        // We feed the same scan category the context engine read so
        // the reassurance line and the task line agree about what
        // the user just observed.
        ...(ctx && ctx.scanInsightCategory
            ? { recentScanCategory: ctx.scanInsightCategory }
            : {}),
        // Surface plant memory derived from the timeline + scan
        // history hooks above.
        firstScanLogged:    hasFirstScan,
        firstFlowerLogged:  hasFirstFlower,
        firstFruitLogged:   hasFirstFruit,
        timelineCount,
        isFirstSession:    !plant || !plant.plantType,
      });
    } catch { reassurance = null; }
  }

  return (
    <section
      style={S.card}
      data-testid="morning-briefing-card"
      aria-label="Morning briefing"
    >
      {/* Animated weather accent — gentle 3.5s pulse. The keyframes
          are scoped to a unique animation name so they cannot
          collide with global CSS. */}
      <style>{`
        @keyframes farroway-briefing-pulse {
          0%, 100% { opacity: 0.85; }
          50%      { opacity: 1; }
        }
      `}</style>
      <div
        style={{ ...S.accent, background: accent }}
        aria-hidden="true"
      />

      <div style={S.body}>
        {/* Greeting + estimated-time pill */}
        <header style={S.head}>
          <p style={S.greeting} data-testid="morning-briefing-greeting">
            {greeting}
          </p>
          <span style={S.timePill} data-testid="morning-briefing-time">
            ⏱ {estimatedTime}
          </span>
        </header>

        {/* Weather summary — one short line with emoji */}
        <p style={S.wxLine} data-testid="morning-briefing-weather">
          <span style={S.wxIcon} aria-hidden="true">{wxIcon}</span>
          <span>{wxLine}</span>
        </p>

        {/* Top task — title + 1-line reason. Hairline divider above
            so it visually separates from the weather headline. */}
        <div style={S.taskBlock} data-testid="morning-briefing-task">
          <p style={S.taskTitle}>
            {taskDone ? (
              <span style={S.doneTick} aria-hidden="true">✔ </span>
            ) : null}
            {taskTitle}
          </p>
          <p style={S.taskReason}>{taskReason}</p>
        </div>

        {/* Optional calm recommendation (no link in briefing — the
            standalone surfaces below provide CTAs; here it stays
            informational so the card never looks busy). */}
        {recommendation && (
          <p style={S.rec} data-testid="morning-briefing-rec">
            <span style={S.recIcon} aria-hidden="true">💡</span>
            <span>{recommendation}</span>
          </p>
        )}

        {/* Garden Mode reassurance / delight / recovery line — soft
            single sentence chosen by reassuranceEngine based on
            plant memory (timeline + scan history + streak).
            Only renders in garden mode and only when the engine
            returns a message. Never alarming; never guilt-inducing. */}
        {reassurance && (
          <p
            style={reassurance.severity === 'positive' ? S.reassurePositive : S.reassureCalm}
            data-testid="morning-briefing-reassurance"
            data-reassurance-kind={reassurance.kind}
          >
            {tSafe(reassurance.key, reassurance.fallback)}
          </p>
        )}

        {/* Optional warning chip — small, calm, never alarming */}
        {warning && (
          <p style={S.warning} data-testid="morning-briefing-warning">
            <span style={S.warnIcon} aria-hidden="true"><_WarnGlyph size={14} /></span>
            <span>{warning}</span>
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const S = {
  // Visual realism polish (May 2026): layered depth shadow +
  // soft inset highlight + lighter top→darker bottom gradient
  // background. The card now reads as a tactile, layered surface
  // instead of a flat pane — premium without being heavy.
  card: {
    position:     'relative',
    overflow:     'hidden',
    background:   'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.025) 100%)',
    border:       '1px solid rgba(255,255,255,0.07)',
    borderRadius: '18px',
    boxShadow:    [
      '0 1px 0 0 rgba(255,255,255,0.04) inset', // soft top highlight
      '0 12px 28px -8px rgba(0,0,0,0.30)',      // ambient depth
      '0 4px 8px -2px rgba(0,0,0,0.18)',        // contact shadow
    ].join(', '),
  },
  accent: {
    height:    '4px',
    width:     '100%',
    animation: 'farroway-briefing-pulse 3.5s ease-in-out infinite',
  },
  body: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.7rem',
    padding:       '1.05rem 1.1rem 1.15rem',
  },
  head: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            '0.6rem',
  },
  greeting: {
    margin:        0,
    fontSize:      '0.95rem',
    fontWeight:    700,
    color:         '#FFFFFF',
    letterSpacing: '-0.005em',
  },
  timePill: {
    display:      'inline-flex',
    alignItems:   'center',
    gap:          '0.3rem',
    padding:      '0.25rem 0.55rem',
    background:   'rgba(255,255,255,0.06)',
    border:       '1px solid rgba(255,255,255,0.14)',
    borderRadius: '999px',
    fontSize:     '0.7rem',
    fontWeight:   700,
    color:        'rgba(255,255,255,0.78)',
    flexShrink:   0,
    whiteSpace:   'nowrap',
  },
  wxLine: {
    margin:     0,
    display:    'flex',
    alignItems: 'center',
    gap:        '0.5rem',
    fontSize:   '0.875rem',
    fontWeight: 600,
    color:      'rgba(255,255,255,0.85)',
    lineHeight: 1.4,
  },
  wxIcon: {
    fontSize:  '1.05rem',
    lineHeight: 1,
  },
  taskBlock: {
    display:        'flex',
    flexDirection:  'column',
    gap:            '0.3rem',
    paddingTop:     '0.55rem',
    borderTop:      '1px solid rgba(255,255,255,0.06)',
  },
  taskTitle: {
    margin:     0,
    fontSize:   '1rem',
    fontWeight: 700,
    color:      '#FFFFFF',
    lineHeight: 1.4,
  },
  doneTick: {
    color:    '#86EFAC',
    fontWeight: 700,
  },
  taskReason: {
    margin:     0,
    fontSize:   '0.8125rem',
    fontWeight: 500,
    color:      'rgba(255,255,255,0.65)',
    lineHeight: 1.5,
  },
  rec: {
    margin:     0,
    display:    'flex',
    alignItems: 'flex-start',
    gap:        '0.5rem',
    fontSize:   '0.8125rem',
    fontWeight: 600,
    color:      '#86EFAC',
    lineHeight: 1.45,
  },
  recIcon: {
    fontSize:   '0.95rem',
    lineHeight: 1.2,
    flexShrink: 0,
  },
  // Garden Mode reassurance line — calm green tint for soft
  // observations / beginner guidance. No icon, no border, no
  // box; reads as a quiet companion sentence beneath the
  // recommendation.
  reassureCalm: {
    margin:     0,
    fontSize:   '0.8125rem',
    fontWeight: 500,
    color:      'rgba(255,255,255,0.62)',
    lineHeight: 1.5,
    fontStyle:  'italic',
    paddingTop: '0.1rem',
  },
  // Reassurance — POSITIVE variant (delight / recovery). Slightly
  // warmer green to read as a small celebration without becoming
  // a flashy badge.
  reassurePositive: {
    margin:     0,
    fontSize:   '0.8125rem',
    fontWeight: 600,
    color:      '#86EFAC',
    lineHeight: 1.5,
    paddingTop: '0.1rem',
  },
  warning: {
    margin:       0,
    display:      'inline-flex',
    alignSelf:    'flex-start',
    alignItems:   'center',
    gap:          '0.35rem',
    padding:      '0.22rem 0.55rem',
    background:   'rgba(251,191,36,0.12)',
    border:       '1px solid rgba(251,191,36,0.32)',
    borderRadius: '999px',
    fontSize:     '0.75rem',
    fontWeight:   700,
    color:        '#FCD34D',
    lineHeight:   1.2,
  },
  warnIcon: {
    fontSize:  '0.85rem',
    lineHeight: 1,
  },
};

// ─── Test surface ──────────────────────────────────────────────
export const _internal = Object.freeze({
  FALLBACK_BRIEFING,
  WEATHER_LINES,
  ACCENT_GRADIENTS,
  _greeting,
  _weatherLine,
  _estimateTime,
});
