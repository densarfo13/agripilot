import sharp from 'sharp';
import { mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// SVG for the Farroway logo: green leaf/shield shape with white checkmark
// This creates a leaf-like shield silhouette with a bold white check
const createLogoSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#43A047;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2E7D32;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.15"/>
    </filter>
  </defs>

  <!-- Background circle for app icon -->
  <rect width="512" height="512" rx="100" ry="100" fill="#F1F8E9"/>

  <!-- Leaf/shield shape - pointed at bottom, rounded at top, slight asymmetry like a leaf -->
  <path d="
    M 256 460
    C 220 400, 100 320, 90 220
    C 80 140, 120 80, 180 55
    C 210 42, 240 38, 256 36
    C 272 38, 302 42, 332 55
    C 392 80, 432 140, 422 220
    C 412 320, 292 400, 256 460
    Z
  " fill="url(#leafGrad)" filter="url(#shadow)"/>

  <!-- Leaf vein - subtle center line -->
  <path d="M 256 100 Q 256 250, 256 420"
        stroke="#ffffff" stroke-width="2" fill="none" opacity="0.15"/>

  <!-- White checkmark -->
  <polyline points="185,245 235,305 340,190"
            fill="none" stroke="#FFFFFF" stroke-width="38"
            stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Foreground-only SVG (for Android adaptive icons - transparent bg)
const createForegroundSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#43A047;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2E7D32;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Leaf/shield shape -->
  <path d="
    M 256 460
    C 220 400, 100 320, 90 220
    C 80 140, 120 80, 180 55
    C 210 42, 240 38, 256 36
    C 272 38, 302 42, 332 55
    C 392 80, 432 140, 422 220
    C 412 320, 292 400, 256 460
    Z
  " fill="url(#leafGrad)"/>

  <!-- White checkmark -->
  <polyline points="185,245 235,305 340,190"
            fill="none" stroke="#FFFFFF" stroke-width="38"
            stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function generateIcon(svgFn, size, outputPath) {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });

  const svg = Buffer.from(svgFn(512));
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`  ✓ ${outputPath} (${size}x${size})`);
}

async function main() {
  console.log('🌿 Generating Farroway leaf/shield icons...\n');

  // 1. Master branding icons
  console.log('📁 mobile/assets/branding/');
  await generateIcon(createLogoSVG, 1024, join(root, 'mobile/assets/branding/app_icon.png'));
  await generateIcon(createForegroundSVG, 1024, join(root, 'mobile/assets/branding/app_icon_foreground.png'));
  await generateIcon(createLogoSVG, 256, join(root, 'mobile/assets/branding/logo.png'));

  // 2. PWA / Web icons
  console.log('\n📁 public/icons/');
  await generateIcon(createLogoSVG, 512, join(root, 'public/icons/icon-512.png'));
  await generateIcon(createLogoSVG, 512, join(root, 'public/icons/maskable-512.png'));
  await generateIcon(createLogoSVG, 192, join(root, 'public/icons/icon-192.png'));
  await generateIcon(createLogoSVG, 180, join(root, 'public/icons/apple-touch-icon.png'));

  // 3. Capacitor Android mipmap icons
  const androidRes = join(root, 'android/app/src/main/res');
  const androidSizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
  };

  console.log('\n📁 android/app/src/main/res/ (Capacitor)');
  for (const [folder, size] of Object.entries(androidSizes)) {
    await generateIcon(createLogoSVG, size, join(androidRes, folder, 'ic_launcher.png'));
    await generateIcon(createLogoSVG, size, join(androidRes, folder, 'ic_launcher_round.png'));
    await generateIcon(createForegroundSVG, size, join(androidRes, folder, 'ic_launcher_foreground.png'));
  }

  // 4. Android drawable foreground/background
  const drawableSizes = {
    'drawable-mdpi': 48,
    'drawable-hdpi': 72,
    'drawable-xhdpi': 96,
    'drawable-xxhdpi': 144,
    'drawable-xxxhdpi': 192,
  };

  for (const [folder, size] of Object.entries(drawableSizes)) {
    const drawPath = join(androidRes, folder);
    mkdirSync(drawPath, { recursive: true });
    await generateIcon(createForegroundSVG, size, join(drawPath, 'ic_launcher_foreground.png'));
  }

  // 5. Flutter Android mipmap icons (for mobile/ project)
  const flutterAndroidRes = join(root, 'mobile/android/app/src/main/res');
  console.log('\n📁 mobile/android/app/src/main/res/ (Flutter)');
  for (const [folder, size] of Object.entries(androidSizes)) {
    await generateIcon(createLogoSVG, size, join(flutterAndroidRes, folder, 'ic_launcher.png'));
  }

  // 6. iOS Capacitor icons
  const iosIconDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  mkdirSync(iosIconDir, { recursive: true });
  console.log('\n📁 ios/App/App/Assets.xcassets/AppIcon.appiconset/');
  await generateIcon(createLogoSVG, 1024, join(iosIconDir, 'AppIcon-512@2x.png'));
  await generateIcon(createLogoSVG, 180, join(iosIconDir, 'AppIcon-60@3x.png'));
  await generateIcon(createLogoSVG, 120, join(iosIconDir, 'AppIcon-60@2x.png'));
  await generateIcon(createLogoSVG, 167, join(iosIconDir, 'AppIcon-83.5@2x.png'));
  await generateIcon(createLogoSVG, 152, join(iosIconDir, 'AppIcon-76@2x.png'));
  await generateIcon(createLogoSVG, 76, join(iosIconDir, 'AppIcon-76.png'));
  await generateIcon(createLogoSVG, 80, join(iosIconDir, 'AppIcon-40@2x.png'));
  await generateIcon(createLogoSVG, 120, join(iosIconDir, 'AppIcon-40@3x.png'));
  await generateIcon(createLogoSVG, 40, join(iosIconDir, 'AppIcon-40.png'));
  await generateIcon(createLogoSVG, 58, join(iosIconDir, 'AppIcon-29@2x.png'));
  await generateIcon(createLogoSVG, 87, join(iosIconDir, 'AppIcon-29@3x.png'));
  await generateIcon(createLogoSVG, 29, join(iosIconDir, 'AppIcon-29.png'));
  await generateIcon(createLogoSVG, 20, join(iosIconDir, 'AppIcon-20.png'));
  await generateIcon(createLogoSVG, 40, join(iosIconDir, 'AppIcon-20@2x.png'));
  await generateIcon(createLogoSVG, 60, join(iosIconDir, 'AppIcon-20@3x.png'));

  console.log('\n✅ All icons generated with leaf/shield + checkmark design!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
