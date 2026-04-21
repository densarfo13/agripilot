/**
 * ngoInsightsEngine.js — operational NGO insights over local-first
 * data. Pure + deterministic. No backend dependency.
 *
 *   getNgoInsights({
 *     farms,            // Farm[] from farrowayLocal.getFarms()
 *     issues,           // Issue[] from issueStore.getAllIssues()
 *     events,           // farmEvents log (for active-farmer detection)
 *     progressRecords,  // optional — mirrors events when supplied
 *     regionProfiles,   // optional — region → { climate, season, … }
 *     program,          // optional — filter farms + issues by program
 *     now,              // epoch ms (for deterministic testing)
 *     activeWindowDays, // default 7
 *     hotspotDays,      // default 14
 *   }) → {
 *     totals:       { totalFarmers, activeFarmers, inactiveFarmers,
 *                     openIssues, highRiskFarmers },
 *     byRegion:     [{ regionKey, farmerCount, activeCount,
 *                      issueCount, openIssues, resolvedIssues,
 *                      highRiskCount, topCrop }],
 *     byCrop:       [{ crop, farmerCount, issueCount, highRiskCount }],
 *     hotspots:     [{ regionKey, crop, issueType, count, severity }],
 *     officerFocus: [{ regionKey, reason, reasonKey, priority, score }],
 *     filteredBy:   { program },
 *   }
 *
 * All numeric outputs are integers. Empty inputs return zero-filled
 * totals — never NaN. Every region/crop row is deterministically
 * sorted (by `regionKey` / `crop` ascending) so CSV + UI consumers
 * can rely on stable ordering.
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
  if (issue.region && issue.region !== '*') {
    return String(issue.region).toUpperCase();
  }
  const candidates = [issue.stateCode, issue.countryCode, issue.location]
    .filter(Boolean)
    .map((s) => String(s).toUpperCase());
  return candidates[0] || 'unknown';
}

function eventMatchesFarm(evt, farmId) {
  if (!evt) return false;
  if (evt.farmId && farmId && String(evt.farmId) === String(farmId)) return true;
  return false;
}

/**
 * isActive — spec §2. A farmer (identified by farmId here — one
 * row per farm in the active-farmer roll-up) is active when either:
 *   • A task_completed event exists in the last `windowDays`, OR
 *   • Any event touching this farm exists in the last `windowDays`.
 */
function isActive({ farm, events = [], progressRecords = [], cutoff }) {
  for (const e of events) {
    if (!e || (e.timestamp || 0) < cutoff) continue;
    if (eventMatchesFarm(e, farm.id)) return true;
  }
  for (const p of progressRecords) {
    if (!p || (p.timestamp || 0) < cutoff) continue;
    if (eventMatchesFarm(p, farm.id) && p.completed !== false) return true;
  }
  return false;
}

/**
 * pickTopCrop — given a list of farms in a region, return the most
 * common crop code. Ties break alphabetically for determinism.
 */
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

// ─── Hotspots (spec §4) ──────────────────────────────────────────
/**
 * detectHotspots — group issues by (region, crop, issueType) and
 * return groups with 3+ issues in the last `hotspotDays`. Severity
 * tag: `medium` for 3–4, `high` for ≥5.
 */
function detectHotspots(issues, { now, hotspotDays }) {
  const cutoff = now - Math.max(0, hotspotDays) * DAY_MS;
  const groups = new Map();

  for (const issue of issues) {
    if (!issue || (issue.createdAt || 0) < cutoff) continue;
    const regionKey = issueRegionKey(issue);
    const crop      = lower(issue.crop) || 'unknown';
    const issueType = String(issue.issueType || 'unknown');
    const key = `${regionKey}::${crop}::${issueType}`;
    const entry = groups.get(key) || {
      regionKey, crop, issueType, count: 0, ids: [],
    };
    entry.count += 1;
    entry.ids.push(issue.id);
    groups.set(key, entry);
  }

  const out = [];
  for (const entry of groups.values()) {
    if (entry.count < 3) continue;
    out.push(Object.freeze({
      regionKey: entry.regionKey,
      crop:      entry.crop,
      issueType: entry.issueType,
      count:     entry.count,
      severity:  entry.count >= 5 ? 'high' : 'medium',
      ids:       Object.freeze(entry.ids.slice(0, 20)),
    }));
  }
  // Highest count first, stable tie-break by (region, crop).
  out.sort((a, b) => (b.count - a.count)
    || a.regionKey.localeCompare(b.regionKey)
    || a.crop.localeCompare(b.crop));
  return out;
}

// ─── Officer focus (spec §5) ─────────────────────────────────────
/**
 * scoreOfficerFocus — rank regions for "where to focus first":
 *   • hotspot present                    → +3 per hotspot
 *   • high-risk farmer count (per region) → +2 × count
 *   • inactive farmer concentration (>=50% inactive in region, min 2)
 *                                         → +2
 *   • rising open issues (>= 5 open)       → +1
 * Ties break alphabetically on regionKey.
 */
function scoreOfficerFocus({ byRegion, hotspots }) {
  const byKey = new Map();
  for (const row of byRegion) {
    const score = { regionKey: row.regionKey, score: 0, reasons: [] };
    byKey.set(row.regionKey, score);

    if (row.highRiskCount > 0) {
      score.score   += 2 * row.highRiskCount;
      score.reasons.push({ rule: 'high_risk_farmers',
        detail: `${row.highRiskCount} high-risk farms` });
    }
    const inactive = row.farmerCount - row.activeCount;
    if (row.farmerCount >= 2 && inactive / row.farmerCount >= 0.5) {
      score.score += 2;
      score.reasons.push({ rule: 'inactive_concentration',
        detail: `${inactive} of ${row.farmerCount} farms inactive` });
    }
    if (row.openIssues >= 5) {
      score.score += 1;
      score.reasons.push({ rule: 'open_issue_volume',
        detail: `${row.openIssues} open issues` });
    }
  }

  for (const h of hotspots) {
    const key = h.regionKey;
    const existing = byKey.get(key) || {
      regionKey: key, score: 0, reasons: [],
    };
    // Hotspot weight is deliberately large (spec §5 "hotspot first")
    // so a single hotspot always outranks a region carrying only
    // high-risk counts or inactive concentration. High-severity
    // hotspots add on top.
    existing.score += 10 + (h.severity === 'high' ? 5 : 0) + h.count;
    existing.reasons.unshift({
      rule:   'hotspot',
      detail: `${h.count} ${h.issueType} reports in ${h.crop || 'multiple crops'}`,
    });
    byKey.set(key, existing);
  }

  const out = [];
  for (const { regionKey, score, reasons } of byKey.values()) {
    if (score <= 0) continue;
    const priority =
        score >= 15 ? 'critical'
      : score >= 10 ? 'high'
      : score >= 5  ? 'medium'
      :               'low';
    out.push(Object.freeze({
      regionKey,
      priority,
      score,
      reason:    reasons.map((r) => r.detail).join('; '),
      reasonKey: reasons[0] ? `ngo.focus.${reasons[0].rule}` : 'ngo.focus.general',
      reasons:   Object.freeze(reasons.map(Object.freeze)),
    }));
  }
  out.sort((a, b) => (b.score - a.score) || a.regionKey.localeCompare(b.regionKey));
  return out;
}

// ─── Main entry ──────────────────────────────────────────────────
export function getNgoInsights({
  farms             = [],
  issues            = [],
  events            = [],
  progressRecords   = [],
  regionProfiles    = {},
  program           = null,
  now               = Date.now(),
  activeWindowDays  = 7,
  hotspotDays       = 14,
} = {}) {
  const cutoff = now - Math.max(0, activeWindowDays) * DAY_MS;

  // Program filter — both farms and issues.
  const farmList = Array.isArray(farms) ? farms.filter(Boolean) : [];
  const issueList = Array.isArray(issues) ? issues.filter(Boolean) : [];
  const filteredFarms  = program
    ? farmList.filter((f) => String(f.program || '') === String(program))
    : farmList;
  const filteredIssues = program
    ? issueList.filter((i) => String(i.program || '') === String(program))
    : issueList;

  // Build per-farm index (only once) so region + crop aggregations
  // share the same active + high-risk computations.
  const farmRows = filteredFarms.map((farm) => ({
    farm,
    regionKey: regionKeyOf(farm),
    crop:      lower(farm.crop),
    active:    isActive({ farm, events, progressRecords, cutoff }),
  }));

  // Risk proxy — a farm is "high risk" when it has any open issue
  // with severity high/critical OR any issue.riskLevel === 'high'.
  const highRiskFarmIds = new Set();
  for (const i of filteredIssues) {
    if (!i || !i.farmId) continue;
    const sev = String(i.severity || '').toLowerCase();
    const isOpen = i.status !== 'resolved';
    if (isOpen && (sev === 'high' || sev === 'critical')) {
      highRiskFarmIds.add(String(i.farmId));
    }
    if (String(i.riskLevel || '').toLowerCase() === 'high') {
      highRiskFarmIds.add(String(i.farmId));
    }
  }

  // ─── Totals ──────────────────────────────────────────────────
  const totalFarmers    = farmRows.length;
  const activeFarmers   = farmRows.filter((r) => r.active).length;
  const inactiveFarmers = totalFarmers - activeFarmers;
  const openIssues      = filteredIssues.filter((i) => i.status !== 'resolved').length;
  const highRiskFarmers = Array.from(highRiskFarmIds).filter(
    (id) => farmRows.some((r) => r.farm.id === id),
  ).length;

  // ─── byRegion ────────────────────────────────────────────────
  const byRegionMap = new Map();
  for (const row of farmRows) {
    const key = row.regionKey;
    const entry = byRegionMap.get(key) || {
      regionKey:      key,
      farms:          [],
      farmerCount:    0,
      activeCount:    0,
      issueCount:     0,
      openIssues:     0,
      resolvedIssues: 0,
      highRiskCount:  0,
    };
    entry.farms.push(row.farm);
    entry.farmerCount += 1;
    if (row.active) entry.activeCount += 1;
    if (highRiskFarmIds.has(row.farm.id)) entry.highRiskCount += 1;
    byRegionMap.set(key, entry);
  }
  // Roll issues into the matching region entry. Issues carrying a
  // region we haven't seen via farms still create a row.
  for (const issue of filteredIssues) {
    const key = issueRegionKey(issue);
    const entry = byRegionMap.get(key) || {
      regionKey:      key,
      farms:          [],
      farmerCount:    0,
      activeCount:    0,
      issueCount:     0,
      openIssues:     0,
      resolvedIssues: 0,
      highRiskCount:  0,
    };
    entry.issueCount += 1;
    if (issue.status === 'resolved') entry.resolvedIssues += 1;
    else                             entry.openIssues     += 1;
    byRegionMap.set(key, entry);
  }
  const byRegion = Array.from(byRegionMap.values()).map((entry) => Object.freeze({
    regionKey:      entry.regionKey,
    farmerCount:    entry.farmerCount,
    activeCount:    entry.activeCount,
    issueCount:     entry.issueCount,
    openIssues:     entry.openIssues,
    resolvedIssues: entry.resolvedIssues,
    highRiskCount:  entry.highRiskCount,
    topCrop:        pickTopCrop(entry.farms),
    climate:        regionProfiles && regionProfiles[entry.regionKey]
                      ? regionProfiles[entry.regionKey].climate : null,
    season:         regionProfiles && regionProfiles[entry.regionKey]
                      ? regionProfiles[entry.regionKey].season  : null,
  }));
  byRegion.sort((a, b) => a.regionKey.localeCompare(b.regionKey));

  // ─── byCrop ──────────────────────────────────────────────────
  const byCropMap = new Map();
  for (const row of farmRows) {
    const c = row.crop || 'unknown';
    const entry = byCropMap.get(c) || {
      crop: c, farmerCount: 0, issueCount: 0, highRiskCount: 0,
    };
    entry.farmerCount += 1;
    if (highRiskFarmIds.has(row.farm.id)) entry.highRiskCount += 1;
    byCropMap.set(c, entry);
  }
  for (const i of filteredIssues) {
    const c = lower(i.crop) || 'unknown';
    const entry = byCropMap.get(c) || {
      crop: c, farmerCount: 0, issueCount: 0, highRiskCount: 0,
    };
    entry.issueCount += 1;
    byCropMap.set(c, entry);
  }
  const byCrop = Array.from(byCropMap.values()).map((e) => Object.freeze({ ...e }));
  byCrop.sort((a, b) => a.crop.localeCompare(b.crop));

  // ─── Hotspots ────────────────────────────────────────────────
  const hotspots = detectHotspots(filteredIssues, { now, hotspotDays });

  // ─── Officer focus ───────────────────────────────────────────
  const officerFocus = scoreOfficerFocus({ byRegion, hotspots });

  return Object.freeze({
    totals: Object.freeze({
      totalFarmers, activeFarmers, inactiveFarmers,
      openIssues, highRiskFarmers,
    }),
    byRegion:     Object.freeze(byRegion),
    byCrop:       Object.freeze(byCrop),
    hotspots:     Object.freeze(hotspots),
    officerFocus: Object.freeze(officerFocus),
    filteredBy:   Object.freeze({ program: program || null }),
  });
}

// ─── CSV export helpers (spec §8) ────────────────────────────────
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/["\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * exportInsightsCsv — per-farmer detail. One row per farm covering
 * crop, region, risk, issue count, activity, program.
 */
export function exportInsightsCsv({
  farms = [], issues = [], events = [], progressRecords = [],
  program = null, now = Date.now(), activeWindowDays = 7,
} = {}) {
  const cutoff = now - Math.max(0, activeWindowDays) * DAY_MS;
  const filteredFarms = program
    ? farms.filter((f) => String(f.program || '') === String(program))
    : farms.slice();

  const headers = ['farmerId', 'farmId', 'crop', 'region', 'risk',
                   'issueCount', 'activity', 'program'];
  const rows = [headers.join(',')];

  for (const farm of filteredFarms) {
    if (!farm) continue;
    const regionKey = regionKeyOf(farm);
    const related = issues.filter((i) => i && String(i.farmId) === String(farm.id));
    const highRisk = related.some((i) => {
      const sev = String(i.severity || '').toLowerCase();
      return sev === 'high' || sev === 'critical'
        || String(i.riskLevel || '').toLowerCase() === 'high';
    });
    const active = isActive({ farm, events, progressRecords, cutoff });
    rows.push([
      csvEscape(farm.farmerId || ''),
      csvEscape(farm.id),
      csvEscape(farm.crop || ''),
      csvEscape(regionKey),
      csvEscape(highRisk ? 'high' : 'low'),
      csvEscape(related.length),
      csvEscape(active ? 'active' : 'inactive'),
      csvEscape(farm.program || ''),
    ].join(','));
  }
  return rows.join('\n') + (rows.length > 1 ? '\n' : '');
}

/**
 * exportRegionSummaryCsv — compact region roll-up for NGO reporting.
 */
export function exportRegionSummaryCsv(insights) {
  const rows = ['region,farmerCount,openIssues,highRiskCount,topCrop'];
  const regions = (insights && insights.byRegion) || [];
  for (const r of regions) {
    rows.push([
      csvEscape(r.regionKey),
      csvEscape(r.farmerCount),
      csvEscape(r.openIssues),
      csvEscape(r.highRiskCount),
      csvEscape(r.topCrop || ''),
    ].join(','));
  }
  return rows.join('\n') + (rows.length > 1 ? '\n' : '');
}

export const _internal = Object.freeze({
  DAY_MS, regionKeyOf, issueRegionKey, isActive, pickTopCrop,
  detectHotspots, scoreOfficerFocus, csvEscape,
});
