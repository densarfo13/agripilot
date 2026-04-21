/**
 * ReportExportButton — small button that triggers a CSV download
 * of the farmer export. Uses the offline analytics pipeline
 * (src/lib/ngo/analytics.js → getExportData) so it works without
 * hitting the backend.
 *
 *   <ReportExportButton
 *     program="pilot_2026"          // optional — null = all farms
 *     filename="farroway-farmers.csv"
 *     streak={5}                     // farmer's global streak
 *     label="Download CSV"
 *   />
 *
 * Integrates into any reports/dashboard screen. The button is
 * disabled while the browser spawns the download to avoid a
 * double-tap producing two files.
 */

import { useState } from 'react';
import { useAppSettings } from '../context/AppSettingsContext.jsx';
import { getExportData } from '../lib/ngo/analytics.js';
import { downloadCsv } from '../lib/ngo/downloadCsv.js';

export default function ReportExportButton({
  program = null,
  filename = 'farroway-farmers.csv',
  streak = 0,
  label,
  disabled = false,
}) {
  const { t } = useAppSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function handleClick() {
    if (busy || disabled) return;
    setBusy(true); setError(null);
    try {
      const csv = getExportData(program, { streak });
      const ok = downloadCsv({ filename, csv });
      if (!ok) setError(t('reports.export.unavailable') || 'Download not available here');
    } catch (e) {
      setError(t('reports.export.failed') || 'Export failed. Try again.');
    } finally {
      // Short grace period so double-tap is absorbed.
      setTimeout(() => setBusy(false), 300);
    }
  }

  const btnLabel = label
    || t('reports.export.csv')
    || 'Download CSV';

  return (
    <div style={S.wrap}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        style={{ ...S.btn, ...(busy || disabled ? S.btnBusy : null) }}
        data-testid="report-export-csv"
      >
        {busy ? (t('common.saving') || 'Saving…') : btnLabel}
      </button>
      {error && (
        <span style={S.err} data-testid="report-export-error">{error}</span>
      )}
    </div>
  );
}

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  btn: {
    padding: '0.5rem 0.875rem', borderRadius: 10,
    border: '1px solid rgba(34,197,94,0.28)',
    background: 'rgba(34,197,94,0.08)', color: '#22C55E',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  btnBusy: { opacity: 0.6, cursor: 'wait' },
  err: { color: '#FCA5A5', fontSize: 12 },
};
