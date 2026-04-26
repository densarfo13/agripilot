/**
 * InsightCards — 3..5 actionable cards generated from existing
 * stats. Pure heuristics, no ML, no API calls. The card text is
 * built from the same numbers the SummaryCards above already
 * display, so an NGO admin gets a plain-English narrative without
 * the dashboard adding a second data fetch.
 *
 * Intent: turn raw counts into "what should we do next" sentences.
 *
 *   buildInsights({
 *     totalFarmers, highRiskCount, readyToSellCount,
 *     readyToSellTopCrop, complianceRate, daysToHarvestMedian,
 *     bestPerformingCrop,
 *   }) → [
 *     { id, severity, title, body, cta? },
 *     ...
 *   ]
 *
 * Severity drives the colour band only; nothing about it is
 * persisted.
 */

import { useMemo } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { getCropLabelSafe } from '../../utils/crops.js';

const SEVERITY_STYLE = Object.freeze({
  high:   { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.35)',  fg: '#FCA5A5', icon: '\u26A0\uFE0F' },
  medium: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', fg: '#FDE68A', icon: '\uD83D\uDCC8' },
  low:    { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.35)',  fg: '#86EFAC', icon: '\u2705' },
  info:   { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.35)', fg: '#93C5FD', icon: '\uD83D\uDCA1' },
});

/**
 * Pure: build a list of insight strings from the input stats.
 * Exported separately from the React component so tests can
 * exercise the heuristic without rendering.
 */
export function buildInsights({
  totalFarmers          = 0,
  activeFarmers         = 0,
  highRiskCount         = 0,
  readyToSellCount      = 0,
  readyToSellTopCrop    = null,   // canonical crop id
  readyToSellWindowDays = null,   // median days until harvest for ready-to-sell
  complianceRate        = null,   // 0..1 — tasksDone / tasksAssigned
  bestPerformingCrop    = null,   // canonical crop id seeing best activity
  lang                  = 'en',
} = {}) {
  const out = [];
  const total = Number(totalFarmers) || 0;
  const high = Number(highRiskCount) || 0;
  const ready = Number(readyToSellCount) || 0;
  const active = Number(activeFarmers) || 0;

  // High-risk alert
  if (total > 0 && high > 0) {
    const pct = Math.round((high / total) * 100);
    if (pct >= 10) {
      out.push({
        id: 'high-risk',
        severity: 'high',
        title: 'High-Risk Alert',
        body: `${pct}% of tracked farms are at high risk (score < 40). Investigate low-activity cohorts first.`,
      });
    }
  }

  // Market opportunity — ready-to-sell signal
  if (ready > 0) {
    const cropPart = readyToSellTopCrop
      ? `${getCropLabelSafe(readyToSellTopCrop, lang) || readyToSellTopCrop} `
      : '';
    const window = readyToSellWindowDays && readyToSellWindowDays > 0
      ? ` within ${readyToSellWindowDays} days`
      : '';
    out.push({
      id: 'market-opportunity',
      severity: ready >= 50 ? 'medium' : 'low',
      title: 'Market Opportunity',
      body: `${ready} ${cropPart}farm${ready === 1 ? '' : 's'} ready to sell${window}. Open the buyer view to start matching.`,
    });
  }

  // Engagement signal — active vs total
  if (total > 0) {
    const activePct = Math.round((active / total) * 100);
    if (active === 0) {
      out.push({
        id: 'no-activity',
        severity: 'high',
        title: 'No Recent Activity',
        body: 'No farmers logged any activity in the last 7 days. Send a check-in nudge.',
      });
    } else if (activePct < 30) {
      out.push({
        id: 'low-engagement',
        severity: 'medium',
        title: 'Low Engagement',
        body: `Only ${activePct}% of farmers were active in the last 7 days. Consider an outreach push.`,
      });
    } else if (activePct >= 70) {
      out.push({
        id: 'strong-engagement',
        severity: 'low',
        title: 'Strong Engagement',
        body: `${activePct}% of farmers are active this week — well above the low-engagement threshold.`,
      });
    }
  }

  // Growth signal — task compliance
  if (complianceRate != null && Number.isFinite(complianceRate)) {
    const pct = Math.round(Math.max(0, Math.min(1, complianceRate)) * 100);
    if (pct >= 70) {
      const cropPart = bestPerformingCrop
        ? ` (best: ${getCropLabelSafe(bestPerformingCrop, lang) || bestPerformingCrop})`
        : '';
      out.push({
        id: 'growth-signal',
        severity: 'low',
        title: 'Growth Signal',
        body: `${pct}% task compliance across the cohort${cropPart}. Farmers following recommendations show better outcomes.`,
      });
    } else if (pct > 0 && pct < 40) {
      out.push({
        id: 'compliance-gap',
        severity: 'medium',
        title: 'Compliance Gap',
        body: `Only ${pct}% of assigned tasks are being completed. Review task difficulty / clarity.`,
      });
    }
  }

  // Cap at 5; prefer high severity first.
  out.sort((a, b) => (severityRank(b.severity) - severityRank(a.severity)));
  return out.slice(0, 5);
}

function severityRank(s) {
  if (s === 'high')   return 3;
  if (s === 'medium') return 2;
  if (s === 'low')    return 1;
  return 0;
}

export default function InsightCards(props) {
  const { t, lang } = useTranslation();
  const insights = useMemo(
    () => buildInsights({ ...props, lang }),
    [props, lang]
  );

  if (insights.length === 0) {
    return (
      <section style={S.empty} data-testid="insight-cards-empty">
        <span>{S.icon}</span>
        <span>{tSafe(t, 'admin.insights.empty',
          'Not enough data yet to surface insights.')}</span>
      </section>
    );
  }

  return (
    <section style={S.wrap} data-testid="insight-cards">
      {insights.map((ins) => {
        const sev = SEVERITY_STYLE[ins.severity] || SEVERITY_STYLE.info;
        return (
          <article
            key={ins.id}
            style={{ ...S.card, background: sev.bg, borderColor: sev.border }}
            data-testid={`insight-${ins.id}`}
          >
            <div style={S.cardHead}>
              <span style={S.cardIcon}>{sev.icon}</span>
              <span style={{ ...S.cardTitle, color: sev.fg }}>
                {tSafe(t, `admin.insight.${ins.id}.title`, ins.title)}
              </span>
            </div>
            <p style={S.cardBody}>{ins.body}</p>
          </article>
        );
      })}
    </section>
  );
}

const S = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '0.75rem',
    marginTop: '1rem',
  },
  card: {
    border: '1px solid', borderRadius: 12, padding: '0.875rem 1rem',
    color: '#E2E8F0', display: 'flex', flexDirection: 'column',
    gap: '0.375rem',
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  cardIcon: { fontSize: '1rem' },
  cardTitle: { fontSize: '0.875rem', fontWeight: 700,
               textTransform: 'uppercase', letterSpacing: '0.04em' },
  cardBody:  { margin: 0, fontSize: '0.875rem',
               color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 },
  empty: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)',
    padding: '0.75rem 1rem',
    background: '#111D2E', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12, marginTop: '1rem',
  },
};
