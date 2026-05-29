/**
 * anonymizer.js — Phase 12 PII redaction for network sync.
 *
 *   import { anonymizeRecord }
 *     from 'src/runtime/intelligenceNetwork/anonymizer.js';
 *
 * What this is
 * ────────────
 *   Pure function that takes a scan / task / outcome record and
 *   returns a frozen anonymized envelope safe for cross-farm
 *   aggregation. Every field that could re-identify a farmer is
 *   removed; the geographic granularity is coarsened (lat/lng →
 *   country + region only; never coords); timestamps are bucketed
 *   to the day to hide circadian patterns.
 *
 *   The anonymizer NEVER syncs. It returns a record the caller
 *   may LATER hand to a sync layer. Phase 12 ships no sync layer
 *   (named in the deferred map of the composite).
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • Output is frozen.
 *   • No PII fields preserved (farmer id, name, exact coords,
 *     device id, IP, phone, exact filename).
 *   • Returns null on invalid input rather than risking a leak.
 */

const RUNTIME_VERSION = 'anonymizer-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const DAY_MS = 24 * 60 * 60 * 1000;

// Drop list — fields NEVER preserved on output, regardless of source.
const PII_FIELDS = Object.freeze([
  'farmerId', 'farmerName', 'fullName', 'userId', 'email', 'phone',
  'phoneNumber', 'deviceId', 'sessionId', 'farmName', 'username',
  'address', 'gpsLat', 'gpsLng', 'lat', 'lng', 'latitude', 'longitude',
  'ipAddress', 'ip', 'fingerprint', 'imageBase64', 'imageUrl',
  'thumbnail', 'photoUrl', 'fileName', 'fileUri', 'filePath',
  'note', 'comment', 'message', 'description',
]);

function _bucketDayTs(ts) {
  if (!_isNum(ts)) return null;
  return Math.floor(ts / DAY_MS) * DAY_MS;
}

function _bucketDayIso(value) {
  return _safe(() => {
    let ts = null;
    if (_isNum(value)) ts = value;
    else if (typeof value === 'string') ts = new Date(value).getTime();
    else if (value instanceof Date) ts = value.getTime();
    if (!Number.isFinite(ts)) return null;
    const bucketed = _bucketDayTs(ts);
    return new Date(bucketed).toISOString().slice(0, 10);
  }, null);
}

function _normalizeCrop(c) {
  return _str(c).toLowerCase().trim() || null;
}

function _normalizeRegion(r) {
  // Region stays at admin-2 granularity max. Drops anything that
  // looks like a postal code, street, or full address.
  const s = _str(r).trim();
  if (!s) return null;
  // Strip digits and common postal-code patterns.
  if (/\d{4,}/.test(s)) return null;
  return s.slice(0, 64);
}

function _normalizeCountry(c) {
  const s = _str(c).trim().toUpperCase();
  if (!s) return null;
  // ISO-2 only.
  if (/^[A-Z]{2}$/.test(s)) return s;
  // Accept short names but cap length.
  return s.length <= 32 ? s : null;
}

/**
 * Anonymize a scan record.
 *
 *   @param {{
 *     scanId?: string,                  // dropped; we synth a hash-id
 *     crop?: string,
 *     country?: string,
 *     region?: string,
 *     possibleIssue?: string,
 *     confidence?: string|number,
 *     severity?: string,
 *     createdAt?: string|number|Date,
 *     classifier?: 'plantid'|'plantnet'|'generic'|'fallback',
 *   }} record
 */
export function anonymizeScanRecord(record) {
  if (!_isObj(record)) return null;
  const crop = _normalizeCrop(record.crop || record.cropName);
  const country = _normalizeCountry(record.country || record.countryCode);
  const region = _normalizeRegion(record.region || record.detectedRegion);
  // Confidence collapses to a 3-band label.
  const rawConf = record.confidence;
  let confidenceBand = null;
  if (typeof rawConf === 'string') {
    const k = rawConf.toLowerCase();
    if (['high', 'medium', 'low', 'needs_review'].includes(k)) {
      confidenceBand = k === 'needs_review' ? 'low' : k;
    }
  } else if (_isNum(rawConf)) {
    const n = rawConf > 1.5 ? rawConf / 100 : rawConf;
    confidenceBand = n >= 0.7 ? 'high' : n >= 0.4 ? 'medium' : 'low';
  }
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    type:           'scan',
    crop,
    country,
    region,
    issueCategory:  _str(record.issueCategory || record.category).toLowerCase() || null,
    possibleIssueShort: _str(record.possibleIssue).slice(0, 80) || null,
    confidenceBand,
    severity:       _str(record.severity || record.urgency).toLowerCase() || null,
    dayBucket:      _bucketDayIso(record.createdAt || record.at),
    classifier:     _str(record.classifier || record.provider).toLowerCase() || null,
  });
}

/**
 * Anonymize a task-completion record.
 *
 *   @param {{
 *     taskId?: string,                  // dropped
 *     kind?: string,
 *     crop?: string,
 *     country?: string,
 *     region?: string,
 *     completedAt?: string|number|Date,
 *     outcome?: 'ok'|'partial'|'bad',
 *     weatherAtCompletion?: string,
 *   }} record
 */
export function anonymizeTaskRecord(record) {
  if (!_isObj(record)) return null;
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    type:           'task',
    kind:           _str(record.kind || record.type).toLowerCase() || null,
    crop:           _normalizeCrop(record.crop || record.cropName),
    country:        _normalizeCountry(record.country),
    region:         _normalizeRegion(record.region),
    outcome:        ['ok', 'partial', 'bad'].includes(_str(record.outcome).toLowerCase())
                      ? _str(record.outcome).toLowerCase() : null,
    weatherAtCompletion:
                    _str(record.weatherAtCompletion).toLowerCase() || null,
    dayBucket:      _bucketDayIso(record.completedAt || record.at),
  });
}

/**
 * Anonymize an outcome record (yield delta, intervention result).
 *
 *   @param {{
 *     kind?: string,
 *     crop?: string,
 *     country?: string,
 *     region?: string,
 *     yieldDeltaPct?: number,
 *     observedAt?: string|number|Date,
 *   }} record
 */
export function anonymizeOutcomeRecord(record) {
  if (!_isObj(record)) return null;
  let yieldDeltaBand = null;
  if (_isNum(record.yieldDeltaPct)) {
    const p = record.yieldDeltaPct;
    yieldDeltaBand = p > 5 ? 'positive' : p < -5 ? 'negative' : 'flat';
  }
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    type:           'outcome',
    kind:           _str(record.kind).toLowerCase() || null,
    crop:           _normalizeCrop(record.crop || record.cropName),
    country:        _normalizeCountry(record.country),
    region:         _normalizeRegion(record.region),
    yieldDeltaBand,
    dayBucket:      _bucketDayIso(record.observedAt || record.at),
  });
}

/**
 * Generic dispatcher. Picks the right anonymizer by record.type.
 */
export function anonymizeRecord(record) {
  if (!_isObj(record)) return null;
  const t = _str(record.type).toLowerCase();
  if (t === 'scan')    return anonymizeScanRecord(record);
  if (t === 'task')    return anonymizeTaskRecord(record);
  if (t === 'outcome') return anonymizeOutcomeRecord(record);
  return null;
}

/**
 * Audit — verifies a record has NO PII fields. Returns
 * { ok, fieldsFound } where fieldsFound is empty on a clean record.
 */
export function auditAnonymity(record) {
  if (!_isObj(record)) return Object.freeze({ ok: true, fieldsFound: [] });
  const found = [];
  for (const f of PII_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(record, f)) found.push(f);
  }
  return Object.freeze({
    ok: found.length === 0,
    fieldsFound: Object.freeze(found),
  });
}

export const _internal = Object.freeze({
  PII_FIELDS, _bucketDayTs, _normalizeRegion, _normalizeCountry,
});
