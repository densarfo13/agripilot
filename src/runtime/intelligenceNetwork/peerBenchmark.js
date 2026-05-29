/**
 * peerBenchmark.js — Phase 12 honest peer benchmark.
 *
 *   import { computePeerBenchmark }
 *     from 'src/runtime/intelligenceNetwork/peerBenchmark.js';
 *
 * What this is
 * ────────────
 *   Pure function that compares a farm's metric to a benchmark
 *   distribution. Returns the farm's percentile + a 3-band tier
 *   (above_average / average / below_average) when the benchmark
 *   has enough samples; null otherwise.
 *
 *   Until a backend aggregator ships, callers pass `benchmark = null`
 *   and this function returns a null envelope. The composite layer
 *   then surfaces "Benchmark data not available yet" rather than
 *   fabricating a percentile.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. SSR-safe.
 *   • Frozen envelope.
 *   • Returns NULL rather than guessing when the benchmark is
 *     missing or has too few samples (< 10).
 */

const RUNTIME_VERSION = 'peer-benchmark-v1';

const MIN_BENCHMARK_SAMPLES = 10;

const _isObj = (v) => v != null && typeof v === 'object';
const _isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const _arr   = (v) => (Array.isArray(v) ? v : []);

/**
 * @param {{
 *   farmValue: number,
 *   benchmark?: {
 *     metric: 'yield' | 'health' | 'tasks' | 'profit',
 *     samples: Array<number>,        // anonymized peer distribution
 *     scope?: { crop, region, country },
 *   }
 * }} input
 */
export function computePeerBenchmark(input) {
  const i = _isObj(input) ? input : {};
  const farmValue = _isNum(i.farmValue) ? i.farmValue : null;
  const benchmark = _isObj(i.benchmark) ? i.benchmark : null;
  const samples = _arr(benchmark && benchmark.samples)
    .filter((v) => _isNum(v));
  if (farmValue == null || !benchmark || samples.length < MIN_BENCHMARK_SAMPLES) {
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      ok: false,
      reason: !benchmark ? 'no_benchmark_data'
            : samples.length < MIN_BENCHMARK_SAMPLES
              ? 'insufficient_samples' : 'no_farm_value',
      percentile: null,
      tier: null,
      sampleCount: samples.length,
      minSamples: MIN_BENCHMARK_SAMPLES,
    });
  }
  // Percentile = fraction of samples strictly less than farmValue.
  const sorted = samples.slice().sort((a, b) => a - b);
  let below = 0;
  for (const s of sorted) {
    if (s < farmValue) below += 1;
    else break;
  }
  const percentile = Math.round((below / sorted.length) * 100);
  const tier = percentile >= 67 ? 'above_average'
             : percentile >= 33 ? 'average'
             : 'below_average';
  return Object.freeze({
    runtimeVersion: RUNTIME_VERSION,
    ok: true,
    metric: benchmark.metric || null,
    farmValue,
    percentile,
    tier,
    sampleCount: sorted.length,
    scope: Object.freeze(benchmark.scope || {}),
  });
}

export const _internal = Object.freeze({ MIN_BENCHMARK_SAMPLES });
