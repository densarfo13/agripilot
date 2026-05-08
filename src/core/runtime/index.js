/**
 * src/core/runtime/index.js — barrel re-export for the safe runtime layer.
 *
 * Import the entire layer:
 *   import { SAFE_USER, safeArray, safeAsync } from '../core/runtime/index.js';
 *
 * Or import specific modules:
 *   import { SAFE_WEATHER } from '../core/runtime/safeDefaults.js';
 *   import { safeArray }    from '../core/runtime/validators.js';
 *   import { safeAsync }    from '../core/runtime/safeAsync.js';
 */
export * from './safeDefaults.js';
export * from './validators.js';
export * from './safeAsync.js';
export * from './logger.js';
