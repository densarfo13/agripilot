/**
 * src/modules/plants/PlantKnowledgeEngine.ts — knowledge surface.
 *
 *   import {
 *     getPlantKnowledge, answerPlantQuestion,
 *     PLANT_KNOWLEDGE_VERSION,
 *   } from 'src/modules/plants/PlantKnowledgeEngine';
 *
 *   getPlantKnowledge({ plantId: 'tomato' })
 *     → frozen knowledge envelope
 *
 *   answerPlantQuestion({ question: 'why are my roses yellowing?' })
 *     → deterministic intent-routed answer
 *
 * What this is
 * ────────────
 *   The "what we know about this plant" surface. Composes the
 *   plant DB + existing engines:
 *     • care tips         from plant DB fields
 *     • companion advice  from companionEngine
 *     • pollinator value  from pollinatorEngine
 *     • bloom forecast    from flowerAdvisor (when applicable)
 *     • diseases / pests  from diseaseForecast + pestRiskEngine
 *     • Q&A passthrough   to aiPlantAssistant (deterministic, no LLM)
 *
 *   The Q&A path is HONEST — it routes intent over the plant DB,
 *   never invokes a model. Confidence is 'heuristic' / 'low' /
 *   'unknown', never invented.
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • Composition-only — reads plant DB + injected signals.
 *   • No LLM, no fetch, no persistence writes.
 *   • All copy via tSafe envelopes.
 */

import { findPlant } from '../../data/plants/index.js';
import { companionAdvice } from '../../runtime/grow/companionEngine';
import { pollinatorScore } from '../../runtime/grow/pollinatorEngine';
import { flowerAdvisor }   from '../../runtime/grow/flowerAdvisor';
import { diseaseForecast } from '../../intelligence/diseaseForecast';
import { pestRiskEngine }  from '../../intelligence/pestRiskEngine';
import { aiPlantAssistant } from '../../runtime/grow/aiPlantAssistant.js';

export const PLANT_KNOWLEDGE_VERSION = 'plant-knowledge-engine-v1';

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

function _careTips(plant: any) {
  const tips: any[] = [];
  const sun   = _str(plant.sunlight) || _str(plant.sun);
  const water = _str(plant.waterNeeds) || _str(plant.water);
  if (sun) tips.push(Object.freeze({
    kind: 'sun',
    labelKey: 'plant.tip.sun.' + sun,
    labelDefault: sun === 'full'    ? 'Likes full sun.'
                : sun === 'partial' ? 'Likes partial shade.'
                : sun === 'indirect' ? 'Likes bright, indirect light.'
                : sun === 'low'      ? 'Tolerates low light.'
                : 'Match sunlight to plant.',
  }));
  if (water) tips.push(Object.freeze({
    kind: 'water',
    labelKey: 'plant.tip.water.' + water,
    labelDefault: water === 'high'   ? 'Water generously and often.'
                : water === 'medium' ? 'Water when topsoil is dry.'
                : water === 'low'    ? 'Water sparingly — do not overwater.'
                : 'Match watering to plant.',
  }));
  if (plant.droughtResistant) tips.push(Object.freeze({
    kind: 'drought',
    labelKey: 'plant.tip.drought',
    labelDefault: 'Drought-resistant once established.',
  }));
  if (plant.indoor || plant.indoorFriendly) tips.push(Object.freeze({
    kind: 'indoor',
    labelKey: 'plant.tip.indoor',
    labelDefault: 'Thrives indoors with the right light.',
  }));
  const lifecycle = _str(plant.lifecycle);
  if (lifecycle) tips.push(Object.freeze({
    kind: 'lifecycle',
    labelKey: 'plant.tip.lifecycle.' + lifecycle,
    labelDefault: lifecycle === 'annual'     ? 'Annual — completes its lifecycle in one year.'
                : lifecycle === 'perennial'  ? 'Perennial — comes back year after year.'
                : lifecycle === 'biennial'   ? 'Biennial — blooms in its second year.'
                : '',
  }));
  return Object.freeze(tips);
}

interface KnowledgeCtx {
  plantId?:      string;
  weather?:      any;
  season?:       string;
  haveInGarden?: string[];
  region?:       string;
  now?:          number;
}

export function getPlantKnowledge(ctx: KnowledgeCtx) {
  return _safe(() => {
    const c     = _isObj(ctx) ? ctx : {} as KnowledgeCtx;
    const plant = _str(c.plantId) ? findPlant(c.plantId) : null;
    if (!plant) {
      return Object.freeze({
        runtimeVersion: PLANT_KNOWLEDGE_VERSION,
        ok: false, reason: 'no_plant',
        plantId: _str(c.plantId),
      });
    }

    const companions = companionAdvice({
      plantId: _str(plant.id),
      haveInGarden: c.haveInGarden,
    } as any);
    const pollinator = pollinatorScore({
      plantIds: [_str(plant.id)],
    });
    const isFlowerish = _str(plant.type) === 'flower'
                     || _str(plant.type) === 'herb';
    const bloom = isFlowerish
      ? flowerAdvisor({
          plantId: _str(plant.id),
          weather: c.weather, season: _str(c.season),
          now: c.now,
        } as any)
      : null;
    const diseases = diseaseForecast({
      plantId: _str(plant.id),
      weather: c.weather,
    } as any);
    const pests = pestRiskEngine({
      plantId: _str(plant.id),
      weather: c.weather,
      regionLabel: _str(c.region),
      now: c.now,
    } as any);

    return Object.freeze({
      runtimeVersion: PLANT_KNOWLEDGE_VERSION,
      ok: true, reason: '',
      identity: Object.freeze({
        id:             _str(plant.id),
        commonName:     _str(plant.commonName) || _str(plant.name),
        scientificName: _str(plant.scientificName),
        family:         _str(plant.family),
        category:       _str(plant.type),
        lifecycle:      _str(plant.lifecycle),
        image:          _str(plant.image),
      }),
      careTips:       _careTips(plant),
      companions:     Object.freeze({
        good:               (companions as any).good,
        avoid:              (companions as any).avoid,
        conflictsInGarden:  (companions as any).conflictsInGarden,
        synergyInGarden:    (companions as any).synergyInGarden,
      }),
      pollinator:     Object.freeze({
        score:    _num((pollinator as any).score) || 0,
        friendly: !!(pollinator as any).friendly,
        attracts: (pollinator as any).attracts || Object.freeze([]),
      }),
      bloomForecast:  bloom ? (bloom as any).bloomForecast : null,
      diseaseRisks:   Object.freeze({
        forecasts:   (diseases as any).forecasts,
        topForecast: (diseases as any).topForecast,
      }),
      pestRisks:      Object.freeze({
        risks:   (pests as any).risks,
        topRisk: (pests as any).topRisk,
      }),
      deferred: Object.freeze({
        llmAssistant:
          'Q&A uses deterministic intent routing for honest '
          + 'confidence; LLM integration deferred',
      }),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_KNOWLEDGE_VERSION,
    ok: false, reason: 'error',
    plantId: '',
  }));
}

interface QuestionCtx {
  question?: string;
  plantId?:  string;
  weather?:  any;
}

/**
 * Routes the user's question through the existing deterministic
 * aiPlantAssistant. NEVER calls an LLM.
 */
export function answerPlantQuestion(ctx: QuestionCtx) {
  return _safe(() => {
    const c        = _isObj(ctx) ? ctx : {} as QuestionCtx;
    const question = _str(c.question);
    if (!question) {
      return Object.freeze({
        runtimeVersion: PLANT_KNOWLEDGE_VERSION,
        ok: false, reason: 'no_question',
      });
    }
    // The assistant accepts {question} and uses plant intent over
    // the DB. We add the optional plantId hint via the question
    // text so the existing extractor picks it up — non-invasive.
    const hinted = _str(c.plantId)
      ? question + ' (about ' + _str(c.plantId) + ')'
      : question;
    const ans = aiPlantAssistant({ question: hinted });
    return Object.freeze({
      runtimeVersion: PLANT_KNOWLEDGE_VERSION,
      answer: ans,
      ok: !!(ans as any).ok,
      reason: _str((ans as any).reason),
    });
  }, Object.freeze({
    runtimeVersion: PLANT_KNOWLEDGE_VERSION,
    ok: false, reason: 'error',
    answer: null,
  }));
}
