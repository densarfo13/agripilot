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

// ─── Constants ─────────────────────────────────────────────────

const FALLBACK_BRIEFING = Object.freeze({
  weatherSummary: 'Steady weather today',
  taskTitle:      'Check your crops today and monitor soil moisture.',
  taskReason:     'A short walk-around helps you spot problems early.',
  estimatedTime:  '5 mins',
});

// Weather lines stay short and calm. Mode-specific phrasing is
// handled by the contextEngine via the task title + recommendation;
// this line is the at-a-glance headline only.
const WEATHER_LINES = Object.freeze({
  rain:    { label: 'Rain expected today',         icon: '🌧',  accent: 'cool'    },
  heat:    { label: 'Hot weather expected today',  icon: '🔥',  accent: 'hot'     },
  dry:     { label: 'Dry conditions today',        icon: '🌵',  accent: 'warm'    },
  sunny:   { label: 'Sunny and clear today',       icon: '☀',   accent: 'warm'    },
  cloudy:  { label: 'Cloudy and mild today',       icon: '☁',   accent: 'cool'    },
  wind:    { label: 'Strong wind today',           icon: '💨',  accent: 'slate'   },
  unknown: { label: 'Steady weather today',        icon: '🌤',  accent: 'neutral' },
});

const ACCENT_GRADIENTS = Object.freeze({
  hot:     'linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)',
  warm:    'linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)',
  cool:    'linear-gradient(90deg, #38BDF8 0%, #6366F1 100%)',
  slate:   'linear-gradient(90deg, #64748B 0%, #475569 100%)',
  neutral: 'linear-gradient(90deg, #22C55E 0%, #16A34A 100%)',
});

// ─── Helpers ───────────────────────────────────────────────────

/** Time-of-day greeting. Never throws. */
function _greeting(now, label) {
  let h = 12;
  try {
    const d = (now instanceof Date) ? now : new Date();
    h = d.getHours();
  } catch { /* swallow */ }
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
  const who  = (typeof label === 'string' && label.trim()) ? label.trim() : 'Farmer';
  return `Good ${part}, ${who}`;
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
 * Map a task → estimated time band.
 * Spec: 2 mins | 5 mins | 10 mins.
 *   • light / low-urgency  → 2 mins
 *   • harvest / weeding    → 10 mins
 *   • everything else      → 5 mins
 */
function _estimateTime(task) {
  if (!task || typeof task !== 'object') return '5 mins';
  const cat = String(task.category || '').toLowerCase();
  const urg = String(task.urgency  || 'medium').toLowerCase();
  if (cat === 'harvest' || cat === 'weeding') return '10 mins';
  if (cat === 'light'   || urg === 'low')     return '2 mins';
  return '5 mins';
}

// ─── Component ─────────────────────────────────────────────────

export default function MorningBriefingCard({
  userTypeLabel = 'Farmer',
  weather       = null,
  ctxIntel      = null,
  taskDone      = false,
  now           = null,
}) {
  // Build the briefing in a single try/catch so a malformed input
  // can never blank Home — every render path resolves to text.
  let greeting, wxLine, wxIcon, accent, taskTitle, taskReason,
      recommendation, warning, estimatedTime;
  try {
    greeting = _greeting(now, userTypeLabel);

    const wx = _weatherLine(weather);
    wxLine   = wx.label;
    wxIcon   = wx.icon;
    accent   = ACCENT_GRADIENTS[wx.accent] || ACCENT_GRADIENTS.neutral;

    const task = ctxIntel && ctxIntel.todayTask;
    taskTitle  = (task && task.title)  || FALLBACK_BRIEFING.taskTitle;
    taskReason = (task && task.reason) || FALLBACK_BRIEFING.taskReason;

    const rec = ctxIntel && ctxIntel.recommendation;
    recommendation = (rec && rec.type !== 'general' && rec.text)
      ? rec.text : null;

    const al = ctxIntel && ctxIntel.alert;
    warning = (al
      && (al.priority === 'warning' || al.priority === 'critical')
      && al.title)
      ? al.title : null;

    estimatedTime = _estimateTime(task);
  } catch {
    greeting       = `Good morning, ${userTypeLabel || 'Farmer'}`;
    wxLine         = FALLBACK_BRIEFING.weatherSummary;
    wxIcon         = WEATHER_LINES.unknown.icon;
    accent         = ACCENT_GRADIENTS.neutral;
    taskTitle      = FALLBACK_BRIEFING.taskTitle;
    taskReason     = FALLBACK_BRIEFING.taskReason;
    recommendation = null;
    warning        = null;
    estimatedTime  = FALLBACK_BRIEFING.estimatedTime;
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

        {/* Optional warning chip — small, calm, never alarming */}
        {warning && (
          <p style={S.warning} data-testid="morning-briefing-warning">
            <span style={S.warnIcon} aria-hidden="true">⚠</span>
            <span>{warning}</span>
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const S = {
  card: {
    position:     'relative',
    overflow:     'hidden',
    background:   'rgba(255,255,255,0.04)',
    border:       '1px solid rgba(255,255,255,0.10)',
    borderRadius: '18px',
    boxShadow:    '0 12px 36px rgba(0,0,0,0.18)',
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
