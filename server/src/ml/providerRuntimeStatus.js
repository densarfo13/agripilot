/**
 * providerRuntimeStatus.js — P0 PROVIDER RUNTIME STATUS AUDIT.
 *
 * Reports the RUNTIME truth for every scan provider, read from process.env on
 * the server that is actually running (Railway) — it assumes nothing. For each
 * provider it answers: is the env var present, what is its length + fingerprint,
 * is there an adapter wired to call it, did auth succeed, and the precise
 * failure reason from a fixed taxonomy.
 *
 * Hard invariant (the whole point of this audit): failureReason is NEVER
 * 'missing_env' when keyLength > 0. A key that exists but doesn't work is an
 * auth / credits / wiring problem, not a missing key — and we say which.
 *
 * Secrets are never logged: only keyLength + a 6-char fingerprint.
 */
import { getScanProviderDiagnostics } from './scanInferenceService.js';
import { insectKeyPresent } from './providers/insectProvider.js';
import { cropHealthKeyPresent } from './providers/cropHealthProvider.js';
import { mushroomKeyPresent } from './providers/mushroomProvider.js';

function _fingerprint(key) {
  if (!key || typeof key !== 'string') return null;
  return key.length >= 6 ? key.slice(0, 6) : key.slice(0, key.length);
}
function _resolve(envNames) {
  for (const n of envNames) {
    const v = (process.env[n] || '').trim();
    if (v) return { envNameUsed: n, value: v };
  }
  return { envNameUsed: null, value: '' };
}

/**
 * Each provider: its accepted env names (canonical first, then aliases) and
 * whether an inference adapter is actually wired to call it.
 *   plant.id   — wired (plantIdProvider).
 *   insect.id  — wired (insectProvider).
 *   crop.health— NOT wired yet (key would be read here, but no call adapter).
 *   mushroom.id— NO reader + NO adapter (genuine gap, not a missing key).
 */
const PROVIDERS = [
  { providerName: 'plant.id',    expectedEnvNames: ['PLANT_ID_API_KEY', 'PLANT_API_KEY'], wired: true },
  { providerName: 'crop.health', expectedEnvNames: ['CROP_HEALTH_API_KEY', 'CROP_ID_API_KEY'], wired: true },
  { providerName: 'insect.id',   expectedEnvNames: ['INSECT_ID_API_KEY'], wired: true },
  { providerName: 'mushroom.id', expectedEnvNames: ['MUSHROOM_ID_API_KEY'], wired: true },
];

/**
 * The failure taxonomy (in priority order). Note the hard rule: with a key
 * present we NEVER return missing_env.
 */
export function classifyProviderFailure({ envPresent, wired, lastHttpStatus, lastFailureReason }) {
  if (!envPresent) return 'missing_env';
  if (!wired) return 'not_wired';                 // key present but no call adapter
  const s = lastHttpStatus;
  const fr = String(lastFailureReason || '').toLowerCase();
  if (/timeout/.test(fr)) return 'timeout';
  if (s === 401) return 'auth_failed_401';
  if (s === 403) return 'forbidden_403';
  if (s === 402 || /credit|quota|insufficient/.test(fr)) return 'credits_exhausted';
  if (s === 429) return 'rate_limited_429';
  if (typeof s === 'number' && s >= 500) return 'provider_error';
  if (/map|parse|normali/.test(fr)) return 'mapping_error';
  if (s === 200) return 'ready';
  return 'pending';                                // keyed + wired, not yet proven (NOT missing)
}

/** Pull the most recent call info for a provider (only plant.id records today). */
function _lastFor(providerName) {
  if (providerName === 'plant.id') {
    const d = getScanProviderDiagnostics();
    return { lastHttpStatus: d.lastHttpStatus, lastFailureReason: d.lastFailureReason,
      candidateCount: d.lastCandidateCount, confidence: d.lastConfidence };
  }
  return { lastHttpStatus: null, lastFailureReason: null, candidateCount: null, confidence: null };
}

export function getProviderRuntimeStatus() {
  return PROVIDERS.map((p) => {
    // Providers with a dedicated key-present reader use it; otherwise resolve generically.
    const resolved = _resolve(p.expectedEnvNames);
    const readerPresent =
      (p.providerName === 'insect.id' && insectKeyPresent())
      || (p.providerName === 'crop.health' && cropHealthKeyPresent())
      || (p.providerName === 'mushroom.id' && mushroomKeyPresent());
    const envPresent = readerPresent || !!resolved.value;
    const value = resolved.value;
    const keyLength = value.length;
    const last = _lastFor(p.providerName);
    const failureReason = classifyProviderFailure({
      envPresent, wired: p.wired,
      lastHttpStatus: last.lastHttpStatus, lastFailureReason: last.lastFailureReason,
    });
    const authSucceeded = last.lastHttpStatus == null ? null : last.lastHttpStatus === 200;
    const providerReady = envPresent && p.wired && authSucceeded === true;
    return Object.freeze({
      providerName: p.providerName,
      expectedEnvNames: Object.freeze(p.expectedEnvNames),
      envNameUsed: resolved.envNameUsed,
      envPresent,
      keyLength,
      keyFingerprint: _fingerprint(value),         // first 6 only, never the full secret
      providerWired: p.wired,
      initialized: envPresent && p.wired,
      authSucceeded,
      lastHttpStatus: last.lastHttpStatus,
      creditsKnown: false,                         // honest: live credit balance not probed here
      candidateCount: last.candidateCount,
      failureReason,
      providerReady,
    });
  });
}

/** Map the per-provider status into the acceptance-gate flags the client reads. */
export function getProviderAcceptanceFlags() {
  const list = getProviderRuntimeStatus();
  const by = (n) => list.find((p) => p.providerName === n) || {};
  const plant = by('plant.id');
  const crop = by('crop.health');
  const insect = by('insect.id');
  return Object.freeze({
    // Existing plant.id fields stay; ADD the sibling provider truth so the
    // client stops defaulting them to false.
    cropHealthConfigured: !!crop.envPresent,
    cropHealthWired: !!crop.providerWired,
    cropHealthHttpStatus: crop.lastHttpStatus ?? null,
    cropHealthFailureReason: crop.failureReason || null,
    insectIdConfigured: !!insect.envPresent,
    insectIdWired: !!insect.providerWired,
    insectIdHttpStatus: insect.lastHttpStatus ?? null,
    insectIdFailureReason: insect.failureReason || null,
    plantIdFailureReason: plant.failureReason || null,
    providers: list,
  });
}

/** One-line startup log (no secrets) so Railway logs show the runtime truth. */
export function logProviderStartupStatus(logger = console) {
  try {
    const list = getProviderRuntimeStatus();
    for (const p of list) {
      logger.log('[provider-status] ' + p.providerName
        + ' envPresent=' + p.envPresent
        + ' keyLen=' + p.keyLength
        + ' fp=' + (p.keyFingerprint || '∅')
        + ' wired=' + p.providerWired
        + ' reason=' + p.failureReason);
    }
  } catch { /* logging must never break boot */ }
}
