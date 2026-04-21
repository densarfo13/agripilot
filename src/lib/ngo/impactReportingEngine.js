/**
 * impactReportingEngine.js — NGO-grade impact reporting over local
 * data. Pure + deterministic. No backend dependency.
 *
 * Inputs are the same arrays every other NGO module already consumes
 * (farms, issues, events, outcomes). Outcomes is the only optional
 * new shape: `[{ action, farmId, farmerId, crop, region, success,
 * timestamp }]`. Callers can feed this from farroway.feedback
 * combined with farmEvents, or from a future dedicated outcome store;
 * the engine only cares about the shape.
 *
 *   getImpactReport({
 *     farms, progressRecords, events, issues, outcomes,
 *     regionProfiles, program, now,
 *     activeWindowDays, changeWindowDays,
 *     minInterventionSample,
 *   }) → {
 *     summary, interventions, byRegion, byCrop, changes, evidence,
 *     filteredBy,
 *   }
 *
 * The engine + all helpers are frozen. Every numeric output is an
 * integer or a 0..1 ratio; empty inputs return zero-filled summaries
 * (never NaN). All label-bearing fields (reasonKey etc.) are i18n
 * keys so the UI layer translates via t().
 */

const DAY_MS = 24 * 3600 * 1000;

function lower(s) { return String(s || '').toLowerCase(); }

function regionKeyOf(farm) {
  if (!farm) return 'unknown';
  const parts = [
    (farm.countryCode || farm.country || '').toString().toUpperCase(),
    (farm.stateCode   || farm.state   || '').toString().toUpperCase(),
  ].filter(Boolean);
  return parts.join('/') || 'unknown';
}

function issueRegionKey(issue) {
  if (!issue) return 'unknown';
  const country = String(issue.countryCode || '').toUpperCase();
  const state   = String(issue.stateCode   || issue.region || '').toUpperCase();
  if (country && state && state !== '*') return `${country}/${state}`;
  if (state && state !== '*') return state;
  if (country) return country;
  return String(issue.location || 'unknown').toUpperCase();
}

function outcomeRegionKey(o) {
  if (!o) return 'unknown';
  const country = String(o.countryCode || '').toUpperCase();
  const state   = String(o.stateCode   || o.region || '').toUpperCase();
  if (country && state && state !== '*') return `${country}/${state}`;
  return state || country || 'unknown';
}

function safeRatio(num, den) {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return 0;
  return num / den;
}

// ─── Activity detection ──────────────────────────────────────────
function recentEventForFarm(events, farmId, cutoff) {
  for (const e of events || []) {
    if (!e || (e.timestamp || 0) < cutoff) continue;
    if (String(e.farmId || '') === String(farmId)) return e;
  }
  return null;
}

function isActive({ farm, events = [], progressRecords = [], cutoff }) {
  if (recentEventForFarm(events, farm.id, cutoff)) return true;
  for (const p of progressRecords) {
    if (!p || (p.timestamp || 0) < cutoff) continue;
    if (String(p.farmId || '') !== String(farm.id)) continue;
    if (p.completed === false) continue;
    return true;
  }
  return false;
}

// ─── Completion rate ─────────────────────────────────────────────
/**
 * farmCompletionRate — completed / (completed + skipped). Falls back
 * to 1.0 when we only have completion events (no skip signal) AND
 * there's at least one completion — this captures "engaged but we
 * can't measure failure". Returns 0 when there's nothing to measure.
 */
function farmCompletionRate({ farmId, progressRecords = [], events = [] }) {
  let completed = 0;
  let skipped = 0;
  for (const p of progressRecords) {
    if (!p || String(p.farmId || '') !== String(farmId)) continue;
    if (p.completed === false)      skipped += 1;
    else if (p.completed === true)  completed += 1;
    else if (p.type === 'task_skipped') skipped += 1;
    else if (p.type === 'task_completed') completed += 1;
  }
  for (const e of events) {
    if (!e || String(e.farmId || '') !== String(farmId)) continue;
    if (e.type === 'task_completed') completed += 1;
    if (e.type === 'task_skipped')   skipped += 1;
  }
  if (completed === 0 && skipped === 0) return 0;
  if (skipped === 0) return 1;
  return safeRatio(completed, completed + skipped);
}

// ─── Intervention effectiveness ──────────────────────────────────
/**
 * scoreInterventions — group `outcomes` by (action, crop, region) and
 * compute { sampleSize, successRate, confidenceLevel }. Only groups
 * with sampleSize >= minSample are surfaced.
 *
 * confidenceLevel uses a simple bucket of sample size:
 *   n  < 3   → 'insufficient' (filtered out)
 *   3..5     → 'low'
 *   6..9     → 'medium'
 *   10+      → 'high'
 */
function scoreInterventions(outcomes, { minSample }) {
  const groups = new Map();
  for (const o of outcomes || []) {
    if (!o || !o.action) continue;
    const action = String(o.action);
    const crop   = lower(o.crop);
    const region = outcomeRegionKey(o);
    const key = `${action}::${crop}::${region}`;
    const entry = groups.get(key) || {
      action, crop, region, sampleSize: 0, successes: 0,
    };
    entry.sampleSize += 1;
    if (o.success === true) entry.successes += 1;
    groups.set(key, entry);
  }
  const out = [];
  for (const entry of groups.values()) {
    if (entry.sampleSize < minSample) continue;
    const successRate = safeRatio(entry.successes, entry.sampleSize);
    const confidence =
        entry.sampleSize >= 10 ? 'high'
      : entry.sampleSize >= 6  ? 'medium'
      :                           'low';
    out.push(Object.freeze({
      action:          entry.action,
      crop:            entry.crop || null,
      region:          entry.region || null,
      sampleSize:      entry.sampleSize,
      successes:       entry.successes,
      successRate,
      confidenceLevel: confidence,
    }));
  }
  // Highest success rate first, tie-break by sample size.
  out.sort((a, b) => (b.successRate - a.successRate)
    || (b.sampleSize - a.sampleSize)
    || a.action.localeCompare(b.action));
  return out;
}

// ─── Change detection (spec §5) ──────────────────────────────────
/**
 * detectChanges — compare a recent window vs the window immediately
 * before it, on three dimensions: progress-score proxy, issue volume,
 * completion volume. The "progress score" proxy is the number of
 * task_completed events per region / crop in the window; NGOs don't
 * need the full engine output for a trend signal, just relative
 * motion between the two periods.
 *
 * Returns arrays of { key, delta, direction } for regions and crops,
 * already split into improving (positive delta) and declining (negative).
 */
function detectChanges({
  farms, issues, events, progressRecords, now, windowDays,
}) {
  const recentCutoff = now - windowDays * DAY_MS;
  const priorCutoff  = now - 2 * windowDays * DAY_MS;

  const regionRecent = new Map();
  const regionPrior  = new Map();
  const cropRecent   = new Map();
  const cropPrior    = new Map();

  // Farms index: farmId → { region, crop }
  const farmIndex = new Map();
  for (const f of farms) {
    if (!f || !f.id) continue;
    farmIndex.set(String(f.id), { region: regionKeyOf(f), crop: lower(f.crop) });
  }

  function bump(map, key, field, amount = 1) {
    if (!key) return;
    const row = map.get(key) || {};
    row[field] = (row[field] || 0) + amount;
    map.set(key, row);
  }

  function processEvent(e) {
    if (!e) return;
    const ts = Number(e.timestamp || 0);
    const inRecent = ts >= recentCutoff;
    const inPrior  = ts < recentCutoff && ts >= priorCutoff;
    if (!inRecent && !inPrior) return;
    const idx = farmIndex.get(String(e.farmId || ''));
    const region = idx ? idx.region : 'unknown';
    const crop   = idx ? idx.crop   : 'unknown';

    if (e.type === 'task_completed') {
      bump(inRecent ? regionRecent : regionPrior, region, 'completions');
      bump(inRecent ? cropRecent   : cropPrior,   crop,   'completions');
    }
  }

  for (const e of events)          processEvent(e);
  for (const p of progressRecords) processEvent(
    // Map progressRecords' { completed: true } to a task_completed event shape
    p && p.completed !== false
      ? { ...p, type: p.type || 'task_completed' }
      : p,
  );

  // Issue volume per region/crop in each window.
  for (const i of issues) {
    if (!i) continue;
    const ts = Number(i.createdAt || 0);
    const inRecent = ts >= recentCutoff;
    const inPrior  = ts < recentCutoff && ts >= priorCutoff;
    if (!inRecent && !inPrior) continue;
    const region = issueRegionKey(i);
    const crop   = lower(i.crop) || 'unknown';
    bump(inRecent ? regionRecent : regionPrior, region, 'issues');
    bump(inRecent ? cropRecent   : cropPrior,   crop,   'issues');
  }

  function diffMaps(recent, prior) {
    const out = [];
    const keys = new Set([...recent.keys(), ...prior.keys()]);
    for (const key of keys) {
      const r = recent.get(key) || {};
      const p = prior.get(key)  || {};
      const completionsDelta = (r.completions || 0) - (p.completions || 0);
      const issuesDelta      = (r.issues || 0)      - (p.issues || 0);
      // Net signal: more completions + fewer issues = improving.
      // Weighting is small + explainable; no ML.
      const net = completionsDelta - issuesDelta;
      if (net === 0) continue;
      out.push(Object.freeze({
        key,
        completionsDelta,
        issuesDelta,
        netDelta: net,
        direction: net > 0 ? 'improving' : 'declining',
      }));
    }
    out.sort((a, b) => Math.abs(b.netDelta) - Math.abs(a.netDelta));
    return out;
  }

  const regionDiffs = diffMaps(regionRecent, regionPrior);
  const cropDiffs   = diffMaps(cropRecent,   cropPrior);

  return {
    improvingRegions: regionDiffs.filter((r) => r.direction === 'improving'),
    decliningRegions: regionDiffs.filter((r) => r.direction === 'declining'),
    improvingCrops:   cropDiffs.filter((r) => r.direction === 'improving'),
    decliningCrops:   cropDiffs.filter((r) => r.direction === 'declining'),
  };
}

// ─── Per-farm evidence row ───────────────────────────────────────
/**
 * Build one evidence row per farm. Captures the fields donors /
 * program reporting typically want to see.
 */
function buildEvidence({
  farms, events, progressRecords, issues, outcomes, cutoff,
}) {
  const rows = [];
  for (const farm of farms) {
    if (!farm) continue;
    const farmId = farm.id;
    const completions = (events || [])
      .filter((e) => e && e.type === 'task_completed' && String(e.farmId) === String(farmId));
    const lastActivity = Math.max(
      ...(events || []).filter((e) => e && String(e.farmId || '') === String(farmId))
        .map((e) => e.timestamp || 0), 0,
    );
    const streak = completions.length; // proxy — lifetime completions
    const recentOutcomes = (outcomes || []).filter(
      (o) => o && String(o.farmId) === String(farmId)
          && (o.timestamp || 0) >= cutoff,
    );
    const recentOutcome = recentOutcomes.length > 0
      ? recentOutcomes[recentOutcomes.length - 1]
      : null;
    const openIssues = (issues || []).filter(
      (i) => i && String(i.farmId) === String(farmId) && i.status !== 'resolved',
    ).length;
    const resolvedIssues = (issues || []).filter(
      (i) => i && String(i.farmId) === String(farmId) && i.status === 'resolved',
    ).length;
    const completionRate = farmCompletionRate({
      farmId, progressRecords, events,
    });
    // Simple progressScore proxy: 0..100 from completion rate × 100
    // minus a small penalty per open issue. Keeps the UI numerical
    // without pulling the full progress engine.
    const progressScore = Math.max(0, Math.min(100,
      Math.round(completionRate * 100) - Math.min(20, openIssues * 5),
    ));
    rows.push(Object.freeze({
      farmerId:     farm.farmerId || null,
      farmId:       farm.id,
      program:      farm.program || null,
      crop:         farm.crop || null,
      region:       regionKeyOf(farm),
      progressScore,
      taskCompletionRate: completionRate,
      streak,
      lastActivity: lastActivity || null,
      openIssues,
      resolvedIssues,
      recentOutcome: recentOutcome
        ? Object.freeze({
            action:    recentOutcome.action,
            success:   recentOutcome.success === true,
            timestamp: recentOutcome.timestamp || null,
          })
        : null,
    }));
  }
  return rows;
}

// ─── Main entry ──────────────────────────────────────────────────
export function getImpactReport({
  farms               = [],
  progressRecords     = [],
  events              = [],
  issues              = [],
  outcomes            = [],
  regionProfiles      = {},
  program             = null,
  now                 = Date.now(),
  activeWindowDays    = 7,
  changeWindowDays    = 7,
  minInterventionSample = 3,
} = {}) {
  const cutoff = now - activeWindowDays * DAY_MS;

  // Program filter — everything downstream honours it.
  const farmList  = Array.isArray(farms)  ? farms.filter(Boolean)  : [];
  const issueList = Array.isArray(issues) ? issues.filter(Boolean) : [];
  const outcomeList = Array.isArray(outcomes) ? outcomes.filter(Boolean) : [];
  const filteredFarms  = program
    ? farmList.filter((f) => String(f.program || '') === String(program))
    : farmList;
  const filteredIssues = program
    ? issueList.filter((i) => String(i.program || '') === String(program))
    : issueList;
  const filteredOutcomes = program
    ? outcomeList.filter((o) => String(o.program || '') === String(program))
    : outcomeList;

  // ─── Summary ─────────────────────────────────────────────────
  let activeFarmers = 0;
  let sumProgress = 0;
  let sumRate     = 0;
  let highRiskCount = 0;

  const evidence = buildEvidence({
    farms: filteredFarms, events, progressRecords,
    issues: filteredIssues, outcomes: filteredOutcomes, cutoff,
  });
  const evidenceById = new Map();
  for (const row of evidence) evidenceById.set(row.farmId, row);

  const highRiskFarmIds = new Set();
  for (const i of filteredIssues) {
    if (!i || !i.farmId) continue;
    const sev = lower(i.severity);
    if ((i.status !== 'resolved' && (sev === 'high' || sev === 'critical'))
        || lower(i.riskLevel) === 'high') {
      highRiskFarmIds.add(String(i.farmId));
    }
  }

  for (const farm of filteredFarms) {
    const row = evidenceById.get(farm.id);
    if (row) {
      sumProgress += row.progressScore;
      sumRate     += row.taskCompletionRate;
    }
    if (isActive({ farm, events, progressRecords, cutoff })) activeFarmers += 1;
    if (highRiskFarmIds.has(farm.id)) highRiskCount += 1;
  }

  const totalFarmers = filteredFarms.length;
  const openIssues      = filteredIssues.filter((i) => i.status !== 'resolved').length;
  const resolvedIssues  = filteredIssues.filter((i) => i.status === 'resolved').length;
  const avgProgressScore = totalFarmers > 0
    ? Math.round(sumProgress / totalFarmers)
    : 0;
  const avgTaskCompletionRate = totalFarmers > 0
    ? Math.round((sumRate / totalFarmers) * 100) / 100
    : 0;

  const summary = Object.freeze({
    totalFarmers,
    activeFarmers,
    inactiveFarmers: totalFarmers - activeFarmers,
    avgProgressScore,
    avgTaskCompletionRate,
    openIssues,
    resolvedIssues,
    highRiskFarmers: highRiskCount,
  });

  // ─── Interventions ───────────────────────────────────────────
  const interventions = scoreInterventions(filteredOutcomes, {
    minSample: minInterventionSample,
  });

  // ─── byRegion ────────────────────────────────────────────────
  const regionMap = new Map();
  for (const row of evidence) {
    const entry = regionMap.get(row.region) || {
      regionKey: row.region,
      farmerCount: 0, farms: [],
      sumProgress: 0, sumRate: 0,
      issueCount: 0, resolvedIssueCount: 0, highRiskCount: 0,
    };
    entry.farmerCount += 1;
    entry.sumProgress += row.progressScore;
    entry.sumRate     += row.taskCompletionRate;
    const farm = filteredFarms.find((f) => f.id === row.farmId);
    if (farm) entry.farms.push(farm);
    if (highRiskFarmIds.has(row.farmId)) entry.highRiskCount += 1;
    regionMap.set(row.region, entry);
  }
  for (const i of filteredIssues) {
    const key = issueRegionKey(i);
    const entry = regionMap.get(key) || {
      regionKey: key, farmerCount: 0, farms: [],
      sumProgress: 0, sumRate: 0,
      issueCount: 0, resolvedIssueCount: 0, highRiskCount: 0,
    };
    entry.issueCount += 1;
    if (i.status === 'resolved') entry.resolvedIssueCount += 1;
    regionMap.set(key, entry);
  }
  const byRegion = Array.from(regionMap.values()).map((e) => Object.freeze({
    regionKey:           e.regionKey,
    farmerCount:         e.farmerCount,
    avgProgressScore:    e.farmerCount > 0 ? Math.round(e.sumProgress / e.farmerCount) : 0,
    completionRate:      e.farmerCount > 0 ? Math.round((e.sumRate / e.farmerCount) * 100) / 100 : 0,
    issueCount:          e.issueCount,
    resolvedIssueCount:  e.resolvedIssueCount,
    highRiskCount:       e.highRiskCount,
    topCrop:             pickTopCrop(e.farms),
    climate:             regionProfiles[e.regionKey] ? regionProfiles[e.regionKey].climate : null,
    season:              regionProfiles[e.regionKey] ? regionProfiles[e.regionKey].season  : null,
  }));
  byRegion.sort((a, b) => a.regionKey.localeCompare(b.regionKey));

  // ─── byCrop ──────────────────────────────────────────────────
  const cropMap = new Map();
  for (const row of evidence) {
    const key = lower(row.crop) || 'unknown';
    const entry = cropMap.get(key) || {
      crop: key, farmerCount: 0,
      sumProgress: 0, sumRate: 0,
      issueCount: 0,
      interventionSuccesses: 0, interventionSamples: 0,
    };
    entry.farmerCount += 1;
    entry.sumProgress += row.progressScore;
    entry.sumRate     += row.taskCompletionRate;
    cropMap.set(key, entry);
  }
  for (const i of filteredIssues) {
    const key = lower(i.crop) || 'unknown';
    const entry = cropMap.get(key) || {
      crop: key, farmerCount: 0,
      sumProgress: 0, sumRate: 0,
      issueCount: 0,
      interventionSuccesses: 0, interventionSamples: 0,
    };
    entry.issueCount += 1;
    cropMap.set(key, entry);
  }
  for (const o of filteredOutcomes) {
    if (!o) continue;
    const key = lower(o.crop) || 'unknown';
    const entry = cropMap.get(key);
    if (!entry) continue;
    entry.interventionSamples += 1;
    if (o.success === true) entry.interventionSuccesses += 1;
  }
  const byCrop = Array.from(cropMap.values()).map((e) => Object.freeze({
    crop:             e.crop,
    farmerCount:      e.farmerCount,
    avgProgressScore: e.farmerCount > 0 ? Math.round(e.sumProgress / e.farmerCount) : 0,
    completionRate:   e.farmerCount > 0 ? Math.round((e.sumRate / e.farmerCount) * 100) / 100 : 0,
    successRate:      safeRatio(e.interventionSuccesses, e.interventionSamples),
    sampleSize:       e.interventionSamples,
    issueCount:       e.issueCount,
  }));
  byCrop.sort((a, b) => a.crop.localeCompare(b.crop));

  // ─── Change detection ────────────────────────────────────────
  const changes = detectChanges({
    farms: filteredFarms,
    issues: filteredIssues,
    events,
    progressRecords,
    now,
    windowDays: changeWindowDays,
  });

  return Object.freeze({
    summary,
    interventions: Object.freeze(interventions),
    byRegion:      Object.freeze(byRegion),
    byCrop:        Object.freeze(byCrop),
    changes: Object.freeze({
      improvingRegions: Object.freeze(changes.improvingRegions),
      decliningRegions: Object.freeze(changes.decliningRegions),
      improvingCrops:   Object.freeze(changes.improvingCrops),
      decliningCrops:   Object.freeze(changes.decliningCrops),
    }),
    evidence:      Object.freeze(evidence),
    filteredBy:    Object.freeze({ program: program || null }),
  });
}

function pickTopCrop(farms) {
  const tally = new Map();
  for (const f of farms) {
    if (!f || !f.crop) continue;
    const c = lower(f.crop);
    tally.set(c, (tally.get(c) || 0) + 1);
  }
  if (tally.size === 0) return null;
  let topCount = -1;
  let topCrop = null;
  for (const [crop, count] of tally.entries()) {
    if (count > topCount || (count === topCount && (topCrop == null || crop < topCrop))) {
      topCount = count;
      topCrop  = crop;
    }
  }
  return topCrop;
}

// ─── CSV exports (spec §9) ───────────────────────────────────────
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function isoOrEmpty(ts) {
  if (!ts || !Number.isFinite(Number(ts))) return '';
  try { return new Date(Number(ts)).toISOString(); } catch { return ''; }
}

/** Farmer Evidence CSV — spec §9A. Uses the evidence array. */
export function exportFarmerEvidenceCsv(report) {
  const headers = [
    'farmerId', 'farmId', 'program', 'crop', 'region',
    'progressScore', 'taskCompletionRate', 'streak',
    'lastActivity', 'recentOutcome',
  ];
  const rows = [headers.join(',')];
  const list = (report && report.evidence) || [];
  for (const row of list) {
    rows.push([
      csvEscape(row.farmerId || ''),
      csvEscape(row.farmId),
      csvEscape(row.program || ''),
      csvEscape(row.crop || ''),
      csvEscape(row.region),
      csvEscape(row.progressScore),
      csvEscape(Math.round(row.taskCompletionRate * 100) / 100),
      csvEscape(row.streak),
      csvEscape(isoOrEmpty(row.lastActivity)),
      csvEscape(row.recentOutcome
        ? `${row.recentOutcome.action}:${row.recentOutcome.success ? 'success' : 'pending'}`
        : ''),
    ].join(','));
  }
  return rows.join('\n') + (rows.length > 1 ? '\n' : '');
}

/** Region Summary CSV — spec §9B. */
export function exportRegionImpactCsv(report) {
  const headers = [
    'region', 'farmerCount', 'avgProgressScore', 'completionRate',
    'issueCount', 'resolvedIssueCount', 'highRiskCount', 'topCrop',
  ];
  const rows = [headers.join(',')];
  const list = (report && report.byRegion) || [];
  for (const row of list) {
    rows.push([
      csvEscape(row.regionKey),
      csvEscape(row.farmerCount),
      csvEscape(row.avgProgressScore),
      csvEscape(row.completionRate),
      csvEscape(row.issueCount),
      csvEscape(row.resolvedIssueCount),
      csvEscape(row.highRiskCount),
      csvEscape(row.topCrop || ''),
    ].join(','));
  }
  return rows.join('\n') + (rows.length > 1 ? '\n' : '');
}

/** Intervention Effectiveness CSV — spec §9C. */
export function exportInterventionCsv(report) {
  const headers = [
    'action', 'crop', 'region', 'sampleSize',
    'successRate', 'confidenceLevel',
  ];
  const rows = [headers.join(',')];
  const list = (report && report.interventions) || [];
  for (const row of list) {
    rows.push([
      csvEscape(row.action),
      csvEscape(row.crop || ''),
      csvEscape(row.region || ''),
      csvEscape(row.sampleSize),
      csvEscape(Math.round(row.successRate * 100) / 100),
      csvEscape(row.confidenceLevel),
    ].join(','));
  }
  return rows.join('\n') + (rows.length > 1 ? '\n' : '');
}

export const _internal = Object.freeze({
  DAY_MS, regionKeyOf, issueRegionKey, outcomeRegionKey,
  isActive, farmCompletionRate, scoreInterventions,
  detectChanges, buildEvidence, pickTopCrop,
});
