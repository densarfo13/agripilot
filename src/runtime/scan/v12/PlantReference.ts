/**
 * PlantReference.ts — Scan Intelligence v12 botanical reference.
 *
 * Real reference data (a field guide) for confidently-identified crops: scientific
 * name, family, genus, edibility, toxicity, medicinal use, pollinator value,
 * companions. For anything NOT in the reference, lookup returns `null` and the
 * orchestrator reports the metadata as `unknown` — we never invent a binomial,
 * a toxicity, or an edibility we don't actually have.
 *
 * Pure, total, browser-safe.
 */
export interface PlantRef {
  id: string;
  matches: ReadonlyArray<string>;     // lowercase aliases
  scientificName: string;
  family: string;
  genus: string;
  species: string;
  commonNames: ReadonlyArray<string>;
  lifeCycle: 'annual' | 'biennial' | 'perennial';
  nativeRegion: string;
  edibility: string;                  // honest phrase
  toxicity: string;                   // honest phrase ('none known' is a real fact)
  medicinalUse: string;
  pollinatorValue: 'high' | 'medium' | 'low' | 'none';
  companionPlants: ReadonlyArray<string>;
  avoidPlantingWith: ReadonlyArray<string>;
  difficulty: number;                 // 1 (easy) .. 5 (hard)
}

// Curated, real botanical facts for common smallholder crops. Deliberately bounded
// — better a confident "unknown" for an unlisted plant than a fabricated entry.
const REF: ReadonlyArray<PlantRef> = Object.freeze([
  { id: 'maize', matches: ['maize', 'corn', 'mealie'], scientificName: 'Zea mays', family: 'Poaceae', genus: 'Zea', species: 'Z. mays', commonNames: ['Maize', 'Corn'], lifeCycle: 'annual', nativeRegion: 'Mesoamerica', edibility: 'Grain edible when mature/cooked', toxicity: 'None known to humans', medicinalUse: 'Corn silk used traditionally as a diuretic', pollinatorValue: 'low', companionPlants: ['beans', 'squash', 'cowpea'], avoidPlantingWith: ['tomato'], difficulty: 2 },
  { id: 'rice', matches: ['rice', 'paddy'], scientificName: 'Oryza sativa', family: 'Poaceae', genus: 'Oryza', species: 'O. sativa', commonNames: ['Rice'], lifeCycle: 'annual', nativeRegion: 'Asia', edibility: 'Grain edible when milled/cooked', toxicity: 'None known', medicinalUse: 'Rice water used traditionally for digestion', pollinatorValue: 'low', companionPlants: ['azolla'], avoidPlantingWith: [], difficulty: 3 },
  { id: 'cassava', matches: ['cassava', 'manioc', 'yuca', 'tapioca'], scientificName: 'Manihot esculenta', family: 'Euphorbiaceae', genus: 'Manihot', species: 'M. esculenta', commonNames: ['Cassava', 'Manioc'], lifeCycle: 'perennial', nativeRegion: 'South America', edibility: 'Tuber edible ONLY after proper processing (soaking/cooking)', toxicity: 'Raw tubers/leaves contain cyanogenic glycosides — toxic if not processed', medicinalUse: 'Leaves used traditionally as a poultice', pollinatorValue: 'low', companionPlants: ['maize', 'cowpea'], avoidPlantingWith: [], difficulty: 2 },
  { id: 'cocoa', matches: ['cocoa', 'cacao'], scientificName: 'Theobroma cacao', family: 'Malvaceae', genus: 'Theobroma', species: 'T. cacao', commonNames: ['Cocoa', 'Cacao'], lifeCycle: 'perennial', nativeRegion: 'Amazon basin', edibility: 'Seeds edible after fermentation/roasting', toxicity: 'Theobromine — toxic to dogs/cats, not humans', medicinalUse: 'Flavanols studied for circulation', pollinatorValue: 'medium', companionPlants: ['plantain', 'banana'], avoidPlantingWith: [], difficulty: 4 },
  { id: 'tomato', matches: ['tomato'], scientificName: 'Solanum lycopersicum', family: 'Solanaceae', genus: 'Solanum', species: 'S. lycopersicum', commonNames: ['Tomato'], lifeCycle: 'annual', nativeRegion: 'South America', edibility: 'Fruit edible ripe', toxicity: 'Leaves/stems contain solanine — not for eating', medicinalUse: 'Lycopene studied as an antioxidant', pollinatorValue: 'medium', companionPlants: ['basil', 'marigold', 'onion'], avoidPlantingWith: ['maize', 'potato'], difficulty: 2 },
  { id: 'pepper', matches: ['pepper', 'chili', 'chilli', 'capsicum'], scientificName: 'Capsicum annuum', family: 'Solanaceae', genus: 'Capsicum', species: 'C. annuum', commonNames: ['Pepper', 'Chili'], lifeCycle: 'annual', nativeRegion: 'Central/South America', edibility: 'Fruit edible', toxicity: 'None known; capsaicin is an irritant', medicinalUse: 'Capsaicin used topically for pain', pollinatorValue: 'medium', companionPlants: ['basil', 'onion'], avoidPlantingWith: ['beans'], difficulty: 2 },
  { id: 'onion', matches: ['onion', 'shallot'], scientificName: 'Allium cepa', family: 'Amaryllidaceae', genus: 'Allium', species: 'A. cepa', commonNames: ['Onion'], lifeCycle: 'biennial', nativeRegion: 'Central Asia', edibility: 'Bulb edible', toxicity: 'Toxic to dogs/cats, not humans', medicinalUse: 'Traditional antimicrobial use', pollinatorValue: 'medium', companionPlants: ['carrot', 'tomato'], avoidPlantingWith: ['beans', 'peas'], difficulty: 2 },
  { id: 'cowpea', matches: ['cowpea', 'black-eyed pea', 'beans', 'bean'], scientificName: 'Vigna unguiculata', family: 'Fabaceae', genus: 'Vigna', species: 'V. unguiculata', commonNames: ['Cowpea', 'Beans'], lifeCycle: 'annual', nativeRegion: 'Africa', edibility: 'Seeds/leaves edible cooked', toxicity: 'None known when cooked', medicinalUse: 'Traditional use for kidney health', pollinatorValue: 'high', companionPlants: ['maize', 'sorghum'], avoidPlantingWith: ['onion'], difficulty: 1 },
  { id: 'groundnut', matches: ['groundnut', 'peanut'], scientificName: 'Arachis hypogaea', family: 'Fabaceae', genus: 'Arachis', species: 'A. hypogaea', commonNames: ['Groundnut', 'Peanut'], lifeCycle: 'annual', nativeRegion: 'South America', edibility: 'Seeds edible (allergen)', toxicity: 'Aflatoxin risk if mouldy — common allergen', medicinalUse: 'Source of dietary protein/oil', pollinatorValue: 'medium', companionPlants: ['maize'], avoidPlantingWith: [], difficulty: 2 },
  { id: 'plantain', matches: ['plantain', 'banana'], scientificName: 'Musa × paradisiaca', family: 'Musaceae', genus: 'Musa', species: 'M. paradisiaca', commonNames: ['Plantain', 'Banana'], lifeCycle: 'perennial', nativeRegion: 'Southeast Asia', edibility: 'Fruit edible (cooked for plantain)', toxicity: 'None known', medicinalUse: 'Traditional use for ulcers', pollinatorValue: 'low', companionPlants: ['cocoa', 'cassava'], avoidPlantingWith: [], difficulty: 2 },
  { id: 'yam', matches: ['yam'], scientificName: 'Dioscorea rotundata', family: 'Dioscoreaceae', genus: 'Dioscorea', species: 'D. rotundata', commonNames: ['Yam'], lifeCycle: 'perennial', nativeRegion: 'West Africa', edibility: 'Tuber edible cooked', toxicity: 'Some wild Dioscorea are toxic raw — cultivated yam safe cooked', medicinalUse: 'Diosgenin studied in some species', pollinatorValue: 'low', companionPlants: ['maize'], avoidPlantingWith: [], difficulty: 3 },
  { id: 'sorghum', matches: ['sorghum', 'guinea corn'], scientificName: 'Sorghum bicolor', family: 'Poaceae', genus: 'Sorghum', species: 'S. bicolor', commonNames: ['Sorghum'], lifeCycle: 'annual', nativeRegion: 'Africa', edibility: 'Grain edible cooked', toxicity: 'Young shoots can contain dhurrin (cyanogenic) — mature grain safe', medicinalUse: 'Traditional use for digestion', pollinatorValue: 'low', companionPlants: ['cowpea'], avoidPlantingWith: [], difficulty: 2 },
]);

const _norm = (s: unknown): string => (typeof s === 'string' ? s : '').toLowerCase().trim();

/** Real reference for a confidently-named plant, or null (→ honest 'unknown'). */
export function lookupPlantReference(name: unknown): PlantRef | null {
  const n = _norm(name);
  if (!n) return null;
  for (const r of REF) {
    if (r.id === n) return r;
    for (const m of r.matches) if (n === m || n.includes(m)) return r;
  }
  return null;
}

export function plantReferenceCount(): number { return REF.length; }
