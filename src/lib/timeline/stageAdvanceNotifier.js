/**
 * stageAdvanceNotifier.js — detects "your crop advanced while you
 * were away" and records when a farm was last rendered so we can
 * compute absence windows.
 *
 *   detectStageAdvance({ farm, now }) → {
 *     advanced:    boolean,
 *     fromStage:   prior stage key | null,
 *     toStage:     current stage key,
 *     daysAway:    number,          // whole days since last open
 *     hoursAway:   number,
 *     message:     { key, fallback },
 *     focusNext:   { key, fallback } | null,
 *   } | null
 *
 * The detector:
 *   • Reads / writes localStorage['farroway.timeline.lastSeenStage.v1']
 *     (shape: { byFarm: { [farmId]: { stage, seenAt } } })
 *   • Returns a positive `advanced` only when
 *       (a) we have a prior stage recorded for this farm,
 *       (b) the newly computed stage differs, AND
 *       (c) the farmer was away for at least 24h (so a mid-day
 *           stage flip from a plantingDate edit doesn't trigger a
 *           "while you were away" line).
 *   • Writes the current stage + seenAt on every call, so the next
 *     read starts fresh.
 *
 * Pure apart from the one localStorage write. SSR-safe (storage
 * access guarded). Never throws.
 */

import { getCropTimeline } from './cropTimelineEngine.js';

const KEY = 'farroway.timeline.lastSeenStage.v1';
const ABSENCE_THRESHOLD_HOURS = 24;

function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readSeen() {
  if (!hasStorage()) return { byFarm: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || !parsed.byFarm) return { byFarm: {} };
    return parsed;
  } catch { return { byFarm: {} }; }
}

function writeSeen(obj) {
  if (!hasStorage()) return;
  try { window.localStorage.setItem(KEY, JSON.stringify(obj)); }
  catch { /* quota / privacy — non-fatal */ }
}

function toPretty(stageKey) {
  if (!stageKey) return '';
  return String(stageKey).replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

export function detectStageAdvance({ farm = null, now = null } = {}) {
  if (!farm || typeof farm !== 'object') return null;
  const farmId = farm.id || farm._id || null;
  if (!farmId) return null;

  const timeline = getCropTimeline({ farm, now });
  if (!timeline) return null;
  const toStage = timeline.currentStage;
  if (!toStage) return null;

  const store = readSeen();
  const prior = store.byFarm[farmId] || null;
  const nowTs = (now ? new Date(now) : new Date()).getTime();

  // Always persist the current observation for the next session.
  store.byFarm[farmId] = {
    stage:  toStage,
    seenAt: nowTs,
  };
  writeSeen(store);

  if (!prior) return null;                         // first observation — nothing to compare
  if (!prior.stage || prior.stage === toStage) return null;  // same stage, no advance

  const hoursAway = Math.max(0, (nowTs - (prior.seenAt || nowTs)) / 3_600_000);
  if (hoursAway < ABSENCE_THRESHOLD_HOURS) return null;

  const daysAway = Math.round(hoursAway / 24);
  const fromPretty = toPretty(prior.stage);
  const toPrettyStr = toPretty(toStage);

  return Object.freeze({
    advanced:  true,
    fromStage: prior.stage,
    toStage,
    daysAway,
    hoursAway: Math.round(hoursAway),
    message: Object.freeze({
      key: 'timeline.advancedWhileAway.message',
      fallback: daysAway <= 1
        ? `Your crop has progressed while you were away. Now in: ${toPrettyStr} stage.`
        : `Your crop progressed while you were away for ${daysAway} days. Now in: ${toPrettyStr} stage.`,
    }),
    from: Object.freeze({ key: `timeline.stage.${prior.stage}`, fallback: fromPretty }),
    to:   Object.freeze({ key: `timeline.stage.${toStage}`,    fallback: toPrettyStr }),
    focusNext: Object.freeze({
      key: `timeline.focusNext.${toStage}`,
      fallback: defaultFocusFor(toStage),
    }),
    confidenceLevel: timeline.confidenceLevel,
  });
}

/**
 * clearLastSeenStage — testing / reset hook. Removes the persisted
 * observation for one farm so the next detect call runs as the
 * first observation.
 */
export function clearLastSeenStage(farmId) {
  if (!farmId) return;
  const store = readSeen();
  if (store.byFarm[farmId]) {
    delete store.byFarm[farmId];
    writeSeen(store);
  }
}

function defaultFocusFor(stageKey) {
  switch (stageKey) {
    case 'planting':
    case 'establishment': return 'Focus today: check seed emergence and soil moisture.';
    case 'germination':   return 'Focus today: watch for gaps and replant if needed.';
    case 'vegetative':    return 'Focus today: check growth and soil moisture.';
    case 'flowering':     return 'Focus today: watch for pests and pollination.';
    case 'fruiting':      return 'Focus today: support heavy branches and check for disease.';
    case 'bulking':       return 'Focus today: keep soil moist and weed-free.';
    case 'grain_fill':
    case 'maturation':    return 'Focus today: hold steady — harvest is close.';
    case 'tasseling':     return 'Focus today: monitor water supply during tasseling.';
    case 'harvest':       return 'Focus today: prepare tools and clean storage for harvest.';
    case 'pod_fill':      return 'Focus today: watch for pod-filling issues.';
    case 'pegging':       return 'Focus today: keep soil loose for pegging to succeed.';
    case 'seedling':      return 'Focus today: shade seedlings and water gently.';
    case 'transplant':    return 'Focus today: water transplants and protect from harsh sun.';
    default:              return 'Focus today: open your farm page for today\u2019s tasks.';
  }
}

export const _internal = Object.freeze({ KEY, ABSENCE_THRESHOLD_HOURS, readSeen, writeSeen });
