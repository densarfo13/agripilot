/**
 * RoiPanel — single-card ROI surface for NGO sales conversations.
 *
 *   <RoiPanel />
 *
 * Three big numbers + an elevator line + two download buttons.
 * Designed to be readable in <10 seconds:
 *
 *   ┌─ This week ───────────────────────────────┐
 *   │   65%       4         12                  │
 *   │ completion  checks    reports             │
 *   │  rate       /week     /week               │
 *   │                                           │
 *   │ Farmers using Farroway are checking       │
 *   │ crops more often AND identifying risks    │
 *   │ earlier.                                   │
 *   │                                           │
 *   │  [Download report]  [JSON]                 │
 *   └───────────────────────────────────────────┘
 *
 * Strict-rule audit
 *   * 3 numbers + 1 sentence: <10 seconds to read
 *   * works with limited data: zero-state highlights stay
 *     usable ("0%", "0", "0") + the elevator line shifts to
 *     the "collecting data" variant
 *   * no external data: composes the local ROI summary
 *   * tSafe + getCropLabelSafe are not needed here (no
 *     crop-specific text); every label routed through tSafe
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tSafe } from '../../i18n/tSafe.js';
import { buildROISummary } from '../../ngo/roiSummary.js';
import { downloadReportText, downloadReportJson } from '../../ngo/exportReport.js';

export default function RoiPanel({ windowDays = 7 }) {
  const { t } = useTranslation();
  const summary = useMemo(() => buildROISummary({ windowDays }), [windowDays]);

  const [busy, setBusy] = useState(false);
  function handleDownload(kind) {
    setBusy(true);
    try {
      if (kind === 'json') downloadReportJson({ summary, t });
      else                 downloadReportText({ summary, t });
    } finally {
      setTimeout(() => setBusy(false), 400);
    }
  }

  return (
    <section style={S.card} data-testid="ngo-roi-panel">
      <header style={S.header}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDCC8'}</span>
        <div style={S.headerText}>
          <h2 style={S.h2}>{tSafe('roi.title', 'Programme impact')}</h2>
          <p style={S.sub}>
            {tSafe('roi.window.thisWeek', `Last ${summary.windowDays} days`)
              .replace('{n}', String(summary.windowDays))}
          </p>
        </div>
      </header>

      <div style={S.grid} data-testid="ngo-roi-grid">
        {summary.highlights.map((h, i) => (
          <div key={h.labelKey || i} style={S.tile}>
            <strong style={S.tileValue}>{h.value}</strong>
            <span style={S.tileLabel}>
              {tSafe(h.labelKey, h.label)}
            </span>
          </div>
        ))}
      </div>

      <p style={S.message} data-testid="ngo-roi-message">
        {tSafe(summary.message.key, summary.message.fallback)}
      </p>

      <div style={S.actions}>
        <button type="button"
          onClick={() => handleDownload('text')}
          disabled={busy}
          style={S.primaryBtn}
          data-testid="ngo-roi-download-text"
        >
          {tSafe('roi.download.text', 'Download report')}
        </button>
        <button type="button"
          onClick={() => handleDownload('json')}
          disabled={busy}
          style={S.secondaryBtn}
          data-testid="ngo-roi-download-json"
        >
          {tSafe('roi.download.json', 'JSON')}
        </button>
      </div>
    </section>
  );
}

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(15,32,52,0.92) 100%)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: '20px',
    padding: '1rem 1.125rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
  },
  header: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  icon: { fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 },
  headerText: { flex: 1, minWidth: 0 },
  h2: { margin: 0, fontSize: '1rem', fontWeight: 800, color: '#EAF2FF' },
  sub: {
    margin: '0.125rem 0 0',
    fontSize: '0.8125rem',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 1.4,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
    gap: '0.625rem',
  },
  tile: {
    background: 'rgba(15, 32, 52, 0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '0.75rem 0.625rem',
    minHeight: '88px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '0.25rem',
  },
  tileValue: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#86EFAC',
    lineHeight: 1.1,
  },
  tileLabel: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.3,
  },

  message: {
    margin: 0,
    fontSize: '0.9375rem',
    color: '#EAF2FF',
    lineHeight: 1.5,
  },

  actions: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  primaryBtn: {
    padding: '0.625rem 0.875rem',
    minHeight: '44px',
    borderRadius: '12px',
    border: '1px solid rgba(34,197,94,0.55)',
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: '0.875rem',
    fontWeight: 800,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  secondaryBtn: {
    padding: '0.625rem 0.875rem',
    minHeight: '44px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'transparent',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '0.875rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
