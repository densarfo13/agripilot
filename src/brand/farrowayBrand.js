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
  tagline: 'Know what to do. Grow better.',
  // Sub-tagline shown on the public landing hero. Kept short
  // so it works in mobile single-column layout without
  // wrapping more than twice.
  subTagline:
    'Simple daily guidance for farmers. Real-time visibility for organizations.',
  ctaPilot: 'Run a 90-day pilot',
  website: 'https://farroway.app',
  supportEmail: 'support@farroways.com',
  colors: Object.freeze({
    green:       '#22C55E', // primary brand green
    lightGreen:  '#A3E635', // accent / arrow-path highlight
    navy:        '#0B1220', // deep navy — icon background, app bg
    darkPanel:   '#111A2E', // raised surface on dark bg
    white:       '#FFFFFF',
  }),
});

export default FARROWAY_BRAND;
