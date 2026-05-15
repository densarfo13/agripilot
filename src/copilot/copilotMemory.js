/**
 * copilotMemory.js — cross-session memory for the Farm Copilot Beta.
 *
 *   import {
 *     readCopilotMemory, recordTurn, recordRecommendation,
 *     summariseMemory, clearCopilotMemory,
 *   } from 'src/copilot/copilotMemory.js';
 *
 * What it stores (spec §7)
 *   • turns — the recent question/answer pairs, so a farmer who
 *     re-opens the copilot tomorrow still sees the conversation.
 *   • recs  — which copilot recommendations were accepted vs
 *     ignored, so the surface can learn what the farmer acts on.
 *
 * Bounded by design (spec §15)
 *   Both lists are hard-capped (MAX_TURNS / MAX_RECS). Memory can
 *   never bloat localStorage or slow the sheet's first paint.
 *
 * Strict-rule audit
 *   • localStorage-backed, every access guarded — SSR-safe, never
 *     throws (quota / private-mode / disabled storage all tolerated).
 *   • No PII beyond the farmer's own typed questions, which already
 *     live in the app. No tokens, no scan bytes.
 *   • Pure data module — no React, no network.
 */

const STORAGE_KEY = 'farroway_copilot_memory_v1';

// Hard caps — bound storage + the sheet's restore cost.
const MAX_TURNS = 20;
const MAX_RECS  = 30;

const EMPTY = Object.freeze({ turns: [], recs: [] });

function _read() {
  try {
    if (typeof localStorage === 'undefined') return { turns: [], recs: [] };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { turns: [], recs: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { turns: [], recs: [] };
    return {
      turns: Array.isArray(parsed.turns) ? parsed.turns : [],
      recs:  Array.isArray(parsed.recs)  ? parsed.recs  : [],
    };
  } catch {
    return { turns: [], recs: [] };
  }
}

function _write(state) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      turns: (state.turns || []).slice(-MAX_TURNS),
      recs:  (state.recs  || []).slice(-MAX_RECS),
    }));
    return true;
  } catch {
    return false; // quota / private mode — non-fatal
  }
}

/** The persisted memory: { turns, recs }. Never null, never throws. */
export function readCopilotMemory() {
  return _read();
}

/**
 * Append one question/answer turn. Returns the capped turns array.
 *
 * @param {{question:string, answer:string, intent?:string}} turn
 */
export function recordTurn(turn) {
  try {
    if (!turn || typeof turn !== 'object') return _read().turns;
    const state = _read();
    state.turns.push({
      question: String(turn.question || ''),
      answer:   String(turn.answer || ''),
      intent:   turn.intent ? String(turn.intent) : 'unknown',
      at:       Date.now(),
    });
    state.turns = state.turns.slice(-MAX_TURNS);
    _write(state);
    return state.turns;
  } catch {
    return [];
  }
}

/**
 * Record whether a copilot recommendation was accepted or ignored.
 *
 * @param {{intent?:string, accepted:boolean}} rec
 */
export function recordRecommendation(rec) {
  try {
    if (!rec || typeof rec !== 'object') return _read().recs;
    const state = _read();
    state.recs.push({
      intent:   rec.intent ? String(rec.intent) : 'unknown',
      accepted: !!rec.accepted,
      at:       Date.now(),
    });
    state.recs = state.recs.slice(-MAX_RECS);
    _write(state);
    return state.recs;
  } catch {
    return [];
  }
}

/**
 * A compact, influence-ready summary of what the farmer has done.
 * Surfaces (a) which intents recur — the "repeated issues" signal,
 * (b) how often recommendations are accepted vs ignored.
 *
 * @returns {{
 *   turnCount:number, acceptedCount:number, ignoredCount:number,
 *   repeatedIntents:string[], lastIntent:?string
 * }}
 */
export function summariseMemory() {
  try {
    const { turns, recs } = _read();
    const counts = {};
    for (const t of turns) {
      const i = (t && t.intent) || 'unknown';
      counts[i] = (counts[i] || 0) + 1;
    }
    const repeatedIntents = Object.keys(counts)
      .filter((i) => i !== 'unknown' && counts[i] >= 2)
      .sort((a, b) => counts[b] - counts[a]);
    let acceptedCount = 0;
    let ignoredCount = 0;
    for (const r of recs) {
      if (r && r.accepted) acceptedCount += 1;
      else ignoredCount += 1;
    }
    return {
      turnCount:       turns.length,
      acceptedCount,
      ignoredCount,
      repeatedIntents,
      lastIntent:      turns.length ? (turns[turns.length - 1].intent || null) : null,
    };
  } catch {
    return {
      turnCount: 0, acceptedCount: 0, ignoredCount: 0,
      repeatedIntents: [], lastIntent: null,
    };
  }
}

/** Wipe all copilot memory. Used by the sheet's "clear" control. */
export function clearCopilotMemory() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch { /* swallow */ }
}

export const COPILOT_MEMORY_LIMITS = Object.freeze({ MAX_TURNS, MAX_RECS });

const _module = {
  readCopilotMemory,
  recordTurn,
  recordRecommendation,
  summariseMemory,
  clearCopilotMemory,
  COPILOT_MEMORY_LIMITS,
  EMPTY,
};
export default _module;
