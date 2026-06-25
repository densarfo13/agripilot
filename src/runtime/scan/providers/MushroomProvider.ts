/**
 * MushroomProvider.ts — client normalizer for the mushroom.id provider.
 *
 * Maps the server `mushroom` envelope into a ProviderResult. Does NOT call the
 * API (server-side key). SAFETY is absolute: this never reports a mushroom as
 * safe/edible to act on. Edibility is passed through ONLY as information, and a
 * "do not eat" warning is ALWAYS present.
 */
import { ProviderResult, normalizeStatus, emptyProviderResult } from './ProviderContracts';

const _num = (v: any): number => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };
const _str = (v: any): string => (typeof v === 'string' ? v : '');

export const MUSHROOM_NEVER_EAT =
  'Do not eat wild mushrooms based only on this scan.';

export function mushroomRelevant(scanType: string): boolean {
  return String(scanType || '') === 'mushroom';
}

export function readMushroom(scanResult: any): ProviderResult {
  try {
    const m = (scanResult && scanResult.mushroom) || null;
    if (!m) return Object.freeze({
      ...emptyProviderResult('mushroom.id', 'UNSUPPORTED'),
      recommendations: Object.freeze([MUSHROOM_NEVER_EAT]),
    });
    const status = normalizeStatus(m.status);
    const confidencePct = m.confidencePct != null ? _num(m.confidencePct) : Math.round(_num(m.confidence) * 100);
    // SAFETY: edibility is informational only; we NEVER turn it into a safe-to-eat
    // action. The warning is always first.
    const warnings = [MUSHROOM_NEVER_EAT];
    const ext = Array.isArray(m.warnings) ? m.warnings.map(_str).filter(Boolean) : [];
    for (const w of ext) if (!warnings.includes(w)) warnings.push(w);
    const findings = Object.freeze({
      species: _str(m.species),
      edibility: _str(m.edibility) || 'unknown',   // informational, never an action
      riskWarning: MUSHROOM_NEVER_EAT,
    });
    return Object.freeze({
      provider: 'mushroom.id',
      status,
      httpStatus: m.httpStatus != null ? _num(m.httpStatus) : null,
      confidence: Math.max(0, Math.min(100, confidencePct)),
      candidates: Object.freeze((Array.isArray(m.candidates) ? m.candidates : []).slice(0, 5)
        .map((c: any) => ({ name: _str(c.name), score: _num(c.score) }))),
      findings,
      recommendations: Object.freeze(warnings),   // ONLY warnings, never an eat-it claim
      failureReason: status === 'READY' || status === 'NO_RESULT' ? null : _str(m.reason) || status.toLowerCase(),
      latencyMs: m.latencyMs != null ? _num(m.latencyMs) : null,
    });
  } catch {
    return Object.freeze({
      ...emptyProviderResult('mushroom.id', 'PROVIDER_ERROR'),
      recommendations: Object.freeze([MUSHROOM_NEVER_EAT]),
    });
  }
}
