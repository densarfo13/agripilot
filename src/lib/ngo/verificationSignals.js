/**
 * verificationSignals.js — farmer-level operational verification
 * flags used by the NGO dashboard + farmer detail views.
 *
 * These are *visible proof-of-activity* signals, NOT fraud scoring.
 * They answer: "does this farmer look like an engaged, real user?"
 *
 *   getFarmerVerificationSignals({
 *     farm,          // local / server farm record
 *     events,        // farroway.farmEvents slice for this farm
 *     completions,   // task completion rows for this farm
 *     now,           // optional Date; defaults to Date.now()
 *     activityWindowDays, // default 7
 *   }) → {
 *     onboardingComplete,  // farm has name + crop + country
 *     locationCaptured,    // country + (state OR lat/lng)
 *     cropSelected,        // non-empty crop code
 *     recentActivity,      // ANY event within the window
 *     taskActivity,        // ≥1 task_completed event within window
 *     completedCount:      total task completions (all-time)
 *     lastActivityAt:      epoch ms or null
 *     score: 0..5          // count of the 5 flags
 *   }
 *
 * Pure — no IO, no throws. Callers feed whatever subset they have.
 */

const DEFAULT_WINDOW_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

function toMs(x) {
  if (x == null) return null;
  if (x instanceof Date) return x.getTime();
  const n = Number(x);
  if (Number.isFinite(n)) return n;
  const parsed = Date.parse(String(x));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getFarmerVerificationSignals({
  farm = null,
  events = [],
  completions = [],
  now = null,
  activityWindowDays = DEFAULT_WINDOW_DAYS,
} = {}) {
  const nowTs = toMs(now) || Date.now();
  const cutoff = nowTs - Math.max(0, activityWindowDays) * DAY_MS;
  const farmId = farm && farm.id ? String(farm.id) : null;

  const cropSelected = !!(farm && (farm.crop || farm.cropType) && String(farm.crop || farm.cropType).trim().length > 0);
  const country      = farm && (farm.country || farm.countryCode) || null;
  const hasState     = !!(farm && (farm.state || farm.stateCode));
  const hasCoords    = !!(farm && Number.isFinite(Number(farm.latitude))
                               && Number.isFinite(Number(farm.longitude)));
  const locationCaptured = !!country && (hasState || hasCoords);
  const onboardingComplete = !!(farm && farm.name) && cropSelected && !!country;

  // Scan events — single pass, filtered to this farm when farmId is known.
  let lastActivityAt = 0;
  let recent = false;
  let taskRecent = false;
  for (const e of events || []) {
    if (!e || !e.timestamp) continue;
    if (farmId && e.farmId && String(e.farmId) !== farmId) continue;
    if (e.timestamp > lastActivityAt) lastActivityAt = e.timestamp;
    if (e.timestamp >= cutoff) {
      recent = true;
      if (e.type === 'task_completed') taskRecent = true;
    }
  }

  // Also merge completions (back-compat for callers that don't pass
  // the full event log).
  let completedCount = 0;
  for (const c of completions || []) {
    if (!c || c.completed === false) continue;
    if (farmId && c.farmId && String(c.farmId) !== farmId) continue;
    completedCount += 1;
    const ts = toMs(c.timestamp);
    if (ts && ts > lastActivityAt) lastActivityAt = ts;
    if (ts && ts >= cutoff) { recent = true; taskRecent = true; }
  }

  const signals = {
    onboardingComplete,
    locationCaptured,
    cropSelected,
    recentActivity: recent,
    taskActivity:   taskRecent,
    completedCount,
    lastActivityAt: lastActivityAt || null,
  };
  const score =
      (signals.onboardingComplete ? 1 : 0)
    + (signals.locationCaptured   ? 1 : 0)
    + (signals.cropSelected       ? 1 : 0)
    + (signals.recentActivity     ? 1 : 0)
    + (signals.taskActivity       ? 1 : 0);

  return Object.freeze({ ...signals, score });
}

export const _internal = Object.freeze({ DEFAULT_WINDOW_DAYS });
