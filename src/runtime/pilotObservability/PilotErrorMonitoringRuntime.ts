/**
 * PilotErrorMonitoringRuntime.ts — §6 ERROR MONITORING.
 *
 * Captures error records with strict NO-PII enforcement. Records are
 * persisted to localStorage at key 'farroway_pilot_error_log', bounded
 * to 200 entries (oldest dropped). Each record contains only:
 *
 *   { kind, timestamp, route, userRole, errorType, message (<=200) }
 *
 * PII rule (gate-enforced):
 *   • REJECT records whose any string field contains an email-like
 *     substring (presence of '@').
 *   • REJECT records whose any string field contains a digit run of
 *     10+ consecutive digits (phone-like).
 *   • DROP fields whose key is in the suspicious-key blocklist:
 *     farmerId, userId, name, deviceId, coords, latitude, longitude,
 *     ip, phone, filename.
 *   • Truncate `message` to 200 characters BEFORE writing.
 *
 * Honest contract — counts are derived from REAL persisted records,
 * never fabricated. Time and randomness sources are NOT consumed in
 * the file body; callers pass `nowMs`.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _ls(key: string): any {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, null);
}

function _lsWrite(key: string, value: any): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  }, false);
}

type Confidence = 'low' | 'medium' | 'high';

export const PILOT_ERROR_MONITORING_VERSION = 'pilot-error-monitoring-v1' as const;
export const PILOT_ERROR_LOG_KEY = 'farroway_pilot_error_log' as const;
export const PILOT_ERROR_LOG_MAX = 200 as const;
export const PILOT_ERROR_MESSAGE_MAX = 200 as const;
export const GUIDANCE_TAIL = 'Decision support, not a guarantee.' as const;

export type PilotErrorKind =
  | 'frontend'
  | 'api'
  | 'scan'
  | 'notification'
  | 'localization'
  | 'offline_sync';

const _VALID_KINDS: ReadonlyArray<PilotErrorKind> = Object.freeze([
  'frontend',
  'api',
  'scan',
  'notification',
  'localization',
  'offline_sync',
]);

const _SUSPICIOUS_KEYS: ReadonlyArray<string> = Object.freeze([
  'farmerId',
  'userId',
  'name',
  'deviceId',
  'coords',
  'latitude',
  'longitude',
  'ip',
  'phone',
  'filename',
]);

export interface PilotErrorRecord {
  kind: PilotErrorKind;
  timestamp: number;
  route: string;
  userRole: string;
  errorType: string;
  message: string;
}

export interface PilotErrorMonitoringHealthEnvelope {
  initialized: true;
  storageReady: boolean;
  totalRecorded: number;
  byKind: Readonly<Record<PilotErrorKind, number>>;
  noPII: true;
  sanitizedBeforeWrite: true;
  composedFrom: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

const _EMPTY_BY_KIND: Readonly<Record<PilotErrorKind, number>> = Object.freeze({
  frontend: 0,
  api: 0,
  scan: 0,
  notification: 0,
  localization: 0,
  offline_sync: 0,
});

function _isString(v: any): v is string { return typeof v === 'string'; }
function _isFiniteNumber(v: any): v is number { return typeof v === 'number' && Number.isFinite(v); }

function _containsEmail(s: string): boolean {
  return _safe(() => s.indexOf('@') >= 0, false);
}

function _containsPhoneRun(s: string): boolean {
  return _safe(() => /\d{10,}/.test(s), false);
}

function _hasPII(value: string): boolean {
  return _containsEmail(value) || _containsPhoneRun(value);
}

/**
 * Internal sanitizer. Returns a clean record OR null when the input
 * has any PII signal we cannot safely strip (e.g. PII embedded in a
 * required field such as `message`, `route`, `errorType`, `userRole`).
 * Suspicious-keyed extra fields are simply dropped.
 */
function _sanitize(rec: any, nowMs: number): PilotErrorRecord | null {
  return _safe(() => {
    if (!rec || typeof rec !== 'object') return null;

    // Drop suspicious-keyed fields up front.
    const cleaned: Record<string, any> = {};
    for (const k of Object.keys(rec)) {
      if (_SUSPICIOUS_KEYS.indexOf(k) >= 0) continue;
      cleaned[k] = (rec as any)[k];
    }

    // Validate kind against the allow-list.
    const kind = cleaned.kind;
    if (!_isString(kind) || _VALID_KINDS.indexOf(kind as PilotErrorKind) < 0) {
      return null;
    }

    // Required string fields.
    const route = _isString(cleaned.route) ? cleaned.route : '';
    const userRole = _isString(cleaned.userRole) ? cleaned.userRole : '';
    const errorType = _isString(cleaned.errorType) ? cleaned.errorType : '';
    const rawMessage = _isString(cleaned.message) ? cleaned.message : '';

    // REJECT records whose required string fields carry PII signals.
    if (_hasPII(route)) return null;
    if (_hasPII(userRole)) return null;
    if (_hasPII(errorType)) return null;
    if (_hasPII(rawMessage)) return null;

    // Also reject any OTHER string field carrying PII signals — this
    // ensures even unknown keys cannot smuggle a PII payload through.
    for (const k of Object.keys(cleaned)) {
      if (k === 'kind' || k === 'route' || k === 'userRole'
          || k === 'errorType' || k === 'message' || k === 'timestamp') continue;
      const v = cleaned[k];
      if (_isString(v) && _hasPII(v)) return null;
    }

    const timestamp = _isFiniteNumber(nowMs) ? nowMs : 0;
    const message = rawMessage.length > PILOT_ERROR_MESSAGE_MAX
      ? rawMessage.slice(0, PILOT_ERROR_MESSAGE_MAX)
      : rawMessage;

    return Object.freeze<PilotErrorRecord>({
      kind: kind as PilotErrorKind,
      timestamp,
      route,
      userRole,
      errorType,
      message,
    });
  }, null);
}

function _readLog(): PilotErrorRecord[] {
  return _safe(() => {
    const raw = _ls(PILOT_ERROR_LOG_KEY);
    if (!Array.isArray(raw)) return [];
    const out: PilotErrorRecord[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const kind = entry.kind;
      if (!_isString(kind) || _VALID_KINDS.indexOf(kind as PilotErrorKind) < 0) continue;
      const route = _isString(entry.route) ? entry.route : '';
      const userRole = _isString(entry.userRole) ? entry.userRole : '';
      const errorType = _isString(entry.errorType) ? entry.errorType : '';
      const message = _isString(entry.message) ? entry.message : '';
      const timestamp = _isFiniteNumber(entry.timestamp) ? entry.timestamp : 0;
      // Defensive re-check on read — drop any record that somehow
      // carries PII signals (legacy / migrated data).
      if (_hasPII(route) || _hasPII(userRole)
          || _hasPII(errorType) || _hasPII(message)) continue;
      out.push(Object.freeze<PilotErrorRecord>({
        kind: kind as PilotErrorKind,
        timestamp,
        route,
        userRole,
        errorType,
        message: message.length > PILOT_ERROR_MESSAGE_MAX
          ? message.slice(0, PILOT_ERROR_MESSAGE_MAX)
          : message,
      }));
    }
    return out;
  }, []);
}

export function recordPilotError(
  rec: Omit<PilotErrorRecord, 'timestamp'>,
  nowMs: number,
): boolean {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const sanitized = _sanitize(rec as any, nowMs);
    if (!sanitized) return false;
    const log = _readLog();
    log.push(sanitized);
    // Bounded — drop oldest until at or below cap.
    while (log.length > PILOT_ERROR_LOG_MAX) log.shift();
    return _lsWrite(PILOT_ERROR_LOG_KEY, log);
  }, false);
}

export function listPilotErrors(limit: number = 50): ReadonlyArray<Readonly<PilotErrorRecord>> {
  return _safe(() => {
    const log = _readLog();
    const cap = _isFiniteNumber(limit) && limit > 0
      ? Math.min(Math.floor(limit), PILOT_ERROR_LOG_MAX)
      : 50;
    const slice = log.length > cap ? log.slice(log.length - cap) : log.slice();
    return Object.freeze(slice.map((r) => Object.freeze(r)));
  }, Object.freeze([]) as ReadonlyArray<Readonly<PilotErrorRecord>>);
}

export function errorMonitoringReady(): boolean {
  return _safe(() => typeof window !== 'undefined' && !!window.localStorage, false);
}

function _countByKind(log: ReadonlyArray<PilotErrorRecord>): Readonly<Record<PilotErrorKind, number>> {
  return _safe(() => {
    const acc: Record<PilotErrorKind, number> = {
      frontend: 0,
      api: 0,
      scan: 0,
      notification: 0,
      localization: 0,
      offline_sync: 0,
    };
    for (const r of log) {
      if (r && _VALID_KINDS.indexOf(r.kind) >= 0) acc[r.kind] = (acc[r.kind] || 0) + 1;
    }
    return Object.freeze(acc);
  }, _EMPTY_BY_KIND);
}

export function pilotErrorMonitoringHealth(): Readonly<PilotErrorMonitoringHealthEnvelope> {
  return _safe(() => {
    const storageReady = errorMonitoringReady();
    const log = _readLog();
    const totalRecorded = log.length;
    const byKind = _countByKind(log);
    return Object.freeze<PilotErrorMonitoringHealthEnvelope>({
      initialized: true,
      storageReady,
      totalRecorded,
      byKind,
      noPII: true as const,
      sanitizedBeforeWrite: true as const,
      composedFrom: Object.freeze([
        'localStorage:' + PILOT_ERROR_LOG_KEY,
      ]) as ReadonlyArray<string>,
      confidence: (totalRecorded >= 20 ? 'high'
        : totalRecorded >= 1 ? 'medium' : 'low') as Confidence,
      explanation:
        'Error monitoring runtime. Records frontend, api, scan, notification, ' +
        'localization, and offline_sync errors to a bounded localStorage log ' +
        '(' + PILOT_ERROR_LOG_KEY + ', cap ' + PILOT_ERROR_LOG_MAX + ', oldest ' +
        'dropped). NO PII: records are sanitized BEFORE write — keys ' +
        'farmerId/userId/name/deviceId/coords/latitude/longitude/ip/phone/' +
        'filename are stripped, and records whose string fields contain ' +
        'email-like (@) or phone-like (10+ digit run) substrings are rejected ' +
        'outright. Messages are truncated to ' + PILOT_ERROR_MESSAGE_MAX + ' chars.',
      limitations:
        'Captures only locally-observed errors persisted to this device; ' +
        'server-side error streams are out of scope. Counts reflect the ' +
        'current bounded log only. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<PilotErrorMonitoringHealthEnvelope>({
    initialized: true,
    storageReady: false,
    totalRecorded: 0,
    byKind: _EMPTY_BY_KIND,
    noPII: true as const,
    sanitizedBeforeWrite: true as const,
    composedFrom: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Pilot error monitoring runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installPilotErrorMonitoringGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__pilotErrorMonitoringHealth !== 'function') {
      w.__pilotErrorMonitoringHealth = function () {
        const out = pilotErrorMonitoringHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env
            && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Pilot Error Monitoring]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
