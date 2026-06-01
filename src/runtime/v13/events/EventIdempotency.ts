/**
 * Farroway · Event Idempotency (event-sourcing-v13)
 *
 * Pure, self-contained, deterministic idempotency key derivation. No imports.
 * No window / localStorage access. NO randomness. NO clock seeding — the key
 * is derived ONLY from the event name and a stable, sorted projection of the
 * payload's identity fields. The same logical event always yields the same
 * key so that re-delivery / replay can be de-duplicated safely.
 *
 * NEVER throws.
 */

/**
 * Identity fields we are willing to fold into the key, in priority order.
 * These are the fields that, together with the event name, uniquely identify
 * a logical occurrence of an event. We deliberately do NOT include free-form
 * payload data (notes, measurements, etc.) — only stable identity / scope.
 */
const _STABLE_KEY_FIELDS = [
  'eventId',
  'id',
  'aggregateId',
  'entityId',
  'orgId',
  'tenantId',
  'farmId',
  'gardenId',
  'plantId',
  'scanId',
  'taskId',
  'userId',
  'occurredAt',
  'recordedAt',
  'sequence',
  'version',
] as const;

/** Coerce a primitive value to a stable string token; objects collapse to ''. */
function _token(v: any): string {
  try {
    if (v === null || v === undefined) return '';
    const t = typeof v;
    if (t === 'string') return v;
    if (t === 'number') return Number.isFinite(v) ? String(v) : '';
    if (t === 'boolean') return v ? 'true' : 'false';
    return '';
  } catch {
    return '';
  }
}

/**
 * Deterministic, non-cryptographic 32-bit FNV-1a hash rendered as a fixed
 * hex string. Pure function of its input — no random, no clock.
 */
function _hash(input: string): string {
  try {
    let h = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      // FNV prime multiply via shifts, kept in 32-bit space
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  } catch {
    return '00000000';
  }
}

/**
 * Build a STABLE deterministic idempotency key for an event.
 * Derived ONLY from the event name + the present stable identity fields,
 * read in a fixed sorted order. No randomness, no current time.
 */
export function idempotencyKey(eventName: string, payload: object): string {
  try {
    const name = typeof eventName === 'string' && eventName ? eventName : 'UnknownEvent';
    const p: any = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};

    // Collect present identity fields in the fixed (already-sorted) field order.
    const parts: string[] = [];
    for (let i = 0; i < _STABLE_KEY_FIELDS.length; i++) {
      const field = _STABLE_KEY_FIELDS[i];
      if (Object.prototype.hasOwnProperty.call(p, field)) {
        const tok = _token(p[field]);
        if (tok !== '') parts.push(field + '=' + tok);
      }
    }

    const basis = name + '|' + parts.join('&');
    return name + ':' + _hash(basis);
  } catch {
    return 'UnknownEvent:00000000';
  }
}

/**
 * True when a record already carries a non-empty idempotency key field.
 * Accepts either `idempotencyKey` or `idempotency_key`. Never throws.
 */
export function hasIdempotencyKey(rec: any): boolean {
  try {
    if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return false;
    const k = rec.idempotencyKey ?? rec.idempotency_key;
    return typeof k === 'string' && k.length > 0;
  } catch {
    return false;
  }
}
