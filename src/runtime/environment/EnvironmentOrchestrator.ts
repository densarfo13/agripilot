/**
 * EnvironmentOrchestrator.ts — Environment Provider Orchestrator.
 *
 * The single seam between environmental data providers and FarmBrain. Providers
 * register by priority; the orchestrator runs them with per-provider RETRY (on
 * transient errors only) + a CIRCUIT BREAKER (skip a flapping provider for a
 * cool-off window) + GRACEFUL DEGRADATION (a failed provider yields an honest
 * 'unavailable' result and lowers confidence — it never blocks). FarmBrain reads
 * the merged EnvironmentEnvelope and nothing else, so new providers (Pollen,
 * Air Quality, Satellite, scan providers) plug in WITHOUT touching FarmBrain.
 *
 * Soil is the first production provider. Pollen is a disabled stub (the repo has
 * no live pollen dependency — we do not fabricate one). Pure, best-effort, never
 * throws. Pins __environmentProviderHealth / __ambeePollenHealth /
 * __farmBrainEnvironmentHealth.
 */
import {
  EnvironmentProvider, EnvironmentContext, EnvironmentProviderResult,
  EnvironmentEnvelope, EnvironmentDomain, unavailableResult, PROVIDER_PRIORITY,
  ENVIRONMENT_ORCHESTRATOR_VERSION,
} from './EnvironmentContracts';
import { mergeEnvironment } from './EnvironmentRiskEngine';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _now = (): number => _safe(() => Date.now(), 0);

// ── Circuit breaker state (per provider domain). ──
const CB_THRESHOLD = 3;            // consecutive failures before opening
const CB_COOLOFF_MS = 60_000;      // stay open for 60s
const _circuit: Record<string, { fails: number; openUntil: number }> = {};
const TRANSIENT = new Set(['timeout', 'rate_limited_429', 'provider_error', 'circuit_open']);

function _cb(domain: string) { return (_circuit[domain] = _circuit[domain] || { fails: 0, openUntil: 0 }); }

/** Run one provider with retry + circuit breaker. Never throws. */
async function _callWithResilience(p: EnvironmentProvider, ctx: EnvironmentContext): Promise<EnvironmentProviderResult> {
  const cb = _cb(p.domain);
  if (cb.openUntil > _now()) return unavailableResult(p.domain, 'circuit_open', 'circuit_open');

  const attempt = async (): Promise<EnvironmentProviderResult> => {
    // Catch BOTH sync throws and rejected promises (async fetch).
    try { return await p.fetch(ctx); }
    catch { return unavailableResult(p.domain, 'provider_error', 'threw'); }
  };

  let res = await attempt();
  // One retry, transient only.
  if (res.providerStatus !== 'ready' && TRANSIENT.has(res.providerStatus)) {
    res = await attempt();
  }

  if (res.providerStatus === 'ready') { cb.fails = 0; cb.openUntil = 0; }
  else if (TRANSIENT.has(res.providerStatus)) {
    cb.fails += 1;
    if (cb.fails >= CB_THRESHOLD) { cb.openUntil = _now() + CB_COOLOFF_MS; cb.fails = 0; }
  }
  return res;
}

// ── Provider registry ──
const _providers: EnvironmentProvider[] = [];
export function registerEnvironmentProvider(p: EnvironmentProvider): void {
  if (p && p.domain && typeof p.fetch === 'function' && !_providers.some((x) => x.domain === p.domain)) {
    _providers.push(p);
  }
}
function _ordered(): EnvironmentProvider[] {
  const rank = (d: EnvironmentDomain) => { const i = PROVIDER_PRIORITY.indexOf(d); return i < 0 ? 99 : i; };
  return [..._providers].sort((a, b) => (a.priority - b.priority) || (rank(a.domain) - rank(b.domain)));
}

/** Run all enabled providers and merge into the single environment envelope. */
export async function runEnvironment(ctx: EnvironmentContext = {}): Promise<EnvironmentEnvelope> {
  try {
    const c = { ...ctx, nowMs: ctx.nowMs ?? _now() };
    const enabled = _ordered().filter((p) => p.enabled);
    // _callWithResilience never rejects, but guard each anyway.
    const results = await Promise.all(enabled.map((p) =>
      _callWithResilience(p, c).catch(() => unavailableResult(p.domain, 'provider_error', 'threw'))));
    return mergeEnvironment(c, results);
  } catch {
    return mergeEnvironment(ctx, []);
  }
}

// ─────────────────────── Built-in providers ───────────────────────

/** Weather — derives from the weather already in context (no extra call). */
const weatherProvider: EnvironmentProvider = {
  domain: 'weather', priority: 20, enabled: true,
  async fetch(ctx) {
    if (!ctx || !ctx.weather) return unavailableResult('weather', 'unavailable', 'no_weather');
    return Object.freeze({
      provider: 'weather' as const, providerStatus: 'ready' as const, httpStatus: 200,
      confidence: 60, signal: { ...ctx.weather }, evidence: Object.freeze([]),
      failureReason: null, latencyMs: null,
    });
  },
};

/**
 * Soil — the first PRODUCTION provider. The real (keyed) Ambee Soil call lives
 * server-side (ambeeSoilService.js); the client consumes the soil signal passed
 * in context (from the server). No browser-side secret/API call. Honest
 * 'unavailable' when no soil signal is present.
 */
const soilProvider: EnvironmentProvider = {
  domain: 'soil', priority: 10, enabled: true,
  async fetch(ctx) {
    const s = ctx && (ctx as any).soil;
    if (!s || typeof s !== 'object') return unavailableResult('soil', 'unavailable', 'no_soil_signal');
    return Object.freeze({
      provider: 'soil' as const, providerStatus: 'ready' as const, httpStatus: 200,
      confidence: 65,
      signal: { moistureRisk: s.moistureRisk ?? null, farmingHint: s.farmingHint ?? null,
        soilMoisture: s.soilMoisture ?? null, soilTemperature: s.soilTemperature ?? null },
      evidence: Object.freeze([]), failureReason: null, latencyMs: null,
    });
  },
};

/**
 * Pollen — DISABLED stub. The repo has no live pollen dependency, and we do not
 * fabricate pollen/allergy data. It is registered (so the pattern is provable +
 * future-pluggable) but enabled:false, so it never contributes a fake signal.
 */
const pollenStubProvider: EnvironmentProvider = {
  domain: 'pollen', priority: 40, enabled: false,
  async fetch() { return unavailableResult('pollen', 'not_configured', 'no_pollen_provider'); },
};

registerEnvironmentProvider(weatherProvider);
registerEnvironmentProvider(soilProvider);
registerEnvironmentProvider(pollenStubProvider);

// ─────────────────────── Health globals ───────────────────────

export function environmentProviderHealth() {
  return Object.freeze({
    ok: true, version: ENVIRONMENT_ORCHESTRATOR_VERSION,
    registered: Object.freeze(_ordered().map((p) => ({ domain: p.domain, priority: p.priority, enabled: p.enabled }))),
    soilFirstProductionProvider: _ordered().filter((p) => p.enabled)[0]?.domain === 'soil'
      || _ordered().filter((p) => p.enabled).some((p) => p.domain === 'soil'),
    circuitBreakers: Object.freeze(Object.entries(_circuit).map(([d, c]) => ({ domain: d, open: c.openUntil > _now() }))),
    failoverOrder: PROVIDER_PRIORITY,
    gracefulDegradation: true,         // FarmBrain never blocked by a provider
  });
}

/** Honest pollen envelope — the repo has no live pollen provider. */
export function ambeePollenHealth() {
  return Object.freeze({
    ok: true, ambeePollenConfigured: false, ambeePollenReady: false,
    httpStatus: null, failureReason: 'no_pollen_provider', lastCheckedAt: null, latencyMs: null,
    note: 'No live pollen dependency in this app; provider is a disabled stub (no fabricated data).',
  });
}

/** What FarmBrain relies on from the environment layer. */
export function farmBrainEnvironmentHealth() {
  const enabled = _ordered().filter((p) => p.enabled).map((p) => p.domain);
  return Object.freeze({
    ok: true,
    environmentReady: enabled.length > 0,
    contributors: Object.freeze(enabled),
    blocksFarmBrain: false,            // hard invariant: env never blocks FarmBrain
    confidenceReducedWhenMissing: true,
  });
}

function _install(name: string, fn: () => any): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any)[name]) return;
    Object.defineProperty(window, name, { configurable: true, enumerable: false, writable: false, value: fn });
  }, undefined);
}
export function installEnvironmentHealth(): void {
  _install('__environmentProviderHealth', () => environmentProviderHealth());
  _install('__ambeePollenHealth', () => ambeePollenHealth());
  _install('__farmBrainEnvironmentHealth', () => farmBrainEnvironmentHealth());
}
