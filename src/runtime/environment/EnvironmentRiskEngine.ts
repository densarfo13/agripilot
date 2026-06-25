/**
 * EnvironmentRiskEngine.ts — Environment Provider Orchestrator.
 *
 * Merges whatever provider signals are available into farmer-facing impacts +
 * a single recommendation. Pure + total + never throws. Farmer wording only
 * ("Recommended / Likely / Estimated / Watch") — never a provider/API name.
 * When a signal is missing, the corresponding impact is null and overall
 * confidence is reduced (functionality never blocks).
 */
import {
  EnvironmentEnvelope, EnvironmentProviderResult, EnvironmentContext,
  EnvironmentDomain, ENVIRONMENT_ORCHESTRATOR_VERSION,
} from './EnvironmentContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _num = (v: any): number | null => {
  const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null;
};

function _by(results: ReadonlyArray<EnvironmentProviderResult>, d: EnvironmentDomain) {
  return results.find((r) => r.provider === d && r.providerStatus === 'ready' && r.signal) || null;
}

/** Merge available signals into the single environment envelope. */
export function mergeEnvironment(
  ctx: EnvironmentContext, results: ReadonlyArray<EnvironmentProviderResult>,
): EnvironmentEnvelope {
  return _safe(() => {
    const soil = _by(results, 'soil');
    const weather = _by(results, 'weather');
    const pollen = _by(results, 'pollen');
    const air = _by(results, 'air_quality');
    const evidence: string[] = [];

    // ── Weather impact (only when present; always explains impact). ──
    let weatherImpact: string | null = null;
    const humidity = _num(ctx.weather && (ctx.weather.humidity));
    const rain = String((ctx.weather && (ctx.weather.summary || ctx.weather.condition)) || '').toLowerCase();
    if (weather || ctx.weather) {
      if (/rain|shower|storm/.test(rain)) {
        weatherImpact = 'Likely rain soon — hold off on spraying.';
        evidence.push('✓ Rain expected');
      } else if (humidity != null && humidity >= 70) {
        weatherImpact = 'Humidity is rising — watch for leaf disease.';
        evidence.push('✓ Humidity is high');
      } else {
        weatherImpact = 'Weather looks steady today.';
      }
    }

    // ── Soil → irrigation + disease pressure. ──
    let irrigationSignal: string | null = null;
    let diseaseRiskImpact: string | null = null;
    if (soil && soil.signal) {
      const risk = String(soil.signal.moistureRisk || '');
      const hint = String(soil.signal.farmingHint || '');
      if (risk === 'high') { irrigationSignal = hint || 'Check soil moisture today.'; evidence.push('✓ Soil moisture needs attention'); }
      else if (risk === 'medium') { irrigationSignal = 'Estimated: check soil before watering.'; }
      else { irrigationSignal = 'Soil moisture looks stable.'; }
    }
    if ((humidity != null && humidity >= 70) && soil && String(soil.signal?.moistureRisk) === 'high') {
      diseaseRiskImpact = 'Watch: humid + wet soil raises disease pressure.';
    }

    // ── Spray timing — combine weather + (flowering) crop stage. ──
    let sprayTimingSignal: string | null = null;
    let pollinationSignal: string | null = null;
    const stage = String(ctx.cropStage || '').toLowerCase();
    if (/flower|bloom/.test(stage)) {
      pollinationSignal = 'Recommended: avoid unnecessary spraying while flowering.';
      sprayTimingSignal = 'Hold spraying during flowering to protect pollinators.';
      evidence.push('✓ Crop is flowering');
    } else if (/rain|shower|storm/.test(rain)) {
      sprayTimingSignal = 'Likely rain — spray after it passes so it is not washed off.';
    }

    // ── Pollen / air quality — only when a provider actually returned them. ──
    const pollenImpact = pollen && pollen.signal
      ? String(pollen.signal.summary || 'Estimated pollen activity noted.') : null;
    const airQualityImpact = air && air.signal
      ? String(air.signal.summary || 'Estimated air quality noted.') : null;

    // ── Overall confidence — reduced for every missing contributor. ──
    const contributing = results.filter((r) => r.providerStatus === 'ready' && r.signal).map((r) => r.provider);
    const considered = results.length || 1;
    const base = contributing.length ? Math.round(contributing.reduce((a, _r, _i) => a, 0)) : 0;
    const ready = results.filter((r) => r.providerStatus === 'ready');
    const avgConf = ready.length ? Math.round(ready.reduce((a, r) => a + r.confidence, 0) / ready.length) : 0;
    // Penalize missing coverage: confidence scales with how many providers contributed.
    const coverage = contributing.length / considered;
    const confidence = Math.max(0, Math.min(100, Math.round((avgConf || (ctx.weather ? 55 : 0)) * (0.5 + 0.5 * coverage))));

    // ── The single recommendation — ALWAYS a next step. ──
    const rec = irrigationSignal || sprayTimingSignal || weatherImpact
      || (ctx.weather ? 'Walk your field and check your crop today.' : 'Add your location for local guidance.');

    return Object.freeze({
      version: ENVIRONMENT_ORCHESTRATOR_VERSION, ok: true as const,
      updatedAt: _num(ctx.nowMs),
      contributing: Object.freeze(contributing),
      providers: Object.freeze(results.map((r) => ({ provider: r.provider, status: r.providerStatus, confidence: r.confidence }))),
      weatherImpact, pollenImpact, airQualityImpact, diseaseRiskImpact,
      pollinationSignal, irrigationSignal, sprayTimingSignal,
      farmerRecommendation: rec, confidence,
      evidence: Object.freeze(evidence.slice(0, 6)),
    });
  }, Object.freeze({
    version: ENVIRONMENT_ORCHESTRATOR_VERSION, ok: true as const, updatedAt: null,
    contributing: Object.freeze([]), providers: Object.freeze([]),
    weatherImpact: null, pollenImpact: null, airQualityImpact: null, diseaseRiskImpact: null,
    pollinationSignal: null, irrigationSignal: null, sprayTimingSignal: null,
    farmerRecommendation: 'Walk your field and check your crop today.', confidence: 0,
    evidence: Object.freeze([]),
  }));
}
