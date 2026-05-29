/**
 * src/runtime/plants/media/libraries/vegetableLibrary.ts —
 * Launch dataset of verified vegetable photography references
 * (10 entries).
 *
 * Cloudinary path: plants/vegetables/<slug>
 */

export const VEGETABLE_LIBRARY = Object.freeze([
  { plantId: 'tomato',   slug: 'tomato' },
  { plantId: 'pepper',   slug: 'pepper' },
  { plantId: 'cucumber', slug: 'cucumber' },
  { plantId: 'lettuce',  slug: 'lettuce' },
  { plantId: 'spinach',  slug: 'spinach' },
  { plantId: 'cabbage',  slug: 'cabbage' },
  { plantId: 'onion',    slug: 'onion' },
  { plantId: 'carrot',   slug: 'carrot' },
  { plantId: 'kale',     slug: 'kale' },
  { plantId: 'broccoli', slug: 'broccoli' },
] as const);

export const VEGETABLE_LIBRARY_VERSION = 'vegetable-library-v1';
