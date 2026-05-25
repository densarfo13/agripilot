/**
 * scanResultContract.js — typed contract for a verified scan result.
 *
 *   import {
 *     buildScanResult, verifyScanResultContract, REQUIRED_FIELDS,
 *   } from 'src/core/scan/contracts/scanResultContract.js';
 *
 *   const result = buildScanResult({ imageId, imageUrl, ... });
 *   if (!verifyScanResultContract(result).ok) {
 *     // reject — Journal MUST NOT accept this row
 *   }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   The single shape every "scan result" object must satisfy
 *   before reaching the Journal write path, the follow-up engine,
 *   or any analytics emission. Image linkage is part of the
 *   contract — a result without `imageId` + `imageUrl` +
 *   `classifierInputVerified=true` fails the gate.
 *
 *   It is NOT a data fetcher, NOT a builder of diagnoses (the
 *   `composeContextAwareDiagnosis` engine produces those).
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Verifier is the SINGLE truth source — every consumer
 *     (Journal, follow-up, telemetry) calls it before acting.
 */

export const REQUIRED_FIELDS = Object.freeze([
  'imageId',
  'imageUrl',
  'imageHash',
  'classifierInputVerified',
  'persisted',
  'diagnosis',
  'confidence',
  'timestamp',
]);

const _str = (v) => String(v == null ? '' : v);

/**
 * @param {object} input  — raw fields to assemble
 * @returns {object|null}  the normalised result, or null on missing fields
 */
export function buildScanResult(input) {
  try {
    const c = (input && typeof input === 'object') ? input : {};
    const out = {
      imageId:                _str(c.imageId),
      imageUrl:               _str(c.imageUrl),
      imageHash:              _str(c.imageHash),
      classifierInputVerified:c.classifierInputVerified === true,
      persisted:              c.persisted === true,
      diagnosis:              c.diagnosis || null,
      confidence:             _str(c.confidence),
      timestamp:              Number.isFinite(Number(c.timestamp)) ? Number(c.timestamp) : Date.now(),
    };
    // Optional fields preserved when present.
    if (c.scanId)         out.scanId         = _str(c.scanId);
    if (c.crop)           out.crop           = _str(c.crop);
    if (c.followupTaskId) out.followupTaskId = _str(c.followupTaskId);
    return out;
  } catch { return null; }
}

/**
 * Verify a candidate result against the contract. Returns
 * `{ ok: true }` when valid; otherwise `{ ok: false, missing: [...], reason }`.
 *
 * @param {object} result
 * @returns {object}
 */
export function verifyScanResultContract(result) {
  try {
    if (!result || typeof result !== 'object') {
      return { ok: false, reason: 'not_object', missing: REQUIRED_FIELDS.slice() };
    }
    const missing = [];
    for (const field of REQUIRED_FIELDS) {
      const v = result[field];
      if (v == null || v === '' || (typeof v === 'string' && v.trim() === '')) {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return { ok: false, reason: 'missing_required', missing };
    }
    if (result.classifierInputVerified !== true) {
      return { ok: false, reason: 'classifier_input_unverified', missing: ['classifierInputVerified'] };
    }
    if (result.persisted !== true) {
      return { ok: false, reason: 'not_persisted', missing: ['persisted'] };
    }
    if (!Number.isFinite(Number(result.timestamp)) || Number(result.timestamp) <= 0) {
      return { ok: false, reason: 'bad_timestamp', missing: ['timestamp'] };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'exception', missing: [] };
  }
}

/**
 * Convenience guard for the Journal write path:
 *   if (!isJournalSafe(result)) return reject(...);
 */
export function isJournalSafe(result) {
  return verifyScanResultContract(result).ok;
}

const _module = {
  REQUIRED_FIELDS,
  buildScanResult,
  verifyScanResultContract,
  isJournalSafe,
};
export default _module;
