/**
 * src/runtime/plants/media/libraries/pestLibrary.ts — Launch
 * dataset of verified pest photography references (15 entries).
 *
 * Cloudinary path: plants/pests/<slug>
 */

export const PEST_LIBRARY = Object.freeze([
  { plantId: 'aphids',              slug: 'aphids' },
  { plantId: 'armyworm',            slug: 'armyworm' },
  { plantId: 'whitefly',            slug: 'whitefly' },
  { plantId: 'thrips',              slug: 'thrips' },
  { plantId: 'spider-mites',        slug: 'spider-mites' },
  { plantId: 'scale',               slug: 'scale' },
  { plantId: 'mealybugs',           slug: 'mealybugs' },
  { plantId: 'beetles',             slug: 'beetles' },
  { plantId: 'caterpillars',        slug: 'caterpillars' },
  { plantId: 'leaf-miners',         slug: 'leaf-miners' },
  { plantId: 'fruit-flies',         slug: 'fruit-flies' },
  { plantId: 'snails-and-slugs',    slug: 'snails-and-slugs' },
  { plantId: 'root-knot-nematodes', slug: 'root-knot-nematodes' },
  { plantId: 'weevils',             slug: 'weevils' },
  { plantId: 'grasshoppers',        slug: 'grasshoppers' },
] as const);

export const PEST_LIBRARY_VERSION = 'pest-library-v2';
