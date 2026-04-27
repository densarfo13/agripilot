/**
 * outbreakNotifications.js — notification dedupe + delivery for
 * the outbreak alerts.
 *
 *   maybeNotifyOutbreak({ cluster, farmerId, settings, sendSms })
 *
 * Rules (per spec section 6):
 *   * Honour existing notification preferences:
 *     - settings.risk must be on for any in-app surface
 *     - settings.sms must be on AND a sender provided to send SMS
 *   * Max one outbreak alert per farmer per cluster per day:
 *     dedupe key  outbreak:<clusterId>:<farmerId>:<YYYY-MM-DD>
 *
 * Strict-rule audit:
 *   * never throws (every storage call try/catch wrapped)
 *   * lightweight: localStorage-only dedupe ledger
 *   * does NOT spam: same-day re-fires return { fired: false,
 *     reason: 'deduped' }
 *   * does NOT replace the existing notification engine - it
 *     wraps it.
 */

const LEDGER_KEY = 'farroway_outbreak_notif_ledger';

function _safeGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch { return null; }
}

function _safeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch { /* swallow */ }
}

function _todayUtcDate() {
  // YYYY-MM-DD using UTC so dedupe is deterministic across tabs
  // in different timezones.
  const d = new Date();
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function _readLedger() {
  const raw = _safeGet(LEDGER_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function _writeLedger(map) {
  try { _safeSet(LEDGER_KEY, JSON.stringify(map)); }
  catch { /* swallow */ }
}

/**
 * Build the deterministic dedupe key.
 *   outbreak:<clusterId>:<farmerId>:<YYYY-MM-DD>
 */
export function buildDedupeKey(clusterId, farmerId, date = _todayUtcDate()) {
  const cid = String(clusterId || 'unknown');
  const fid = String(farmerId  || 'anon');
  return `outbreak:${cid}:${fid}:${date}`;
}

/**
 * hasFiredToday(clusterId, farmerId)
 *   -> boolean
 */
export function hasFiredToday(clusterId, farmerId) {
  const key = buildDedupeKey(clusterId, farmerId);
  const ledger = _readLedger();
  return !!ledger[key];
}

/**
 * markFired(clusterId, farmerId)
 *   stamps the ledger so subsequent same-day calls dedupe.
 */
export function markFired(clusterId, farmerId) {
  const key = buildDedupeKey(clusterId, farmerId);
  const ledger = _readLedger();
  ledger[key] = Date.now();

  // Garbage-collect entries older than 14 days to keep the ledger
  // tiny. The dedupe window is just one day, so anything older is
  // never read again.
  const cutoff = Date.now() - 14 * 86_400_000;
  for (const k of Object.keys(ledger)) {
    const v = Number(ledger[k]);
    if (!Number.isFinite(v) || v < cutoff) delete ledger[k];
  }
  _writeLedger(ledger);
}

/**
 * maybeNotifyOutbreak({ cluster, farmerId, settings, sendSms? })
 *
 * Returns one of:
 *   { fired: true,  channels: [...] }
 *   { fired: false, reason: 'deduped' | 'risk_off' | 'no_cluster' | 'no_farmer' }
 *
 * `sendSms(message)` is an optional callable. When `settings.sms`
 * is on AND a sender is provided we call it; failures are swallowed
 * by the sender per the strict "never block UI" rule.
 *
 * `settings` is the shape produced by loadSettings() in
 * src/store/settingsStore.js. Only `risk` and `sms` matter here.
 */
export function maybeNotifyOutbreak({
  cluster   = null,
  farmerId  = null,
  settings  = null,
  sendSms   = null,
  smsBody   = null,
} = {}) {
  if (!cluster || !cluster.id)             return { fired: false, reason: 'no_cluster' };
  if (!farmerId)                           return { fired: false, reason: 'no_farmer'  };

  const riskOn = settings ? settings.risk !== false : true;
  if (!riskOn)                             return { fired: false, reason: 'risk_off' };

  if (hasFiredToday(cluster.id, farmerId)) return { fired: false, reason: 'deduped'  };

  const channels = ['in_app'];
  if (settings && settings.sms === true && typeof sendSms === 'function') {
    try { sendSms(smsBody || ''); channels.push('sms'); }
    catch { /* sender swallowed it */ }
  }

  markFired(cluster.id, farmerId);
  return { fired: true, channels };
}

export const _internal = Object.freeze({
  LEDGER_KEY, _todayUtcDate, _readLedger, _writeLedger,
});
