/**
 * voiceReward.js — short, encouraging speech after a task completes.
 *
 * Wraps the existing Farroway core `speak()` helper with an i18n
 * fallback so the praise comes out in the active UI language when
 * a translation is available, and English ("Good job!") when not.
 *
 * Strict rules respected:
 *   * lightweight  - no animation libs, no audio assets, just the
 *                    browser's speechSynthesis API
 *   * works offline- speechSynthesis is local
 *   * never throws - the underlying speak() helper swallows errors
 *
 * Call sites
 *   * Farroway core TodayCard already speaks `farroway.today.praise`
 *     - keep that as the canonical "task done" speak.
 *   * `speakReward(label?)` lets ad-hoc callers (e.g. a future
 *     gamification card) speak a richer message such as the streak
 *     count.
 */

import { speak } from '../core/farroway/voice.js';
import { tSafe } from '../i18n/tSafe.js';

const PRAISE_KEY      = 'farroway.reward.praise';
const PRAISE_FALLBACK = 'Good job! You are making progress';

/**
 * Speak a short praise line. Optional `extra` string is appended
 * (e.g. "5 day streak") so the same helper can also voice the
 * streak count without duplicating the speak() plumbing.
 */
export function speakReward(extra = '') {
  const base = tSafe(PRAISE_KEY, PRAISE_FALLBACK);
  const message = extra && String(extra).trim()
    ? `${base}. ${String(extra).trim()}`
    : base;
  try { speak(message); }
  catch { /* speak itself swallows; keep belt + braces */ }
}

export const _internal = Object.freeze({ PRAISE_KEY, PRAISE_FALLBACK });
