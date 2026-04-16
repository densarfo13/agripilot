/**
 * Seasonal Rules — planting windows with agronomic context.
 *
 * Each rule specifies when and how to plant a crop in a region/country.
 * Months are 0-indexed (0 = January, 11 = December).
 *
 * Fields:
 *   crop              — crop key from crops.js
 *   country           — ISO 2-letter code (optional — omit for region-wide rules)
 *   region            — region key from regions.js
 *   plantStart        — first good month to plant (0-indexed)
 *   plantEnd          — last good month to plant (0-indexed)
 *   okayMonths        — additional months where planting is possible but suboptimal
 *   risk              — 'low' | 'medium' | 'high' — beginner risk this season
 *   profitSeasonFit   — 'good' | 'okay' | 'poor' — profit potential this window
 *   irrigation        — true if irrigation is helpful/needed for this window
 *   notes             — short agronomic explanation for editors
 *
 * Rules are matched by (crop + region) or (crop + country).
 * Country-specific rules override region-wide rules.
 *
 * The seasonProfitRules engine converts these into the PLANTING_WINDOWS
 * format (good/okay month arrays) used by the scoring system.
 */

export const SEASONAL_RULES = [
  // ═══════════════════════════════════════════════════════════
  // EAST AFRICA — long rains Mar-May, short rains Oct-Dec
  // ═══════════════════════════════════════════════════════════

  // Cereals
  { crop: 'MAIZE',        region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Long rains; short rains for second crop' },
  { crop: 'RICE',         region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],        risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Paddy systems; needs standing water' },
  { crop: 'SORGHUM',      region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [8, 9, 10],    risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Tolerates dry; long and short rains' },
  { crop: 'MILLET',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [9, 10],       risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Very drought-tolerant' },
  { crop: 'WHEAT',        region: 'east_africa', plantStart: 5, plantEnd: 7, okayMonths: [8],           risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Cool highlands; dry season' },

  // Legumes
  { crop: 'BEAN',         region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Both rain seasons; 90-day crop' },
  { crop: 'GROUNDNUT',    region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Well-drained soils; long rains' },
  { crop: 'COWPEA',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 9, 10],    risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Drought-hardy; fixes nitrogen' },
  { crop: 'SOYBEAN',      region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [9, 10],       risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Long rains preferred' },
  { crop: 'PEA',          region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Cool highlands; both seasons' },

  // Roots & Tubers
  { crop: 'CASSAVA',      region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: '12-18 month crop; plant at rains onset' },
  { crop: 'SWEET_POTATO', region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Quick 3-4 month cycle' },
  { crop: 'YAM',          region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4],           risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Limited in East Africa' },
  { crop: 'POTATO',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Highland; two seasons possible' },

  // Vegetables
  { crop: 'TOMATO',       region: 'east_africa', plantStart: 8, plantEnd: 10, okayMonths: [2, 3],       risk: 'high',   profitSeasonFit: 'good', irrigation: true,  notes: 'Dry season with irrigation for quality' },
  { crop: 'ONION',        region: 'east_africa', plantStart: 5, plantEnd: 6, okayMonths: [0, 1, 7],     risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Dry period; needs controlled moisture' },
  { crop: 'PEPPER',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 9, 10],    risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Both rain seasons' },
  { crop: 'OKRA',         region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [9, 10],       risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Warm season; quick harvest' },
  { crop: 'CABBAGE',      region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Highland; both seasons' },
  { crop: 'KALE',         region: 'east_africa', plantStart: 0, plantEnd: 11, okayMonths: [],            risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Year-round in highlands' },
  { crop: 'SPINACH',      region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [0,1,5,6,7,8,9,10,11], risk: 'low', profitSeasonFit: 'okay', irrigation: false, notes: 'Nearly year-round' },
  { crop: 'CUCUMBER',     region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Rain seasons' },
  { crop: 'CARROT',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Highland; both seasons' },
  { crop: 'WATERMELON',   region: 'east_africa', plantStart: 9, plantEnd: 10, okayMonths: [2, 3],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Dry/short rains; needs warmth' },
  { crop: 'EGGPLANT',     region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Both rain seasons' },

  // Spices
  { crop: 'GINGER',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4],           risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: '8-10 month crop; plant early rains' },
  { crop: 'CHILI',        region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 9, 10],    risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Hardy; both seasons' },
  { crop: 'GARLIC',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [8, 9],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Highland; 4-5 month cycle' },

  // Fruits
  { crop: 'BANANA',       region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Plant at rains; perennial once established' },
  { crop: 'PLANTAIN',     region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Perennial; plant at rain onset' },
  { crop: 'MANGO',        region: 'east_africa', plantStart: 9, plantEnd: 11, okayMonths: [2, 3],       risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Tree; plant seedling at short rains' },
  { crop: 'PAPAYA',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: '9-12 month to first fruit' },
  { crop: 'AVOCADO',      region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Tree; 3-5 years to production' },
  { crop: 'PINEAPPLE',    region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: '18-24 months to harvest' },

  // Cash crops
  { crop: 'COFFEE',       region: 'east_africa', plantStart: 3, plantEnd: 4, okayMonths: [9, 10],       risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: 'Tree; 3 years to production' },
  { crop: 'TEA',          region: 'east_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],       risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: 'Perennial; highland only' },
  { crop: 'SUGARCANE',    region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [9, 10],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: '12-18 month crop' },
  { crop: 'COTTON',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [4],           risk: 'medium', profitSeasonFit: 'okay', irrigation: false, notes: 'Long rains; 5-6 months' },
  { crop: 'SUNFLOWER',    region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [8, 9],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: '3-4 month crop' },
  { crop: 'SESAME',       region: 'east_africa', plantStart: 2, plantEnd: 3, okayMonths: [9],           risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Drought-tolerant; marginal lands' },

  // ═══════════════════════════════════════════════════════════
  // WEST AFRICA — main rains Apr-Sep, dry Oct-Mar
  // ═══════════════════════════════════════════════════════════

  // Cereals
  { crop: 'MAIZE',        region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [7, 8],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Major rains; second season Jul-Aug in south' },
  { crop: 'RICE',         region: 'west_africa', plantStart: 5, plantEnd: 7, okayMonths: [3, 4],        risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Peak rains; lowland and upland types' },
  { crop: 'SORGHUM',      region: 'west_africa', plantStart: 5, plantEnd: 6, okayMonths: [7],           risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Northern savanna; one season' },
  { crop: 'MILLET',       region: 'west_africa', plantStart: 5, plantEnd: 6, okayMonths: [7],           risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Sahel zone; earliest rains' },
  { crop: 'WHEAT',        region: 'west_africa', plantStart: 10, plantEnd: 11, okayMonths: [0],         risk: 'medium', profitSeasonFit: 'okay', irrigation: true,  notes: 'Irrigated dry season; very limited' },

  // Legumes
  { crop: 'BEAN',         region: 'west_africa', plantStart: 6, plantEnd: 7, okayMonths: [3, 4],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Late in rain season for harvest in dry' },
  { crop: 'GROUNDNUT',    region: 'west_africa', plantStart: 4, plantEnd: 6, okayMonths: [7],           risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Plant early rains; 3-4 month cycle' },
  { crop: 'COWPEA',       region: 'west_africa', plantStart: 6, plantEnd: 7, okayMonths: [5, 8],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'After cereals; intercrop common' },
  { crop: 'SOYBEAN',      region: 'west_africa', plantStart: 5, plantEnd: 6, okayMonths: [7],           risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Growing demand; Guinea savanna' },

  // Roots & Tubers
  { crop: 'CASSAVA',      region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Plant early rains; 12-18 month crop' },
  { crop: 'YAM',          region: 'west_africa', plantStart: 2, plantEnd: 4, okayMonths: [5],           risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Feb-Apr planting; 6-9 month crop' },
  { crop: 'SWEET_POTATO', region: 'west_africa', plantStart: 4, plantEnd: 5, okayMonths: [6, 7],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: '3-4 month crop; wet season' },
  { crop: 'POTATO',       region: 'west_africa', plantStart: 9, plantEnd: 10, okayMonths: [3, 4],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Dry/cool season; Jos Plateau (NG)' },

  // Vegetables
  { crop: 'TOMATO',       region: 'west_africa', plantStart: 8, plantEnd: 10, okayMonths: [2, 3],       risk: 'high',   profitSeasonFit: 'good', irrigation: true,  notes: 'Dry season with irrigation for best quality' },
  { crop: 'ONION',        region: 'west_africa', plantStart: 9, plantEnd: 11, okayMonths: [0, 1],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Northern dry season crop' },
  { crop: 'PEPPER',       region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Both wet and dry season possible' },
  { crop: 'OKRA',         region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [6, 7],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Quick crop; 45-60 days to harvest' },
  { crop: 'CABBAGE',      region: 'west_africa', plantStart: 8, plantEnd: 9, okayMonths: [3, 4],        risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Cool dry season preferred' },
  { crop: 'SPINACH',      region: 'west_africa', plantStart: 3, plantEnd: 4, okayMonths: [5, 8, 9, 10], risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Multiple harvests; year-round with water' },
  { crop: 'CUCUMBER',     region: 'west_africa', plantStart: 3, plantEnd: 4, okayMonths: [5, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Wet and dry season with irrigation' },
  { crop: 'CARROT',       region: 'west_africa', plantStart: 8, plantEnd: 10, okayMonths: [3, 4],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Cool dry season; needs loose soil' },
  { crop: 'WATERMELON',   region: 'west_africa', plantStart: 9, plantEnd: 11, okayMonths: [2, 3],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Dry season; urban market demand' },
  { crop: 'EGGPLANT',     region: 'west_africa', plantStart: 3, plantEnd: 4, okayMonths: [5, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Garden egg; both seasons' },

  // Spices
  { crop: 'GINGER',       region: 'west_africa', plantStart: 3, plantEnd: 4, okayMonths: [5],           risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: '8-10 months; plant at rain onset' },
  { crop: 'CHILI',        region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Hardy; shito pepper for processing' },
  { crop: 'GARLIC',       region: 'west_africa', plantStart: 9, plantEnd: 10, okayMonths: [11],         risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Dry season; irrigated' },

  // Fruits
  { crop: 'BANANA',       region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Perennial; plant at rains' },
  { crop: 'PLANTAIN',     region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Perennial; staple crop' },
  { crop: 'MANGO',        region: 'west_africa', plantStart: 4, plantEnd: 5, okayMonths: [3],           risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Tree; plant seedling at rains' },
  { crop: 'PAPAYA',       region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: '9-12 months to fruit' },
  { crop: 'PINEAPPLE',    region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: '18-24 months; export quality' },
  { crop: 'AVOCADO',      region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'medium', profitSeasonFit: 'okay', irrigation: false, notes: '3-5 years to production' },
  { crop: 'ORANGE',       region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],        risk: 'medium', profitSeasonFit: 'okay', irrigation: false, notes: 'Tree; citrus belt' },

  // Cash crops
  { crop: 'COCOA',        region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [6],           risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: 'Forest zone; 3-5 years to production' },
  { crop: 'PALM_OIL',     region: 'west_africa', plantStart: 3, plantEnd: 5, okayMonths: [6],           risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: '4-5 years to first harvest' },
  { crop: 'COFFEE',       region: 'west_africa', plantStart: 4, plantEnd: 5, okayMonths: [3],           risk: 'high',   profitSeasonFit: 'okay', irrigation: false, notes: 'Limited scale in West Africa' },
  { crop: 'COTTON',       region: 'west_africa', plantStart: 5, plantEnd: 6, okayMonths: [7],           risk: 'medium', profitSeasonFit: 'okay', irrigation: false, notes: 'Northern savanna; 5-6 months' },
  { crop: 'SUGARCANE',    region: 'west_africa', plantStart: 3, plantEnd: 4, okayMonths: [9, 10],       risk: 'medium', profitSeasonFit: 'okay', irrigation: true,  notes: '12-18 months' },
  { crop: 'SUNFLOWER',    region: 'west_africa', plantStart: 5, plantEnd: 6, okayMonths: [7, 8],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: '3-4 months; guinea savanna' },
  { crop: 'SESAME',       region: 'west_africa', plantStart: 6, plantEnd: 7, okayMonths: [5],           risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Export demand; drought-tolerant' },

  // ═══════════════════════════════════════════════════════════
  // SOUTHERN AFRICA — main rains Nov-Mar, dry Apr-Oct
  // ═══════════════════════════════════════════════════════════

  { crop: 'MAIZE',        region: 'southern_africa', plantStart: 10, plantEnd: 0, okayMonths: [1],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Summer rains; main season' },
  { crop: 'BEAN',         region: 'southern_africa', plantStart: 10, plantEnd: 0, okayMonths: [1, 2],     risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Summer; 90-day crop' },
  { crop: 'RICE',         region: 'southern_africa', plantStart: 10, plantEnd: 11, okayMonths: [0, 1],    risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Irrigated; Mozambique, Malawi' },
  { crop: 'SORGHUM',      region: 'southern_africa', plantStart: 10, plantEnd: 0, okayMonths: [1],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Drought-tolerant; dryland areas' },
  { crop: 'MILLET',       region: 'southern_africa', plantStart: 10, plantEnd: 11, okayMonths: [0],       risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Semi-arid zones' },
  { crop: 'WHEAT',        region: 'southern_africa', plantStart: 4, plantEnd: 6, okayMonths: [3, 7],      risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Winter crop; irrigated' },
  { crop: 'GROUNDNUT',    region: 'southern_africa', plantStart: 10, plantEnd: 0, okayMonths: [1],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Summer rains' },
  { crop: 'COWPEA',       region: 'southern_africa', plantStart: 10, plantEnd: 11, okayMonths: [0, 1],    risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Intercrop with maize' },
  { crop: 'CASSAVA',      region: 'southern_africa', plantStart: 9, plantEnd: 11, okayMonths: [0],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Plant early rains' },
  { crop: 'SWEET_POTATO', region: 'southern_africa', plantStart: 9, plantEnd: 11, okayMonths: [0, 1],     risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Plant before/at rains onset' },
  { crop: 'YAM',          region: 'southern_africa', plantStart: 9, plantEnd: 10, okayMonths: [11],       risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Limited in Southern Africa' },
  { crop: 'POTATO',       region: 'southern_africa', plantStart: 7, plantEnd: 9, okayMonths: [1, 2],      risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Two seasons possible' },
  { crop: 'TOMATO',       region: 'southern_africa', plantStart: 7, plantEnd: 9, okayMonths: [1, 2, 10],  risk: 'high',   profitSeasonFit: 'good', irrigation: true,  notes: 'Spring-planted; greenhouse extends season' },
  { crop: 'ONION',        region: 'southern_africa', plantStart: 3, plantEnd: 5, okayMonths: [2, 6],      risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Autumn planting; winter harvest' },
  { crop: 'PEPPER',       region: 'southern_africa', plantStart: 8, plantEnd: 10, okayMonths: [11, 0],    risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Warm-season crop' },
  { crop: 'OKRA',         region: 'southern_africa', plantStart: 9, plantEnd: 11, okayMonths: [0, 1],     risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Warm-season' },
  { crop: 'CABBAGE',      region: 'southern_africa', plantStart: 2, plantEnd: 4, okayMonths: [7, 8],      risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Cool-season preferred' },
  { crop: 'SPINACH',      region: 'southern_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'low',  profitSeasonFit: 'okay', irrigation: false, notes: 'Cool-season' },
  { crop: 'BANANA',       region: 'southern_africa', plantStart: 9, plantEnd: 11, okayMonths: [0, 1],     risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Subtropical zones' },
  { crop: 'PLANTAIN',     region: 'southern_africa', plantStart: 9, plantEnd: 11, okayMonths: [0, 1],     risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Limited in south' },
  { crop: 'MANGO',        region: 'southern_africa', plantStart: 9, plantEnd: 10, okayMonths: [8, 11],    risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Subtropical; Limpopo, Mpumalanga' },
  { crop: 'COFFEE',       region: 'southern_africa', plantStart: 10, plantEnd: 11, okayMonths: [0],       risk: 'high',   profitSeasonFit: 'okay', irrigation: false, notes: 'Very limited in south' },
  { crop: 'TEA',          region: 'southern_africa', plantStart: 9, plantEnd: 11, okayMonths: [0],        risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: 'Malawi, Kenya highlands' },
  { crop: 'SUGARCANE',    region: 'southern_africa', plantStart: 8, plantEnd: 10, okayMonths: [11],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Lowveld; irrigated' },
  { crop: 'COTTON',       region: 'southern_africa', plantStart: 10, plantEnd: 11, okayMonths: [0],       risk: 'medium', profitSeasonFit: 'okay', irrigation: false, notes: 'Summer crop; Zambezi Valley' },
  { crop: 'SUNFLOWER',    region: 'southern_africa', plantStart: 10, plantEnd: 11, okayMonths: [0],       risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Free State, Limpopo' },
  { crop: 'SOYBEAN',      region: 'southern_africa', plantStart: 10, plantEnd: 0, okayMonths: [1],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Summer crop; Mpumalanga, Free State' },
  { crop: 'CUCUMBER',     region: 'southern_africa', plantStart: 9, plantEnd: 10, okayMonths: [8, 11],    risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Spring-planted' },
  { crop: 'WATERMELON',   region: 'southern_africa', plantStart: 9, plantEnd: 10, okayMonths: [11],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Warm-season' },
  { crop: 'CARROT',       region: 'southern_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 7, 8, 9], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Cool-season; year-round in mild areas' },
  { crop: 'EGGPLANT',     region: 'southern_africa', plantStart: 8, plantEnd: 10, okayMonths: [11],       risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Warm-season' },
  { crop: 'AVOCADO',      region: 'southern_africa', plantStart: 9, plantEnd: 11, okayMonths: [0],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Subtropical; Limpopo' },
  { crop: 'PINEAPPLE',    region: 'southern_africa', plantStart: 9, plantEnd: 10, okayMonths: [11, 0],    risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'KZN; 18-24 months' },

  // ═══════════════════════════════════════════════════════════
  // CENTRAL AFRICA — bimodal: Mar-Jun, Sep-Nov
  // ═══════════════════════════════════════════════════════════

  { crop: 'MAIZE',        region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'First rains preferred' },
  { crop: 'BEAN',         region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'low',  profitSeasonFit: 'good', irrigation: false, notes: 'Both rain seasons' },
  { crop: 'RICE',         region: 'central_africa', plantStart: 3, plantEnd: 5, okayMonths: [8, 9],      risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Lowland; flooded fields' },
  { crop: 'SORGHUM',      region: 'central_africa', plantStart: 3, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Dry savanna zones' },
  { crop: 'CASSAVA',      region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: '#1 staple; DRC, Cameroon' },
  { crop: 'SWEET_POTATO', region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Quick 3-4 month crop' },
  { crop: 'YAM',          region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [4],         risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Cameroon, southern DRC' },
  { crop: 'PLANTAIN',     region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Key staple; forest zone' },
  { crop: 'BANANA',       region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Perennial; humid zones' },
  { crop: 'COCOA',        region: 'central_africa', plantStart: 3, plantEnd: 4, okayMonths: [5, 9],      risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: 'Cameroon major producer' },
  { crop: 'PALM_OIL',     region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [9, 10],     risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: 'Forest zone' },
  { crop: 'COFFEE',       region: 'central_africa', plantStart: 3, plantEnd: 4, okayMonths: [9, 10],     risk: 'high',   profitSeasonFit: 'good', irrigation: false, notes: 'Robusta in DRC, Cameroon' },
  { crop: 'TOMATO',       region: 'central_africa', plantStart: 8, plantEnd: 9, okayMonths: [2, 3],      risk: 'high',   profitSeasonFit: 'good', irrigation: true,  notes: 'Dry-season irrigated preferred' },
  { crop: 'PEPPER',       region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Both seasons' },
  { crop: 'OKRA',         region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Easy; quick harvest' },
  { crop: 'CABBAGE',      region: 'central_africa', plantStart: 8, plantEnd: 9, okayMonths: [2, 3],      risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Cool dry season preferred' },
  { crop: 'GROUNDNUT',    region: 'central_africa', plantStart: 3, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'First rains' },
  { crop: 'COWPEA',       region: 'central_africa', plantStart: 3, plantEnd: 4, okayMonths: [8, 9],      risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Savanna zones' },
  { crop: 'CUCUMBER',     region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Both seasons' },
  { crop: 'EGGPLANT',     region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Garden egg variety' },
  { crop: 'GINGER',       region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [4],         risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Cameroon; long cycle' },
  { crop: 'COTTON',       region: 'central_africa', plantStart: 3, plantEnd: 5, okayMonths: [6],         risk: 'medium', profitSeasonFit: 'okay', irrigation: false, notes: 'Northern savanna; Chad, Cameroon' },
  { crop: 'ONION',        region: 'central_africa', plantStart: 9, plantEnd: 10, okayMonths: [3, 4],     risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Dry season with irrigation' },
  { crop: 'MANGO',        region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [9, 10],     risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Savanna zones' },
  { crop: 'PAPAYA',       region: 'central_africa', plantStart: 2, plantEnd: 3, okayMonths: [4, 8, 9, 10], risk: 'low',  profitSeasonFit: 'okay', irrigation: false, notes: 'Humid lowlands' },
  { crop: 'PINEAPPLE',    region: 'central_africa', plantStart: 2, plantEnd: 4, okayMonths: [8, 9],      risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Cameroon producer' },

  // ═══════════════════════════════════════════════════════════
  // MID-ATLANTIC US (Maryland) — temperate; frost mid-Apr, first frost mid-Oct
  // ═══════════════════════════════════════════════════════════

  { crop: 'MAIZE',        region: 'mid_atlantic_us', plantStart: 3, plantEnd: 5, okayMonths: [2],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Plant after last frost; 70-90 day varieties' },
  { crop: 'SWEET_CORN',   region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [3],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Plant May-Jun; harvest Aug-Sep' },
  { crop: 'WHEAT',        region: 'mid_atlantic_us', plantStart: 9, plantEnd: 10, okayMonths: [11],      risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Winter wheat; harvest Jun' },
  { crop: 'BEAN',         region: 'mid_atlantic_us', plantStart: 4, plantEnd: 6, okayMonths: [3],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'After last frost; 50-60 day crop' },
  { crop: 'PEA',          region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [1],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Cool crop; plant as early as soil workable' },
  { crop: 'SOYBEAN',      region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Major field crop; full-season' },
  { crop: 'POTATO',       region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [4],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Early spring; harvest Jun-Jul' },
  { crop: 'SWEET_POTATO', region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Plant slips after frost; 100-day crop' },
  { crop: 'TOMATO',       region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [3],        risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Transplant after frost; top garden crop' },
  { crop: 'PEPPER',       region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Warm-season; sweet and hot types' },
  { crop: 'ONION',        region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [1],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Long-day varieties; plant early spring' },
  { crop: 'CUCUMBER',     region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Direct seed after frost; prolific' },
  { crop: 'CABBAGE',      region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [7, 8],     risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Spring and fall crops' },
  { crop: 'CARROT',       region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [7, 8],     risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Cool-season; spring and fall sowing' },
  { crop: 'SPINACH',      region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [8, 9],     risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Cool-season; bolts in summer heat' },
  { crop: 'LETTUCE',      region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [8, 9],     risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Spring and fall; leaf types easiest' },
  { crop: 'KALE',         region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [7, 8, 9],  risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Cool-season; frost improves flavor' },
  { crop: 'SQUASH',       region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Summer squash after frost; winter squash needs full season' },
  { crop: 'WATERMELON',   region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Eastern Shore specialty; 80-90 days' },
  { crop: 'EGGPLANT',     region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'medium', profitSeasonFit: 'good', irrigation: false, notes: 'Warm-season; transplant after frost' },
  { crop: 'OKRA',         region: 'mid_atlantic_us', plantStart: 4, plantEnd: 5, okayMonths: [6],        risk: 'low',    profitSeasonFit: 'okay', irrigation: false, notes: 'Heat-loving; plant after soil warms' },
  { crop: 'GARLIC',       region: 'mid_atlantic_us', plantStart: 9, plantEnd: 10, okayMonths: [11],      risk: 'low',    profitSeasonFit: 'good', irrigation: false, notes: 'Fall plant; harvest Jun. Hardneck best' },
  { crop: 'STRAWBERRY',   region: 'mid_atlantic_us', plantStart: 2, plantEnd: 3, okayMonths: [8, 9],     risk: 'medium', profitSeasonFit: 'good', irrigation: true,  notes: 'Spring plant; harvest May-Jun next year' },
];

// ─── Lookup helpers ─────────────────────────────────────────

/**
 * Get all seasonal rules for a region.
 * @param {string} regionKey
 * @returns {Object[]}
 */
export function getRulesForRegion(regionKey) {
  if (!regionKey) return [];
  return SEASONAL_RULES.filter(r => r.region === regionKey);
}

/**
 * Get seasonal rule for a specific crop in a region.
 * Country-specific rules take precedence over region-wide rules.
 * @param {string} cropKey
 * @param {string} regionKey
 * @param {string} [countryCode] — optional country for country-specific overrides
 * @returns {Object|null}
 */
export function getSeasonalRule(cropKey, regionKey, countryCode) {
  if (!cropKey || !regionKey) return null;
  const cc = countryCode?.toUpperCase();

  // Try country-specific first
  if (cc) {
    const countryRule = SEASONAL_RULES.find(
      r => r.crop === cropKey && r.country === cc
    );
    if (countryRule) return countryRule;
  }

  // Fall back to region-wide
  return SEASONAL_RULES.find(
    r => r.crop === cropKey && r.region === regionKey && !r.country
  ) || null;
}

/**
 * Convert a seasonal rule to good/okay month arrays for compatibility
 * with the existing PLANTING_WINDOWS format.
 * @param {Object} rule — a seasonal rule entry
 * @returns {{ good: number[], okay: number[] }}
 */
export function ruleToMonthArrays(rule) {
  if (!rule) return { good: [], okay: [] };

  const good = [];
  const start = rule.plantStart;
  const end = rule.plantEnd;

  // Handle wrap-around (e.g., plantStart: 10, plantEnd: 0 = Oct, Nov, Dec, Jan)
  if (start <= end) {
    for (let m = start; m <= end; m++) good.push(m);
  } else {
    for (let m = start; m <= 11; m++) good.push(m);
    for (let m = 0; m <= end; m++) good.push(m);
  }

  return { good, okay: rule.okayMonths || [] };
}
