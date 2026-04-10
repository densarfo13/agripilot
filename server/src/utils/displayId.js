/**
 * Human-readable display ID generator.
 *
 * Generates short, admin-friendly reference codes from internal UUIDs.
 * These are for display/communication only — the internal UUID remains the source of truth.
 *
 * Format: {PREFIX}-{6-char uppercase hex from UUID}
 * Examples:
 *   FAR-A1B2C3   (farmer)
 *   FRM-D4E5F6   (farm profile)
 *   UPD-789ABC   (season progress entry / update)
 *   VAL-DEF012   (officer validation)
 *   INV-345678   (invite)
 *   ORG-9ABCDE   (organization)
 *   ASG-F01234   (review assignment)
 *   SEA-567890   (farm season)
 *
 * Collision probability: 6 hex chars = 16^6 = ~16.7M possibilities per prefix.
 * For pilot use (<10k records per entity), collision risk is negligible.
 * If collision matters in production, extend to 8 chars.
 */

const PREFIXES = {
  user:           'USR',
  farmer:         'FAR',
  farmProfile:    'FRM',
  season:         'SEA',
  progressEntry:  'UPD',
  evidenceFile:   'FIL',
  validation:     'VAL',
  invite:         'INV',
  organization:   'ORG',
  assignment:     'ASG',
  application:    'APP',
  referral:       'REF',
};

/**
 * Generate a display ID from an internal UUID.
 *
 * @param {string} entityType — one of the PREFIXES keys (e.g., 'farmer', 'farmProfile')
 * @param {string} uuid — the internal UUID
 * @returns {string} — e.g., "FAR-A1B2C3"
 */
export function toDisplayId(entityType, uuid) {
  const prefix = PREFIXES[entityType] || entityType.slice(0, 3).toUpperCase();
  if (!uuid || typeof uuid !== 'string') return `${prefix}-??????`;
  // Extract 6 hex characters from the UUID (skip the first segment which may have low entropy in some generators)
  const hex = uuid.replace(/-/g, '').slice(4, 10).toUpperCase();
  return `${prefix}-${hex || '??????'}`;
}

/**
 * Get the prefix for an entity type.
 * @param {string} entityType
 * @returns {string}
 */
export function getDisplayPrefix(entityType) {
  return PREFIXES[entityType] || entityType.slice(0, 3).toUpperCase();
}

/**
 * Parse a display ID back to its prefix and hex segment.
 * Useful for admin search: user types "FAR-A1B2C3" → search farmers where id contains 'a1b2c3'.
 *
 * @param {string} displayId — e.g., "FAR-A1B2C3"
 * @returns {{ prefix: string, hex: string } | null}
 */
export function parseDisplayId(displayId) {
  if (!displayId || typeof displayId !== 'string') return null;
  const match = displayId.match(/^([A-Z]{3})-([A-F0-9]{6})$/i);
  if (!match) return null;
  return { prefix: match[1].toUpperCase(), hex: match[2].toLowerCase() };
}

export { PREFIXES };
