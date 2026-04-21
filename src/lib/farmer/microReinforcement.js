/**
 * microReinforcement.js — one positive line to show right after a
 * farmer completes a task (spec §8 "Micro-reinforcement after
 * action").
 *
 *   getReinforcement({ task, streak, stage }) → {
 *     praiseKey, praise,            // "Good job — this keeps your farm on track."
 *     nextActionKey?, nextAction?,  // "Next: check soil moisture this evening"
 *   }
 *
 * Praise copy varies by streak tier so the reinforcement doesn't
 * feel scripted on day 30. Never praises for zero progress.
 */

const PRAISES = Object.freeze([
  // streak 1-2
  { key: 'farmer.reinforce.first',
    en:  'Good job \u2014 this keeps your farm on track.' },
  // streak 3-6
  { key: 'farmer.reinforce.building',
    en:  'Nice work \u2014 consistency helps reduce future loss.' },
  // streak 7+
  { key: 'farmer.reinforce.week_plus',
    en:  'Great streak \u2014 regular checks protect your yield.' },
]);

function praiseFor(streak) {
  const s = Number(streak) || 0;
  if (s >= 7) return PRAISES[2];
  if (s >= 3) return PRAISES[1];
  return PRAISES[0];
}

const NEXT_BY_STAGE = Object.freeze({
  land_prep:    { key: 'farmer.reinforce.next.land_prep',
                  en:  'Next: check soil condition before planting.' },
  planting:     { key: 'farmer.reinforce.next.planting',
                  en:  'Next: water gently after planting.' },
  early_growth: { key: 'farmer.reinforce.next.early_growth',
                  en:  'Next: inspect seedlings for pests.' },
  mid_growth:   { key: 'farmer.reinforce.next.mid_growth',
                  en:  'Next: check soil moisture this evening.' },
  harvest:      { key: 'farmer.reinforce.next.harvest',
                  en:  'Next: continue harvest while conditions are dry.' },
  post_harvest: { key: 'farmer.reinforce.next.post_harvest',
                  en:  'Next: inspect stored crop for moisture.' },
});

/**
 * getReinforcement — pure. Never returns null; the minimum output
 * is always a praise line so the CompletionBanner has something to
 * render even when task + stage data are missing.
 */
export function getReinforcement({ task = null, streak = 0, stage = null } = {}) {
  const praise = praiseFor(streak);
  const stageKey = String(stage || '').toLowerCase();
  const next = NEXT_BY_STAGE[stageKey] || null;

  const result = {
    praiseKey: praise.key,
    praise:    praise.en,
  };
  if (next) {
    result.nextActionKey = next.key;
    result.nextAction    = next.en;
  }
  // When the caller knows the completed task's id and has a
  // task-specific follow-up in their own map, they can append it;
  // this module stays stage-level so it's safe default.
  // eslint-disable-next-line no-unused-vars
  const _maybe = task;
  return Object.freeze(result);
}

export const _internal = Object.freeze({ PRAISES, praiseFor, NEXT_BY_STAGE });
