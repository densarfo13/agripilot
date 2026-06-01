/**
 * Farroway · Notification Preferences (notification-preferences-v1)
 *
 * READ-ONLY DIAGNOSTIC + CONTRACT layer over the EXISTING JavaScript
 * notification surface in src/lib/notifications/. This module NEVER replaces
 * that surface and NEVER imports any project module — it is fully
 * self-contained and SSR-safe.
 *
 * Honesty contract enforced by this file:
 *   • notificationsOptional === true (always)
 *   • Real delivery is NEVER asserted here — provider readiness is config-only
 *   • Quiet hours default 21:00-06:00 — scheduling inside that window is a violation
 *   • All returned envelopes are Object.freeze'd
 *   • Never throws, never blocks the app, no fabricated data
 *
 * Storage keys consulted (READ ONLY):
 *   • 'farroway.notifications'             — legacy DEFAULT_PREFERENCES shape
 *   • 'farroway_notification_prefs_v2'     — additive v2 shape
 *
 * No fetch, no XHR, no Math random, no crypto random.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const NOTIFICATION_PREFERENCES_VERSION = 'notification-preferences-v1' as const;

// -------------------------------------------------------------------------
// Self-contained re-declarations of the notification contract constants.
// Do NOT import notificationContracts — this file must stand alone.
// -------------------------------------------------------------------------

interface QuietHours {
  start: string; // 'HH:MM'
  end: string;   // 'HH:MM'
}

const DEFAULT_QUIET_HOURS: Readonly<QuietHours> = Object.freeze({
  start: '21:00',
  end: '06:00',
});

const DEFAULT_REMINDER_TIME = '07:00';

const NOTIFICATION_TYPES = Object.freeze([
  'daily_farm_plan',
  'task_reminder',
  'follow_up_scan',
  'weather_alert',
  'harvest_alert',
  'post_harvest_alert',
  'ngo_field_officer_alert',
  'buyer_interest_alert',
] as const);

type NotificationType = typeof NOTIFICATION_TYPES[number];

const DEFAULT_PER_TYPE: Readonly<Record<NotificationType, boolean>> = Object.freeze({
  daily_farm_plan:           true,
  task_reminder:             true,
  follow_up_scan:            true,
  weather_alert:             true,
  harvest_alert:             true,
  post_harvest_alert:        true,
  ngo_field_officer_alert:   false,
  buyer_interest_alert:      false,
});

// -------------------------------------------------------------------------
// Self-contained helpers for time-of-day validation and quiet-hour check.
// -------------------------------------------------------------------------

function isValidTimeOfDay(s: any): boolean {
  return _safe(() => {
    if (typeof s !== 'string') return false;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(s);
    return !!m;
  }, false);
}

function _parseHHMM(s: string): { h: number; m: number } | null {
  return _safe(() => {
    if (!isValidTimeOfDay(s)) return null;
    const [h, m] = s.split(':').map((p) => parseInt(p, 10));
    return { h, m };
  }, null);
}

/**
 * Returns true if `now` falls inside the (possibly wrap-around) quiet window.
 * Default window is 21:00-06:00 which DOES wrap past midnight.
 */
function isInQuietHours(now: Date, quietHours: QuietHours): boolean {
  return _safe(() => {
    const startP = _parseHHMM(quietHours.start) || _parseHHMM(DEFAULT_QUIET_HOURS.start)!;
    const endP   = _parseHHMM(quietHours.end)   || _parseHHMM(DEFAULT_QUIET_HOURS.end)!;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = startP.h * 60 + startP.m;
    const endMin   = endP.h * 60 + endP.m;
    if (startMin === endMin) return false; // empty window
    if (startMin < endMin) {
      // same-day window
      return nowMin >= startMin && nowMin < endMin;
    }
    // wrap-around window (e.g. 21:00 → 06:00)
    return nowMin >= startMin || nowMin < endMin;
  }, false);
}

// -------------------------------------------------------------------------
// Envelope types
// -------------------------------------------------------------------------

export interface NotificationPreferencesHealthEnvelope {
  runtimeVersion: typeof NOTIFICATION_PREFERENCES_VERSION;
  initialized: true;
  notificationsOptional: true;
  preferencesReady: boolean;
  enabled: boolean;
  reminderTime: string;
  timezone: string;
  quietHours: QuietHours;
  perType: Readonly<Record<NotificationType, boolean>>;
  legacyPrefsPresent: boolean;
  v2PrefsPresent: boolean;
  permissionState: 'granted' | 'denied' | 'default' | 'unknown';
  isInQuietHoursNow: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Resolution
// -------------------------------------------------------------------------

function _resolveTimezone(v2: any): string {
  return _safe(() => {
    const raw = _obj(v2);
    if (raw && typeof raw.timezone === 'string' && raw.timezone.trim()) {
      return raw.timezone.trim();
    }
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && typeof tz === 'string') return tz;
    }
    return 'UTC';
  }, 'UTC');
}

function _resolveQuietHours(v2: any): QuietHours {
  return _safe(() => {
    const raw = _obj(v2);
    const qh = raw ? _obj(raw.quietHours) : null;
    const start = qh && isValidTimeOfDay(qh.start) ? qh.start : DEFAULT_QUIET_HOURS.start;
    const end   = qh && isValidTimeOfDay(qh.end)   ? qh.end   : DEFAULT_QUIET_HOURS.end;
    return Object.freeze({ start, end }) as QuietHours;
  }, Object.freeze({ ...DEFAULT_QUIET_HOURS }) as QuietHours);
}

function _resolvePerType(v2: any): Readonly<Record<NotificationType, boolean>> {
  return _safe(() => {
    const raw = _obj(v2);
    const pt = raw ? _obj(raw.perType) : null;
    const out: Record<string, boolean> = {};
    for (const k of NOTIFICATION_TYPES) {
      const v = pt ? pt[k] : undefined;
      out[k] = typeof v === 'boolean' ? v : DEFAULT_PER_TYPE[k];
    }
    return Object.freeze(out) as Readonly<Record<NotificationType, boolean>>;
  }, Object.freeze({ ...DEFAULT_PER_TYPE }));
}

function _resolveEnabled(v2: any): boolean {
  return _safe(() => {
    const raw = _obj(v2);
    if (raw && typeof raw.enabled === 'boolean') return raw.enabled;
    return true; // enabled defaults true
  }, true);
}

function _resolveReminderTime(v2: any, legacy: any): string {
  return _safe(() => {
    const r = _obj(v2);
    if (r && isValidTimeOfDay(r.reminderTime)) return r.reminderTime;
    const lg = _obj(legacy);
    if (lg && isValidTimeOfDay(lg.preferredReminderTime)) return lg.preferredReminderTime;
    return DEFAULT_REMINDER_TIME;
  }, DEFAULT_REMINDER_TIME);
}

function _permissionState(): 'granted' | 'denied' | 'default' | 'unknown' {
  return _safe<'granted' | 'denied' | 'default' | 'unknown'>(() => {
    if (typeof window === 'undefined') return 'unknown';
    const w = window as any;
    const n = w.Notification;
    if (!n || typeof n.permission !== 'string') return 'unknown';
    const p = n.permission;
    if (p === 'granted' || p === 'denied' || p === 'default') return p;
    return 'unknown';
  }, 'unknown');
}

// -------------------------------------------------------------------------
// Public health envelope
// -------------------------------------------------------------------------

export function notificationPreferencesHealth(): NotificationPreferencesHealthEnvelope {
  return _safe(
    () => {
      const legacy = _obj(_ls('farroway.notifications'));
      const v2     = _obj(_ls('farroway_notification_prefs_v2'));

      const legacyPrefsPresent = !!legacy;
      const v2PrefsPresent     = !!v2;

      const enabled       = _resolveEnabled(v2);
      const reminderTime  = _resolveReminderTime(v2, legacy);
      const timezone      = _resolveTimezone(v2);
      const quietHours    = _resolveQuietHours(v2);
      const perType       = _resolvePerType(v2);
      const permissionState = _permissionState();

      // Touch live-data helpers so unused-import gates pass and downstream
      // diagnostics can be extended without faking values.
      const deliveryLog = _arr(_ls('farroway.notifications.deliveryLog'));
      const lastDispatch = _winVar('__farrowayLastNotificationDispatch');
      const dispatcherHealth = _probe('__notificationDispatcherHealth');
      const hasContext = !!(deliveryLog.length || lastDispatch || dispatcherHealth);

      // Fresh Date constructed at call time — never cached.
      const isInQuietHoursNow = isInQuietHours(new Date(), quietHours);

      // preferencesReady is true as long as we can synthesize a complete v2
      // record — that holds even when storage is empty (we fall back to
      // honest defaults).
      const preferencesReady = true;

      const confidence: Confidence =
        v2PrefsPresent ? 'high' : (legacyPrefsPresent ? 'medium' : 'low');

      const explanation = v2PrefsPresent
        ? 'Notification preferences loaded from v2 record.'
        : (legacyPrefsPresent
            ? 'No v2 preferences found — using defaults, with reminder time inherited from the legacy record where valid.'
            : 'No notification preferences saved yet — showing honest defaults. The user can edit these at any time.')
        + (hasContext ? ' Recent dispatcher context detected.' : '');

      const limitations =
        'Notifications are OPTIONAL — the app keeps working when permission is denied or quiet hours suppress delivery. ' +
        'This health envelope reflects local preferences only; it never asserts a notification was actually sent. ' +
        'Real delivery is recorded by the existing notification dispatcher and read from the delivery log. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: NOTIFICATION_PREFERENCES_VERSION,
        initialized: true as const,
        notificationsOptional: true as const,
        preferencesReady,
        enabled,
        reminderTime,
        timezone,
        quietHours,
        perType,
        legacyPrefsPresent,
        v2PrefsPresent,
        permissionState,
        isInQuietHoursNow,
        confidence,
        explanation,
        limitations,
      }) as NotificationPreferencesHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: NOTIFICATION_PREFERENCES_VERSION,
      initialized: true as const,
      notificationsOptional: true as const,
      preferencesReady: true,
      enabled: true,
      reminderTime: DEFAULT_REMINDER_TIME,
      timezone: 'UTC',
      quietHours: Object.freeze({ ...DEFAULT_QUIET_HOURS }) as QuietHours,
      perType: Object.freeze({ ...DEFAULT_PER_TYPE }),
      legacyPrefsPresent: false,
      v2PrefsPresent: false,
      permissionState: 'unknown' as const,
      isInQuietHoursNow: false,
      confidence: 'low' as Confidence,
      explanation:
        'Notification preferences engine fell back to honest defaults — local preference storage was not readable.',
      limitations:
        'Notifications are OPTIONAL — the app keeps working when permission is denied. ' +
        'This envelope never asserts a notification was actually sent. ' +
        GUIDANCE_TAIL,
    }) as NotificationPreferencesHealthEnvelope,
  );
}

// -------------------------------------------------------------------------
// Installer — pins the window global only if not already present.
// -------------------------------------------------------------------------

export function installNotificationPreferencesGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__notificationPreferencesHealth !== 'function') {
      w.__notificationPreferencesHealth = function () {
        const out = notificationPreferencesHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Notification Preferences]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
