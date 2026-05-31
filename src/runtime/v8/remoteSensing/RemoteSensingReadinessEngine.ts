/**
 * Farroway · Remote Sensing Readiness Engine (remote-sensing-readiness-v8)
 *
 * Composition-only, self-contained decision-support runtime.
 * It NEVER imports a project module. It reads ONLY real stored data via
 * the `_probe()` and `_ls()` helpers below, and never fabricates data.
 *
 * HONESTY STANCE:
 * This engine reports whether the *prerequisites* for remote-sensing analysis
 * (Sentinel imagery, soil context, farm boundary, GPS, weather) are configured
 * and present — NOT whether any analysis has actually run. It performs NO live
 * network request: it detects provider/config via build-time env flags only,
 * and reads coarse presence signals (booleans) from localStorage / window vars.
 *
 * It NEVER fabricates an NDVI, soil, vegetation, rainfall, yield, or revenue
 * number. NDVI / moisture are reported only as CAPABILITY booleans (could it
 * run, given config + boundary) — never as a claim that NDVI was computed.
 * `activeRemotePrediction` may be true ONLY when real remote-sensing data has
 * actually been fetched and stored on this device. None is, so it stays false.
 *
 * It also NEVER exposes a coordinate value: farm location / boundary presence
 * is reduced to a single boolean before it leaves this module.
 *
 * This layer is NOT a blocker for the grower pilot — it is informational only.
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

export const REMOTE_SENSING_READINESS_VERSION = 'remote-sensing-readiness-v8';

// --- env / config helpers (build-time only — NO fetch, NO runtime call) --

// Build-time env flag read, ALWAYS defensive through _safe.
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
// all? We read .latitude / .location / boundary etc. ONLY to set a boolean via
// presence (!= null) — we NEVER expose a coordinate or boundary value.
function _hasFarmLocation(farm: any): boolean {
  return _safe(() => {
    const f = _obj(farm);
    if (!f) return false;
    const loc =
      _obj((f as any).location) ||
      _obj((f as any).coordinates) ||
      _obj((f as any).coords);
    const hasLatLng =
      (!!loc &&
        (loc.lat != null || loc.latitude != null) &&
        (loc.lng != null || loc.lon != null || loc.longitude != null)) ||
      ((f as any).latitude != null &&
        ((f as any).longitude != null || (f as any).lng != null || (f as any).lon != null)) ||
      ((f as any).lat != null &&
        ((f as any).lng != null || (f as any).lon != null || (f as any).longitude != null));
    const hasBoundary =
      _arr((f as any).boundary).length > 0 ||
      _arr((f as any).polygon).length > 0 ||
      _arr(_obj((f as any).geojson)?.coordinates).length > 0;
    return !!(hasLatLng || hasBoundary);
  }, false);
}

// Coarse boolean: did the active-farm record capture a GPS fix at any point?
// Again presence-only — no coordinate value ever leaves this function.
function _hasGps(farm: any): boolean {
  return _safe(() => {
    const f = _obj(farm);
    if (!f) return false;
    const gps = _obj((f as any).gps) || _obj((f as any).position);
    const gpsFix =
      (!!gps && (gps.lat != null || gps.latitude != null)) ||
      (f as any).gpsAvailable === true ||
      (f as any).latitude != null ||
      (f as any).lat != null;
    return !!gpsFix;
  }, false);
}

export interface RemoteSensingReadinessEnvelope {
  runtimeVersion: 'remote-sensing-readiness-v8';
  initialized: true;
  sentinelHubReady: boolean;
  soilDataReady: boolean;
  farmBoundaryReady: boolean;
  gpsAvailable: boolean;
  weatherProviderReady: boolean;
  ndviCanRun: boolean;
  moistureCanRun: boolean;
  activeRemotePrediction: false;
  confidence: Confidence;
  dataSources: string[];
  explanation: string;
  limitations: string;
}

export function remoteSensingReadinessHealth(): RemoteSensingReadinessEnvelope {
  return _safe<RemoteSensingReadinessEnvelope>(
    () => {
      // --- provider configuration (env / coarse signals ONLY, NO fetch) ---
      const sentinelHubReady =
        _envPresent('SENTINEL_KEY') || _envPresent('VITE_SENTINEL_KEY');

      const soilDataReady = _envOn('VITE_FEATURE_SOIL_CONTEXT');

      const lastWeather = _obj(_winVar('__farrowayLastWeather'));
      const weatherProviderReady =
        _envPresent('OPEN_METEO_ENDPOINT') ||
        _envPresent('OPEN_METEO_BASE') ||
        _envPresent('VITE_OPEN_METEO_ENDPOINT') ||
        _envPresent('VITE_OPEN_METEO_BASE') ||
        !!lastWeather;

      // --- active-farm presence signals (booleans only — coords never out) -
      const activeFarm = _obj(_ls('farroway_active_farm'));
      const farmBoundaryReady = _hasFarmLocation(activeFarm);
      const gpsAvailable = _hasGps(activeFarm);

      // --- capability booleans (NOT a claim that anything ran) -------------
      // ndviCanRun: imagery provider configured AND we know where the farm is.
      const ndviCanRun = sentinelHubReady && farmBoundaryReady;
      // moistureCanRun: soil context enabled AND we know where the farm is.
      const moistureCanRun = soilDataReady && farmBoundaryReady;

      // --- active remote prediction: ALWAYS false until real data fetched --
      // This engine performs no fetch and emits no NDVI / soil number, so a
      // live prediction can never be claimed here.
      const activeRemotePrediction = false as const;

      // --- honest data sources (only signals we actually observed) ---------
      const dataSources: string[] = [];
      if (sentinelHubReady) dataSources.push('env:SENTINEL_KEY');
      if (soilDataReady) dataSources.push('env:VITE_FEATURE_SOIL_CONTEXT');
      if (weatherProviderReady) {
        dataSources.push(lastWeather ? 'window.__farrowayLastWeather' : 'env:OPEN_METEO');
      }
      if (farmBoundaryReady || gpsAvailable) dataSources.push('farroway_active_farm');

      // --- limitations (constant, honest; ENDS with the disclaimer) --------
      const limitations =
        'This reports only whether remote-sensing prerequisites are configured ' +
        'and whether the active farm has a saved location — it does NOT mean any ' +
        'satellite, soil, or weather data has been fetched or analysed. No imagery, ' +
        'NDVI, soil-moisture, yield, or revenue value is computed or stored here, and ' +
        'no coordinates are exposed. This layer is informational only and is NOT a ' +
        'blocker for the grower pilot. ' +
        GUIDANCE_TAIL;

      // --- readiness count drives a LABEL confidence (never a number) ------
      const readySignals =
        (sentinelHubReady ? 1 : 0) +
        (soilDataReady ? 1 : 0) +
        (farmBoundaryReady ? 1 : 0) +
        (gpsAvailable ? 1 : 0) +
        (weatherProviderReady ? 1 : 0);

      // --- honest fallback when nothing is configured yet ------------------
      if (readySignals === 0) {
        return Object.freeze({
          runtimeVersion: REMOTE_SENSING_READINESS_VERSION,
          initialized: true as const,
          sentinelHubReady,
          soilDataReady,
          farmBoundaryReady,
          gpsAvailable,
          weatherProviderReady,
          ndviCanRun,
          moistureCanRun,
          activeRemotePrediction,
          confidence: 'low' as Confidence,
          dataSources: Object.freeze([]) as unknown as string[],
          explanation:
            NOT_ENOUGH +
            ' — no imagery, soil, weather, or farm-location signal is configured. ' +
            'Remote-sensing readiness will improve as these are set up.',
          limitations,
        }) as RemoteSensingReadinessEnvelope;
      }

      // Confidence is a LABEL only. Capability to run both NDVI and moisture
      // checks, plus weather context, is the strongest readiness signal.
      let confidence: Confidence = 'low';
      if (ndviCanRun && moistureCanRun && weatherProviderReady) {
        confidence = 'high';
      } else if (readySignals >= 2) {
        confidence = 'medium';
      }

      const explanation = _safe(() => {
        const bits: string[] = [];
        bits.push(
          'Remote-sensing prerequisites detected: ' +
            'satellite imagery ' + (sentinelHubReady ? 'configured' : 'not configured') + ', ' +
            'soil context ' + (soilDataReady ? 'enabled' : 'off') + ', ' +
            'weather provider ' + (weatherProviderReady ? 'available' : 'not available') + ', ' +
            'farm location ' + (farmBoundaryReady ? 'on file' : 'missing') + ', ' +
            'GPS fix ' + (gpsAvailable ? 'recorded' : 'not recorded') + '.',
        );
        bits.push(
          'NDVI analysis ' +
            (ndviCanRun
              ? 'could run once imagery is fetched'
              : 'cannot run yet (needs imagery config and a farm location)') +
            '.',
        );
        bits.push(
          'Soil-moisture context ' +
            (moistureCanRun
              ? 'could run once data is fetched'
              : 'cannot run yet (needs soil context enabled and a farm location)') +
            '.',
        );
        bits.push(
          'No live remote prediction is active — nothing has been fetched or stored yet.',
        );
        return bits.join(' ');
      }, NOT_ENOUGH + ' — remote-sensing readiness is still being established.');

      return Object.freeze({
        runtimeVersion: REMOTE_SENSING_READINESS_VERSION,
        initialized: true as const,
        sentinelHubReady,
        soilDataReady,
        farmBoundaryReady,
        gpsAvailable,
        weatherProviderReady,
        ndviCanRun,
        moistureCanRun,
        activeRemotePrediction,
        confidence,
        dataSources: Object.freeze(dataSources) as unknown as string[],
        explanation,
        limitations,
      }) as RemoteSensingReadinessEnvelope;
    },
    // --- absolute fallback if anything above throws ----------------------
    Object.freeze({
      runtimeVersion: REMOTE_SENSING_READINESS_VERSION,
      initialized: true as const,
      sentinelHubReady: false,
      soilDataReady: false,
      farmBoundaryReady: false,
      gpsAvailable: false,
      weatherProviderReady: false,
      ndviCanRun: false,
      moistureCanRun: false,
      activeRemotePrediction: false as const,
      confidence: 'low' as Confidence,
      dataSources: Object.freeze([]) as unknown as string[],
      explanation:
        NOT_ENOUGH + ' — remote-sensing readiness could not be determined on this device.',
      limitations:
        'This reports only whether remote-sensing prerequisites are configured. ' +
        'No imagery, NDVI, soil, weather, yield, or revenue value is computed or ' +
        'stored here, and no coordinates are exposed. This layer is informational ' +
        'only and is NOT a blocker for the grower pilot. ' +
        GUIDANCE_TAIL,
    }) as RemoteSensingReadinessEnvelope,
  );
}

export function installRemoteSensingReadinessHealthGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__remoteSensingReadinessHealth !== 'function') {
      w.__remoteSensingReadinessHealth = function () {
        const out = remoteSensingReadinessHealth();
        try {
          const dev =
            typeof import.meta !== 'undefined' &&
            (import.meta as any).env &&
            (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true)
            console.log('[Farroway · Remote Sensing Readiness]', out);
        } catch {}
        return out;
      };
    }
    return true;
  }, false);
}
