/**
 * environment/index.js — barrel export.
 *
 * The canonical entry-point for the dynamic weather environment
 * system. Use the named imports rather than reaching into the
 * individual modules so future re-organisation stays internal.
 *
 *   import {
 *     resolveScene,
 *     resolveLighting,
 *     regionEnvironment,
 *     resolveSeason,
 *     DynamicWeatherBackdrop,
 *   } from 'src/features/weather/environment';
 */

export { resolveScene }                     from './sceneResolver.js';
export { resolveLighting, LIGHTING_PHASES } from './lighting.js';
export { regionEnvironment,
         climateClusterFor,
         CLIMATE_CLUSTERS }                 from './region.js';
export { resolveSeason, SEASON_LIST }       from './season.js';
export { proceduralCanvas,
         PROCEDURAL_PHASES,
         PROCEDURAL_CLUSTERS }              from './procedural.js';
export { default as DynamicWeatherBackdrop } from './DynamicWeatherBackdrop.jsx';
