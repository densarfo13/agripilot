/**
 * insightEngine.js — farmer-facing insight + alert aggregator.
 *
 * Converts the raw outputs of the other intelligence layers
 * (seasonal, rainfall, yield, profit, registry) into an ordered,
 * prioritised list of short cards the dashboard renders as
 * "Today's Insights".
 *
 *   buildFarmInsights(ctx) → Insight[]
 *
 *   ctx = {
 *     cropId,                       // canonical or legacy code
 *     stage,                         // current lifecycle stage
 *     seasonFit,                     // 'high' | 'medium' | 'low' | 'unknown'
 *     rainfallFit,                   // same
 *     weatherState,                  // 'dry' | 'light_rain' | 'moderate_rain' | 'heavy_rain' | 'unknown'
 *     yieldEstimate,                 // { lowYield, highYield, confidence, ... } | null
 *     profitEstimate,                // { lowProfit, highProfit, currency, ... } | null
 *     confidence,                    // overall confidence (rollup)
 *     farmType,                      // 'backyard' | 'small_farm' | 'commercial'
 *     location:  { country, state },
 *   }
 *
 *   Insight = {
 *     id:                string,    // stable id for React keys + dedup
 *     type:              'action' | 'warning' | 'info',
 *     priority:          'high' | 'medium' | 'low',
 *     icon:              'warning' | 'action' | 'info' | 'water' | 'drain'
 *                       | 'stage' | 'money' | 'calendar',
 *     messageKey:        i18n key          // main line
 *     fallbackMessage:   string,           // English fallback
 *     reasonKey?:        i18n key          // optional secondary line
 *     reason?:           string,           // English fallback for reason
 *     recommendedActionKey?: i18n key      // CTA copy
 *     recommendedAction?:    string,
 *     linkedTaskTemplateId?: string,       // connects to task engine
 *   }
 *
 * Contract
 *   • Pure. Never throws. Returns at most 5 entries, sorted
 *     high→low priority then deterministic by id.
 *   • Always returns at least ONE insight when a crop + stage are
 *     known (stage-based fallback).
 *   • Missing data silently degrades — no "unknown" insights, no
 *     empty-dashboard, no fake certainty.
 */

import { normalizeCropId } from '../../config/crops/index.js';
import { normalizeStageKey } from '../../config/cropLifecycles.js';

const f = Object.freeze;

const MAX_INSIGHTS = 5;

// Priority ranks for sorting.
const PRI = f({ high: 3, medium: 2, low: 1 });

// Stage-based guidance. Each entry maps a canonical stage to a
// lightweight action insight. Wording tone toggles on farm type via
// the `simple` vs `commercial` copy pair.
const STAGE_INSIGHTS = f({
  planting: f({
    id: 'insight.stage.planting',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.planting.msg',
    fallbackMessage: 'Planting stage — prepare soil and plant cleanly.',
    recommendedActionKey: 'insight.stage.planting.action',
    recommendedAction: 'Check seed depth and spacing.',
  }),
  seedling: f({
    id: 'insight.stage.seedling',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.seedling.msg',
    fallbackMessage: 'Seedling stage — keep beds moist and weed-free.',
    recommendedActionKey: 'insight.stage.seedling.action',
    recommendedAction: 'Thin weak seedlings so strong ones thrive.',
  }),
  germination: f({
    id: 'insight.stage.germination',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.germination.msg',
    fallbackMessage: 'Germination stage — guard young plants from birds and pests.',
    recommendedActionKey: 'insight.stage.germination.action',
    recommendedAction: 'Walk the field early; cover emerged rows.',
  }),
  establishment: f({
    id: 'insight.stage.establishment',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.establishment.msg',
    fallbackMessage: 'Establishment stage — keep weeds down and gaps filled.',
    recommendedActionKey: 'insight.stage.establishment.action',
    recommendedAction: 'Replant gaps and shallow-hoe between rows.',
  }),
  vegetative: f({
    id: 'insight.stage.vegetative',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.vegetative.msg',
    fallbackMessage: 'Vegetative stage — focus on healthy leaf growth.',
    recommendedActionKey: 'insight.stage.vegetative.action',
    recommendedAction: 'Check leaf colour and control weeds early.',
  }),
  tasseling: f({
    id: 'insight.stage.tasseling',
    type: 'action',
    priority: 'high',
    icon: 'stage',
    messageKey: 'insight.stage.tasseling.msg',
    fallbackMessage: 'Tasseling stage — keep moisture steady.',
    recommendedActionKey: 'insight.stage.tasseling.action',
    recommendedAction: 'Water stress now hits yield hardest.',
  }),
  flowering: f({
    id: 'insight.stage.flowering',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.flowering.msg',
    fallbackMessage: 'Flowering stage — water evenly; scout for pests.',
    recommendedActionKey: 'insight.stage.flowering.action',
    recommendedAction: 'Uneven water at flowering drops fruit set.',
  }),
  fruiting: f({
    id: 'insight.stage.fruiting',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.fruiting.msg',
    fallbackMessage: 'Fruiting stage — support plants; watch for disease.',
    recommendedActionKey: 'insight.stage.fruiting.action',
    recommendedAction: 'Tie stems and pick fruit regularly.',
  }),
  bulking: f({
    id: 'insight.stage.bulking',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.bulking.msg',
    fallbackMessage: 'Bulking stage — avoid waterlogging; top-dress if planned.',
    recommendedActionKey: 'insight.stage.bulking.action',
    recommendedAction: 'Clear drainage channels.',
  }),
  pod_fill: f({
    id: 'insight.stage.pod_fill',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.pod_fill.msg',
    fallbackMessage: 'Pod fill — scout for borers and leaf spot.',
    recommendedActionKey: 'insight.stage.pod_fill.action',
    recommendedAction: 'Check lower leaves weekly.',
  }),
  grain_fill: f({
    id: 'insight.stage.grain_fill',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.grain_fill.msg',
    fallbackMessage: 'Grain fill — monitor ears for damage.',
    recommendedActionKey: 'insight.stage.grain_fill.action',
    recommendedAction: 'Peel back a few husks to inspect.',
  }),
  maturation: f({
    id: 'insight.stage.maturation',
    type: 'action',
    priority: 'medium',
    icon: 'stage',
    messageKey: 'insight.stage.maturation.msg',
    fallbackMessage: 'Maturation stage — plan harvest logistics.',
    recommendedActionKey: 'insight.stage.maturation.action',
    recommendedAction: 'Line up bags, buyers, and transport.',
  }),
  harvest: f({
    id: 'insight.stage.harvest',
    type: 'action',
    priority: 'high',
    icon: 'calendar',
    messageKey: 'insight.stage.harvest.msg',
    fallbackMessage: 'Harvest window — cut on dry days; dry + store quickly.',
    recommendedActionKey: 'insight.stage.harvest.action',
    recommendedAction: 'Record harvest weight so estimates stay calibrated.',
  }),
});

const GENERIC_STAGE = f({
  id: 'insight.stage.generic',
  type: 'info',
  priority: 'low',
  icon: 'info',
  messageKey: 'insight.stage.generic.msg',
  fallbackMessage: 'Check your crop daily and keep notes.',
});

// Backyard ↔ commercial wording nudges. The engine picks the right
// copy key at output time so the UI stays language-neutral.
function pickFarmTypeMsg(base, farmType) {
  const t = String(farmType || '').toLowerCase();
  if (t === 'backyard'   && base.simpleMessageKey)     return base.simpleMessageKey;
  if (t === 'commercial' && base.commercialMessageKey) return base.commercialMessageKey;
  return base.messageKey;
}

// ─── Public API ────────────────────────────────────────────────
export function buildFarmInsights(rawCtx) {
  const ctx = (rawCtx && typeof rawCtx === 'object') ? rawCtx : {};
  const insights = [];

  // Normalise inputs.
  const cropId   = normalizeCropId(ctx.cropId);
  const stageKey = normalizeStageKey(ctx.stage);
  const farmType = String(ctx.farmType || 'small_farm').toLowerCase();

  // ─── 1. Weather-based alerts (highest practical urgency) ──
  pushWeatherInsights(insights, ctx, farmType);

  // ─── 2. Seasonal mismatch warning ──
  if (ctx.seasonFit === 'low') {
    insights.push(f({
      id: 'insight.season.mismatch',
      type: 'warning',
      priority: 'medium',
      icon: 'calendar',
      messageKey: 'insight.season.mismatch.msg',
      fallbackMessage: 'Current timing is less ideal for this crop.',
      reasonKey: 'insight.season.mismatch.reason',
      reason: 'Usually planted earlier or later in your area.',
      recommendedActionKey: 'insight.season.mismatch.action',
      recommendedAction: 'Plan for a better window next cycle.',
    }));
  }

  // ─── 3. Yield opportunity ──
  if (ctx.seasonFit === 'high' && ctx.rainfallFit === 'high') {
    insights.push(f({
      id: 'insight.yield.opportunity',
      type: 'info',
      priority: 'medium',
      icon: 'money',
      messageKey: 'insight.yield.opportunity.msg',
      fallbackMessage: 'Favorable conditions may improve yield.',
      reasonKey: 'insight.yield.opportunity.reason',
      reason: 'Both season and rainfall look supportive.',
    }));
  } else if (ctx.seasonFit === 'high' || ctx.rainfallFit === 'high') {
    insights.push(f({
      id: 'insight.yield.favorable',
      type: 'info',
      priority: 'low',
      icon: 'money',
      messageKey: 'insight.yield.favorable.msg',
      fallbackMessage: 'Conditions are favorable for planting.',
    }));
  }

  // ─── 4. Profit outlook ──
  pushProfitInsights(insights, ctx, farmType);

  // ─── 5. Low-confidence warning ──
  if (ctx.confidence === 'low') {
    insights.push(f({
      id: 'insight.confidence.low',
      type: 'info',
      priority: 'low',
      icon: 'info',
      messageKey: 'insight.confidence.low.msg',
      fallbackMessage: 'Limited data — estimates may vary.',
      reasonKey: 'insight.confidence.low.reason',
      reason: 'Fill in farm details to sharpen recommendations.',
    }));
  }

  // ─── 6. Stage-based action (fallback floor so we never go empty) ──
  const stageInsight = (stageKey && STAGE_INSIGHTS[stageKey])
                     || (cropId ? GENERIC_STAGE : null);
  if (stageInsight) {
    // Personalise wording slightly for backyard/commercial via
    // messageKey suffix — translations resolve both keys, falling
    // back to the base when a specific variant is missing.
    const base = stageInsight;
    insights.push(f({
      ...base,
      messageKey: pickFarmTypeMsg({
        messageKey: base.messageKey,
        simpleMessageKey: base.messageKey + '.simple',
        commercialMessageKey: base.messageKey + '.commercial',
      }, farmType),
    }));
  }

  // ─── 7. Final floor — truly nothing to say ──
  if (insights.length === 0) {
    insights.push(f({
      id: 'insight.generic.checkDaily',
      type: 'info',
      priority: 'low',
      icon: 'info',
      messageKey: 'insight.generic.checkDaily.msg',
      fallbackMessage: 'Check your crop daily and keep short notes.',
    }));
  }

  // Sort by priority → deterministic id; cap at MAX_INSIGHTS.
  const seen = new Set();
  const ordered = insights
    .filter((i) => {
      if (!i || !i.id) return false;
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    })
    .sort((a, b) => (PRI[b.priority] || 0) - (PRI[a.priority] || 0)
                 || a.id.localeCompare(b.id))
    .slice(0, MAX_INSIGHTS)
    .map(f);
  return f(ordered);
}

function pushWeatherInsights(insights, ctx, farmType) {
  const rainFit = ctx.rainfallFit;
  const state   = ctx.weatherState;

  if (rainFit === 'low' && state === 'dry') {
    insights.push(f({
      id: 'insight.water.stress',
      type: 'warning',
      priority: 'high',
      icon: 'water',
      messageKey: 'insight.water.stress.msg',
      fallbackMessage: 'Water stress risk — consider irrigation.',
      reasonKey: 'insight.water.stress.reason',
      reason: 'Current dry conditions may slow establishment.',
      recommendedActionKey: farmType === 'backyard'
                            ? 'insight.water.stress.action.simple'
                            : 'insight.water.stress.action',
      recommendedAction: farmType === 'backyard'
                         ? 'Water plants in the cool of morning.'
                         : 'Plan irrigation or water conservation today.',
      linkedTaskTemplateId: 'irrigate_crop',
    }));
  }

  if (rainFit === 'low' && state === 'heavy_rain') {
    insights.push(f({
      id: 'insight.flood.risk',
      type: 'warning',
      priority: 'high',
      icon: 'drain',
      messageKey: 'insight.flood.risk.msg',
      fallbackMessage: 'Flooding risk — ensure drainage.',
      reasonKey: 'insight.flood.risk.reason',
      reason: 'Heavy rain may cause root rot or wash-out.',
      recommendedActionKey: 'insight.flood.risk.action',
      recommendedAction: 'Clear drainage channels and watch for disease.',
      linkedTaskTemplateId: 'check_drainage',
    }));
  }

  // Weather advisory (not a warning) when rainfall is present but OK.
  if (rainFit === 'high') {
    insights.push(f({
      id: 'insight.rainfall.supports',
      type: 'info',
      priority: 'low',
      icon: 'info',
      messageKey: 'insight.rainfall.supports.msg',
      fallbackMessage: 'Current rainfall supports this crop.',
    }));
  }
}

function pushProfitInsights(insights, ctx, farmType) {
  const p = ctx.profitEstimate;
  if (!p || !Number.isFinite(p.highProfit)) return;

  if (p.highProfit > 0 && p.lowProfit >= 0) {
    insights.push(f({
      id: 'insight.profit.strong',
      type: 'info',
      priority: 'medium',
      icon: 'money',
      messageKey: farmType === 'commercial'
                  ? 'insight.profit.strong.msg.commercial'
                  : 'insight.profit.strong.msg',
      fallbackMessage: farmType === 'commercial'
                  ? 'Strong gross-margin range under current conditions.'
                  : 'High-value crop under good conditions.',
    }));
  } else if (p.highProfit <= 0) {
    insights.push(f({
      id: 'insight.profit.tight',
      type: 'warning',
      priority: 'medium',
      icon: 'money',
      messageKey: 'insight.profit.tight.msg',
      fallbackMessage: 'Market price may not cover costs at current scale.',
      reasonKey: 'insight.profit.tight.reason',
      reason: 'Consider a higher-value crop or larger plot.',
    }));
  }
}

export const _internal = f({ PRI, STAGE_INSIGHTS, MAX_INSIGHTS, GENERIC_STAGE });
