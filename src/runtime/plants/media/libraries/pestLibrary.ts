/**
 * src/runtime/plants/media/libraries/pestLibrary.ts — Launch
 * dataset of verified pest photography references (8 entries).
 *
 * Cloudinary path: plants/pests/<slug>
 */

export const PEST_LIBRARY = Object.freeze([
  { plantId: 'aphids',       slug: 'aphids' },
  { plantId: 'armyworm',     slug: 'armyworm' },
  { plantId: 'whitefly',     slug: 'whitefly' },
  { plantId: 'thrips',       slug: 'thrips' },
  { plantId: 'spider-mites', slug: 'spider-mites' },
  { plantId: 'scale',        slug: 'scale' },
  { plantId: 'mealybugs',    slug: 'mealybugs' },
  { plantId: 'beetles',      slug: 'beetles' },
] as const);

export const PEST_LIBRARY_VERSION = 'pest-library-v1';
