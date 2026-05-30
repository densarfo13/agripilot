/**
 * src/runtime/fieldOfficer/FieldOfficerRuntime.ts — Farroway Field
 * Officer workflow runtime. Offline-first intervention queue that
 * composes localStorage + the existing eventLogger + the existing
 * offlineQueue.
 *
 *   import {
 *     startVisit, addNote, attachEvidence, completeIntervention,
 *     listOpen, listCompleted, syncQueueDepth,
 *     fieldOfficerHealth, installFieldOfficerGlobal,
 *   } from 'src/runtime/fieldOfficer/FieldOfficerRuntime';
 *
 *   window.__fieldOfficerHealth()
 *
 * What this is
 * ────────────
 *   A pure, offline-first composition layer. Field officers create
 *   intervention records during visits and complete them while
 *   offline; the existing src/utils/offlineQueue.js drains them.
 *   This runtime NEVER calls the server. completeIntervention() just
 *   stamps status='completed' locally.
 *
 * Composition contract
 * ────────────────────
 *   • Storage: single-writer, localStorage key
 *     `farroway.fieldOfficer.queue` (see fieldOfficerContracts).
 *   • Org scoping: caller passes organizationId; runtime NEVER reads
 *     it from session.
 *   • Audit: emits via the existing eventLogger.logEvent. Event type
 *     is 'intervention_completed' — that string is NOT in
 *     eventLogger.EVENT_TYPES at time of authoring, so logEvent()
 *     drops the call silently (returns null). This runtime treats
 *     that as a no-op and surfaces `auditLogged: false` on the
 *     health envelope until eventLogger's whitelist is widened.
 *   • PII: NEVER stores farmer name, phone, email, exact coords,
 *     device id, or IP. Only opaque caller-supplied farmerRef.
 *
 * Strict-rule audit
 *   • Composition only. No new server route, no Prisma model, no
 *     new engine.
 *   • SSR-safe. typeof localStorage / typeof window guarded.
 *   • Never throws — every public function wraps in _safe with a
 *     frozen fallback envelope.
 *   • Frozen envelopes on every read.
 *   • Single-writer: only this module writes to the storage key.
 *   • One window global pinned: window.__fieldOfficerHealth.
 */

import { logEvent, EVENT_TYPES } from '../../lib/events/eventLogger';
import {
  FIELD_OFFICER_RUNTIME_VERSION,
  FIELD_OFFICER_STORAGE_KEY,
  INTERVENTION_STATUS,
  INTERVENTION_CHANNEL,
  type InterventionRecord,
  type InterventionStatus,
  type InterventionChannel,
  type InterventionNote,
  type InterventionEvidence,
} from './fieldOfficerContracts';

export { FIELD_OFFICER_RUNTIME_VERSION, FIELD_OFFICER_STORAGE_KEY };

/** Audit-flag — true when the canonical event type is whitelisted
 *  by eventLogger. Computed once at module load. If it's false the
 *  runtime is a no-op on audit logging (documented in module header). */
const AUDIT_EVENT_TYPE = 'intervention_completed';
const AUDIT_LOGGED: boolean = (() => {
  try {
    return Array.isArray(EVENT_TYPES) && EVENT_TYPES.includes(AUDIT_EVENT_TYPE);
  } catch { return false; }
})();

// ─── Internals ─────────────────────────────────────────────────────

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _hasStorage(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof localStorage === 'undefined') return false;
    return true;
  }, false);
}

function _readRaw(): InterventionRecord[] {
  return _safe(() => {
    if (!_hasStorage()) return [] as InterventionRecord[];
    const raw = localStorage.getItem(FIELD_OFFICER_STORAGE_KEY);
    if (!raw) return [] as InterventionRecord[];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [] as InterventionRecord[];
    // Best-effort coerce — drop any malformed row rather than throw.
    const out: InterventionRecord[] = [];
    for (const r of parsed) {
      if (!r || typeof r !== 'object') continue;
      if (typeof r.id !== 'string' || !r.id) continue;
      if (typeof r.organizationId !== 'string') continue;
      if (typeof r.farmerRef !== 'string') continue;
      out.push(_freezeRecord(r as InterventionRecord));
    }
    return out;
  }, [] as InterventionRecord[]);
}

/** Single-writer. Only this module writes FIELD_OFFICER_STORAGE_KEY. */
function _writeRaw(list: InterventionRecord[]): boolean {
  return _safe(() => {
    if (!_hasStorage()) return false;
    localStorage.setItem(FIELD_OFFICER_STORAGE_KEY, JSON.stringify(list));
    return true;
  }, false);
}

function _genId(prefix: string): string {
  return _safe(() => {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
      return `${prefix}_${(crypto as any).randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }, `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`);
}

/** Defensive PII scrub on free-text note bodies. Best-effort only —
 *  the UI is the primary author of safe text. */
function _scrubNote(body: string): string {
  return _safe(() => {
    let s = String(body || '');
    // Email
    s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted]');
    // Phone (very loose — 7+ digit run)
    s = s.replace(/\+?\d[\d\s().-]{6,}\d/g, '[redacted]');
    // Lat/lng pair
    s = s.replace(/-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g, '[redacted]');
    return s;
  }, '[redacted]');
}

function _freezeNote(n: InterventionNote): InterventionNote {
  return Object.freeze({
    id:        String(n.id),
    body:      String(n.body),
    timestamp: Number(n.timestamp) || 0,
  });
}

function _freezeEvidence(e: InterventionEvidence): InterventionEvidence {
  return Object.freeze({
    id:        String(e.id),
    kind:      String(e.kind),
    ref:       String(e.ref),
    timestamp: Number(e.timestamp) || 0,
  });
}

function _freezeRecord(r: InterventionRecord): InterventionRecord {
  const notes = Array.isArray(r.notes) ? r.notes.map(_freezeNote) : [];
  const evid  = Array.isArray(r.evidence) ? r.evidence.map(_freezeEvidence) : [];
  return Object.freeze({
    id:             String(r.id),
    organizationId: String(r.organizationId),
    farmerRef:      String(r.farmerRef),
    channel:        (r.channel === INTERVENTION_CHANNEL.FOLLOW_UP
                       ? INTERVENTION_CHANNEL.FOLLOW_UP
                       : INTERVENTION_CHANNEL.FIELD_VISIT) as InterventionChannel,
    status:         _coerceStatus(r.status),
    openedAt:       Number(r.openedAt) || 0,
    completedAt:    (r.completedAt == null ? null : (Number(r.completedAt) || null)),
    notes:          Object.freeze(notes),
    evidence:       Object.freeze(evid),
  });
}

function _coerceStatus(s: any): InterventionStatus {
  if (s === INTERVENTION_STATUS.COMPLETED) return INTERVENTION_STATUS.COMPLETED;
  if (s === INTERVENTION_STATUS.SYNCED)    return INTERVENTION_STATUS.SYNCED;
  return INTERVENTION_STATUS.OPEN;
}

/** Frozen empty record returned by any failing public mutator. */
const _EMPTY_RECORD: InterventionRecord = Object.freeze({
  id:             '',
  organizationId: '',
  farmerRef:      '',
  channel:        INTERVENTION_CHANNEL.FIELD_VISIT,
  status:         INTERVENTION_STATUS.OPEN,
  openedAt:       0,
  completedAt:    null,
  notes:          Object.freeze([] as InterventionNote[]),
  evidence:       Object.freeze([] as InterventionEvidence[]),
});

function _findIdx(list: InterventionRecord[], id: string): number {
  for (let i = 0; i < list.length; i++) {
    if (list[i] && list[i].id === id) return i;
  }
  return -1;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * startVisit — create a new intervention record in status=open.
 * Caller MUST pass organizationId (composition: this runtime does
 * not read session). farmerRef is an opaque scoped string — no PII.
 */
export function startVisit(opts: {
  organizationId: string;
  farmerRef:      string;
  channel?:       InterventionChannel;
}): InterventionRecord {
  return _safe(() => {
    if (!opts || typeof opts !== 'object') return _EMPTY_RECORD;
    const organizationId = String(opts.organizationId || '').trim();
    const farmerRef      = String(opts.farmerRef || '').trim();
    if (!organizationId || !farmerRef) return _EMPTY_RECORD;
    const channel: InterventionChannel =
      opts.channel === INTERVENTION_CHANNEL.FOLLOW_UP
        ? INTERVENTION_CHANNEL.FOLLOW_UP
        : INTERVENTION_CHANNEL.FIELD_VISIT;
    const now = Date.now();
    const record: InterventionRecord = _freezeRecord({
      id:             _genId('intv'),
      organizationId,
      farmerRef,
      channel,
      status:         INTERVENTION_STATUS.OPEN,
      openedAt:       now,
      completedAt:    null,
      notes:          [],
      evidence:       [],
    } as InterventionRecord);
    const list = _readRaw();
    list.push(record);
    _writeRaw(list);
    return record;
  }, _EMPTY_RECORD);
}

/**
 * addNote — append a (scrubbed) free-text note to an open
 * intervention. Returns the updated frozen record, or the empty
 * sentinel on any failure. No-op when status !== open.
 */
export function addNote(
  interventionId: string,
  body:           string,
): InterventionRecord {
  return _safe(() => {
    const id = String(interventionId || '').trim();
    if (!id) return _EMPTY_RECORD;
    const list = _readRaw();
    const idx = _findIdx(list, id);
    if (idx < 0) return _EMPTY_RECORD;
    const current = list[idx];
    if (current.status !== INTERVENTION_STATUS.OPEN) return current;
    const note: InterventionNote = _freezeNote({
      id:        _genId('note'),
      body:      _scrubNote(body),
      timestamp: Date.now(),
    });
    const next: InterventionRecord = _freezeRecord({
      ...current,
      notes: [...current.notes, note],
    } as InterventionRecord);
    list[idx] = next;
    _writeRaw(list);
    return next;
  }, _EMPTY_RECORD);
}

/**
 * attachEvidence — attach an opaque evidence ref (no PII) to an
 * open intervention. Returns the updated frozen record. No-op when
 * status !== open.
 */
export function attachEvidence(
  interventionId: string,
  evidence: { kind: string; ref: string },
): InterventionRecord {
  return _safe(() => {
    const id = String(interventionId || '').trim();
    if (!id) return _EMPTY_RECORD;
    if (!evidence || typeof evidence !== 'object') return _EMPTY_RECORD;
    const kind = String(evidence.kind || '').trim();
    const ref  = String(evidence.ref || '').trim();
    if (!kind || !ref) return _EMPTY_RECORD;
    const list = _readRaw();
    const idx = _findIdx(list, id);
    if (idx < 0) return _EMPTY_RECORD;
    const current = list[idx];
    if (current.status !== INTERVENTION_STATUS.OPEN) return current;
    const item: InterventionEvidence = _freezeEvidence({
      id:        _genId('evd'),
      kind,
      ref,
      timestamp: Date.now(),
    });
    const next: InterventionRecord = _freezeRecord({
      ...current,
      evidence: [...current.evidence, item],
    } as InterventionRecord);
    list[idx] = next;
    _writeRaw(list);
    return next;
  }, _EMPTY_RECORD);
}

/**
 * completeIntervention — stamp status='completed' locally + emit
 * an audit event via eventLogger. NEVER calls the server. The
 * existing src/utils/offlineQueue.js is what drains completed
 * records.
 *
 * The audit logEvent call uses type 'intervention_completed'. That
 * type is not (yet) in EVENT_TYPES, so logEvent returns null and
 * the audit is a documented no-op until the whitelist is widened.
 */
export function completeIntervention(
  interventionId: string,
): InterventionRecord {
  return _safe(() => {
    const id = String(interventionId || '').trim();
    if (!id) return _EMPTY_RECORD;
    const list = _readRaw();
    const idx = _findIdx(list, id);
    if (idx < 0) return _EMPTY_RECORD;
    const current = list[idx];
    if (current.status === INTERVENTION_STATUS.COMPLETED
     || current.status === INTERVENTION_STATUS.SYNCED) return current;
    const now = Date.now();
    const next: InterventionRecord = _freezeRecord({
      ...current,
      status:      INTERVENTION_STATUS.COMPLETED,
      completedAt: now,
    } as InterventionRecord);
    list[idx] = next;
    _writeRaw(list);
    // Audit log — composition over eventLogger. PII-free payload
    // (organizationId scope + opaque farmerRef + channel + counts).
    _safe(() => {
      logEvent({
        type:    AUDIT_EVENT_TYPE,
        payload: Object.freeze({
          interventionId:  next.id,
          organizationId:  next.organizationId,
          farmerRef:       next.farmerRef,
          channel:         next.channel,
          noteCount:       next.notes.length,
          evidenceCount:   next.evidence.length,
          openedAt:        next.openedAt,
          completedAt:     next.completedAt,
        }),
      });
    }, null);
    return next;
  }, _EMPTY_RECORD);
}

/** listOpen — frozen array of open records for a given org. */
export function listOpen(organizationId: string): ReadonlyArray<InterventionRecord> {
  return _safe(() => {
    const org = String(organizationId || '').trim();
    if (!org) return Object.freeze([] as InterventionRecord[]);
    const out = _readRaw().filter(
      (r) => r.organizationId === org
          && r.status === INTERVENTION_STATUS.OPEN,
    );
    return Object.freeze(out);
  }, Object.freeze([] as InterventionRecord[]));
}

/** listCompleted — frozen array of completed (not yet synced)
 *  records for a given org. */
export function listCompleted(organizationId: string): ReadonlyArray<InterventionRecord> {
  return _safe(() => {
    const org = String(organizationId || '').trim();
    if (!org) return Object.freeze([] as InterventionRecord[]);
    const out = _readRaw().filter(
      (r) => r.organizationId === org
          && r.status === INTERVENTION_STATUS.COMPLETED,
    );
    return Object.freeze(out);
  }, Object.freeze([] as InterventionRecord[]));
}

/** syncQueueDepth — total number of completed-but-not-synced
 *  records across all orgs. Reflects what the offlineQueue needs
 *  to drain. */
export function syncQueueDepth(): number {
  return _safe(() => {
    let n = 0;
    for (const r of _readRaw()) {
      if (r.status === INTERVENTION_STATUS.COMPLETED) n++;
    }
    return n;
  }, 0);
}

// ─── Health envelope + global install ──────────────────────────────

export function fieldOfficerHealth() {
  return _safe(() => {
    const list = _readRaw();
    let openCount = 0;
    let completedCount = 0;
    let queueDepth = 0;
    for (const r of list) {
      if (r.status === INTERVENTION_STATUS.OPEN) openCount++;
      else if (r.status === INTERVENTION_STATUS.COMPLETED) {
        completedCount++;
        queueDepth++;
      }
    }
    return Object.freeze({
      runtimeVersion:     FIELD_OFFICER_RUNTIME_VERSION,
      fieldOfficerReady:  true,
      queueDepth,
      openCount,
      completedCount,
      organizationScoped: true,
      offlineSafe:        true,
      auditLogged:        AUDIT_LOGGED,
    });
  }, Object.freeze({
    runtimeVersion:     FIELD_OFFICER_RUNTIME_VERSION,
    fieldOfficerReady:  false,
    queueDepth:         0,
    openCount:          0,
    completedCount:     0,
    organizationScoped: true,
    offlineSafe:        true,
    auditLogged:        false,
  }));
}

export function installFieldOfficerGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__fieldOfficerHealth !== 'function') {
      w.__fieldOfficerHealth = function () {
        const out = fieldOfficerHealth();
        try { console.log('[Farroway · Field Officer]', out); }
        catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
