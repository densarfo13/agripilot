/**
 * src/runtime/consent/index.ts — Barrel.
 *
 * Single import surface for the consent runtime. Callers
 * should pull verbs, types, and version constants from here
 * rather than reaching into individual files.
 */

export {
  CONSENT_RUNTIME_VERSION, CONSENT_TYPES, CONSENT_SOURCES,
  CONSENT_POLICY_VERSION,
} from './consentContracts';
export type {
  ConsentRecord, ConsentType, ConsentSource,
} from './consentContracts';

export {
  upsertConsent, revokeConsent, findConsent, listConsents,
  consentRegistrySnapshot, CONSENT_REGISTRY_VERSION,
} from './ConsentRegistry';
export type {
  UpsertConsentInput, ConsentUpsertResult,
  ConsentSnapshotRow, ConsentRegistrySnapshot,
} from './ConsentRegistry';

export {
  requiresConsent, consentActionMap,
  CONSENT_POLICY_RUNTIME_VERSION,
} from './ConsentPolicy';
export type { ConsentPolicyResult } from './ConsentPolicy';

export {
  consentHealth, installConsentGlobal,
} from './ConsentRuntime';
export type { ConsentHealth } from './ConsentRuntime';
