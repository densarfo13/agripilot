/**
 * issueAnalysisEngine.js — server-side companion to
 * src/runtime/universalScan/UniversalScanClassifier.ts.
 *
 * Provides:
 *   - classifyObjectType({ plantName, scientificName, topCandidates,
 *       hasPlantSignal }) → string
 *   - classifyIssue(text) → { issueType, category, severity } | null
 *   - safeNextAction({ issueType, confidencePct, hasCandidates }) → string
 *
 * 18-label issue taxonomy (spec §5):
 *   leaf_spot · blight · rust · mildew · mosaic · rot · wilt
 *   holes · chewing · leaf_miners · mites · aphids · whiteflies
 *   thrips · armyworm
 *   yellowing · curling · sun_scorch
 *
 * 11 object types (spec §1):
 *   fruit · vegetable · leaf · crop · flower · herb · tree ·
 *   weed · soil_surface · seedling · unknown
 *
 * Pure. Never throws. Frozen returns.
 *
 * Safety rule (spec §6): every nextAction recommendation is
 * non-chemical-first; no pesticide name; no dosage. The grower
 * UI never reads a chemical instruction from this module.
 */

function _str(v) { return typeof v === 'string' ? v : ''; }
function _num(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v : null;
}
function _arr(v) { return Array.isArray(v) ? v : []; }
function _safe(fn, fb) { try { return fn(); } catch { return fb; } }

export const ISSUE_ANALYSIS_VERSION = 'issue-analysis-engine-v1';

// ─── Object-type catalog (spec §4) ────────────────────────────
const OBJECT_TYPE_RULES = Object.freeze([
  { type: 'fruit', patterns: [
    /mango|mangifera/i, /banana|musa/i, /plantain/i, /orange|citrus\s*sinensis/i,
    /lemon|lime|citrus\s*limon/i, /avocado|persea/i, /pineapple|ananas/i,
    /papaya|carica/i, /apple|malus/i, /pear|pyrus/i,
    /strawberry|fragaria/i, /grape|vitis/i, /watermelon|citrullus/i,
    /pomegranate|punica/i, /fig\b|ficus\s*carica/i, /guava|psidium/i,
  ] },
  { type: 'vegetable', patterns: [
    /tomato|solanum\s*lycopersicum/i, /pepper|capsicum/i, /onion|allium\s*cepa/i,
    /garlic|allium\s*sativum/i, /leek|allium\s*porrum/i, /okra|abelmoschus/i,
    /cabbage|brassica\s*oleracea/i, /lettuce|lactuca/i, /carrot|daucus/i,
    /cucumber|cucumis\s*sativus/i, /eggplant|solanum\s*melongena|aubergine/i,
    /spinach|spinacia/i, /amaranth|amaranthus/i, /kale|brassica/i,
    /pumpkin|cucurbita/i, /zucchini|courgette/i, /sweet\s*potato|ipomoea/i,
  ] },
  { type: 'crop', patterns: [
    /cassava|manihot/i, /maize|corn|zea\s*mays/i, /rice|oryza/i,
    /bean|phaseolus|vigna/i, /cowpea/i, /chickpea|cicer/i,
    /soybean|glycine/i, /yam|dioscorea/i, /potato|solanum\s*tuberosum/i,
    /cocoa|theobroma/i, /coffee|coffea/i, /sugarcane|saccharum/i,
    /sorghum|millet|pennisetum/i, /wheat|triticum/i, /barley|hordeum/i,
  ] },
  { type: 'flower', patterns: [
    /rose|rosa/i, /hibiscus/i, /tulip|tulipa/i, /lily|lilium/i,
    /sunflower|helianthus/i, /marigold|tagetes/i, /jasmine|jasminum/i,
    /orchid|orchidaceae/i, /gerbera/i, /chrysanthemum/i,
    /dahlia/i, /petunia/i, /zinnia/i, /lavender|lavandula/i,
  ] },
  { type: 'herb', patterns: [
    /basil|ocimum/i, /mint|mentha/i, /oregano|origanum/i,
    /thyme|thymus/i, /rosemary|salvia\s*rosmarinus|rosmarinus/i,
    /sage|salvia\s*officinalis/i, /parsley|petroselinum/i,
    /cilantro|coriander|coriandrum/i, /aloe|aloe\s*vera/i,
    /lemongrass|cymbopogon/i, /moringa|moringa\s*oleifera/i,
  ] },
  { type: 'tree', patterns: [
    /oak|quercus/i, /pine|pinus/i, /eucalyptus/i,
    /baobab|adansonia/i, /acacia/i, /neem|azadirachta/i,
    /tamarind|tamarindus/i, /mahogany|swietenia/i, /teak|tectona/i,
    /jacaranda/i, /cedar|cedrus/i, /palm|arecaceae|cocos/i,
  ] },
  { type: 'weed', patterns: [
    /amaranthus\s*spinosus|spiny\s*amaranth/i,
    /dandelion|taraxacum/i, /crabgrass|digitaria/i,
    /pigweed/i, /thistle|cirsium/i, /nutsedge|cyperus/i,
    /chickweed|stellaria/i, /quackgrass|elymus/i,
    /johnsongrass|sorghum\s*halepense/i,
  ] },
  { type: 'seedling', patterns: [
    /seedling/i, /sprout(?:ing)?/i, /germinating/i,
  ] },
  { type: 'soil_surface', patterns: [
    /^soil$/i, /bare\s*ground/i,
  ] },
]);

// ─── Issue catalog (spec §5) ──────────────────────────────────
const ISSUE_RULES = Object.freeze([
  { issueType: 'leaf_spot', category: 'disease', severity: 'medium',
    patterns: [/spot|lesion/i] },
  { issueType: 'blight',    category: 'disease', severity: 'high',
    patterns: [/blight|alternaria|phytophthora/i] },
  { issueType: 'rust',      category: 'disease', severity: 'medium',
    patterns: [/rust|puccinia|uromyces/i] },
  { issueType: 'mildew',    category: 'disease', severity: 'medium',
    patterns: [/mildew|powdery|downy/i] },
  { issueType: 'mosaic',    category: 'disease', severity: 'high',
    patterns: [/mosaic|virus/i] },
  { issueType: 'rot',       category: 'disease', severity: 'high',
    patterns: [/\brot\b|botrytis|fusarium/i] },
  { issueType: 'wilt',      category: 'disease', severity: 'high',
    patterns: [/wilt(?!ing)|verticillium/i] },
  { issueType: 'holes',         category: 'pest', severity: 'medium',
    patterns: [/hole|chewed|notch/i] },
  { issueType: 'chewing',       category: 'pest', severity: 'medium',
    patterns: [/chew|bite\s*mark/i] },
  { issueType: 'leaf_miners',   category: 'pest', severity: 'medium',
    patterns: [/leaf\s*miner|liriomyza|agromyzidae/i] },
  { issueType: 'mites',         category: 'pest', severity: 'medium',
    patterns: [/\bmite\b|tetranychus/i] },
  { issueType: 'aphids',        category: 'pest', severity: 'low',
    patterns: [/aphid|greenfly/i] },
  { issueType: 'whiteflies',    category: 'pest', severity: 'medium',
    patterns: [/whitefly|aleyrodidae|bemisia/i] },
  { issueType: 'thrips',        category: 'pest', severity: 'medium',
    patterns: [/thrip|frankliniella/i] },
  { issueType: 'armyworm',      category: 'pest', severity: 'high',
    patterns: [/armyworm|spodoptera/i] },
  { issueType: 'yellowing',      category: 'stress', severity: 'medium',
    patterns: [/yellow|chloros|nitrogen\s*deficien/i] },
  { issueType: 'curling',        category: 'stress', severity: 'medium',
    patterns: [/curl|leaf\s*roll/i] },
  { issueType: 'sun_scorch',     category: 'stress', severity: 'medium',
    patterns: [/scorch|sunburn|sun\s*burn/i] },
]);

// ─── Safe next-action map (spec §6) ───────────────────────────
const SAFE_NEXT_ACTIONS = Object.freeze({
  // healthy
  no_visible_issue: 'Keep monitoring. Scan again in 7 days.',
  // stress
  yellowing:        'Check soil moisture today.',
  curling:          'Check soil moisture and shade levels today.',
  sun_scorch:       'Add shade for the next 3-5 days; water at dawn.',
  // pest
  holes:            'Inspect under the leaves for insects.',
  chewing:          'Inspect under the leaves at dusk for chewing insects.',
  leaf_miners:      'Remove and destroy affected leaves; cover plants with fine mesh.',
  mites:            'Mist the canopy and check for fine webbing.',
  aphids:           'Spray a soap-and-water solution; check for ants nearby.',
  whiteflies:       'Yellow sticky traps near the plant; check for honeydew.',
  thrips:           'Yellow sticky traps; inspect new growth.',
  armyworm:         'Inspect at dusk; hand-pick larvae or use Bt spray as first option.',
  // disease
  leaf_spot:        'Remove badly affected leaves if safe. Scan again in 3 days.',
  blight:           'Remove affected plants from healthy ones; improve airflow. Scan again in 3 days.',
  rust:             'Remove rusted leaves; improve airflow; avoid overhead watering.',
  mildew:           'Improve airflow; water at the base; remove the worst leaves.',
  mosaic:           'Quarantine affected plants; sanitize tools; replant resistant varieties next season.',
  rot:              'Remove rotting tissue; check drainage; reduce watering frequency.',
  wilt:             'Check soil drainage; quarantine the plant if disease is suspected.',
});

/**
 * Map a plant name + top candidates to one of 11 object types.
 * Returns 'leaf' when a plant signal exists but nothing matches the
 * catalog; 'unknown' when there is no signal at all.
 */
export function classifyObjectType({
  plantName, scientificName, topCandidates, hasPlantSignal,
} = {}) {
  return _safe(() => {
    const parts = [
      _str(plantName),
      _str(scientificName),
      ..._arr(topCandidates).map((c) => _str(c && (c.commonName || c.name))),
      ..._arr(topCandidates).map((c) => _str(c && c.scientificName)),
    ].filter(Boolean);
    if (parts.length === 0) {
      return hasPlantSignal ? 'leaf' : 'unknown';
    }
    const hay = parts.join(' | ').toLowerCase();
    for (const rule of OBJECT_TYPE_RULES) {
      for (const pat of rule.patterns) {
        if (pat.test(hay)) return rule.type;
      }
    }
    return 'leaf';
  }, 'unknown');
}

/**
 * Classify a free-text issue/symptom phrase into one of 18 labels.
 * Returns null on no match — never guesses an issue.
 */
export function classifyIssue(text) {
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

/**
 * Pick a single safe next action. Spec §6 honesty rule: low-confidence
 * paths return a "retake / choose match" prompt instead of guessing.
 */
export function safeNextAction({
  issueType, confidencePct, hasCandidates,
} = {}) {
  return _safe(() => {
    const conf = _num(confidencePct);
    if (conf != null && conf < 60) {
      return hasCandidates
        ? 'Retake the photo closer or choose a possible match from the list.'
        : 'Retake the photo in good light, focused on one leaf or fruit.';
    }
    const iss = _str(issueType);
    if (iss && SAFE_NEXT_ACTIONS[iss]) return SAFE_NEXT_ACTIONS[iss];
    return 'Keep monitoring. Scan again in 7 days.';
  }, 'Keep monitoring. Scan again in 7 days.');
}

/**
 * Composite analyzer: from a partial scan envelope returns
 *   { objectType, issueType, severity, nextAction, whatWeNoticed }
 * All fields always populated (never null/undefined).
 */
export function analyzeUniversalScan({
  plantName, scientificName, topCandidates,
  issueText, confidencePct, hasPlantSignal,
} = {}) {
  return _safe(() => {
    const objectType = classifyObjectType({
      plantName, scientificName, topCandidates, hasPlantSignal,
    });
    const issue = classifyIssue(issueText);
    const hasCandidates = _arr(topCandidates).length > 0;
    const nextAction = safeNextAction({
      issueType:     issue ? issue.issueType : null,
      confidencePct,
      hasCandidates,
    });
    let whatWeNoticed;
    if (issue) {
      whatWeNoticed = 'Possible ' + String(issue.issueType).replace(/_/g, ' ')
        + ' (' + issue.category + ').';
    } else if (_num(confidencePct) != null && _num(confidencePct) < 60) {
      whatWeNoticed = 'The photo did not give us enough signal to be sure.';
    } else if (_str(plantName)) {
      whatWeNoticed = 'No clear issue from this photo.';
    } else {
      whatWeNoticed = 'We could not analyze this photo.';
    }
    return Object.freeze({
      objectType,
      issueType:     issue ? issue.issueType : 'no_visible_issue',
      category:      issue ? issue.category  : 'healthy',
      severity:      issue ? issue.severity  : 'low',
      nextAction,
      whatWeNoticed,
      neverFabricatesIssue: true,
      neverNamesPesticide:  true,
      neverNamesDosage:     true,
    });
  }, Object.freeze({
    objectType:    'unknown',
    issueType:     'no_visible_issue',
    category:      'healthy',
    severity:      'low',
    nextAction:    'Retake the photo in good light, focused on one leaf or fruit.',
    whatWeNoticed: 'We could not analyze this photo.',
    neverFabricatesIssue: true,
    neverNamesPesticide:  true,
    neverNamesDosage:     true,
  }));
}

export const ISSUE_LABELS = Object.freeze(ISSUE_RULES.map((r) => r.issueType));
export const OBJECT_TYPES = Object.freeze(
  OBJECT_TYPE_RULES.map((r) => r.type).concat(['leaf', 'unknown']));

export default analyzeUniversalScan;
