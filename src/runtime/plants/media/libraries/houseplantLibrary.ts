/**
 * src/runtime/plants/media/libraries/houseplantLibrary.ts —
 * Launch dataset of verified houseplant photography references
 * (8 entries).
 *
 * Cloudinary path: plants/houseplants/<slug>
 */

export const HOUSEPLANT_LIBRARY = Object.freeze([
  { plantId: 'monstera',          slug: 'monstera' },
  { plantId: 'snake-plant',       slug: 'snake-plant' },
  { plantId: 'pothos',            slug: 'pothos' },
  { plantId: 'peace-lily',        slug: 'peace-lily' },
  { plantId: 'zz-plant',          slug: 'zz-plant' },
  { plantId: 'rubber-plant',      slug: 'rubber-plant' },
  { plantId: 'spider-plant',      slug: 'spider-plant' },
  { plantId: 'fiddle-leaf-fig',   slug: 'fiddle-leaf-fig' },
] as const);

export const HOUSEPLANT_LIBRARY_VERSION = 'houseplant-library-v1';
