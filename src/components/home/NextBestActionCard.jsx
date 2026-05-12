/**
 * NextBestActionCard — §1 + §2 Home priority card.
 *
 *   <NextBestActionCard cropName={profile?.crop} />
 *
 * Renders the single highest-priority recommendation the
 * NextBestActionEngine returns. Reads every input from existing
 * stores so the card is fully self-contained: drop it anywhere
 * and it lights up.
 *
 * Layout matches spec §2:
 *   ┌──────────────────────────────────────┐
 *   │ MOST IMPORTANT NOW          [urgency │
 *   │ <one-line title>                pill]│
 *   │ <one-line reason>                    │
 *   │ Why this matters: <impact>           │
 *   │                          [Hint CTA]  │
 *   └──────────────────────────────────────┘
 *
 * Strict-rule audit
 *   • Hooks unconditional. Every store read wrapped so a quota
 *     error can't crash the page.
 *   • Self-hides only when the engine returns null (which is the
 *     "genuinely nothing to do" case — we still render the calm
 *     fallback "walk the field" line by default).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { getActiveScanTasks } from '../../core/scanToTask.js';
import { getScanUsefulHistory } from '../../lib/scan/scanHistoryStore.js';
import { computeFarmHealthScore } from '../../lib/farmHealthScore.js';
import { detectScanPattern } from '../../lib/scanPatternDetection.js';
import { computePredictiveRisks } from '../../lib/predictiveRisk.js';
import { topAction } from '../../lib/taskPrioritization.js';
import { computeNextBestAction } from '../../lib/nextBestAction.js';
// §5 AI memory — explicit ignore tracking + bounded suppression.
// User-initiated only; transparent and reversible.
import {
  recordSignal,
  shouldSuppress,
  SIGNAL_TYPES,
} from '../../lib/aiMemoryStore.js';

const STYLES = {
  card: {
    background: 'rgba(200,148,77,0.10)',
    border: '1px solid rgba(200,148,77,0.40)',
    borderRadius: 14,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardHigh:   { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.40)' },
  cardMedium: { background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.36)' },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.65)',
  },
  pill: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  },
  pillHigh:   { background: 'rgba(239,68,68,0.20)',  color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.45)' },
  pillMedium: { background: 'rgba(245,158,11,0.20)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.45)' },
  pillLow:    { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.18)' },
  title: {
    margin: 0,
    fontSize: 17,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 1.35,
    letterSpacing: '-0.005em',
  },
  reason: {
    margin: 0,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.55,
  },
  impactRow: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.60)',
    fontStyle: 'italic',
    margin: 0,
  },
  hint: {
    marginTop: 2,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#C8944D',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'default',
    fontFamily: 'inherit',
  },
  // §5 — "Skip for now" affordance. The button is intentionally
  // quiet (no fill, secondary color) so users don't feel pushed
  // to use it. Five explicit skips of the same kind in 14 days
  // triggers a 7-day suppression — and the suppression is fully
  // reversible via aiMemoryStore.resumeKind.
  skipRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  skipBtn: {
    appearance: 'none',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.55)',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
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

function _pillFor(urgency) {
  if (urgency === 'high')   return { ...STYLES.pill, ...STYLES.pillHigh };
  if (urgency === 'medium') return { ...STYLES.pill, ...STYLES.pillMedium };
  return { ...STYLES.pill, ...STYLES.pillLow };
}

function _cardStyleFor(urgency) {
  if (urgency === 'high')   return { ...STYLES.card, ...STYLES.cardHigh };
  if (urgency === 'medium') return { ...STYLES.card, ...STYLES.cardMedium };
  return STYLES.card;
}

export default function NextBestActionCard({ cropName }) {
  // §5 — `skipTick` bumps when the user taps "Skip for now" so the
  // useMemo re-runs computeNextBestAction. We don't pass the
  // suppressed list down explicitly; the engine reads it via the
  // injected isSuppressed probe and falls through to the next
  // priority tier.
  const [skipTick, setSkipTick] = useState(0);
  const lastShownKindRef = useRef(null);

  const action = useMemo(() => {
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
    } catch { /* keep null */ }

    let risks = [];
    try {
      risks = computePredictiveRisks({ weather, cropName, scanHistory });
    } catch { /* empty */ }

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
    } catch { /* keep null */ }

    let topPri = null;
    try { topPri = topAction(scanTasks, { weatherRisks: risks }); }
    catch { /* keep null */ }

    const latestScan = scanHistory.length > 0 ? scanHistory[0] : null;

    try {
      return computeNextBestAction({
        risks,
        scanTasks,
        pattern,
        healthScore,
        latestScan,
        topPrioritizedAction: topPri,
        // §5 adaptation gate — let the engine drop any candidate
        // whose kind the user has explicitly skipped too many
        // times. The store's API is pure; the helper wraps any
        // storage error and falls back to "not suppressed."
        isSuppressed: (kind) => {
          try { return !!shouldSuppress(kind).suppressed; }
          catch { return false; }
        },
      });
    } catch { return null; }
    // skipTick is intentional — re-runs the memoized engine after
    // a Skip tap so the next-priority recommendation renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropName, skipTick]);

  // §5 — Record that this kind was SHOWN exactly once per change.
  // The ref guards against double-recording from React's
  // double-invoke in dev mode.
  useEffect(() => {
    if (!action || !action.kind) return;
    if (lastShownKindRef.current === action.kind) return;
    lastShownKindRef.current = action.kind;
    try { recordSignal(action.kind, SIGNAL_TYPES.SHOWN); } catch { /* swallow */ }
  }, [action]);

  const onSkip = () => {
    if (!action || !action.kind) return;
    try { recordSignal(action.kind, SIGNAL_TYPES.IGNORED); } catch { /* swallow */ }
    // Reset the shown-ref so the NEXT kind also gets a clean
    // 'shown' record on the re-render.
    lastShownKindRef.current = null;
    setSkipTick((t) => t + 1);
  };

  if (!action) return null;

  return (
    <section
      style={_cardStyleFor(action.urgency)}
      data-testid="next-best-action"
      data-kind={action.kind}
      data-urgency={action.urgency}
      aria-live="polite"
    >
      <div style={STYLES.header}>
        <span style={STYLES.eyebrow}>Most important now</span>
        <span style={_pillFor(action.urgency)}>
          {action.urgency === 'high' ? 'Urgent' : action.urgency === 'medium' ? 'Soon' : 'Low'}
        </span>
      </div>
      <h2 style={STYLES.title}>{action.title}</h2>
      <p style={STYLES.reason}>{action.reason}</p>
      {action.impact ? (
        <p style={STYLES.impactRow}>Why it matters: {action.impact}</p>
      ) : null}
      {action.hint ? (
        <span style={STYLES.hint} data-testid="next-best-action-hint">→ {action.hint}</span>
      ) : null}
      {action.kind && action.kind !== 'fallback_walk' ? (
        <div style={STYLES.skipRow}>
          <button
            type="button"
            onClick={onSkip}
            style={STYLES.skipBtn}
            data-testid="next-best-action-skip"
            title="Skip for now. After 5 skips of this kind, it pauses for a week."
          >
            Skip for now
          </button>
        </div>
      ) : null}
    </section>
  );
}
