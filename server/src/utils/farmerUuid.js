import crypto from 'crypto';

/**
 * Generate a unique, human-readable farmer UUID.
 * Format: FRM-XXXXXXXXXXXX (12 uppercase hex chars).
 * Generated once on first profile creation, never regenerated.
 */
export function generateFarmerUuid() {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `FRM-${random}`;
}
