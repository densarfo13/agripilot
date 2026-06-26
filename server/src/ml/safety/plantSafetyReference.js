/**
 * plantSafetyReference.js — the SERVER's canonical safety reference data.
 *
 * The browser PlantReference (src/runtime/scan/v12/PlantReference.ts) is TypeScript and
 * cannot be imported by the pure-ESM server, and src/ is not guaranteed present in the
 * server's deployed filesystem. So the server owns this copy of the edibility/toxicity
 * facts. To keep ONE source of truth, scripts/check-plant-safety-engine.mjs enforces that
 * every id + scientificName + edibility + toxicity here is byte-identical to the browser
 * PlantReference — drift fails the build.
 *
 * Deliberately bounded curated botanical facts. Better a confident "unknown" for an
 * unlisted plant than a fabricated entry. No fabrication.
 */

// When this safety reference was last curated / reviewed (static — NOT runtime now()).
export const SAFETY_REFERENCE_REVIEWED_ON = '2026-06-26';
export const SAFETY_REFERENCE_SOURCE = 'curated_plant_reference';
export const SAFETY_REFERENCE_VERSION = 'plant-safety-reference-v1';

export const SAFETY_REFERENCE = Object.freeze([
  { id: 'maize', matches: ['maize', 'corn', 'mealie'], scientificName: 'Zea mays', edibility: 'Grain edible when mature/cooked', toxicity: 'None known to humans', medicinalUse: 'Corn silk used traditionally as a diuretic' },
  { id: 'rice', matches: ['rice', 'paddy'], scientificName: 'Oryza sativa', edibility: 'Grain edible when milled/cooked', toxicity: 'None known', medicinalUse: 'Rice water used traditionally for digestion' },
  { id: 'cassava', matches: ['cassava', 'manioc', 'yuca', 'tapioca'], scientificName: 'Manihot esculenta', edibility: 'Tuber edible ONLY after proper processing (soaking/cooking)', toxicity: 'Raw tubers/leaves contain cyanogenic glycosides — toxic if not processed', medicinalUse: 'Leaves used traditionally as a poultice' },
  { id: 'cocoa', matches: ['cocoa', 'cacao'], scientificName: 'Theobroma cacao', edibility: 'Seeds edible after fermentation/roasting', toxicity: 'Theobromine — toxic to dogs/cats, not humans', medicinalUse: 'Flavanols studied for circulation' },
  { id: 'tomato', matches: ['tomato'], scientificName: 'Solanum lycopersicum', edibility: 'Fruit edible ripe', toxicity: 'Leaves/stems contain solanine — not for eating', medicinalUse: 'Lycopene studied as an antioxidant' },
  { id: 'pepper', matches: ['pepper', 'chili', 'chilli', 'capsicum'], scientificName: 'Capsicum annuum', edibility: 'Fruit edible', toxicity: 'None known; capsaicin is an irritant', medicinalUse: 'Capsaicin used topically for pain' },
  { id: 'onion', matches: ['onion', 'shallot'], scientificName: 'Allium cepa', edibility: 'Bulb edible', toxicity: 'Toxic to dogs/cats, not humans', medicinalUse: 'Traditional antimicrobial use' },
  { id: 'cowpea', matches: ['cowpea', 'black-eyed pea', 'beans', 'bean'], scientificName: 'Vigna unguiculata', edibility: 'Seeds/leaves edible cooked', toxicity: 'None known when cooked', medicinalUse: 'Traditional use for kidney health' },
  { id: 'groundnut', matches: ['groundnut', 'peanut'], scientificName: 'Arachis hypogaea', edibility: 'Seeds edible (allergen)', toxicity: 'Aflatoxin risk if mouldy — common allergen', medicinalUse: 'Source of dietary protein/oil' },
  { id: 'plantain', matches: ['plantain', 'banana'], scientificName: 'Musa × paradisiaca', edibility: 'Fruit edible (cooked for plantain)', toxicity: 'None known', medicinalUse: 'Traditional use for ulcers' },
  { id: 'yam', matches: ['yam'], scientificName: 'Dioscorea rotundata', edibility: 'Tuber edible cooked', toxicity: 'Some wild Dioscorea are toxic raw — cultivated yam safe cooked', medicinalUse: 'Diosgenin studied in some species' },
  { id: 'sorghum', matches: ['sorghum', 'guinea corn'], scientificName: 'Sorghum bicolor', edibility: 'Grain edible cooked', toxicity: 'Young shoots can contain dhurrin (cyanogenic) — mature grain safe', medicinalUse: 'Traditional use for digestion' },
]);

const _norm = (s) => (typeof s === 'string' ? s : '').toLowerCase().trim();

/** Real reference for a confidently-named plant, or null (→ honest 'unknown'). */
export function lookupSafetyReference(name) {
  const n = _norm(name);
  if (!n) return null;
  for (const r of SAFETY_REFERENCE) {
    if (r.id === n) return r;
    for (const m of r.matches) if (n === m || n.includes(m)) return r;
  }
  return null;
}

export function safetyReferenceCount() { return SAFETY_REFERENCE.length; }
