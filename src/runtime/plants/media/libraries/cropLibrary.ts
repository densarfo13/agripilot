/**
 * src/runtime/plants/media/libraries/cropLibrary.ts — Launch
 * dataset of verified crop photography references (10 entries).
 *
 * Cloudinary path: plants/crops/<slug>
 */

export const CROP_LIBRARY = Object.freeze([
  { plantId: 'maize',     slug: 'maize' },
  { plantId: 'rice',      slug: 'rice' },
  { plantId: 'cassava',   slug: 'cassava' },
  { plantId: 'soybean',   slug: 'soybean' },
  { plantId: 'wheat',     slug: 'wheat' },
  { plantId: 'sorghum',   slug: 'sorghum' },
  { plantId: 'groundnut', slug: 'groundnut' },
  { plantId: 'millet',    slug: 'millet' },
  { plantId: 'cotton',    slug: 'cotton' },
  { plantId: 'sugarcane', slug: 'sugarcane' },
] as const);

export const CROP_LIBRARY_VERSION = 'crop-library-v1';
