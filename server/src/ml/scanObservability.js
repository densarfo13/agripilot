/**
 * scanObservability.js — SCAN_OBSERVABILITY_V1.
 *
 * One durable row per scan (scan_observability_events, scanId @unique so
 * there are NO duplicate rows — unlike the legacy ScanTrainingEvent).
 * Captures: photoQuality, provider, cropName, confidence, healthDetected,
 * insectDetected, taskCreated, plantSaved, durationMs (+ the disease/insect
 * LABELS so the dashboard can rank "most common diseases/insects").
 *
 *   recordScanObservation(prisma, fields)  — server, at /analyze time (upsert)
 *   recordScanOutcome(prisma, scanId, …)   — client outcomes (task/plant)
 *   getScanObservability(prisma, opts)      — admin aggregates
 *   buildObservabilityCsv(rows)             — CSV export
 *
 * Strict: every DB call is best-effort and NEVER throws (analytics must not
 * break a scan); honest nulls, never fabricated values; no PII (no raw
 * filename / coords / phone — userId only).
 */

function _int(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function _str(v) { return typeof v === 'string' && v ? v.slice(0, 120) : null; }
function _bool(v) { return v === true; }

/** Upsert the per-scan observability row (server-known fields). */
export async function recordScanObservation(prisma, f = {}) {
  if (!prisma || !f || !f.scanId) return false;
  const data = {
    userId:         _str(f.userId),
    photoQuality:   _str(f.photoQuality),
    provider:       _str(f.provider),
    cropName:       _str(f.cropName),
    confidence:     _int(f.confidence),       // 0..100, null when unknown
    confidenceBand: _str(f.confidenceBand),   // low | medium | high
    healthDetected: _bool(f.healthDetected),
    detectedIssue:  _str(f.detectedIssue),
    insectDetected: _bool(f.insectDetected),
    detectedInsect: _str(f.detectedInsect),
    durationMs:     _int(f.durationMs),
    success:        _bool(f.success),
    failureReason:  _str(f.failureReason),
  };
  try {
    await prisma.scanObservabilityEvent.upsert({
      where:  { scanId: String(f.scanId) },
      update: data,
      create: { scanId: String(f.scanId), ...data },
    });
    return true;
  } catch { return false; }
}

/** Record a downstream outcome (task created / plant saved) by scanId. */
export async function recordScanOutcome(prisma, scanId, outcome = {}) {
  if (!prisma || !scanId) return false;
  const data = {};
  if (typeof outcome.taskCreated === 'boolean') data.taskCreated = outcome.taskCreated;
  if (typeof outcome.plantSaved === 'boolean') data.plantSaved = outcome.plantSaved;
  if (Object.keys(data).length === 0) return false;
  try {
    // Upsert so an outcome that arrives before the (fire-and-forget) base
    // row still lands; the base write later fills the rest.
    await prisma.scanObservabilityEvent.upsert({
      where:  { scanId: String(scanId) },
      update: data,
      create: { scanId: String(scanId), ...data },
    });
    return true;
  } catch { return false; }
}

function _topN(rows, key, n = 8) {
  const counts = new Map();
  for (const r of rows) {
    const v = r && r[key];
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value, count]) => ({ value, count }));
}

/** Admin aggregates over the most recent `limit` scans (optional sinceDays). */
export async function getScanObservability(prisma, opts = {}) {
  const limit = Math.min(Math.max(_int(opts.limit) || 1000, 1), 5000);
  const since = _int(opts.sinceDays);
  const where = since ? { createdAt: { gte: new Date(Date.now() - since * 864e5) } } : {};
  let rows = [];
  try {
    rows = await prisma.scanObservabilityEvent.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
    });
  } catch { rows = []; }

  const total = rows.length;
  const successful = rows.filter((r) => r.success).length;
  const failed = total - successful;
  const confVals = rows.map((r) => r.confidence).filter((c) => typeof c === 'number');
  const avgConfidence = confVals.length
    ? Math.round((confVals.reduce((a, b) => a + b, 0) / confVals.length) * 10) / 10 : null;

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    windowDays: since || null,
    totals: Object.freeze({
      total, successful, failed,
      successRate: total ? Math.round((successful / total) * 1000) / 10 : null,
      // SCAN_ANALYTICS_V1 — Failure % + Credits consumed. A provider-backed
      // scan (provider not 'rule'/empty) consumes ~1 Kindwise credit, so
      // this count is the analytics-window credit spend.
      failureRate: total ? Math.round((failed / total) * 1000) / 10 : null,
      creditsConsumed: rows.filter((r) => r.provider && !/^rule\b/i.test(String(r.provider))).length,
      avgConfidence,
      tasksCreated: rows.filter((r) => r.taskCreated).length,
      plantsSaved:  rows.filter((r) => r.plantSaved).length,
      healthDetected: rows.filter((r) => r.healthDetected).length,
      insectDetected: rows.filter((r) => r.insectDetected).length,
    }),
    mostScannedCrops:   Object.freeze(_topN(rows, 'cropName')),
    mostCommonDiseases: Object.freeze(_topN(rows, 'detectedIssue')),
    mostCommonInsects:  Object.freeze(_topN(rows, 'detectedInsect')),
    sampleCount: total,
  });
}

const CSV_COLS = [
  'scanId', 'createdAt', 'photoQuality', 'provider', 'cropName', 'confidence',
  'confidenceBand', 'healthDetected', 'detectedIssue', 'insectDetected',
  'detectedInsect', 'taskCreated', 'plantSaved', 'durationMs', 'success', 'failureReason',
];
function _csvCell(v) {
  if (v == null) return '';
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
export async function buildObservabilityCsv(prisma, opts = {}) {
  const limit = Math.min(Math.max(_int(opts.limit) || 5000, 1), 20000);
  const since = _int(opts.sinceDays);
  const where = since ? { createdAt: { gte: new Date(Date.now() - since * 864e5) } } : {};
  let rows = [];
  try {
    rows = await prisma.scanObservabilityEvent.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
    });
  } catch { rows = []; }
  const lines = [CSV_COLS.join(',')];
  for (const r of rows) lines.push(CSV_COLS.map((c) => _csvCell(r[c])).join(','));
  return lines.join('\n') + '\n';
}

export const _internal = Object.freeze({ _topN, CSV_COLS });
