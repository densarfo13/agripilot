/**
 * farrowayBrand.js — single source of truth for the Farroway
 * brand identity that ships with v3 of the app.
 *
 * Rules of the road:
 *   * Anything user-facing — tagline, palette, product name —
 *     reads from this object, not from a string literal copy.
 *   * Old taglines ("The smarter way to farm.", "Know today.
 *     Grow tomorrow.", "Smart Guidance. Better Harvests.",
 *     "Smart farming. Better harvests.") MUST NOT exist
 *     anywhere in the bundle. Audit grep is in scripts.
 *   * Colours match the production logo direction:
 *       green top + navy bottom, lime accent for the arrow
 *       path, white wordmark on dark, navy wordmark on light.
 *
 * The colour token names match what the rest of the app
 * already uses (`#22C55E` for green, `#0B1220` for the deep
 * navy that the splash + login + dashboard backdrops sit on).
 */

export const FARROWAY_BRAND = Object.freeze({
  name: 'Farroway',
  shortName: 'Farroway',
  tagline: 'Know what to do today. Grow better.',
  // Sub-tagline shown on the public landing hero. Kept short
  // so it works in mobile single-column layout without
  // wrapping more than twice.
  subTagline:
    'Simple daily guidance for farmers. Real-time visibility for organizations.',
  ctaPilot: 'Run a 90-day pilot',
  website: 'https://farroway.app',
  supportEmail: 'support@farroways.com',
  colors: Object.freeze({
    green:       '#22C55E', // primary brand green (leaf fill)
    darkGreen:   '#15803D', // leaf outline / depth accent
    lightGreen:  '#A3E635', // accent highlight
    navy:        '#0B1220', // deep navy — icon background, app bg
    darkPanel:   '#111A2E', // raised surface on dark bg
    white:       '#FFFFFF', // arrow + onDark wordmark
  }),
  // Static asset paths for surfaces that prefer a file over
  // the inline SVG (PDFs, email templates, og:image, etc.).
  // The inline `BrandLogo` / `FarrowayLogo` component is the
  // primary mark used across the React app \u2014 these paths are
  // here for non-React consumers.
  //
  // Premium-logo migration: every brand surface now resolves to
  // the `logo-premium.*` family at /public/icons/. To swap the
  // brand mark, replace the bytes at those paths only \u2014 no
  // source change required. See docs/LOGO.md for the file list
  // and the per-platform size scheme:
  //   logo-premium.svg       \u2014 vector master (favicon, mask-icon)
  //   logo-premium-1024.png  \u2014 raster master (og:image, app icon)
  //   logo-premium-512.png   \u2014 PWA install + maskable
  //   logo-premium-192.png   \u2014 PWA + Android home-screen
  //   logo-premium-180.png   \u2014 iOS apple-touch-icon
  //   logo-premium-32.png    \u2014 browser favicon
  logo: Object.freeze({
    // Canonical raster master \u2014 the JPG the brand team supplied
    // (1080\u00D71080 baseline JPEG). The icon fields point at the
    // master so anywhere a raster mark is needed gets the brand
    // image. Once the brand team supplies an SVG vector, swap
    // these strings to point at logo-premium.svg in one place.
    icon:          '/icons/logo-premium.jpg',
    wordmarkLight: '/icons/logo-premium.jpg',
    wordmarkDark:  '/icons/logo-premium.jpg',
    fullLight:     '/icons/logo-premium.jpg',
    fullDark:      '/icons/logo-premium.jpg',
    markRaster:    '/icons/logo-premium-1024.jpg',
    raster192:     '/icons/logo-premium-192.jpg',
    raster512:     '/icons/logo-premium-512.jpg',
    appleTouch:    '/icons/logo-premium-180.jpg',
    favicon32:     '/icons/logo-premium-32.png',
  }),
});

export default FARROWAY_BRAND;
