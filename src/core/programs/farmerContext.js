/**
 * farmerContext.js — generate a default farmer context from
 * an NGO program + farmer row (NGO Onboarding spec §4).
 *
 *   import { buildFarmerContext } from
 *     '../core/programs/farmerContext.js';
 *
 *   const ctx = buildFarmerContext({ farmer, program });
 *   // \u2192 {
 *   //     source:               'ngo',
 *   //     programId,
 *   //     organizationId,
 *   //     activeExperience:     'farm',
 *   //     cropName,
 *   //     country,
 *   //     region,
 *   //     farmSize,             'small' | 'medium' | 'large' | 'unknown'
 *   //     language?,
 *   //     onboardingCompleted:  true
 *   //   }
 *
 * Spec §4 fallthrough order
 * ─────────────────────────
 *   cropName  : farmer.crop      || program.cropFocus
 *   country   : farmer.country   || program.country
 *   region    : farmer.region    || program.region
 *   farmSize  : farmer.farmSize  || program.defaultFarmSize  || 'unknown'
 *   language  : farmer.language  || program.defaultLanguage
 *
 * The fall-through means an NGO can ship a thin row (just
 * farmerId + name + phone) and let the program defaults fill
 * the rest. Or a fat row (per-farmer crop/language/region)
 * that overrides specific fields per farmer.
 *
 * Strict-rule audit
 *   • Pure function. No I/O.
 *   • Never throws. Missing inputs collapse to a usable
 *     fallback shape (source: 'ngo' is preserved so the
 *     routing rule still skips full onboarding).
 *   • Never returns undefined. Every documented field is
 *     either a string, 'unknown' (for farmSize), or null.
 */

const ALLOWED_FARM_SIZE = new Set(['small', 'medium', 'large', 'unknown']);

function _str(v) { return (typeof v === 'string' && v) ? v : null; }

/**
 * buildFarmerContext({ farmer, program, source? })
 *
 * @param {object} input
 * @param {object} [input.farmer]   normalised farmerImport row.
 * @param {object} [input.program]  programStore record.
 * @param {string} [input.source='ngo']  override 'ngo' or 'program'.
 * @returns {object} farmer context (see file header).
 */
export function buildFarmerContext(input) {
  const i = (input && typeof input === 'object') ? input : {};
  const farmer  = (i.farmer  && typeof i.farmer  === 'object') ? i.farmer  : {};
  const program = (i.program && typeof i.program === 'object') ? i.program : {};
  const sourceRaw = typeof i.source === 'string' ? i.source : 'ngo';
  const source = (sourceRaw === 'ngo' || sourceRaw === 'program') ? sourceRaw : 'ngo';

  // farmSize collapses to the canonical taxonomy regardless
  // of whether it came from the farmer row or the program
  // default. Anything outside the taxonomy becomes 'unknown'.
  const sizeRaw = String(
    farmer.farmSize || program.defaultFarmSize || 'unknown',
  ).toLowerCase();
  const farmSize = ALLOWED_FARM_SIZE.has(sizeRaw) ? sizeRaw : 'unknown';

  return {
    source,
    programId:           _str(program.id),
    organizationId:      _str(program.organizationId),
    farmerId:            _str(farmer.farmerId),
    activeExperience:    'farm',
    cropName:            _str(farmer.crop)     || _str(program.cropFocus),
    country:             _str(farmer.country)  || _str(program.country),
    region:              _str(farmer.region)   || _str(program.region),
    farmSize,
    language:            _str(farmer.language) || _str(program.defaultLanguage),
    onboardingCompleted: true,
  };
}

export default buildFarmerContext;
