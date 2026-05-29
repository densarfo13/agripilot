/**
 * src/runtime/plants/media/libraries/flowerLibrary.ts — Launch
 * dataset of verified flower photography references (20 entries).
 *
 * Each row is `{ plantId, slug, attribution? }`. The registry
 * seeder composes the canonical Cloudinary URL via
 * PlantMediaService.buildMediaUrl('flowers', slug).
 *
 * Update protocol:
 *   1. Upload <slug>.jpg to Cloudinary at `plants/flowers/<slug>`.
 *   2. Add the row here.
 *   3. CI gate `check:plant-media-system` enforces the count.
 */

export const FLOWER_LIBRARY = Object.freeze([
  { plantId: 'rose',           slug: 'rose' },
  { plantId: 'lavender',       slug: 'lavender' },
  { plantId: 'hibiscus',       slug: 'hibiscus' },
  { plantId: 'sunflower',      slug: 'sunflower' },
  { plantId: 'marigold',       slug: 'marigold' },
  { plantId: 'tulip',          slug: 'tulip' },
  { plantId: 'orchid',         slug: 'orchid' },
  { plantId: 'daisy',          slug: 'daisy' },
  { plantId: 'hydrangea',      slug: 'hydrangea' },
  { plantId: 'petunia',        slug: 'petunia' },
  { plantId: 'begonia',        slug: 'begonia' },
  { plantId: 'dahlia',         slug: 'dahlia' },
  { plantId: 'chrysanthemum',  slug: 'chrysanthemum' },
  { plantId: 'jasmine',        slug: 'jasmine' },
  { plantId: 'bougainvillea',  slug: 'bougainvillea' },
  { plantId: 'zinnia',         slug: 'zinnia' },
  { plantId: 'geranium',       slug: 'geranium' },
  { plantId: 'peony',          slug: 'peony' },
  { plantId: 'camellia',       slug: 'camellia' },
  { plantId: 'azalea',         slug: 'azalea' },
] as const);

export const FLOWER_LIBRARY_VERSION = 'flower-library-v1';
