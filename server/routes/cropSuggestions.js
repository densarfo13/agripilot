import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

/**
 * Normalize a crop name for consistent storage.
 * "okra" → "Okra", "SWEET POTATO" → "Sweet Potato", "  teff " → "Teff"
 */
export function normalizeCropName(raw) {
  if (!raw) return '';
  return raw.trim().replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Extract display name from a crop code.
 * "MAIZE" → "Maize", "OTHER:Teff" → "Teff", "OTHER:finger millet" → "Finger Millet"
 */
export function extractCropName(cropCode) {
  if (!cropCode) return '';
  const upper = cropCode.toUpperCase().trim();
  if (upper.startsWith('OTHER:')) {
    return normalizeCropName(cropCode.slice(6));
  }
  // Standard code: title-case from underscored code
  return normalizeCropName(cropCode.replace(/_/g, ' '));
}

/**
 * Record a crop selection — called after successful profile save.
 * Upserts into crop_usage: increments count if exists, creates if new.
 */
export async function recordCropUsage(cropCode, country, region) {
  if (!cropCode || cropCode.toUpperCase() === 'OTHER') return;
  const name = extractCropName(cropCode);
  const normalizedCountry = country?.trim() || null;
  const normalizedRegion = region?.trim() || null;

  try {
    await prisma.cropUsage.upsert({
      where: {
        cropCode_country: {
          cropCode: cropCode,
          country: normalizedCountry ?? '',
        },
      },
      update: {
        useCount: { increment: 1 },
        lastUsedAt: new Date(),
        cropName: name,
        region: normalizedRegion || undefined,
      },
      create: {
        cropCode: cropCode,
        cropName: name,
        country: normalizedCountry ?? '',
        region: normalizedRegion,
        useCount: 1,
      },
    });
  } catch {
    // Non-blocking: crop usage tracking failure should never break profile save
  }
}

// ─── GET /api/v2/crop-suggestions ──────────────────────
// Returns learned crop usage data for a given country.
// Lightweight, cacheable, no auth required.
router.get('/', async (req, res) => {
  try {
    const country = req.query.country?.trim() || null;

    // Fetch top crops for this country (or global if no country)
    const where = country ? { country } : {};
    const crops = await prisma.cropUsage.findMany({
      where,
      orderBy: [{ useCount: 'desc' }, { lastUsedAt: 'desc' }],
      take: 30,
      select: {
        cropCode: true,
        cropName: true,
        country: true,
        useCount: true,
        lastUsedAt: true,
      },
    });

    // Also fetch global top crops (cross-country) for fallback
    let globalCrops = [];
    if (country) {
      globalCrops = await prisma.cropUsage.findMany({
        orderBy: [{ useCount: 'desc' }, { lastUsedAt: 'desc' }],
        take: 15,
        select: {
          cropCode: true,
          cropName: true,
          useCount: true,
        },
      });
    }

    // Deduplicate: merge global into country list (country takes priority)
    const seen = new Set(crops.map(c => c.cropCode));
    const merged = [...crops];
    for (const g of globalCrops) {
      if (!seen.has(g.cropCode)) {
        merged.push({ ...g, country: null });
        seen.add(g.cropCode);
      }
    }

    res.set('Cache-Control', 'public, max-age=300'); // cache 5 min
    return res.json({ success: true, crops: merged });
  } catch (error) {
    console.error('GET /api/v2/crop-suggestions failed:', error);
    return res.json({ success: true, crops: [] }); // fail open
  }
});

export default router;
