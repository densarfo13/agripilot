/**
 * productionCertification.js — PRODUCTION CERTIFICATION composite.
 *
 * Runs (or composes) LIVE evidence for every provider and produces the
 * ProviderCertification[] + the scorecard + the overall verdict. It never infers
 * READY from an env var: configuration comes from the runtime provider status,
 * but READY additionally requires a proven live call (auth + schema + parse +
 * SLA + FarmBrain-accepted). Sentinel Hub is OPTIONAL and never blocks.
 */
import { certifyProvider, PROVIDER_SLA, CERT_STATUS } from './providerCertification.js';
import { validateProviderResponse } from './providerValidator.js';
import { providerHealthStats } from './providerHealthMonitor.js';
import { buildScorecard } from './providerScorecard.js';

/** Pull config + last-call truth for a provider from the runtime status. */
async function _runtimeEvidence(provider) {
  try {
    const { getProviderRuntimeStatus } = await import('../../../ml/providerRuntimeStatus.js');
    const list = getProviderRuntimeStatus();
    const map = { 'plant.id': 'plant.id', 'crop.health': 'crop.health', 'insect.id': 'insect.id', 'mushroom.id': 'mushroom.id' };
    const r = list.find((p) => p.providerName === (map[provider] || provider));
    if (r) return { configured: !!r.envPresent, httpStatus: r.lastHttpStatus ?? null, wired: r.providerWired };
  } catch { /* fall through */ }
  return null;
}

/** Soil config from its own diagnostics. */
async function _soilEvidence() {
  try {
    const { getSoilProviderDiagnostics } = await import('../../soil/ambeeSoilService.js');
    const d = getSoilProviderDiagnostics();
    return { configured: !!d.envPresent, httpStatus: d.httpStatus ?? null, latencyMs: d.latencyMs ?? null };
  } catch { return null; }
}

/**
 * Certify all providers. `opts.liveCall` may inject a real call result per
 * provider (from POST /api/admin/scan/certify); otherwise we compose the most
 * recent runtime evidence. No live proof → never READY.
 */
export async function runProductionCertification(opts = {}) {
  const live = (opts && opts.liveCall) || {};
  const certifications = [];

  for (const provider of Object.keys(PROVIDER_SLA)) {
    let ev;
    if (live[provider]) {
      // Real call captured by the certify endpoint.
      ev = validateProviderResponse(provider, live[provider]);
    } else if (provider === 'sentinel_hub') {
      ev = { configured: false, disabled: true, failureReason: 'optional_not_integrated' };
    } else if (provider === 'soil') {
      const s = await _soilEvidence();
      ev = validateProviderResponse('soil', s || { configured: false });
    } else if (provider === 'weather') {
      // Weather has no secret; configured, but READY still needs a live call.
      ev = validateProviderResponse('weather', { configured: true, httpStatus: live.weather ? 200 : null });
    } else {
      const rt = await _runtimeEvidence(provider);
      ev = validateProviderResponse(provider, rt || { configured: false });
    }
    // Fold in rolling health stats.
    const stats = providerHealthStats(provider);
    if (stats.calls > 0) {
      ev.successRate = stats.successRate;
      if (typeof stats.avgLatencyMs === 'number') ev.latencyMs = stats.avgLatencyMs;
      ev.avgConfidence = stats.avgConfidence;
      ev.lastSuccessfulCall = stats.lastSuccessfulCall || ev.lastSuccessfulCall;
    }
    certifications.push(certifyProvider(provider, ev));
  }

  const scorecard = buildScorecard(certifications);
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    certifications: Object.freeze(certifications),
    scorecard,
    overall: scorecard.overall,
  });
}

export { CERT_STATUS };
