/**
 * farmEventsService.js — pure aggregation over farm_events.
 * The Express adapter (admin routes) fetches rows via Prisma
 * and passes them in; this layer has zero ORM/HTTP awareness.
 *
 * Inputs for each aggregator are plain arrays of event objects
 * shaped like the Prisma FarmEvent model: { id, userId, farmId,
 * eventType, payload, country, region, crop, createdAt }.
 *
 * Outputs mirror the NGO admin-dashboard spec one-to-one so the
 * frontend can consume them unchanged.
 */

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function toMs(x) {
  if (!x) return null;
  if (x instanceof Date) return x.getTime();
  const t = Date.parse(String(x));
  return Number.isFinite(t) ? t : null;
}

/**
 * buildSummary — totals across all time, active last 7 days,
 * new last 30 days, and a completion rate from
 * task_completed/task_seen events when available (else 0.65
 * per spec default).
 */
function buildSummary(events = [], { nowMs = Date.now(), completionRateDefault = 0.65 } = {}) {
  const now = nowMs;
  const allUsers = new Set();
  const active7 = new Set();
  const new30 = new Set();
  let completed = 0;
  let seen = 0;

  const src = Array.isArray(events) ? events : [];
  for (const e of src) {
    if (!e) continue;
    const ts = toMs(e.createdAt);
    if (e.userId) allUsers.add(e.userId);
    if (ts != null) {
      if (now - ts <= 7 * MS_IN_DAY  && e.userId) active7.add(e.userId);
      if (now - ts <= 30 * MS_IN_DAY && e.userId) new30.add(e.userId);
    }
    if (e.eventType === 'task_completed') completed++;
    else if (e.eventType === 'task_seen') seen++;
  }

  let completionRate = completionRateDefault;
  const total = completed + seen;
  if (total > 0) {
    completionRate = Math.max(0, Math.min(1, completed / total));
  }

  return {
    totalFarmers:  allUsers.size,
    activeFarmers: active7.size,
    newThisMonth:  new30.size,
    completionRate,
  };
}

/**
 * buildFarmersList — DISTINCT ON (farm_id) equivalent: most
 * recent event per farm. Returns up to `limit` entries sorted
 * by latest createdAt desc.
 */
function buildFarmersList(events = [], { limit = 200 } = {}) {
  if (!Array.isArray(events)) return [];
  const latestPerFarm = new Map();
  for (const e of events) {
    if (!e || !e.farmId) continue;
    const prev = latestPerFarm.get(e.farmId);
    const ts = toMs(e.createdAt) ?? 0;
    if (!prev || ts > (toMs(prev.createdAt) ?? 0)) {
      latestPerFarm.set(e.farmId, e);
    }
  }
  const out = Array.from(latestPerFarm.values())
    .sort((a, b) => (toMs(b.createdAt) ?? 0) - (toMs(a.createdAt) ?? 0))
    .slice(0, Math.max(0, Math.min(1000, limit)))
    .map((e) => ({
      id:        e.farmId,
      location:  e.region || null,
      crop:      e.crop   || null,
      stage:     (e.payload && (e.payload.stage || e.payload.cropStage)) || null,
      createdAt: e.createdAt || null,
      status:    'Active',
    }));
  return out;
}

/**
 * buildRiskByRegion — counts unique farms per region and
 * classifies risk by the spec's thresholds.
 */
function buildRiskByRegion(events = []) {
  if (!Array.isArray(events)) return [];
  const perRegion = new Map();
  for (const e of events) {
    if (!e || !e.region) continue;
    if (!perRegion.has(e.region)) perRegion.set(e.region, new Set());
    if (e.farmId) perRegion.get(e.region).add(e.farmId);
  }
  const rows = [];
  for (const [region, farmSet] of perRegion.entries()) {
    const n = farmSet.size;
    rows.push({
      region,
      farmers: n,
      risk: n > 100 ? 'high' : n > 50 ? 'medium' : 'low',
    });
  }
  rows.sort((a, b) => b.farmers - a.farmers);
  return rows;
}

/**
 * escapeCsvField — CSV-safe quoting per RFC 4180. Wraps fields
 * with commas / quotes / newlines in double quotes and escapes
 * embedded quotes.
 */
function escapeCsvField(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * buildCsvExport — RFC 4180 CSV of the spec's 5 columns from
 * the supplied events. Never throws; commas / quotes / newlines
 * inside values are safely escaped.
 */
function buildCsvExport(events = [], { limit = 500 } = {}) {
  const rows = Array.isArray(events)
    ? events.slice(0, Math.max(0, Math.min(100000, limit)))
    : [];
  const lines = ['user_id,farm_id,crop,region,created_at'];
  for (const r of rows) {
    if (!r) continue;
    lines.push([
      escapeCsvField(r.userId),
      escapeCsvField(r.farmId),
      escapeCsvField(r.crop),
      escapeCsvField(r.region),
      escapeCsvField(r.createdAt instanceof Date
        ? r.createdAt.toISOString() : r.createdAt),
    ].join(','));
  }
  return lines.join('\n') + '\n';
}

module.exports = {
  buildSummary,
  buildFarmersList,
  buildRiskByRegion,
  buildCsvExport,
  escapeCsvField, // exported for tests
  _internal: { MS_IN_DAY },
};
