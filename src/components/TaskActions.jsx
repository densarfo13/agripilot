/**
 * TaskActions — two big icon-first buttons under the main task
 * card: Listen (voice) + Done.
 *
 *   <TaskActions onListen={...} onDone={...} busy={busy} />
 *
 * Strict-rule audit
 *   * low literacy: emoji-first; text label is the secondary
 *     element + still translatable via tSafe
 *   * no typing
 *   * minimum 56px tall buttons - thumb-friendly
 *   * Listen sits LEFT of Done so a right-handed thumb
 *     hits Done first by reach
 */

import React from 'react';
import { tSafe } from '../i18n/tSafe.js';

export default function TaskActions({
  onListen = null,
  onDone   = null,
  busy     = false,
}) {
  return (
    <div style={S.row} data-testid="task-actions">
      <button
        type="button"
        onClick={onListen}
        style={S.listenBtn}
        disabled={busy}
        aria-label={tSafe('today.listen', 'Listen')}
        data-testid="task-actions-listen"
      >
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDD0A'}</span>
        <span style={S.label}>{tSafe('today.listen', 'Listen')}</span>
      </button>
      <button
        type="button"
        onClick={onDone}
        style={{ ...S.doneBtn, ...(busy ? S.btnBusy : null) }}
        disabled={busy}
        aria-label={tSafe('today.doneNow', 'Done now')}
        data-testid="task-actions-done"
      >
        <span style={S.icon} aria-hidden="true">{'\u2705'}</span>
        <span style={S.label}>{tSafe('today.doneNow', 'Done now')}</span>
      </button>
    </div>
  );
}

const S = {
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(96px, 0.7fr) 1.3fr',
    gap: '0.625rem',
  },
  listenBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    minHeight: '60px',
    padding: '0.75rem 0.875rem',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.06)',
    color: '#EAF2FF',
    fontSize: '0.9375rem',
    fontWeight: 700,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  doneBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    minHeight: '60px',
    padding: '0.75rem 1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#0B1D34',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.18)',
    WebkitTapHighlightColor: 'transparent',
    transition: 'opacity 0.15s ease',
  },
  btnBusy: { opacity: 0.7, cursor: 'wait' },
  icon: { fontSize: '1.25rem', lineHeight: 1 },
  label: { letterSpacing: '0.01em' },
};
