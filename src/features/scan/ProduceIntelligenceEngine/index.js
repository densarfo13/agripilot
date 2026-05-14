/**
 * ProduceIntelligenceEngine — invisible market intelligence for the
 * Scan flow. Quietly turns a produce scan into harvest readiness +
 * soft quality grade + market readiness + buyer-trust phrasing +
 * sell-flow suggestion.
 *
 *   import { computeProduceIntelligence } from
 *     '../features/scan/ProduceIntelligenceEngine';
 *
 *   const intel = computeProduceIntelligence({
 *     scan,         // ScanOrchestrator result OR raw analyzer output
 *     crop,         // 'tomato' | 'pepper' | 'banana' | 'mango' | ...
 *     scanHistory,  // optional [{ crop, qualityState, ripenessState, at }]
 *     weather,      // optional { condition, temp }
 *     farmType,     // optional
 *     storageHoursSinceHarvest, // optional
 *   });
 *
 * Envelope (frozen):
 *   {
 *     ripenessState,         // 'unripe' | 'nearly_ready' | 'ready' | 'overripe' | 'unknown'
 *     qualityState,          // 'excellent' | 'good' | 'fair' | 'needs_sorting'
 *     marketReadiness,       // 'not_ready' | 'nearly_ready' | 'market_ready' | 'sell_soon' | 'quality_declining'
 *     buyerTrustSignal,      // calm phrasing for the farmer
 *     handlingRecommendation,
 *     urgency,               // 'low' | 'medium' | 'high'
 *     confidenceTone,        // 'needs_closer_photo' | 'possible' | 'likely' | 'high_likelihood'
 *     copy,                  // one-sentence low-literacy summary
 *     sellFlow: {            // suggested sell prompt + autofill
 *       suggestListing, crop, estimatedReadiness, qualityState,
 *       suggestedWindowDays,
 *     },
 *     history: {             // longitudinal comparison vs prior scans
 *       trend, daysSinceLastScan, note,
 *     },
 *   }
 *
 * Why this exists
 *   ScanOrchestrator's FRUIT_RIPENESS + PRODUCE_QUALITY adapters
 *   already produce calm crop-care wording. This engine sits on
 *   top, mapping the same inputs to MARKET-side phrasing — the
 *   soft grade the farmer sees in their journal, the listing
 *   prompt that fires when a tomato moves to market_ready, and
 *   the buyer-trust line that surfaces on Home.
 *
 *   The engine never invents AI certainty. Confidence flows from
 *   the underlying scan; we map it to one of four soft tones.
 *   Buyer-side numeric scores (freshness %, quality %) are
 *   DELIBERATELY NOT exposed — only categorical phrases.
 *
 * Strict-rule audit
 *   • Pure function. Never throws. Frozen output.
 *   • No raw analyzer fields leak through.
 *   • No "guaranteed" / "certified" / "laboratory" / "export-grade"
 *     wording — soft hedges only (appears / likely / may / monitor
 *     / suggested).
 *   • SSR-safe (no DOM, no storage reads — caller passes history).
 */

import { FarmEvents, publish } from '../../../lib/farmEventBus.js';

// ─── Public constants ─────────────────────────────────────────

export const RIPENESS_STATES = Object.freeze({
  UNRIPE:        'unripe',
  NEARLY_READY:  'nearly_ready',
  READY:         'ready',
  OVERRIPE:      'overripe',
  UNKNOWN:       'unknown',
});

export const QUALITY_STATES = Object.freeze({
  EXCELLENT:      'excellent',
  GOOD:           'good',
  FAIR:           'fair',
  NEEDS_SORTING:  'needs_sorting',
});

export const MARKET_READINESS = Object.freeze({
  NOT_READY:          'not_ready',
  NEARLY_READY:       'nearly_ready',
  MARKET_READY:       'market_ready',
  SELL_SOON:          'sell_soon',
  QUALITY_DECLINING:  'quality_declining',
});

const CONFIDENCE_TONES = Object.freeze({
  NEEDS_CLOSER_PHOTO: 'needs_closer_photo',
  POSSIBLE:           'possible',
  LIKELY:             'likely',
  HIGH_LIKELIHOOD:    'high_likelihood',
});

// Soft grade rank for trend computation. Higher = better.
const _QUALITY_RANK = Object.freeze({
  needs_sorting: 1,
  fair:          2,
  good:          3,
  excellent:     4,
});

// ─── Helpers ──────────────────────────────────────────────────

function _safeLower(v) {
  return typeof v === 'string' ? v.toLowerCase() : '';
}

function _safeStr(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function _safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function _normConfidence(raw) {
  const c = _safeLower(raw);
  if (c === 'high_likelihood' || c === 'very_high') return CONFIDENCE_TONES.HIGH_LIKELIHOOD;
  if (c === 'likely'         || c === 'high')      return CONFIDENCE_TONES.LIKELY;
  if (c === 'possible'       || c === 'medium')    return CONFIDENCE_TONES.POSSIBLE;
  if (c === 'needs_closer_photo' || c === 'low')   return CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO;
  return CONFIDENCE_TONES.LIKELY;
}

// ─── Step 1: Ripeness classification ─────────────────────────

function _classifyRipeness(input) {
  const raw = _safeLower(input.ripenessState || input.ripenessStage || input.stage);
  if (!raw) return RIPENESS_STATES.UNKNOWN;
  // Check most-specific labels first. 'immature' contains 'mature'
  // and 'nearly ready' contains 'ready', so the bare ready/mature
  // check has to come last.
  if (raw.includes('overripe') || raw.includes('past')) return RIPENESS_STATES.OVERRIPE;
  if (raw.includes('immature') || raw.includes('unripe') || raw.includes('green')) {
    return RIPENESS_STATES.UNRIPE;
  }
  if (raw.includes('near') || raw.includes('approach')) {
    return RIPENESS_STATES.NEARLY_READY;
  }
  if (raw.includes('ready') || raw.includes('mature')) return RIPENESS_STATES.READY;
  return RIPENESS_STATES.UNKNOWN;
}

// ─── Step 2: Quality classification ──────────────────────────
//
// We accept either an explicit qualityFlag/category string OR a
// defects[] array. Severe defects override mild ones.

// Use stems so inflected forms ('bruising', 'rotten', 'cracked')
// match without needing per-form entries.
const _SEVERE_DEFECT_WORDS = ['rot', 'mold', 'mould', 'severe', 'spoil'];
const _MEDIUM_DEFECT_WORDS = ['crack', 'insect', 'bug ', 'bite', 'biting', 'puncture', 'wound'];
const _MILD_DEFECT_WORDS   = ['bruis', 'discolor', 'spot', 'blemish'];

// Heat / wet-weather / time-since-harvest pressure on freshness,
// applied as a soft downgrade — NEVER promotes quality, only
// drops it when the surrounding context indicates the produce is
// more likely to be stressed. Two pressure points drop two steps;
// one pressure point drops one step.
//
// Quality never drops below FAIR via context alone — severe
// defects are the only path to NEEDS_SORTING.
const _DOWNGRADE_LADDER = [
  QUALITY_STATES.EXCELLENT,
  QUALITY_STATES.GOOD,
  QUALITY_STATES.FAIR,
];

function _contextualDowngrade(quality, ctx) {
  if (quality === QUALITY_STATES.NEEDS_SORTING) return quality;
  if (quality === QUALITY_STATES.FAIR)          return quality; // floor

  const cond = _safeLower(ctx && ctx.weatherCondition);
  const temp = Number.isFinite(ctx && ctx.weatherTemp) ? ctx.weatherTemp : null;
  const hrs  = Number.isFinite(ctx && ctx.storageHoursSinceHarvest)
             ? ctx.storageHoursSinceHarvest : null;

  let pressure = 0;
  if (temp != null && temp >= 32)                       pressure += 1;
  if (cond.includes('rain') || cond.includes('humid'))  pressure += 1;
  if (hrs != null && hrs >= 48)                         pressure += 1;
  if (pressure === 0) return quality;

  const startIdx = _DOWNGRADE_LADDER.indexOf(quality);
  if (startIdx < 0) return quality;
  const targetIdx = Math.min(_DOWNGRADE_LADDER.length - 1, startIdx + pressure);
  return _DOWNGRADE_LADDER[targetIdx];
}

function _classifyQuality(input, ripeness, ctx) {
  const defects = _safeArray(input.defects).map(_safeLower).filter(Boolean);
  const flagStr = _safeLower(input.qualityFlag || input.qualityState || input.category || '');
  const allText = defects.concat(flagStr ? [flagStr] : []);

  const has = (words) => allText.some(
    (t) => words.some((w) => t.includes(w)),
  );

  let base;
  if (has(_SEVERE_DEFECT_WORDS))                 base = QUALITY_STATES.NEEDS_SORTING;
  else if (ripeness === RIPENESS_STATES.OVERRIPE) base = QUALITY_STATES.FAIR;
  else {
    const mediumHits = has(_MEDIUM_DEFECT_WORDS);
    const mildHits   = has(_MILD_DEFECT_WORDS);
    if (mediumHits)                                    base = QUALITY_STATES.FAIR;
    else if (mildHits)                                 base = QUALITY_STATES.GOOD;
    else if (allText.some((t) => t.includes('excellent'))) base = QUALITY_STATES.EXCELLENT;
    else if (allText.some((t) => t.includes('good')))      base = QUALITY_STATES.GOOD;
    else                                               base = QUALITY_STATES.EXCELLENT;
  }

  return _contextualDowngrade(base, ctx);
}

// ─── Step 3: Market readiness ────────────────────────────────

function _classifyMarketReadiness(ripeness, quality) {
  if (quality === QUALITY_STATES.NEEDS_SORTING) return MARKET_READINESS.QUALITY_DECLINING;
  if (ripeness === RIPENESS_STATES.OVERRIPE)    return MARKET_READINESS.QUALITY_DECLINING;
  if (ripeness === RIPENESS_STATES.READY) {
    if (quality === QUALITY_STATES.EXCELLENT || quality === QUALITY_STATES.GOOD) {
      return MARKET_READINESS.MARKET_READY;
    }
    return MARKET_READINESS.SELL_SOON;
  }
  if (ripeness === RIPENESS_STATES.NEARLY_READY) return MARKET_READINESS.NEARLY_READY;
  if (ripeness === RIPENESS_STATES.UNRIPE)       return MARKET_READINESS.NOT_READY;
  // Unknown ripeness — fall back to quality alone.
  if (quality === QUALITY_STATES.EXCELLENT || quality === QUALITY_STATES.GOOD) {
    return MARKET_READINESS.NEARLY_READY;
  }
  return MARKET_READINESS.NOT_READY;
}

// ─── Step 4: Buyer trust signal ──────────────────────────────

function _buyerTrustSignal(quality, ripeness, marketReadiness) {
  if (marketReadiness === MARKET_READINESS.QUALITY_DECLINING) {
    return 'Freshness may decline soon.';
  }
  if (quality === QUALITY_STATES.EXCELLENT && marketReadiness === MARKET_READINESS.MARKET_READY) {
    return 'Looks suitable for local buyers.';
  }
  if (quality === QUALITY_STATES.GOOD && marketReadiness === MARKET_READINESS.MARKET_READY) {
    return 'Looks suitable for local buyers.';
  }
  if (quality === QUALITY_STATES.FAIR) {
    return 'Minor surface damage detected.';
  }
  if (marketReadiness === MARKET_READINESS.NEARLY_READY) {
    return 'Continue monitoring before listing.';
  }
  if (marketReadiness === MARKET_READINESS.NOT_READY) {
    return 'Continue normal care until the harvest window.';
  }
  return 'Monitor quality before listing.';
}

// ─── Step 5: Handling recommendation ─────────────────────────

function _handlingRecommendation(quality, ripeness) {
  if (quality === QUALITY_STATES.NEEDS_SORTING) {
    return 'Remove damaged pieces before storage. Keep healthy lots cool and dry.';
  }
  if (ripeness === RIPENESS_STATES.OVERRIPE) {
    return 'Use or sell within 24 hours. Avoid stacking — bruising increases quickly.';
  }
  if (quality === QUALITY_STATES.FAIR) {
    return 'Sort affected pieces aside before market transport. Handle gently.';
  }
  return 'Handle gently. Store in a cool, dry place out of direct sun.';
}

// ─── Step 6: Urgency ─────────────────────────────────────────

function _urgency(quality, ripeness, marketReadiness) {
  if (quality === QUALITY_STATES.NEEDS_SORTING) return 'high';
  if (ripeness === RIPENESS_STATES.OVERRIPE)    return 'high';
  if (marketReadiness === MARKET_READINESS.MARKET_READY) return 'medium';
  if (marketReadiness === MARKET_READINESS.SELL_SOON)    return 'medium';
  return 'low';
}

// ─── Step 7: Low-literacy one-sentence copy ──────────────────

function _shortCopy(crop, ripeness, quality, marketReadiness) {
  const c = _safeStr(crop) || 'produce';
  if (marketReadiness === MARKET_READINESS.QUALITY_DECLINING) {
    return `Your ${c} freshness may decline soon — sell soon if possible.`;
  }
  if (marketReadiness === MARKET_READINESS.MARKET_READY) {
    return `Your ${c} appears market ready.`;
  }
  if (marketReadiness === MARKET_READINESS.SELL_SOON) {
    return `Your ${c} appears ready, but minor damage suggests selling soon.`;
  }
  if (marketReadiness === MARKET_READINESS.NEARLY_READY) {
    return `Your ${c} may need another 2-3 days before market.`;
  }
  if (quality === QUALITY_STATES.FAIR) {
    return `Visible surface damage may reduce market quality of your ${c}.`;
  }
  if (ripeness === RIPENESS_STATES.UNRIPE) {
    return `Your ${c} is still developing. Continue normal care.`;
  }
  return `Continue monitoring your ${c}.`;
}

// ─── Step 8: Sell-flow suggestion ────────────────────────────

function _sellFlow(crop, ripeness, quality, marketReadiness) {
  const suggest = marketReadiness === MARKET_READINESS.MARKET_READY
                 || marketReadiness === MARKET_READINESS.SELL_SOON;
  const window  = marketReadiness === MARKET_READINESS.MARKET_READY ? 3
                : marketReadiness === MARKET_READINESS.SELL_SOON     ? 2
                : 0;
  return Object.freeze({
    suggestListing:      suggest,
    crop:                _safeStr(crop) || null,
    estimatedReadiness:  ripeness,
    qualityState:        quality,
    suggestedWindowDays: window,
  });
}

// ─── Step 9: Longitudinal trend ──────────────────────────────

function _historyTrend(currentQuality, scanHistory, crop, now) {
  const history = _safeArray(scanHistory)
    .filter((h) => h && _safeStr(h.crop) === _safeStr(crop))
    .filter((h) => h.at && Number.isFinite(new Date(h.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (history.length === 0) {
    return Object.freeze({
      trend:             'first_scan',
      daysSinceLastScan: null,
      note:              'No previous scans for this crop yet.',
    });
  }

  const last     = history[0];
  const lastTime = new Date(last.at).getTime();
  const days     = Math.max(0, Math.floor((now - lastTime) / (1000 * 60 * 60 * 24)));

  const currRank = _QUALITY_RANK[currentQuality] || 0;
  const lastRank = _QUALITY_RANK[last.qualityState] || 0;

  let trend = 'stable';
  let note  = 'Quality appears stable since the last scan.';
  if (currRank > lastRank) {
    trend = 'improving';
    note  = 'Ripeness or quality has improved since the last scan.';
  } else if (currRank < lastRank) {
    trend = 'declining';
    note  = 'Surface stress appears worse than the previous scan.';
  }

  return Object.freeze({
    trend,
    daysSinceLastScan: days,
    note,
  });
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Compute the produce-intelligence envelope from a scan + optional
 * context. Pure, never throws, always returns a frozen envelope.
 */
export function computeProduceIntelligence(input) {
  try {
    const safe   = (input && typeof input === 'object') ? input : {};
    const scan   = (safe.scan && typeof safe.scan === 'object') ? safe.scan : safe;
    const crop   = _safeStr(safe.crop) || _safeStr(scan.subjectDetected) || _safeStr(scan.crop);
    const now    = Number.isFinite(safe.now) ? safe.now : Date.now();

    const weather  = (safe.weather && typeof safe.weather === 'object') ? safe.weather : {};
    const ctx = {
      weatherCondition:         weather.condition,
      weatherTemp:              weather.temp,
      storageHoursSinceHarvest: safe.storageHoursSinceHarvest,
    };

    const ripeness = _classifyRipeness(scan);
    const quality  = _classifyQuality(scan, ripeness, ctx);
    const market   = _classifyMarketReadiness(ripeness, quality);
    const buyer    = _buyerTrustSignal(quality, ripeness, market);
    const handle   = _handlingRecommendation(quality, ripeness);
    const urgency  = _urgency(quality, ripeness, market);
    const tone     = _normConfidence(scan.confidence || scan.confidenceTone);
    const copy     = _shortCopy(crop, ripeness, quality, market);
    const sellFlow = _sellFlow(crop, ripeness, quality, market);
    const history  = _historyTrend(quality, safe.scanHistory, crop, now);

    return Object.freeze({
      ripenessState:          ripeness,
      qualityState:           quality,
      marketReadiness:        market,
      buyerTrustSignal:       buyer,
      handlingRecommendation: handle,
      urgency,
      confidenceTone:         tone,
      copy,
      sellFlow,
      history,
    });
  } catch {
    return _emptyEnvelope();
  }
}

function _emptyEnvelope() {
  return Object.freeze({
    ripenessState:          RIPENESS_STATES.UNKNOWN,
    qualityState:           QUALITY_STATES.GOOD,
    marketReadiness:        MARKET_READINESS.NOT_READY,
    buyerTrustSignal:       'Monitor quality before listing.',
    handlingRecommendation: 'Handle gently. Store in a cool, dry place out of direct sun.',
    urgency:                'low',
    confidenceTone:         CONFIDENCE_TONES.NEEDS_CLOSER_PHOTO,
    copy:                   'Take a clearer photo so we can give a better estimate.',
    sellFlow: Object.freeze({
      suggestListing:      false,
      crop:                null,
      estimatedReadiness:  RIPENESS_STATES.UNKNOWN,
      qualityState:        QUALITY_STATES.GOOD,
      suggestedWindowDays: 0,
    }),
    history: Object.freeze({
      trend:             'first_scan',
      daysSinceLastScan: null,
      note:              'No previous scans for this crop yet.',
    }),
  });
}

/**
 * Side-effecting helper — publishes HARVEST_READY when the envelope
 * indicates a sell-worthy state. Caller invokes this AFTER showing
 * the result in the UI. Idempotent — caller dedupes via scanId.
 *
 * Kept separate from computeProduceIntelligence so the engine itself
 * stays pure + trivially testable.
 */
export function publishProduceMarketSignals(intel, meta) {
  try {
    if (!intel || typeof intel !== 'object') return;
    const m = (meta && typeof meta === 'object') ? meta : {};
    if (
      intel.marketReadiness === MARKET_READINESS.MARKET_READY ||
      intel.marketReadiness === MARKET_READINESS.SELL_SOON
    ) {
      publish(FarmEvents.HARVEST_READY, {
        crop:            intel.sellFlow && intel.sellFlow.crop || null,
        qualityState:    intel.qualityState,
        ripenessState:   intel.ripenessState,
        marketReadiness: intel.marketReadiness,
        scanId:          m.scanId || null,
      });
    }
    if (intel.marketReadiness === MARKET_READINESS.QUALITY_DECLINING) {
      publish(FarmEvents.IRRIGATION_RISK, {
        // Re-use the urgency-tagged channel for "act now" produce
        // signals. Continuity engine treats it as a high-priority
        // recent event for the home recommendation rung.
        reason:         'produce.quality_declining',
        qualityState:   intel.qualityState,
        ripenessState:  intel.ripenessState,
        scanId:         m.scanId || null,
      });
    }
  } catch { /* swallow */ }
}

const _module = {
  RIPENESS_STATES,
  QUALITY_STATES,
  MARKET_READINESS,
  computeProduceIntelligence,
  publishProduceMarketSignals,
};
export default _module;
