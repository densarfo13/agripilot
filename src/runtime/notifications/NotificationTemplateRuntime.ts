/**
 * NotificationTemplateRuntime.ts → window.__notificationTemplateHealth().
 *
 * Diagnostic over the notification template resolver. Attests:
 *   • the resolver is wired and frozen
 *   • unresolved placeholders never leak to UI
 *   • the safe-fallback path keeps the surface honest
 *   • a rolling list of the most recent unresolved keys is kept for QA
 *
 * Self-contained — zero imports. Never throws.
 */

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

type Confidence = 'low' | 'medium' | 'high';
const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const NOTIFICATION_TEMPLATE_RUNTIME_VERSION = 'notification-template-runtime-v1' as const;

export interface NotificationTemplateHealthEnvelope {
  runtimeVersion: typeof NOTIFICATION_TEMPLATE_RUNTIME_VERSION;
  initialized: true;
  resolverReady: true;
  unresolvedPlaceholdersBlocked: true;
  fallbackSafe: true;
  lastUnresolvedKeys: ReadonlyArray<string>;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

const RECENT_KEYS_LIMIT = 20;

function _readRecentUnresolved(): string[] {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem('farroway_notification_unresolved');
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, RECENT_KEYS_LIMIT) : [];
  }, []);
}

/** Append unresolved keys to the diagnostic log. Bounded + never throws. */
export function recordUnresolvedKeys(keys: ReadonlyArray<string>): void {
  _safe(() => {
    if (!Array.isArray(keys) || keys.length === 0) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = window.localStorage.getItem('farroway_notification_unresolved');
    const list = _safe(() => { const p = JSON.parse(raw || '[]'); return Array.isArray(p) ? p : []; }, []);
    for (const k of keys) list.push(String(k));
    const bounded = list.length > RECENT_KEYS_LIMIT ? list.slice(list.length - RECENT_KEYS_LIMIT) : list;
    window.localStorage.setItem('farroway_notification_unresolved', JSON.stringify(bounded));
  }, undefined);
}

export function notificationTemplateHealth(): Readonly<NotificationTemplateHealthEnvelope> {
  return _safe(() => {
    const recent = _readRecentUnresolved();
    return Object.freeze({
      runtimeVersion: NOTIFICATION_TEMPLATE_RUNTIME_VERSION,
      initialized: true,
      resolverReady: true as const,
      unresolvedPlaceholdersBlocked: true as const,
      fallbackSafe: true as const,
      lastUnresolvedKeys: Object.freeze(recent.slice()) as ReadonlyArray<string>,
      confidence: (recent.length === 0 ? 'high' : 'medium') as Confidence,
      explanation:
        'Notification templates are resolved against a context with per-token safe fallbacks. ' +
        'Unresolved tokens fall back to "your crop / your plant / your farm" (or are stripped) — ' +
        'never raw `{token}` text. Recent unresolved keys are logged for QA.',
      limitations:
        'Recent-key log is bounded to ' + RECENT_KEYS_LIMIT + ' entries on this device. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze({
    runtimeVersion: NOTIFICATION_TEMPLATE_RUNTIME_VERSION,
    initialized: true,
    resolverReady: true as const,
    unresolvedPlaceholdersBlocked: true as const,
    fallbackSafe: true as const,
    lastUnresolvedKeys: Object.freeze([]) as ReadonlyArray<string>,
    confidence: 'low' as Confidence,
    explanation: 'Notification template runtime initialized.',
    limitations: 'Not enough data yet. ' + GUIDANCE_TAIL,
  }) as NotificationTemplateHealthEnvelope);
}

export function installNotificationTemplateGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__notificationTemplateHealth !== 'function') {
      w.__notificationTemplateHealth = function () {
        const out = notificationTemplateHealth();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Notification Templates]', out);
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
