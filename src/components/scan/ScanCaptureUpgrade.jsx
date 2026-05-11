/**
 * ScanCaptureUpgrade — sits BELOW the camera/upload card on the
 * scan page's capture phase. Spec §8 (UI tightening pass):
 *
 *   • "What scan can detect" chip row (Disease / Pest / Leaf
 *     stress / Crop condition)
 *   • Recent scans summary (most recent up to 2 entries)
 *
 * Together they replace the empty page-real-estate below the
 * Open camera / Upload photo card. Pure presentational; reads
 * recent scans from the existing scanHistoryStore.
 *
 * Strict-rule audit
 *   • Pure / never throws. SSR-safe (localStorage access in store
 *     is guarded). Empty history → recent-scans section self-hides.
 *   • Lucide-style inline SVGs only — no emoji, no decorative shapes.
 *   • Soft Ochre / olive palette so the card matches the page chrome.
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../../i18n/tSafe.js';
import { PREMIUM_TOKENS as T } from '../premium/tokens.js';
import { getScanUsefulHistory } from '../../lib/scan/scanHistoryStore.js';

const CAPABILITY_CHIPS = [
  { key: 'disease',   labelKey: 'scan.capability.disease',   fallback: 'Disease' },
  { key: 'pest',      labelKey: 'scan.capability.pest',      fallback: 'Pest' },
  { key: 'leafStress',labelKey: 'scan.capability.leafStress',fallback: 'Leaf stress' },
  { key: 'condition', labelKey: 'scan.capability.condition', fallback: 'Crop condition' },
];

function _LeafIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 19c4 0 8-1 11-4s4-7 4-11c-4 0-8 1-11 4S5 15 5 19z"
            stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none"/>
      <path d="M5 19c3-3 6-5 11-9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function _ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" fill="none"/>
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function _formatRelative(iso) {
  try {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return '';
    const diff = Date.now() - ms;
    if (diff < 60_000)           return tSafe('time.justNow',    'Just now');
    if (diff < 3_600_000)        return `${Math.round(diff / 60_000)} ${tSafe('time.minAgo', 'min ago')}`;
    if (diff < 86_400_000)       return `${Math.round(diff / 3_600_000)} ${tSafe('time.hrAgo', 'hr ago')}`;
    if (diff < 7 * 86_400_000)   return `${Math.round(diff / 86_400_000)} ${tSafe('time.dAgo', 'd ago')}`;
    return new Date(ms).toLocaleDateString();
  } catch { return ''; }
}

function _categoryLabel(category) {
  const c = String(category || '').toLowerCase();
  if (c === 'healthy' || c === 'no_issue_detected') return tSafe('scan.history.healthy', 'Healthy');
  if (c === 'needs_review')                          return tSafe('scan.history.needsReview', 'Needs review');
  if (c === 'concern' || c === 'critical')           return tSafe('scan.history.concern', 'Concern');
  return tSafe('scan.history.recorded', 'Recorded');
}

export default function ScanCaptureUpgrade({ testId = 'scan-capture-upgrade' }) {
  const recent = useMemo(() => {
    try {
      const all = getScanUsefulHistory();
      return Array.isArray(all) ? all.slice(0, 2) : [];
    } catch { return []; }
  }, []);

  return (
    <div style={S.wrap} data-testid={testId}>
      {/* What scan can detect */}
      <section style={S.section} data-testid={`${testId}-capabilities`}>
        <header style={S.sectionHead}>
          <h3 style={S.sectionTitle}>
            {tSafe('scan.capabilities.title', 'What scan can detect')}
          </h3>
        </header>
        <div style={S.chipRow}>
          {CAPABILITY_CHIPS.map((c) => (
            <span
              key={c.key}
              style={S.chip}
              data-testid={`${testId}-chip-${c.key}`}
            >
              <span style={S.chipIcon} aria-hidden="true"><_LeafIcon /></span>
              <span>{tSafe(c.labelKey, c.fallback)}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Recent scans — only renders when history exists. Spec §8
          says don't leave an empty section, so we self-hide rather
          than show a "no scans yet" placeholder card. */}
      {recent.length > 0 && (
        <section style={S.section} data-testid={`${testId}-recent`}>
          <header style={S.sectionHead}>
            <h3 style={S.sectionTitle}>
              {tSafe('scan.recent.title', 'Recent scans')}
            </h3>
            <Link to="/journal" style={S.sectionLink} data-testid={`${testId}-recent-more`}>
              {tSafe('common.viewAll', 'View all')}
              <span aria-hidden="true" style={{ marginLeft: 2 }}>{'›'}</span>
            </Link>
          </header>
          <ul style={S.recentList}>
            {recent.map((entry) => (
              <li key={entry.id} style={S.recentRow} data-testid={`${testId}-recent-item`}>
                <span style={S.recentLeft}>
                  <span style={S.recentIcon} aria-hidden="true"><_ClockIcon /></span>
                  <span style={S.recentBody}>
                    <span style={S.recentNoticed}>{entry.noticed || _categoryLabel(entry.category)}</span>
                    <span style={S.recentMeta}>
                      {_categoryLabel(entry.category)}
                      {entry.createdAt && (
                        <>
                          <span style={S.metaDot}>{' · '}</span>
                          {_formatRelative(entry.createdAt)}
                        </>
                      )}
                    </span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const S = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
  section: {
    background: T.panelHi,
    border: `1px solid ${T.border}`,
    borderRadius: 14,
    padding: '0.85rem 0.95rem',
    boxShadow: T.shadowCard,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.55rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '0.85rem',
    fontWeight: 800,
    letterSpacing: '0.005em',
    color: T.ink,
    textTransform: 'uppercase',
  },
  sectionLink: {
    fontSize: '0.78rem',
    fontWeight: 700,
    color: T.ochreInk,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.45rem',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    padding: '0.32rem 0.65rem',
    borderRadius: 999,
    background: T.ochreSoft,
    border: `1px solid ${T.ochreBorder}`,
    color: T.ochreInk,
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  chipIcon: {
    display: 'inline-flex',
    color: T.ochreInk,
  },
  recentList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  recentRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.45rem 0.55rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(31,41,51,0.06)',
    borderRadius: 10,
  },
  recentLeft: {
    display: 'inline-flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    minWidth: 0,
    flex: 1,
  },
  recentIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: T.ochreSoft,
    color: T.ochreInk,
    border: `1px solid ${T.ochreBorder}`,
    flexShrink: 0,
  },
  recentBody: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  recentNoticed: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: T.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  recentMeta: {
    fontSize: '0.72rem',
    fontWeight: 600,
    color: T.inkDim,
    marginTop: 1,
  },
  metaDot: {
    opacity: 0.6,
  },
};
