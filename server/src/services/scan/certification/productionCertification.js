/**
 * productionCertification.js — PRODUCTION CERTIFICATION composite.
 *
 * Runs (or composes) LIVE evidence for every provider and produces the
 * ProviderCertification[] + the scorecard + the overall verdict. It never infers
 * READY from an env var: configuration comes from the runtime provider status,
 * but READY additionally requires a proven live call (auth + schema + parse +
 * SLA + FarmBrain-accepted). Sentinel Hub is OPTIONAL and never blocks.
 */
import { certifyProvider, PROVIDER_SLA, CERT_STATUS, checkProviderKey } from './providerCertification.js';
import { validateProviderResponse } from './providerValidator.js';
import { providerHealthStats } from './providerHealthMonitor.js';
import { buildScorecard } from './providerScorecard.js';
import { detectRuntimeContext, certificationNextAction } from './runtimeContext.js';

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
  const ctx = detectRuntimeContext();
  const certifications = [];

  for (const provider of Object.keys(PROVIDER_SLA)) {
    let ev;
    if (live[provider]) {
      // Real call captured by the certify endpoint — authoritative evidence.
      ev = validateProviderResponse(provider, live[provider]);
    } else if (provider === 'sentinel_hub') {
      ev = { configured: false, disabled: true, failureReason: 'optional_not_integrated' };
    } else if (!ctx.canAccessProviderSecrets) {
      // CRITICAL: outside Railway with no injected secrets, we CANNOT see the
      // keys — that is LOCAL_SECRETS_UNAVAILABLE, NOT "keys missing".
      ev = { localSecretsUnavailable: true, configured: false,
        failureReason: 'local_secrets_unavailable' };
    } else if (provider === 'soil') {
      const s = await _soilEvidence();
      ev = validateProviderResponse('soil', s || { configured: checkProviderKey('soil').keyPresent });
    } else if (provider === 'weather') {
      ev = validateProviderResponse('weather', { configured: true, httpStatus: live.weather ? 200 : null });
    } else {
      // Railway runtime (or injected secrets): readiness from real key presence
      // (length only) + the last live call status — never the env var alone.
      const rt = await _runtimeEvidence(provider);
      const key = checkProviderKey(provider);
      ev = validateProviderResponse(provider, {
        configured: key.keyPresent, httpStatus: (rt && rt.httpStatus) ?? null,
      });
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
    runtimeContext: ctx,
    nextAction: certificationNextAction(ctx),
    certifications: Object.freeze(certifications),
    scorecard,
    overall: scorecard.overall,
  });
}

export { CERT_STATUS };
