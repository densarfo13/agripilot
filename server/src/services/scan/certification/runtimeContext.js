/**
 * runtimeContext.js — CERTIFICATION RUNTIME TRUTH.
 *
 * Where is this certification actually running? Provider secrets only exist in
 * the Railway runtime (or when injected via `railway run`). This detector lets
 * the certifier tell the HONEST difference between "the keys are missing" and
 * "I can't see the keys from here" — so we never claim Railway keys are missing
 * from a local/sandbox check.
 */
function _env(k) { try { return (typeof process !== 'undefined' && process.env && process.env[k]) || null; } catch { return null; } }

export function detectRuntimeContext() {
  const railwayEnv = _env('RAILWAY_ENVIRONMENT') || _env('RAILWAY_PROJECT_ID') || _env('RAILWAY_SERVICE_ID');
  const isRailway = !!railwayEnv;
  const isCI = !!(_env('CI') || _env('GITHUB_ACTIONS'));
  // "Has any provider secret in the process env?" — if `railway run` injected
  // them locally, secrets ARE accessible even outside the Railway runtime.
  const hasInjectedSecret = !!(
    _env('PLANT_ID_API_KEY') || _env('PLANT_API_KEY') || _env('CROP_HEALTH_API_KEY') ||
    _env('INSECT_ID_API_KEY') || _env('MUSHROOM_ID_API_KEY') || _env('AMBEE_API_KEY'));

  const isLocal = !isRailway && !isCI;
  const isSandbox = isLocal && !hasInjectedSecret;

  // Live provider certification is valid ONLY where secrets are reachable.
  const canAccessProviderSecrets = isRailway || hasInjectedSecret;

  const runtime = isRailway ? 'railway' : isCI ? 'ci' : isSandbox ? 'sandbox' : 'local';
  const environmentName = railwayEnv || _env('NODE_ENV') || 'development';
  const buildSha = _env('BUILD_SHA') || _env('RAILWAY_GIT_COMMIT_SHA') || 'unknown';

  return Object.freeze({
    runtime,
    isRailway,
    isLocal,
    isCI,
    isSandbox,
    canAccessProviderSecrets,
    environmentName,
    buildSha,
  });
}

/** The honest next action for a given context. */
export function certificationNextAction(ctx, overall) {
  if (!ctx || !ctx.canAccessProviderSecrets) {
    return 'No local provider secrets available. Run live certification inside the Railway runtime: '
      + '`railway run npm run scan:certify` (from the linked project).';
  }
  // Secrets ARE reachable (on Railway / injected). If not yet certified, the
  // remaining step is PROOF: a provider is READY only from a real live call.
  // DEGRADED means "keyed + configured, awaiting a proven call" — exercise the
  // providers with one real scan, then re-certify.
  if (overall && overall !== 'PRODUCTION_CERTIFIED') {
    return 'Keys are configured ✓. Providers stay DEGRADED until a REAL scan proves them — '
      + 'run one scan in the app (plant photo), or `SCAN_API_BASE=<your-app-url> npm run scan:acceptance`, '
      + 'then re-run certify. Live calls accumulate and lift DEGRADED → READY.';
  }
  return null;
}
