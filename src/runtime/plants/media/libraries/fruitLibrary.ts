/**
 * src/runtime/plants/media/libraries/fruitLibrary.ts — Launch
 * dataset of verified fruit photography references (10 entries).
 *
 * Cloudinary path: plants/fruits/<slug>
 */

export const FRUIT_LIBRARY = Object.freeze([
  { plantId: 'mango',      slug: 'mango' },
  { plantId: 'apple',      slug: 'apple' },
  { plantId: 'banana',     slug: 'banana' },
  { plantId: 'orange',     slug: 'orange' },
  { plantId: 'lemon',      slug: 'lemon' },
  { plantId: 'lime',       slug: 'lime' },
  { plantId: 'avocado',    slug: 'avocado' },
  { plantId: 'strawberry', slug: 'strawberry' },
  { plantId: 'blueberry',  slug: 'blueberry' },
  { plantId: 'pineapple',  slug: 'pineapple' },
] as const);

export const FRUIT_LIBRARY_VERSION = 'fruit-library-v1';
