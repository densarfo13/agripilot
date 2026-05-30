/**
 * src/runtime/plants/media/libraries/vegetableLibrary.ts —
 * Launch dataset of verified vegetable photography references
 * (11 entries).
 *
 * Wave-41-hardening — added okra (Ghana priority crop referenced
 * by ghanaPriorityPack).
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
  // Wave-41-hardening addition — Ghana priority crop.
  { plantId: 'okra',     slug: 'okra' },
] as const);

export const VEGETABLE_LIBRARY_VERSION = 'vegetable-library-v2';
