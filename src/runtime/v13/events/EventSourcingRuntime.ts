/**
 * Farroway · Event Sourcing Runtime (event-sourcing-v13)
 *
 * Composition-only, self-contained decision-support / readiness runtime for
 * the v13 event-sourcing posture. It NEVER imports a project module and reads
 * live data ONLY via the `_ls()` helper below. Same-folder sibling imports of
 * the pure contract / replay-readiness modules are permitted for THIS runtime.
 *
 * It documents and surfaces the platform's event-sourcing guarantees:
 *   - immutable, append-only event log (no mutate, no delete)
 *   - a deterministic idempotency key is required on every appended event
 *   - tenant / org scope is required where the canonical contract says so
 *   - no private data should live in a payload unless strictly necessary
 *   - no UI surface writes directly to the log (writes go through the runtime)
 *
 * It never fabricates: no random values, no clock-seeded data signals, no
 * yield / revenue forecasts, no ML predictions. `confidence` is a LABEL.
 * When no events exist it returns an honest "Not enough data yet" result.
 *
 * NEVER throws. All returned envelopes are frozen.
 */

import { CANONICAL_EVENTS, requiresOrgScope } from './EventContract';
import { eventReplayReadiness } from './EventReplayReadiness';
import type { EventReplayEnvelope } from './EventReplayReadiness';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

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

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

export const EVENT_SOURCING_RUNTIME_VERSION = 'event-sourcing-v13';

export interface EventSourcingEnvelope {
  runtimeVersion: 'event-sourcing-v13';
  initialized: true;
  immutableAppendReady: boolean;
  idempotencyRequired: true;
  tenantScopeRequired: true;
  noUIDirectWrites: true;
  canonicalEvents: readonly string[];
  eventCount: number;
  replay: EventReplayEnvelope;
  value: any;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export function eventSourcingHealth(): EventSourcingEnvelope {
  return _safe(
    () => {
      const replay = eventReplayReadiness();
      const log = _arr(_ls('farroway_event_log'));
      const eventCount = log.length;

      // The canonical org-scoped subset, named honestly from the contract.
      const orgScopedEvents = (CANONICAL_EVENTS as readonly string[]).filter((n) =>
        requiresOrgScope(n),
      );

      // Append-only readiness is an honest reflection of stored log shape.
      const immutableAppendReady = eventCount > 0 ? replay.appendOnlyReady : false;

      const dataSources = ['farroway_event_log (localStorage)'];

      if (eventCount === 0) {
        return Object.freeze({
          runtimeVersion: EVENT_SOURCING_RUNTIME_VERSION,
          initialized: true as const,
          immutableAppendReady: false,
          idempotencyRequired: true as const,
          tenantScopeRequired: true as const,
          noUIDirectWrites: true as const,
          canonicalEvents: CANONICAL_EVENTS,
          eventCount: 0,
          replay,
          value: Object.freeze({
            summary: 'Not enough data yet — no events have been recorded on this device.',
            canonicalEventCount: CANONICAL_EVENTS.length,
            orgScopedEvents: Object.freeze(orgScopedEvents),
            contract: Object.freeze({
              immutableAppendOnly: 'Events are append-only; existing entries are never mutated or deleted.',
              idempotencyRequired:
                'Every appended event must carry a deterministic idempotency key so re-delivery is de-duplicated.',
              tenantScopeRequired:
                'Org-scoped events must carry a tenant / org scope; appending one without it is a contract violation.',
              noPrivateDataInPayload:
                'Payloads should avoid private data unless strictly necessary for the event.',
              noUIDirectWrites:
                'UI surfaces never write to the log directly; writes go through the event-sourcing runtime.',
            }),
            guidance: 'Record events through the runtime to begin building the immutable log. ' + GUIDANCE_TAIL,
          }),
          confidence: 'low' as Confidence,
          dataSources: Object.freeze(dataSources) as unknown as string[],
          explanation: 'Not enough data yet — the event log is empty on this device.',
          limitations:
            'This reflects only the event log stored on this device so far and describes the intended event-sourcing contract, not a server-side audit. ' +
            GUIDANCE_TAIL,
        }) as EventSourcingEnvelope;
      }

      const confidence: Confidence =
        replay.replayReady && eventCount >= 5
          ? 'high'
          : immutableAppendReady || replay.idempotencyReady
          ? 'medium'
          : 'low';

      const explanation =
        'Stored event log holds ' +
        eventCount +
        ' record' +
        (eventCount === 1 ? '' : 's') +
        '. ' +
        (immutableAppendReady
          ? 'Records look append-only and ordered. '
          : 'Some records are missing an append-only ordering/name signal. ') +
        (replay.idempotencyReady
          ? 'Every record carries an idempotency key. '
          : 'Some records are missing an idempotency key — watch for possible duplicates on replay. ');

      const value = Object.freeze({
        summary:
          'Event-sourcing posture summarized from ' +
          eventCount +
          ' stored event' +
          (eventCount === 1 ? '' : 's') +
          '.',
        canonicalEventCount: CANONICAL_EVENTS.length,
        orgScopedEvents: Object.freeze(orgScopedEvents),
        replayReady: replay.replayReady,
        appendOnlyReady: immutableAppendReady,
        idempotencyReady: replay.idempotencyReady,
        contract: Object.freeze({
          immutableAppendOnly: 'Events are append-only; existing entries are never mutated or deleted.',
          idempotencyRequired:
            'Every appended event must carry a deterministic idempotency key so re-delivery is de-duplicated.',
          tenantScopeRequired:
            'Org-scoped events must carry a tenant / org scope; appending one without it is a contract violation.',
          noPrivateDataInPayload:
            'Payloads should avoid private data unless strictly necessary for the event.',
          noUIDirectWrites:
            'UI surfaces never write to the log directly; writes go through the event-sourcing runtime.',
        }),
        guidance:
          (replay.replayReady
            ? 'Replay looks safe; continue appending through the runtime.'
            : 'Review records missing ordering or idempotency before relying on replay.') +
          ' ' +
          GUIDANCE_TAIL,
      });

      return Object.freeze({
        runtimeVersion: EVENT_SOURCING_RUNTIME_VERSION,
        initialized: true as const,
        immutableAppendReady,
        idempotencyRequired: true as const,
        tenantScopeRequired: true as const,
        noUIDirectWrites: true as const,
        canonicalEvents: CANONICAL_EVENTS,
        eventCount,
        replay,
        value,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations:
          'This reflects only the event log stored on this device so far and describes the intended event-sourcing contract, not a server-side audit. ' +
          GUIDANCE_TAIL,
      }) as EventSourcingEnvelope;
    },
    // --- absolute fallback if anything above throws ---
    Object.freeze({
      runtimeVersion: EVENT_SOURCING_RUNTIME_VERSION,
      initialized: true as const,
      immutableAppendReady: false,
      idempotencyRequired: true as const,
      tenantScopeRequired: true as const,
      noUIDirectWrites: true as const,
      canonicalEvents: CANONICAL_EVENTS,
      eventCount: 0,
      replay: eventReplayReadiness(),
      value: Object.freeze({
        summary: 'Not enough data yet — event-sourcing health could not be determined.',
        canonicalEventCount: CANONICAL_EVENTS.length,
        guidance: 'Record events through the runtime to begin building the immutable log. ' + GUIDANCE_TAIL,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze(['farroway_event_log (localStorage)']) as unknown as string[],
      explanation: 'Not enough data yet — event-sourcing health could not be determined.',
      limitations:
        'This reflects only the event log stored on this device so far and describes the intended event-sourcing contract, not a server-side audit. ' +
        GUIDANCE_TAIL,
    }) as EventSourcingEnvelope,
  );
}

export function installEventSourcingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__eventSourcingHealth !== 'function') {
      w.__eventSourcingHealth = function () {
        const out = eventSourcingHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Event Sourcing]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
