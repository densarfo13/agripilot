/**
 * reminderEngine.js — deterministic, offline-first daily reminder
 * helper.
 *
 *   evaluateReminder(ctx)  → { show, kind, messageKey, severity }
 *   markReminderShown()    — writes today's date into settings
 *   shouldRequestBrowserPermission(ctx) → boolean
 *   requestBrowserPush()   → Promise<'granted'|'denied'|'unsupported'>
 *
 * All reads/writes go through localStorage["farroway.notificationSettings"]
 * with the following shape:
 *
 *   {
 *     dailyReminderEnabled:    true,
 *     dailyReminderTime:       "07:00",
 *     browserPushEnabled:      false,
 *     emailReminderEnabled:    false,
 *     criticalAlertsOnly:      false,
 *     lastReminderSentAt:      null,        // ISO date "YYYY-MM-DD"
 *     askedBrowserPermission:  false,       // avoid re-nagging
 *   }
 *
 * Pure where possible. All IO is confined to getSettings /
 * updateSettings so tests and callers can swap a mock localStorage.
 */

const STORAGE_KEY = 'farroway.notificationSettings';

export const REMINDER_KINDS = Object.freeze([
  'weather_severe',
  'risk_high',
  'missed_day',
  'daily',
]);

export const DEFAULT_SETTINGS = Object.freeze({
  dailyReminderEnabled:    true,
  dailyReminderTime:       '07:00',
  browserPushEnabled:      false,
  emailReminderEnabled:    false,
  criticalAlertsOnly:      false,
  lastReminderSentAt:      null,
  askedBrowserPermission:  false,
});

// ─── Storage helpers ──────────────────────────────────────────────
function hasStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}
function readRaw() {
  if (!hasStorage()) return null;
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function writeRaw(obj) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch { return false; }
}

export function getSettings() {
  const raw = readRaw();
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function updateSettings(patch = {}) {
  const cur = getSettings();
  const next = { ...cur, ...patch };
  // Minimal validation — clamp time to HH:MM, coerce booleans.
  if (typeof next.dailyReminderTime === 'string'
      && !/^\d{2}:\d{2}$/.test(next.dailyReminderTime)) {
    next.dailyReminderTime = cur.dailyReminderTime || DEFAULT_SETTINGS.dailyReminderTime;
  }
  for (const k of [
    'dailyReminderEnabled', 'browserPushEnabled',
    'emailReminderEnabled', 'criticalAlertsOnly',
    'askedBrowserPermission',
  ]) next[k] = !!next[k];
  writeRaw(next);
  return next;
}

// ─── Date helpers ─────────────────────────────────────────────────
function toIsoDate(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dt = d instanceof Date ? d : new Date(d || Date.now());
  if (!Number.isFinite(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseHHMM(hhmm) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return { h: 7, min: 0 };
  return { h: Math.min(23, Math.max(0, Number(m[1]))),
           min: Math.min(59, Math.max(0, Number(m[2]))) };
}

function isAtOrAfterTime(now, hhmm) {
  const dt = now instanceof Date ? now : new Date(now);
  const { h, min } = parseHHMM(hhmm);
  const curMinutes = dt.getHours() * 60 + dt.getMinutes();
  return curMinutes >= h * 60 + min;
}

// ─── Due-reminder helper (shown once per day) ─────────────────────
/**
 * isReminderDue — deterministic check: "should the Today page try
 * to show a reminder right now?".
 *
 *   • dailyReminderEnabled must be true
 *   • lastReminderSentAt must not equal today's date
 *   • local clock must be at or after dailyReminderTime
 */
export function isReminderDue({
  now, settings,
  // Spec §3 gates — optional, default-true so existing callers keep
  // behaviour. Pass `hasActiveFarm=false` or `todayPrimaryDone=true`
  // to suppress the generic daily reminder without touching weather
  // or missed-day precedence.
  hasActiveFarm = true,
  todayPrimaryDone = false,
} = {}) {
  const s = settings || getSettings();
  if (!s.dailyReminderEnabled) return false;
  if (!hasActiveFarm) return false;
  if (todayPrimaryDone) return false;
  const today = toIsoDate(now || new Date());
  if (s.lastReminderSentAt === today) return false;
  return isAtOrAfterTime(now || new Date(), s.dailyReminderTime);
}

export function markReminderShown({ now } = {}) {
  const today = toIsoDate(now || new Date());
  return updateSettings({ lastReminderSentAt: today });
}

// ─── Missed-day detection (spec §5) ───────────────────────────────
function completedOnDay(completions, iso) {
  for (const c of completions || []) {
    if (!c || c.completed === false) continue;
    if (toIsoDate(c.timestamp) === iso) return true;
  }
  return false;
}

/**
 * didMissYesterday — true iff:
 *   • yesterday has NO completed tasks recorded locally, AND
 *   • today has NO completed tasks either
 *
 * The second clause avoids nagging a farmer who has already worked
 * today but simply didn't work the day before.
 */
export function didMissYesterday({ now, completions } = {}) {
  const todayIso = toIsoDate(now || new Date());
  const yest = new Date((now instanceof Date ? now.getTime() : Date.now()) - 24 * 3600 * 1000);
  const yestIso = toIsoDate(yest);
  if (completedOnDay(completions, todayIso))  return false;
  if (completedOnDay(completions, yestIso))   return false;
  // Only flag "missed" when there IS prior activity at all — a
  // first-time farmer hasn't "missed" anything.
  for (const c of completions || []) {
    if (!c || c.completed === false) continue;
    if ((c.timestamp || 0) < new Date(yestIso + 'T00:00:00').getTime()) return true;
  }
  return false;
}

// ─── Weather / risk kind derivation ───────────────────────────────
function pickWeatherKind(weather, riskLevel) {
  const w = weather || {};
  if (w.severe) return 'weather_severe';
  if (w.heavyRain) return 'weather_severe';
  if (w.rainSoon) return 'risk_high';
  if (riskLevel === 'high') return 'risk_high';
  return null;
}

// ─── Main evaluator (spec §2, §4, §5, §6) ─────────────────────────
/**
 * evaluateReminder — returns what the Today page should render.
 *
 *   ctx: {
 *     now?,
 *     settings?,
 *     completions?,        // from farrowayLocal.getTaskCompletions()
 *     weather?,            // { rainSoon, heavyRain, dry, severe }
 *     riskLevel?,          // 'low' | 'medium' | 'high'
 *   }
 *
 * Output:
 *   {
 *     show,         // false when suppressed (disabled / not due / etc.)
 *     kind,         // one of REMINDER_KINDS, null when show=false
 *     messageKey,   // i18n key for UI
 *     severity,     // 'info' | 'warning' | 'critical'
 *   }
 *
 * Precedence (spec §6 wins over §5 wins over §2):
 *   weather_severe > risk_high > missed_day > daily
 *
 * Critical-alerts-only toggle suppresses missed_day and daily; it
 * never suppresses weather_severe / risk_high.
 */
export function evaluateReminder(ctx = {}) {
  const {
    now, completions, weather, riskLevel,
    hasActiveFarm = true,       // spec §3 gate
    todayPrimaryDone = false,   // spec §3 gate — suppress daily when
                                // today's primary task is already done
    farmType = null,            // 'backyard' | 'small_farm' | 'commercial'
  } = ctx;
  const settings = ctx.settings || getSettings();

  const weatherKind = pickWeatherKind(weather, riskLevel);
  const missed = didMissYesterday({ now, completions });
  const due    = isReminderDue({
    now, settings,
    hasActiveFarm,
    todayPrimaryDone,
  });

  // Farm-type alert gate. Backyard suppresses 'info' / 'warning'
  // severities and keeps only high/critical; commercial passes
  // everything through. Never silences weather_severe / risk_high
  // since those are already gated above this block.
  const gateForFarmType = (severity) => {
    const s = String(farmType || 'small_farm').toLowerCase();
    if (s === 'backyard')   return severity === 'critical';
    if (s === 'commercial') return true;
    // small_farm default: suppress pure info daily prompts when
    // the UI wants a calmer feed — but by default we show them.
    return true;
  };

  // Spec §12 canonical keys; we also return a short fallback so
  // callers without t() at hand can still render something.
  const KEY = {
    weather_severe: 'notifications.weather_warning',
    risk_high:      'notifications.high_risk',
    missed_day:     'notifications.missed_day',
    daily:          'notifications.daily_ready',
  };

  // Weather / risk beats everything else (never suppressed).
  if (weatherKind) {
    return Object.freeze({
      show: true,
      kind: weatherKind,
      messageKey: KEY[weatherKind],
      severity: weatherKind === 'weather_severe' ? 'critical' : 'warning',
    });
  }

  // Critical-alerts-only suppresses the rest.
  if (settings.criticalAlertsOnly) {
    return Object.freeze({ show: false, kind: null, messageKey: null, severity: 'info' });
  }

  if (missed) {
    const show = gateForFarmType('warning');
    return Object.freeze({
      show,
      kind: show ? 'missed_day' : null,
      messageKey: show ? KEY.missed_day : null,
      severity: 'warning',
      farmType: farmType || null,
    });
  }

  if (due) {
    const show = gateForFarmType('info');
    return Object.freeze({
      show,
      kind: show ? 'daily' : null,
      messageKey: show ? KEY.daily : null,
      severity: 'info',
      farmType: farmType || null,
    });
  }

  return Object.freeze({ show: false, kind: null, messageKey: null, severity: 'info' });
}

// ─── Browser notification permission (spec §3) ────────────────────
/**
 * shouldRequestBrowserPermission — true only when:
 *   • current permission is 'default' (never granted / denied)
 *   • we haven't already asked (askedBrowserPermission=false)
 *   • at least one of the engagement signals has fired:
 *       - farm_created / task_completed event exists in the log, OR
 *       - caller reports it's a second-or-later visit
 */
export function shouldRequestBrowserPermission({
  events = [],
  secondVisitOrLater = false,
  settings,
  permissionOverride,  // test shim; in prod we read Notification.permission
} = {}) {
  const s = settings || getSettings();
  if (s.askedBrowserPermission) return false;
  const perm = typeof permissionOverride === 'string'
    ? permissionOverride
    : (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  if (perm !== 'default') return false; // granted, denied, or unsupported
  const earned =
    secondVisitOrLater
    || (events || []).some((e) => e && (e.type === 'farm_created' || e.type === 'task_completed'));
  return !!earned;
}

/**
 * requestBrowserPush — wraps Notification.requestPermission.
 * Updates settings.askedBrowserPermission=true and sets
 * browserPushEnabled based on the outcome.
 *
 * Returns one of: 'granted' | 'denied' | 'unsupported' | 'error'.
 */
export async function requestBrowserPush() {
  if (typeof Notification === 'undefined') {
    updateSettings({ askedBrowserPermission: true, browserPushEnabled: false });
    return 'unsupported';
  }
  try {
    const res = await Notification.requestPermission();
    const granted = res === 'granted';
    updateSettings({ askedBrowserPermission: true, browserPushEnabled: granted });
    return granted ? 'granted' : (res || 'denied');
  } catch {
    updateSettings({ askedBrowserPermission: true });
    return 'error';
  }
}

/**
 * sendBrowserNotification — spec §9. Fires the OS-level notification
 * only when browserPushEnabled is true AND Notification.permission
 * is 'granted'. Returns 'sent' | 'skipped' | 'unsupported' | 'error'.
 *
 *   sendBrowserNotification({ title, body })
 *
 * Safe: never throws; never renders a notification if the caller's
 * preconditions aren't met.
 */
export function sendBrowserNotification({ title, body, tag } = {}) {
  if (!title) return 'skipped';
  const s = getSettings();
  if (!s.browserPushEnabled) return 'skipped';
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission !== 'granted') return 'skipped';
  try {
    // eslint-disable-next-line no-new
    new Notification(String(title), {
      body: body ? String(body) : undefined,
      tag:  tag   ? String(tag)  : undefined,
    });
    return 'sent';
  } catch { return 'error'; }
}

export const _internal = Object.freeze({
  STORAGE_KEY, toIsoDate, parseHHMM, isAtOrAfterTime,
  completedOnDay, pickWeatherKind,
});
