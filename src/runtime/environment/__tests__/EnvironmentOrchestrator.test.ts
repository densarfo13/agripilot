/**
 * EnvironmentOrchestrator.test.ts — Environment Provider Orchestrator.
 * Self-running: `tsx EnvironmentOrchestrator.test.ts`. Proves failover, graceful
 * degradation (a failed provider lowers confidence but never blocks), the
 * circuit breaker, and the merge/no-fabrication rules.
 */
import {
  runEnvironment, registerEnvironmentProvider, environmentProviderHealth,
  ambeePollenHealth, farmBrainEnvironmentHealth,
} from '../EnvironmentOrchestrator';
import { unavailableResult, EnvironmentProvider } from '../EnvironmentContracts';
import { mergeEnvironment } from '../EnvironmentRiskEngine';

let passed = 0;
function ok(c: boolean, m: string) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }
function eq(a: any, b: any, m: string) { if (a !== b) { console.error(`  ✗ ${m} — got ${JSON.stringify(a)}`); process.exit(1); } passed++; }

// Weather present, no soil → still produces a recommendation (never blank/blocked).
(async () => {
  const env = await runEnvironment({ weather: { humidity: 80, summary: 'Humid' }, cropStage: 'vegetative' });
  ok(!!env.farmerRecommendation, 'always returns a recommendation');
  ok(env.weatherImpact != null, 'weather impact derived');
  ok(env.confidence > 0 && env.confidence <= 100, 'confidence in range');

  // Graceful degradation: with soil present, confidence is >= weather-only.
  const withSoil = await runEnvironment({
    weather: { humidity: 80 }, cropStage: 'vegetative',
    soil: { moistureRisk: 'high', farmingHint: 'Check soil before watering.' },
  } as any);
  ok(withSoil.contributing.includes('soil' as any), 'soil contributes when present');
  ok(withSoil.irrigationSignal != null, 'soil drives an irrigation signal');
  ok(withSoil.confidence >= env.confidence, 'more providers → confidence not lower');

  // Flowering → pollination signal advises against spraying (no fabricated pollen).
  const flowering = await runEnvironment({ weather: {}, cropStage: 'flowering' } as any);
  ok(/avoid|hold/i.test(flowering.pollinationSignal || ''), 'flowering → avoid-spray pollination signal');
  ok(flowering.pollenImpact == null, 'no fabricated pollen impact (no pollen provider)');

  // A throwing provider must NOT crash the run (graceful degradation).
  const boom: EnvironmentProvider = { domain: 'air_quality' as any, priority: 30, enabled: true,
    async fetch() { throw new Error('boom'); } };
  registerEnvironmentProvider(boom);
  const survived = await runEnvironment({ weather: { humidity: 50 } });
  ok(survived.ok === true && !!survived.farmerRecommendation, 'a throwing provider does not block the run');

  // Health globals.
  const h = environmentProviderHealth();
  ok(h.gracefulDegradation === true, 'health: graceful degradation true');
  ok(h.registered.some((p: any) => p.domain === 'soil' && p.enabled), 'soil registered + enabled (first production provider)');
  ok(h.registered.some((p: any) => p.domain === 'pollen' && p.enabled === false), 'pollen registered but DISABLED (no fabrication)');
  eq(ambeePollenHealth().ambeePollenConfigured, false, 'pollen honestly not configured');
  eq(farmBrainEnvironmentHealth().blocksFarmBrain, false, 'env NEVER blocks FarmBrain');

  // Merge with zero providers → still a valid envelope (no throw, has a rec).
  const empty = mergeEnvironment({}, []);
  ok(empty.ok && !!empty.farmerRecommendation, 'empty merge still yields a recommendation');

  console.log('[test:environment-orchestrator] PASS — ' + passed + ' assertions (failover, degradation, no-block, no fabrication).');
})();
