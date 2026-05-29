/**
 * runtime/grow/discoverFeed.js — Phase 11 Discover Tab feed
 * composer.
 *
 *   import { composeDiscoverFeed, DISCOVER_FEED_VERSION }
 *     from 'src/runtime/grow/discoverFeed.js';
 *
 *   composeDiscoverFeed({ region, season, weather, gardenPlants })
 *   → { items: [...], runtimeVersion }
 *
 * What this is
 * ────────────
 *   Personalized feed of evergreen plant-knowledge cards. Pure
 *   compute from a static knowledge base, ranked by relevance
 *   to the caller's region / season / current garden.
 *
 *   Cards are deterministic — never AI-generated; the knowledge
 *   base is shipped with the bundle. No network calls.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No fetch, no AI.
 *   • All copy via tSafe envelopes.
 */

import { PLANT_DB, findPlant } from '../../data/plants/index.js';

export const DISCOVER_FEED_VERSION = 'discover-feed-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _arr   = (v) => (Array.isArray(v) ? v : []);
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

// Evergreen, factually grounded knowledge cards. Each card carries
// a topic tag the ranker uses to score relevance.
const KNOWLEDGE_BASE = Object.freeze([
  {
    id: 'attracts_hummingbirds',
    topic: 'pollinator',
    titleKey: 'grow.feed.attractsHummingbirds.title',
    titleDefault: 'Plants that attract hummingbirds',
    bodyKey: 'grow.feed.attractsHummingbirds.body',
    bodyDefault:
      'Salvia, hibiscus, and lavender attract hummingbirds. '
      + 'Plant them in full sun for the best results.',
    relatedPlantIds: ['salvia', 'hibiscus', 'lavender'],
    growTypes: ['flower', 'garden'],
  },
  {
    id: 'repels_mosquitoes',
    topic: 'pest_repel',
    titleKey: 'grow.feed.repelsMosquitoes.title',
    titleDefault: 'Plants that repel mosquitoes',
    bodyKey: 'grow.feed.repelsMosquitoes.body',
    bodyDefault:
      'Lavender, basil, mint, and rosemary repel mosquitoes when '
      + 'planted near gathering spots.',
    relatedPlantIds: ['lavender', 'basil', 'mint', 'rosemary'],
    growTypes: ['herb', 'flower', 'garden'],
  },
  {
    id: 'water_monstera',
    topic: 'indoor',
    titleKey: 'grow.feed.waterMonstera.title',
    titleDefault: 'How often to water Monstera',
    bodyKey: 'grow.feed.waterMonstera.body',
    bodyDefault:
      'Water Monstera roughly every 7 days when the top inch of '
      + 'soil is dry. Bright indirect light works best.',
    relatedPlantIds: ['monstera'],
    growTypes: ['houseplant'],
  },
  {
    id: 'best_for_pollinators',
    topic: 'pollinator',
    titleKey: 'grow.feed.bestForPollinators.title',
    titleDefault: 'Best flowers for pollinators',
    bodyKey: 'grow.feed.bestForPollinators.body',
    bodyDefault:
      'Sunflower, zinnia, marigold, and salvia draw bees and '
      + 'butterflies across the summer.',
    relatedPlantIds: ['sunflower', 'zinnia', 'marigold', 'salvia'],
    growTypes: ['flower', 'garden'],
  },
  {
    id: 'companions_tomato',
    topic: 'companion',
    titleKey: 'grow.feed.companionsTomato.title',
    titleDefault: 'Companion plants for tomatoes',
    bodyKey: 'grow.feed.companionsTomato.body',
    bodyDefault:
      'Basil, marigold, and onion grow well alongside tomatoes. '
      + 'Avoid potato and corn nearby.',
    relatedPlantIds: ['tomato', 'basil', 'marigold', 'onion'],
    growTypes: ['vegetable', 'garden'],
  },
  {
    id: 'low_water_garden',
    topic: 'drought',
    titleKey: 'grow.feed.lowWaterGarden.title',
    titleDefault: 'Low-water garden picks',
    bodyKey: 'grow.feed.lowWaterGarden.body',
    bodyDefault:
      'Lavender, rosemary, thyme, and salvia thrive on minimal '
      + 'watering once established.',
    relatedPlantIds: ['lavender', 'rosemary', 'thyme', 'salvia'],
    growTypes: ['herb', 'flower', 'garden'],
  },
  {
    id: 'low_light_indoor',
    topic: 'indoor',
    titleKey: 'grow.feed.lowLightIndoor.title',
    titleDefault: 'Indoor plants for low-light rooms',
    bodyKey: 'grow.feed.lowLightIndoor.body',
    bodyDefault:
      'Snake plant, ZZ plant, and pothos tolerate low light and '
      + 'forgiving watering schedules.',
    relatedPlantIds: ['snake_plant', 'zz_plant', 'pothos'],
    growTypes: ['houseplant'],
  },
  {
    id: 'rainy_season_disease',
    topic: 'disease',
    titleKey: 'grow.feed.rainyDisease.title',
    titleDefault: 'Wet-weather disease watch',
    bodyKey: 'grow.feed.rainyDisease.body',
    bodyDefault:
      'After rainfall, watch for powdery mildew and downy mildew '
      + 'on susceptible plants. Improve airflow when possible.',
    relatedPlantIds: ['rose', 'cucumber', 'tomato'],
    growTypes: ['flower', 'vegetable', 'fruit', 'garden'],
  },
]);

function _score(card, ctx) {
  let s = 0;
  // Garden plants — relatedness boost
  const garden = new Set(_arr(ctx.gardenPlants).map(_str));
  for (const id of _arr(card.relatedPlantIds)) {
    if (garden.has(id)) s += 5;
  }
  // Grow type match
  const gt = _str(ctx.growType);
  if (gt && _arr(card.growTypes).indexOf(gt) !== -1) s += 3;
  // Weather signals
  if (_isObj(ctx.weather)) {
    const wet = (typeof ctx.weather.recentRainfallMm === 'number'
                 && ctx.weather.recentRainfallMm >= 5);
    if (wet && card.topic === 'disease') s += 4;
    if (!wet && card.topic === 'drought') s += 2;
  }
  // Region — soft match by language presence (we don't geo here)
  // Indoors topic boost for houseplant gardens
  if (gt === 'houseplant' && card.topic === 'indoor') s += 4;
  return s;
}

export function composeDiscoverFeed(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const ranked = KNOWLEDGE_BASE
      .map((card) => ({ card, s: _score(card, c) }))
      .sort((a, b) => b.s - a.s);
    const limit = typeof c.limit === 'number' ? c.limit : 8;

    const items = ranked.slice(0, limit).map(({ card, s }) =>
      Object.freeze({
        id:           _str(card.id),
        topic:        _str(card.topic),
        titleKey:     _str(card.titleKey),
        titleDefault: _str(card.titleDefault),
        bodyKey:      _str(card.bodyKey),
        bodyDefault:  _str(card.bodyDefault),
        relevance:    s,
        relatedPlants: Object.freeze(_arr(card.relatedPlantIds)
          .map((id) => findPlant(id)).filter(Boolean)
          .map((p) => Object.freeze({
            id: _str(p.id), name: _str(p.name), type: _str(p.type),
          }))),
      }));

    return Object.freeze({
      runtimeVersion: DISCOVER_FEED_VERSION,
      items:          Object.freeze(items),
      kbSize:         KNOWLEDGE_BASE.length,
      poolSize:       PLANT_DB.length,
    });
  }, Object.freeze({
    runtimeVersion: DISCOVER_FEED_VERSION,
    items: Object.freeze([]), kbSize: 0, poolSize: 0,
  }));
}
