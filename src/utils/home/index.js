/**
 * home/index.js — single import surface for the Home layer.
 *
 *   import {
 *     buildWelcomeMessage,
 *     resolveHomeDisplayMode,
 *     buildProgressLine,
 *     buildHomePayload,
 *     runHomeDevAssertions,
 *   } from '@/utils/home';
 */

export { buildWelcomeMessage } from './buildWelcomeMessage.js';
export { resolveHomeDisplayMode } from './resolveHomeDisplayMode.js';
export { buildProgressLine } from './buildProgressLine.js';
export { buildHomePayload } from './buildHomePayload.js';
export { runHomeDevAssertions } from './homeDevAssertions.js';
