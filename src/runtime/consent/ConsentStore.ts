/**
 * src/runtime/consent/ConsentStore.ts — In-memory + localStorage
 * backed consent record store.
 *
 * Thin wrapper around ConsentRegistry that adds a single
 * persistence key (`farroway:consent:v1`) so consent decisions
 * survive reloads. SSR-safe — every localStorage read/write is
 * wrapped in a try/catch + typeof window check.
 *
 * Pure runtime: no React, no fetch. Used by ConsentRuntime +
 * ConsentPrompt to load/save records.
 */

import {
  consentRegistrySnapshot,
  upsertConsent,
  type UpsertConsentInput,
  type ConsentSnapshotRow,
} from './ConsentRegistry';
import {
  CONSENT_TYPES,
  type ConsentRecord,
  type ConsentType,
} from './consentContracts';

export const CONSENT_STORE_VERSION =
  'farroway-consent-store-v1';

const STORAGE_KEY = 'farroway:consent:v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _readStorage(): ConsentSnapshotRow[] {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) => r && typeof r === 'object' && typeof r.userId === 'string',
    ) as ConsentSnapshotRow[];
  }, []);
}

function _writeStorage(rows: ConsentSnapshotRow[]): void {
  _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }, undefined);
}

/**
 * Hydrate the in-memory registry from localStorage. Idempotent —
 * safe to call on every boot. Returns the number of records
 * restored (or 0 on first boot / SSR).
 */
export function hydrateConsentStore(): number {
  const rows = _readStorage();
  let restored = 0;
  for (const row of rows) {
    if (!CONSENT_TYPES.includes(row.type as ConsentType)) continue;
    const input: UpsertConsentInput = {
      userId:  row.userId,
      type:    row.type,
      granted: row.granted === true,
      source:  row.source,
    };
    const result = upsertConsent(input);
    if (result.ok) restored++;
  }
  return restored;
}

/**
 * Persist a single consent record + flush the full snapshot to
 * localStorage so reloads see the latest state.
 */
export function persistConsent(input: UpsertConsentInput): {
  ok: boolean;
  record: ConsentRecord | null;
  reason: string;
} {
  const res = upsertConsent(input);
  if (res.ok) {
    const snap = consentRegistrySnapshot();
    _writeStorage([...snap.records]);
  }
  return res;
}

/**
 * Returns a defensive copy of the current snapshot. Frozen rows;
 * callers must not mutate.
 */
export function consentStoreSnapshot(): {
  version: string;
  records: readonly ConsentSnapshotRow[];
} {
  const snap = consentRegistrySnapshot();
  return Object.freeze({
    version: CONSENT_STORE_VERSION,
    records: snap.records,
  });
}
