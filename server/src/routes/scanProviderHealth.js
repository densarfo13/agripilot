/**
 * scanProviderHealth.js — RC1 server scan-provider health endpoint.
 *
 *   GET /api/health/scan-provider
 *
 * Returns:
 *   {
 *     configured: boolean,
 *     provider: "plantid" | "plantnet" | "generic" | "unknown",
 *     classifierAvailable: boolean
 *   }
 *
 * Rules
 * ─────
 *   • Reads server env (PLANT_ID_API_KEY, SCAN_PROVIDER_PROFILE).
 *   • Never exposes the key — only `configured: true/false`.
 *   • Never logs the key.
 *   • Public (no auth) — the frontend probes this from the
 *     classifier-availability runtime before login.
 *   • Never throws — falls back to a safe envelope.
 */

const _truthy = (v) => v != null && String(v).length > 0;

function _detectProvider() {
  const profile = (process.env.SCAN_PROVIDER_PROFILE || '').trim().toLowerCase();
  if (profile === 'plantid'
      || profile === 'plantnet'
      || profile === 'generic') return profile;
  // Implicit: if a Plant.id key exists but no profile, treat as plantid.
  if (_truthy((process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY))) return 'plantid';
  if (_truthy(process.env.PLANTNET_API_KEY)) return 'plantnet';
  if (_truthy(process.env.SCAN_API_KEY)) return 'generic';
  return 'unknown';
}

function _isConfigured(provider) {
  switch (provider) {
    case 'plantid':  return _truthy((process.env.PLANT_ID_API_KEY || process.env.PLANT_API_KEY));
    case 'plantnet': return _truthy(process.env.PLANTNET_API_KEY);
    case 'generic':  return _truthy(process.env.SCAN_API_KEY)
                          && _truthy(process.env.SCAN_PROVIDER_URL);
    default:         return false;
  }
}

export function scanProviderHealthHandler(req, res) {
  try {
    const provider = _detectProvider();
    const configured = _isConfigured(provider);
    const classifierAvailable = configured && provider !== 'unknown';
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      configured,
      provider,
      classifierAvailable,
      runtimeVersion: 'scan-provider-health-v1',
    });
  } catch (err) {
    // Never leak internals; always return a safe envelope.
    res.status(500).json({
      configured: false,
      provider: 'unknown',
      classifierAvailable: false,
      runtimeVersion: 'scan-provider-health-v1',
      error: 'internal_error',
    });
  }
}

export function registerScanProviderHealthRoute(app) {
  if (!app || typeof app.get !== 'function') return false;
  app.get('/api/health/scan-provider', scanProviderHealthHandler);
  return true;
}

export default { scanProviderHealthHandler, registerScanProviderHealthRoute };
