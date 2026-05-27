/**
 * farmContinuityIntelligence.test.js — Farm Continuity Intelligence
 * Upgrade regression suite.
 *
 * Covers spec §1-§13:
 *   • farmContinuityLocationEngine 5-tier priority
 *   • weatherConfidenceEngine bands
 *   • locationDriftSuppressor debounce + threshold
 *   • farmBoundaryReadiness probe
 *   • satellite readiness flags
 *   • offline cache continuity
 */

import { describe, it, expect } from 'vitest';

import {
  resolveActiveLocation, LOCATION_PRIORITY,
} from '../../../src/core/location/farmContinuityLocationEngine.js';
import {
  classifyWeatherConfidence, WEATHER_CONFIDENCE,
} from '../../../src/core/weather/weatherConfidenceEngine.js';
import {
  suppressLocationDrift, shouldRegenerateForLocation,
} from '../../../src/core/location/locationDriftSuppressor.js';
import {
  assessFarmBoundary,
} from '../../../src/core/location/farmBoundaryReadiness.js';
import {
  probeSatelliteReadiness, registerSatelliteProvider,
  isSatelliteProviderAvailable,
} from '../../../src/core/satellite/satelliteEnrichmentAdapter.js';

// ═══ §1 farmContinuityLocationEngine — priority cascade ═════

describe('resolveActiveLocation', () => {
  it('empty input → NONE + low confidence + fallback', () => {
    const v = resolveActiveLocation({});
    expect(v.locationSource).toBe(LOCATION_PRIORITY.NONE);
    expect(v.confidence).toBe('low');
    expect(v.fallbackUsed).toBe(true);
    expect(v.activeLocation).toBeNull();
  });

  it('explicitFarmCoordinates wins over everything', () => {
    const v = resolveActiveLocation({
      explicitFarmCoordinates: { lat: 40, lng: -75 },
      lastVerifiedFarmCoordinates: { lat: 41, lng: -76 },
      cachedFarmCoordinates: { lat: 42, lng: -77 },
      deviceLocation: { lat: 43, lng: -78 },
      regionFallback: { lat: 44, lng: -79 },
    });
    expect(v.locationSource).toBe(LOCATION_PRIORITY.EXPLICIT_FARM);
    expect(v.confidence).toBe('high');
    expect(v.fallbackUsed).toBe(false);
    expect(v.activeLocation.lat).toBe(40);
  });

  it('lastVerifiedFarmCoordinates beats cached + device + region', () => {
    const v = resolveActiveLocation({
      lastVerifiedFarmCoordinates: { lat: 41, lng: -76 },
      cachedFarmCoordinates: { lat: 42, lng: -77 },
      deviceLocation: { lat: 43, lng: -78 },
    });
    expect(v.locationSource).toBe(LOCATION_PRIORITY.LAST_VERIFIED_FARM);
    expect(v.confidence).toBe('high');
  });

  it('cachedFarmCoordinates beats device + region', () => {
    const v = resolveActiveLocation({
      cachedFarmCoordinates: { lat: 42, lng: -77 },
      deviceLocation: { lat: 43, lng: -78 },
    });
    expect(v.locationSource).toBe(LOCATION_PRIORITY.CACHED_FARM);
    expect(v.confidence).toBe('medium');
  });

  it('deviceLocation only as last resort', () => {
    const v = resolveActiveLocation({
      deviceLocation: { lat: 43, lng: -78 },
    });
    expect(v.locationSource).toBe(LOCATION_PRIORITY.DEVICE_LOCATION);
    expect(v.confidence).toBe('medium');
  });

  it('regionFallback is the bottom of the ladder', () => {
    const v = resolveActiveLocation({
      regionFallback: { lat: 44, lng: -79 },
    });
    expect(v.locationSource).toBe(LOCATION_PRIORITY.REGION_FALLBACK);
    expect(v.confidence).toBe('low');
    expect(v.fallbackUsed).toBe(true);
  });

  it('away-from-farm fires when device > 5 mi from farm anchor', () => {
    const v = resolveActiveLocation({
      explicitFarmCoordinates: { lat: 40.7128, lng: -74.0060 },
      deviceLocation: { lat: 41.0, lng: -74.0060 }, // ~20 mi
    });
    expect(v.isAwayFromFarm).toBe(true);
    expect(v.distanceFromFarm).toBeGreaterThan(5);
  });

  it('away-from-farm false when device within 5 mi', () => {
    const v = resolveActiveLocation({
      explicitFarmCoordinates: { lat: 40.7128, lng: -74.0060 },
      deviceLocation: { lat: 40.7563, lng: -74.0060 }, // ~3 mi
    });
    expect(v.isAwayFromFarm).toBe(false);
  });

  it('garbage never throws', () => {
    expect(() => resolveActiveLocation(null)).not.toThrow();
    expect(() => resolveActiveLocation('hi')).not.toThrow();
  });
});

// ═══ §3 weatherConfidenceEngine ═════════════════════════════

describe('classifyWeatherConfidence', () => {
  it('fresh exact farm coords → EXACT_FARM', () => {
    const v = classifyWeatherConfidence({
      hasExactFarmCoords: true,
      fetchedAt: Date.now() - (10 * 60 * 1000),
      coordinatesUsed: { lat: 40, lng: -75 },
    });
    expect(v.weatherConfidence).toBe(WEATHER_CONFIDENCE.EXACT_FARM);
    expect(v.fallbackUsed).toBe(false);
  });

  it('stale exact coords → STALE_FALLBACK', () => {
    const v = classifyWeatherConfidence({
      hasExactFarmCoords: true,
      fetchedAt: Date.now() - (3 * 60 * 60 * 1000),
    });
    expect(v.weatherConfidence).toBe(WEATHER_CONFIDENCE.STALE_FALLBACK);
  });

  it('fromCache + fresh → CACHED_WEATHER', () => {
    const v = classifyWeatherConfidence({
      hasExactFarmCoords: true,
      fromCache: true,
      fetchedAt: Date.now() - (30 * 60 * 1000),
    });
    expect(v.weatherConfidence).toBe(WEATHER_CONFIDENCE.CACHED_WEATHER);
  });

  it('region-only + fresh → VERIFIED_REGION', () => {
    const v = classifyWeatherConfidence({
      hasRegionOnly: true,
      fetchedAt: Date.now() - (10 * 60 * 1000),
    });
    expect(v.weatherConfidence).toBe(WEATHER_CONFIDENCE.VERIFIED_REGION);
  });

  it('region-only + old → ESTIMATED_REGION', () => {
    const v = classifyWeatherConfidence({
      hasRegionOnly: true,
      fetchedAt: Date.now() - (90 * 60 * 1000),
    });
    expect(v.weatherConfidence).toBe(WEATHER_CONFIDENCE.ESTIMATED_REGION);
  });

  it('no signals → STALE_FALLBACK', () => {
    const v = classifyWeatherConfidence({});
    expect(v.weatherConfidence).toBe(WEATHER_CONFIDENCE.STALE_FALLBACK);
  });

  it('garbage never throws', () => {
    expect(() => classifyWeatherConfidence(null)).not.toThrow();
  });

  it('staleMinutes returns null when fetchedAt missing', () => {
    expect(classifyWeatherConfidence({}).staleMinutes).toBeNull();
  });
});

// ═══ §4 locationDriftSuppressor ═════════════════════════════

describe('suppressLocationDrift', () => {
  it('first sample is accepted', () => {
    const v = suppressLocationDrift({
      nextLocation: { lat: 40, lng: -75 },
    });
    expect(v.accepted).toBe(true);
    expect(v.reason).toBe('first_sample');
  });

  it('below movement threshold → suppressed', () => {
    const v = suppressLocationDrift({
      prevLocation: { lat: 40, lng: -75, at: Date.now() - 60 * 60 * 1000 },
      nextLocation: { lat: 40.001, lng: -75.001 },
    });
    expect(v.accepted).toBe(false);
    expect(v.reason).toBe('below_threshold');
  });

  it('too soon since last sample → suppressed', () => {
    const v = suppressLocationDrift({
      prevLocation: { lat: 40, lng: -75, at: Date.now() - 1000 },
      nextLocation: { lat: 41, lng: -75 },
    });
    expect(v.accepted).toBe(false);
    expect(v.reason).toBe('too_soon');
  });

  it('meaningful move + enough time → accepted', () => {
    const v = suppressLocationDrift({
      prevLocation: { lat: 40, lng: -75, at: Date.now() - 60 * 60 * 1000 },
      nextLocation: { lat: 41, lng: -75 },
    });
    expect(v.accepted).toBe(true);
    expect(v.reason).toBe('meaningful_move');
  });

  it('no nextLocation → no_change', () => {
    const v = suppressLocationDrift({});
    expect(v.accepted).toBe(false);
    expect(v.reason).toBe('no_change');
  });

  it('shouldRegenerateForLocation respects suppressor', () => {
    expect(shouldRegenerateForLocation({
      prevLocation: { lat: 40, lng: -75, at: Date.now() - 60 * 60 * 1000 },
      nextLocation: { lat: 40.0001, lng: -75.0001 },
    })).toBe(false);
    expect(shouldRegenerateForLocation({
      nextLocation: { lat: 40, lng: -75 },
    })).toBe(true);
  });

  it('garbage never throws', () => {
    expect(() => suppressLocationDrift(null)).not.toThrow();
    expect(() => shouldRegenerateForLocation(null)).not.toThrow();
  });
});

// ═══ §5 farmBoundaryReadiness ═══════════════════════════════

describe('assessFarmBoundary', () => {
  it('valid polygon → boundaryReady', () => {
    const v = assessFarmBoundary({
      polygon: [
        { lat: 40.0, lng: -75.0 },
        { lat: 40.0, lng: -75.1 },
        { lat: 40.1, lng: -75.1 },
        { lat: 40.1, lng: -75.0 },
      ],
    });
    expect(v.boundaryReady).toBe(true);
    expect(v.polygonAvailable).toBe(true);
    expect(v.centroid).toBeTruthy();
    expect(v.acreageEstimate).toBeGreaterThan(0);
  });

  it('centroid + size → boundaryReady (no polygon)', () => {
    const v = assessFarmBoundary({
      lat: 40, lng: -75,
      sizeAcres: 5, sizeUnit: 'acres',
    });
    expect(v.boundaryReady).toBe(true);
    expect(v.polygonAvailable).toBe(false);
  });

  it('hectares converted to acres', () => {
    const v = assessFarmBoundary({
      lat: 40, lng: -75,
      sizeAcres: 1, sizeUnit: 'hectares',
    });
    expect(v.acreageEstimate).toBe(2); // 1 ha ≈ 2.47 acres → rounded
  });

  it('only centroid, no size → not ready', () => {
    const v = assessFarmBoundary({ lat: 40, lng: -75 });
    expect(v.boundaryReady).toBe(false);
  });

  it('empty input → safe envelope', () => {
    const v = assessFarmBoundary({});
    expect(v.boundaryReady).toBe(false);
    expect(v.satelliteReady).toBe(false);
  });

  it('satelliteReady requires both boundary + provider', () => {
    const noProvider = assessFarmBoundary({
      lat: 40, lng: -75, sizeAcres: 5,
      satelliteProviderAvailable: false,
    });
    expect(noProvider.satelliteReady).toBe(false);
    const withProvider = assessFarmBoundary({
      lat: 40, lng: -75, sizeAcres: 5,
      satelliteProviderAvailable: true,
    });
    expect(withProvider.satelliteReady).toBe(true);
  });

  it('garbage never throws', () => {
    expect(() => assessFarmBoundary(null)).not.toThrow();
    expect(() => assessFarmBoundary('hi')).not.toThrow();
  });
});

// ═══ §6 satellite readiness probe ═══════════════════════════

describe('probeSatelliteReadiness', () => {
  it('no provider + flag OFF → not eligible', () => {
    registerSatelliteProvider(null);
    const v = probeSatelliteReadiness({ farmBoundaryReady: true });
    expect(v.satelliteEligibility).toBe(false);
    expect(v.provider).toBeNull();
  });

  it('isSatelliteProviderAvailable reflects registration', () => {
    registerSatelliteProvider(null);
    expect(isSatelliteProviderAvailable()).toBe(false);
    registerSatelliteProvider(async () => ({}));
    expect(isSatelliteProviderAvailable()).toBe(true);
    registerSatelliteProvider(null);
  });

  it('garbage never throws', () => {
    expect(() => probeSatelliteReadiness(null)).not.toThrow();
  });

  it('reports both farmBoundaryReady passthrough + eligibility', () => {
    const v = probeSatelliteReadiness({ farmBoundaryReady: false });
    expect(v.farmBoundaryReady).toBe(false);
    expect(v.satelliteEligibility).toBe(false);
    expect(v.ndviReady).toBe(false);
    expect(v.moistureSignalReady).toBe(false);
  });
});

// ═══ End-to-end continuity ═══════════════════════════════════

describe('End-to-end farm continuity contract', () => {
  it('explicit farm coords + far device → guidance pins to farm', () => {
    const v = resolveActiveLocation({
      explicitFarmCoordinates: { lat: 40, lng: -75 },
      deviceLocation:          { lat: 50, lng: -85 }, // many miles away
    });
    expect(v.locationSource).toBe(LOCATION_PRIORITY.EXPLICIT_FARM);
    expect(v.isAwayFromFarm).toBe(true);
    // Active location pinned to FARM, not device.
    expect(v.activeLocation.lat).toBe(40);
  });

  it('cached farm survives offline → CACHED_FARM source', () => {
    const v = resolveActiveLocation({
      cachedFarmCoordinates: { lat: 40, lng: -75 },
    });
    expect(v.locationSource).toBe(LOCATION_PRIORITY.CACHED_FARM);
    expect(v.activeLocation.lat).toBe(40);
  });
});
