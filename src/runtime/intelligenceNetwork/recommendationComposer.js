/**
 * recommendationComposer.js — Phase 12 collective recommendation
 * composer.
 *
 *   import { composeNetworkRecommendations }
 *     from 'src/runtime/intelligenceNetwork/recommendationComposer.js';
 *
 * What this is
 * ────────────
 *   Pure function that composes recommendations from:
 *
 *     1. local hotspots (trend detector output)
 *     2. peer-benchmark gaps (peer benchmark output)
 *     3. caller-supplied regional benchmarks (null in Phase 12
 *        until backend aggregator ships)
 *
 *   Returns up to 5 frozen action envelopes ordered by impact.
 *   Each carries a `source` ('local' | 'peer' | 'regional') so the
 *   UI can be transparent about where the suggestion comes from.
 *
 *   When the regional/peer data is null, the composer falls back
 *   to local-only suggestions rather than silently failing.
 */

const RUNTIME_VERSION = 'recommendation-composer-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr   = (v) => (Array.isArray(v) ? v : []);

const _action = (source, kind, headlineKey, headlineDefault,
                 bodyKey, bodyDefault, impact) =>
  Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    source, kind, impact,
    headlineKey, headlineDefault,
    bodyKey, bodyDefault,
  });

/**
 * @param {{
 *   trends?: ReturnType<typeof detectTrends>,
 *   benchmarks?: Array<ReturnType<typeof computePeerBenchmark>>,
 *   regionalSignals?: Array,   // null until backend ships
 * }} input
 */
export function composeNetworkRecommendations(input) {
  const i = _isObj(input) ? input : {};
  const actions = [];

  // ─── Local hotspots ──────────────────────────────────────
  const hotspots = _arr(i.trends && i.trends.hotspots);
  for (const h of hotspots) {
    if (!_isObj(h) || !h.headlineDefault) continue;
    actions.push(_action(
      'local', h.kind,
      h.headlineKey, h.headlineDefault,
      h.bodyKey, h.bodyDefault,
      0.7,
    ));
  }

  // ─── Peer benchmark gaps ─────────────────────────────────
  for (const b of _arr(i.benchmarks)) {
    if (!_isObj(b) || !b.ok) continue;
    if (b.tier === 'below_average') {
      const metric = b.metric || 'metric';
      actions.push(_action(
        'peer', 'lift_' + metric,
        'network.rec.peer_below.headline',
        'Farmers like you scored higher on ' + metric + '.',
        'network.rec.peer_below.body',
        'Review recent activity and complete pending tasks to catch up.',
        0.6,
      ));
    }
  }

  // ─── Regional signals (caller-supplied; null in Phase 12) ─
  const regional = _arr(i.regionalSignals);
  for (const r of regional) {
    if (!_isObj(r) || !r.headlineDefault) continue;
    actions.push(_action(
      'regional', _str(r.kind || 'regional_signal'),
      r.headlineKey || 'network.rec.regional.headline',
      r.headlineDefault,
      r.bodyKey || 'network.rec.regional.body',
      r.bodyDefault || '',
      0.8,
    ));
  }

  actions.sort((a, b) => b.impact - a.impact);
  return Object.freeze(actions.slice(0, 5));
}

const _str = (v) => (typeof v === 'string' ? v : '');

export const _internal = Object.freeze({ _action });
