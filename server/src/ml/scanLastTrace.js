/**
 * scanLastTrace.js — in-memory recorder for the MOST RECENT scan's trace, so an admin
 * can root-cause "why did this scan return unknown?" without touching secrets or image
 * bytes.
 *
 * Redaction by construction: recordScanTrace() builds a NEW object from a fixed
 * whitelist of scalar fields. Image bytes, base64, URLs, and API keys are never in the
 * whitelist, so they can never be stored or returned — even if the caller passes them.
 * Single slot (last scan only). Never throws.
 */
const _str = (v) => (v == null ? null : String(v).slice(0, 240));
const _num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

let _last = null;

/** Record the last scan trace. Only whitelisted scalar fields are kept. */
export function recordScanTrace(t = {}, nowIso) {
  try {
    if (!t || typeof t !== 'object') return getLastScanTrace();
    const dims = (t.imageDims && typeof t.imageDims === 'object')
      ? Object.freeze({ width: _num(t.imageDims.width), height: _num(t.imageDims.height) })
      : null;
    const providers = Array.isArray(t.providers)
      ? Object.freeze(t.providers.slice(0, 8).map((p) => Object.freeze({
          name:      _str(p && p.name),
          status:    _str(p && p.status),
          latencyMs: _num(p && p.latencyMs),
          httpStatus: _num(p && p.httpStatus),
        })))
      : Object.freeze([]);
    _last = Object.freeze({
      scanId:                   _str(t.scanId),
      at:                       _str(nowIso) || null,
      imageMime:                _str(t.imageMime),
      imageBytes:               _num(t.imageBytes),     // SIZE only — never the bytes
      imageDims:                dims,
      qualityScore:             _num(t.qualityScore),
      providers,
      rawCandidateCount:        _num(t.rawCandidateCount),
      normalizedCandidateCount: _num(t.normalizedCandidateCount),
      topScientificName:        _str(t.topScientificName),
      topCommonName:            _str(t.topCommonName),
      topConfidence:            _num(t.topConfidence),
      cropHealthStatus:         _str(t.cropHealthStatus),
      rejectionReason:          _str(t.rejectionReason),
      finalVerdict:             _str(t.finalVerdict),
    });
    return _last;
  } catch { return getLastScanTrace(); }
}

export function getLastScanTrace() { return _last; }
export function clearLastScanTrace() { _last = null; }
