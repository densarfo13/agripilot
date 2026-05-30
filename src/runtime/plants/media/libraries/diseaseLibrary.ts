/**
 * src/runtime/plants/media/libraries/diseaseLibrary.ts — Launch
 * dataset of verified disease photography references (8 entries).
 *
 * Cloudinary path: plants/diseases/<slug>
 *
 * `plantId` here is the disease slug; the gallery service joins
 * scan diagnostic detections to these entries by that slug.
 */

export const DISEASE_LIBRARY = Object.freeze([
  { plantId: 'leaf-spot',       slug: 'leaf-spot' },
  { plantId: 'powdery-mildew',  slug: 'powdery-mildew' },
  { plantId: 'early-blight',    slug: 'early-blight' },
  { plantId: 'late-blight',     slug: 'late-blight' },
  { plantId: 'rust',            slug: 'rust' },
  { plantId: 'wilt',            slug: 'wilt' },
  { plantId: 'root-rot',        slug: 'root-rot' },
  { plantId: 'anthracnose',     slug: 'anthracnose' },
  { plantId: 'black-spot',      slug: 'black-spot' },
  { plantId: 'downy-mildew',    slug: 'downy-mildew' },
  { plantId: 'fusarium-wilt',   slug: 'fusarium-wilt' },
  { plantId: 'mosaic-virus',    slug: 'mosaic-virus' },
  { plantId: 'fire-blight',     slug: 'fire-blight' },
  { plantId: 'sooty-mold',      slug: 'sooty-mold' },
  { plantId: 'clubroot',        slug: 'clubroot' },
] as const);

export const DISEASE_LIBRARY_VERSION = 'disease-library-v1';
