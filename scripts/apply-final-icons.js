import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Sources extracted from the spec sheet
const TRANSPARENT = join(root, 'crop-transparent.png');   // Logo only, no bg
const SOLID_GREEN = join(root, 'crop-solid-green.png');   // Logo on green bg
const SCREENSHOT_ICON = join(root, 'logo-extracted-preview.png'); // From phone screenshot - white bg rounded

async function resize(src, size, outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  await sharp(src).resize(size, size).png().toFile(outputPath);
  console.log(`  ✓ ${size}x${size} → ${outputPath.split('agripilot\\')[1] || outputPath}`);
}

async function main() {
  console.log('🎨 Applying EXACT Farroway icons from spec sheet...\n');

  // Use screenshot icon (white bg, rounded) for main launcher icons
  // Use transparent for foreground layers
  // Use solid green for special cases

  // ===== BRANDING ASSETS =====
  console.log('📁 Branding:');
  await resize(SCREENSHOT_ICON, 1024, join(root, 'mobile/assets/branding/app_icon.png'));
  await resize(TRANSPARENT, 1024, join(root, 'mobile/assets/branding/app_icon_foreground.png'));
  await resize(SCREENSHOT_ICON, 256, join(root, 'mobile/assets/branding/logo.png'));

  // ===== PWA ICONS =====
  console.log('\n📁 PWA:');
  await resize(SCREENSHOT_ICON, 512, join(root, 'public/icons/icon-512.png'));
  await resize(SCREENSHOT_ICON, 512, join(root, 'public/icons/maskable-512.png'));
  await resize(SCREENSHOT_ICON, 192, join(root, 'public/icons/icon-192.png'));
  await resize(SCREENSHOT_ICON, 180, join(root, 'public/icons/apple-touch-icon.png'));

  // ===== ANDROID CAPACITOR =====
  const androidRes = join(root, 'android/app/src/main/res');
  const sizes = { 'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192 };

  console.log('\n📁 Android (Capacitor):');
  for (const [dpi, size] of Object.entries(sizes)) {
    // Main launcher - use the white bg version
    await resize(SCREENSHOT_ICON, size, join(androidRes, `mipmap-${dpi}`, 'ic_launcher.png'));
    await resize(SCREENSHOT_ICON, size, join(androidRes, `mipmap-${dpi}`, 'ic_launcher_round.png'));
    // Foreground - use transparent version
    await resize(TRANSPARENT, size, join(androidRes, `mipmap-${dpi}`, 'ic_launcher_foreground.png'));
    await resize(TRANSPARENT, size, join(androidRes, `drawable-${dpi}`, 'ic_launcher_foreground.png'));
  }

  // ===== FLUTTER ANDROID =====
  const flutterRes = join(root, 'mobile/android/app/src/main/res');
  console.log('\n📁 Android (Flutter):');
  for (const [dpi, size] of Object.entries(sizes)) {
    await resize(SCREENSHOT_ICON, size, join(flutterRes, `mipmap-${dpi}`, 'ic_launcher.png'));
  }

  // ===== iOS CAPACITOR =====
  const iosDir = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
  console.log('\n📁 iOS:');
  await resize(SCREENSHOT_ICON, 1024, join(iosDir, 'AppIcon-512@2x.png'));
  await resize(SCREENSHOT_ICON, 180, join(iosDir, 'AppIcon-60@3x.png'));
  await resize(SCREENSHOT_ICON, 120, join(iosDir, 'AppIcon-60@2x.png'));
  await resize(SCREENSHOT_ICON, 167, join(iosDir, 'AppIcon-83.5@2x.png'));
  await resize(SCREENSHOT_ICON, 152, join(iosDir, 'AppIcon-76@2x.png'));
  await resize(SCREENSHOT_ICON, 76, join(iosDir, 'AppIcon-76.png'));
  await resize(SCREENSHOT_ICON, 80, join(iosDir, 'AppIcon-40@2x.png'));
  await resize(SCREENSHOT_ICON, 120, join(iosDir, 'AppIcon-40@3x.png'));
  await resize(SCREENSHOT_ICON, 40, join(iosDir, 'AppIcon-40.png'));
  await resize(SCREENSHOT_ICON, 58, join(iosDir, 'AppIcon-29@2x.png'));
  await resize(SCREENSHOT_ICON, 87, join(iosDir, 'AppIcon-29@3x.png'));
  await resize(SCREENSHOT_ICON, 29, join(iosDir, 'AppIcon-29.png'));
  await resize(SCREENSHOT_ICON, 20, join(iosDir, 'AppIcon-20.png'));
  await resize(SCREENSHOT_ICON, 40, join(iosDir, 'AppIcon-20@2x.png'));
  await resize(SCREENSHOT_ICON, 60, join(iosDir, 'AppIcon-20@3x.png'));

  console.log('\n✅ All icons now use the EXACT Farroway logo!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
