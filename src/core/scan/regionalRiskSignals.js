/**
 * regionalRiskSignals.js — privacy-safe regional outbreak detection.
 *
 *   import { aggregateRegionalScans, REGIONAL_PRESSURE }
 *     from 'src/core/scan/regionalRiskSignals.js';
 *
 *   const r = aggregateRegionalScans({
 *     scans: [
 *       { region: 'ashanti', crop: 'tomato', issueCategory: 'fungal_risk', atMs: ... },
 *       ...
 *     ],
 *     windowDays: 14,
 *     minSampleSize: 5,
 *     nowMs: Date.now(),
 *   });
 *   // r.byRegion[*] = { region, samples, topIssue, pressure, hedgedMessage }
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure aggregator that takes a list of scan rows (operator-
 *   sourced — never the live private DB read from the client) and
 *   returns regional pressure levels (calm / watch / elevated /
 *   hotspot) based on the % of recent scans for each (region, crop)
 *   pair that fell into a given issue category.
 *
 *   Privacy rules:
 *     • Inputs MUST be coarse — `region` is a string like "ashanti"
 *       or "lagos", never coordinates / parcel id / user id.
 *     • Outputs carry COUNTS only, never sample-level rows.
 *     • Minimum sample size (default 5) before any pressure level
 *       above CALM is reported — prevents one farm's scans from
 *       being identifiable.
 *     • No farm identifier appears in the output by construction.
 *
 *   Feature-flagged: the surface that consumes this checks
 *   FEATURE.NGO_ANALYTICS (or a dedicated outbreak flag) before
 *   calling. The engine itself ALWAYS runs — flag-gating is the
 *   surface's responsibility.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • PII never leaves the engine — IDs are dropped at input.
 */

const _DAY = 86400000;
const _str = (v) => String(v == null ? '' : v).toLowerCase();

export const REGIONAL_PRESSURE = Object.freeze({
  CALM:     'calm',
  WATCH:    'watch',
  ELEVATED: 'elevated',
  HOTSPOT:  'hotspot',
});

function _pressureFor(issuePct, samples, minSampleSize) {
  if (samples < minSampleSize) return REGIONAL_PRESSURE.CALM;
  if (issuePct >= 0.40) return REGIONAL_PRESSURE.HOTSPOT;
  if (issuePct >= 0.20) return REGIONAL_PRESSURE.ELEVATED;
  if (issuePct >= 0.08) return REGIONAL_PRESSURE.WATCH;
  return REGIONAL_PRESSURE.CALM;
}

function _msg(key, fallback, params) {
  return { key, fallback, params: (params && typeof params === 'object') ? { ...params } : {} };
}

/**
 * @param {object} ctx
 * @returns {object}
 */
export function aggregateRegionalScans(ctx) {
  try {
    const c = (ctx && typeof ctx === 'object') ? ctx : {};
    const scans = Array.isArray(c.scans) ? c.scans : [];
    const nowMs = Number.isFinite(c.nowMs) ? c.nowMs : Date.now();
    const windowDays = Number.isFinite(c.windowDays) && c.windowDays > 0 ? c.windowDays : 14;
    const minSampleSize = Number.isFinite(c.minSampleSize) && c.minSampleSize > 0
      ? c.minSampleSize : 5;
    const cutoff = nowMs - windowDays * _DAY;

    // (region, crop) → { samples, issueCounts: { issue: n } }
    const grouped = new Map();
    for (const s of scans) {
      if (!s || typeof s !== 'object') continue;
      const ts = Number(s.atMs) || Number(s.createdAt) || 0;
      if (ts < cutoff) continue;
      const region = _str(s.region);
      const crop = _str(s.crop);
      const issue = _str(s.issueCategory);
      if (!region || !crop || !issue) continue;
      // DROP any potentially-identifiable field — defensive.
      // (We never read s.userId, s.farmerId, s.farmId.)
      const key = region + '::' + crop;
      if (!grouped.has(key)) grouped.set(key, { region, crop, samples: 0, issueCounts: {} });
      const slot = grouped.get(key);
      slot.samples += 1;
      slot.issueCounts[issue] = (slot.issueCounts[issue] || 0) + 1;
    }

    const byRegion = [];
    for (const slot of grouped.values()) {
      // Find the top non-healthy issue.
      let topIssue = null;
      let topCount = 0;
      for (const [issue, n] of Object.entries(slot.issueCounts)) {
        if (issue === 'healthy') continue;
        if (n > topCount) { topCount = n; topIssue = issue; }
      }
      const issuePct = slot.samples > 0 ? topCount / slot.samples : 0;
      const pressure = _pressureFor(issuePct, slot.samples, minSampleSize);
      byRegion.push({
        region:   slot.region,
        crop:     slot.crop,
        samples:  slot.samples,
        topIssue,
        topIssueCount: topCount,
        issuePct: Math.round(issuePct * 100) / 100,
        pressure,
        hedgedMessage: _hedgedMessageFor(pressure, slot.region, slot.crop, topIssue),
      });
    }

    // Rank — hotspots first, then by sample size.
    const rank = (r) =>
        r.pressure === REGIONAL_PRESSURE.HOTSPOT  ? 0
      : r.pressure === REGIONAL_PRESSURE.ELEVATED ? 1
      : r.pressure === REGIONAL_PRESSURE.WATCH    ? 2 : 3;
    byRegion.sort((a, b) => rank(a) - rank(b) || b.samples - a.samples);

    return {
      ok:           true,
      windowDays,
      minSampleSize,
      byRegion,
      generatedAt:  nowMs,
      disclaimer:   _msg('scan.regional.disclaimer',
        'Regional pressure is an aggregate signal — no individual farm is identifiable.'),
    };
  } catch {
    return {
      ok: false, windowDays: 14, minSampleSize: 5,
      byRegion: [], generatedAt: Date.now(),
      disclaimer: _msg('scan.regional.disclaimer',
        'Regional pressure unavailable for this window.'),
    };
  }
}

function _hedgedMessageFor(pressure, region, crop, issue) {
  if (pressure === REGIONAL_PRESSURE.CALM) {
    return _msg('scan.regional.calm', 'No unusual pressure in your region recently.');
  }
  if (pressure === REGIONAL_PRESSURE.WATCH) {
    return _msg('scan.regional.watch',
      'Slight increase in {issue} reports near your area — worth a closer look.',
      { region, crop, issue });
  }
  if (pressure === REGIONAL_PRESSURE.ELEVATED) {
    return _msg('scan.regional.elevated',
      'Elevated {issue} reports for {crop} in your region — inspect today if possible.',
      { region, crop, issue });
  }
  return _msg('scan.regional.hotspot',
    'Hotspot — {issue} reports for {crop} are clustering in your region.',
    { region, crop, issue });
}

const _module = { REGIONAL_PRESSURE, aggregateRegionalScans };
export default _module;
