/**
 * fetch-crop-photos.mjs
 *
 * Downloads curated photographic crop images from Wikimedia Commons
 * (public-domain / CC-licensed, no API key required) and processes
 * them into the standard Farroway crop tile format:
 *   - 400 x 400 WebP
 *   - center-cropped square (cover fit)
 *   - quality 82, smartSubsample, effort 5
 *
 * Output: public/crops/{cropKey}.webp (overwrites existing files).
 *
 * Run:  node scripts/fetch-crop-photos.mjs
 *
 * Attribution: All source photos are from Wikimedia Commons under
 * CC BY-SA or public-domain licenses. Commit message includes the
 * full attribution list.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.resolve('public/crops');
const WIDTH = 400;
const HEIGHT = 400;

// Curated Wikimedia Commons photographic URLs — each one is a real
// photo (not a botanical illustration), checked for clean framing.
const SOURCES = {
  maize:          'https://upload.wikimedia.org/wikipedia/commons/7/79/VegCorn.jpg',
  rice:           'https://upload.wikimedia.org/wikipedia/commons/0/0a/20201102.Hengnan.Hybrid_rice_Sanyou-1.6.jpg',
  tomato:         'https://upload.wikimedia.org/wikipedia/commons/8/89/Tomato_je.jpg',
  cassava:        'https://upload.wikimedia.org/wikipedia/commons/8/8f/Manihot_esculenta_dsc07325.jpg',
  'sweet-potato': 'https://upload.wikimedia.org/wikipedia/commons/5/58/Ipomoea_batatas_006.JPG',
  groundnut:      'https://upload.wikimedia.org/wikipedia/commons/d/d7/Peanuts_in_their_shells.jpg',
  pepper:         'https://upload.wikimedia.org/wikipedia/commons/8/85/Green-Yellow-Red-Pepper-2009.jpg',
  onion:          'https://upload.wikimedia.org/wikipedia/commons/a/a2/Mixed_onions.jpg',
  okra:           'https://upload.wikimedia.org/wikipedia/commons/9/95/Hong_Kong_Okra_Aug_25_2012.JPG',
  potato:         'https://upload.wikimedia.org/wikipedia/commons/a/ab/Patates.jpg',
  yam:            'https://upload.wikimedia.org/wikipedia/commons/7/72/Yam_at_monday_market_kaduna_state_01.jpg',
  plantain:       'https://upload.wikimedia.org/wikipedia/commons/8/86/Mega_racimos_de_guineos.jpg',
  cocoa:          'https://upload.wikimedia.org/wikipedia/commons/e/e0/Cocoa_Pods.JPG',
  mango:          'https://upload.wikimedia.org/wikipedia/commons/7/74/Mangos_-_single_and_halved.jpg',
  banana:         'https://upload.wikimedia.org/wikipedia/commons/d/de/Bananavarieties.jpg',
};

async function downloadBuffer(url) {
  const res = await fetch(url, {
    headers: {
      // Wikimedia requires a descriptive User-Agent.
      'User-Agent': 'FarrowayCropImages/1.0 (https://farroway.app; admin@farroway.app)',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// Consistent dark-green Farroway vignette composited over every photo
// so the crop catalog feels unified even when source backgrounds differ.
// Inner 50% is untouched (subject stays crisp); outer edge fades to
// the Farroway navy (#061A2E) for a shared background treatment.
const VIGNETTE_SVG = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <radialGradient id="v" cx="50%" cy="50%" r="72%">
      <stop offset="50%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#061A2E" stop-opacity="0.62"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>
`);

async function processCrop(key, url) {
  const outPath = path.join(OUT_DIR, `${key}.webp`);
  try {
    const src = await downloadBuffer(url);
    await sharp(src)
      .rotate() // respect EXIF orientation
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
      .composite([{ input: VIGNETTE_SVG, blend: 'over' }])
      .webp({ quality: 58, smartSubsample: true, effort: 6 })
      .toFile(outPath);
    const { size } = await fs.stat(outPath);
    return { key, ok: true, size };
  } catch (err) {
    return { key, ok: false, error: err.message };
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const results = [];
  // Download in parallel; Wikimedia handles this fine for 15 files.
  await Promise.all(
    Object.entries(SOURCES).map(async ([key, url]) => {
      const r = await processCrop(key, url);
      results.push(r);
      if (r.ok) {
        console.log(`✓ ${key.padEnd(14)} ${(r.size / 1024).toFixed(1)} KB`);
      } else {
        console.log(`✗ ${key.padEnd(14)} FAILED: ${r.error}`);
      }
    }),
  );

  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${ok}/${results.length} crops processed.`);
  if (failed.length) {
    console.error('Failures:', failed);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
