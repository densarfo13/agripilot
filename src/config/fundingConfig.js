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
 * Schema migration (Apr 2026)
 * ───────────────────────────
 * Reshaped to match the Smart Funding spec:
 *   • `country` is now a single string (with `'global'` for cross-
 *     region cards). The engine's filter normalises legacy
 *     `countries: string[]` payloads transparently.
 *   • `priority` is the literal string `'high' | 'medium' | 'low'`
 *     (was numeric 1..5). Engine scoring updated accordingly.
 *   • `bestFor` carries farm-type slugs (`small_farm`,
 *     `community_farm`, `backyard`, `home_garden`, `ngo_program`,
 *     `large_farm`). The FundingCard renders them via a label
 *     map so the data layer stays purely-typed.
 *   • Richer `category` enum: cooperative / input_support /
 *     extension / urban_agriculture / government / ngo /
 *     food_security / climate_smart / buyer_market / training /
 *     partnership.
 *
 * Trust + compliance (per spec §13)
 * ─────────────────────────────────
 *   • Cautious wording — "May be eligible", "Explore this option",
 *     "Prepare your documents", "Contact the program". Never
 *     "approved", "guaranteed", "you qualify".
 *   • External URLs point at OFFICIAL pages where the program is
 *     described by its issuing body.
 *   • Per-card `disclaimer` rendered by the consumer.
 *
 * No country logic is hardcoded outside this file. UI surfaces
 * read through the recommendation engine, which reads from here.
 */

/** @typedef {'cooperative'|'input_support'|'extension'|'urban_agriculture'|'government'|'ngo'|'food_security'|'climate_smart'|'buyer_market'|'training'|'partnership'} FundingCategory */
/** @typedef {'farmer'|'backyard_grower'|'ngo_admin'|'cooperative'|'government_program'|'extension_partner'} FundingUserRole */
/** @typedef {'farm'|'backyard'|'generic'} FundingExperience */
/** @typedef {'high'|'medium'|'low'} FundingPriority */

export const FUNDING_USER_ROLES = Object.freeze([
  'farmer',
  'backyard_grower',
  'ngo_admin',
  'cooperative',
  'government_program',
  'extension_partner',
]);

export const FUNDING_CATEGORIES = Object.freeze([
  'cooperative',
  'input_support',
  'extension',
  'urban_agriculture',
  'government',
  'ngo',
  'food_security',
  'climate_smart',
  'buyer_market',
  'training',
  'partnership',
]);

/**
 * Farm-type slug → readable label. The FundingCard renders chips
 * via `tStrict('funding.bestFor.<slug>', FARM_TYPE_LABELS[slug])`
 * so non-English UIs get localised chips while the data layer
 * stays slug-typed.
 */
export const FARM_TYPE_LABELS = Object.freeze({
  small_farm:     'Small farm',
  community_farm: 'Community farm',
  ngo_program:    'NGO program',
  backyard:       'Backyard',
  home_garden:    'Home garden',
  large_farm:     'Large farm',
});

export const FUNDING_DISCLAIMERS = Object.freeze({
  default:  'Farroway does not guarantee funding. Always verify requirements with the official program.',
  external: 'External link — opens in a new tab on the official program page.',
});

// ─── Catalog ────────────────────────────────────────────────────

const GHANA = [
  {
    id: 'ghana-cooperative-support',
    country: 'Ghana',
    category: 'cooperative',
    title: 'Farmer Cooperative Support',
    description: 'Local cooperatives may offer shared resources, inputs, training, and buyer connections.',
    bestFor: ['small_farm', 'community_farm', 'ngo_program'],
    eligibilityHint: 'Best for farmers with active crop production and local community participation.',
    nextStep: 'Contact a local cooperative leader, district agriculture office, or farmer group.',
    priority: 'high',
    sourceType: 'cooperative',
    externalUrl: 'https://www.gawu.org/',
    disclaimer: 'Availability depends on your district and cooperative participation.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'extension_partner'],
  },
  {
    id: 'ghana-input-support',
    country: 'Ghana',
    category: 'input_support',
    title: 'Agriculture Input Support Programs',
    description: 'Programs that may help farmers access seeds, fertilizer, tools, and training.',
    bestFor: ['small_farm', 'community_farm'],
    eligibilityHint: 'Best for farmers with a completed farm profile, crop type, and location.',
    nextStep: 'Check with regional agriculture offices, NGOs, or community farmer groups.',
    priority: 'high',
    sourceType: 'ngo',
    externalUrl: 'https://mofa.gov.gh/site/programmes/planting-for-food-jobs',
    disclaimer: 'Farroway does not guarantee input support. Always verify with the official program.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative'],
  },
  {
    id: 'ghana-climate-smart-ag',
    country: 'Ghana',
    category: 'climate_smart',
    title: 'Climate-Smart Agriculture Programs',
    description: 'Support and training programs focused on rainfall, soil health, resilience, and sustainable farming practices.',
    bestFor: ['small_farm', 'community_farm', 'ngo_program'],
    eligibilityHint: 'Useful for farmers tracking activities, weather risks, and crop progress.',
    nextStep: 'Prepare your farm profile, crop details, and activity history before contacting programs.',
    priority: 'medium',
    sourceType: 'ngo',
    externalUrl: 'https://mastercardfdn.org/young-africa-works/',
    disclaimer: 'Program requirements vary by organization and location.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
  {
    id: 'ghana-buyer-market-linkage',
    country: 'Ghana',
    category: 'buyer_market',
    title: 'Buyer and Market Linkage Programs',
    description: 'Programs that may connect farmers to buyers, aggregators, or market access partners.',
    bestFor: ['small_farm', 'community_farm'],
    eligibilityHint: 'Best when your produce is near harvest and your farm profile is updated.',
    nextStep: 'Keep your crop status updated and confirm when produce is ready.',
    priority: 'medium',
    sourceType: 'partner',
    externalUrl: 'https://www.ghanaagrihub.com/',
    disclaimer: 'Market access depends on buyer demand, location, quality, and availability.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
];

const UNITED_STATES = [
  {
    id: 'us-cooperative-extension',
    country: 'United States',
    category: 'extension',
    title: 'Local Cooperative Extension Services',
    description: 'Free or low-cost local guidance, training, and support for gardeners, small farmers, and growers.',
    bestFor: ['backyard', 'home_garden', 'small_farm'],
    eligibilityHint: 'Available to many residents through county or state extension offices.',
    nextStep: 'Search for your county cooperative extension office and ask about gardening or small farm support.',
    priority: 'high',
    sourceType: 'extension',
    externalUrl: 'https://www.nifa.usda.gov/about-nifa/how-we-work/extension/cooperative-extension-system',
    disclaimer: 'Services vary by state and county.',
    experiences: ['farm', 'backyard'],
    userRoles: ['farmer', 'backyard_grower', 'extension_partner'],
  },
  {
    id: 'us-urban-agriculture',
    country: 'United States',
    category: 'urban_agriculture',
    title: 'Urban Agriculture Support',
    description: 'Local programs supporting home gardens, community gardens, urban farms, and food access projects.',
    bestFor: ['backyard', 'home_garden', 'community_farm'],
    eligibilityHint: 'Best for urban or suburban growers and community food projects.',
    nextStep: 'Check local city, county, nonprofit, or extension resources.',
    priority: 'medium',
    sourceType: 'government',
    externalUrl: 'https://www.usda.gov/topics/urban',
    disclaimer: 'Program availability depends on your city, county, and project type.',
    experiences: ['backyard'],
    userRoles: ['backyard_grower', 'farmer'],
  },
  {
    id: 'us-beginning-farmer',
    country: 'United States',
    category: 'government',
    title: 'Beginning Farmer Support',
    description: 'Programs and resources that may support new farmers with training, planning, and technical assistance.',
    bestFor: ['small_farm', 'large_farm'],
    eligibilityHint: 'Best for new or early-stage farmers with a clear farm plan and location.',
    nextStep: 'Prepare your farm profile, crop plan, and basic business information before applying.',
    priority: 'medium',
    sourceType: 'government',
    externalUrl: 'https://www.nifa.usda.gov/grants/programs/beginning-farmer-rancher-development-program',
    disclaimer: 'Requirements vary by program. Verify directly with official sources.',
    experiences: ['farm'],
    userRoles: ['farmer'],
  },
  {
    id: 'us-nrcs-conservation',
    country: 'United States',
    category: 'government',
    title: 'Conservation and Land Stewardship Support',
    description: 'Programs that may help farmers improve soil health, water use, conservation practices, and resilience.',
    bestFor: ['small_farm', 'large_farm'],
    eligibilityHint: 'Best for farms with land management, soil, water, or conservation goals.',
    nextStep: 'Contact your local agricultural service center or conservation office.',
    priority: 'medium',
    sourceType: 'government',
    externalUrl: 'https://www.nrcs.usda.gov/programs-initiatives/eqip-environmental-quality-incentives',
    disclaimer: 'Eligibility depends on land, operation type, and program rules.',
    experiences: ['farm'],
    userRoles: ['farmer'],
  },
  {
    id: 'us-master-gardener',
    country: 'United States',
    category: 'extension',
    title: 'Master Gardener Program',
    description: 'University extension volunteer training that connects backyard growers with local horticulture experts.',
    bestFor: ['backyard', 'home_garden'],
    eligibilityHint: 'Open to home growers in most U.S. states — explore your local program.',
    nextStep: 'Find your county Master Gardener program and check application windows.',
    priority: 'medium',
    sourceType: 'extension',
    externalUrl: 'https://mastergardener.extension.org/',
    disclaimer: 'Services vary by state and county.',
    experiences: ['backyard'],
    userRoles: ['backyard_grower'],
  },
  {
    id: 'us-community-garden-resource',
    country: 'United States',
    category: 'urban_agriculture',
    title: 'Community Garden Support',
    description: 'Local government and nonprofit resources for starting or joining a community garden.',
    bestFor: ['backyard', 'home_garden', 'community_farm'],
    eligibilityHint: 'Most U.S. cities offer some form of community garden support — check locally.',
    nextStep: 'Contact your city parks or sustainability office to ask about available plots.',
    priority: 'low',
    sourceType: 'local_program',
    externalUrl: 'https://communitygarden.org/',
    disclaimer: 'Program availability depends on your city, county, and project type.',
    experiences: ['backyard'],
    userRoles: ['backyard_grower'],
  },
];

const NIGERIA = [
  {
    id: 'ng-anchor-borrowers',
    country: 'Nigeria',
    category: 'government',
    title: 'Anchor Borrowers\u2019 Programme',
    description: 'Central Bank of Nigeria scheme connecting smallholder farmers with off-takers and input financing.',
    bestFor: ['small_farm', 'community_farm'],
    eligibilityHint: 'May be eligible if you farm a target commodity through a registered cooperative.',
    nextStep: 'Contact a participating bank or cooperative office.',
    priority: 'high',
    sourceType: 'government',
    externalUrl: 'https://www.cbn.gov.ng/devfin/abp.asp',
    disclaimer: 'Eligibility varies by commodity, region, and partner bank.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative'],
  },
  {
    id: 'ng-climate-smart',
    country: 'Nigeria',
    category: 'climate_smart',
    title: 'Climate-Smart Agriculture Programs',
    description: 'NGO and donor-funded programs supporting climate-resilient practices for smallholders.',
    bestFor: ['small_farm', 'community_farm', 'ngo_program'],
    eligibilityHint: 'May be eligible if your farm is in a vulnerable agro-ecological zone.',
    nextStep: 'Explore active programs through your state ADP office.',
    priority: 'high',
    sourceType: 'ngo',
    externalUrl: 'https://www.ifad.org/en/web/operations/w/country/nigeria',
    disclaimer: 'Program requirements vary by organization and location.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
];

const KENYA = [
  {
    id: 'ke-asdsp',
    country: 'Kenya',
    category: 'government',
    title: 'Agricultural Sector Development Support Programme',
    description: 'Government program supporting smallholder commercialisation and value chain development.',
    bestFor: ['small_farm', 'community_farm'],
    eligibilityHint: 'May be eligible through your county agriculture office.',
    nextStep: 'Visit your county ASDSP office to confirm current activities.',
    priority: 'high',
    sourceType: 'government',
    externalUrl: 'https://www.kilimo.go.ke/',
    disclaimer: 'Activity availability varies by county.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative'],
  },
  {
    id: 'ke-climate-smart',
    country: 'Kenya',
    category: 'climate_smart',
    title: 'Kenya Climate Smart Agriculture Project',
    description: 'World Bank–supported project promoting climate-smart practices for smallholders.',
    bestFor: ['small_farm', 'community_farm', 'ngo_program'],
    eligibilityHint: 'May be eligible through county-level KCSAP teams.',
    nextStep: 'Contact your county KCSAP coordinator.',
    priority: 'high',
    sourceType: 'ngo',
    externalUrl: 'https://www.kilimo.go.ke/kcsap/',
    disclaimer: 'Activities and selection criteria vary by county.',
    experiences: ['farm'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
];

const GLOBAL = [
  {
    id: 'global-food-security-programs',
    country: 'global',
    category: 'food_security',
    title: 'Food Security Programs',
    description: 'Programs that support food production, farmer training, and improved access to nutritious food.',
    bestFor: ['small_farm', 'community_farm', 'ngo_program'],
    eligibilityHint: 'Useful for farmers or groups connected to food access, training, or community agriculture.',
    nextStep: 'Search for local NGOs, agriculture offices, or food security organizations in your area.',
    priority: 'medium',
    sourceType: 'global',
    externalUrl: 'https://www.fao.org/in-action/all-programmes/en/',
    disclaimer: 'Availability and requirements vary by country and organization.',
    experiences: ['farm', 'generic'],
    userRoles: ['farmer', 'cooperative', 'ngo_admin'],
  },
  {
    id: 'global-climate-smart-agriculture',
    country: 'global',
    category: 'climate_smart',
    title: 'Climate-Smart Agriculture Support',
    description: 'Programs focused on climate resilience, sustainable farming, water use, and crop risk reduction.',
    bestFor: ['small_farm', 'community_farm', 'ngo_program'],
    eligibilityHint: 'Best for farmers tracking weather, crop risks, and sustainable practices.',
    nextStep: 'Prepare farm location, crop type, activity history, and challenges you are facing.',
    priority: 'medium',
    sourceType: 'global',
    externalUrl: 'https://www.fao.org/climate-smart-agriculture/en/',
    disclaimer: 'Farroway helps you discover opportunities but does not guarantee approval.',
    experiences: ['farm', 'backyard', 'generic'],
    userRoles: ['farmer', 'backyard_grower', 'extension_partner', 'ngo_admin'],
  },
  {
    id: 'global-training-extension',
    country: 'global',
    category: 'training',
    title: 'Farmer Training and Extension Resources',
    description: 'Training programs that may help farmers improve crop care, pest inspection, storage, and market readiness.',
    bestFor: ['backyard', 'home_garden', 'small_farm', 'community_farm'],
    eligibilityHint: 'Useful for farmers who want practical guidance and local training.',
    nextStep: 'Look for local extension services, farmer groups, NGOs, or agriculture departments.',
    priority: 'low',
    sourceType: 'global',
    externalUrl: 'https://www.fao.org/family-farming/themes/extension-services/en/',
    disclaimer: 'Training resources vary by region.',
    experiences: ['farm', 'backyard', 'generic'],
    userRoles: ['farmer', 'backyard_grower', 'extension_partner'],
  },
  {
    id: 'global-cooperative-development',
    country: 'global',
    category: 'cooperative',
    title: 'Cooperative Development Programs',
    description: 'International cooperative development resources for new and growing producer organisations.',
    bestFor: ['small_farm', 'community_farm', 'ngo_program'],
    eligibilityHint: 'Open to producer groups exploring formal cooperative structures.',
    nextStep: 'Contact a national cooperative federation in your country.',
    priority: 'medium',
    sourceType: 'global',
    externalUrl: 'https://www.ica.coop/en',
    disclaimer: 'Cooperative formation rules vary by country.',
    experiences: ['farm', 'generic'],
    userRoles: ['cooperative', 'ngo_admin'],
  },
  {
    id: 'global-farroway-pilot',
    country: 'global',
    category: 'partnership',
    title: 'Launch a Farroway Pilot',
    description: 'NGO and program partners can request a 90-day farmer impact pilot with Farroway.',
    bestFor: ['ngo_program', 'community_farm'],
    eligibilityHint: 'Open to organisations supporting farmers at any scale.',
    nextStep: 'Contact the Farroway team to scope a pilot proposal together.',
    priority: 'high',
    sourceType: 'partner',
    externalUrl: 'mailto:partnerships@farroway.app?subject=Farroway%20Pilot%20Inquiry',
    disclaimer: 'Pilot terms vary by partner scope and region.',
    experiences: ['farm', 'backyard', 'generic'],
    userRoles: ['ngo_admin', 'government_program'],
  },
];

/**
 * FUNDING_PROGRAMS — flattened list. Spec name. The previous
 * `FUNDING_CATALOG` export is kept as an alias below for any
 * existing consumers.
 */
export const FUNDING_PROGRAMS = Object.freeze([
  ...GHANA,
  ...UNITED_STATES,
  ...NIGERIA,
  ...KENYA,
  ...GLOBAL,
]);

/** @deprecated kept for backwards compatibility — use FUNDING_PROGRAMS. */
export const FUNDING_CATALOG = FUNDING_PROGRAMS;

/**
 * getRegionFundingCatalog(country) — returns the cards explicitly
 * tagged for a country. Falls back to GLOBAL when the country has
 * no entries (including unknown / planned regions).
 */
export function getRegionFundingCatalog(country) {
  const c = country && typeof country === 'string' ? country : null;
  if (!c) return GLOBAL.slice();
  const matched = FUNDING_PROGRAMS.filter((card) => card.country === c);
  if (matched.length > 0) return matched;
  return GLOBAL.slice();
}

export const _internal = Object.freeze({
  GHANA, UNITED_STATES, NIGERIA, KENYA, GLOBAL,
});
