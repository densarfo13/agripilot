/**
 * Farroway — Central Brand Configuration (Server)
 *
 * All user-facing brand strings on the backend should reference this config.
 */

export const brand = {
  name: 'Farroway',
  shortName: 'Farroway',
  // v3 brand phrase — must stay in lock-step with the
  // frontend's src/brand/farrowayBrand.js. Used in
  // server-rendered emails / pdf headers / SMS signatures.
  tagline: 'Know what to do. Grow better.',
  website: 'https://farroway.app',
  supportEmail: 'support@farroways.com',
  colors: {
    primary: '#22C55E',
    dark: '#0F172A',
  },
};

export default brand;
