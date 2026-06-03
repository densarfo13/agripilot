/**
 * UniversalScanClassifier.ts — universal object-type + issue
 * taxonomy classifier.
 *
 * Spec §1+§4+§5. Pure / SSR-safe / frozen / never throws.
 *
 * Lives in `universalScan/` (sibling namespace) rather than the
 * wave-36 frozen `src/runtime/scan/` directory. Same contract,
 * safe deploy.
 *
 * Object types (spec §1):
 *   fruit · vegetable · leaf · crop · flower · herb · tree ·
 *   weed · soil_surface · seedling · unknown
 *
 * Issue taxonomy (spec §5):
 *   disease:  leaf_spot · blight · rust · mildew · mosaic · rot · wilt
 *   pest:     holes · chewing · leaf_miners · mites · aphids ·
 *             whiteflies · thrips · armyworm
 *   stress:   yellowing · curling · wilting · water_stress ·
 *             nutrient_stress · sun_scorch
 *   healthy:  no_visible_issue
 *
 * Every classification returns:
 *   {
 *     objectType,  plantName,  scientificName,
 *     confidence,  topCandidates,  healthStatus,
 *     issueType,   issueCandidates,  severity,
 *     whatWeNoticed, whyItMatters,  nextAction,
 *     followUpDate,  limitations,
 *   }
 */

const _safe = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};
const _str = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export const UNIVERSAL_SCAN_VERSION = 'universal-scan-classifier-v1';

// ───── Object-type catalog (spec §4) ──────────────────────────
// Each entry maps common keywords + scientific genus stems to one
// of the spec's 11 object types. Order matters — first match wins.
export const OBJECT_TYPE_RULES: ReadonlyArray<Readonly<{
  type: string; patterns: ReadonlyArray<RegExp>;
}>> = Object.freeze([
  // Fruits
  { type: 'fruit', patterns: Object.freeze([
    /mango|mangifera/i, /banana|musa/i, /plantain/i, /orange|citrus\s*sinensis/i,
    /lemon|lime|citrus\s*limon/i, /avocado|persea/i, /pineapple|ananas/i,
    /papaya|carica/i, /apple|malus/i, /pear|pyrus/i,
    /strawberry|fragaria/i, /grape|vitis/i, /watermelon|citrullus/i,
    /pomegranate|punica/i, /fig\b|ficus\s*carica/i, /guava|psidium/i,
  ]) },
  // Vegetables (note: tomato classed as fruit botanically but
  // farmers treat as vegetable — we tag it `vegetable` for the UX).
  { type: 'vegetable', patterns: Object.freeze([
    /tomato|solanum\s*lycopersicum/i, /pepper|capsicum/i, /onion|allium\s*cepa/i,
    /garlic|allium\s*sativum/i, /leek|allium\s*porrum/i, /okra|abelmoschus/i,
    /cabbage|brassica\s*oleracea/i, /lettuce|lactuca/i, /carrot|daucus/i,
    /cucumber|cucumis\s*sativus/i, /eggplant|solanum\s*melongena|aubergine/i,
    /spinach|spinacia/i, /amaranth|amaranthus/i, /kale|brassica/i,
    /pumpkin|cucurbita/i, /zucchini|courgette/i, /sweet\s*potato|ipomoea/i,
  ]) },
  // Leafy / staple crops
  { type: 'crop', patterns: Object.freeze([
    /cassava|manihot/i, /maize|corn|zea\s*mays/i, /rice|oryza/i,
    /bean|phaseolus|vigna/i, /cowpea/i, /chickpea|cicer/i,
    /soybean|glycine/i, /yam|dioscorea/i, /potato|solanum\s*tuberosum/i,
    /cocoa|theobroma/i, /coffee|coffea/i, /sugarcane|saccharum/i,
    /sorghum|millet|pennisetum/i, /wheat|triticum/i, /barley|hordeum/i,
  ]) },
  // Flowers + ornamentals
  { type: 'flower', patterns: Object.freeze([
    /rose|rosa/i, /hibiscus/i, /tulip|tulipa/i, /lily|lilium/i,
    /sunflower|helianthus/i, /marigold|tagetes/i, /jasmine|jasminum/i,
    /orchid|orchidaceae/i, /gerbera/i, /chrysanthemum/i,
    /dahlia/i, /petunia/i, /zinnia/i, /lavender|lavandula/i,
  ]) },
  // Herbs
  { type: 'herb', patterns: Object.freeze([
    /basil|ocimum/i, /mint|mentha/i, /oregano|origanum/i,
    /thyme|thymus/i, /rosemary|salvia\s*rosmarinus|rosmarinus/i,
    /sage|salvia\s*officinalis/i, /parsley|petroselinum/i,
    /cilantro|coriander|coriandrum/i, /aloe|aloe\s*vera/i,
    /lemongrass|cymbopogon/i, /moringa|moringa\s*oleifera/i,
  ]) },
  // Trees
  { type: 'tree', patterns: Object.freeze([
    /oak|quercus/i, /pine|pinus/i, /eucalyptus/i,
    /baobab|adansonia/i, /acacia/i, /neem|azadirachta/i,
    /tamarind|tamarindus/i, /mahogany|swietenia/i, /teak|tectona/i,
    /jacaranda/i, /cedar|cedrus/i, /palm|arecaceae|cocos/i,
  ]) },
  // Weeds (common ag weeds)
  { type: 'weed', patterns: Object.freeze([
    /amaranthus\s*spinosus|spiny\s*amaranth/i,
    /dandelion|taraxacum/i, /crabgrass|digitaria/i,
    /pigweed/i, /thistle|cirsium/i, /nutsedge|cyperus/i,
    /chickweed|stellaria/i, /quackgrass|elymus/i,
    /johnsongrass|sorghum\s*halepense/i,
  ]) },
  // Seedling — early-growth detection by phrasing
  { type: 'seedling', patterns: Object.freeze([
    /seedling/i, /sprout(?:ing)?/i, /germinating/i,
  ]) },
  // Soil-only surface
  { type: 'soil_surface', patterns: Object.freeze([
    /^soil$/i, /bare\s*ground/i,
  ]) },
]);

/**
 * Classify the dominant object type from the species name + the
 * top scientific-name candidates. Returns one of the spec's 11
 * categories. Falls back to 'leaf' (the most actionable default
 * for grower images) when nothing matches but a plant was found;
 * 'unknown' when no signal at all.
 */
export function classifyObjectType(input: {
  plantName?: string;
  scientificName?: string;
  topCandidates?: ReadonlyArray<{ commonName?: string; scientificName?: string }>;
  hasPlantSignal?: boolean;
}): string {
  return _safe(() => {
    const haystack = [
      _str(input.plantName),
      _str(input.scientificName),
      ..._arr(input.topCandidates)
        .map((c) => _str(c && (c.commonName || (c as any).name))),
      ..._arr(input.topCandidates)
        .map((c) => _str(c && c.scientificName)),
    ].filter(Boolean).join(' | ').toLowerCase();
    if (!haystack) {
      return input.hasPlantSignal ? 'leaf' : 'unknown';
    }
    for (const rule of OBJECT_TYPE_RULES) {
      for (const pat of rule.patterns) {
        if (pat.test(haystack)) return rule.type;
      }
    }
    // Plant identified but doesn't match a known catalog entry —
    // default to 'leaf' (the most common scan shape) rather than
    // 'unknown' so the UI never reads "Unknown" while a plant
    // signal exists.
    return 'leaf';
  }, 'unknown');
}

// ───── Issue taxonomy (spec §5) ───────────────────────────────
export const ISSUE_RULES: ReadonlyArray<Readonly<{
  issueType: string;
  category:  'disease' | 'pest' | 'stress' | 'healthy';
  patterns:  ReadonlyArray<RegExp>;
  severity:  'high' | 'medium' | 'low';
}>> = Object.freeze([
  // Disease
  { issueType: 'leaf_spot', category: 'disease', severity: 'medium',
    patterns: Object.freeze([/spot|lesion/i]) },
  { issueType: 'blight',    category: 'disease', severity: 'high',
    patterns: Object.freeze([/blight|alternaria|phytophthora/i]) },
  { issueType: 'rust',      category: 'disease', severity: 'medium',
    patterns: Object.freeze([/rust|puccinia|uromyces/i]) },
  { issueType: 'mildew',    category: 'disease', severity: 'medium',
    patterns: Object.freeze([/mildew|powdery|downy/i]) },
  { issueType: 'mosaic',    category: 'disease', severity: 'high',
    patterns: Object.freeze([/mosaic|virus/i]) },
  { issueType: 'rot',       category: 'disease', severity: 'high',
    patterns: Object.freeze([/\brot\b|botrytis|fusarium/i]) },
  { issueType: 'wilt',      category: 'disease', severity: 'high',
    patterns: Object.freeze([/wilt(?!ing)|verticillium/i]) },
  // Pest
  { issueType: 'holes',         category: 'pest', severity: 'medium',
    patterns: Object.freeze([/hole|chewed|notch/i]) },
  { issueType: 'chewing',       category: 'pest', severity: 'medium',
    patterns: Object.freeze([/chew|bite\s*mark/i]) },
  { issueType: 'leaf_miners',   category: 'pest', severity: 'medium',
    patterns: Object.freeze([/leaf\s*miner|liriomyza|agromyzidae/i]) },
  { issueType: 'mites',         category: 'pest', severity: 'medium',
    patterns: Object.freeze([/\bmite\b|tetranychus/i]) },
  { issueType: 'aphids',        category: 'pest', severity: 'low',
    patterns: Object.freeze([/aphid|greenfly/i]) },
  { issueType: 'whiteflies',    category: 'pest', severity: 'medium',
    patterns: Object.freeze([/whitefly|aleyrodidae|bemisia/i]) },
  { issueType: 'thrips',        category: 'pest', severity: 'medium',
    patterns: Object.freeze([/thrip|frankliniella/i]) },
  { issueType: 'armyworm',      category: 'pest', severity: 'high',
    patterns: Object.freeze([/armyworm|spodoptera/i]) },
  // Stress
  { issueType: 'yellowing',      category: 'stress', severity: 'medium',
    patterns: Object.freeze([/yellow|chloros|nitrogen\s*deficien/i]) },
  { issueType: 'curling',        category: 'stress', severity: 'medium',
    patterns: Object.freeze([/curl|leaf\s*roll/i]) },
  { issueType: 'wilting',        category: 'stress', severity: 'medium',
    patterns: Object.freeze([/wilting|droop|limp/i]) },
  { issueType: 'water_stress',   category: 'stress', severity: 'medium',
    patterns: Object.freeze([/water\s*stress|drought|over\s*water/i]) },
  { issueType: 'nutrient_stress',category: 'stress', severity: 'medium',
    patterns: Object.freeze([/nutrient|deficien|magnesium|potassium/i]) },
  { issueType: 'sun_scorch',     category: 'stress', severity: 'medium',
    patterns: Object.freeze([/scorch|sunburn|sun\s*burn/i]) },
  // Healthy
  { issueType: 'no_visible_issue', category: 'healthy', severity: 'low',
    patterns: Object.freeze([/healthy|normal|fine\b/i]) },
]);

/**
 * Classify the issue from a free-text description (disease name,
 * symptom phrase, pest name, etc.). Returns the matched issueType
 * + category + severity, OR null when no signal.
 */
export function classifyIssue(text: string): Readonly<{
  issueType: string; category: string; severity: 'high' | 'medium' | 'low';
}> | null {
  return _safe(() => {
    const s = _str(text).toLowerCase().trim();
    if (!s) return null;
    for (const rule of ISSUE_RULES) {
      for (const pat of rule.patterns) {
        if (pat.test(s)) {
          return Object.freeze({
            issueType: rule.issueType,
            category:  rule.category,
            severity:  rule.severity,
          });
        }
      }
    }
    return null;
  }, null);
}

// ───── Safe next action engine (spec §6) ──────────────────────
const SAFE_NEXT_ACTIONS: Readonly<Record<string, string>> = Object.freeze({
  // Healthy / monitoring
  no_visible_issue: 'Keep monitoring. Scan again in 7 days.',
  // Stress (water / nutrient / sun / yellowing / curling / wilting)
  yellowing:        'Check soil moisture today.',
  curling:          'Check soil moisture and shade levels today.',
  wilting:          'Water the plant and check root zone today.',
  water_stress:     'Water the plant and check root zone today.',
  nutrient_stress:  'Side-dress with compost or balanced fertilizer; soil test if available.',
  sun_scorch:       'Add shade for the next 3-5 days; water at dawn.',
  // Pest
  holes:            'Inspect under the leaves for insects.',
  chewing:          'Inspect under the leaves at dusk for chewing insects.',
  leaf_miners:      'Remove and destroy affected leaves; cover plants with fine mesh.',
  mites:            'Mist the canopy and check for fine webbing; introduce predatory mites if confirmed.',
  aphids:           'Spray a soap-and-water solution; check for ants nearby.',
  whiteflies:       'Yellow sticky traps near the plant; check for honeydew.',
  thrips:           'Yellow sticky traps; inspect new growth.',
  armyworm:         'Inspect at dusk; hand-pick larvae or use Bt spray as first option.',
  // Disease
  leaf_spot:        'Remove badly affected leaves if safe. Scan again in 3 days.',
  blight:           'Remove affected plants from healthy ones; improve airflow. Scan again in 3 days.',
  rust:             'Remove rusted leaves; improve airflow; avoid overhead watering.',
  mildew:           'Improve airflow; water at the base; remove the worst leaves.',
  mosaic:           'Quarantine affected plants; sanitize tools; replant resistant varieties next season.',
  rot:              'Remove rotting tissue; check drainage; reduce watering frequency.',
  wilt:             'Check soil drainage; quarantine the plant if disease is suspected.',
});

/**
 * Return a safe, conservative next action for the issue. Always
 * non-chemical-first; never names a specific pesticide / dosage.
 *
 * Spec §6 honesty: low-confidence path returns "Retake photo
 * closer or choose a possible match." instead of guessing.
 */
export function safeNextAction(input: {
  issueType?: string | null;
  confidencePct?: number | null;
  hasCandidates?: boolean;
}): string {
  return _safe(() => {
    const conf = _num(input.confidencePct);
    if (conf != null && conf < 60) {
      return input.hasCandidates
        ? 'Retake the photo closer or choose a possible match from the list.'
        : 'Retake the photo in good light, focused on one leaf or fruit.';
    }
    const iss = _str(input.issueType);
    if (iss && SAFE_NEXT_ACTIONS[iss]) return SAFE_NEXT_ACTIONS[iss];
    return 'Keep monitoring. Scan again in 7 days.';
  }, 'Keep monitoring. Scan again in 7 days.');
}

/**
 * Honest "what we noticed" sentence — never fabricates a finding.
 */
export function whatWeNoticedFor(input: {
  objectType?: string;
  issue?: Readonly<{ issueType: string; category: string }> | null;
  confidencePct?: number | null;
  plantName?: string;
}): string {
  return _safe(() => {
    const conf = _num(input.confidencePct);
    if (input.issue) {
      const human = String(input.issue.issueType).replace(/_/g, ' ');
      return 'Possible ' + human + ' (' + input.issue.category + ').';
    }
    if (conf != null && conf < 60) {
      return 'The photo did not give us enough signal to be sure.';
    }
    if (_str(input.plantName)) {
      return 'No clear issue from this photo.';
    }
    return 'We could not analyze this photo.';
  }, 'No clear issue from this photo.');
}

// Public catalog accessors for diagnostics / tests / gates.
export function universalScanInfo() {
  return Object.freeze({
    runtimeVersion: UNIVERSAL_SCAN_VERSION,
    objectTypes:    Object.freeze(OBJECT_TYPE_RULES.map((r) => r.type)
                      .concat(['unknown'])),
    issueTypes:     Object.freeze(ISSUE_RULES.map((r) => r.issueType)),
    safeActionKeys: Object.freeze(Object.keys(SAFE_NEXT_ACTIONS)),
  });
}

export const _internal = Object.freeze({
  classifyObjectType, classifyIssue, safeNextAction, whatWeNoticedFor,
  OBJECT_TYPE_RULES, ISSUE_RULES, SAFE_NEXT_ACTIONS,
});

export default classifyObjectType;
