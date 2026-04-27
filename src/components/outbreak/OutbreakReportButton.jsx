/**
 * OutbreakReportButton — entry point for the report modal.
 *
 * Mounts a single, big, accessible button. Tapping it opens the
 * OutbreakReportModal pre-filled with farm context (crop +
 * country + region) so the report is captured in one place.
 *
 *   <OutbreakReportButton farm={currentFarm} farmerId={userId} />
 *
 * Strict-rule audit:
 *   * additive: nothing else has to change to mount this
 *   * works offline: the modal calls saveOutbreakReport which
 *     is local-first
 *   * tSafe for every visible label
 */

import React, { useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import OutbreakReportModal from './OutbreakReportModal.jsx';

export default function OutbreakReportButton({ farm = null, farmerId = null, onSaved = null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={S.btn}
        data-testid="outbreak-report-button"
      >
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDC1B'}</span>
        <span style={S.label}>
          {tSafe('outbreak.reportButton', 'Report pest or disease')}
        </span>
      </button>
      <OutbreakReportModal
        open={open}
        onClose={() => setOpen(false)}
        farm={farm}
        farmerId={farmerId}
        onSaved={onSaved}
      />
    </>
  );
}

const S = {
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.875rem 1rem',
    minHeight: '52px',
    borderRadius: '14px',
    border: '1px solid rgba(248,113,113,0.4)',
    background: 'linear-gradient(135deg, rgba(220,38,38,0.16) 0%, rgba(15,32,52,0.9) 100%)',
    color: '#FCA5A5',
    fontSize: '0.9375rem', fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  icon: { fontSize: '1.25rem', lineHeight: 1 },
  label: { letterSpacing: '0.01em' },
};
