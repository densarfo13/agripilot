/**
 * Farroway — Central Brand Configuration
 *
 * All user-facing brand strings should import from here.
 * Update this single file to change branding across the app.
 */

// V3 brand identity lives in src/brand/farrowayBrand.js — this
// legacy `brand` shape stays as a thin re-export so any existing
// caller (`import { brand } from '../config/brand'`) still works.
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';

export const brand = {
  name: FARROWAY_BRAND.name,
  shortName: FARROWAY_BRAND.shortName,
  tagline: FARROWAY_BRAND.tagline, // "Know what to do. Grow better."
  website: FARROWAY_BRAND.website,
  supportEmail: FARROWAY_BRAND.supportEmail,
  colors: {
    primary: FARROWAY_BRAND.colors.green,
    dark:    FARROWAY_BRAND.colors.navy,
  },
};

export default brand;
