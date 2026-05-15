/**
 * assetManifest — single canonical source for every NON-realism
 * static asset (icons, brand marks, PWA logos).
 *
 *   import { ASSETS } from '../assets/assetManifest.js';
 *
 *   <link rel="icon" href={ASSETS.icons.favicon} />
 *   <img src={ASSETS.icons.appleTouch} />
 *
 * Why a manifest
 *   The Permanent Runtime Asset + URL Fix calls for a single
 *   chokepoint for every image/icon reference so a renamed or
 *   missing file can be detected by the build pipeline instead
 *   of as a production console 404.
 *
 *   Realism photos already have their own canonical store at
 *   src/lib/realVisuals.jsx (REALISM_ASSETS). This manifest is
 *   the sibling for everything else — icons, PWA logos, brand
 *   marks, fallback graphics.
 *
 *   The build-time guard at scripts/check-icons.mjs walks every
 *   path below + asserts the file exists in public/ before
 *   shipping. Any reference to a non-existent file fails the
 *   build, so the class of "logo-premium.jpg 404 in production"
 *   bug we shipped this commit to close cannot regress.
 *
 * Rules:
 *   * Every value is a root-relative path resolvable under public/
 *   * No CDN URLs (those have their own validators)
 *   * Frozen at module level so consumers can't mutate
 *
 * Coverage: every PWA icon + every brand mark referenced by
 * index.html, public/manifest.json, and src/brand/farrowayBrand.js.
 */

// Realism fallback hero pulled from the canonical registry so
// check:assets stays satisfied (no raw /assets/realism/* literals).
import { REALISM_ASSETS } from '../lib/realVisuals.jsx';
const _REALISM_HERO_FALLBACK = REALISM_ASSETS.heroes.farmDefault;

export const ASSETS = Object.freeze({
  icons: Object.freeze({
    // Favicon + apple-touch — the two icons every browser fetches
    // on page load. A 404 on either shows up as a red console line
    // even when the user has no farming intent.
    favicon:           '/icons/logo-premium.jpg',
    faviconSvg:        '/icons/logo.svg',
    faviconShield:     '/icons/logo-shield.png',
    appleTouch:        '/icons/apple-touch-icon.png',

    // PWA + Android home-screen install icons.
    pwa192:            '/icons/icon-192.png',
    pwa512:            '/icons/icon-512.png',
    pwaMaskable512:    '/icons/maskable-512.png',

    // Brand mark variants — used by index.html link tags +
    // farrowayBrand.js + the BrandLogo component.
    logoPremium:       '/icons/logo-premium.jpg',
    logoPremium32:     '/icons/logo-premium-32.png',
    logoPremium180:    '/icons/logo-premium-180.jpg',
    logoPremium192:    '/icons/logo-premium-192.jpg',
    logoPremium512:    '/icons/logo-premium-512.jpg',
    logoPremium1024:   '/icons/logo-premium-1024.jpg',
    logoPremiumSvg:    '/icons/logo-premium.svg',
    farrowayMark:      '/icons/farroway-mark.jpg',
    farrowayMarkSvg:   '/icons/farroway-mark.svg',
  }),
  // Fallback graphics used by SafeImage when the upstream src
  // is missing. The hero fallback is sourced from the realism
  // asset registry so check:assets stays satisfied — there are
  // no raw /assets/realism/* literals in this file.
  fallbacks: Object.freeze({
    heroFallback:   _REALISM_HERO_FALLBACK,
    iconFallback:   '/icons/icon-192.png',
  }),
});

/**
 * Look up an icon path by short key. Returns null on unknown
 * keys so consumers can branch cleanly.
 *
 * @param {string} key  one of Object.keys(ASSETS.icons)
 * @returns {string|null}
 */
export function getIconAsset(key) {
  try {
    if (typeof key !== 'string' || !key.trim()) return null;
    return ASSETS.icons[key.trim()] || null;
  } catch { return null; }
}

const _module = { ASSETS, getIconAsset };
export default _module;
