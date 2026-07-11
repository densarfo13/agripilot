/**
 * ScanLimitReachedCard — the DISTINCT terminal state for a daily-scan-limit
 * (HTTP 429 scan_limit_reached). This is NOT a scan result and must never
 * read as "we couldn't identify this crop" — that was the production bug: the
 * quota 429 discarded its body (scanApiService returned null) and fell through
 * to the rule-based "can't identify" path.
 *
 * Renders ONLY (spec §6): the title, "You have used all scans available
 * today.", and "Your scans reset at <local time>." — never a low-confidence,
 * unidentified-crop, crop-health or diagnosis-fallback line.
 *
 * Pure render · tSafe only · never throws · SSR-safe (Date guarded).
 */
import React from 'react';
import { tSafe } from '../../i18n/tSafe.js';

function _resetLabel(resetAt) {
  try {
    if (!resetAt) return null;
    const d = new Date(resetAt);
    if (isNaN(d.getTime())) return null;
    // Local time (spec §6) — includes the date so a next-day reset is clear.
    return d.toLocaleString(undefined, {
      hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric',
    });
  } catch { return null; }
}

const C = {
  bg: '#F1F5F9', border: '#CBD5E1', ink: '#334155', title: '#0F172A',
  badgeBg: '#E2E8F0', badgeInk: '#475569',
};
const S = {
  card: {
    background: C.bg, border: '1px solid ' + C.border, borderRadius: 18,
    padding: '18px 16px 20px', marginBottom: 12,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: C.badgeBg, color: C.badgeInk, borderRadius: 999,
    padding: '5px 12px', fontSize: 13, fontWeight: 700,
  },
  title: { margin: '12px 0 0', fontSize: 18, fontWeight: 800, color: C.title, lineHeight: 1.3 },
  body: { margin: '8px 0 0', fontSize: 14, color: C.ink, lineHeight: 1.5 },
};

export default function ScanLimitReachedCard({ result }) {
  const r = result || {};
  const reset = _resetLabel(r.resetsAt || r.resetAt);
  return (
    <section style={S.card} data-testid="scan-limit-reached-card" role="region"
      aria-label={tSafe('scan.limit.title', 'Daily scan limit reached')}>
      <div style={S.badge} data-testid="scan-limit-badge">
        <span aria-hidden="true">⏳</span>
        <span>{tSafe('scan.limit.badge', 'Daily limit')}</span>
      </div>
      <h3 style={S.title} data-testid="scan-limit-title">
        {tSafe('scan.limit.title', 'Daily scan limit reached')}
      </h3>
      <p style={S.body} data-testid="scan-limit-body">
        {tSafe('scan.limit.body', 'You have used all scans available today.')}
      </p>
      {reset ? (
        <p style={S.body} data-testid="scan-limit-reset">
          {tSafe('scan.limit.resetPrefix', 'Your scans reset at')} {reset}.
        </p>
      ) : null}
    </section>
  );
}
