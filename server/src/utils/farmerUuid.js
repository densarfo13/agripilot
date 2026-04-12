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

/**
 * Generate a farmerUuid with collision retry.
 * Checks DB uniqueness before returning. Retries up to maxAttempts times.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number} maxAttempts
 */
export async function generateUniqueFarmerUuid(prisma, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const farmerUuid = generateFarmerUuid();
    const existing = await prisma.farmProfile.findUnique({
      where: { farmerUuid },
      select: { id: true },
    });
    if (!existing) return farmerUuid;
  }
  throw new Error('Unable to generate unique farmer UUID after ' + maxAttempts + ' attempts');
}
