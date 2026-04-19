/**
 * TransitionScreen — ~1s bridge between crop selection and
 * the first Home render. Two lines animate in sequence:
 *
 *   "Starting your farm…"
 *   "Preparing your first task…"
 *
 * The screen calls `onComplete` once both lines have shown
 * (default 900ms total) so the orchestrator can navigate to
 * Home. Never blocks — if the farm is already created, the
 * transition is purely cosmetic.
 */

import { useEffect, useState } from 'react';

const resolve = (t, key, fallback) => {
  if (typeof t !== 'function' || !key) return fallback;
  const v = t(key);
  return v && v !== key ? v : fallback;
};

const STARTING_MS = 450;
const PREPARING_MS = 450;

export default function TransitionScreen({
  t = null,
  onComplete = null,
  durationMs = null,   // optional override
  className = '',
}) {
  const [phase, setPhase] = useState('starting');

  const totalMs = Number.isFinite(durationMs)
    ? Math.max(200, durationMs)
    : STARTING_MS + PREPARING_MS;
  const firstSlice = Math.floor(totalMs / 2);
  const startingMsg  = resolve(t, 'fast_onboarding.transition.starting',  'Starting your farm…');
  const preparingMsg = resolve(t, 'fast_onboarding.transition.preparing', 'Preparing your first task…');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('preparing'), firstSlice);
    const t2 = setTimeout(() => onComplete && onComplete(), totalMs);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalMs, firstSlice]);

  return (
    <main
      className={`fast-transition ${className}`.trim()}
      data-step="transition"
      data-phase={phase}
      aria-live="polite"
      style={wrap}
    >
      <div style={{ display: 'flex', flexDirection: 'column',
                     alignItems: 'center', gap: 20 }}>
        <div style={spinner} aria-hidden="true" />
        <p style={line}>
          {phase === 'starting' ? startingMsg : preparingMsg}
        </p>
      </div>
    </main>
  );
}

const wrap = { maxWidth: 520, margin: '0 auto', minHeight: '100vh',
               padding: '32px 20px', display: 'flex',
               alignItems: 'center', justifyContent: 'center' };
const spinner = {
  width: 42, height: 42, borderRadius: '50%',
  border: '3px solid #c8e6c9', borderTopColor: '#1b5e20',
  animation: 'fast-spin 700ms linear infinite',
};
const line = { margin: 0, color: '#263238', fontSize: 16, fontWeight: 600 };

// Inject the keyframes once (safe no-op in SSR).
if (typeof document !== 'undefined' && !document.getElementById('fast-spin-style')) {
  const style = document.createElement('style');
  style.id = 'fast-spin-style';
  style.textContent = '@keyframes fast-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
