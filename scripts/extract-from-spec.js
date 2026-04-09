import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SPEC = 'C:/Users/HP/Downloads/8DBA39D7-6977-4668-B505-90B82BB90261.png';
// Image is 1536x1024

async function main() {
  // The 512x512 icon with white/transparent background is in the top-right area
  // It's the largest Android icon. Approximate coordinates:
  // Looking at the layout: top row has 48,72,96,144,192,512 icons
  // The 512x512 is roughly at right side of image, upper half
  // Estimated: left ~1200, top ~20, size ~300px (displayed size in the image)

  // Actually, let me extract the "TRANSPARENT" version from bottom row - it's cleaner without the rounded rect
  // The transparent one is roughly center-bottom area
  // Let me try multiple crops and check

  // Top-right 512x512 Android icon (with rounded rect background)
  await sharp(SPEC)
    .extract({ left: 1220, top: 15, width: 310, height: 310 })
    .resize(1024, 1024)
    .png()
    .toFile(join(root, 'crop-android-512.png'));

  // Transparent version (bottom row, 3rd item) - just the logo, no background
  await sharp(SPEC)
    .extract({ left: 770, top: 530, width: 280, height: 280 })
    .resize(1024, 1024)
    .png()
    .toFile(join(root, 'crop-transparent.png'));

  // Solid green background version (bottom-right)
  await sharp(SPEC)
    .extract({ left: 1100, top: 520, width: 310, height: 310 })
    .resize(1024, 1024)
    .png()
    .toFile(join(root, 'crop-solid-green.png'));

  // PWA 512x512 (bottom-left, 2nd item)
  await sharp(SPEC)
    .extract({ left: 280, top: 530, width: 280, height: 280 })
    .resize(1024, 1024)
    .png()
    .toFile(join(root, 'crop-pwa-512.png'));

  console.log('Crops saved. Check them to find the best one.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
