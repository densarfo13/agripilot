/**
 * Farroway · Persistence Proof Runtime (persistence-proof-v1)
 *
 * Self-contained, composition-only diagnostic runtime that PROVES the
 * production database persistence path is real — using ONLY real evidence.
 * It NEVER imports a project module, NEVER fabricates data, and NEVER fakes
 * a pass: PASS requires a non-empty `validationSource` AND all required
 * readiness booleans, and it will FAIL outright in in-memory mode.
 *
 * It reads the real `__persistenceHealth` probe and the human/QA-recorded
 * write/read validation under localStorage 'farroway_proof_runs' (key
 * 'persistence'), recorded by the validate:persistence:proof script.
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

// -------------------------------------------------------------------------
// Evidence helpers (self-contained) — read ONLY real recorded evidence.
// -------------------------------------------------------------------------

/**
 * Reads a recorded MANUAL test run from localStorage 'farroway_proof_runs'
 * (a JSON object keyed by proof name). Returns the recorded run object
 * { ranAt, result, source, note } or null when absent / malformed.
 * This is how a human/QA records that a manual test was actually run.
 */
function _proofRun(name: string): any {
  return _safe(() => {
    const store = _obj(_ls('farroway_proof_runs'));
    if (!store) return null;
    const run = _obj(store[name]);
    return run || null;
  }, null);
}

/**
 * Returns a merged array of BOTH canonical event logs:
 * localStorage 'farroway.farmEvents' AND localStorage 'farroway_event_log'.
 * Each may be an array or absent.
 */
function _events(): any[] {
  return _safe(() => {
    const a = _arr(_ls('farroway.farmEvents'));
    const b = _arr(_ls('farroway_event_log'));
    return a.concat(b);
  }, []);
}

/** The set of string event types present across the merged event logs. */
function _eventTypes(): Set<string> {
  return _safe(() => {
    const out = new Set<string>();
    for (const row of _events()) {
      const r = _obj(row);
      if (!r) continue;
      const t = r.type ?? r.eventType ?? r.name ?? r.kind;
      if (typeof t === 'string' && t.length > 0) out.add(t);
    }
    return out;
  }, new Set<string>());
}

/** True if any present event type is in the given list. */
function _hasEvent(list: string[]): boolean {
  return _safe(() => {
    const types = _eventTypes();
    for (const t of _arr(list)) {
      if (typeof t === 'string' && types.has(t)) return true;
    }
    return false;
  }, false);
}

export const PERSISTENCE_PROOF_VERSION = 'persistence-proof-v1' as const;

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type ProofStatus = 'PASS' | 'FAIL' | 'NEEDS_TEST';

export interface PersistenceProofEnvelope {
  runtimeVersion: typeof PERSISTENCE_PROOF_VERSION;
  databaseUrlPresent: boolean;
  prismaConnected: boolean;
  mode: string;
  writeReadValidated: boolean;
  criticalWritesPersisted: boolean;
  inMemoryFallbackDisabledInProduction: boolean;
  proofStatus: ProofStatus;
  validationSource: string | null;
  confidence: Confidence;
  explanation: string;
  limitations: string;
}

// -------------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------------

export function persistenceProofHealth(): PersistenceProofEnvelope {
  return _safe(
    () => {
      const p = _obj(_probe('__persistenceHealth'));

      // Touch the canonical event logs so live persistence-write evidence can
      // be honoured in future without faking it (read-only, never throws).
      const sawPersistedWrite = _hasEvent([
        'persistence_write',
        'critical_write_persisted',
        'db_write',
      ]);

      const prod = _safe(
        () =>
          typeof import.meta !== 'undefined' &&
          (import.meta as any).env &&
          (import.meta as any).env.PROD === true,
        false,
      );

      const databaseUrlPresent = !!(p && p.databaseUrlPresent);
      const mode = p && typeof p.mode === 'string' ? p.mode : 'unknown';
      const prismaConnected = !!(p && (p.prismaConnected === true || p.persistenceProductionSafe === true));
      const criticalWritesPersisted = !!(p && p.criticalWritesPersisted);

      const run = _proofRun('persistence');
      const writeReadValidated = !!(run && run.result === 'PASS');

      const inMemoryFallbackDisabledInProduction =
        mode === 'postgres' || (mode !== 'memory' && mode !== 'in-memory');

      const validationSource: string | null = writeReadValidated
        ? 'proof_run:persistence'
        : p
          ? 'probe:persistenceHealth'
          : null;

      // proofStatus:
      //   FAIL  if running in-memory OR (production without a DATABASE_URL).
      //   PASS  ONLY when postgres + url + connected + critical writes + write/read proof.
      //   else  NEEDS_TEST (honest degrade — never PASS from config alone).
      let proofStatus: ProofStatus;
      if (mode === 'memory' || mode === 'in-memory' || (prod && !databaseUrlPresent)) {
        proofStatus = 'FAIL';
      } else if (
        mode === 'postgres' &&
        databaseUrlPresent &&
        prismaConnected &&
        criticalWritesPersisted &&
        writeReadValidated
      ) {
        proofStatus = 'PASS';
      } else {
        proofStatus = 'NEEDS_TEST';
      }

      const confidence: Confidence =
        proofStatus === 'PASS' ? 'high' : proofStatus === 'FAIL' ? 'medium' : 'low';

      let explanation: string;
      if (proofStatus === 'PASS') {
        explanation =
          'Production persistence is proven: mode is postgres with a DATABASE_URL, Prisma is ' +
          'connected, critical writes persist, and a recorded write/read validation passed.';
      } else if (proofStatus === 'FAIL') {
        explanation =
          mode === 'memory' || mode === 'in-memory'
            ? 'Persistence is running in IN-MEMORY mode — data does not survive a restart. ' +
              'This must never be used for production.'
            : 'Running in production without a DATABASE_URL — there is no real database to persist to.';
      } else if (!p) {
        explanation =
          'The __persistenceHealth probe is not present, so production persistence cannot be ' +
          'confirmed. Run the validate:persistence:proof script to record a write/read validation.';
      } else if (!writeReadValidated) {
        explanation =
          'Persistence configuration looks usable (mode "' +
          mode +
          '"), but no passing write/read proof has been recorded. Run the ' +
          'validate:persistence:proof script to actually prove a write then read.';
      } else {
        explanation =
          'Persistence is not fully proven yet for mode "' +
          mode +
          '": confirm a postgres DATABASE_URL, Prisma connection, and persisted critical writes.';
      }

      const limitations =
        'This checks a real persistence probe and a recorded write/read validation; it does not ' +
        'continuously monitor the live database, replication, or backups, and "PASS" reflects only ' +
        'the last recorded proof. ' +
        (sawPersistedWrite
          ? 'A persisted-write event was also seen in the event log. '
          : '') +
        GUIDANCE_TAIL;

      return Object.freeze({
        runtimeVersion: PERSISTENCE_PROOF_VERSION,
        databaseUrlPresent,
        prismaConnected,
        mode,
        writeReadValidated,
        criticalWritesPersisted,
        inMemoryFallbackDisabledInProduction,
        proofStatus,
        validationSource,
        confidence,
        explanation,
        limitations,
      }) as PersistenceProofEnvelope;
    },
    Object.freeze({
      runtimeVersion: PERSISTENCE_PROOF_VERSION,
      databaseUrlPresent: false,
      prismaConnected: false,
      mode: 'unknown',
      writeReadValidated: false,
      criticalWritesPersisted: false,
      inMemoryFallbackDisabledInProduction: false,
      proofStatus: 'NEEDS_TEST' as ProofStatus,
      validationSource: null,
      confidence: 'low' as Confidence,
      explanation:
        'Persistence proof runtime could not read its probe — production persistence is unproven. ' +
        'Run the validate:persistence:proof script to record a write/read validation.',
      limitations:
        'This checks a real persistence probe and a recorded write/read validation; it does not ' +
        'continuously monitor the live database. ' +
        GUIDANCE_TAIL,
    }) as PersistenceProofEnvelope,
  );
}

export function installPersistenceProofGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__persistenceProofHealth !== 'function') {
      w.__persistenceProofHealth = function () {
        const out = persistenceProofHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Persistence Proof]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
