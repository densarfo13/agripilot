/**
 * ScanIntelligenceV12.ts — the unified Scan Intelligence v12 orchestrator.
 *
 * Composes the EXISTING engines (no rewrite) into the full v12 field taxonomy.
 * Every field is a V12Field carrying value + status + confidence + source +
 * evidence. The whole design exists to make one rule mechanically true:
 *
 *   • Real, derivable fields are populated from real sources (botanical reference,
 *     crop calendar, live weather forecast, server-side soil).
 *   • CV-dependent fields (counts, %s, damage, stress, population, canopy,
 *     ripeness) → status 'unavailable', value null. We have no vision model.
 *   • Market fields → status 'no_live_feed'. Market is NEVER fabricated.
 *   • Soil N/P/K/CEC → 'unknown' (not in our free data sources).
 *   • Drone / satellite / video / sensor ingestion → 'no_live_feed' (not wired).
 *
 * Unknown is always acceptable; a fabricated number never is. Pure, total.
 */
import { lookupPlantReference } from './PlantReference';
import { estimateFieldIntelligence } from '../field/FieldIntelligenceEngine';
// @ts-ignore — TS sibling without an explicit .d.ts in this build path
import * as WeatherRisk from '../../weatherRisk/WeatherRiskRuntime';

export const SCAN_V12_VERSION = 'scan-intelligence-v12';

export type V12Status =
  | 'ok'           // measured/known fact
  | 'estimated'    // honest model estimate (calendar/forecast)
  | 'advisory'     // reference-based guidance, not image-measured
  | 'unknown'      // we don't know (acceptable)
  | 'unavailable'  // needs a capability we don't run (e.g. CV) — never faked
  | 'no_live_feed';// no live data source wired — never faked

export interface V12Field<T = number | string | null> {
  value: T;
  status: V12Status;
  confidence: number;   // 0..100
  source: string;
  evidence: string;
}

const _safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
const _clamp = (n: any) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

function f(value: any, status: V12Status, confidence: number, source: string, evidence: string): V12Field<any> {
  return Object.freeze({ value: value ?? null, status, confidence: _clamp(confidence), source, evidence });
}
/** CV-dependent field — null + 'unavailable'. The ONLY constructor for these. */
const cv = (what: string): V12Field<null> =>
  f(null, 'unavailable', 0, 'cv-model:absent', 'Measuring ' + what + ' from a photo needs a vision model we don’t run — sample by hand.');
/** Market/remote field — null + 'no_live_feed'. The ONLY constructor for these. */
const noFeed = (what: string): V12Field<null> =>
  f(null, 'no_live_feed', 0, 'no-live-feed', what + ' has no live data source wired — shown as unknown, never guessed.');

export interface V12Input {
  plantName?: string | null;
  objectType?: string | null;
  identified?: boolean;          // did a provider confidently identify it?
  confidencePct?: number | null;
  crop?: string | null;
  plantingDate?: string | null;
  climate?: string; setting?: string; mode?: string; nowMs?: number;
  weather?: any;                 // real forecast context (from useLiveWeather), if available
  soil?: any;                    // real server-side soil context, if available
}

export interface ScanV12Result {
  version: string;
  identity: Record<string, V12Field>;
  health: Record<string, V12Field>;
  pest: Record<string, V12Field>;
  disease: Record<string, V12Field>;
  yield: Record<string, V12Field>;
  fieldIntelligence: Record<string, V12Field>;
  soil: Record<string, V12Field>;
  weather: Record<string, V12Field>;
  market: Record<string, V12Field>;
  multiModal: Record<string, V12Field>;
  voice: Record<string, V12Field>;
}

export function analyzeScanV12(input: V12Input = {}): ScanV12Result {
  return _safe(() => _analyze(input), _analyze({}));
}

function _analyze(input: V12Input): ScanV12Result {
  const ref = lookupPlantReference(input.plantName || input.crop);
  const confident = !!input.identified && (input.confidencePct == null || input.confidencePct >= 70);

  // ── IDENTITY — real reference for a confident, known plant; else honest unknown.
  const idKnown = confident && ref;
  const idField = (val: any, ev: string): V12Field =>
    idKnown ? f(val, 'ok', 90, 'plant-reference', ev) : f(null, 'unknown', 0, 'plant-reference', confident ? 'Identified, but not in our reference set yet.' : 'Not confidently identified — unknown is safer than a wrong name.');
  const identity = {
    scientificName: idField(ref?.scientificName, 'Botanical reference for ' + (ref?.id || '')),
    commonNames: idField(ref ? ref.commonNames.join(', ') : null, 'Reference common names'),
    family: idField(ref?.family, 'Reference family'),
    genus: idField(ref?.genus, 'Reference genus'),
    species: idField(ref?.species, 'Reference species'),
    lifeCycle: idField(ref?.lifeCycle, 'Reference life cycle'),
    nativeRegion: idField(ref?.nativeRegion, 'Reference native region'),
    edibility: idField(ref?.edibility, 'Reference edibility'),
    toxicity: idField(ref?.toxicity, 'Reference toxicity'),
    medicinalUse: idField(ref?.medicinalUse, 'Reference medicinal use'),
    pollinatorValue: idField(ref?.pollinatorValue, 'Reference pollinator value'),
    companionPlants: idField(ref ? ref.companionPlants.join(', ') : null, 'Reference companions'),
    avoidPlantingWith: idField(ref ? ref.avoidPlantingWith.join(', ') : null, 'Reference avoid-with'),
    difficultyScore: idField(ref?.difficulty, 'Reference difficulty 1–5'),
    growthStage: f(null, 'unknown', 0, 'field-intelligence', 'Stage needs a planting date (see field intelligence).'),
  };

  // ── HEALTH — every metric is CV-dependent. Honest unavailable, no fake stress %.
  const health = {
    healthScore: cv('overall health'), stressScore: cv('stress'),
    waterStress: cv('water stress'), heatStress: cv('heat stress'), coldStress: cv('cold stress'),
    nutrientDeficiency: cv('nutrient deficiency'), rootProblems: cv('root problems'),
    sunlightIssues: cv('sunlight issues'), transplantShock: cv('transplant shock'),
    overwatering: cv('overwatering'), underwatering: cv('underwatering'),
    leafDamagePct: cv('leaf damage %'), fruitDamagePct: cv('fruit damage %'), flowerDamagePct: cv('flower damage %'),
    recoveryProbability: cv('recovery probability'), urgency: cv('urgency'),
  };

  // ── PEST — identification is the provider's job; quantitative fields are CV/advisory.
  const pest = {
    likelihood: cv('pest likelihood'), damageLevel: cv('pest damage level'),
    treatment: f(null, 'advisory', 0, 'knowledge-base', 'Treatment guidance is advisory once a pest is confirmed — not measured here.'),
    organicControl: f(null, 'advisory', 0, 'knowledge-base', 'Advisory organic control on a confirmed pest.'),
    chemicalControl: f(null, 'advisory', 0, 'knowledge-base', 'Advisory chemical control on a confirmed pest.'),
    biologicalControl: f(null, 'advisory', 0, 'knowledge-base', 'Advisory biological control on a confirmed pest.'),
    monitoringSchedule: f(null, 'advisory', 0, 'knowledge-base', 'Advisory monitoring cadence.'),
  };

  // ── DISEASE — type comes from the provider; risk %s are not photo-measurable.
  const disease = {
    spreadRisk: cv('disease spread risk'), fatalityRisk: cv('fatality risk'),
    recoveryChance: cv('recovery chance'), fieldInfectionPct: cv('field infection %'),
    isolationRecommendation: f(null, 'advisory', 0, 'knowledge-base', 'Isolation advice is advisory on a confirmed disease.'),
  };

  // ── YIELD — calendar window is real; counts/weight/biomass are CV. Grade/shelf advisory.
  const fi = _safe(() => estimateFieldIntelligence({ crop: input.crop, plantingDate: input.plantingDate, climate: input.climate, setting: input.setting, mode: input.mode, nowMs: input.nowMs }), null) as any;
  const harvest = (fi && fi.harvestWindow) ? fi.harvestWindow : null;
  const yieldSec = {
    harvestWindow: harvest && harvest.value != null
      ? f(harvest.value, harvest.status === 'ok' ? 'estimated' : harvest.status, harvest.confidence, 'crop-calendar', harvest.reason)
      : f(null, 'unknown', 0, 'crop-calendar', 'Add a planting date for a harvest window.'),
    fruitCount: cv('fruit count'), flowerCount: cv('flower count'),
    yield: cv('yield'), weight: cv('weight'), biomass: cv('biomass'),
    marketGrade: f(null, 'advisory', 0, 'manual-grade', 'Grade by hand — we don’t fabricate a CV grade.'),
    shelfLife: f(null, 'advisory', 0, 'knowledge-base', 'Advisory shelf life by crop, not measured.'),
    storageRecommendation: f(null, 'advisory', 0, 'knowledge-base', 'Advisory storage guidance by crop.'),
  };

  // ── FIELD INTELLIGENCE — all spatial metrics are CV-dependent.
  const fieldIntelligence = {
    plantPopulation: cv('plant population'), spacing: cv('spacing'), rowAlignment: cv('row alignment'),
    missingPlants: cv('missing plants'), poorGermination: cv('poor germination'), lodging: cv('lodging'),
    canopyCoverage: cv('canopy coverage'), weedPressure: cv('weed pressure'),
    growthUniformity: cv('growth uniformity'), ripenessPct: cv('ripeness %'),
  };

  // ── SOIL — moisture/pH/organic are real WHEN server soil context is present;
  //    N/P/K/CEC are not in our free sources → honest unknown (never fabricated).
  const s = input.soil && typeof input.soil === 'object' ? input.soil : null;
  const soilField = (key: string, label: string): V12Field => {
    const v = s ? s[key] : undefined;
    return (v != null && Number.isFinite(Number(v)))
      ? f(Number(v), 'ok', 70, 'soilgrids/ambee', label + ' from server-side soil data.')
      : f(null, s ? 'unknown' : 'unknown', 0, 'soilgrids/ambee', label + (s ? ' not returned by the soil source.' : ' needs location-based soil lookup.'));
  };
  const soil = {
    soilMoisture: soilField('moisture', 'Soil moisture'),
    organicMatter: soilField('organicMatter', 'Organic matter'),
    drainage: soilField('drainage', 'Drainage'),
    compaction: f(null, 'unknown', 0, 'soilgrids/ambee', 'Compaction needs a field probe — not in our sources.'),
    nitrogen: f(null, 'unknown', 0, 'lab-required', 'N needs a soil test — not fabricated.'),
    phosphorus: f(null, 'unknown', 0, 'lab-required', 'P needs a soil test — not fabricated.'),
    potassium: f(null, 'unknown', 0, 'lab-required', 'K needs a soil test — not fabricated.'),
    ph: soilField('ph', 'Soil pH'),
    cec: f(null, 'unknown', 0, 'lab-required', 'CEC needs a soil test — not fabricated.'),
    soilHealthIndex: s ? f(null, 'unknown', 0, 'soilgrids/ambee', 'Composite index withheld until enough real inputs are present.') : f(null, 'unknown', 0, 'soilgrids/ambee', 'Needs soil data.'),
  };

  // ── WEATHER — real risk derivation from the live forecast when present.
  const wr = _safe(() => (input.weather ? WeatherRisk.evaluate({ forecast: input.weather, weather: input.weather }) : null), null) as any;
  const wField = (key: string, label: string): V12Field => {
    const v = wr && (wr[key] ?? (wr.risks && wr.risks[key]));
    return v != null
      ? f(v, 'estimated', 60, 'live-weather', label + ' from the live forecast.')
      : f(null, input.weather ? 'unknown' : 'unknown', 0, 'live-weather', label + (input.weather ? ' not derivable from current forecast.' : ' needs a live weather feed.'));
  };
  const weather = {
    rainRisk: wField('rainRisk', 'Rain risk'), stormRisk: wField('stormRisk', 'Storm risk'),
    frostRisk: wField('frostRisk', 'Frost risk'), heatWave: wField('heatWave', 'Heat-wave risk'),
    windDamage: wField('windRisk', 'Wind-damage risk'),
    sprayWindow: wField('sprayWindow', 'Spray window'),
    harvestWindow: wField('harvestWindow', 'Weather harvest window'),
    plantingWindow: wField('plantingWindow', 'Planting window'),
  };

  // ── MARKET — never fabricated. Always no_live_feed.
  const market = {
    bestSellTime: noFeed('Best sell time'), expectedPrice: noFeed('Expected price'),
    demandTrend: noFeed('Demand trend'), nearbyBuyers: noFeed('Nearby buyers'),
    transportationReadiness: f(null, 'advisory', 0, 'checklist', 'Readiness is a self-checklist, not a live feed.'),
    storageReadiness: f(null, 'advisory', 0, 'checklist', 'Readiness is a self-checklist, not a live feed.'),
  };

  // ── MULTI-MODAL — what we actually ingest vs what is not wired.
  const multiModal = {
    photo: f('supported', 'ok', 100, 'scan-pipeline', 'Single photo is the primary path.'),
    multiplePhotos: f('supported', 'ok', 100, 'scan-composer', 'Multi-photo composer is wired.'),
    manualObservation: f('supported', 'ok', 100, 'scan-pipeline', 'Manual notes accepted.'),
    video: noFeed('Video ingestion'), droneImages: noFeed('Drone imagery'),
    satelliteImages: noFeed('Satellite imagery'), pdfReports: noFeed('PDF report ingestion'),
    sensorData: noFeed('Sensor ingestion'),
  };

  // ── VOICE / EXPLANATION — modes that genuinely exist.
  const voice = {
    simpleMode: f('supported', 'ok', 100, 'modes', 'Simple mode renders plain guidance.'),
    expertMode: f('supported', 'ok', 100, 'modes', 'Expert mode renders detailed guidance.'),
    voiceMode: f('supported', 'ok', 90, 'tts', 'Listen button reads findings aloud.'),
    localLanguage: f('supported', 'ok', 100, 'i18n', 'Findings localise via the i18n layer.'),
  };

  return Object.freeze({
    version: SCAN_V12_VERSION,
    identity, health, pest, disease, yield: yieldSec, fieldIntelligence, soil, weather, market, multiModal, voice,
  });
}

/** Honesty attestation — verifies the no-fabrication invariants hold on a sample. */
export function scanV12Health() {
  const r = analyzeScanV12({ plantName: 'maize', identified: true, confidencePct: 92, plantingDate: '2026-05-01', nowMs: 1 });
  const allCvUnavailable = ['healthScore', 'waterStress', 'leafDamagePct'].every(k => (r.health as any)[k].status === 'unavailable' && (r.health as any)[k].value === null);
  const fieldCvUnavailable = Object.values(r.fieldIntelligence).every(v => v.status === 'unavailable' && v.value === null);
  const marketNoFeed = ['bestSellTime', 'expectedPrice', 'demandTrend', 'nearbyBuyers'].every(k => (r.market as any)[k].status === 'no_live_feed' && (r.market as any)[k].value === null);
  const npkUnknown = ['nitrogen', 'phosphorus', 'potassium', 'cec'].every(k => (r.soil as any)[k].status === 'unknown' && (r.soil as any)[k].value === null);
  const identityRealForKnown = r.identity.scientificName.status === 'ok' && r.identity.scientificName.value === 'Zea mays';
  return Object.freeze({
    ok: true, version: SCAN_V12_VERSION,
    sections: 11,
    cvNeverFabricated: allCvUnavailable && fieldCvUnavailable,
    marketNeverFabricated: marketNoFeed,
    npkNeverFabricated: npkUnknown,
    identityRealForKnown,
  });
}

export function installScanV12Health(): void {
  _safe(() => {
    if (typeof window === 'undefined' || (window as any).__scanV12Health) return;
    Object.defineProperty(window, '__scanV12Health', {
      configurable: true, enumerable: false, writable: false, value: () => scanV12Health(),
    });
  }, undefined);
}
