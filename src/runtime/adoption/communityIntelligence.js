/**
 * runtime/adoption/communityIntelligence.js — Phase 13 regional view.
 *
 *   import {
 *     computeCommunityIntelligence,
 *     COMMUNITY_CHALLENGE_KIND,
 *   } from 'src/runtime/adoption/communityIntelligence.js';
 *
 * What this is
 * ────────────
 *   Surfaces "what nearby farmers are growing" + "top regional
 *   challenges" — IF a community signals envelope was injected.
 *   The actual aggregation requires a backend (deferred).
 *
 *   Honest null envelope when:
 *     • no signals were supplied   → reason: 'no_signals'
 *     • signals exist but sample   → reason: 'insufficient_samples'
 *       count below MIN_SAMPLES
 *
 *   Returns a frozen envelope:
 *     {
 *       ok,
 *       topCrops:        [{crop, count, share}],
 *       topChallenges:   [{kind, count, share}],
 *       sampleSize,      regionLabel,
 *       reason,          // when ok: false
 *       runtimeVersion,
 *     }
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Caller-injected data only.
 *   • Region labels are caller-supplied — NEVER derived from lat/lng.
 *   • Returns null envelope rather than fake cohorts.
 */

export const COMMUNITY_INTELLIGENCE_VERSION = 'community-intelligence-v1';
export const MIN_COMMUNITY_SAMPLES = 10;

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _num   = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

export const COMMUNITY_CHALLENGE_KIND = Object.freeze({
  DISEASE:  'DISEASE',
  HEAT:     'HEAT',
  DROUGHT:  'DROUGHT',
  RAINFALL: 'RAINFALL',
  PEST:     'PEST',
});

function _nullEnvelope(reason, regionLabel) {
  return Object.freeze({
    runtimeVersion: COMMUNITY_INTELLIGENCE_VERSION,
    ok:             false,
    reason,
    topCrops:       Object.freeze([]),
    topChallenges:  Object.freeze([]),
    sampleSize:     0,
    regionLabel:    _str(regionLabel),
  });
}

function _topN(map, total, n) {
  const entries = [];
  for (const k of Object.keys(map)) {
    const v = _num(map[k]);
    if (v == null || v <= 0) continue;
    entries.push({ key: k, count: v });
  }
  entries.sort((a, b) => b.count - a.count);
  return entries.slice(0, n).map((e) => Object.freeze({
    key:   e.key,
    count: e.count,
    share: total > 0 ? Math.round((e.count / total) * 100) / 100 : 0,
  }));
}

export function computeCommunityIntelligence(ctx) {
  return _safe(() => {
    const c       = _isObj(ctx) ? ctx : {};
    const signals = _isObj(c.communitySignals) ? c.communitySignals : null;
    const regionLabel = _str((signals && signals.regionLabel) || c.regionLabel);

    if (!signals) return _nullEnvelope('no_signals', regionLabel);

    const sampleSize = _num(signals.sampleSize) || 0;
    if (sampleSize < MIN_COMMUNITY_SAMPLES) {
      return _nullEnvelope('insufficient_samples', regionLabel);
    }

    // Crops — accept either a {cropName: count} map or an array of
    // {crop, count}. Both forms come from a future backend; we
    // normalize here so UI doesn't have to.
    const cropMap = {};
    if (_isObj(signals.cropCounts)) {
      for (const k of Object.keys(signals.cropCounts)) {
        cropMap[k] = _num(signals.cropCounts[k]) || 0;
      }
    } else if (Array.isArray(signals.cropCounts)) {
      for (const e of signals.cropCounts) {
        if (!_isObj(e)) continue;
        const k = _str(e.crop);
        if (!k) continue;
        cropMap[k] = (cropMap[k] || 0) + (_num(e.count) || 0);
      }
    }
    const topCrops = _topN(cropMap, sampleSize, 3).map((e) => Object.freeze({
      crop: e.key, count: e.count, share: e.share,
    }));

    // Challenges — same normalization
    const chalMap = {};
    const validKinds = Object.values(COMMUNITY_CHALLENGE_KIND);
    if (_isObj(signals.challengeCounts)) {
      for (const k of Object.keys(signals.challengeCounts)) {
        if (validKinds.indexOf(k) === -1) continue;
        chalMap[k] = _num(signals.challengeCounts[k]) || 0;
      }
    } else if (Array.isArray(signals.challengeCounts)) {
      for (const e of signals.challengeCounts) {
        if (!_isObj(e)) continue;
        const k = _str(e.kind);
        if (validKinds.indexOf(k) === -1) continue;
        chalMap[k] = (chalMap[k] || 0) + (_num(e.count) || 0);
      }
    }
    const topChallenges = _topN(chalMap, sampleSize, 3).map((e) => Object.freeze({
      kind: e.key, count: e.count, share: e.share,
    }));

    return Object.freeze({
      runtimeVersion: COMMUNITY_INTELLIGENCE_VERSION,
      ok:             true,
      reason:         '',
      topCrops:       Object.freeze(topCrops),
      topChallenges:  Object.freeze(topChallenges),
      sampleSize,
      regionLabel,
    });
  }, _nullEnvelope('error', ''));
}
