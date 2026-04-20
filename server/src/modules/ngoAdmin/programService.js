/**
 * programService.js — pure program-level aggregators for the
 * multi-program NGO dashboard. CommonJS to match the sibling
 * router; vitest ES-import interop handles test access.
 */

import riskPkg  from './riskEngine.js';
import yieldPkg from './yieldEngine.js';
import scorePkg from './scoreEngine.js';
const { calculateRisk } = riskPkg;
const { estimateYield } = yieldPkg;
const { computeScore }  = scorePkg;

const MS_DAY = 24 * 60 * 60 * 1000;

function toMs(x) {
  if (!x) return null;
  if (x instanceof Date) return x.getTime();
  const t = Date.parse(String(x));
  return Number.isFinite(t) ? t : null;
}

function filterByProgram(items, program) {
  if (!Array.isArray(items)) return [];
  if (!program) return items;
  const needle = String(program).trim().toLowerCase();
  if (!needle) return items;
  return items.filter((x) => {
    if (!x) return false;
    const p = x.program || (x.payload && x.payload.program) || null;
    return p && String(p).trim().toLowerCase() === needle;
  });
}

function perFarmStats(events, { nowMs = Date.now() } = {}) {
  const m = new Map();
  if (!Array.isArray(events)) return m;
  const thirty = nowMs - 30 * MS_DAY;
  const seven  = nowMs - 7  * MS_DAY;
  for (const e of events) {
    if (!e || !e.farmId) continue;
    let s = m.get(e.farmId);
    if (!s) {
      s = {
        farmId: e.farmId, userId: e.userId || null,
        program: e.program || (e.payload && e.payload.program) || null,
        crop: e.crop || null, region: e.region || null,
        total: 0, completed: 0, seen: 0,
        lastActivityMs: 0, wasActive7: false, wasActive30: false,
        activeDays: new Set(),
      };
      m.set(e.farmId, s);
    }
    s.total++;
    if (e.eventType === 'task_completed') s.completed++;
    else if (e.eventType === 'task_seen') s.seen++;
    const ts = toMs(e.createdAt);
    if (ts != null) {
      if (ts > s.lastActivityMs) s.lastActivityMs = ts;
      if (ts >= seven)  s.wasActive7  = true;
      if (ts >= thirty) {
        s.wasActive30 = true;
        s.activeDays.add(new Date(ts).toISOString().slice(0, 10));
      }
    }
  }
  return m;
}

/**
 * buildProgramSummary → { program, totalFarmers, activeFarmers,
 *                         completionRate, highRiskFarmers }
 */
function buildProgramSummary(events, { program = null, weatherFor = null, nowMs } = {}) {
  const filtered = filterByProgram(events, program);
  const stats = perFarmStats(filtered, { nowMs });

  let totalCompleted = 0, totalSeen = 0, highRisk = 0, active = 0;
  for (const s of stats.values()) {
    totalCompleted += s.completed;
    totalSeen      += s.seen;
    if (s.wasActive7) active++;
    const r = calculateRisk({
      weather: typeof weatherFor === 'function' ? weatherFor(s) : {},
      completionRate: (s.completed + s.seen) > 0
        ? s.completed / (s.completed + s.seen) : 0.5,
      stage: null,
    });
    if (r.level === 'high') highRisk++;
  }

  const ratioTotal = totalCompleted + totalSeen;
  const completionRate = ratioTotal > 0 ? totalCompleted / ratioTotal : 0.65;

  return Object.freeze({
    program: program || null,
    totalFarmers:    stats.size,
    activeFarmers:   active,
    completionRate,
    highRiskFarmers: highRisk,
  });
}

/**
 * buildProgramFarmers →
 *   [{farmId, farmerName, location, crop, risk, score, lastActivity, status}]
 * Sorted high-risk first; score desc within tie.
 */
function buildProgramFarmers(events, farms = [], { program = null, weatherFor = null, nowMs } = {}) {
  const filtered = filterByProgram(events, program);
  const stats = perFarmStats(filtered, { nowMs });

  const farmIndex = new Map();
  if (Array.isArray(farms)) {
    for (const f of farms) { if (f && f.id) farmIndex.set(f.id, f); }
  }

  const rows = [];
  for (const s of stats.values()) {
    const f = farmIndex.get(s.farmId) || {};
    const ratioTotal = s.completed + s.seen;
    const completionRate = ratioTotal > 0 ? s.completed / ratioTotal : 0.5;
    const weather = typeof weatherFor === 'function' ? weatherFor(s) : {};
    const risk = calculateRisk({
      weather, completionRate, stage: f.stage || f.cropStage || null,
    });
    const scored = computeScore({
      completionRate, consistencyDays: s.activeDays.size,
      riskLevel: risk.level, farmEventsCount: s.total,
    });
    rows.push({
      farmId:      s.farmId,
      farmerName:  f.farmerName || null,
      location:    f.locationName || f.country || s.region || null,
      crop:        f.crop || s.crop || null,
      risk:        risk.level,
      score:       scored.score,
      lastActivity: s.lastActivityMs
        ? new Date(s.lastActivityMs).toISOString() : null,
      status:      s.wasActive7 ? 'active' : (s.wasActive30 ? 'quiet' : 'inactive'),
    });
  }
  const sev = { high: 3, medium: 2, low: 1 };
  rows.sort((a, b) =>
    (sev[b.risk] || 0) - (sev[a.risk] || 0) || (b.score - a.score));
  return rows;
}

function buildProgramRisk(events, { program = null, weatherFor = null, nowMs } = {}) {
  const filtered = filterByProgram(events, program);
  const stats = perFarmStats(filtered, { nowMs });
  const out = { high: 0, medium: 0, low: 0 };
  for (const s of stats.values()) {
    const ratioTotal = s.completed + s.seen;
    const completionRate = ratioTotal > 0 ? s.completed / ratioTotal : 0.5;
    const weather = typeof weatherFor === 'function' ? weatherFor(s) : {};
    const risk = calculateRisk({ weather, completionRate, stage: null });
    out[risk.level] = (out[risk.level] || 0) + 1;
  }
  return Object.freeze(out);
}

function buildProgramPerformance(events, farms = [], { program = null, weatherFor = null, nowMs } = {}) {
  const filtered = filterByProgram(events, program);
  const stats = perFarmStats(filtered, { nowMs });
  const farmIndex = new Map((farms || [])
    .filter((f) => f && f.id).map((f) => [f.id, f]));

  let sumYield = 0, sumScore = 0, n = 0;
  let totalCompleted = 0, totalSeen = 0;
  for (const s of stats.values()) {
    const f = farmIndex.get(s.farmId) || {};
    const ratioTotal = s.completed + s.seen;
    const completionRate = ratioTotal > 0 ? s.completed / ratioTotal : 0.5;
    totalCompleted += s.completed;
    totalSeen      += s.seen;
    const weather = typeof weatherFor === 'function' ? weatherFor(s) : {};
    const rainfall = Number.isFinite(weather.rainfall)
      ? weather.rainfall : (weather.rainExpected ? 25 : 15);
    const risk = calculateRisk({ weather, completionRate, stage: f.stage || null });
    const y = estimateYield({ crop: f.crop || s.crop, rainfall, completionRate });
    const score = computeScore({
      completionRate, consistencyDays: s.activeDays.size,
      riskLevel: risk.level, farmEventsCount: s.total,
    });
    sumYield += y.estimated; sumScore += score.score; n++;
  }

  const ratioTotal = totalCompleted + totalSeen;
  return Object.freeze({
    avgYield: n > 0 ? Math.round(sumYield / n) : 0,
    avgScore: n > 0 ? Math.round(sumScore / n) : 0,
    taskCompletion: ratioTotal > 0 ? totalCompleted / ratioTotal : 0,
    farmCount: n,
  });
}

function escapeCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildProgramCsv(events, farms = [], { program = null, weatherFor = null, nowMs, limit = 500 } = {}) {
  const rows = buildProgramFarmers(events, farms, { program, weatherFor, nowMs })
    .slice(0, limit);
  const lines = ['farmer_name,crop,risk,score,last_activity,location,status'];
  for (const r of rows) {
    lines.push([
      escapeCsv(r.farmerName),
      escapeCsv(r.crop),
      escapeCsv(r.risk),
      escapeCsv(r.score),
      escapeCsv(r.lastActivity),
      escapeCsv(r.location),
      escapeCsv(r.status),
    ].join(','));
  }
  return lines.join('\n') + '\n';
}

const _internal = { perFarmStats, filterByProgram, escapeCsv };
export {
  buildProgramSummary,
  buildProgramFarmers,
  buildProgramRisk,
  buildProgramPerformance,
  buildProgramCsv,
  _internal,
};
export default {
  buildProgramSummary, buildProgramFarmers,
  buildProgramRisk, buildProgramPerformance, buildProgramCsv,
  _internal,
};
