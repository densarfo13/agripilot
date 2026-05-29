/**
 * src/runtime/plants/media/libraries/herbLibrary.ts — Launch
 * dataset of verified herb photography references (8 entries).
 *
 * Cloudinary path: plants/herbs/<slug>
 */

export const HERB_LIBRARY = Object.freeze([
  { plantId: 'basil',    slug: 'basil' },
  { plantId: 'mint',     slug: 'mint' },
  { plantId: 'rosemary', slug: 'rosemary' },
  { plantId: 'thyme',    slug: 'thyme' },
  { plantId: 'sage',     slug: 'sage' },
  { plantId: 'oregano',  slug: 'oregano' },
  { plantId: 'parsley',  slug: 'parsley' },
  { plantId: 'cilantro', slug: 'cilantro' },
] as const);

export const HERB_LIBRARY_VERSION = 'herb-library-v1';
