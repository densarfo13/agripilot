/**
 * RecoveryCard — gentle "welcome back" surface that takes over
 * Today when the missed-day detector says we should.
 *
 *   <RecoveryCard
 *     missedDays={3}
 *     onDone={(taskId) => ...}
 *     onListen={() => ...}
 *   />
 *
 * Layout (top -> bottom):
 *   1. 👋  Welcome back kicker
 *   2. supportive message              recovery.message
 *   3. one recovery task header        tasks.checkFarm.title
 *      + reason line                    tasks.checkFarm.why
 *   4. Listen + Done buttons
 *   5. After Done: "New start today"   recovery.newStart
 *
 * Strict-rule audit
 *   * does NOT shame: copy is supportive ("welcome back",
 *     "let's get back on track", "new start today")
 *   * voice-friendly: Listen button always available; auto
 *     speech fires AT MOST once per local day via a
 *     localStorage ledger
 *   * offline-safe: every read / write is local
 *   * uses existing tSafe + Farroway core voice helper
 *   * keys + fallback strings come from tSafe so a missing
 *     translation falls back to English without leaking the
 *     dotted key
 */

import React, { useEffect, useState } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { speak } from '../core/farroway/voice.js';

const VOICE_LEDGER_KEY = 'farroway_recovery_voice_fired';

function _today() { return new Date().toDateString(); }

function _hasFiredVoiceToday() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(VOICE_LEDGER_KEY) === _today();
  } catch { return false; }
}

function _markVoiceFired() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(VOICE_LEDGER_KEY, _today());
  } catch { /* swallow */ }
}

/**
 * RECOVERY_TASK_ID is a stable string the caller can pass to
 * markTaskDone so the streak engine + event log + outcomes
 * mirror all see the same task id for the recovery
 * completion. The string is intentionally one of the
 * Farroway core taskMessages map's keys so the voice helper
 * speaks a real sentence even when no translation is wired.
 */
export const RECOVERY_TASK_ID = 'check_farm';

export default function RecoveryCard({
  missedDays = 0,
  onListen   = null,
  onDone     = null,
}) {
  const [busy, setBusy]       = useState(false);
  const [success, setSuccess] = useState(false);

  // One-shot voice on first surface in the day.
  useEffect(() => {
    if (success) return;
    if (_hasFiredVoiceToday()) return;
    const msg = tSafe('recovery.voice',
      'Welcome back. Check your farm today.');
    try { speak(msg); }
    catch { /* swallow */ }
    _markVoiceFired();
  }, [success]);

  function handleListen() {
    const msg = tSafe('recovery.voice',
      'Welcome back. Check your farm today.');
    try { speak(msg); } catch { /* swallow */ }
    if (typeof onListen === 'function') {
      try { onListen(); } catch { /* never propagate */ }
    }
  }

  function handleDone() {
    if (busy) return;
    setBusy(true);
    try {
      if (typeof onDone === 'function') onDone(RECOVERY_TASK_ID);
    } catch { /* swallow - never block the success state */ }
    setSuccess(true);
    setBusy(false);
  }

  return (
    <section style={S.card} data-testid="recovery-card">
      <div style={S.kickerRow}>
        <span style={S.icon} aria-hidden="true">{'\uD83D\uDC4B'}</span>
        <span style={S.kicker}>
          {tSafe('recovery.title', 'Welcome back')}
        </span>
      </div>

      <p style={S.message} data-testid="recovery-message">
        {tSafe('recovery.message',
          'You missed a few days. Let\u2019s get back on track.')}
      </p>

      <div style={S.taskBlock}>
        <h2 style={S.taskTitle} data-testid="recovery-task-title">
          {tSafe('tasks.checkFarm.title', 'Check your farm today')}
        </h2>
        <p style={S.taskWhy} data-testid="recovery-task-why">
          {tSafe('tasks.checkFarm.why',
            'A quick walk through your field gets you back on track.')}
        </p>
      </div>

      <div style={S.actions}>
        <button
          type="button"
          onClick={handleListen}
          style={S.listenBtn}
          aria-label={tSafe('recovery.listen', 'Listen')}
          data-testid="recovery-listen"
        >
          <span style={S.btnIcon} aria-hidden="true">{'\uD83D\uDD0A'}</span>
          <span>{tSafe('recovery.listen', 'Listen')}</span>
        </button>
        <button
          type="button"
          onClick={handleDone}
          disabled={busy}
          style={{ ...S.doneBtn, ...(busy ? S.btnBusy : null) }}
          data-testid="recovery-done"
        >
          <span style={S.btnIcon} aria-hidden="true">{'\u2705'}</span>
          <span>{tSafe('today.done', 'Done')}</span>
        </button>
      </div>

      {success && (
        <div style={S.newStart} role="status" aria-live="polite"
             data-testid="recovery-new-start">
          <span style={S.newStartIcon} aria-hidden="true">{'\uD83C\uDF31'}</span>
          <span>
            {tSafe('recovery.newStart', 'New start today')}
          </span>
        </div>
      )}

      {/*
        We deliberately do NOT render the missedDays count to the
        farmer. The detector exposes it so analytics surfaces +
        NGO panels can use it; the farmer-facing copy stays
        supportive.
      */}
      <span hidden aria-hidden="true">{missedDays}</span>
    </section>
  );
}

const S = {
  card: {
    background: 'linear-gradient(135deg, rgba(34,197,94,0.14) 0%, rgba(15,32,52,0.92) 100%)',
    border: '1px solid rgba(34,197,94,0.40)',
    borderRadius: '20px',
    padding: '1.25rem 1.25rem 1.5rem',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxShadow: '0 12px 32px rgba(0,0,0,0.30)',
  },
  kickerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  icon: { fontSize: '1.75rem', lineHeight: 1 },
  kicker: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#86EFAC',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  message: {
    margin: 0,
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
  taskBlock: {
    background: 'rgba(15, 32, 52, 0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '0.875rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  taskTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 800,
    color: '#FFFFFF',
    lineHeight: 1.25,
  },
  taskWhy: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 1.4,
  },
  actions: {
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
  },
  btnBusy: { opacity: 0.7, cursor: 'wait' },
  btnIcon: { fontSize: '1.25rem', lineHeight: 1 },

  newStart: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    borderRadius: '12px',
    background: 'rgba(34,197,94,0.16)',
    border: '1px solid rgba(34,197,94,0.45)',
    color: '#86EFAC',
    fontSize: '0.9375rem',
    fontWeight: 700,
  },
  newStartIcon: { fontSize: '1.125rem', lineHeight: 1 },
};
