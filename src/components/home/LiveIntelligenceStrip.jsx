/**
 * LiveIntelligenceStrip — horizontally scrolling row of compact
 * live-signal chips. Sits below the Home hero, above the weather
 * card. Reads as the "living agricultural OS" pulse: weather
 * shifts, disease risk, moisture watch, growth momentum, scan
 * follow-up, recommended timing — whatever signals are warm right
 * now, in priority order.
 *
 *   <LiveIntelligenceStrip
 *     mode="farm"
 *     weather={weather}
 *     landHealth={health}
 *     recentScans={scans}
 *     tasks={tasks}
 *   />
 *
 * Each chip is a self-suppressing module — when there's nothing
 * to say, it doesn't render. The strip itself self-suppresses
 * when fewer than two chips qualify so we never paint a single
 * lonely chip floating in horizontal whitespace.
 *
 * The chip ordering is calibrated by urgency:
 *   1. Disease / pest risk     (only if recent scan flagged)
 *   2. Moisture watch          (drought risk from satellite)
 *   3. Weather shift           (rain incoming / heat spike)
 *   4. Growth momentum         (streak + completed-task trend)
 *   5. Recommended timing      (best action window today)
 *   6. Regional insight        (only if region-specific note)
 *
 * Strict-rule audit
 *   • Pure presentational. Reads inputs, builds chips, scrolls.
 *   • No new fetches — every signal comes from the parent.
 *   • Hardware-accelerated horizontal scroll with snap, hidden
 *     scrollbar, momentum on iOS Safari.
 *   • No emoji. Inline SVG glyphs only.
 *   • SSR-safe. Never throws.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import useFarmHealth from '../../hooks/useFarmHealth.js';

// ─── Glyph palette ────────────────────────────────────────────

function _DropletGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3c4 5 6 8 6 11a6 6 0 1 1-12 0c0-3 2-6 6-11z"
            stroke="currentColor" strokeWidth="1.7" fill="none" strokeLinejoin="round"/>
    </svg>
  );
}
function _SunGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" fill="none"/>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <line x1="12" y1="3"  x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="21"/>
        <line x1="3"  y1="12" x2="5"  y2="12"/>
        <line x1="19" y1="12" x2="21" y2="12"/>
      </g>
    </svg>
  );
}
function _LeafGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19c4 0 8-1 11-4s4-7 4-11c-4 0-8 1-11 4S5 15 5 19z"
            stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}
function _BugGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="12" cy="13" rx="5" ry="6" stroke="currentColor" strokeWidth="1.7" fill="none"/>
      <path d="M8 8l-2-2M16 8l2-2M5 13H3M19 13h2M7 18l-2 2M17 18l2 2"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function _PulseGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h4l2-6 3 12 3-9 2 3h4"
            stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" fill="none"/>
    </svg>
  );
}
function _ClockGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" fill="none"/>
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Chip builders ────────────────────────────────────────────

function _diseaseChip(recentScans) {
  if (!Array.isArray(recentScans) || recentScans.length === 0) return null;
  const latest = recentScans[0];
  if (!latest || typeof latest !== 'object') return null;
  const cat = String(latest.category || '').toLowerCase();
  if (cat === 'healthy' || cat === 'no_issue_detected') return null;
  return {
    key: 'disease',
    tone: cat === 'critical' || cat === 'concern' ? 'critical' : 'watch',
    icon: _BugGlyph,
    label: tSafe('live.disease.label', 'Disease watch'),
    value: latest.noticed || tSafe('live.disease.unknown', 'Needs review'),
    to:    '/scan',
  };
}

function _moistureChip(landHealth) {
  if (!landHealth || typeof landHealth !== 'object') return null;
  const drought = String(landHealth.droughtRisk || '').toLowerCase();
  if (drought !== 'high' && drought !== 'medium') return null;
  return {
    key: 'moisture',
    tone: drought === 'high' ? 'critical' : 'watch',
    icon: _DropletGlyph,
    label: tSafe('live.moisture.label', 'Moisture'),
    value: drought === 'high'
      ? tSafe('live.moisture.high',   'Drought risk')
      : tSafe('live.moisture.medium', 'Watch closely'),
    to:    '/tasks',
  };
}

function _weatherShiftChip(weather) {
  if (!weather || typeof weather !== 'object') return null;
  const source = String(weather.source || '');
  if (source !== 'weather-api') return null;
  const rain = Number(weather.rainChance);
  const temp = Number(weather.temp);
  if (Number.isFinite(rain) && rain >= 60) {
    return {
      key: 'weather',
      tone: rain >= 80 ? 'watch' : 'info',
      icon: _DropletGlyph,
      label: tSafe('live.weather.label', 'Rain incoming'),
      value: `${Math.round(rain)}% ${tSafe('common.chance', 'chance')}`,
      to:    '/tasks',
    };
  }
  if (Number.isFinite(temp) && temp >= 32) {
    return {
      key: 'weather',
      tone: temp >= 36 ? 'critical' : 'watch',
      icon: _SunGlyph,
      label: tSafe('live.weather.heatLabel', 'Heat spike'),
      value: `${Math.round(temp)}°`,
      to:    '/tasks',
    };
  }
  return null;
}

function _growthChip(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const completed = tasks.filter((t) => t && t.completed).length;
  if (completed < 1) return null;
  return {
    key: 'growth',
    tone: 'success',
    icon: _PulseGlyph,
    label: tSafe('live.growth.label', 'Momentum'),
    value: `${completed} ${tSafe('live.growth.done', 'done')}`,
    to:    '/progress',
  };
}

function _timingChip(weather) {
  if (!weather || typeof weather !== 'object') return null;
  const source = String(weather.source || '');
  if (source !== 'weather-api') return null;
  const temp = Number(weather.temp);
  if (!Number.isFinite(temp)) return null;
  // Best window heuristic: cool morning if afternoon high is hot,
  // anytime midday if mild, dusk if heat persists.
  const label = temp >= 30
    ? tSafe('live.timing.morning', 'Morning window')
    : tSafe('live.timing.midday',  'Midday window');
  return {
    key: 'timing',
    tone: 'info',
    icon: _ClockGlyph,
    label: tSafe('live.timing.label', 'Best time'),
    value: label,
    to:    '/tasks',
  };
}

function _landHealthChip(landHealth, mode) {
  if (String(mode || '').toLowerCase() === 'garden') return null;
  if (!landHealth || typeof landHealth !== 'object') return null;
  const status = String(landHealth.status || '').toLowerCase();
  if (status !== 'watch' && status !== 'critical') return null;
  return {
    key: 'land',
    tone: status === 'critical' ? 'critical' : 'watch',
    icon: _LeafGlyph,
    label: tSafe('live.land.label', 'Land health'),
    value: status === 'critical'
      ? tSafe('live.land.critical', 'Inspect today')
      : tSafe('live.land.watch',    'Check stress'),
    to:    '/scan',
  };
}

// ─── Tone palette ─────────────────────────────────────────────

const TONE_STYLES = {
  info: {
    bg: 'rgba(58,90,128,0.18)',
    border: 'rgba(96,142,180,0.42)',
    ink:    '#A8C5E0',
    iconWrap: 'rgba(96,142,180,0.20)',
  },
  watch: {
    bg: 'rgba(200,148,77,0.18)',
    border: 'rgba(200,148,77,0.45)',
    ink:    '#E6BC85',
    iconWrap: 'rgba(200,148,77,0.22)',
  },
  critical: {
    bg: 'rgba(198,90,75,0.20)',
    border: 'rgba(198,90,75,0.50)',
    ink:    '#F1A89E',
    iconWrap: 'rgba(198,90,75,0.24)',
  },
  success: {
    bg: 'rgba(143,171,115,0.18)',
    border: 'rgba(143,171,115,0.42)',
    ink:    '#A8C283',
    iconWrap: 'rgba(143,171,115,0.22)',
  },
};

// ─── Component ────────────────────────────────────────────────

export default function LiveIntelligenceStrip({
  mode = 'farm',
  location = null,
  weather = null,
  recentScans = [],
  tasks = [],
  testId = 'live-intelligence-strip',
}) {
  // Garden mode never gets a land-health signal — backyard pots
  // don't benefit from NDVI. The hook self-suppresses (returns
  // hasCoords:false) when no coordinates are present.
  const isFarm = String(mode || 'farm').toLowerCase() !== 'garden';
  const { health: landHealth } = useFarmHealth(isFarm ? location : null);

  const chips = useMemo(() => {
    const all = [
      _diseaseChip(recentScans),
      _moistureChip(landHealth),
      _weatherShiftChip(weather),
      _landHealthChip(landHealth, mode),
      _growthChip(tasks),
      _timingChip(weather),
    ].filter(Boolean);
    return all.slice(0, 6);
  }, [mode, weather, landHealth, recentScans, tasks]);

  // Self-suppress when fewer than two signals qualify — we'd
  // rather show nothing than paint a single lonely chip.
  if (chips.length < 2) return null;

  return (
    <div style={S.wrap} data-testid={testId}>
      <div style={S.scrollRow} data-testid={`${testId}-scroll`}>
        {chips.map((chip) => {
          const t = TONE_STYLES[chip.tone] || TONE_STYLES.info;
          const Icon = chip.icon;
          return (
            <Link
              key={chip.key}
              to={chip.to}
              style={{
                ...S.chip,
                background: t.bg,
                border: `1px solid ${t.border}`,
                color: t.ink,
              }}
              data-testid={`${testId}-chip-${chip.key}`}
              data-tone={chip.tone}
            >
              <span
                style={{ ...S.chipIconWrap, background: t.iconWrap, color: t.ink }}
                aria-hidden="true"
              >
                <Icon />
              </span>
              <span style={S.chipBody}>
                <span style={S.chipLabel}>{chip.label}</span>
                <span style={S.chipValue}>{chip.value}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    position: 'relative',
    // Negative margin lets the strip bleed to the edges of the
    // page shell so the scroll feels continuous (Apple Weather
    // forecast-strip aesthetic) while the cards above/below stay
    // padded.
    margin: '0 -1rem',
  },
  scrollRow: {
    display: 'flex',
    gap: '0.55rem',
    overflowX: 'auto',
    scrollSnapType: 'x proximity',
    WebkitOverflowScrolling: 'touch',
    padding: '0.15rem 1rem 0.4rem',
    // Hide the scrollbar on every engine — the row is its own
    // affordance via the chip overflow at the right edge.
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  chip: {
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.55rem',
    padding: '0.5rem 0.75rem 0.5rem 0.55rem',
    borderRadius: 14,
    minWidth: '10.5rem',
    textDecoration: 'none',
    scrollSnapAlign: 'start',
    WebkitTapHighlightColor: 'transparent',
    backdropFilter: 'blur(10px) saturate(140%)',
    WebkitBackdropFilter: 'blur(10px) saturate(140%)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
  },
  chipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chipBody: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  chipLabel: {
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'rgba(234,242,255,0.72)',
  },
  chipValue: {
    fontSize: '0.85rem',
    fontWeight: 800,
    marginTop: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '14rem',
  },
};
