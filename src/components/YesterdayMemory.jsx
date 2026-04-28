/**
 * YesterdayMemory — calm one-line recall of the farmer's most
 * recent action ("Yesterday you checked your farm").
 *
 *   <YesterdayMemory />
 *
 * Reads from memoryStore (the small persisted slot maintained
 * by markTaskDone). Renders nothing when:
 *   * memory is empty (first day on the app)
 *   * the last task was older than yesterday (the memory is
 *     stale; not surfacing a 4-day-old action keeps the
 *     retention copy honest, not nostalgic)
 *   * the last task was today (the dashboard already shows
 *     "X tasks done today" via ProgressBar; no double-count)
 *
 * Strict-rule audit
 *   * Read-only, no API calls, no side effects
 *   * Never throws — every read goes through the safe accessors
 *     in memoryStore
 *   * Supportive only: copy is "Yesterday you checked your
 *     farm" / "Yesterday you reported pests" — never "you
 *     missed", never a count of skipped days
 *   * tSafe friendly: every visible string has an English
 *     fallback that interpolates the task verb
 *   * Mobile-first: single line that wraps on phone width via
 *     overflowWrap
 */

import React, { useMemo } from 'react';
import { tSafe } from '../i18n/tSafe.js';
import { getLastTask, isYesterday } from '../retention/memoryStore.js';

const TASK_VERB_KEY = Object.freeze({
  prepare_rows:    { key: 'memory.task.prepareRows',
                     fb:  'prepared your rows' },
  weed_rows:       { key: 'memory.task.weedRows',
                     fb:  'cleared weeds from your rows' },
  scout_pests:     { key: 'memory.task.scoutPests',
                     fb:  'checked for pests' },
  check_moisture:  { key: 'memory.task.checkMoisture',
                     fb:  'checked soil moisture' },
  water_crops:     { key: 'memory.task.waterCrops',
                     fb:  'watered your crops' },
  fertilize:       { key: 'memory.task.fertilize',
                     fb:  'fertilised your crops' },
  prepare_harvest: { key: 'memory.task.prepareHarvest',
                     fb:  'prepared for harvest' },
  check_farm:      { key: 'memory.task.checkFarm',
                     fb:  'checked your farm' },
});

export default function YesterdayMemory() {
  const memory = useMemo(() => {
    try { return getLastTask(); }
    catch { return null; }
  }, []);

  if (!memory) return null;
  if (!isYesterday(memory.date)) return null;

  const verb = TASK_VERB_KEY[memory.taskId] || TASK_VERB_KEY.check_farm;
  const verbText = tSafe(verb.key, verb.fb);

  // Compose the line via tSafe so the {action} placeholder
  // can land in a locale-appropriate position. English fallback
  // interpolates inline when the dictionary is missing.
  const line = tSafe(
    'memory.yesterdayLine',
    `Yesterday you ${verbText}.`,
  ).replace(/\{action\}/g, verbText);

  return (
    <p
      style={S.line}
      role="status"
      aria-live="polite"
      data-testid="yesterday-memory"
    >
      <span style={S.icon} aria-hidden="true">{'\uD83D\uDCDC'}</span>
      <span style={S.text}>{line}</span>
    </p>
  );
}

const S = {
  line: {
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.78)',
    fontSize: '0.8125rem',
    overflowWrap: 'break-word',
  },
  icon: {
    fontSize: '0.9375rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    minWidth: 0,
    lineHeight: 1.4,
  },
};
