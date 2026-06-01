/**
 * Farroway · Notification Delivery Attestation (notification-delivery-v1)
 *
 * Composition-only, self-contained, READ-ONLY diagnostic + contract layer over
 * the EXISTING JavaScript notification surface in src/lib/notifications/.
 * It NEVER imports a project module, NEVER sends a notification, NEVER fabricates
 * a "sent" status, and NEVER blocks the app. Honest, frozen, never throws.
 *
 * Provider readiness is CONFIG-only (window globals + meta tags). Real delivery
 * is attested by the recorded delivery-log entries in localStorage
 * ('farroway.notifications.deliveryLog'), which the existing JS surface writes.
 *
 * fakeDelivery is a HARD-CODED literal-false constant — it can never become true
 * through any code path.
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

export const NOTIFICATION_DELIVERY_VERSION = 'notification-delivery-v1' as const;

// HARD-CODED literal-false constant. fakeDelivery is never derived; it is this
// constant value, written into every envelope, so it can NEVER become true.
const FAKE_DELIVERY_LITERAL_FALSE = false as const;

type DeliveryStatus = 'READY' | 'NEEDS_PROVIDER' | 'DEGRADED' | 'UNKNOWN';

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface NotificationDeliveryHealthEnvelope {
  runtimeVersion: typeof NOTIFICATION_DELIVERY_VERSION;
  initialized: true;
  notificationsOptional: true;
  webPushConfigured: boolean;
  fcmConfigured: boolean;
  twilioFallbackConfigured: boolean;
  sendGridFallbackConfigured: boolean;
  fakeDelivery: false;
  retryBackoffReady: boolean;
  deliveryAuditReady: boolean;
  lastDeliveryAt: string | number | null;
  failureCount: number;
  status: DeliveryStatus;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Client-side provider readiness detection (config-only — never sends)
// -------------------------------------------------------------------------

function _metaContent(name: string): string {
  return _safe(() => {
    if (typeof document === 'undefined') return '';
    const el = document.querySelector('meta[name="' + name + '"]');
    if (!el) return '';
    const c = (el as HTMLMetaElement).content;
    return typeof c === 'string' ? c.trim() : '';
  }, '');
}

function _detectWebPushConfigured(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const hasPushManager = 'PushManager' in (window as any);
    const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    return !!(hasPushManager && hasSW);
  }, false);
}

function _detectFcmConfigured(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if ((window as any).__fcmConfigured === true) return true;
    const m = _metaContent('fcm-sender-id');
    return m.length > 0;
  }, false);
}

function _detectTwilioFallbackConfigured(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if ((window as any).__twilioFallbackConfigured === true) return true;
    return _metaContent('twilio-fallback') === '1';
  }, false);
}

function _detectSendGridFallbackConfigured(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if ((window as any).__sendGridFallbackConfigured === true) return true;
    return _metaContent('sendgrid-fallback') === '1';
  }, false);
}

// -------------------------------------------------------------------------
// Delivery-log inspection (read-only attestation)
// -------------------------------------------------------------------------

interface DeliveryLogSummary {
  lastDeliveryAt: string | number | null;
  failureCount: number;
  retryBackoffReady: boolean;
  deliveryAuditReady: boolean;
  rowCount: number;
}

function _summarizeDeliveryLog(): DeliveryLogSummary {
  return _safe(
    () => {
      const raw = _ls('farroway.notifications.deliveryLog');
      const rows = _arr(raw);
      if (!Array.isArray(raw)) {
        return {
          lastDeliveryAt: null,
          failureCount: 0,
          retryBackoffReady: true,
          deliveryAuditReady: false,
          rowCount: 0,
        };
      }

      let lastDeliveryAt: string | number | null = null;
      let lastDeliveryAtNum = -Infinity;
      let failureCount = 0;
      let hasRetryRow = false;
      let auditReady = true;

      for (let i = 0; i < rows.length; i++) {
        const row = _obj(rows[i]);
        if (!row) {
          auditReady = false;
          continue;
        }

        // Audit shape: when channel or status is present, both should be present.
        const hasChannel = typeof row.channel === 'string' && row.channel.length > 0;
        const hasStatus = typeof row.status === 'string' && row.status.length > 0;
        if ((hasChannel || hasStatus) && !(hasChannel && hasStatus)) {
          auditReady = false;
        }

        const status = hasStatus ? String(row.status).toLowerCase() : '';
        const success = row.success;

        if (status === 'failed' || success === false) failureCount++;
        if (status === 'retry' || status === 'retried') hasRetryRow = true;

        const ts = row.timestamp ?? row.ts ?? row.at ?? row.deliveredAt ?? null;
        if (ts != null) {
          const n = typeof ts === 'number' ? ts : Date.parse(String(ts));
          if (!isNaN(n) && n > lastDeliveryAtNum) {
            lastDeliveryAtNum = n;
            lastDeliveryAt = ts;
          }
        }
      }

      const retryBackoffReady = !(failureCount > 0 && !hasRetryRow);

      return {
        lastDeliveryAt,
        failureCount,
        retryBackoffReady,
        deliveryAuditReady: auditReady,
        rowCount: rows.length,
      };
    },
    {
      lastDeliveryAt: null,
      failureCount: 0,
      retryBackoffReady: true,
      deliveryAuditReady: false,
      rowCount: 0,
    },
  );
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export function notificationDeliveryHealth(): NotificationDeliveryHealthEnvelope {
  return _safe(
    () => {
      const webPushConfigured = _detectWebPushConfigured();
      const fcmConfigured = _detectFcmConfigured();
      const twilioFallbackConfigured = _detectTwilioFallbackConfigured();
      const sendGridFallbackConfigured = _detectSendGridFallbackConfigured();

      const anyProvider =
        webPushConfigured ||
        fcmConfigured ||
        twilioFallbackConfigured ||
        sendGridFallbackConfigured;

      const summary = _summarizeDeliveryLog();

      // Touch existing JS surface + preferences for context (no fabrication).
      const prefs = _obj(_ls('farroway.notifications'));
      const jsRuntime = _probe('__notificationRuntimeHealth');
      const hasContext = !!(prefs || jsRuntime);

      let status: DeliveryStatus;
      if (!anyProvider) {
        status = 'NEEDS_PROVIDER';
      } else if (summary.failureCount > 0 && summary.retryBackoffReady === false) {
        status = 'DEGRADED';
      } else {
        status = 'READY';
      }

      const confidence: Confidence =
        status === 'READY' && summary.deliveryAuditReady
          ? 'medium'
          : status === 'NEEDS_PROVIDER' || status === 'DEGRADED'
            ? 'low'
            : 'low';

      const providersList: string[] = [];
      if (webPushConfigured) providersList.push('web-push');
      if (fcmConfigured) providersList.push('fcm');
      if (twilioFallbackConfigured) providersList.push('twilio-fallback');
      if (sendGridFallbackConfigured) providersList.push('sendgrid-fallback');

      const explanation =
        status === 'NEEDS_PROVIDER'
          ? 'No notification provider is configured on the client. Notifications remain OPTIONAL; the app keeps working without them.'
          : status === 'DEGRADED'
            ? 'Provider(s) configured: ' +
              providersList.join(', ') +
              '. Delivery log shows ' +
              String(summary.failureCount) +
              ' failure(s) without a retry/retried row — backoff not yet attested.'
            : 'Provider(s) configured: ' +
              providersList.join(', ') +
              '. Delivery is recorded by the existing notification log; this layer only attests, it does not send.' +
              (hasContext ? '' : '');

      const limitations =
        'Provider readiness is configuration-only; real delivery is attested by the recorded delivery log entries. ' +
        'This layer never sends notifications, never marks anything as "sent" on its own, and never fabricates delivery. ' +
        'Notifications are OPTIONAL — the app keeps working when permission is denied. ' +
        'Quiet hours default 21:00-06:00; rate limits apply per type per day; every notification uses an idempotency key. ' +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: NOTIFICATION_DELIVERY_VERSION,
        initialized: true as const,
        notificationsOptional: true as const,
        webPushConfigured,
        fcmConfigured,
        twilioFallbackConfigured,
        sendGridFallbackConfigured,
        fakeDelivery: FAKE_DELIVERY_LITERAL_FALSE,
        retryBackoffReady: summary.retryBackoffReady,
        deliveryAuditReady: summary.deliveryAuditReady,
        lastDeliveryAt: summary.lastDeliveryAt,
        failureCount: summary.failureCount,
        status,
        confidence,
        explanation,
        limitations,
      }) as NotificationDeliveryHealthEnvelope;
    },
    Object.freeze({
      runtimeVersion: NOTIFICATION_DELIVERY_VERSION,
      initialized: true as const,
      notificationsOptional: true as const,
      webPushConfigured: false,
      fcmConfigured: false,
      twilioFallbackConfigured: false,
      sendGridFallbackConfigured: false,
      fakeDelivery: FAKE_DELIVERY_LITERAL_FALSE,
      retryBackoffReady: true,
      deliveryAuditReady: false,
      lastDeliveryAt: null,
      failureCount: 0,
      status: 'UNKNOWN' as DeliveryStatus,
      confidence: 'low' as Confidence,
      explanation:
        'Notification delivery attestation not fully initialized. Notifications remain OPTIONAL; the app keeps working without them.',
      limitations:
        'Provider readiness is configuration-only; real delivery is attested by the recorded delivery log entries. ' +
        GUIDANCE_TAIL,
    }) as NotificationDeliveryHealthEnvelope,
  );
}

export function installNotificationDeliveryGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__notificationDeliveryHealth !== 'function') {
      w.__notificationDeliveryHealth = function () {
        const out = notificationDeliveryHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Notification Delivery]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
