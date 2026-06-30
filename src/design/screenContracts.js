/**
 * screenContracts.js — the Screen Governor's source of truth. Every core farmer screen MUST
 * declare its contract here: what it is for, the one question it answers, its single primary
 * action, and what "success" looks like. A screen with no contract is rejected by
 * `check-screen-contract.mjs` (Design Bible §SCREEN GOVERNOR — "if missing, fail build").
 *
 * This keeps the one-purpose / one-question / one-CTA discipline auditable in ONE place instead
 * of scattered across 1500-line screen files. SCREEN_ARCHITECTURE.md / SCREEN_STANDARDS.md
 * document the rationale; this file is the machine-checkable contract.
 */
export const SCREEN_CONTRACTS = Object.freeze({
  home: {
    purpose: 'Tell the farmer the single most important thing to do today.',
    question: 'What should I do today?',
    primaryCTA: 'Today’s priority action (DecisionHero)',
    success: 'Farmer sees one clear action and acts on it.',
  },
  myFarm: {
    purpose: 'Show the overall health of the farm at a glance.',
    question: 'How is my farm doing?',
    primaryCTA: 'The next farm action',
    success: 'Farmer understands their farm’s status without reading numbers twice.',
  },
  tasks: {
    purpose: 'Surface the next thing to complete.',
    question: 'What should I complete next?',
    primaryCTA: 'Complete / Start the task',
    success: 'Farmer completes the day’s task.',
  },
  activity: {
    purpose: 'Show what has changed on the farm, newest first.',
    question: 'What changed?',
    primaryCTA: 'View all activity',
    success: 'Farmer can see their farm history building over time.',
  },
  scan: {
    purpose: 'Diagnose what is wrong with a crop from a photo.',
    question: 'What is wrong with my crop?',
    primaryCTA: 'Scan (then Save or Retake)',
    success: 'Farmer gets an honest diagnosis + next action, or a clear reason it could not.',
  },
  sell: {
    purpose: 'Help the farmer decide what and when to sell — without inventing prices.',
    question: 'What can I sell?',
    primaryCTA: 'Sell now / Enter a local price',
    success: 'Farmer gets an honest sell decision (SELL_NOW / WAIT / NEED_MORE_PRICE_DATA / NO_BUYERS_FOUND).',
  },
  funding: {
    purpose: 'Surface funding programs the farmer may qualify for.',
    question: 'What opportunities exist?',
    primaryCTA: 'Apply',
    success: 'Farmer finds and applies to a relevant program.',
  },
});

/** Required, non-empty keys for every contract. */
export const CONTRACT_KEYS = Object.freeze(['purpose', 'question', 'primaryCTA', 'success']);

export default SCREEN_CONTRACTS;
