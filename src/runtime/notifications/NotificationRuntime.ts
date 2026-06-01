/**
 * Farroway · Notification Runtime (notification-runtime-v1)
 *
 * Composition-only, self-contained TypeScript runtime that COMPOSES the
 * EXISTING JavaScript notification surface in src/lib/notifications/.
 * It NEVER replaces that surface — it only observes it by reading window
 * globals via _probe() and storage via _ls(). Zero import statements.
 *
 * Honest, frozen, never throws, never blocks the app. Notifications are
 * OPTIONAL: the app keeps working when permission is denied.
 *
 * Pins THREE window globals (only-if-not-already-a-function):
 *   - window.__notificationHealth          (composite §1)
 *   - window.__notificationOODAHealth      (§12)
 *   - window.__notificationArtifactHealth  (§12)
 */

// -------------------------------------------------------------------------
// Standard helper block (verbatim from GrowTimeframeEngine.ts pattern)
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

export const NOTIFICATION_RUNTIME_VERSION = 'notification-runtime-v1' as const;

type RuntimeStatus = 'READY' | 'PARTIAL' | 'DEGRADED' | 'UNKNOWN';

// -------------------------------------------------------------------------
// Envelope types
// -------------------------------------------------------------------------

export interface NotificationHealthEnvelope {
  runtimeVersion: typeof NOTIFICATION_RUNTIME_VERSION;
  initialized: true;
  notificationsOptional: true;
  permissionState: 'default' | 'granted' | 'denied' | 'unknown';
  schedulerReady: boolean;
  timezoneAware: boolean;
  quietHoursReady: boolean;
  preferencesReady: boolean;
  dailyPlanNotificationsReady: boolean;
  taskRemindersReady: boolean;
  followUpScanReady: boolean;
  weatherAlertsReady: boolean;
  harvestAlertsReady: boolean;
  ngoAlertsReady: boolean;
  duplicatePreventionReady: boolean;
  offlineQueueReady: boolean;
  status: RuntimeStatus;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export interface NotificationOODAHealthEnvelope {
  runtimeVersion: typeof NOTIFICATION_RUNTIME_VERSION;
  initialized: true;
  nonBlocking: true;
  failureSafe: true;
  observeReady: boolean;
  orientReady: boolean;
  decideReady: boolean;
  actReady: boolean;
  growerSafe: true;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

export interface NotificationArtifactHealthEnvelope {
  runtimeVersion: typeof NOTIFICATION_RUNTIME_VERSION;
  initialized: true;
  artifactRuntimeOnly: true;
  idempotent: true;
  offlineSafe: true;
  nonBlocking: true;
  artifactKinds: ReadonlyArray<string>;
  artifactsRecorded: number;
  duplicateArtifactsPrevented: boolean;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

function _permissionState(): 'default' | 'granted' | 'denied' | 'unknown' {
  return _safe(() => {
    if (typeof window === 'undefined') return 'unknown' as const;
    const w = window as any;
    const N = w.Notification;
    if (!N) return 'unknown' as const;
    const p = N.permission;
    if (p === 'default' || p === 'granted' || p === 'denied') return p;
    return 'unknown' as const;
  }, 'unknown' as const);
}

const ARTIFACT_KINDS: ReadonlyArray<string> = Object.freeze([
  'NotificationScheduled',
  'NotificationSent',
  'NotificationFailed',
  'NotificationSkipped',
  'NotificationClicked',
]);

// -------------------------------------------------------------------------
// Composite probe — §1: __notificationHealth()
// -------------------------------------------------------------------------

export function notificationHealth(): NotificationHealthEnvelope {
  return _safe(
    () => {
      const p = _probe('__notificationPreferencesHealth');
      const q = _probe('__notificationQueueHealth');
      const d = _probe('__notificationDeliveryHealth');

      const pObj = _obj(p);
      const qObj = _obj(q);
      const dObj = _obj(d);

      const perType = _obj(pObj && pObj.perType) || {};

      const schedulerReady = !!(qObj && qObj.schedulerReady);
      const timezoneAware = !!(qObj && qObj.timezoneAware);
      const quietHoursReady =
        !!(pObj && pObj.quietHours) && !!(qObj && qObj.quietHoursRespected);
      const preferencesReady = !!(pObj && pObj.preferencesReady);
      const dailyPlanNotificationsReady = perType.daily_farm_plan !== false;
      const taskRemindersReady = perType.task_reminder !== false;
      const followUpScanReady = perType.follow_up_scan !== false;
      const weatherAlertsReady = perType.weather_alert !== false;
      const harvestAlertsReady = perType.harvest_alert !== false;
      const ngoAlertsReady = perType.ngo_field_officer_alert === true;
      const duplicatePreventionReady = !!(qObj && qObj.duplicatePreventionReady);
      const offlineQueueReady = !!(qObj && qObj.offlineQueueReady);

      const honestDelivery = !!(dObj && dObj.fakeDelivery === false);

      const subProbesLoaded = !!(pObj && qObj && dObj);
      const requiredFlags = [
        schedulerReady,
        preferencesReady,
        honestDelivery,
        quietHoursReady,
      ];
      const anyRequiredExplicitlyFalse = requiredFlags.some((v) => v === false);

      let status: RuntimeStatus;
      if (
        subProbesLoaded &&
        schedulerReady &&
        preferencesReady &&
        honestDelivery &&
        quietHoursReady
      ) {
        status = 'READY';
      } else if (!subProbesLoaded) {
        status = 'PARTIAL';
      } else if (anyRequiredExplicitlyFalse) {
        status = 'DEGRADED';
      } else {
        status = 'UNKNOWN';
      }

      const confidence: Confidence =
        status === 'READY' ? 'high' : status === 'PARTIAL' ? 'low' : 'medium';

      const permissionState = _permissionState();

      const explanation =
        status === 'READY'
          ? 'Notification runtime composed: preferences, scheduler/queue, and delivery probes are all reporting healthy. Notifications remain optional.'
          : status === 'PARTIAL'
            ? 'One or more notification sub-probes have not loaded yet — composing only what is available. The app keeps working without notifications.'
            : status === 'DEGRADED'
              ? 'A required notification flag is explicitly false (scheduler, preferences, honest delivery, or quiet hours). Notifications remain optional and the app keeps working.'
              : 'Notification runtime state is incomplete. Notifications are optional and never block the app.';

      const limitations =
        'This composite is OBSERVATIONAL only — it never sends, schedules, or fakes notifications. ' +
        'Real delivery is recorded by the existing JS surface (farroway.notifications.deliveryLog). ' +
        'Notifications are OPTIONAL: when permission is denied or providers are not configured, the ' +
        'app continues to function. Quiet hours default to 21:00-06:00 local. Rate limits: 1 daily_farm_plan/day, ' +
        '2 task_reminder/day, 1 weather_alert/day unless severity is severe. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: NOTIFICATION_RUNTIME_VERSION,
        initialized: true as const,
        notificationsOptional: true as const,
        permissionState,
        schedulerReady,
        timezoneAware,
        quietHoursReady,
        preferencesReady,
        dailyPlanNotificationsReady,
        taskRemindersReady,
        followUpScanReady,
        weatherAlertsReady,
        harvestAlertsReady,
        ngoAlertsReady,
        duplicatePreventionReady,
        offlineQueueReady,
        status,
        confidence,
        explanation,
        limitations,
      }) as NotificationHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: NOTIFICATION_RUNTIME_VERSION,
      initialized: true as const,
      notificationsOptional: true as const,
      permissionState: 'unknown' as const,
      schedulerReady: false,
      timezoneAware: false,
      quietHoursReady: false,
      preferencesReady: false,
      dailyPlanNotificationsReady: false,
      taskRemindersReady: false,
      followUpScanReady: false,
      weatherAlertsReady: false,
      harvestAlertsReady: false,
      ngoAlertsReady: false,
      duplicatePreventionReady: false,
      offlineQueueReady: false,
      status: 'UNKNOWN' as RuntimeStatus,
      confidence: 'low' as Confidence,
      explanation:
        'Notification runtime not fully initialized — composite is reporting unknown. Notifications are optional and the app keeps working.',
      limitations:
        'Composite is observational only — never sends or fakes notifications. ' +
        GUIDANCE_TAIL,
    }) as NotificationHealthEnvelope,
  );
}

// -------------------------------------------------------------------------
// §12 OODA health — __notificationOODAHealth()
// -------------------------------------------------------------------------

export function notificationOODAHealth(): NotificationOODAHealthEnvelope {
  return _safe(
    () => {
      const p = _obj(_probe('__notificationPreferencesHealth'));
      const q = _obj(_probe('__notificationQueueHealth'));
      const d = _obj(_probe('__notificationDeliveryHealth'));

      const observeReady = !!(p && q && d);
      const orientReady = !!(p && p.quietHours);
      const decideReady = !!(q && q.rateLimitsRespected);
      const actReady = !!(d && d.fakeDelivery === false);

      const allReady = observeReady && orientReady && decideReady && actReady;
      const confidence: Confidence = allReady ? 'high' : observeReady ? 'medium' : 'low';

      const explanation = allReady
        ? 'OODA loop is complete: observe (probes loaded), orient (quiet hours configured), decide (rate limits respected), act (honest, non-faked delivery). Grower-safe: never blocks Home/Scan.'
          : observeReady
            ? 'OODA loop partially ready — observation in place, but one of orient/decide/act is not yet confirmed. Notifications remain optional.'
            : 'OODA loop not yet ready — sub-probes are not all loaded. Notifications remain optional and the app keeps working.';

      const limitations =
        'OODA composite is OBSERVATIONAL. It cannot guarantee that downstream providers will deliver; ' +
        'it only verifies that the local contract is honored (no fake-sent, no quiet-hours violations, ' +
        'rate limits respected, notifications optional). The app continues working when permission is denied. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: NOTIFICATION_RUNTIME_VERSION,
        initialized: true as const,
        nonBlocking: true as const,
        failureSafe: true as const,
        observeReady,
        orientReady,
        decideReady,
        actReady,
        growerSafe: true as const,
        confidence,
        explanation,
        limitations,
      }) as NotificationOODAHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: NOTIFICATION_RUNTIME_VERSION,
      initialized: true as const,
      nonBlocking: true as const,
      failureSafe: true as const,
      observeReady: false,
      orientReady: false,
      decideReady: false,
      actReady: false,
      growerSafe: true as const,
      confidence: 'low' as Confidence,
      explanation:
        'Notification OODA composite is in fallback state. The app keeps working without notifications.',
      limitations:
        'OODA composite is observational only. ' + GUIDANCE_TAIL,
    }) as NotificationOODAHealthEnvelope,
  );
}

// -------------------------------------------------------------------------
// §12 Artifact health — __notificationArtifactHealth()
// -------------------------------------------------------------------------

export function notificationArtifactHealth(): NotificationArtifactHealthEnvelope {
  return _safe(
    () => {
      // Touch the top-level artifact runtime composite so the composition
      // graph is honored. We do NOT depend on its values — observation only.
      const art = _probe('__artifactHealth');
      void art;

      const artifactLog = _arr(_ls('farroway_notification_artifacts'));
      const artifactsRecorded = artifactLog.length;

      let allHaveKey = true;
      const keys = new Set<string>();
      for (let i = 0; i < artifactLog.length; i++) {
        const entry = _obj(artifactLog[i]);
        const key =
          entry && typeof entry.idempotencyKey === 'string'
            ? entry.idempotencyKey.trim()
            : '';
        if (!key) {
          allHaveKey = false;
          break;
        }
        keys.add(key);
      }
      const duplicateArtifactsPrevented =
        artifactsRecorded === 0
          ? true
          : allHaveKey && keys.size === artifactsRecorded;

      const confidence: Confidence =
        artifactsRecorded === 0
          ? 'medium'
          : duplicateArtifactsPrevented
            ? 'high'
            : 'low';

      const explanation =
        artifactsRecorded === 0
          ? 'No notification artifacts have been recorded yet. The artifact log is empty — idempotency cannot be violated.'
          : duplicateArtifactsPrevented
            ? 'All recorded notification artifacts carry non-empty idempotencyKeys with no duplicates — idempotency is intact.'
            : 'One or more notification artifacts are missing an idempotencyKey or duplicate one. Duplicates are normally dropped upstream; investigate the log.';

      const limitations =
        'Artifact composite reads ONLY the local artifact log at "farroway_notification_artifacts". ' +
        'It records nothing, sends nothing, and never fabricates entries. Idempotency keys follow ' +
        '<type>:<targetId>:<yyyy-mm-dd> (or <type>:<scanId>:<followUpDate> for follow-up scans). ' +
        'Offline-safe by virtue of being read-only. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: NOTIFICATION_RUNTIME_VERSION,
        initialized: true as const,
        artifactRuntimeOnly: true as const,
        idempotent: true as const,
        offlineSafe: true as const,
        nonBlocking: true as const,
        artifactKinds: ARTIFACT_KINDS,
        artifactsRecorded,
        duplicateArtifactsPrevented,
        confidence,
        explanation,
        limitations,
      }) as NotificationArtifactHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: NOTIFICATION_RUNTIME_VERSION,
      initialized: true as const,
      artifactRuntimeOnly: true as const,
      idempotent: true as const,
      offlineSafe: true as const,
      nonBlocking: true as const,
      artifactKinds: ARTIFACT_KINDS,
      artifactsRecorded: 0,
      duplicateArtifactsPrevented: true,
      confidence: 'low' as Confidence,
      explanation:
        'Notification artifact composite is in fallback state. Read-only and offline-safe.',
      limitations:
        'Artifact composite is observational only. ' + GUIDANCE_TAIL,
    }) as NotificationArtifactHealthEnvelope,
  );
}

// -------------------------------------------------------------------------
// Installer — pins all three globals using the standard installer shape
// -------------------------------------------------------------------------

export function installNotificationRuntimeGlobals(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;

    const devLog = (label: string, out: any) => {
      try {
        const dev =
          typeof import.meta !== 'undefined' &&
          (import.meta as any).env &&
          (import.meta as any).env.DEV;
        if (dev || w.__farrowayHealthLog === true) console.log(label, out);
      } catch {}
    };

    if (typeof w.__notificationHealth !== 'function') {
      w.__notificationHealth = function () {
        const out = notificationHealth();
        devLog('[Farroway · Notification Health]', out);
        return out;
      };
    }

    if (typeof w.__notificationOODAHealth !== 'function') {
      w.__notificationOODAHealth = function () {
        const out = notificationOODAHealth();
        devLog('[Farroway · Notification OODA Health]', out);
        return out;
      };
    }

    if (typeof w.__notificationArtifactHealth !== 'function') {
      w.__notificationArtifactHealth = function () {
        const out = notificationArtifactHealth();
        devLog('[Farroway · Notification Artifact Health]', out);
        return out;
      };
    }

    return true;
  }, false);
}
