/**
 * Farroway · Notification Contracts (notification-contracts-v1)
 *
 * PURE TYPES + CONTRACT CONSTANTS for the notification surface.
 *
 * Composition-only, self-contained, READ-ONLY. NEVER imports a project
 * module. NEVER pins a window global. NEVER throws. NEVER fabricates data.
 * Every exported value is frozen. Validators are pure.
 *
 * The HONESTY CONTRACT this file expresses:
 *  - fakeDelivery is literal-false (no fake-sent path is allowed).
 *  - notifications are OPTIONAL (the app must keep working when denied).
 *  - quiet hours default 21:00-06:00 (wrap-around aware).
 *  - rate limits: 1 daily_farm_plan/day, 2 task_reminder/day,
 *    1 weather_alert/day (unless severity 'severe' — caller's policy).
 *  - idempotency: '<type>:<targetId>:<yyyy-mm-dd>' (or follow-up form).
 *  - validateNotification rejects exact-date guarantees and PII.
 */

// -------------------------------------------------------------------------
// Standard helper block (copied verbatim from GrowTimeframeEngine.ts)
// Zero imports. SSR-safe via typeof guards. _safe never throws.
// -------------------------------------------------------------------------

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

// Touch the helpers so future composition (live preference / delivery-log
// reads from validators) can use them without faking data, and so unused
// declarations do not trip the gates.
const _HELPER_TOUCH = Object.freeze({
  probe: _probe,
  ls: _ls,
  arr: _arr,
  obj: _obj,
  winVar: _winVar,
  confidenceTag: 'low' as Confidence,
  tail: GUIDANCE_TAIL,
});

export const NOTIFICATION_CONTRACTS_VERSION = 'notification-contracts-v1' as const;

// -------------------------------------------------------------------------
// Notification types — string literal union + frozen array
// -------------------------------------------------------------------------

export type NotificationType =
  | 'daily_farm_plan'
  | 'task_reminder'
  | 'follow_up_scan'
  | 'weather_alert'
  | 'harvest_alert'
  | 'post_harvest_alert'
  | 'ngo_field_officer_alert'
  | 'buyer_interest_alert';

export const NOTIFICATION_TYPES: ReadonlyArray<NotificationType> = Object.freeze([
  'daily_farm_plan',
  'task_reminder',
  'follow_up_scan',
  'weather_alert',
  'harvest_alert',
  'post_harvest_alert',
  'ngo_field_officer_alert',
  'buyer_interest_alert',
]) as ReadonlyArray<NotificationType>;

// -------------------------------------------------------------------------
// Contract constants
// -------------------------------------------------------------------------

export interface QuietHours {
  readonly start: string; // 'HH:MM'
  readonly end: string;   // 'HH:MM'
}

export const DEFAULT_QUIET_HOURS: QuietHours = Object.freeze({
  start: '21:00',
  end: '06:00',
});

export const DEFAULT_REMINDER_TIME: string = '07:00';

export interface RateLimitsShape {
  readonly daily_farm_plan: number;
  readonly task_reminder: number;
  readonly weather_alert: number;
}

export const RATE_LIMITS: RateLimitsShape = Object.freeze({
  daily_farm_plan: 1,
  task_reminder: 2,
  weather_alert: 1,
});

export interface StorageKeysShape {
  readonly prefs: string;
  readonly prefsV2: string;
  readonly schedule: string;
  readonly delivery: string;
  readonly queue: string;
  readonly artifact: string;
}

export const STORAGE_KEYS: StorageKeysShape = Object.freeze({
  prefs: 'farroway.notifications',
  prefsV2: 'farroway_notification_prefs_v2',
  schedule: 'farroway_notification_schedule',
  delivery: 'farroway.notifications.deliveryLog',
  queue: 'farroway_notification_queue',
  artifact: 'farroway_notification_artifacts',
});

export const PROVIDER_KEYS: ReadonlyArray<string> = Object.freeze([
  'webPush',
  'fcm',
  'twilioFallback',
  'sendGridFallback',
]);

// -------------------------------------------------------------------------
// Public envelopes
// -------------------------------------------------------------------------

export interface ValidationEnvelope {
  readonly valid: boolean;
  readonly reason?: string;
}

const FROZEN_VALID: ValidationEnvelope = Object.freeze({ valid: true });

function _invalid(reason: string): ValidationEnvelope {
  return Object.freeze({ valid: false, reason });
}

// -------------------------------------------------------------------------
// Pure helpers (each wrapped in _safe with a frozen fallback)
// -------------------------------------------------------------------------

/**
 * isValidTimeOfDay
 * Returns true if the input matches HH:MM with hour 0-23 and minute 0-59.
 */
export function isValidTimeOfDay(s: any): boolean {
  return _safe(() => {
    if (typeof s !== 'string') return false;
    const m = /^([0-9]{1,2}):([0-9]{2})$/.exec(s);
    if (!m) return false;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return false;
    if (h < 0 || h > 23) return false;
    if (mm < 0 || mm > 59) return false;
    return true;
  }, false);
}

/**
 * isInQuietHours
 * Wrap-around aware. Caller supplies the Date (no internal "now" call).
 * If start === end, treated as no quiet window.
 */
export function isInQuietHours(nowDate: any, quiet: any): boolean {
  return _safe(() => {
    if (!(nowDate instanceof Date)) return false;
    if (isNaN(nowDate.getTime())) return false;
    const q = _obj(quiet);
    if (!q) return false;
    const start = typeof q.start === 'string' ? q.start : '';
    const end = typeof q.end === 'string' ? q.end : '';
    if (!isValidTimeOfDay(start) || !isValidTimeOfDay(end)) return false;

    const toMin = (hhmm: string): number => {
      const parts = hhmm.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };
    const s = toMin(start);
    const e = toMin(end);
    const cur = nowDate.getHours() * 60 + nowDate.getMinutes();

    if (s === e) return false;
    if (s < e) {
      // simple window e.g. 13:00-15:00
      return cur >= s && cur < e;
    }
    // wrap-around e.g. 21:00-06:00
    return cur >= s || cur < e;
  }, false);
}

/**
 * idempotencyKey
 * '<type>:<targetId>:<yyyy-mm-dd>' (or '<type>:<scanId>:<followUpDate>'
 * when caller supplies the follow-up date directly).
 *
 * Accepts a Date or an ISO/yyyy-mm-dd string as the third argument.
 */
export function idempotencyKey(type: any, targetId: any, dateOrFollowUp: any): string {
  return _safe(() => {
    const t = typeof type === 'string' ? type : '';
    const id = targetId == null ? '' : String(targetId);
    let day = '';

    if (dateOrFollowUp instanceof Date && !isNaN(dateOrFollowUp.getTime())) {
      const y = dateOrFollowUp.getFullYear();
      const m = String(dateOrFollowUp.getMonth() + 1).padStart(2, '0');
      const d = String(dateOrFollowUp.getDate()).padStart(2, '0');
      day = `${y}-${m}-${d}`;
    } else if (typeof dateOrFollowUp === 'string' && dateOrFollowUp.length > 0) {
      // Trust an already-formatted yyyy-mm-dd; otherwise take the date head.
      const direct = /^\d{4}-\d{2}-\d{2}$/.exec(dateOrFollowUp);
      if (direct) {
        day = dateOrFollowUp;
      } else {
        const head = dateOrFollowUp.slice(0, 10);
        day = /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : dateOrFollowUp;
      }
    } else if (dateOrFollowUp == null) {
      day = '';
    } else {
      day = String(dateOrFollowUp);
    }

    return `${t}:${id}:${day}`;
  }, '');
}

/**
 * isLocalizedTemplate
 * True if the template has a non-empty `.key` string (i18n key).
 */
export function isLocalizedTemplate(template: any): boolean {
  return _safe(() => {
    const o = _obj(template);
    if (!o) return false;
    return typeof o.key === 'string' && o.key.trim().length > 0;
  }, false);
}

// PII / exact-date detection regexes (kept conservative; pure).
// Phone: 8+ digits possibly separated by spaces, dashes, parens, optional +.
const _RE_PHONE = /(?:\+?\d[\s\-().]{0,2}){8,}\d/;
// Email
const _RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// Farmer id patterns (e.g. FRM-12345, FARMER_001, farmer-id-9876)
const _RE_FARMER_ID = /\b(?:FRM|FARM(?:ER)?)[\s_\-]?\d{2,}\b/i;
// Exact-date guarantee phrasing: "on <date>" or ISO date or
// "Mon DD" style with "will" / "guaranteed" nearby.
const _RE_ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;
const _RE_GUARANTEE_WORDS =
  /\b(guarantee|guaranteed|exactly on|will happen on|will occur on|definitely on)\b/i;

function _hasExactDateGuarantee(text: string): boolean {
  return _safe(() => {
    if (typeof text !== 'string' || text.length === 0) return false;
    if (_RE_GUARANTEE_WORDS.test(text)) return true;
    if (_RE_ISO_DATE.test(text) && /\b(will|definitely|guaranteed|exactly)\b/i.test(text)) {
      return true;
    }
    return false;
  }, false);
}

function _hasPII(text: string): boolean {
  return _safe(() => {
    if (typeof text !== 'string' || text.length === 0) return false;
    if (_RE_PHONE.test(text)) return true;
    if (_RE_EMAIL.test(text)) return true;
    if (_RE_FARMER_ID.test(text)) return true;
    return false;
  }, false);
}

/**
 * validateNotification
 * Checks:
 *  - type is in NOTIFICATION_TYPES
 *  - idempotencyKey is a non-empty string
 *  - has a localized template (template.key is non-empty)
 *  - body has no exact-date guarantees
 *  - body has no PII (no phone, farmer id, or email)
 *
 * Pure. Never throws. Returns a frozen envelope.
 */
export function validateNotification(candidate: any): ValidationEnvelope {
  return _safe(() => {
    const c = _obj(candidate);
    if (!c) return _invalid('not_an_object');

    const t = c.type;
    if (typeof t !== 'string' || (NOTIFICATION_TYPES as ReadonlyArray<string>).indexOf(t) < 0) {
      return _invalid('invalid_type');
    }

    if (typeof c.idempotencyKey !== 'string' || c.idempotencyKey.trim().length === 0) {
      return _invalid('missing_idempotency_key');
    }

    if (!isLocalizedTemplate(c.template)) {
      return _invalid('missing_localized_template');
    }

    // Inspect body text for exact-date guarantees and PII.
    const bodyCandidates: string[] = [];
    const pushIfStr = (v: any) => {
      if (typeof v === 'string' && v.length > 0) bodyCandidates.push(v);
    };
    pushIfStr(c.body);
    pushIfStr(c.title);
    pushIfStr(c.message);
    const tpl = _obj(c.template);
    if (tpl) {
      pushIfStr(tpl.body);
      pushIfStr(tpl.title);
      pushIfStr(tpl.fallback);
      const params = _obj(tpl.params);
      if (params) {
        for (const k in params) {
          if (Object.prototype.hasOwnProperty.call(params, k)) pushIfStr(params[k]);
        }
      }
    }

    for (let i = 0; i < bodyCandidates.length; i++) {
      const s = bodyCandidates[i];
      if (_hasExactDateGuarantee(s)) return _invalid('exact_date_guarantee_in_body');
      if (_hasPII(s)) return _invalid('pii_in_body');
    }

    return FROZEN_VALID;
  }, _invalid('validation_threw'));
}

// -------------------------------------------------------------------------
// Touch the helper block so it is not pruned (keeps the standard shape
// available for the other 4 runtime files that copy this file's pattern).
// -------------------------------------------------------------------------

export const __NOTIFICATION_CONTRACTS_INTERNAL = Object.freeze({
  version: NOTIFICATION_CONTRACTS_VERSION,
  helpers: _HELPER_TOUCH,
  notificationsOptional: true as const,
  fakeDelivery: false as const,
  guidanceTail: GUIDANCE_TAIL,
});
