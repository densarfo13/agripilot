/**
 * runtime/grow/aiPlantAssistant.js — Phase 13 deterministic
 * plant Q&A.
 *
 *   import { aiPlantAssistant, AI_PLANT_ASSISTANT_VERSION }
 *     from 'src/runtime/grow/aiPlantAssistant.js';
 *
 *   aiPlantAssistant({ question: 'Why are my roses turning yellow?' })
 *
 * Why this is DETERMINISTIC, not LLM-backed
 * ─────────────────────────────────────────
 *   The standing strict-rule says DO NOT build predictive AI
 *   without backing data. So this "Assistant" is a deterministic
 *   intent router over the plant DB:
 *     1. Extract plant from question (DB search).
 *     2. Extract symptom kind (yellow / brown / wilting / spots).
 *     3. Look up likely causes for that plant's disease list.
 *     4. Return a frozen envelope shaped exactly like the spec:
 *        { likelyCause, confidence, treatment, organicOption,
 *          chemicalOption, prevention, deferred }
 *
 *   The `confidence` is honest (heuristic / unknown) — never a
 *   fake LLM probability.
 *
 *   Real LLM integration is named-deferred.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No network calls. No external AI.
 *   • Confidence honestly reports 'heuristic' or 'unknown'.
 */

import { findPlant, searchPlants } from '../../data/plants/index.js';

export const AI_PLANT_ASSISTANT_VERSION = 'ai-plant-assistant-v1';

const _isObj = (v) => v != null && typeof v === 'object';
const _str   = (v) => (typeof v === 'string' ? v : '');
const _safe  = (fn, fb) => { try { return fn(); } catch { return fb; } };

const SYMPTOM_MAP = Object.freeze({
  yellow:    ['nutrient_deficiency', 'overwatering', 'leaf_yellowing',
              'iron_deficiency', 'leaf_spot'],
  yellowing: ['nutrient_deficiency', 'overwatering', 'leaf_yellowing'],
  brown:     ['drought', 'underwatering', 'leaf_tip_browning',
              'leaf_spot', 'sunburn'],
  wilting:   ['underwatering', 'root_rot', 'verticillium_wilt',
              'fusarium_wilt'],
  spots:     ['leaf_spot', 'powdery_mildew', 'aphids', 'bacterial_leaf_spot'],
  curling:   ['aphids', 'leaf_curling', 'spider_mites', 'peach_leaf_curl'],
  dropping:  ['leaf_drop', 'root_rot', 'overwatering'],
});

function _extractSymptom(q) {
  const s = _str(q).toLowerCase();
  for (const k of Object.keys(SYMPTOM_MAP)) {
    if (s.indexOf(k) !== -1) return k;
  }
  return '';
}

function _extractPlant(q) {
  const s = _str(q).toLowerCase();
  // Strip common verb fragments to improve the search hit rate
  const cleaned = s.replace(/why\s+are\s+my\s+|my\s+|the\s+|are\s+|is\s+/g, ' ')
                   .replace(/turning|going|getting/g, ' ')
                   .trim();
  // Pick the longest noun-like token (3-20 chars, alpha)
  const tokens = cleaned.split(/[^a-z]+/).filter((t) => t.length >= 3 && t.length <= 20);
  for (const t of tokens) {
    const p = findPlant(t.replace(/s$/, ''));
    if (p) return p;
  }
  for (const t of tokens) {
    const hits = searchPlants(t.replace(/s$/, ''), { limit: 1 });
    if (hits.length > 0) return hits[0];
  }
  return null;
}

const TREATMENTS = Object.freeze({
  overwatering: {
    treatmentKey: 'grow.ai.treatment.overwatering',
    treatmentDefault: 'Reduce watering; let the top inch of soil '
      + 'dry between waterings. Check drainage.',
    organicKey: 'grow.ai.organic.overwatering',
    organicDefault: 'Improve soil aeration with compost or perlite.',
    chemicalKey: 'grow.ai.chemical.overwatering',
    chemicalDefault: 'No chemical option needed; this is a watering '
      + 'correction.',
    preventionKey: 'grow.ai.prevention.overwatering',
    preventionDefault: 'Water when soil is dry, not on a schedule.',
  },
  underwatering: {
    treatmentKey: 'grow.ai.treatment.underwatering',
    treatmentDefault: 'Water deeply now; resume regular watering.',
    organicKey: 'grow.ai.organic.underwatering',
    organicDefault: 'Mulch the base to retain moisture.',
    chemicalKey: 'grow.ai.chemical.underwatering',
    chemicalDefault: 'No chemical option needed; this is a watering '
      + 'correction.',
    preventionKey: 'grow.ai.prevention.underwatering',
    preventionDefault: 'Monitor soil moisture daily in hot weather.',
  },
  nutrient_deficiency: {
    treatmentKey: 'grow.ai.treatment.nutrient',
    treatmentDefault: 'Apply a balanced fertilizer per label rates.',
    organicKey: 'grow.ai.organic.nutrient',
    organicDefault: 'Use compost tea or fish emulsion.',
    chemicalKey: 'grow.ai.chemical.nutrient',
    chemicalDefault: 'Use a balanced NPK fertilizer.',
    preventionKey: 'grow.ai.prevention.nutrient',
    preventionDefault: 'Feed during the active growing season.',
  },
  aphids: {
    treatmentKey: 'grow.ai.treatment.aphids',
    treatmentDefault: 'Spray off with water; treat persistent '
      + 'infestations with insecticidal soap.',
    organicKey: 'grow.ai.organic.aphids',
    organicDefault: 'Release ladybugs or use neem oil spray.',
    chemicalKey: 'grow.ai.chemical.aphids',
    chemicalDefault: 'Insecticidal soap; pyrethrin for severe cases.',
    preventionKey: 'grow.ai.prevention.aphids',
    preventionDefault: 'Plant companions like marigold and chives.',
  },
  powdery_mildew: {
    treatmentKey: 'grow.ai.treatment.mildew',
    treatmentDefault: 'Improve airflow; remove affected leaves.',
    organicKey: 'grow.ai.organic.mildew',
    organicDefault: 'Spray diluted neem oil or milk solution.',
    chemicalKey: 'grow.ai.chemical.mildew',
    chemicalDefault: 'Sulfur or potassium bicarbonate fungicide.',
    preventionKey: 'grow.ai.prevention.mildew',
    preventionDefault: 'Avoid wetting foliage; space plants well.',
  },
  root_rot: {
    treatmentKey: 'grow.ai.treatment.rootRot',
    treatmentDefault: 'Repot in fresh, well-draining soil; trim '
      + 'rotted roots.',
    organicKey: 'grow.ai.organic.rootRot',
    organicDefault: 'Use cinnamon as a natural fungicide on cut roots.',
    chemicalKey: 'grow.ai.chemical.rootRot',
    chemicalDefault: 'Copper-based fungicide for soil drench.',
    preventionKey: 'grow.ai.prevention.rootRot',
    preventionDefault: 'Never let plants sit in standing water.',
  },
});

const SYMPTOM_DEFAULT = Object.freeze({
  yellow:   'nutrient_deficiency',
  brown:    'underwatering',
  wilting:  'underwatering',
  spots:    'powdery_mildew',
  curling:  'aphids',
  dropping: 'overwatering',
});

function _nullEnvelope(reason) {
  return Object.freeze({
    runtimeVersion: AI_PLANT_ASSISTANT_VERSION,
    ok: false, reason,
    likelyCause:    '',
    confidence:     'unknown',
    treatmentKey:   '', treatmentDefault: '',
    organicKey:     '', organicDefault: '',
    chemicalKey:    '', chemicalDefault: '',
    preventionKey:  '', preventionDefault: '',
    deferred: Object.freeze({
      llmAssistant:
        'no LLM backend wired; assistant is deterministic intent '
        + 'routing over the plant DB',
    }),
  });
}

export function aiPlantAssistant(ctx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {};
    const question = _str(c.question);
    if (!question) return _nullEnvelope('no_question');

    const plant = _extractPlant(question);
    const symptom = _extractSymptom(question);
    if (!plant && !symptom) return _nullEnvelope('no_match');

    // Pick the most likely cause from the plant's disease list
    // intersected with the symptom map; fall back to the symptom
    // default.
    let cause = SYMPTOM_DEFAULT[symptom] || '';
    if (plant && symptom) {
      const cands = SYMPTOM_MAP[symptom] || [];
      const diseases = plant.diseases || [];
      for (const cand of cands) {
        if (diseases.indexOf(cand) !== -1) { cause = cand; break; }
      }
    }
    if (!cause) return _nullEnvelope('no_cause_match');

    const tx = TREATMENTS[cause];
    if (!tx) return _nullEnvelope('no_treatment');

    return Object.freeze({
      runtimeVersion: AI_PLANT_ASSISTANT_VERSION,
      ok: true, reason: '',
      plantId:        plant ? _str(plant.id) : '',
      plantName:      plant ? _str(plant.name) : '',
      symptom,
      likelyCause:    cause,
      confidence:     plant ? 'heuristic' : 'low',
      treatmentKey:   tx.treatmentKey,
      treatmentDefault: tx.treatmentDefault,
      organicKey:     tx.organicKey,
      organicDefault: tx.organicDefault,
      chemicalKey:    tx.chemicalKey,
      chemicalDefault: tx.chemicalDefault,
      preventionKey:  tx.preventionKey,
      preventionDefault: tx.preventionDefault,
      deferred: Object.freeze({
        llmAssistant:
          'real LLM integration deferred; today the assistant uses '
          + 'deterministic intent routing for honest confidence',
      }),
    });
  }, _nullEnvelope('error'));
}
