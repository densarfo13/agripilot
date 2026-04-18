/**
 * smsThrottle — per-farmer SMS budget (spec §8).
 *
 * Rules:
 *   - non-critical: max 1 per day, max 3 per rolling 7-day window
 *   - critical:     bypasses both limits
 *   - explicit opt-out (`allow_sms: false`) blocks every send
 *
 * State lives in localStorage keyed by farmer id. A future server-side
 * implementation can swap the store without touching the check/record
 * helpers — every caller goes through canSendSms / recordSmsSent.
 */

const KEY_PREFIX = 'farroway:sms_throttle:';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_PER_DAY = 1;
const MAX_PER_WEEK = 3;

function readState(farmerId) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + farmerId);
    if (!raw) return { sends: [] };
    const parsed = JSON.parse(raw);
    return { sends: Array.isArray(parsed.sends) ? parsed.sends : [] };
  } catch { return { sends: [] }; }
}

function writeState(farmerId, state) {
  try { localStorage.setItem(KEY_PREFIX + farmerId, JSON.stringify(state)); }
  catch { /* quota — drop silently */ }
}

function pruneOld(sends, now) {
  return sends.filter(s => now - s.at < WEEK_MS);
}

/**
 * Check whether we can send an SMS now.
 * @param {Object} args
 * @param {string} args.farmerId
 * @param {boolean} [args.allowSms=true]  — explicit opt-in on the farmer record
 * @param {boolean} [args.critical=false] — bypass limits for truly urgent messages
 * @returns {{ allowed: boolean, reason?: string, retryAt?: number }}
 */
export function canSendSms({ farmerId, allowSms = true, critical = false }) {
  if (!farmerId) return { allowed: false, reason: 'no_farmer_id' };
  if (!allowSms) return { allowed: false, reason: 'opted_out' };

  const now = Date.now();
  const state = readState(farmerId);
  const sends = pruneOld(state.sends, now);

  if (critical) return { allowed: true, reason: 'critical_bypass' };

  const last24h = sends.filter(s => now - s.at < DAY_MS);
  if (last24h.length >= MAX_PER_DAY) {
    return { allowed: false, reason: 'daily_limit', retryAt: last24h[0].at + DAY_MS };
  }
  if (sends.length >= MAX_PER_WEEK) {
    return { allowed: false, reason: 'weekly_limit', retryAt: sends[0].at + WEEK_MS };
  }
  return { allowed: true };
}

/**
 * Record that an SMS just went out. Call this only when the underlying
 * transport confirmed success so we don't under-count the budget.
 */
export function recordSmsSent({ farmerId, messageKey, critical = false }) {
  if (!farmerId) return;
  const now = Date.now();
  const state = readState(farmerId);
  const sends = pruneOld(state.sends, now);
  sends.push({ at: now, messageKey: messageKey || null, critical: !!critical });
  writeState(farmerId, { sends });
}

/**
 * Exposed for tests / admin ops.
 */
export function getSmsHistory(farmerId) {
  return readState(farmerId).sends;
}

export function clearSmsHistory(farmerId) {
  try { localStorage.removeItem(KEY_PREFIX + farmerId); } catch { /* ignore */ }
}

export const LIMITS = Object.freeze({ MAX_PER_DAY, MAX_PER_WEEK });
