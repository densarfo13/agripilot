// RemoteSensingReadiness.ts
// Composition-only decision-support runtime.
// Remote-sensing readiness PLACEHOLDER. This engine does NOT build any
// satellite intelligence, does NOT fetch any data, and makes NO NDVI /
// vegetation / moisture claims. It only reports whether the foundations for
// a *future* remote-sensing fusion exist, in an honest, frozen envelope.
//
// SELF-CONTAINED: no project imports. SSR-safe. Never throws.

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

function _ls(key: string): any {
  return _safe(() => {
    if (typeof localStorage === 'undefined') return null;
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  }, null);
}

export interface RemoteSensingReadinessEnvelope {
  runtimeVersion: 'remote-sensing-readiness-v1';
  sentinelHubConfigured: false;
  soilProviderConfigured: false;
  gpsAvailable: boolean;
  readyForFutureFusion: false;
  activePredictionEnabled: false;
  explanation: string;
  limitations: string;
}

export function remoteSensingReadiness(): RemoteSensingReadinessEnvelope {
  return _safe<RemoteSensingReadinessEnvelope>(() => {
    // GPS availability is the only real signal we read, and it only tells us
    // whether the browser *could* offer a location in the future. It does not
    // imply any satellite or soil data is, or will be, fetched.
    const gpsAvailable: boolean =
      typeof navigator !== 'undefined' && !!(navigator as any).geolocation;

    // No API keys, no providers, no satellite or soil endpoints are wired.
    // These stay hard-false by design. We do not probe or read any source
    // that could imply otherwise — remote sensing is a placeholder only.
    const envelope: RemoteSensingReadinessEnvelope = {
      runtimeVersion: 'remote-sensing-readiness-v1',
      sentinelHubConfigured: false,
      soilProviderConfigured: false,
      gpsAvailable,
      readyForFutureFusion: false,
      activePredictionEnabled: false,
      explanation:
        'Remote sensing is not active yet — no satellite or soil data is fetched or claimed.',
      limitations:
        'Not enough data yet. This is a placeholder only: no satellite imagery, no soil provider, and no vegetation or moisture readings are available. No NDVI or field-level prediction is produced. ' +
        (gpsAvailable
          ? 'Your device can share a location, but that location is not being used to fetch any imagery. '
          : 'Your device does not expose location services, and none are being used. ') +
        'Decision support, not a guarantee.',
    };

    return Object.freeze(envelope);
  }, Object.freeze({
    runtimeVersion: 'remote-sensing-readiness-v1',
    sentinelHubConfigured: false,
    soilProviderConfigured: false,
    gpsAvailable: false,
    readyForFutureFusion: false,
    activePredictionEnabled: false,
    explanation:
      'Remote sensing is not active yet — no satellite or soil data is fetched or claimed.',
    limitations:
      'Not enough data yet. This is a placeholder only and no remote-sensing data is available. Decision support, not a guarantee.',
  }) as RemoteSensingReadinessEnvelope);
}

export function installRemoteSensingReadinessGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__remoteSensingReadiness !== 'function') {
      w.__remoteSensingReadiness = function () {
        const out = remoteSensingReadiness();
        try {
          const dev = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) console.log('[Farroway · Remote Sensing Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
