/**
 * countrySupport.js — maintainable map of country → support tier +
 * a couple of helpers so every surface (picker, recommendations,
 * support form) reads the same tier definitions.
 *
 * Tiers:
 *   FULL_SUPPORT    — full crop-fit engine, state logic, task plans
 *   BASIC_SUPPORT   — country + coarse region logic, core crop plans
 *   LIMITED_SUPPORT — country is selectable but rules are thin
 *   COMING_SOON     — listed for visibility; not yet wired up
 */

export const SUPPORT_TIER = Object.freeze({
  FULL_SUPPORT:    'FULL_SUPPORT',
  BASIC_SUPPORT:   'BASIC_SUPPORT',
  LIMITED_SUPPORT: 'LIMITED_SUPPORT',
  COMING_SOON:     'COMING_SOON',
});

export const TIER_ORDER = Object.freeze({
  FULL_SUPPORT:    0,
  BASIC_SUPPORT:   1,
  LIMITED_SUPPORT: 2,
  COMING_SOON:     3,
});

/**
 * Country → tier. Anything not listed defaults to LIMITED_SUPPORT
 * so a newly added country never accidentally claims equal depth
 * with the US or Ghana.
 */
export const COUNTRY_SUPPORT = Object.freeze({
  US: { tier: SUPPORT_TIER.FULL_SUPPORT,    note: 'us_full' },
  GH: { tier: SUPPORT_TIER.BASIC_SUPPORT,   note: 'ghana_basic' },
  NG: { tier: SUPPORT_TIER.BASIC_SUPPORT,   note: 'nigeria_basic' },
  IN: { tier: SUPPORT_TIER.BASIC_SUPPORT,   note: 'india_basic' },
  KE: { tier: SUPPORT_TIER.BASIC_SUPPORT,   note: 'kenya_basic' },
  TZ: { tier: SUPPORT_TIER.BASIC_SUPPORT,   note: 'tanzania_basic' },
  UG: { tier: SUPPORT_TIER.BASIC_SUPPORT,   note: 'uganda_basic' },
  BR: { tier: SUPPORT_TIER.LIMITED_SUPPORT, note: 'brazil_limited' },
  ZA: { tier: SUPPORT_TIER.LIMITED_SUPPORT, note: 'za_limited' },
  SN: { tier: SUPPORT_TIER.LIMITED_SUPPORT, note: 'senegal_limited' },
  CI: { tier: SUPPORT_TIER.LIMITED_SUPPORT, note: 'ci_limited' },
  ET: { tier: SUPPORT_TIER.COMING_SOON },
  MZ: { tier: SUPPORT_TIER.COMING_SOON },
  RW: { tier: SUPPORT_TIER.COMING_SOON },
  MW: { tier: SUPPORT_TIER.COMING_SOON },
  ZM: { tier: SUPPORT_TIER.COMING_SOON },
  ZW: { tier: SUPPORT_TIER.COMING_SOON },
  PK: { tier: SUPPORT_TIER.COMING_SOON },
  BD: { tier: SUPPORT_TIER.COMING_SOON },
  NP: { tier: SUPPORT_TIER.COMING_SOON },
  PH: { tier: SUPPORT_TIER.COMING_SOON },
  VN: { tier: SUPPORT_TIER.COMING_SOON },
  TH: { tier: SUPPORT_TIER.COMING_SOON },
  ID: { tier: SUPPORT_TIER.COMING_SOON },
  KH: { tier: SUPPORT_TIER.COMING_SOON },
  MY: { tier: SUPPORT_TIER.COMING_SOON },
  AR: { tier: SUPPORT_TIER.COMING_SOON },
  CO: { tier: SUPPORT_TIER.COMING_SOON },
  GT: { tier: SUPPORT_TIER.COMING_SOON },
  PE: { tier: SUPPORT_TIER.COMING_SOON },
  MX: { tier: SUPPORT_TIER.COMING_SOON },
  MA: { tier: SUPPORT_TIER.COMING_SOON },
  EG: { tier: SUPPORT_TIER.COMING_SOON },
  CA: { tier: SUPPORT_TIER.LIMITED_SUPPORT, note: 'ca_limited' },
  AU: { tier: SUPPORT_TIER.COMING_SOON },
  GB: { tier: SUPPORT_TIER.COMING_SOON },
  FR: { tier: SUPPORT_TIER.COMING_SOON },
  OTHER: { tier: SUPPORT_TIER.LIMITED_SUPPORT },
});

export function getCountrySupport(countryCode) {
  if (!countryCode) return { tier: SUPPORT_TIER.LIMITED_SUPPORT };
  const code = String(countryCode).toUpperCase();
  return COUNTRY_SUPPORT[code] || { tier: SUPPORT_TIER.LIMITED_SUPPORT };
}

export function getCountrySupportTier(countryCode) {
  return getCountrySupport(countryCode).tier;
}

/** True when recommendations can use confident "Best for you" wording. */
export function isFullySupportedCountry(countryCode) {
  return getCountrySupportTier(countryCode) === SUPPORT_TIER.FULL_SUPPORT;
}

/** True when the country should be blocked from onboarding. */
export function isCountryComingSoon(countryCode) {
  return getCountrySupportTier(countryCode) === SUPPORT_TIER.COMING_SOON;
}

/** Group country list by tier for the picker UI. */
export function groupCountriesByTier(countries) {
  const groups = {
    [SUPPORT_TIER.FULL_SUPPORT]: [],
    [SUPPORT_TIER.BASIC_SUPPORT]: [],
    [SUPPORT_TIER.LIMITED_SUPPORT]: [],
    [SUPPORT_TIER.COMING_SOON]: [],
  };
  for (const c of countries) {
    const tier = getCountrySupportTier(c.code);
    groups[tier].push(c);
  }
  return groups;
}

/** Map tier → stable i18n key (UI resolves through t()). */
export const TIER_I18N_KEY = Object.freeze({
  FULL_SUPPORT:    'countrySupport.tier.full',
  BASIC_SUPPORT:   'countrySupport.tier.basic',
  LIMITED_SUPPORT: 'countrySupport.tier.limited',
  COMING_SOON:     'countrySupport.tier.comingSoon',
});

export const TIER_GROUP_KEY = Object.freeze({
  FULL_SUPPORT:    'countrySupport.group.full',
  BASIC_SUPPORT:   'countrySupport.group.basic',
  LIMITED_SUPPORT: 'countrySupport.group.limited',
  COMING_SOON:     'countrySupport.group.comingSoon',
});
