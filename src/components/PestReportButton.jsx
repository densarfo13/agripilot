/**
 * PestReportButton — single-tap "I see a pest" button.
 *
 *   <PestReportButton
 *     farmId={currentFarmId}
 *     crop={cropCode}
 *     location={`${region}, ${country}`}
 *   />
 *
 * On tap:
 *   1. submitPestReport(...) writes to IDB + localStorage mirror
 *      and enqueues a PEST_REPORT outbox action.
 *   2. The button briefly flips to a confirmation state
 *      ("Reported - thank you") so the farmer knows it landed.
 *   3. speak() voices an acknowledgement for low-literacy users.
 *
 * Strict rules respected:
 *   * never crashes on missing props - all inputs coerced
 *   * works offline - submitPestReport is local-first
 *   * additive - mount it anywhere; nothing else changes
 *   * inline styles match the codebase
 */

import React, { useState } from 'react';
import { submitPestReport } from '../utils/pestReports.js';
import { speak } from '../core/farroway/voice.js';
import { tSafe } from '../i18n/tSafe.js';

export default function PestReportButton({
  farmId   = null,
  crop     = null,
  location = null,
  onReported = null,
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleTap() {
    if (busy) return;
    setBusy(true);
    try {
      const record = await submitPestReport({ farmId, crop, location });
      setDone(true);
      try { speak(tSafe('pest.report.thanks', 'Thank you. Pest report sent.')); }
      catch { /* swallow */ }
      // Auto-revert the confirmation state after a moment so the
      // button stays available for a second sighting later.
      setTimeout(() => { setDone(false); setBusy(false); }, 2200);
      if (typeof onReported === 'function') {
        try { onReported(record); }
        catch { /* never propagate from a click handler */ }
      }
    } catch {
      // Failures inside submitPestReport are swallowed at the
      // helper level; if we still landed here, just unlock the
      // button and let the user try again.
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={busy && !done}
      style={{ ...S.btn, ...(done ? S.btnDone : null), ...(busy && !done ? S.btnBusy : null) }}
      aria-busy={busy && !done}
      data-testid="pest-report-btn"
    >
      <span style={S.icon} aria-hidden="true">{done ? '\u2713' : '\uD83D\uDC1B'}</span>
      <span style={S.label}>
        {done
          ? tSafe('pest.report.done', 'Reported')
          : tSafe('pest.report.cta', 'Report pest')}
      </span>
    </button>
  );
}

const S = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.875rem 1rem',
    minHeight: '52px',
    borderRadius: '14px',
    border: '1px solid rgba(248,113,113,0.45)',
    background: 'linear-gradient(135deg, rgba(220,38,38,0.18) 0%, rgba(15,32,52,0.9) 100%)',
    color: '#FCA5A5',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
    transition: 'opacity 0.15s ease, background 0.15s ease',
  },
  btnBusy: { opacity: 0.7, cursor: 'wait' },
  btnDone: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(15,32,52,0.9) 100%)',
    border: '1px solid rgba(34,197,94,0.55)',
    color: '#86EFAC',
  },
  icon: { fontSize: '1.25rem', lineHeight: 1 },
  label: { letterSpacing: '0.01em' },
};
