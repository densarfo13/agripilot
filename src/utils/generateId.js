/**
 * Shared UUID generation utility — single source of truth for all client-side ID generation.
 *
 * Preferred: crypto.randomUUID() (cryptographically random, available in modern browsers)
 * Fallback: timestamp + dual random strings (for older browsers without crypto API)
 *
 * Usage:
 *   import { generateUUID, generateOfflineId } from '../utils/generateId.js';
 *   const id = generateUUID();                    // → "550e8400-e29b-41d4-a716-446655440000"
 *   const offlineId = generateOfflineId('rec');    // → "offline-rec-550e8400-..."
 */

/**
 * Generate a UUID v4 string.
 * Uses crypto.randomUUID() where available; falls back to timestamp + random.
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: timestamp + two random segments for collision safety
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Generate a prefixed offline placeholder ID.
 * Format: "offline-{prefix}-{uuid}"
 * These are visually distinct from server UUIDs and replaced on sync.
 *
 * @param {string} [prefix='item'] — entity type prefix (e.g., 'rec', 'profile', 'update')
 * @returns {string}
 */
export function generateOfflineId(prefix = 'item') {
  return `offline-${prefix}-${generateUUID()}`;
}

/**
 * Check if an ID is an offline placeholder (not yet synced to server).
 * @param {string} id
 * @returns {boolean}
 */
export function isOfflineId(id) {
  return typeof id === 'string' && id.startsWith('offline-');
}
