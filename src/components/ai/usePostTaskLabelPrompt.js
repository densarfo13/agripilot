/**
 * usePostTaskLabelPrompt — small React hook that decides
 * whether to show a LabelPromptModal after a task is marked
 * done.
 *
 *   const {
 *     promptOpen, promptKind, openPrompt, closePrompt,
 *   } = usePostTaskLabelPrompt({ farmId });
 *
 *   // when the user taps Done:
 *   openPrompt();
 *
 * Logic
 *   * Once per farm per local day at most.
 *   * 1-in-3 sampling so the farmer never feels nagged. Override
 *     via opts.probability for tests.
 *   * Alternates kind: pest first day, drought next day, etc.,
 *     so the trainer accumulates labels for both tasks. The
 *     alternation key is the YYYY-MM-DD UTC date so it's
 *     deterministic across tabs.
 *
 * Strict-rule audit
 *   * UI never blocks: the hook just toggles state; the modal is
 *     opt-in
 *   * works offline (saveLabel is local-first; nothing fetches)
 *   * never throws (every helper inside is defensive)
 */

import { useState, useCallback } from 'react';
import { hasPromptedToday } from '../../data/labels.js';
import { LABEL_KIND } from '../../data/labels.js';

function _utcDay() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function _kindForDay() {
  // Alternate by UTC day index. Even -> pest; odd -> drought.
  // Cheap deterministic alternation; no global state.
  try {
    const day = new Date();
    const index = Math.floor(Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
    ) / 86_400_000);
    return (index % 2 === 0) ? LABEL_KIND.PEST : LABEL_KIND.DROUGHT;
  } catch {
    return LABEL_KIND.PEST;
  }
}

export function usePostTaskLabelPrompt({
  farmId      = null,
  // v1.5 default: 1.0. The single-question LabelPrompt is fast
  // (<3s, one tap) so we want it to fire reliably on the first
  // task completion of each day. hasPromptedToday() still caps
  // at one prompt per farm per local day, so a farmer who
  // completes 5 tasks doesn't see 5 prompts.
  probability = 1.0,
} = {}) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptKind, setPromptKind] = useState(LABEL_KIND.PEST);

  const openPrompt = useCallback((opts = {}) => {
    if (!farmId) return false;

    // Spec: ask AT MOST once per day.
    try { if (hasPromptedToday(farmId)) return false; }
    catch { /* swallow - fail open */ }

    // Sampling: 1-in-3 by default. Tests can pass probability=1
    // to force the prompt.
    const p = Number.isFinite(Number(opts.probability))
      ? Number(opts.probability)
      : Number(probability);
    if (Math.random() > p) return false;

    setPromptKind(opts.kind || _kindForDay());
    setPromptOpen(true);
    return true;
  }, [farmId, probability]);

  const closePrompt = useCallback(() => {
    setPromptOpen(false);
  }, []);

  return { promptOpen, promptKind, openPrompt, closePrompt };
}

export default usePostTaskLabelPrompt;
