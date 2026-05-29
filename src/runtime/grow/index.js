/**
 * runtime/grow/index.js — Phase 1-15 grow-platform composite.
 *
 *   import {
 *     gardenPlatform,
 *     installGardenPlatformGlobal,
 *     GARDEN_PLATFORM_VERSION,
 *   } from 'src/runtime/grow/index.js';
 *
 * What this is
 * ────────────
 *   Single chokepoint for the 15-phase grow-platform engines.
 *   Runs them all over a caller-injected context + plant DB and
 *   returns one frozen envelope so the UI / QA can introspect
 *   every grow-platform state from one spot.
 *
 *   The wave-5 single-writer invariant is preserved — engines
 *   take signals in; they never write to persistence.
 *
 *   Composition-only. Garden mode is OPT-IN — Farm mode is
 *   unchanged when growType is 'crop' or unset.
 */

import {
  GROW_TYPES, GROW_TYPE_ICONS, GROW_TYPE_LABEL_KEY,
  GROW_TYPE_LABEL_DEFAULT, isGrowType, GROW_TYPES_VERSION,
} from '../../types/growTypes';
import {
  PLANT_DB, PLANT_DB_STATS, PLANT_DB_VERSION,
  findPlant, searchPlants, plantsByType,
} from '../../data/plants/index.js';
import { flowerAdvisor, FLOWER_ADVISOR_VERSION }
  from './flowerAdvisor';
import {
  companionAdvice, suggestCompanionsForGarden,
  COMPANION_ENGINE_VERSION,
} from './companionEngine';
import {
  pollinatorScore, POLLINATOR_ENGINE_VERSION, POLLINATOR_CATEGORIES,
} from './pollinatorEngine';
import {
  tagScanWithGrowType, SCAN_GROW_TYPE_VERSION, SUPPORTED_GROW_TYPES,
} from './scanGrowType.js';
import {
  resolveGardenMode, GARDEN_LABEL_MAP, GARDEN_MODE_VERSION,
} from './gardenMode.js';
import {
  composeIndoorCare, computeIndoorHealthScore,
  INDOOR_PLANT_CARE_VERSION,
} from './indoorPlantCare.js';
import {
  flowerMarketplaceState, FLOWER_MARKETPLACE_VERSION,
  FLOWER_MARKETPLACE_CATEGORIES, FLOWER_BUYER_CHANNELS,
} from './flowerMarketplaceGate.js';
import {
  composeDiscoverFeed, DISCOVER_FEED_VERSION,
} from './discoverFeed.js';
import {
  plantLibrary, plantLibrarySearch, PLANT_LIBRARY_VERSION,
} from './plantLibrary.js';
import {
  aiPlantAssistant, AI_PLANT_ASSISTANT_VERSION,
} from './aiPlantAssistant.js';
import {
  composeGardenDashboard, GARDEN_DASHBOARD_VERSION,
} from './gardenDashboard.js';
import {
  resolveActiveGarden, GARDEN_KINDS, MULTI_GARDEN_VERSION,
  GARDEN_KIND_LABELS,
} from './multiGarden.js';

export const GARDEN_PLATFORM_VERSION = 'garden-platform-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _now   = () => _safe(() => new Date().toISOString(), '');

/**
 * @param {{
 *   now?: number,
 *   growType?: string,
 *   gardens?: Array, activeGardenId?: string,
 *   plants?: Array,                  // [{id} | id]
 *   focusPlantId?: string,
 *   weather?: object,
 *   season?: string,
 *   region?: string,
 *   scanResult?: object,
 *   lastWateredAt?: string, lastFertilizedAt?: string,
 *   lastRepottedAt?: string,
 *   ambient?: { humidity?: number, lightLevel?: string },
 *   healthScores?: Array, bloomScores?: Array,
 *   discoverLimit?: number,
 *   marketplaceCtx?: object,
 *   assistantQuestion?: string,
 * }} ctx
 */
export function gardenPlatform(ctx) {
  const c = _isObj(ctx) ? ctx : {};

  const gardenMode = _safe(() => resolveGardenMode({
    growType: c.growType, modeOverride: c.modeOverride,
  }), null);

  const activeGarden = _safe(() => resolveActiveGarden({
    gardens: c.gardens, activeGardenId: c.activeGardenId,
  }), null);

  // Per-plant signals require a focus plant — otherwise the
  // composite skips them and the UI shows aggregates only.
  const focus = _str(c.focusPlantId);
  const flowerAdvice = focus ? _safe(() => flowerAdvisor({
    plantId: focus, weather: c.weather, season: c.season,
    lastWateredAt: c.lastWateredAt, lastFertilizedAt: c.lastFertilizedAt,
    now: c.now,
  }), null) : null;

  const companions = focus ? _safe(() => companionAdvice({
    plantId: focus,
    haveInGarden: _arr(c.plants).map((p) => _isObj(p) ? p.id : p),
  }), null) : null;

  const pollinator = _safe(() => pollinatorScore({
    plantIds: _arr(c.plants).map((p) => _isObj(p) ? p.id : p),
  }), null);

  const scan = c.scanResult ? _safe(() => tagScanWithGrowType({
    scanResult: c.scanResult, plantHint: c.scanPlantHint,
  }), null) : null;

  const indoorCare = (focus && _str(c.growType) === 'houseplant')
    ? _safe(() => composeIndoorCare({
        plantId: focus, lastWateredAt: c.lastWateredAt,
        lastRepottedAt: c.lastRepottedAt, ambient: c.ambient,
        now: c.now,
      }), null)
    : null;

  const marketplace = _safe(() => flowerMarketplaceState(
    _isObj(c.marketplaceCtx) ? c.marketplaceCtx : {}), null);

  const discoverFeed = _safe(() => composeDiscoverFeed({
    region: c.region, season: c.season, weather: c.weather,
    growType: c.growType,
    gardenPlants: _arr(c.plants).map((p) => _isObj(p) ? p.id : p),
    limit: c.discoverLimit,
  }), null);

  const library = _safe(() => plantLibrary({
    type: c.libraryType, limit: c.libraryLimit, offset: c.libraryOffset,
  }), null);

  const assistant = _str(c.assistantQuestion) ? _safe(() => aiPlantAssistant({
    question: c.assistantQuestion,
  }), null) : null;

  const dashboard = _safe(() => composeGardenDashboard({
    plants: c.plants,
    healthScores: c.healthScores,
    bloomScores: c.bloomScores,
  }), null);

  return Object.freeze({
    runtimeVersion: GARDEN_PLATFORM_VERSION,
    generatedAt:    _now(),
    growType:       _str(c.growType) || 'crop',
    growTypeIcon:   GROW_TYPE_ICONS[_str(c.growType)] || '🌾',
    gardenMode,
    activeGarden,
    flowerAdvice,
    companions,
    pollinator,
    scan,
    indoorCare,
    marketplace,
    discoverFeed,
    library,
    assistant,
    dashboard,
    versions: Object.freeze({
      growTypes:           GROW_TYPES_VERSION,
      plantDb:             PLANT_DB_VERSION,
      flowerAdvisor:       FLOWER_ADVISOR_VERSION,
      companionEngine:     COMPANION_ENGINE_VERSION,
      pollinatorEngine:    POLLINATOR_ENGINE_VERSION,
      scanGrowType:        SCAN_GROW_TYPE_VERSION,
      gardenMode:          GARDEN_MODE_VERSION,
      indoorPlantCare:     INDOOR_PLANT_CARE_VERSION,
      flowerMarketplace:   FLOWER_MARKETPLACE_VERSION,
      discoverFeed:        DISCOVER_FEED_VERSION,
      plantLibrary:        PLANT_LIBRARY_VERSION,
      aiPlantAssistant:    AI_PLANT_ASSISTANT_VERSION,
      gardenDashboard:     GARDEN_DASHBOARD_VERSION,
      multiGarden:         MULTI_GARDEN_VERSION,
    }),
    deferred: Object.freeze({
      onboardingFlowSwap:
        'Phase 2 picker ships as a STANDALONE component '
        + '(GrowTypePicker.jsx); the existing OnboardingFlow is '
        + 'unchanged. "No breaking changes" rule requires opt-in '
        + 'integration.',
      flowerClassifier:
        'wave-1 scan pipeline tags grow type via plant-DB match; '
        + 'true flower / houseplant classifier requires expanded '
        + 'Plant.id coverage or a separate model',
      flowerMarketplaceUx:
        'marketplace flag gated OFF (wave-8 App Store safety mode); '
        + 'no UI ships for Sell Flowers in RC1',
      llmAssistant:
        'AI plant assistant is deterministic intent routing for '
        + 'honest confidence; LLM integration deferred',
      librarySize:
        'starter database ships 50 curated plants vs spec 9,500+ '
        + 'target — content-team backlog',
      gardenSwitchUi:
        'multi-garden state engine ships; switcher UI deferred',
    }),
  });
}

export function installGardenPlatformGlobal() {
  return _safe(() => {
    if (typeof window === 'undefined') return false;
    if (typeof window.__gardenPlatform === 'function') return true;
    window.__gardenPlatform = function (ctx) {
      const out = gardenPlatform(ctx || {});
      try { console.log('[Farroway · Garden Platform]', out); }
      catch { /* swallow */ }
      return out;
    };
    return true;
  }, false);
}

// Re-exports
export {
  GROW_TYPES, GROW_TYPE_ICONS, GROW_TYPE_LABEL_KEY,
  GROW_TYPE_LABEL_DEFAULT, isGrowType, GROW_TYPES_VERSION,
  PLANT_DB, PLANT_DB_STATS, PLANT_DB_VERSION,
  findPlant, searchPlants, plantsByType,
  flowerAdvisor, FLOWER_ADVISOR_VERSION,
  companionAdvice, suggestCompanionsForGarden, COMPANION_ENGINE_VERSION,
  pollinatorScore, POLLINATOR_ENGINE_VERSION, POLLINATOR_CATEGORIES,
  tagScanWithGrowType, SCAN_GROW_TYPE_VERSION, SUPPORTED_GROW_TYPES,
  resolveGardenMode, GARDEN_LABEL_MAP, GARDEN_MODE_VERSION,
  composeIndoorCare, computeIndoorHealthScore, INDOOR_PLANT_CARE_VERSION,
  flowerMarketplaceState, FLOWER_MARKETPLACE_VERSION,
  FLOWER_MARKETPLACE_CATEGORIES, FLOWER_BUYER_CHANNELS,
  composeDiscoverFeed, DISCOVER_FEED_VERSION,
  plantLibrary, plantLibrarySearch, PLANT_LIBRARY_VERSION,
  aiPlantAssistant, AI_PLANT_ASSISTANT_VERSION,
  composeGardenDashboard, GARDEN_DASHBOARD_VERSION,
  resolveActiveGarden, GARDEN_KINDS, MULTI_GARDEN_VERSION, GARDEN_KIND_LABELS,
};
