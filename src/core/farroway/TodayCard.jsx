/**
 * TodayCard — Farroway core "1 main task" UI (spec section 9).
 *
 * Receives a farm via props or reads it from the farmStore.
 * Renders:
 *   * a heading
 *   * the resolved main task (single line, no clutter)
 *   * one Done button that records progress + speaks praise
 *
 * Strict rules respected:
 *   * never crashes if farm / task is null - shows an "add farm" cue
 *   * 1 main task only (allTasks is computed but not surfaced here)
 *   * works offline - everything is local
 *
 * i18n: visible labels go through tSafe so a missing translation
 * falls back to the spec's English literal. Adding Hindi / French
 * etc. for these keys is an overlay-only change later.
 */

import React from 'react';
import { generateDailyTask } from './taskEngine.js';
import { getTaskMessage } from './taskMessages.js';
import { markTaskDone } from './progressStore.js';
import { speak } from './voice.js';
import { getCurrentFarm } from './farmStore.js';
import { tSafe } from '../../i18n/tSafe.js';

export default function TodayCard({ farm: farmProp = null, onDone = null }) {
  const farm = farmProp || getCurrentFarm();
  const data = generateDailyTask(farm);

  if (!data) {
    return (
      <div style={S.card} data-testid="farroway-today-card-empty">
        <h2 style={S.h2}>{tSafe('farroway.today.title', 'Today')}</h2>
        <p style={S.empty}>
          {tSafe('farroway.today.addFarm', 'Add a farm to see today\u2019s task.')}
        </p>
      </div>
    );
  }

  const taskId = data.mainTask;
  const message = getTaskMessage(taskId);

  function handleDone() {
    markTaskDone(taskId);
    speak(tSafe('farroway.today.praise', 'Good job'));
    if (typeof onDone === 'function') {
      try { onDone(taskId, data); }
      catch { /* never propagate from a click handler */ }
    }
  }

  return (
    <div style={S.card} data-testid="farroway-today-card">
      <span style={S.kicker}>{tSafe('farroway.today.title', 'Today')}</span>
      <h1 style={S.h1} data-testid="farroway-today-task">{message}</h1>
      <button
        type="button"
        onClick={handleDone}
        style={S.btn}
        data-testid="farroway-today-done"
      >
        {tSafe('farroway.today.done', 'Done')}
      </button>
    </div>
  );
}

const S = {
  card: {
    background: 'rgba(15, 32, 52, 0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '1.25rem 1.25rem 1.5rem',
    color: '#EAF2FF',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    boxShadow: '0 10px 30px rgba(0,0,0,0.28)',
  },
  kicker: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9FB3C8',
  },
  h1: {
    fontSize: '1.375rem',
    fontWeight: 800,
    color: '#F8FAFC',
    margin: 0,
    lineHeight: 1.25,
  },
  h2: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#E2E8F0',
    margin: 0,
  },
  empty: {
    fontSize: '0.9375rem',
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
    lineHeight: 1.5,
  },
  btn: {
    marginTop: '0.5rem',
    padding: '0.875rem 1rem',
    borderRadius: '14px',
    border: 'none',
    background: '#22C55E',
    color: '#fff',
    fontSize: '1rem',
    fontWeight: 800,
    cursor: 'pointer',
    minHeight: '52px',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 6px 18px rgba(34,197,94,0.18)',
  },
};
