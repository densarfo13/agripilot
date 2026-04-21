/**
 * clusterDetection.js — lightweight outbreak / cluster detection.
 *
 * Rule (spec §10): if 5+ similar issues appear in the same region
 * within 7 days, flag a cluster so admin can investigate.
 *
 *   detectCluster(newIssue, allIssues, { now, windowDays, minCount }) → {
 *     clusterId: string,       // deterministic hash of region+type+crop
 *     region:    string,
 *     issueType: string,
 *     crop:      string | null,
 *     count:     number,
 *     reason:    string,
 *     since:     epoch ms,
 *     ids:       string[],     // issue ids inside the cluster
 *   } | null
 *
 * Deterministic: same input → same clusterId. No ML.
 * The window + threshold are configurable so operators can tune
 * for program scale without changing the engine.
 */

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_MIN_COUNT   = 5;
const DAY_MS = 24 * 3600 * 1000;

function keyFor(issue) {
  if (!issue) return null;
  const region = issue.stateCode || issue.state || issue.countryCode
              || issue.country   || issue.location || '';
  const issueType = issue.issueType || '';
  const crop      = issue.crop || '';
  if (!region || !issueType) return null;
  return { region: String(region), issueType: String(issueType), crop: String(crop) };
}

function clusterIdFor({ region, issueType, crop }) {
  return `cluster_${region}_${issueType}_${crop || 'any'}`.toLowerCase().replace(/\s+/g, '_');
}

/**
 * detectCluster — given a newly-created issue plus the current full
 * set of issues, return a cluster descriptor when the threshold is
 * reached within the time window. Null otherwise.
 */
export function detectCluster(newIssue, allIssues = [], {
  now        = Date.now(),
  windowDays = DEFAULT_WINDOW_DAYS,
  minCount   = DEFAULT_MIN_COUNT,
} = {}) {
  const key = keyFor(newIssue);
  if (!key) return null;

  const cutoff = now - Math.max(0, windowDays) * DAY_MS;
  const siblings = [];
  for (const other of allIssues) {
    if (!other) continue;
    if ((other.createdAt || 0) < cutoff) continue;
    const okey = keyFor(other);
    if (!okey) continue;
    // Region + issueType must match. Crop is soft — same-region
    // outbreaks across crops still indicate a local weather / pest
    // event, so we treat crop mismatches as near-misses. Explicit
    // crop match boosts the cluster signal via a tighter sub-key.
    if (okey.region    !== key.region)    continue;
    if (okey.issueType !== key.issueType) continue;
    siblings.push(other);
  }

  // The new issue counts too — the caller's "5+ similar issues"
  // threshold is the inclusive total, not the sibling count.
  const total = siblings.length + 1;
  if (total < minCount) return null;

  // Deterministic id — same region+type+crop always produces the
  // same cluster id so admin views can correlate across refreshes
  // without a separate cluster table.
  const id = clusterIdFor(key);
  const since = siblings.reduce(
    (oldest, i) => Math.min(oldest, i.createdAt || oldest),
    newIssue.createdAt || now,
  );
  const allIds = [...siblings.map((i) => i.id), newIssue.id].filter(Boolean);

  return Object.freeze({
    clusterId: id,
    region:    key.region,
    issueType: key.issueType,
    crop:      key.crop || null,
    count:     total,
    since,
    ids:       Object.freeze(allIds),
    reason:    `${total} similar ${key.issueType} reports in ${key.region} in the last ${windowDays} days`,
  });
}

export const _internal = Object.freeze({
  DEFAULT_WINDOW_DAYS, DEFAULT_MIN_COUNT, DAY_MS, keyFor, clusterIdFor,
});
