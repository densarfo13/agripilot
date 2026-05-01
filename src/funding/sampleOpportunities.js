/**
 * sampleOpportunities.js — three DEMO funding opportunities
 * seeded into the local store on first run.
 *
 * Why these exist
 *   * The funding store is local-first. With no backend, a
 *     fresh install would surface zero matches and the
 *     /opportunities page would look broken in demos.
 *   * Each opportunity carries `sample: true` so the UI can
 *     render a "SAMPLE" pill alongside it. Operators must
 *     replace these with real, verified opportunities
 *     before launch.
 *
 * Trust + compliance audit (per spec § 13)
 *   * Every entry has `verified: true` AND `sample: true`.
 *     The page reads BOTH fields — sample data shows the
 *     SAMPLE badge so a farmer is never told a fake program
 *     exists.
 *   * Wording is conservative: "support", "training",
 *     "may qualify", "check requirements". Never "approved",
 *     "guaranteed", or "you qualify".
 *   * Each carries a `sourceName` + a placeholder
 *     `sourceUrl` so the farmer can independently verify
 *     before acting.
 */

export const SAMPLE_FUNDING_OPPORTUNITIES = Object.freeze([
  Object.freeze({
    id:               'sample-input-support',
    // The redundant "(SAMPLE)" suffix is dropped from the title —
    // the `sample: true` flag below is what surfaces the SAMPLE
    // badge in the UI, so the title can stay clean.
    title:            'Smallholder Seed & Input Support',
    description:
      'A seed and fertiliser support program for smallholder farmers '
      + 'cultivating staple crops. May cover a portion of input costs '
      + 'for the next planting season. Check requirements before applying.',
    country:          '*',                       // any country
    regions:          [],                        // any region
    crops:            ['maize', 'cassava', 'rice', 'sorghum', 'millet'],
    opportunityType:  'input_support',
    benefit:          'Up to 50% off seed and fertiliser inputs',
    eligibilityText:
      'Smallholder farmers cultivating one of the listed staple crops. '
      + 'Farm size up to 5 hectares. Verification required.',
    minFarmSize:      0,
    maxFarmSize:      5,
    deadline:         null,                      // rolling
    sourceName:       'Sample Programme',
    sourceUrl:        'https://farroway.app/funding/sample',
    contactEmail:     'partnership@farroway.app',
    active:           true,
    verified:         true,
    sample:           true,
    createdAt:        new Date(0).toISOString(),
    updatedAt:        new Date(0).toISOString(),
  }),

  Object.freeze({
    id:               'sample-training',
    title:            'Climate-Smart Farming Training',
    description:
      'A free training program covering climate-resilient practices, '
      + 'soil health, and post-harvest handling. Open to all crops '
      + 'and regions. Sessions run quarterly.',
    country:          '*',
    regions:          [],
    crops:            [],                        // any crop
    opportunityType:  'training',
    benefit:          'Free training + certificate of completion',
    eligibilityText:
      'Open to any active farmer. Contact source for the next intake. '
      + 'Check requirements before applying.',
    minFarmSize:      0,
    maxFarmSize:      9999,
    deadline:         null,
    sourceName:       'Sample Training Programme',
    sourceUrl:        'https://farroway.app/funding/sample',
    contactEmail:     'partnership@farroway.app',
    active:           true,
    verified:         true,
    sample:           true,
    createdAt:        new Date(0).toISOString(),
    updatedAt:        new Date(0).toISOString(),
  }),

  Object.freeze({
    id:               'sample-grant',
    title:            'Smallholder Productivity Grant',
    description:
      'A productivity-focused grant for smallholder farms. Covers up '
      + 'to a fixed amount toward equipment or improved inputs. '
      + 'Selection criteria apply — check requirements before applying.',
    country:          '*',
    regions:          [],
    crops:            [],
    opportunityType:  'grant',
    benefit:          'Up to USD 500 toward equipment or inputs',
    eligibilityText:
      'Active farmer with a registered farm of up to 3 hectares. '
      + 'Pilot region preferred but not required. Selection by review.',
    minFarmSize:      0,
    maxFarmSize:      3,
    deadline:         null,
    sourceName:       'Sample Grant Programme',
    sourceUrl:        'https://farroway.app/funding/sample',
    contactEmail:     'partnership@farroway.app',
    active:           true,
    verified:         true,
    sample:           true,
    createdAt:        new Date(0).toISOString(),
    updatedAt:        new Date(0).toISOString(),
  }),
]);

export default SAMPLE_FUNDING_OPPORTUNITIES;
