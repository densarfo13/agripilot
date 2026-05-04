/**
 * GlobalToastHost — single-mount-point renderer for the
 * module-singleton toast queue from `src/lib/globalToast.js`.
 *
 *   <GlobalToastHost />   // mounted ONCE in App.jsx
 *
 *   // From anywhere (React or non-React):
 *   import { showToast } from '../../lib/globalToast.js';
 *   showToast('Saved!', 'success');
 *
 * Why a host vs per-component
 *   `useToast` from intelligence/Toast.jsx is per-instance.
 *   This host pairs with the module-singleton store so a
 *   non-React caller (e.g. taskActions.completeTask) can
 *   trigger toasts without owning a component handle.
 *
 * Layout
 *   Bottom-centre stack. Each toast slides in, holds for the
 *   default duration, then dismisses itself. Stack capped at 3
 *   in the store.
 *
 * Strict-rule audit
 *   • Pure presentational. No fetches, no side-effects beyond
 *     subscribing to the toast store.
 *   • Inline styles only.
 *   • Animations respect prefers-reduced-motion via the global
 *     stylesheet's `.farroway-fade-in` rule.
 */

import React from 'react';
import { useGlobalToasts, dismissToast } from '../../lib/globalToast.js';

const TYPE_STYLES = Object.freeze({
  success: {
    background: 'rgba(34,197,94,0.18)',
    border:     '1px solid rgba(34,197,94,0.35)',
    color:      '#86EFAC',
    icon:       '\u2713',
  },
  error: {
    background: 'rgba(239,68,68,0.18)',
    border:     '1px solid rgba(239,68,68,0.35)',
    color:      '#FCA5A5',
    icon:       '\u2717',
  },
  warning: {
    background: 'rgba(251,191,36,0.18)',
    border:     '1px solid rgba(251,191,36,0.35)',
    color:      '#FCD34D',
    icon:       '\u26A0',
  },
  info: {
    background: 'rgba(59,130,246,0.18)',
    border:     '1px solid rgba(59,130,246,0.35)',
    color:      '#BFDBFE',
    icon:       '\u2139',
  },
});

export default function GlobalToastHost() {
  const queue = useGlobalToasts();
  if (!queue || queue.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={S.host}
      data-testid="global-toast-host"
    >
      {queue.map((t) => {
        const style = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => dismissToast(t.id)}
            style={{
              ...S.toast,
              background: style.background,
              border:     style.border,
              color:      style.color,
            }}
            data-testid={`toast-${t.type}`}
            data-toast-id={t.id}
          >
            <span aria-hidden="true" style={S.icon}>{style.icon}</span>
            <span style={S.message}>{String(t.message || '')}</span>
          </button>
        );
      })}
    </div>
  );
}

const S = {
  host: {
    position:       'fixed',
    bottom:         88,
    left:           0,
    right:          0,
    zIndex:         70,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    gap:            8,
    pointerEvents:  'none',
    padding:        '0 16px',
  },
  toast: {
    pointerEvents:  'auto',
    display:        'inline-flex',
    alignItems:     'center',
    gap:            10,
    padding:        '10px 16px',
    borderRadius:   999,
    fontSize:       14,
    fontWeight:     700,
    cursor:         'pointer',
    boxShadow:      '0 10px 28px rgba(0,0,0,0.35)',
    maxWidth:       '90vw',
    animation:      'farroway-fade-in 0.22s ease-out',
  },
  icon: {
    fontSize:   16,
    lineHeight: 1,
    flexShrink: 0,
  },
  message: {
    whiteSpace:   'nowrap',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
  },
};
