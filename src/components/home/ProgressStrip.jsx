/**
 * ProgressStrip — §10 Progress visibility surface.
 *
 *   <ProgressStrip />
 *
 * Renders the calm "things are moving" readout: tasks completed
 * today / week, recovery trend, and the farm health band. Each
 * line is rendered ONLY when its underlying signal supports it
 * (no fake celebration). When no positive signals exist, the
 * component self-hides.
 *
 * Strict-rule audit
 *   • Hooks unconditional. Every store read is wrapped.
 *   • Reads the same stores the briefing card already reads;
 *     the page can mount both side-by-side without contention.
 *   • No animation, no live updates — this is a quiet readout.
 */

import { useMemo } from 'react';
import { getActiveScanTasks } from '../../core/scanToTask.js';
import { getScanUsefulHistory } from '../../lib/scan/scanHistoryStore.js';
import { computeFarmHealthScore } from '../../lib/farmHealthScore.js';
import { detectScanPattern } from '../../lib/scanPatternDetection.js';
import { computeFarmProgress } from '../../lib/farmProgress.js';

const STYLES = {
  wrap: {
    background: 'rgba(53,93,73,0.10)',
    border: '1px solid rgba(53,93,73,0.32)',
    borderRadius: 12,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  header: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
  },
  list: {
    margin: 0,
    paddingLeft: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
};

export default function ProgressStrip() {
  const progress = useMemo(() => {
    let scanHistory = [];
    let scanTasks   = [];
    try { scanHistory = getScanUsefulHistory(); } catch { /* empty */ }
    try { scanTasks   = getActiveScanTasks();   } catch { /* empty */ }

    let healthScore = null;
    try { healthScore = computeFarmHealthScore({ scanHistory, scanTasks }); }
    catch { /* keep null */ }

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

    try {
      return computeFarmProgress({ scanHistory, scanTasks, healthScore, pattern });
    } catch {
      return { positiveSignals: [], completedToday: 0, completedThisWeek: 0,
               recoveryTrend: 'first_scan', healthBand: null, healthScore: null };
    }
  }, []);

  // Self-hide when there's nothing positive to surface.
  if (!progress || !progress.positiveSignals || progress.positiveSignals.length === 0) {
    return null;
  }

  return (
    <section style={STYLES.wrap} data-testid="progress-strip">
      <span style={STYLES.header}>Activity</span>
      <ul style={STYLES.list}>
        {progress.positiveSignals.map((sig, i) => <li key={i}>{sig}</li>)}
      </ul>
    </section>
  );
}
