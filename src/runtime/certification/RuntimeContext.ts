/**
 * RuntimeContext.ts — CERTIFICATION RUNTIME TRUTH (spec-named entry).
 *
 * Browser-safe mirror of the certification runtime detector. The REAL provider
 * certification runs server-side / via the CLI (Node, where process.env + the
 * Railway secrets live) — this exists so the spec-named path is present and so a
 * non-Node context can read a truthful, honest context without crashing.
 *
 * Rule: live provider certification with real API calls is valid only when
 * canAccessProviderSecrets === true (Railway runtime, or secrets injected via
 * `railway run`).
 */
export interface RuntimeContext {
  runtime: 'railway' | 'ci' | 'sandbox' | 'local' | 'browser';
  isRailway: boolean;
  isLocal: boolean;
  isCI: boolean;
  canAccessProviderSecrets: boolean;
  buildSha: string;
  environmentName: string;
}

function _env(k: string): string | null {
  try { return (typeof process !== 'undefined' && (process as any).env && (process as any).env[k]) || null; }
  catch { return null; }
}

export function detectRuntimeContext(): RuntimeContext {
  // Browser: no process.env, no secrets — honest 'browser' context.
  if (typeof process === 'undefined' || !(process as any).env) {
    return Object.freeze({
      runtime: 'browser', isRailway: false, isLocal: false, isCI: false,
      canAccessProviderSecrets: false, buildSha: 'unknown', environmentName: 'browser',
    });
  }
  const railwayEnv = _env('RAILWAY_ENVIRONMENT') || _env('RAILWAY_PROJECT_ID') || _env('RAILWAY_SERVICE_ID');
  const isRailway = !!railwayEnv;
  const isCI = !!(_env('CI') || _env('GITHUB_ACTIONS'));
  const hasInjectedSecret = !!(
    _env('PLANT_ID_API_KEY') || _env('PLANT_API_KEY') || _env('CROP_HEALTH_API_KEY') ||
    _env('INSECT_ID_API_KEY') || _env('MUSHROOM_ID_API_KEY') || _env('AMBEE_API_KEY'));
  const isLocal = !isRailway && !isCI;
  const isSandbox = isLocal && !hasInjectedSecret;
  const canAccessProviderSecrets = isRailway || hasInjectedSecret;
  return Object.freeze({
    runtime: isRailway ? 'railway' : isCI ? 'ci' : isSandbox ? 'sandbox' : 'local',
    isRailway, isLocal, isCI, canAccessProviderSecrets,
    buildSha: _env('BUILD_SHA') || _env('RAILWAY_GIT_COMMIT_SHA') || 'unknown',
    environmentName: railwayEnv || _env('NODE_ENV') || 'development',
  });
}
