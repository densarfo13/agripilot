/**
 * fundingConfig.js — region- and role-aware static funding catalog
 * for the Funding Hub at /funding.
 *
 * Position in the codebase
 * ────────────────────────
 * Coexists with — does NOT replace — the existing per-farm matcher
 * at `src/funding/*` (which scores live opportunities against a
 * specific farm's region + crop + size). This file is a curated
 * *catalog* of programs that adapt by country + user role.
 *
 * Trust + compliance (per spec §11)
 * ─────────────────────────────────
 *   • Every entry uses cautious wording — "May be eligible",
 *     "Explore this option", "Prepare your documents", "Contact
 *     the program". Never "approved", "guaranteed", "you qualify".
 *   • External URLs point at OFFICIAL pages where the program is
 *     described by its issuing body. Farroway never claims to
 *     host or operate any of these programs.
 *   • A `disclaimer` is shipped per category so the consumer can
 *     show it consistently regardless of card.
 *
 * Schema
 * ──────
 * Each card:
 *   {
 *     id:              string  — stable, slug-style
 *     title:           string  — program name
 *     category:        'government'|'ngo'|'cooperative'|'training'|'partnership'
 *     description:     string  — one short sentence (caller wraps)
 *     bestFor:         string[] — short audience tags shown verbatim
 *     eligibilityHint: string  — cautious phrasing only
 *     nextStep:        string  — single concrete action
 *     priority:        1..5    — 1 = highest; the engine adds bonuses
 *     externalUrl:     string  — official program URL
 *     sourceType:      'government'|'ngo'|'cooperative'|'extension'|'community'|'partnership'
 *     countries:       string[] — country names matching regionConfig keys
 *     experiences:     ('farm'|'backyard'|'generic')[]
 *     userRoles:       ('farmer'|'backyard_grower'|'ngo_admin'|'cooperative'|'government_program'|'extension_partner')[]
 *   }
 *
 * No country logic is hardcoded outside this file. UI surfaces
 * read through the recommendation engine, which reads from here.
 */

/** @typedef {'government'|'ngo'|'cooperative'|'training'|'partnership'} FundingCategory */
/** @typedef {'farmer'|'backyard_grower'|'ngo_admin'|'cooperative'|'government_program'|'extension_partner'} FundingUserRole */
/** @typedef {'farm'|'backyard'|'generic'} FundingExperience */

export const FUNDING_USER_ROLES = Object.freeze([
  'farmer',
  'backyard_grower',
  'ngo_admin',
  'cooperative',
  'government_program',
  'extension_partner',
]);

export const FUNDING_CATEGORIES = Object.freeze([
  'government',
  'ngo',
  'cooperative',
  'training',
  'partnership',
]);

/**
 * Per-category disclaimer copy. The consumer (FundingCard /
 * FundingHub) renders this verbatim under each section.
 */
export const FUNDING_DISCLAIMERS = Object.freeze({
  default: 'Farroway does not guarantee funding. Always verify requirements with the official program.',
  external: 'External link — opens in a new tab on the official program page.',
});

// ─── Catalog ────────────────────────────────────────────────────
//
// All cards normalised to the schema above. The engine filters
// by country / experience / role; the UI renders by category.

const GHANA = [
  {
    id: 'gh-mofa-pfj',
    title: 'Planting for Food and Jobs',
    category: 'government',
    description: 'National program offering subsidised inputs and extension support to smallholder farmers.',
    bestFor: ['Smallholder farmers', 'Cooperatives'],
    eligibilityHint: 'Farmers registered through MoFA or a partner cooperative may be eligible.',
    nextStep: 'Contact your district MoFA office to confirm enrolment dates.',
    priority: 1,
    externalUrl: 'https://mofa.gov.gh/site/programmes/planting-for-food-jobs',
    sourceType: 'government',
    countries: ['Ghana'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'extension_partner'],
  },
  {
    id: 'gh-mastercard-foundation-rural-prosperity',
    title: 'Rural Prosperity & Agri-Enterprise Programs',
    category: 'ngo',
    description: 'NGO and foundation programs supporting Ghanaian smallholder agri-enterprise growth.',
    bestFor: ['Smallholder farmers', 'Women farmers', 'Youth in agriculture'],
    eligibilityHint: 'May be eligible if you operate a registered farm or cooperative in Ghana.',
    nextStep: 'Explore active programs and prepare your farm profile + impact data.',
    priority: 2,
    externalUrl: 'https://mastercardfdn.org/young-africa-works/',
    sourceType: 'ngo',
    countries: ['Ghana'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
  {
    id: 'gh-cooperative-input-support',
    title: 'Cooperative Input Support',
    category: 'cooperative',
    description: 'Cooperative-led seed, fertiliser, and equipment support for member farms.',
    bestFor: ['Cooperative members'],
    eligibilityHint: 'May be eligible if you are an active member of a registered cooperative.',
    nextStep: 'Contact your cooperative office to confirm the next intake.',
    priority: 2,
    externalUrl: 'https://www.gawu.org/',
    sourceType: 'cooperative',
    countries: ['Ghana'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative'],
  },
  {
    id: 'gh-buyer-partnership',
    title: 'Buyer Partnership Programs',
    category: 'partnership',
    description: 'Aggregator and buyer programs that pair farmers with consistent off-takers.',
    bestFor: ['Farms ready to sell consistently'],
    eligibilityHint: 'Explore this option if your harvest readiness is consistent and traceable.',
    nextStep: 'Prepare your harvest history and contact local aggregators.',
    priority: 3,
    externalUrl: 'https://www.ghanaagrihub.com/',
    sourceType: 'partnership',
    countries: ['Ghana'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
];

const UNITED_STATES = [
  // Farm experience
  {
    id: 'us-usda-bfrdp',
    title: 'Beginning Farmer & Rancher Development',
    category: 'government',
    description: 'USDA NIFA program supporting new and beginning farmers through training and mentorship.',
    bestFor: ['Farmers in their first 10 years'],
    eligibilityHint: 'May be eligible if you have farmed for less than 10 years.',
    nextStep: 'Visit the official USDA NIFA page and check current funding cycles.',
    priority: 1,
    externalUrl: 'https://www.nifa.usda.gov/grants/programs/beginning-farmer-rancher-development-program',
    sourceType: 'government',
    countries: ['United States'],
    experiences: ['farm'],
    userRoles: ['farmer'],
  },
  {
    id: 'us-nrcs-eqip',
    title: 'NRCS Environmental Quality Incentives Program',
    category: 'government',
    description: 'Conservation-focused payments to farmers adopting practices that protect soil and water.',
    bestFor: ['Farms adopting conservation practices'],
    eligibilityHint: 'May be eligible if you operate agricultural land in the United States.',
    nextStep: 'Contact your local NRCS service center.',
    priority: 1,
    externalUrl: 'https://www.nrcs.usda.gov/programs-initiatives/eqip-environmental-quality-incentives',
    sourceType: 'government',
    countries: ['United States'],
    experiences: ['farm'],
    userRoles: ['farmer'],
  },
  {
    id: 'us-cooperative-extension',
    title: 'Cooperative Extension Services',
    category: 'training',
    description: 'Land-grant university extension offers research-backed training for farms in every U.S. state.',
    bestFor: ['Farmers wanting practical, free training'],
    eligibilityHint: 'Open to U.S. residents — explore this option for region-specific guidance.',
    nextStep: 'Find your state extension office and review their current offerings.',
    priority: 2,
    externalUrl: 'https://www.nifa.usda.gov/about-nifa/how-we-work/extension/cooperative-extension-system',
    sourceType: 'extension',
    countries: ['United States'],
    experiences: ['farm', 'backyard'],
    userRoles: ['farmer', 'backyard_grower', 'extension_partner'],
  },
  // Backyard experience
  {
    id: 'us-urban-agriculture',
    title: 'USDA Urban Agriculture & Innovative Production',
    category: 'government',
    description: 'Federal grants supporting urban, suburban, and innovative production — including community gardens.',
    bestFor: ['Urban growers', 'Community gardens'],
    eligibilityHint: 'May be eligible for community gardens, urban farms, and innovative production projects.',
    nextStep: 'Review the official Urban Agriculture grant page for current cycles.',
    priority: 1,
    externalUrl: 'https://www.usda.gov/topics/urban',
    sourceType: 'government',
    countries: ['United States'],
    experiences: ['backyard'],
    userRoles: ['backyard_grower', 'farmer'],
  },
  {
    id: 'us-master-gardener',
    title: 'Master Gardener Program',
    category: 'training',
    description: 'University extension volunteer training that connects backyard growers with local horticulture experts.',
    bestFor: ['Backyard gardeners', 'Home growers'],
    eligibilityHint: 'Open to home growers in most U.S. states — explore your local program.',
    nextStep: 'Find your county Master Gardener program and check application windows.',
    priority: 2,
    externalUrl: 'https://mastergardener.extension.org/',
    sourceType: 'extension',
    countries: ['United States'],
    experiences: ['backyard'],
    userRoles: ['backyard_grower'],
  },
  {
    id: 'us-community-garden-resource',
    title: 'Community Garden Support',
    category: 'community',
    description: 'Local government and nonprofit resources for starting or joining a community garden.',
    bestFor: ['Backyard growers', 'Community organisers'],
    eligibilityHint: 'Most U.S. cities offer some form of community garden support — check locally.',
    nextStep: 'Contact your city parks or sustainability office to ask about available plots.',
    priority: 3,
    externalUrl: 'https://communitygarden.org/',
    sourceType: 'community',
    countries: ['United States'],
    experiences: ['backyard'],
    userRoles: ['backyard_grower'],
  },
];

const NIGERIA = [
  {
    id: 'ng-anchor-borrowers',
    title: 'Anchor Borrowers\u2019 Programme',
    category: 'government',
    description: 'Central Bank of Nigeria scheme connecting smallholder farmers with off-takers and input financing.',
    bestFor: ['Smallholder farmers', 'Cooperatives'],
    eligibilityHint: 'May be eligible if you farm a target commodity through a registered cooperative.',
    nextStep: 'Contact a participating bank or cooperative office.',
    priority: 1,
    externalUrl: 'https://www.cbn.gov.ng/devfin/abp.asp',
    sourceType: 'government',
    countries: ['Nigeria'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative'],
  },
  {
    id: 'ng-climate-smart',
    title: 'Climate-Smart Agriculture Programs',
    category: 'ngo',
    description: 'NGO and donor-funded programs supporting climate-resilient practices for smallholders.',
    bestFor: ['Farmers in drought-affected regions'],
    eligibilityHint: 'May be eligible if your farm is in a vulnerable agro-ecological zone.',
    nextStep: 'Explore active programs through your state ADP office.',
    priority: 2,
    externalUrl: 'https://www.ifad.org/en/web/operations/w/country/nigeria',
    sourceType: 'ngo',
    countries: ['Nigeria'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
];

const KENYA = [
  {
    id: 'ke-asdsp',
    title: 'Agricultural Sector Development Support Programme',
    category: 'government',
    description: 'Government program supporting smallholder commercialisation and value chain development.',
    bestFor: ['Smallholder farmers', 'Producer organisations'],
    eligibilityHint: 'May be eligible through your county agriculture office.',
    nextStep: 'Visit your county ASDSP office to confirm current activities.',
    priority: 1,
    externalUrl: 'https://www.kilimo.go.ke/',
    sourceType: 'government',
    countries: ['Kenya'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative'],
  },
  {
    id: 'ke-climate-smart',
    title: 'Kenya Climate Smart Agriculture Project',
    category: 'ngo',
    description: 'World Bank–supported project promoting climate-smart practices for smallholders.',
    bestFor: ['Farmers in climate-vulnerable counties'],
    eligibilityHint: 'May be eligible through county-level KCSAP teams.',
    nextStep: 'Contact your county KCSAP coordinator.',
    priority: 2,
    externalUrl: 'https://www.kilimo.go.ke/kcsap/',
    sourceType: 'ngo',
    countries: ['Kenya'],
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
];

const GLOBAL = [
  {
    id: 'global-fao-food-security',
    title: 'Food Security Grant Programs',
    category: 'ngo',
    description: 'International donor and FAO-affiliated programs supporting food security and smallholder resilience.',
    bestFor: ['Smallholder farmers', 'NGOs working with farmers'],
    eligibilityHint: 'May be eligible depending on country, crop, and farm size.',
    nextStep: 'Explore active calls and prepare your farm or program profile.',
    priority: 2,
    externalUrl: 'https://www.fao.org/in-action/all-programmes/en/',
    sourceType: 'ngo',
    countries: ['Default'],
    experiences: ['farm', 'generic'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
  {
    id: 'global-climate-smart-agriculture',
    title: 'Climate-Smart Agriculture Resources',
    category: 'training',
    description: 'Open training resources from CGIAR / FAO on climate-resilient farming practices.',
    bestFor: ['Farmers', 'Extension partners'],
    eligibilityHint: 'Open to anyone — explore the materials and apply what fits your context.',
    nextStep: 'Browse the public library and pick a guide for your crop.',
    priority: 3,
    externalUrl: 'https://www.fao.org/climate-smart-agriculture/en/',
    sourceType: 'extension',
    countries: ['Default'],
    experiences: ['farm', 'backyard', 'generic'],
    userRoles: ['farmer', 'backyard_grower', 'extension_partner', 'ngo_admin'],
  },
  {
    id: 'global-cooperative-development',
    title: 'Cooperative Development Programs',
    category: 'cooperative',
    description: 'International cooperative development resources for new and growing producer organisations.',
    bestFor: ['Cooperative organisers'],
    eligibilityHint: 'Open to producer groups exploring formal cooperative structures.',
    nextStep: 'Contact a national cooperative federation in your country.',
    priority: 3,
    externalUrl: 'https://www.ica.coop/en',
    sourceType: 'cooperative',
    countries: ['Default'],
    experiences: ['farm', 'generic'],
    userRoles: ['cooperative', 'ngo_admin'],
  },
  {
    id: 'global-farroway-pilot',
    title: 'Launch a Farroway Pilot',
    category: 'partnership',
    description: 'NGO and program partners can request a 90-day farmer impact pilot with Farroway.',
    bestFor: ['NGO admins', 'Government program managers'],
    eligibilityHint: 'Open to organisations supporting farmers at any scale.',
    nextStep: 'Contact the Farroway team to scope a pilot proposal together.',
    priority: 1,
    externalUrl: 'mailto:partnerships@farroway.app?subject=Farroway%20Pilot%20Inquiry',
    sourceType: 'partnership',
    countries: ['Default'],
    experiences: ['farm', 'backyard', 'generic'],
    userRoles: ['ngo_admin', 'government_program'],
  },
];

/**
 * FUNDING_CATALOG — flattened list. The recommendation engine
 * iterates this once per request; the catalog is intentionally
 * small (< 30 cards) so cost is negligible.
 */
export const FUNDING_CATALOG = Object.freeze([
  ...GHANA,
  ...UNITED_STATES,
  ...NIGERIA,
  ...KENYA,
  ...GLOBAL,
]);

/**
 * getRegionFundingCatalog(country) — returns the cards explicitly
 * tagged for a country. Falls back to GLOBAL when the country has
 * no entries (including unknown / planned regions).
 */
export function getRegionFundingCatalog(country) {
  const c = country && typeof country === 'string' ? country : null;
  const matched = FUNDING_CATALOG.filter((card) =>
    Array.isArray(card.countries) && c
      ? card.countries.includes(c)
      : false
  );
  if (matched.length > 0) return matched;
  return GLOBAL.slice();
}

export const _internal = Object.freeze({
  GHANA, UNITED_STATES, NIGERIA, KENYA, GLOBAL,
});
