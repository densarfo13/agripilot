/**
 * src/runtime/consent/consentDefaults.ts — Default consent
 * verdicts for first-boot / no-record users.
 *
 * Fail-closed: every default below is `granted: false`. The
 * runtime treats an unknown user the same as a user who has
 * explicitly revoked. This file exists so the prompt UI and any
 * server-side bootstrap have a single source of truth for what
 * "no choice yet" looks like.
 *
 * Pure runtime: no React, no fetch, no localStorage.
 */

import {
  CONSENT_TYPES,
  type ConsentType,
} from './consentContracts';

export const CONSENT_DEFAULTS_VERSION =
  'farroway-consent-defaults-v1';

/**
 * Map of consent type → default granted value. All defaults are
 * `false` (fail-closed). The map is frozen so accidental
 * mutation by a caller doesn't change runtime behaviour.
 */
export const CONSENT_DEFAULTS: Readonly<Record<ConsentType, boolean>> =
  Object.freeze(
    CONSENT_TYPES.reduce<Record<string, boolean>>((acc, t) => {
      acc[t] = false;
      return acc;
    }, {}) as Record<ConsentType, boolean>,
  );

/**
 * Returns the default granted value for a given consent type.
 * Unknown types fall through to `false` (fail-closed).
 */
export function defaultGrantedFor(type: string): boolean {
  if (!CONSENT_TYPES.includes(type as ConsentType)) return false;
  return CONSENT_DEFAULTS[type as ConsentType] === true;
}

/**
 * Returns a frozen copy of the defaults map. Convenience for
 * dev surfaces / diagnostics that want to display the current
 * defaults to a reviewer.
 */
export function consentDefaultsSnapshot(): Readonly<
  Record<ConsentType, boolean>
> {
  return CONSENT_DEFAULTS;
}
