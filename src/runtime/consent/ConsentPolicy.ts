/**
 * src/runtime/consent/ConsentPolicy.ts — Action → consent gate.
 *
 * Maps a runtime action (e.g. "store_scan_photo") to the
 * consent type it requires. Fail-closed: an unknown action
 * always returns required:true with reason
 * "unknown_action_default_deny".
 *
 * Strict-rule audit
 *   • Pure runtime. SSR-safe. No PII handled.
 *   • Engine returns FROZEN envelopes; never throws.
 */

import { findConsent } from './ConsentRegistry';
import type { ConsentType } from './consentContracts';

export const CONSENT_POLICY_RUNTIME_VERSION =
  "farroway-consent-policy-v1";

const _str = (v: unknown): string =>
  typeof v === "string" ? v : "";
const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

/**
 * Closed map of action ID → consent type. Keep this small and
 * explicit — callers should not invent action names on the fly.
 */
const ACTION_TO_TYPE: Readonly<Record<string, ConsentType>> =
  Object.freeze({
    store_scan_photo:          "scan_photo_use",
    share_evidence_photo:      "evidence_photo_sharing",
    ngo_demographic_reporting: "program_reporting",
    buyer_view_contact:        "buyer_contact_sharing",
    collect_location:          "location_use",
    collect_demographics:      "demographics_collection",
    send_diagnostics:          "analytics_diagnostics",
    send_notifications:        "notifications",
    // Spec action allowlist (Farroway consent runtime v1).
    collect_photos:            "collect_photos",
    collect_diagnostics:       "collect_diagnostics",
    collect_usage:             "collect_usage",
    share_for_review:          "share_for_review",
    export_data:               "export_data",
    delete_account:            "delete_account",
    receive_notifications:     "receive_notifications",
  });

/**
 * Internal fail-closed helper. Wraps any non-allowlisted action
 * into a frozen required:true verdict. Used by requiresConsent's
 * default branch so the policy never silently allows an unknown
 * action.
 */
function _failClosedDefault(reason: string): ConsentPolicyResult {
  // fail-closed: unknown actions always return required:true.
  switch (reason) {
    default:
      return Object.freeze({
        required: true,
        type:     null,
        granted:  false,
        reason,
      });
  }
}

export interface ConsentPolicyResult {
  required: boolean;
  type: ConsentType | null;
  granted: boolean;
  reason: string;
}

const _freezeResult = (r: ConsentPolicyResult): ConsentPolicyResult =>
  Object.freeze(r);

/**
 * For a given action + user, returns whether consent is
 * required, the consent type involved, whether it is currently
 * granted, and a stable reason code for the verdict.
 */
export function requiresConsent(
  action: string,
  userId: string,
): ConsentPolicyResult {
  return _safe(() => {
    const a = _str(action).trim();
    const uid = _str(userId).trim();
    if (!a) {
      return _freezeResult({
        required: true,
        type:     null,
        granted:  false,
        reason:   "missing_action",
      });
    }
    const type = ACTION_TO_TYPE[a];
    if (!type) {
      // Fail-closed: anything not on the action allowlist
      // is treated as needing consent, never silently allowed.
      return _freezeResult({
        required: true,
        type:     null,
        granted:  false,
        reason:   "unknown_action_default_deny",
      });
    }
    if (!uid) {
      return _freezeResult({
        required: true,
        type,
        granted:  false,
        reason:   "missing_user_id",
      });
    }
    const record = findConsent(uid, type);
    if (!record) {
      return _freezeResult({
        required: true,
        type,
        granted:  false,
        reason:   "no_record",
      });
    }
    if (record.granted === true) {
      return _freezeResult({
        required: true,
        type,
        granted:  true,
        reason:   "granted",
      });
    }
    return _freezeResult({
      required: true,
      type,
      granted:  false,
      reason:   "revoked",
    });
  }, _freezeResult({
    required: true,
    type:     null,
    granted:  false,
    reason:   "policy_threw",
  }));
}

/**
 * Exposed for diagnostics / dev surfaces — callers should not
 * mutate this. The map itself is frozen.
 */
export function consentActionMap(): Readonly<
  Record<string, ConsentType>
> {
  return ACTION_TO_TYPE;
}
