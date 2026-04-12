import crypto from 'crypto';

export function generateFarmerUuid() {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `FRM-${random}`;
}

export async function generateUniqueFarmerUuid(prisma, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const farmerUuid = generateFarmerUuid();

    const existing = await prisma.farmProfile.findUnique({
      where: { farmerUuid },
      select: { id: true },
    });

    if (!existing) return farmerUuid;
  }

  throw new Error('Unable to generate a unique farmer UUID');
}
