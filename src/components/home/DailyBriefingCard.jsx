/**
 * DailyBriefingCard — the proactive farm-intelligence layer's
 * morning briefing surface.
 *
 *   <DailyBriefingCard farmerName={profile?.name} cropName={profile?.crop} />
 *
 * What it does
 * ────────────
 *   Pulls together everything the user already has on-device:
 *
 *     • cached weather (farroway_weather_cache)
 *     • scan history (scanHistoryStore.getScanUsefulHistory)
 *     • active scan tasks (scanToTask.getActiveScanTasks)
 *     • farm health score (farmHealthScore.computeFarmHealthScore)
 *     • the latest scan-pattern detection
 *     • predictive risk signals (predictiveRisk.computePredictiveRisks)
 *
 *   …and renders the composed briefing from dailyBriefing.composeDailyBriefing
 *   plus the "best action to take now" from taskPrioritization.topAction.
 *
 *   Self-hides cleanly when there is nothing to say AND no top
 *   action — a brand-new user with zero history won't see an empty
 *   placeholder card.
 *
 * Strict-rule audit
 *   • All hooks unconditional. Reads happen inside useMemo so a
 *     storage-quota error in any helper can't crash the page.
 *   • All helpers are guarded — none of them throw on null inputs
 *     by contract, but we wrap anyway in case a future refactor
 *     changes that.
 *   • SSR-safe — the storage reads return [] when localStorage
 *     is unavailable.
 *   • No network. No side effects beyond rendering.
 */

import { useMemo } from 'react';
import { getActiveScanTasks } from '../../core/scanToTask.js';
import { getScanUsefulHistory } from '../../lib/scan/scanHistoryStore.js';
import { computeFarmHealthScore } from '../../lib/farmHealthScore.js';
import { detectScanPattern } from '../../lib/scanPatternDetection.js';
import { computePredictiveRisks } from '../../lib/predictiveRisk.js';
import { composeDailyBriefing } from '../../lib/dailyBriefing.js';
import { topAction } from '../../lib/taskPrioritization.js';

const STYLES = {
  card: {
    background: 'rgba(200,148,77,0.08)',
    border: '1px solid rgba(200,148,77,0.30)',
    borderRadius: 14,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardUrgent: {
    background: 'rgba(239,68,68,0.08)',
    border:     '1px solid rgba(239,68,68,0.32)',
  },
  cardWatch: {
    background: 'rgba(245,158,11,0.08)',
    border:     '1px solid rgba(245,158,11,0.30)',
  },
  greeting: {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: '-0.005em',
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
  topActionBlock: {
    marginTop: 4,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  topActionLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  topActionText: {
    margin: '4px 0 0',
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.95)',
  },
};

function _readCachedWeather() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem('farroway_weather_cache');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch { return null; }
}

export default function DailyBriefingCard({ farmerName, cropName }) {
  const briefing = useMemo(() => {
    let scanHistory = [];
    let scanTasks   = [];
    try { scanHistory = getScanUsefulHistory(); } catch { /* empty */ }
    try { scanTasks   = getActiveScanTasks();   } catch { /* empty */ }

    const weather = _readCachedWeather();

    let healthScore = null;
    try {
      healthScore = computeFarmHealthScore({
        scanHistory,
        scanTasks,
        weatherRisk: weather && {
          droughtSignal: !!weather.droughtSignal,
          heatStress:    !!weather.heatStress,
          floodSignal:   !!weather.floodSignal,
        },
      });
    } catch { /* helper is pure but be defensive */ }

    let risks = [];
    try {
      risks = computePredictiveRisks({
        weather,
        cropName,
        scanHistory,
      });
    } catch { /* empty */ }

    // Pattern detection needs a "current" scan — we use the most
    // recent history entry as a stand-in so the briefing reflects
    // whether the latest scan looked better/worse than its prior
    // for the same crop.
    let pattern = null;
    try {
      const latest = scanHistory.length > 0 ? scanHistory[0] : null;
      if (latest) {
        pattern = detectScanPattern(
          {
            scanId: latest.id,
            cropName: latest.crop,
            possibleIssue: latest.noticed,
            severity: latest.severity,
          },
          scanHistory,
        );
      }
    } catch { /* empty */ }

    let composed;
    try {
      composed = composeDailyBriefing({
        farmerName,
        weather,
        scanHistory,
        scanTasks,
        healthScore,
        pattern,
        risks,
      });
    } catch {
      composed = { greeting: 'Hello.', lines: [], severity: 'calm', factors: [] };
    }

    let top = null;
    try {
      top = topAction(scanTasks, { weatherRisks: risks });
    } catch { /* empty */ }

    return { composed, top };
  }, [farmerName, cropName]);

  const { composed, top } = briefing;
  const hasLines = composed && Array.isArray(composed.lines) && composed.lines.length > 0;
  const hasTop   = top && top.task && top.task.title;

  // Self-hide when there's nothing actionable AND nothing to say.
  // The composer's fallback "Nothing urgent" line counts as
  // something to say, so we render even calm-only days.
  if (!hasLines && !hasTop) return null;

  const cardStyle = {
    ...STYLES.card,
    ...(composed.severity === 'urgent' ? STYLES.cardUrgent : null),
    ...(composed.severity === 'watch'  ? STYLES.cardWatch  : null),
  };

  return (
    <section
      style={cardStyle}
      data-testid="daily-briefing"
      data-severity={composed.severity}
      aria-live="polite"
    >
      <h2 style={STYLES.greeting}>{composed.greeting}</h2>
      {hasLines ? (
        <ul style={STYLES.list}>
          {composed.lines.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      ) : null}
      {hasTop ? (
        <div style={STYLES.topActionBlock} data-testid="daily-briefing-top-action">
          <span style={STYLES.topActionLabel}>Best action now</span>
          <p style={STYLES.topActionText}>{top.task.title}</p>
        </div>
      ) : null}
    </section>
  );
}
