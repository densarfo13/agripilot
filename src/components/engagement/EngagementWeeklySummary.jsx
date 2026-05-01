/**
 * EngagementWeeklySummary — 7-day plant-health recap with
 * improvement / warning bullets.
 *
 * Spec coverage
 *   §5 weekly summary  → plant health label + improvements + warnings
 *
 * Sources
 *   • Completion log: `getRecentCompletions(7)` from engagementHistory
 *   • Streak:        `getStreak()` from utils/streak
 *
 * Health bands (completion count over 7 days)
 *     ≥ 5  → 'healthy'  (green)
 *     2–4  → 'watch'    (amber)
 *     0–1  → 'warning'  (red)
 *
 * Improvements / warnings are derived from the same 7-day log. We
 * deliberately keep the catalogue small + supportive — never
 * shame-based copy.
 *
 * Strict-rule audit
 *   • All visible text via tStrict.
 *   • Inline styles only.
 *   • Never throws.
 *   • Coexists with the existing `WeeklySummary` component (which
 *     stays unchanged) — this is the engagement-flavoured surface
 *     gated by the `dailyEngagement` flag.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';
import { getStreak } from '../../utils/streak.js';
import {
  getRecentCompletions,
  ENGAGEMENT_CHANGE_EVENT,
} from '../../engine/engagementHistory.js';

const BAND_TONES = {
  healthy: { color: '#86EFAC', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.32)' },
  watch:   { color: '#FCD34D', bg: 'rgba(252,211,77,0.10)', border: 'rgba(252,211,77,0.30)' },
  warning: { color: '#FCA5A5', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.32)' },
};

const S = {
  card: {
    background: '#162033',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '14px 16px',
    color: '#EAF2FF',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 13,
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  healthRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
  },
  healthDot: { fontSize: 12 },
  metaLine: { fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.45 },
  bulletGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  bulletHeading: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 },
  bullet: { fontSize: 13, color: '#EAF2FF', margin: 0, lineHeight: 1.45 },
};

function _band(count) {
  if (count >= 5) return 'healthy';
  if (count >= 2) return 'watch';
  return 'warning';
}

function _hasScanThisWeek(completions) {
  return completions.some((c) =>
    String(c?.taskId || '').includes('scan')
    || String(c?.kind   || '') === 'scan',
  );
}

function _hasWaterThisWeek(completions) {
  return completions.some((c) => String(c?.taskId || '').toLowerCase().includes('water'));
}

export default function EngagementWeeklySummary({ style } = {}) {
  useTranslation();

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setTick((n) => (n + 1) % 1_000_000);
    try {
      window.addEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
      window.addEventListener('storage', handler);
    } catch { /* swallow */ }
    return () => {
      try {
        window.removeEventListener(ENGAGEMENT_CHANGE_EVENT, handler);
        window.removeEventListener('storage', handler);
      } catch { /* swallow */ }
    };
  }, []);

  const { count, band, streak, improvements, warnings } = useMemo(() => {
    let completions = [];
    try { completions = getRecentCompletions(7) || []; } catch { completions = []; }
    let s = 0;
    try { s = getStreak(); } catch { s = 0; }

    const c = completions.length;
    const b = _band(c);
    const imps = [];
    const warns = [];

    if (s >= 3) {
      imps.push({
        key: 'engagement.weekly.improve.streak',
        fallback: '{count}-day streak going \uD83D\uDD25',
        vars: { count: String(s) },
      });
    }
    if (c >= 5) {
      imps.push({
        key: 'engagement.weekly.improve.consistent',
        fallback: 'Most days checked this week \u2014 great consistency.',
      });
    } else if (c >= 2 && c <= 4) {
      imps.push({
        key: 'engagement.weekly.improve.steady',
        fallback: '{count} actions logged this week.',
        vars: { count: String(c) },
      });
    }

    if (!_hasScanThisWeek(completions)) {
      warns.push({
        key: 'engagement.weekly.warn.noScan',
        fallback: 'No plant scan in 7 days \u2014 a quick photo can catch issues early.',
      });
    }
    if (c <= 1) {
      warns.push({
        key: 'engagement.weekly.warn.low',
        fallback: 'Only a couple of actions logged \u2014 try one short check today.',
      });
    }
    if (!_hasWaterThisWeek(completions) && c >= 1) {
      warns.push({
        key: 'engagement.weekly.warn.water',
        fallback: 'No watering logged \u2014 check soil moisture if it\u2019s been hot.',
      });
    }

    return { count: c, band: b, streak: s, improvements: imps, warnings: warns };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const tone = BAND_TONES[band];
  const healthLabel = tStrict(
    `engagement.weekly.health.${band}`,
    band === 'healthy' ? 'Healthy'
    : band === 'watch' ? 'Watch'
                       : 'Needs attention',
  );

  function _renderBullet(b, idx) {
    let txt = tStrict(b.key, b.fallback);
    if (b.vars) {
      for (const [k, v] of Object.entries(b.vars)) {
        txt = txt.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return <p key={`${b.key}_${idx}`} style={S.bullet}>• {txt}</p>;
  }

  return (
    <section style={{ ...S.card, ...(style || null) }} data-testid="engagement-weekly-summary">
      <h3 style={S.title}>
        {tStrict('engagement.weekly.title', 'This week')}
      </h3>

      <div style={{
        ...S.healthRow,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.color,
      }} data-testid="engagement-weekly-health" data-band={band}>
        <span style={S.healthDot} aria-hidden="true">{'\u25CF'}</span>
        <span>
          {tStrict('engagement.weekly.healthLabel', 'Plant health: {label}')
            .replace('{label}', healthLabel)}
        </span>
      </div>

      <p style={S.metaLine} data-testid="engagement-weekly-count">
        {tStrict(
          'engagement.weekly.actionsLine',
          'You completed {count} actions this week.'
        ).replace('{count}', String(count))}
      </p>

      {improvements.length > 0 ? (
        <div style={S.bulletGroup} data-testid="engagement-weekly-improvements">
          <h4 style={S.bulletHeading}>
            {tStrict('engagement.weekly.improvements', 'Improvements')}
          </h4>
          {improvements.map(_renderBullet)}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div style={S.bulletGroup} data-testid="engagement-weekly-warnings">
          <h4 style={S.bulletHeading}>
            {tStrict('engagement.weekly.warnings', 'Watch out for')}
          </h4>
          {warnings.map(_renderBullet)}
        </div>
      ) : null}

      {/* Suppress unused-var warning when only one block renders */}
      <span hidden data-streak={streak} />
    </section>
  );
}
