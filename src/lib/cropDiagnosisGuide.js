/**
 * cropDiagnosisGuide.js — curated crop-specific guidance for the
 * Plantix-inspired competitive upgrade (§2 priority crops).
 *
 *   const guide = getCropGuidance('tomato', 'Fungal stress');
 *   // → {
 *   //     whereToCheck: 'Lower leaves first — fungal symptoms usually
 *   //                    appear there before spreading upward.',
 *   //     whatToWatchFor: 'Dark spots with yellow halos, especially
 *   //                      after warm humid nights.',
 *   //     calmTip: 'Pinch off the worst-affected leaves and avoid
 *   //               splashing water onto remaining foliage.',
 *   //   }
 *
 *   getCropGuidance('saffron', 'Pest damage')   // → null (uncurated)
 *
 * Why a curated guide
 * ───────────────────
 *   scanDiagnosisNormalizer (shipped last turn) produces the
 *   canonical 14-field shape with safe defaults + confidence-band
 *   gating + curated safety phrases. What it doesn't do is enrich
 *   the output with CROP-SPECIFIC tips — "for tomato fungal stress,
 *   check the lower leaves" reads more useful than the generic
 *   "Inspect affected leaves."
 *
 *   This module is a CURATED config — every entry was written
 *   deliberately, every entry is calm, every entry avoids
 *   prescribing specific chemicals. When a (crop, category) combo
 *   isn't on the list, the helper returns null and the surface
 *   falls back to the generic normalizer output. **Never fabricates
 *   guidance** for unknown crops.
 *
 *   Coverage focus per spec §2: tomato / maize / pepper / cassava /
 *   rice / onion / cocoa / (common garden veg via aliases).
 *
 * Strict-rule audit
 *   • Pure function. Never throws.
 *   • Frozen registry — UI / tests can't mutate canonical strings.
 *   • Never names a specific pesticide or chemical product.
 *   • Returns null for uncurated combos so the caller cleanly
 *     falls back to the generic normalizer output.
 *   • All entries audited against banned wording ('confirmed' /
 *     'guaranteed' / 'definitely' / 'certain') — pinned by tests.
 */

// ─── Canonical crop key normalization ────────────────────────

const _CROP_ALIASES = Object.freeze({
  // Tomato + close relatives
  tomato:     'tomato',
  tomatoes:   'tomato',

  // Maize / corn
  maize:      'maize',
  corn:       'maize',
  'sweet corn': 'maize',

  // Pepper + chili
  pepper:     'pepper',
  peppers:    'pepper',
  chili:      'pepper',
  chilli:     'pepper',
  capsicum:   'pepper',

  // Cassava
  cassava:    'cassava',
  manioc:     'cassava',
  yuca:       'cassava',

  // Rice
  rice:       'rice',
  paddy:      'rice',

  // Onion
  onion:      'onion',
  onions:     'onion',
  shallot:    'onion',

  // Cocoa
  cocoa:      'cocoa',
  cacao:      'cocoa',

  // Common garden vegetables — share the generic-garden entries
  lettuce:    'leafy_green',
  kale:       'leafy_green',
  spinach:    'leafy_green',
  cucumber:   'cucurbit',
  zucchini:   'cucurbit',
  squash:     'cucurbit',
  okra:       'okra',
});

function _normCrop(raw) {
  const s = String(raw || '').toLowerCase().trim();
  if (!s) return null;
  return _CROP_ALIASES[s] || null;
}

function _normCategory(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  // Accept both canonical category strings (from
  // scanDiagnosisNormalizer.CONDITION_CATEGORIES) and lowercase keys.
  const lower = s.toLowerCase();
  if (lower.includes('fungal'))   return 'fungal';
  if (lower.includes('pest'))     return 'pest';
  if (lower.includes('nutrient')) return 'nutrient';
  if (lower.includes('water'))    return 'water';
  if (lower.includes('heat'))     return 'heat';
  if (lower.includes('leaf'))     return 'leaf';
  if (lower.includes('healthy') || lower.includes('no issue')) return 'healthy';
  return null;
}

// ─── Curated guidance table ──────────────────────────────────
// Every entry deliberately:
//   • avoids naming a specific chemical product
//   • uses calm, non-judgmental wording
//   • points to WHERE the farmer should look + WHAT to watch for
//   • offers ONE simple action they can do today

const _GUIDANCE = Object.freeze({
  tomato: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Lower leaves first — fungal symptoms usually appear there before spreading upward.',
      whatToWatchFor: 'Dark spots with yellow halos, especially after warm humid nights.',
      calmTip:        'Pinch off the worst-affected leaves and avoid splashing water onto remaining foliage.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Undersides of leaves and around the growing tip.',
      whatToWatchFor: 'Small green or black clusters, sticky residue, or curling young leaves.',
      calmTip:        'A strong spray of water can knock off light pest activity before it spreads.',
    }),
    nutrient: Object.freeze({
      whereToCheck:   'Older leaves at the base of the plant — nutrient signals start there.',
      whatToWatchFor: 'Yellowing between leaf veins or pale lower foliage.',
      calmTip:        'A short field walk after watering helps catch nutrient signals early; consider a soil check.',
    }),
    water: Object.freeze({
      whereToCheck:   'Soil around the base + the top leaves at midday.',
      whatToWatchFor: 'Wilting that doesn\'t recover after the sun moves off.',
      calmTip:        'Water at dawn so leaves dry before the heat of the day.',
    }),
    leaf: Object.freeze({
      whereToCheck:   'A single affected leaf, in good light.',
      whatToWatchFor: 'Whether the damage is spreading to nearby leaves.',
      calmTip:        'Remove heavily damaged leaves and dispose of them away from healthy plants.',
    }),
  }),

  maize: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Middle leaves and the leaf sheath where moisture sits longest.',
      whatToWatchFor: 'Long rusty streaks or grey lesions running along the leaf vein.',
      calmTip:        'Improve airflow between rows by removing any heavily affected lower leaves.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Whorl of the youngest leaves + the silks during tasselling.',
      whatToWatchFor: 'Ragged feeding holes or sawdust-like frass near the growing tip.',
      calmTip:        'Walk the field at dawn — many maize pests are easiest to spot when leaves are still.',
    }),
    nutrient: Object.freeze({
      whereToCheck:   'Older leaves first — the plant moves nutrients to new growth.',
      whatToWatchFor: 'V-shaped yellowing starting from the leaf tip.',
      calmTip:        'Note the pattern; a soil test is often the most reliable next step before treating.',
    }),
    water: Object.freeze({
      whereToCheck:   'Leaves at midday — maize leaves curl tightly when stressed.',
      whatToWatchFor: 'Curled or rolled leaves that stay curled after the heat.',
      calmTip:        'Water during the early morning so roots can absorb before peak heat.',
    }),
    leaf: Object.freeze({
      whereToCheck:   'A single affected leaf, in good light.',
      whatToWatchFor: 'Whether nearby leaves show the same pattern.',
      calmTip:        'Remove the worst-affected leaf and watch nearby plants for the same signs.',
    }),
  }),

  pepper: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Stem base and the lower leaves first.',
      whatToWatchFor: 'Dark sunken lesions or sudden wilting on one branch.',
      calmTip:        'Avoid overhead watering — pepper fungal pressure rises sharply when leaves stay wet overnight.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Undersides of leaves and around flower buds.',
      whatToWatchFor: 'Tiny holes, distorted leaves, or clusters of small insects.',
      calmTip:        'Hand-removal works well for small pest populations on a few plants.',
    }),
    heat: Object.freeze({
      whereToCheck:   'Fruit + leaves exposed to direct afternoon sun.',
      whatToWatchFor: 'Pale or papery patches on the sunward side of fruit.',
      calmTip:        'A light shade cloth during peak heat days can prevent sunscald.',
    }),
    leaf: Object.freeze({
      whereToCheck:   'The single affected leaf and its neighbours.',
      whatToWatchFor: 'Whether the damage looks insect-caused, fungal, or sun-related.',
      calmTip:        'Remove badly damaged leaves and watch the neighbours for the next two days.',
    }),
  }),

  cassava: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Lower leaves and the stem base.',
      whatToWatchFor: 'Brown or angular lesions, or unusual wilting.',
      calmTip:        'Remove heavily affected leaves and clean tools between plants to slow spread.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Underside of leaves and the growing tip.',
      whatToWatchFor: 'Fine webbing, distorted new growth, or yellow speckling.',
      calmTip:        'Walk the field weekly during dry spells when many cassava pests are most active.',
    }),
    leaf: Object.freeze({
      whereToCheck:   'A single affected leaf and the canopy above it.',
      whatToWatchFor: 'Whether new leaves show the same signs as old ones.',
      calmTip:        'Note the pattern + take a clearer photo if symptoms are unclear.',
    }),
  }),

  rice: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Leaf collars and the panicle (grain head).',
      whatToWatchFor: 'Diamond-shaped lesions on leaves or discoloured panicle nodes.',
      calmTip:        'Manage water level carefully — sudden changes can trigger fungal flare-ups in rice.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Base of the plant + the leaf sheath.',
      whatToWatchFor: 'Hollow stems, "deadheart" central shoots, or visible insect activity at dusk.',
      calmTip:        'Walk the paddy at first light — many rice pests are still on the plants then.',
    }),
    nutrient: Object.freeze({
      whereToCheck:   'Older leaves first.',
      whatToWatchFor: 'General yellowing or shortened plants compared to neighbours.',
      calmTip:        'A soil + water test is the most reliable next step for rice nutrient signals.',
    }),
  }),

  onion: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Leaf tips and the neck where humidity collects.',
      whatToWatchFor: 'Pale dieback from the tip or fuzzy growth at the neck.',
      calmTip:        'Avoid wetting the foliage at irrigation time — onion fungal pressure starts at wet necks.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Between the leaves + at the soil line.',
      whatToWatchFor: 'Silvery scratch marks or wilted, hollow-feeling leaves.',
      calmTip:        'Reduce nearby weeds — many onion pests shelter there before moving to the crop.',
    }),
    leaf: Object.freeze({
      whereToCheck:   'Single affected leaf vs. neighbours.',
      whatToWatchFor: 'Whether the damage is fungal (fuzzy / spreading) or physical (clean break).',
      calmTip:        'Take a closer photo if you\'re unsure which it is.',
    }),
  }),

  cocoa: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Pods (especially the soil-facing side) and the trunk near the soil.',
      whatToWatchFor: 'Dark rotted patches on pods or stem cankers.',
      calmTip:        'Remove and dispose of affected pods far from the tree — fungal pressure travels with husks.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Pod surface, leaf undersides, and the bark around buds.',
      whatToWatchFor: 'Sticky residue, holes in pods, or weak shoot tips.',
      calmTip:        'Regular sanitation (clearing fallen husks) is one of the strongest cocoa pest defences.',
    }),
  }),

  leafy_green: Object.freeze({
    pest: Object.freeze({
      whereToCheck:   'Underside of the lowest leaves + heart of the plant.',
      whatToWatchFor: 'Slugs, caterpillars, or jagged feeding marks.',
      calmTip:        'Check in the early morning before pests retreat from the sun.',
    }),
    fungal: Object.freeze({
      whereToCheck:   'Where leaves touch the soil.',
      whatToWatchFor: 'Soft brown patches or fuzzy growth at the base.',
      calmTip:        'Mulch lightly to keep leaves off bare soil.',
    }),
  }),

  cucurbit: Object.freeze({
    fungal: Object.freeze({
      whereToCheck:   'Upper leaf surface in midsummer.',
      whatToWatchFor: 'White powdery patches that spread quickly.',
      calmTip:        'Improve airflow by removing crossing leaves; water at the base, not the foliage.',
    }),
    pest: Object.freeze({
      whereToCheck:   'Where vine meets the soil + the undersides of leaves.',
      whatToWatchFor: 'Sudden wilt on one stem, or clusters of small flat eggs.',
      calmTip:        'Walk the rows weekly during fruiting — small problems compound quickly on cucurbits.',
    }),
  }),

  okra: Object.freeze({
    pest: Object.freeze({
      whereToCheck:   'Flower buds + young pods.',
      whatToWatchFor: 'Holes in pods or shrivelled flower buds.',
      calmTip:        'Pick affected pods promptly — leaving them on the plant invites more pest activity.',
    }),
    fungal: Object.freeze({
      whereToCheck:   'Lower leaves and the leaf-petiole joint.',
      whatToWatchFor: 'Yellow patches turning brown with a clear margin.',
      calmTip:        'Remove the worst-affected lower leaves to improve airflow.',
    }),
  }),
});

// ─── Public API ──────────────────────────────────────────────

/**
 * Look up curated crop-specific guidance for a (crop, category)
 * pair. Returns null when no entry exists — caller should fall
 * back to the generic normalizer output rather than fabricate
 * crop-specific text.
 *
 * @param {string} crop        — crop name (accepts aliases)
 * @param {string} category    — condition category (canonical or lowercase)
 * @returns {{ whereToCheck, whatToWatchFor, calmTip }|null}
 */
export function getCropGuidance(crop, category) {
  const cropKey = _normCrop(crop);
  const catKey  = _normCategory(category);
  if (!cropKey || !catKey) return null;
  const cropTable = _GUIDANCE[cropKey];
  if (!cropTable) return null;
  const entry = cropTable[catKey];
  return entry || null;
}

/**
 * Is this crop on the priority-coverage list? Useful for analytics
 * + UI affordances ("Top-coverage crop" badge).
 *
 * @param {string} crop
 * @returns {boolean}
 */
export function isPriorityCrop(crop) {
  return _normCrop(crop) !== null;
}

/**
 * Read-only list of every crop key the guide covers (after alias
 * resolution). Useful for the picker UI + tests.
 */
export function getSupportedCropKeys() {
  return Array.from(new Set(Object.values(_CROP_ALIASES)));
}

/**
 * Read-only crop-alias map for the UI's autocomplete + test
 * coverage matrix.
 */
export function getCropAliases() {
  return { ..._CROP_ALIASES };
}

export default {
  getCropGuidance,
  isPriorityCrop,
  getSupportedCropKeys,
  getCropAliases,
};
