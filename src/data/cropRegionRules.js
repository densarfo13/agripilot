/**
 * Crop-Region Rules — which crops grow where, with local context.
 *
 * Each rule binds a crop to a country (and optionally a region),
 * overriding or extending the crop's global defaults with local knowledge.
 *
 * Fields:
 *   crop          — crop key from crops.js
 *   country       — ISO 2-letter code
 *   region        — region key (optional, inferred from country if omitted)
 *   common        — true if widely grown in this country
 *   beginnerGood  — true if suitable for first-time farmers HERE
 *   foodFit       — 'high' | 'medium' | 'low' — local food relevance
 *   profitFit     — 'high' | 'medium' | 'low' — local market potential
 *   goals         — which farming goals this crop fits locally
 *   priority      — 1 = staple, 2 = common, 3 = niche
 *   notes         — short explanation for future editors
 *
 * Used by: cropRegionCatalog.js (derives indexes), recommendation engine.
 *
 * To add a new country: append rules for its common crops.
 * To add a new crop to a country: append one rule.
 */

export const CROP_REGION_RULES = [
  // ═══════════════════════════════════════════════════════════
  // GHANA (GH) — West Africa
  // ═══════════════════════════════════════════════════════════

  // Cereals
  { crop: 'MAIZE',    country: 'GH', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales', 'profit'], priority: 1, notes: 'Staple grain; two seasons possible in southern belt' },
  { crop: 'RICE',     country: 'GH', common: true,  beginnerGood: false, foodFit: 'high',   profitFit: 'high',   goals: ['home_food', 'profit'],               priority: 1, notes: 'Growing demand; irrigation preferred' },
  { crop: 'SORGHUM',  country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Hardy; grown mostly in northern regions' },
  { crop: 'MILLET',   country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Drought-tolerant; northern staple' },

  // Legumes
  { crop: 'BEAN',     country: 'GH', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Cowpea type most common; protein source' },
  { crop: 'GROUNDNUT',country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Widely grown; good intercrop with maize' },
  { crop: 'COWPEA',   country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Drought-tolerant; improves soil nitrogen' },
  { crop: 'SOYBEAN',  country: 'GH', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['profit', 'local_sales'],             priority: 2, notes: 'Growing industrial demand' },

  // Roots & Tubers
  { crop: 'CASSAVA',  country: 'GH', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Top staple; gari, fufu, and chips' },
  { crop: 'YAM',      country: 'GH', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Cultural staple; yam festival crop' },
  { crop: 'SWEET_POTATO', country: 'GH', common: true, beginnerGood: true, foodFit: 'high', profitFit: 'low',   goals: ['home_food'],                         priority: 2, notes: 'Orange-fleshed varieties gaining popularity' },
  { crop: 'POTATO',   country: 'GH', common: false, beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Limited to cooler highland areas' },

  // Vegetables
  { crop: 'TOMATO',   country: 'GH', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 1, notes: 'High demand; perishable — needs market access' },
  { crop: 'ONION',    country: 'GH', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 2, notes: 'Mainly Upper East; dry season crop' },
  { crop: 'PEPPER',   country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales', 'profit'],             priority: 2, notes: 'Scotch bonnet and shito pepper common' },
  { crop: 'OKRA',     country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Essential soup ingredient; easy backyard crop' },
  { crop: 'CABBAGE',  country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 2, notes: 'Grown year-round near Accra peri-urban' },
  { crop: 'EGGPLANT', country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Garden egg variety popular' },
  { crop: 'SPINACH',  country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 3, notes: 'Kontomire (cocoyam leaves) more common' },
  { crop: 'CUCUMBER', country: 'GH', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Urban market demand growing' },
  { crop: 'WATERMELON',country:'GH', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 3, notes: 'Profitable; needs space' },
  { crop: 'CARROT',   country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Grown in cooler areas' },

  // Spices
  { crop: 'GINGER',   country: 'GH', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 2, notes: 'Export potential; Kadjebi region' },
  { crop: 'CHILI',    country: 'GH', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'medium', goals: ['local_sales', 'profit'],             priority: 3, notes: 'Essential for shito production' },

  // Fruits
  { crop: 'BANANA',   country: 'GH', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Year-round; minimal care' },
  { crop: 'PLANTAIN', country: 'GH', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Key staple; ampesi, kelewele, fufu' },
  { crop: 'MANGO',    country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales', 'profit'],priority: 2, notes: 'Seasonal Mar-Jun; surplus often wasted' },
  { crop: 'PAPAYA',   country: 'GH', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 3, notes: 'Easy backyard fruit' },
  { crop: 'PINEAPPLE',country: 'GH', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['profit', 'local_sales'],             priority: 2, notes: 'Export-grade MD2 variety grown near Nsawam' },
  { crop: 'AVOCADO',  country: 'GH', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Growing urban demand' },
  { crop: 'ORANGE',   country: 'GH', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Citrus belt in Eastern region' },

  // Cash crops
  { crop: 'COCOA',    country: 'GH', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['profit'],                            priority: 1, notes: 'Major export; COCOBOD regulated' },
  { crop: 'PALM_OIL', country: 'GH', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['profit'],                            priority: 2, notes: 'Western region; long establishment period' },
  { crop: 'COFFEE',   country: 'GH', common: false, beginnerGood: false, foodFit: 'low',    profitFit: 'medium', goals: ['profit'],                            priority: 3, notes: 'Small scale in Volta and Brong-Ahafo' },
  { crop: 'COTTON',   country: 'GH', common: false, beginnerGood: false, foodFit: 'low',    profitFit: 'medium', goals: ['profit'],                            priority: 3, notes: 'Northern Ghana; declining acreage' },

  // ═══════════════════════════════════════════════════════════
  // KENYA (KE) — East Africa
  // ═══════════════════════════════════════════════════════════

  // Cereals
  { crop: 'MAIZE',    country: 'KE', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales', 'profit'], priority: 1, notes: 'Top staple; ugali. Trans-Nzoia, Uasin Gishu' },
  { crop: 'RICE',     country: 'KE', common: true,  beginnerGood: false, foodFit: 'high',   profitFit: 'high',   goals: ['home_food', 'profit'],               priority: 1, notes: 'Mwea scheme; paddled irrigation' },
  { crop: 'SORGHUM',  country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Drought-tolerant; Western and Eastern lowlands' },
  { crop: 'MILLET',   country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Finger millet in Western Kenya' },
  { crop: 'WHEAT',    country: 'KE', common: true,  beginnerGood: false, foodFit: 'high',   profitFit: 'medium', goals: ['profit', 'local_sales'],             priority: 2, notes: 'Narok, Nakuru highlands; mechanized' },

  // Legumes
  { crop: 'BEAN',     country: 'KE', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Githeri staple; intercropped with maize' },
  { crop: 'GROUNDNUT',country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Nyanza and Western provinces' },
  { crop: 'COWPEA',   country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Drought-hardy; Eastern Kenya' },
  { crop: 'SOYBEAN',  country: 'KE', common: false, beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['profit'],                            priority: 3, notes: 'Small but growing industrial demand' },
  { crop: 'PEA',      country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 3, notes: 'Garden peas in highland areas' },

  // Roots & Tubers
  { crop: 'CASSAVA',  country: 'KE', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Coastal and Western lowlands' },
  { crop: 'SWEET_POTATO', country: 'KE', common: true, beginnerGood: true, foodFit: 'high', profitFit: 'low',   goals: ['home_food'],                         priority: 1, notes: 'Orange-fleshed varieties promoted for nutrition' },
  { crop: 'POTATO',   country: 'KE', common: true,  beginnerGood: false, foodFit: 'high',   profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 1, notes: 'Nyandarua, Meru highlands — profitable' },

  // Vegetables
  { crop: 'TOMATO',   country: 'KE', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 1, notes: 'High demand; Kirinyaga, Kajiado' },
  { crop: 'ONION',    country: 'KE', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 2, notes: 'Irrigated — Naivasha, Kieni' },
  { crop: 'PEPPER',   country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales', 'profit'],             priority: 2, notes: 'Capsicum for export; chili for local' },
  { crop: 'OKRA',     country: 'KE', common: false, beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food'],                         priority: 3, notes: 'Coastal; limited inland demand' },
  { crop: 'CABBAGE',  country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 2, notes: 'Kiambu, Limuru; reliable market' },
  { crop: 'KALE',     country: 'KE', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Sukuma wiki — #1 leafy green' },
  { crop: 'SPINACH',  country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 3, notes: 'Terere variety popular' },
  { crop: 'CUCUMBER', country: 'KE', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Greenhouse production growing' },
  { crop: 'CARROT',   country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Highland areas' },
  { crop: 'WATERMELON',country:'KE', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 3, notes: 'Dry areas; irrigated — Machakos, Kajiado' },
  { crop: 'EGGPLANT', country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Growing restaurant demand' },

  // Spices
  { crop: 'GINGER',   country: 'KE', common: false, beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 3, notes: 'Small scale in Western Kenya' },
  { crop: 'CHILI',    country: 'KE', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'medium', goals: ['local_sales', 'profit'],             priority: 3, notes: 'Export-grade birds eye chili' },
  { crop: 'GARLIC',   country: 'KE', common: false, beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 3, notes: 'Small but premium market' },

  // Fruits
  { crop: 'BANANA',   country: 'KE', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Cooking banana (matoke) in Western' },
  { crop: 'MANGO',    country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'high',   goals: ['home_food', 'local_sales', 'profit'],priority: 2, notes: 'Coastal, Eastern — export potential' },
  { crop: 'AVOCADO',  country: 'KE', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'high',   goals: ['profit', 'local_sales'],             priority: 2, notes: 'Hass variety for export; Murang\'a, Kisii' },
  { crop: 'PAPAYA',   country: 'KE', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food', 'local_sales'],          priority: 3, notes: 'Coastal lowlands' },
  { crop: 'PINEAPPLE',country: 'KE', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['profit', 'local_sales'],             priority: 3, notes: 'Thika region' },
  { crop: 'ORANGE',   country: 'KE', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['local_sales'],                       priority: 3, notes: 'Coast province' },

  // Cash crops
  { crop: 'COFFEE',   country: 'KE', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['profit'],                            priority: 1, notes: 'Premium Arabica; Central, Nyeri, Kirinyaga' },
  { crop: 'TEA',      country: 'KE', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['profit'],                            priority: 1, notes: 'Kericho, Nandi highlands' },
  { crop: 'SUGARCANE',country: 'KE', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['profit'],                            priority: 2, notes: 'Western Kenya; Mumias, Chemelil' },
  { crop: 'COTTON',   country: 'KE', common: false, beginnerGood: false, foodFit: 'low',    profitFit: 'medium', goals: ['profit'],                            priority: 3, notes: 'Declining; Eastern and Coast' },
  { crop: 'SUNFLOWER',country: 'KE', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'medium', goals: ['profit', 'local_sales'],             priority: 3, notes: 'Nakuru, Trans-Nzoia; cooking oil' },
  { crop: 'SESAME',   country: 'KE', common: false, beginnerGood: true,  foodFit: 'low',    profitFit: 'medium', goals: ['profit', 'local_sales'],             priority: 3, notes: 'Marginal areas; export crop' },

  // ═══════════════════════════════════════════════════════════
  // UNITED STATES — Maryland / Mid-Atlantic (US)
  // ═══════════════════════════════════════════════════════════

  // Cereals
  { crop: 'MAIZE',    country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales', 'profit'], priority: 1, notes: 'Field corn and sweet corn; Eastern Shore' },
  { crop: 'WHEAT',    country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['profit'],                            priority: 2, notes: 'Winter wheat Oct-Nov plant; Jun harvest' },

  // Legumes
  { crop: 'BEAN',     country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Snap beans and dry beans; garden staple' },
  { crop: 'PEA',      country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food'],                         priority: 2, notes: 'Cool-season crop; plant early spring' },
  { crop: 'SOYBEAN',  country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: false, foodFit: 'low',    profitFit: 'medium', goals: ['profit'],                            priority: 2, notes: 'Major field crop; Eastern Shore farms' },

  // Roots & Tubers
  { crop: 'POTATO',   country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Plant mid-Mar to mid-Apr; harvest Jun-Jul' },
  { crop: 'SWEET_POTATO', country: 'US', region: 'mid_atlantic_us', common: true, beginnerGood: true, foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],       priority: 2, notes: 'Plant slips after last frost; long season' },

  // Vegetables
  { crop: 'TOMATO',   country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'high',   profitFit: 'high',   goals: ['home_food', 'local_sales', 'profit'], priority: 1, notes: 'Plant after last frost mid-Apr; top garden crop' },
  { crop: 'PEPPER',   country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Sweet and hot varieties; warm-season' },
  { crop: 'ONION',    country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Long-day varieties; plant early spring' },
  { crop: 'CUCUMBER', country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Direct seed after last frost; prolific' },
  { crop: 'CABBAGE',  country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Spring and fall crops possible' },
  { crop: 'CARROT',   country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Cool-season; sow Mar-Apr and Aug-Sep' },
  { crop: 'SPINACH',  country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food'],                         priority: 2, notes: 'Cool-season; bolts in heat' },
  { crop: 'LETTUCE',  country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Spring and fall; leaf types easiest' },
  { crop: 'SQUASH',   country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Summer and winter squash; prolific' },
  { crop: 'SWEET_CORN',country:'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 1, notes: 'Maryland staple; plant May; harvest Aug' },
  { crop: 'WATERMELON',country:'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'high',   goals: ['local_sales', 'profit'],             priority: 2, notes: 'Eastern Shore specialty; plant late May' },
  { crop: 'EGGPLANT', country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: false, foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 3, notes: 'Warm-season; transplant after frost' },
  { crop: 'OKRA',     country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'low',    goals: ['home_food'],                         priority: 3, notes: 'Heat-loving; plant late May-Jun' },
  { crop: 'KALE',     country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'medium', profitFit: 'medium', goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Cool-season; frost improves flavor' },

  // Fruits
  { crop: 'STRAWBERRY', country: 'US', region: 'mid_atlantic_us', common: true, beginnerGood: false, foodFit: 'low', profitFit: 'high', goals: ['local_sales', 'profit'],              priority: 2, notes: 'U-pick farms; plant Mar-Apr' },

  // Spices
  { crop: 'GARLIC',   country: 'US', region: 'mid_atlantic_us', common: true,  beginnerGood: true,  foodFit: 'low',    profitFit: 'high',   goals: ['home_food', 'local_sales'],          priority: 2, notes: 'Plant Oct; harvest Jun. Hardneck varieties' },
  { crop: 'GINGER',   country: 'US', region: 'mid_atlantic_us', common: false, beginnerGood: false, foodFit: 'low',    profitFit: 'high',   goals: ['local_sales'],                       priority: 3, notes: 'Container or greenhouse; not cold-hardy' },
];

// ─── Lookup helpers ─────────────────────────────────────────

/**
 * Get all rules for a specific country.
 * @param {string} countryCode
 * @returns {Object[]}
 */
export function getRulesForCountry(countryCode) {
  if (!countryCode) return [];
  const cc = countryCode.toUpperCase();
  return CROP_REGION_RULES.filter(r => r.country === cc);
}

/**
 * Get a specific rule for a crop in a country.
 * @param {string} cropKey
 * @param {string} countryCode
 * @returns {Object|null}
 */
export function getRule(cropKey, countryCode) {
  if (!cropKey || !countryCode) return null;
  const cc = countryCode.toUpperCase();
  return CROP_REGION_RULES.find(r => r.crop === cropKey && r.country === cc) || null;
}

/**
 * Get all common crops for a country, sorted by priority.
 * @param {string} countryCode
 * @returns {Object[]}
 */
export function getCommonCropsForCountry(countryCode) {
  return getRulesForCountry(countryCode)
    .filter(r => r.common)
    .sort((a, b) => a.priority - b.priority);
}
