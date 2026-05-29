/**
 * src/runtime/auth/federation/SAMLRuntime.ts — SAML placeholder
 * runtime. Per spec §2: structure exists, real SAML is NOT
 * implemented yet.
 *
 *   The runtime exists so the rest of the federation layer
 *   (router, claim mapper, audit) can be wired against it. It
 *   intentionally returns { configured: false, runtimeReady:
 *   false } until a real SAML handler ships.
 *
 * Strict-rule audit
 *   • HONEST — does not pretend to work. The CI gate enforces
 *     this: any change that flips configured/runtimeReady to
 *     true without the underlying implementation MUST fail.
 *   • Pure. SSR-safe. Never throws.
 */

import { FEDERATION_RUNTIME_VERSION } from './federationContracts';

export const SAML_RUNTIME_VERSION = 'saml-placeholder-v1';

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/** Returns a frozen snapshot. Both `configured` AND
 *  `runtimeReady` MUST be false in this placeholder build. */
export function samlSnapshot() {
  return _safe(() => Object.freeze({
    runtimeVersion:    SAML_RUNTIME_VERSION,
    federationVersion: FEDERATION_RUNTIME_VERSION,
    configured:        false,
    runtimeReady:      false,
    note: 'Placeholder. Real SAML handler not implemented. '
        + 'See OIDC for currently supported enterprise login.',
  }), Object.freeze({
    runtimeVersion: SAML_RUNTIME_VERSION,
    configured:     false,
    runtimeReady:   false,
  }));
}
