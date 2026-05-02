/**
 * TaskCompletionToast — small celebratory toast that appears
 * for ~2 seconds after the user marks a task done (retention
 * spec §7).
 *
 *   <TaskCompletionToast
 *     visible={celebrate}
 *     streakCount={getStreak()}
 *     onDismiss={() => setCelebrate(false)}
 *   />
 *
 * Visual
 *   * Bottom-anchored card with safe-area-inset-bottom.
 *   * Lightweight slide-up animation (CSS only — no library).
 *   * Auto-dismisses after 1800ms; tap to dismiss early.
 *
 * Strict-rule audit
 *   * All visible text via tStrict.
 *   * Inline styles only.
 *   * Never throws.
 *   * Renders null when not visible.
 *   * Subscribes to language changes via useTranslation so the
 *     copy refreshes if the user flips lang while the toast is
 *     animating.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { tStrict } from '../../i18n/strictT.js';

const C = {
  green:  '#22C55E',
  ink:    '#062714',
  inkAlt: 'rgba(6,39,20,0.75)',
};

const S = {
  wrap: {
    position:   'fixed',
    left:       0,
    right:      0,
    bottom:     'calc(env(safe-area-inset-bottom, 0px) + 84px)', // above bottom nav
    display:    'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex:     1200,
    padding:    '0 16px',
  },
  card: {
    pointerEvents: 'auto',
    background:    C.green,
    color:         C.ink,
    borderRadius:  16,
    padding:       '12px 18px',
    minWidth:      220,
    maxWidth:      400,
    display:       'flex',
    flexDirection: 'column',
    gap:           4,
    boxShadow:     '0 12px 32px rgba(34,197,94,0.40)',
    animation:     'farroway-toast-up 220ms ease-out',
    cursor:        'pointer',
  },
  title:  { margin: 0, fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' },
  body:   { margin: 0, fontSize: 13, fontWeight: 600, color: C.inkAlt, lineHeight: 1.4 },
  streak: {
    margin:     '4px 0 0',
    fontSize:   12,
    fontWeight: 800,
    color:      C.ink,
  },
};

// One-time keyframe injection so the slide-up doesn't need a CSS
// build step. Idempotent — safe to re-run.
const KEYFRAME_ID = 'farroway-task-completion-toast-keyframes';
function _ensureKeyframes() {
  try {
    if (typeof document === 'undefined') return;
    if (document.getElementById(KEYFRAME_ID)) return;
    const style = document.createElement('style');
    style.id = KEYFRAME_ID;
    style.textContent = '@keyframes farroway-toast-up { '
      + 'from { transform: translateY(24px); opacity: 0; } '
      + 'to   { transform: translateY(0);     opacity: 1; } '
      + '}';
    document.head.appendChild(style);
  } catch { /* swallow */ }
}

export default function TaskCompletionToast({
  visible,
  streakCount,
  onDismiss,
  message,        // optional override
}) {
  useTranslation();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }
    _ensureKeyframes();
    timerRef.current = setTimeout(() => {
      try { onDismiss && onDismiss(); } catch { /* swallow */ }
    }, 1800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  const title = tStrict('task.complete.toast.title', 'Nice work \uD83C\uDF31');
  const body = message
    || tStrict('task.complete.toast.body', 'You\u2019re keeping your plant healthy');

  return (
    <div style={S.wrap} aria-live="polite" data-testid="task-completion-toast">
      <button
        type="button"
        onClick={() => { try { onDismiss && onDismiss(); } catch { /* swallow */ } }}
        style={S.card}
        data-testid="task-completion-toast-card"
      >
        <h3 style={S.title}>{title}</h3>
        <p style={S.body}>{body}</p>
        {Number.isFinite(streakCount) && streakCount > 0 ? (
          <span style={S.streak} data-testid="task-completion-toast-streak">
            {tStrict('task.complete.toast.streak',
              '\uD83D\uDD25 {n}-day streak').replace('{n}', String(streakCount))}
          </span>
        ) : null}
      </button>
    </div>
  );
}
