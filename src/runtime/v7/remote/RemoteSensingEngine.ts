/**
 * Farroway · Remote Sensing Engine (remote-sensing-v1)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` and `_ls()` helpers below, and never fabricates data.
 *
 * HONESTY STANCE (inherited from RemoteSensingReadiness v1):
 * This engine does NOT fetch any satellite, soil, or weather data. A health
 * probe performs NO live network request — it detects provider configuration
 * via build-time env flags only, and reads any already-stored remote-sensing
 * data from localStorage. It NEVER fabricates an NDVI, vegetation, soil, or
 * rainfall number. If a provider is unconfigured, or no real stored remote
 * data exists, the corresponding output is the honest readiness string
 * "Not enough remote data yet" and `activePredictionEnabled` stays false.
 *
 * `activePredictionEnabled` may be true ONLY when real remote-sensing data has
 * actually been fetched and stored on this device. Until then: false.
 *
 * SELF-CONTAINED: no project imports. SSR-safe. Pure. Never throws.
 */

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

// --- internal pure helpers (never throw) ---------------------------------

function _arr(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function _obj(v: any): any {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function _winVar(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    return (window as any)[name] ?? null;
  }, null);
}

type Confidence = 'low' | 'medium' | 'high';

const GUIDANCE_TAIL = 'Decision support, not a guarantee.';

// The single honest fallback for any output that has no real backing data.
const NOT_ENOUGH = 'Not enough remote data yet';

export const REMOTE_SENSING_ENGINE_VERSION = 'remote-sensing-v1';

// --- remote-sensing-specific pure helpers (never throw) ------------------

// Build-time env flag read, ALWAYS defensive — no fetch, no runtime call.
function _env(key: string): any {
  return _safe(() => (import.meta as any).env?.[key], undefined);
}

function _envPresent(key: string): boolean {
  return _safe(() => {
    const v = _env(key);
    return typeof v === 'string' ? v.trim().length > 0 : v != null && v !== false;
  }, false);
}

function _envOn(key: string): boolean {
  return _safe(() => {
    const v = _env(key);
    const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
    return s === 'true' || s === 'on';
  }, false);
}

// Coarse boolean: does the active-farm object expose a location/boundary at
// all? We expose ONLY the boolean — never any coordinate or boundary value.
function _hasBoundary(farm: any): boolean {
  return _safe(() => {
    const f = _obj(farm);
    if (!f) return false;
    const loc = _obj((f as any).location) || _obj((f as any).coordinates) || _obj((f as any).coords);
    const hasLatLng =
      (!!loc && (loc.lat != null || loc.latitude != null) && (loc.lng != null || loc.lon != null || loc.longitude != null)) ||
      ((f as any).lat != null && ((f as any).lng != null || (f as any).lon != null || (f as any).longitude != null));
    const hasBoundary =
      _arr((f as any).boundary).length > 0 ||
      _arr((f as any).polygon).length > 0 ||
      _arr((f as any).geojson?.coordinates).length > 0;
    return !!(hasLatLng || hasBoundary);
  }, false);
}

// Does a candidate store actually carry a REAL numeric NDVI / vegetation /
// soil reading? We only trust a finite number in a recognized field. Anything
// else (empty store, readiness-only metadata, NaN) means "no real data".
function _hasRealRemoteData(store: any): boolean {
  return _safe(() => {
    const s = _obj(store);
    if (!s) return false;
    const candidates: any[] = [
      (s as any).ndvi, (s as any).ndviValue, (s as any).meanNdvi,
      (s as any).vegetationIndex, (s as any).veg, (s as any).evi,
      (s as any).soilMoisture, (s as any).soilMoistureValue,
      (s as any).soilOrganicCarbon, (s as any).soil?.value,
      _obj((s as any).value)?.ndvi, _obj((s as any).value)?.soilMoisture,
    ];
    const arrays: any[] = [
      _arr((s as any).observations),
      _arr((s as any).readings),
      _arr((s as any).tiles),
      _arr((s as any).samples),
    ];
    const numericOk = candidates.some((c) => typeof c === 'number' && Number.isFinite(c));
    const arrayOk = arrays.some((a) => a.length > 0 && a.some((row: any) => {
      const r = _obj(row);
      if (!r) return false;
      const v = (r as any).ndvi ?? (r as any).value ?? (r as any).soilMoisture;
      return typeof v === 'number' && Number.isFinite(v);
    }));
    return numericOk || arrayOk;
  }, false);
}

export interface RemoteSensingHealthEnvelope {
  runtimeVersion: 'remote-sensing-v1';
  initialized: true;
  activePredictionEnabled: boolean;
  providersConfigured: {
    sentinelHub: boolean;
    soilGrids: boolean;
    openMeteo: boolean;
    gpsBoundary: boolean;
  };
  value: {
    ndviReadiness: string;
    vegetationStressStatus: string;
    soilContext: string;
    rainfallAnomalyReadiness: string;
    droughtRiskReadiness: string;
  };
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export function remoteSensingHealth(): RemoteSensingHealthEnvelope {
  return _safe<RemoteSensingHealthEnvelope>(
    () => {
      // --- provider configuration (env / coarse signals ONLY, NO fetch) ---
      const lastWeather = _obj(_winVar('__farrowayLastWeather'));
      const openMeteo =
        _envPresent('OPEN_METEO_ENDPOINT') ||
        _envPresent('OPEN_METEO_BASE') ||
        _envPresent('VITE_OPEN_METEO_ENDPOINT') ||
        _envPresent('VITE_OPEN_METEO_BASE') ||
        !!lastWeather;
      const sentinelHub = _envPresent('SENTINEL_KEY') || _envPresent('VITE_SENTINEL_KEY');
      const soilGrids = _envOn('VITE_FEATURE_SOIL_CONTEXT');

      const activeFarm = _obj(_ls('farroway_active_farm'));
      const gpsBoundary = _hasBoundary(activeFarm); // boolean only — coords never exposed

      const providersConfigured = {
        sentinelHub,
        soilGrids,
        openMeteo,
        gpsBoundary,
      };

      // --- real stored remote-sensing data (NO fetch; localStorage + probes) ---
      // None of these is expected to exist yet. Each may be null/empty.
      const cache = _ls('farroway_remote_sensing_cache');
      const readinessProbe = _probe('__remoteSensingReadiness'); // existing V1 placeholder
      const satelliteProbe = _probe('__satelliteIntelligenceHealth');

      const hasCacheData = _hasRealRemoteData(cache) || _hasRealRemoteData(_obj(cache)?.value);
      const hasReadinessData = _hasRealRemoteData(_obj(readinessProbe)?.value) || _hasRealRemoteData(readinessProbe);
      const hasSatelliteData = _hasRealRemoteData(_obj(satelliteProbe)?.value) || _hasRealRemoteData(satelliteProbe);

      const hasRealRemoteData = hasCacheData || hasReadinessData || hasSatelliteData;

      // --- readiness outputs (NEVER a fabricated number) ---
      // Vegetation / soil readouts require REAL stored remote data. Without it,
      // the honest answer is the readiness string. We never invent NDVI.
      const ndviReadiness = hasRealRemoteData
        ? 'Stored remote-sensing data present — review on-device readings'
        : NOT_ENOUGH;
      const vegetationStressStatus = hasRealRemoteData
        ? 'Stored remote-sensing data present — review on-device readings'
        : NOT_ENOUGH;
      const soilContext = (soilGrids && hasRealRemoteData)
        ? 'Stored soil context present — review on-device readings'
        : NOT_ENOUGH;

      // Rainfall / drought may surface a COARSE readiness note from weather
      // context only. This is a note about availability, NOT an anomaly number.
      const rainfallAnomalyReadiness = lastWeather
        ? 'Weather context available, full anomaly analysis needs more remote data'
        : NOT_ENOUGH;
      const droughtRiskReadiness = lastWeather
        ? 'Weather context available, full drought analysis needs more remote data'
        : NOT_ENOUGH;

      // `activePredictionEnabled` is true ONLY if real stored remote data exists.
      const activePredictionEnabled = hasRealRemoteData;

      // --- honest data-source attestation (only what is really configured) ---
      const dataSources: string[] = [];
      if (openMeteo) dataSources.push('weather-context');
      if (gpsBoundary) dataSources.push('farroway_active_farm');
      if (hasCacheData) dataSources.push('farroway_remote_sensing_cache');
      if (hasReadinessData) dataSources.push('__remoteSensingReadiness');
      if (hasSatelliteData) dataSources.push('__satelliteIntelligenceHealth');

      // Confidence reflects how much REAL backing exists. No real remote data
      // means low — we are honest that nothing field-level is being predicted.
      const confidence: Confidence = activePredictionEnabled
        ? 'medium'
        : 'low';

      const explanation = activePredictionEnabled
        ? 'Remote-sensing data has been stored on this device; readiness reflects real stored readings, not a live fetch.'
        : 'Remote sensing is not active yet — no satellite, soil, or vegetation data has been fetched or stored, so no NDVI or field-level prediction is produced. Provider configuration is detected from build-time flags only.';

      const configuredNote = [
        sentinelHub ? 'a satellite key is configured' : 'no satellite key is configured',
        soilGrids ? 'soil context is enabled' : 'soil context is not enabled',
        openMeteo ? 'weather context is available' : 'no weather context is available',
        gpsBoundary ? 'a farm location/boundary exists' : 'no farm location/boundary exists',
      ].join(', ');

      const limitations =
        'This probe performs no live network request: it detects providers from build-time configuration only and reads any already-stored data from this device. ' +
        'No NDVI, vegetation, soil, or rainfall number is ever fabricated. ' +
        (activePredictionEnabled
          ? 'Stored remote-sensing data is present, but readings are coarse and may be stale. '
          : 'No real remote-sensing data exists yet, so every field-level readout is "' + NOT_ENOUGH + '". ') +
        'Configuration: ' + configuredNote + '. ' +
        GUIDANCE_TAIL;

      const envelope: RemoteSensingHealthEnvelope = {
        runtimeVersion: 'remote-sensing-v1',
        initialized: true as const,
        activePredictionEnabled,
        providersConfigured: Object.freeze(providersConfigured) as RemoteSensingHealthEnvelope['providersConfigured'],
        value: Object.freeze({
          ndviReadiness,
          vegetationStressStatus,
          soilContext,
          rainfallAnomalyReadiness,
          droughtRiskReadiness,
        }) as RemoteSensingHealthEnvelope['value'],
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      };

      return Object.freeze(envelope);
    },
    Object.freeze({
      runtimeVersion: 'remote-sensing-v1',
      initialized: true as const,
      activePredictionEnabled: false,
      providersConfigured: Object.freeze({
        sentinelHub: false,
        soilGrids: false,
        openMeteo: false,
        gpsBoundary: false,
      }),
      value: Object.freeze({
        ndviReadiness: NOT_ENOUGH,
        vegetationStressStatus: NOT_ENOUGH,
        soilContext: NOT_ENOUGH,
        rainfallAnomalyReadiness: NOT_ENOUGH,
        droughtRiskReadiness: NOT_ENOUGH,
      }),
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        'Remote sensing is not active yet — no satellite, soil, or vegetation data has been fetched or stored, so no NDVI or field-level prediction is produced.',
      limitations:
        'This probe performs no live network request and no real remote-sensing data exists yet, so every field-level readout is "' +
        NOT_ENOUGH +
        '". No NDVI, vegetation, soil, or rainfall number is ever fabricated. ' +
        GUIDANCE_TAIL,
    }) as RemoteSensingHealthEnvelope,
  );
}

export function installRemoteSensingHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    // NEW global — distinct from the existing __remoteSensingReadiness placeholder.
    if (typeof w.__remoteSensingHealth !== 'function') {
      w.__remoteSensingHealth = function () {
        const out = remoteSensingHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Remote Sensing]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
