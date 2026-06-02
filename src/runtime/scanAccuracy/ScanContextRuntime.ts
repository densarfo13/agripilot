/**
 * ScanContextRuntime.ts — §STAGE 11.
 *
 * Soil + weather supporting evidence composite. Read-only over existing
 * probes (__soilGridsHealth, __weatherRiskHealth / __weatherHealth,
 * __regionalIntelligenceFieldHealth). NEVER fabricates context — every
 * string traces back to a real upstream probe. When a probe is missing
 * we honestly return empty summaries rather than guessed text.
 *
 * Self-contained: imports only the shared GUIDANCE_TAIL constant from
 * the sibling contracts module. Never throws. No time / randomness
 * sources are read inside the file body.
 */

import { GUIDANCE_TAIL } from './ScanAccuracyContracts';

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

function _probe(name: string): any {
  return _safe(() => {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    return typeof w[name] === 'function' ? w[name]() : null;
  }, null);
}

export interface ScanContext {
  soilAvailable: boolean;
  soilSummary: string;
  weatherAvailable: boolean;
  weatherSummary: string;
  rainfallAvailable: boolean;
  rainfallSummary: string;
  temperatureAvailable: boolean;
  temperatureSummary: string;
  supportingNote: string;
}

export interface ScanContextHealth {
  initialized: true;
  soilProbeReady: boolean;
  weatherProbeReady: boolean;
  regionalProbeReady: boolean;
  noFabricatedContext: true;
  confidence: 'low' | 'medium' | 'high';
  explanation: string;
  limitations: string;
}

const EMPTY_CONTEXT: Readonly<ScanContext> = Object.freeze({
  soilAvailable: false,
  soilSummary: '',
  weatherAvailable: false,
  weatherSummary: '',
  rainfallAvailable: false,
  rainfallSummary: '',
  temperatureAvailable: false,
  temperatureSummary: '',
  supportingNote: '',
});

function _readSoil(): { available: boolean; summary: string } {
  return _safe(() => {
    const h = _probe('__soilGridsHealth');
    if (!h || typeof h !== 'object') return { available: false, summary: '' };
    const lastProfile = (h as any).lastProfile;
    const available = !!(lastProfile && lastProfile.soilDataAvailable === true);
    if (!available) return { available: false, summary: '' };
    const texture = lastProfile && lastProfile.soilTexture
      && typeof lastProfile.soilTexture.label === 'string'
      ? lastProfile.soilTexture.label : '';
    const drainage = lastProfile && typeof lastProfile.drainageRisk === 'string'
      ? lastProfile.drainageRisk : '';
    const parts: string[] = [];
    if (texture) parts.push(texture);
    if (drainage) parts.push(drainage + ' drainage risk');
    return { available: parts.length > 0, summary: parts.join(', ') };
  }, { available: false, summary: '' });
}

function _readWeather(): { available: boolean; summary: string } {
  return _safe(() => {
    const h = _probe('__weatherRiskHealth') || _probe('__weatherHealth');
    if (!h || typeof h !== 'object') return { available: false, summary: '' };
    const obj = h as any;
    const candidates: Array<unknown> = [
      obj.summary, obj.weatherSummary, obj.conditionsSummary,
      obj.currentConditions, obj.explanation,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 0) {
        return { available: true, summary: c };
      }
    }
    return { available: false, summary: '' };
  }, { available: false, summary: '' });
}

function _readRegional(): {
  rainfallAvailable: boolean; rainfallSummary: string;
  temperatureAvailable: boolean; temperatureSummary: string;
} {
  return _safe(() => {
    const h = _probe('__regionalIntelligenceFieldHealth');
    if (!h || typeof h !== 'object') {
      return {
        rainfallAvailable: false, rainfallSummary: '',
        temperatureAvailable: false, temperatureSummary: '',
      };
    }
    const obj = h as any;
    const rain = (typeof obj.rainfallPattern === 'string' && obj.rainfallPattern.length > 0)
      ? obj.rainfallPattern : '';
    const temp = (typeof obj.temperaturePattern === 'string' && obj.temperaturePattern.length > 0)
      ? obj.temperaturePattern : '';
    return {
      rainfallAvailable: rain.length > 0,
      rainfallSummary: rain,
      temperatureAvailable: temp.length > 0,
      temperatureSummary: temp,
    };
  }, {
    rainfallAvailable: false, rainfallSummary: '',
    temperatureAvailable: false, temperatureSummary: '',
  });
}

export function readScanContext(): Readonly<ScanContext> {
  return _safe(() => {
    const soil = _readSoil();
    const weather = _readWeather();
    const regional = _readRegional();

    const noteParts: string[] = [];
    if (soil.available) noteParts.push('Soil: ' + soil.summary);
    if (weather.available) noteParts.push('Weather: ' + weather.summary);
    if (regional.rainfallAvailable) noteParts.push('Rainfall: ' + regional.rainfallSummary);
    if (regional.temperatureAvailable) noteParts.push('Temperature: ' + regional.temperatureSummary);

    return Object.freeze<ScanContext>({
      soilAvailable: soil.available,
      soilSummary: soil.summary,
      weatherAvailable: weather.available,
      weatherSummary: weather.summary,
      rainfallAvailable: regional.rainfallAvailable,
      rainfallSummary: regional.rainfallSummary,
      temperatureAvailable: regional.temperatureAvailable,
      temperatureSummary: regional.temperatureSummary,
      supportingNote: noteParts.join(' · '),
    });
  }, EMPTY_CONTEXT);
}

export function scanContextHealth(): Readonly<ScanContextHealth> {
  return _safe(() => {
    const soilProbeReady = _probe('__soilGridsHealth') !== null;
    const weatherProbeReady = _probe('__weatherRiskHealth') !== null
      || _probe('__weatherHealth') !== null;
    const regionalProbeReady = _probe('__regionalIntelligenceFieldHealth') !== null;
    const ready = [soilProbeReady, weatherProbeReady, regionalProbeReady]
      .filter(Boolean).length;
    return Object.freeze<ScanContextHealth>({
      initialized: true,
      soilProbeReady,
      weatherProbeReady,
      regionalProbeReady,
      noFabricatedContext: true as const,
      confidence: (ready >= 3 ? 'high' : ready >= 1 ? 'medium' : 'low'),
      explanation:
        'Scan context composes soil, weather, rainfall and temperature ' +
        'evidence by reading existing probes only — never invents text. ' +
        'Each summary string traces back to a real upstream probe field; ' +
        'when a probe is absent the corresponding *Available flag is false ' +
        'and the summary is the empty string.',
      limitations:
        'Context reflects upstream probe availability — composite never ' +
        'fabricates soil or weather details. ' + GUIDANCE_TAIL,
    });
  }, Object.freeze<ScanContextHealth>({
    initialized: true,
    soilProbeReady: false,
    weatherProbeReady: false,
    regionalProbeReady: false,
    noFabricatedContext: true as const,
    confidence: 'low',
    explanation: 'Scan context runtime initialized.',
    limitations: 'Not enough probe data yet. ' + GUIDANCE_TAIL,
  }));
}

export function installScanContextGlobal(): boolean {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    if (typeof w.__scanContextHealth !== 'function') {
      w.__scanContextHealth = function () {
        const out = scanContextHealth();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Scan Context]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    if (typeof w.__scanContext !== 'function') {
      w.__scanContext = function () {
        const out = readScanContext();
        try {
          const dev = typeof import.meta !== 'undefined'
            && (import.meta as any).env && (import.meta as any).env.DEV;
          if (dev || w.__farrowayHealthLog === true) {
            console.log('[Farroway · Scan Context · Read]', out);
          }
        } catch { /* swallow */ }
        return out;
      };
    }
    return true;
  }, false);
}
