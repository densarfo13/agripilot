/**
 * src/runtime/plants/media/libraries/cropLibrary.ts — Launch
 * dataset of verified crop photography references (16 entries).
 *
 * Wave-41-hardening — added 6 priority crops referenced by the
 * regional knowledge packs (Ghana, Nigeria, Kenya):
 *   plantain, yam, cocoa, cowpea, beans, coffee
 *
 * Cloudinary path: plants/crops/<slug>
 *
 * Update protocol:
 *   1. Upload <slug>.jpg to Cloudinary at `plants/crops/<slug>`.
 *   2. Add the row here.
 *   3. CI gate `check:plant-media-system` enforces the count.
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
  // Wave-41-hardening additions — regional pack priority crops.
  { plantId: 'plantain',  slug: 'plantain' },
  { plantId: 'yam',       slug: 'yam' },
  { plantId: 'cocoa',     slug: 'cocoa' },
  { plantId: 'cowpea',    slug: 'cowpea' },
  { plantId: 'beans',     slug: 'beans' },
  { plantId: 'coffee',    slug: 'coffee' },
] as const);

export const CROP_LIBRARY_VERSION = 'crop-library-v2';
