/**
 * src/runtime/consent/ConsentRuntime.ts — Composite + diagnostics.
 *
 * Composes the registry + policy into one verb surface and
 * exposes consentHealth() / installConsentGlobal() so a
 * developer can probe the runtime from the browser console
 * without poking at private modules.
 *
 * Strict-rule audit
 *   • Pure runtime. No React, no fetch, no localStorage writes.
 *   • Diagnostics global installed via typeof window check.
 *   • Engine returns FROZEN envelopes; never throws.
 */

import {
  CONSENT_RUNTIME_VERSION, CONSENT_TYPES, CONSENT_SOURCES,
  CONSENT_POLICY_VERSION,
} from './consentContracts';
import type {
  ConsentRecord, ConsentType, ConsentSource,
} from './consentContracts';
import {
  upsertConsent, revokeConsent, findConsent, listConsents,
  consentRegistrySnapshot, CONSENT_REGISTRY_VERSION,
} from './ConsentRegistry';
import type {
  UpsertConsentInput, ConsentUpsertResult, ConsentRegistrySnapshot,
} from './ConsentRegistry';
import {
  requiresConsent, consentActionMap,
  CONSENT_POLICY_RUNTIME_VERSION,
} from './ConsentPolicy';
import type { ConsentPolicyResult } from './ConsentPolicy';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

// Re-export the verb surface so callers import from one place.
export {
  CONSENT_RUNTIME_VERSION, CONSENT_TYPES, CONSENT_SOURCES,
  CONSENT_POLICY_VERSION,
  upsertConsent, revokeConsent, findConsent, listConsents,
  consentRegistrySnapshot, CONSENT_REGISTRY_VERSION,
  requiresConsent, consentActionMap,
  CONSENT_POLICY_RUNTIME_VERSION,
};
export type {
  ConsentRecord, ConsentType, ConsentSource,
  UpsertConsentInput, ConsentUpsertResult,
  ConsentRegistrySnapshot, ConsentPolicyResult,
};

export interface ConsentHealth {
  initialized: boolean;
  consentTypesReady: boolean;
  revokeReady: boolean;
  programReportingConsentReady: boolean;
  buyerContactConsentReady: boolean;
  photoConsentReady: boolean;
  snapshot: ConsentRegistrySnapshot;
  persistence: "in_memory";
}

/**
 * Honest probe of what the consent runtime exposes right now.
 * "Ready" flags reflect whether the wire-up is in place — not
 * whether any particular user has granted that consent.
 */
export function consentHealth(): ConsentHealth {
  return _safe(() => {
    const types = CONSENT_TYPES as readonly string[];
    const consentTypesReady = types.length === 8;
    const programReportingConsentReady =
      types.indexOf("program_reporting") >= 0;
    const buyerContactConsentReady =
      types.indexOf("buyer_contact_sharing") >= 0;
    const photoConsentReady =
      types.indexOf("scan_photo_use") >= 0
      && types.indexOf("evidence_photo_sharing") >= 0;
    const revokeReady = typeof revokeConsent === "function";
    const snapshot = consentRegistrySnapshot();
    return Object.freeze({
      initialized: true,
      consentTypesReady,
      revokeReady,
      programReportingConsentReady,
      buyerContactConsentReady,
      photoConsentReady,
      snapshot,
      persistence: "in_memory" as const,
    });
  }, Object.freeze({
    initialized: false,
    consentTypesReady: false,
    revokeReady: false,
    programReportingConsentReady: false,
    buyerContactConsentReady: false,
    photoConsentReady: false,
    snapshot: consentRegistrySnapshot(),
    persistence: "in_memory" as const,
  }));
}

/**
 * Pins window.__consentHealth() for dev-console probing.
 * No-ops in non-browser environments.
 */
export function installConsentGlobal(): boolean {
  return _safe(() => {
    if (typeof window === "undefined") return false;
    (window as unknown as Record<string, unknown>)
      .__consentHealth = () => consentHealth();
    return true;
  }, false);
}
