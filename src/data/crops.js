/**
 * Master Crop Catalog — single source of truth for crop metadata.
 *
 * This file defines every crop the app knows about with its intrinsic
 * properties. Region-specific behavior (common? beginner-safe? planting
 * window?) lives in cropRegionRules.js and seasonalRules.js instead.
 *
 * Fields:
 *   key            — unique uppercase identifier, used as join key everywhere
 *   label          — human-readable English name
 *   emoji          — icon for UI display
 *   category       — cereal | legume | root | vegetable | fruit | spice | cash
 *   beginner       — globally considered easy for first-timers
 *   difficulty     — easy | moderate | hard
 *   defaultFoodFit — high | medium | low (how well it feeds a household)
 *   defaultProfitFit — high | medium | low (inherent market value)
 *   budgetLevels   — which budget levels the crop fits ['low','medium','high']
 *   landSizes      — which land sizes work ['small','medium','large']
 */

export const CROPS = {
  // ── Cereals & Grains ──────────────────────────────────────
  MAIZE: {
    key: 'MAIZE', label: 'Maize (Corn)', emoji: '🌽', category: 'cereal',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'high', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium', 'high'],
    landSizes: ['small', 'medium', 'large'],
  },
  RICE: {
    key: 'RICE', label: 'Rice', emoji: '🌾', category: 'cereal',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'high', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['medium', 'large'],
  },
  SORGHUM: {
    key: 'SORGHUM', label: 'Sorghum', emoji: '🌿', category: 'cereal',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'low',
    budgetLevels: ['low', 'medium'],
    landSizes: ['medium', 'large'],
  },
  MILLET: {
    key: 'MILLET', label: 'Millet', emoji: '🌾', category: 'cereal',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'low',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium', 'large'],
  },
  WHEAT: {
    key: 'WHEAT', label: 'Wheat', emoji: '🌾', category: 'cereal',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'high', defaultProfitFit: 'medium',
    budgetLevels: ['medium', 'high'],
    landSizes: ['medium', 'large'],
  },

  // ── Legumes & Pulses ──────────────────────────────────────
  BEAN: {
    key: 'BEAN', label: 'Beans', emoji: '🫘', category: 'legume',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'high', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  GROUNDNUT: {
    key: 'GROUNDNUT', label: 'Groundnut (Peanut)', emoji: '🥜', category: 'legume',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  COWPEA: {
    key: 'COWPEA', label: 'Cowpea', emoji: '🫘', category: 'legume',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'low',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  SOYBEAN: {
    key: 'SOYBEAN', label: 'Soybean', emoji: '🫘', category: 'legume',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['medium', 'high'],
    landSizes: ['medium', 'large'],
  },
  PEA: {
    key: 'PEA', label: 'Pea', emoji: '🟢', category: 'legume',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'low',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },

  // ── Root & Tuber Crops ────────────────────────────────────
  CASSAVA: {
    key: 'CASSAVA', label: 'Cassava', emoji: '🥔', category: 'root',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'high', defaultProfitFit: 'low',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium', 'large'],
  },
  YAM: {
    key: 'YAM', label: 'Yam', emoji: '🍠', category: 'root',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'high', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  SWEET_POTATO: {
    key: 'SWEET_POTATO', label: 'Sweet Potato', emoji: '🍠', category: 'root',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'high', defaultProfitFit: 'low',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  POTATO: {
    key: 'POTATO', label: 'Potato', emoji: '🥔', category: 'root',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'high', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium'],
  },

  // ── Vegetables ────────────────────────────────────────────
  TOMATO: {
    key: 'TOMATO', label: 'Tomato', emoji: '🍅', category: 'vegetable',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'medium', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium'],
  },
  ONION: {
    key: 'ONION', label: 'Onion', emoji: '🧅', category: 'vegetable',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'medium', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium'],
  },
  PEPPER: {
    key: 'PEPPER', label: 'Pepper', emoji: '🫑', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  OKRA: {
    key: 'OKRA', label: 'Okra', emoji: '🟢', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  CABBAGE: {
    key: 'CABBAGE', label: 'Cabbage', emoji: '🥬', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium'],
  },
  KALE: {
    key: 'KALE', label: 'Kale', emoji: '🥬', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small'],
  },
  EGGPLANT: {
    key: 'EGGPLANT', label: 'Eggplant', emoji: '🍆', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  SPINACH: {
    key: 'SPINACH', label: 'Spinach', emoji: '🥬', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'low',
    budgetLevels: ['low'],
    landSizes: ['small'],
  },
  CUCUMBER: {
    key: 'CUCUMBER', label: 'Cucumber', emoji: '🥒', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'low', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  CARROT: {
    key: 'CARROT', label: 'Carrot', emoji: '🥕', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['medium'],
    landSizes: ['small', 'medium'],
  },
  WATERMELON: {
    key: 'WATERMELON', label: 'Watermelon', emoji: '🍉', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['medium', 'large'],
  },
  LETTUCE: {
    key: 'LETTUCE', label: 'Lettuce', emoji: '🥬', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'low', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  SQUASH: {
    key: 'SQUASH', label: 'Squash', emoji: '🎃', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  SWEET_CORN: {
    key: 'SWEET_CORN', label: 'Sweet Corn', emoji: '🌽', category: 'vegetable',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium', 'large'],
  },

  // ── Spices ────────────────────────────────────────────────
  GINGER: {
    key: 'GINGER', label: 'Ginger', emoji: '🫚', category: 'spice',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium'],
  },
  CHILI: {
    key: 'CHILI', label: 'Chili Pepper', emoji: '🌶️', category: 'spice',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'low', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  GARLIC: {
    key: 'GARLIC', label: 'Garlic', emoji: '🧄', category: 'spice',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['medium'],
    landSizes: ['small', 'medium'],
  },

  // ── Fruits ────────────────────────────────────────────────
  BANANA: {
    key: 'BANANA', label: 'Banana', emoji: '🍌', category: 'fruit',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'high', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium', 'large'],
  },
  PLANTAIN: {
    key: 'PLANTAIN', label: 'Plantain', emoji: '🍌', category: 'fruit',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'high', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  MANGO: {
    key: 'MANGO', label: 'Mango', emoji: '🥭', category: 'fruit',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'high',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium', 'large'],
  },
  PAPAYA: {
    key: 'PAPAYA', label: 'Papaya', emoji: '🍈', category: 'fruit',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'medium', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['small', 'medium'],
  },
  AVOCADO: {
    key: 'AVOCADO', label: 'Avocado', emoji: '🥑', category: 'fruit',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'medium', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium', 'large'],
  },
  PINEAPPLE: {
    key: 'PINEAPPLE', label: 'Pineapple', emoji: '🍍', category: 'fruit',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium'],
  },
  ORANGE: {
    key: 'ORANGE', label: 'Orange', emoji: '🍊', category: 'fruit',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'medium', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['medium', 'large'],
  },
  STRAWBERRY: {
    key: 'STRAWBERRY', label: 'Strawberry', emoji: '🍓', category: 'fruit',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['medium', 'high'],
    landSizes: ['small', 'medium'],
  },

  // ── Cash Crops ────────────────────────────────────────────
  COFFEE: {
    key: 'COFFEE', label: 'Coffee', emoji: '☕', category: 'cash',
    beginner: false, difficulty: 'hard',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['high'],
    landSizes: ['medium', 'large'],
  },
  TEA: {
    key: 'TEA', label: 'Tea', emoji: '🍵', category: 'cash',
    beginner: false, difficulty: 'hard',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['high'],
    landSizes: ['medium', 'large'],
  },
  COTTON: {
    key: 'COTTON', label: 'Cotton', emoji: '☁️', category: 'cash',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'low', defaultProfitFit: 'medium',
    budgetLevels: ['medium', 'high'],
    landSizes: ['medium', 'large'],
  },
  SUGARCANE: {
    key: 'SUGARCANE', label: 'Sugarcane', emoji: '🎋', category: 'cash',
    beginner: false, difficulty: 'hard',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['high'],
    landSizes: ['large'],
  },
  COCOA: {
    key: 'COCOA', label: 'Cocoa', emoji: '🫘', category: 'cash',
    beginner: false, difficulty: 'hard',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['high'],
    landSizes: ['medium', 'large'],
  },
  PALM_OIL: {
    key: 'PALM_OIL', label: 'Palm Oil', emoji: '🌴', category: 'cash',
    beginner: false, difficulty: 'hard',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['high'],
    landSizes: ['medium', 'large'],
  },
  SESAME: {
    key: 'SESAME', label: 'Sesame', emoji: '🌿', category: 'cash',
    beginner: true, difficulty: 'easy',
    defaultFoodFit: 'low', defaultProfitFit: 'medium',
    budgetLevels: ['low', 'medium'],
    landSizes: ['medium', 'large'],
  },
  SUNFLOWER: {
    key: 'SUNFLOWER', label: 'Sunflower', emoji: '🌻', category: 'cash',
    beginner: false, difficulty: 'moderate',
    defaultFoodFit: 'low', defaultProfitFit: 'medium',
    budgetLevels: ['medium', 'high'],
    landSizes: ['medium', 'large'],
  },
  TOBACCO: {
    key: 'TOBACCO', label: 'Tobacco', emoji: '🍃', category: 'cash',
    beginner: false, difficulty: 'hard',
    defaultFoodFit: 'low', defaultProfitFit: 'high',
    budgetLevels: ['high'],
    landSizes: ['medium', 'large'],
  },
};

// ─── Lookup helpers ─────────────────────────────────────────
export function getCrop(key) {
  return CROPS[key] || null;
}

export function getCropsByCategory(category) {
  return Object.values(CROPS).filter(c => c.category === category);
}

export function getBeginnerCrops() {
  return Object.values(CROPS).filter(c => c.beginner);
}

export function getAllCropKeys() {
  return Object.keys(CROPS);
}
