/**
 * CropHealthProvider.ts — client normalizer for the crop.health provider.
 *
 * Does NOT call the provider API (the key is server-side; calling from the
 * browser would leak it). It maps the server's `cropHealth` envelope into the
 * canonical ProviderResult. Honest: when the server returns no result we report
 * NO_RESULT — never a fabricated disease.
 */
import { ProviderResult, normalizeStatus, emptyProviderResult } from './ProviderContracts';

const _num = (v: any): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const _str = (v: any): string => (typeof v === 'string' ? v : '');

/** scanType values for which crop.health is relevant (§2). */
export const CROP_HEALTH_SCAN_TYPES = Object.freeze(['leaf', 'wholePlant', 'crop', 'fruit', 'vegetable']);
export function cropHealthRelevant(scanType: string): boolean {
  return CROP_HEALTH_SCAN_TYPES.includes(String(scanType || ''));
}

/** Normalize the server cropHealth envelope into a ProviderResult. */
export function readCropHealth(scanResult: any): ProviderResult {
  try {
    const ch = (scanResult && scanResult.cropHealth) || null;
    if (!ch) return emptyProviderResult('crop.health', 'UNSUPPORTED');
    const status = normalizeStatus(ch.status);
    const confidencePct = ch.confidencePct != null ? _num(ch.confidencePct) : Math.round(_num(ch.confidence) * 100);
    const disease = _str(ch.disease);
    // No issue detected → clean READY result (§2), not a fabricated disease.
    const findings = Object.freeze({
      disease: disease || (status === 'READY' ? '' : ''),
      health: disease ? '' : (status === 'READY' ? 'No clear issue detected' : ''),
      severity: _str(ch.severity),
      affectedArea: _str(ch.affectedArea),
      likelyCauses: _str(ch.likelyCauses || ch.cause),
      nutritionSignal: _str(ch.nutrition || ch.nutritionSignal),
      waterStressSignal: _str(ch.irrigation || ch.waterStressSignal),
    });
    const recommendations = [ch.treatment, ch.prevention].map(_str).filter(Boolean);
    return Object.freeze({
      provider: 'crop.health',
      status,
      httpStatus: ch.httpStatus != null ? _num(ch.httpStatus) : null,
      confidence: Math.max(0, Math.min(100, confidencePct)),
      candidates: Object.freeze((Array.isArray(ch.candidates) ? ch.candidates : []).slice(0, 5)
        .map((c: any) => ({ name: _str(c.name), score: _num(c.score) }))),
      findings,
      recommendations: Object.freeze(recommendations),
      failureReason: status === 'READY' || status === 'NO_RESULT' ? null : _str(ch.reason) || status.toLowerCase(),
      latencyMs: ch.latencyMs != null ? _num(ch.latencyMs) : null,
    });
  } catch {
    return emptyProviderResult('crop.health', 'PROVIDER_ERROR');
  }
}
