import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SOURCE = 'C:/Users/HP/Downloads/View recent photos.png';

async function main() {
  // Image is 1320x1808 screenshot
  // The icon is roughly centered, occupying middle area
  // Icon area is approximately: left=310, top=230, width=700, height=700

  console.log('📐 Extracting logo from screenshot...');

  // First extract the icon region (the rounded square with the leaf logo)
  const extracted = await sharp(SOURCE)
    .extract({ left: 310, top: 230, width: 700, height: 700 })
    .png()
    .toFile(join(root, 'logo-extracted-preview.png'));

  console.log('Preview saved as logo-extracted-preview.png - check if crop is correct');

  // Generate the master 1024x1024 icon
  const masterIcon = join(root, 'farroway-logo.png');
  await sharp(SOURCE)
    .extract({ left: 310, top: 230, width: 700, height: 700 })
    .resize(1024, 1024)
    .png()
    .toFile(masterIcon);

  console.log('✓ Master icon: farroway-logo.png (1024x1024)');

  // Now generate all platform icons from the master
  const master = join(root, 'farroway-logo.png');

  async function resize(size, outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    await sharp(master).resize(size, size).png().toFile(outputPath);
    console.log(`  ✓ ${outputPath} (${size}x${size})`);
  }

  // 1. Branding assets
  console.log('\n📁 mobile/assets/branding/');
  await resize(1024, join(root, 'mobile/assets/branding/app_icon.png'));
  await resize(256, join(root, 'mobile/assets/branding/logo.png'));

  // 2. PWA / Web icons
  console.log('\n📁 public/icons/');
  await resize(512, join(root, 'public/icons/icon-512.png'));
  await resize(512, join(root, 'public/icons/maskable-512.png'));
  await resize(192, join(root, 'public/icons/icon-192.png'));
  await resize(180, join(root, 'public/icons/apple-touch-icon.png'));

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
    await resize(size, join(androidRes, folder, 'ic_launcher.png'));
    await resize(size, join(androidRes, folder, 'ic_launcher_round.png'));
    await resize(size, join(androidRes, folder, 'ic_launcher_foreground.png'));
  }

  // 4. Android drawable foreground
  const drawableSizes = {
    'drawable-mdpi': 48,
    'drawable-hdpi': 72,
    'drawable-xhdpi': 96,
    'drawable-xxhdpi': 144,
    'drawable-xxxhdpi': 192,
  };
  for (const [folder, size] of Object.entries(drawableSizes)) {
    await resize(size, join(androidRes, folder, 'ic_launcher_foreground.png'));
  }

  // 5. Flutter Android mipmap icons
  const flutterAndroidRes = join(root, 'mobile/android/app/src/main/res');
  console.log('\n📁 mobile/android/app/src/main/res/ (Flutter)');
  for (const [folder, size] of Object.entries(androidSizes)) {
    await resize(size, join(flutterAndroidRes, folder, 'ic_launcher.png'));
  }

  // 6. iOS Capacitor icons
  const iosIconDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  mkdirSync(iosIconDir, { recursive: true });
  console.log('\n📁 ios/App/App/Assets.xcassets/AppIcon.appiconset/');
  await resize(1024, join(iosIconDir, 'AppIcon-512@2x.png'));
  await resize(180, join(iosIconDir, 'AppIcon-60@3x.png'));
  await resize(120, join(iosIconDir, 'AppIcon-60@2x.png'));
  await resize(167, join(iosIconDir, 'AppIcon-83.5@2x.png'));
  await resize(152, join(iosIconDir, 'AppIcon-76@2x.png'));
  await resize(76, join(iosIconDir, 'AppIcon-76.png'));
  await resize(80, join(iosIconDir, 'AppIcon-40@2x.png'));
  await resize(120, join(iosIconDir, 'AppIcon-40@3x.png'));
  await resize(40, join(iosIconDir, 'AppIcon-40.png'));
  await resize(58, join(iosIconDir, 'AppIcon-29@2x.png'));
  await resize(87, join(iosIconDir, 'AppIcon-29@3x.png'));
  await resize(29, join(iosIconDir, 'AppIcon-29.png'));
  await resize(20, join(iosIconDir, 'AppIcon-20.png'));
  await resize(40, join(iosIconDir, 'AppIcon-20@2x.png'));
  await resize(60, join(iosIconDir, 'AppIcon-20@3x.png'));

  console.log('\n✅ All icons replaced with the EXACT Farroway logo from screenshot!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
