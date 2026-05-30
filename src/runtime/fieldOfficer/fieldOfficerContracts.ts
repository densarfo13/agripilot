/**
 * src/runtime/fieldOfficer/fieldOfficerContracts.ts — Frozen
 * contracts for the Farroway Field Officer workflow runtime.
 *
 *   import {
 *     FIELD_OFFICER_RUNTIME_VERSION,
 *     FIELD_OFFICER_STORAGE_KEY,
 *     INTERVENTION_STATUS, INTERVENTION_CHANNEL,
 *     type InterventionRecord, type InterventionStatus,
 *     type InterventionChannel,
 *   } from 'src/runtime/fieldOfficer/fieldOfficerContracts';
 *
 * What this is
 * ────────────
 *   Pure constants + types. The runtime engine reads these to know
 *   what status strings and channel strings are legal, and what an
 *   InterventionRecord envelope looks like.
 *
 * PII contract
 * ────────────
 *   InterventionRecord NEVER carries farmer name, phone, email,
 *   exact coords, device id, or IP. The only farmer-identifying
 *   field is `farmerRef`, an opaque caller-supplied scoped string
 *   (e.g. `partner:{hash}`). `organizationId` is also caller-supplied
 *   — this runtime NEVER reads org id from session.
 *
 * Strict-rule audit
 *   • Pure data, no side effects, no imports of engines.
 *   • SSR-safe. Never throws.
 *   • Frozen at module load.
 */

export const FIELD_OFFICER_RUNTIME_VERSION = 'field-officer-v1';

/**
 * localStorage key the FieldOfficerRuntime owns as the single
 * writer. The UI MUST NOT touch this key directly — go through the
 * runtime API (single-writer invariant).
 */
export const FIELD_OFFICER_STORAGE_KEY = 'farroway.fieldOfficer.queue';

/**
 * Lifecycle of an intervention record on the device.
 *   open      — created via startVisit(); accepting notes/evidence.
 *   completed — completeIntervention() stamped it locally. Awaits
 *               drain by the existing offlineQueue.
 *   synced    — drained by the offlineQueue (this runtime never
 *               mutates to this state itself; reserved for the
 *               offline queue ack path).
 */
export const INTERVENTION_STATUS = Object.freeze({
  OPEN:      'open',
  COMPLETED: 'completed',
  SYNCED:    'synced',
});
export type InterventionStatus =
  (typeof INTERVENTION_STATUS)[keyof typeof INTERVENTION_STATUS];

/**
 * Channel the intervention was conducted through.
 *   field_visit — in-person visit at the farmer's plot.
 *   follow_up   — async follow-up (call back, message, etc.).
 */
export const INTERVENTION_CHANNEL = Object.freeze({
  FIELD_VISIT: 'field_visit',
  FOLLOW_UP:   'follow_up',
});
export type InterventionChannel =
  (typeof INTERVENTION_CHANNEL)[keyof typeof INTERVENTION_CHANNEL];

/**
 * A single note appended to an intervention. Body is caller text —
 * UI is responsible for not pasting PII into it; this runtime makes
 * a best-effort defensive scrub (see FieldOfficerRuntime._scrubNote)
 * but does not guarantee redaction.
 */
export interface InterventionNote {
  readonly id:        string;
  readonly body:      string;
  readonly timestamp: number;
}

/**
 * Evidence attachment — caller supplies an opaque reference (URL,
 * blob id, asset hash). The runtime does not fetch or inspect it.
 * No PII fields are accepted (no captureLat/captureLng/deviceId).
 */
export interface InterventionEvidence {
  readonly id:        string;
  readonly kind:      string;   // e.g. 'photo' | 'audio' | 'document'
  readonly ref:       string;   // opaque caller-supplied reference
  readonly timestamp: number;
}

/**
 * The frozen envelope persisted to localStorage and returned from
 * every public list/read API.
 *
 * Persistence-safe fields ONLY. NEVER add: farmerName, phone,
 * email, lat, lng, deviceId, ip.
 */
export interface InterventionRecord {
  readonly id:             string;
  readonly organizationId: string;            // caller-supplied scope
  readonly farmerRef:      string;            // opaque scoped ref
  readonly channel:        InterventionChannel;
  readonly status:         InterventionStatus;
  readonly openedAt:       number;
  readonly completedAt:    number | null;
  readonly notes:          ReadonlyArray<InterventionNote>;
  readonly evidence:       ReadonlyArray<InterventionEvidence>;
}
