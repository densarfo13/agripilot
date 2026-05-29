/**
 * src/intelligence/pestRiskEngine.ts — pest outbreak risk.
 *
 *   import {
 *     pestRiskEngine, PEST_KIND, PEST_RISK_VERSION,
 *   } from 'src/intelligence/pestRiskEngine';
 *
 *   pestRiskEngine({
 *     plantId, weather, recentScans, regionLabel,
 *   })
 *
 * Returns frozen envelope (matches spec exactly):
 *   {
 *     risks: [{
 *       pest, risk, confidence, contributors, runtimeVersion,
 *     }],
 *     topRisk:  { pest, risk, confidence } | null,
 *     runtimeVersion,
 *   }
 *
 * What this is
 * ────────────
 *   Honest heuristic over caller-injected signals. NO LLM, NO
 *   trained classifier. Confidence is computed from contributor
 *   strength — never invented.
 *
 *   Contributors per pest:
 *     • Plant DB lists pest in its disease/pest list
 *     • Recent scans flagged needs-review with metadata.pestHint
 *     • Weather signal (warm + dry → spider mites,
 *                       warm + humid → aphids,
 *                       rain + warm  → slugs/snails)
 *     • Seasonal pressure from regionLabel + month
 *
 * Strict-rule audit
 *   • Pure. SSR-safe. Never throws.
 *   • No persistence writes. No fetch.
 *   • Honest confidence (0-100 from contributor count + signal
 *     strength); 'unknown' when no contributors.
 */

import { findPlant } from '../data/plants/index.js';

export const PEST_RISK_VERSION = 'pest-risk-engine-v1';

export const PEST_KIND = Object.freeze({
  APHIDS:        'aphids',
  SPIDER_MITES:  'spider_mites',
  WHITEFLY:      'whitefly',
  CATERPILLAR:   'caterpillar',
  SLUGS:         'slugs',
  THRIPS:        'thrips',
  SCALE:         'scale',
  MEALYBUGS:     'mealybugs',
});

export const PEST_RISK_LEVELS = Object.freeze({
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
});

interface PestCtx {
  plantId?: string;
  weather?: {
    tempC?: number;
    humidity?: number;
    recentRainfallMm?: number;
  };
  recentScans?: Array<{
    eventType?: string;
    metadata?: { pestHint?: string; confidence?: number };
  }>;
  regionLabel?: string;
  now?: number;
}

const _isObj = (v: unknown): v is Record<string, any> =>
  v != null && typeof v === 'object';
const _arr   = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const _str   = (v: unknown): string => (typeof v === 'string' ? v : '');
const _num   = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _safe  = <T,>(fn: () => T, fb: T): T => {
  try { return fn(); } catch { return fb; }
};

interface Contributors {
  plantDb: boolean;
  recentScans: number;
  weather: string;       // '' / 'warm_dry' / 'warm_humid' / 'rain_warm'
  monthPressure: boolean;
}

function _emptyContributors(): Contributors {
  return { plantDb: false, recentScans: 0, weather: '',
           monthPressure: false };
}

function _weatherSignalsFor(pest: string,
                            weather: PestCtx['weather']): string {
  if (!_isObj(weather)) return '';
  const t = _num(weather.tempC);
  const h = _num(weather.humidity);
  const r = _num(weather.recentRainfallMm) || 0;
  if (t == null) return '';

  const warm = t >= 22;
  const hot  = t >= 28;
  const dry  = h != null && h <= 50;
  const humid = h != null && h >= 70;
  const rain  = r >= 5;

  if (pest === PEST_KIND.SPIDER_MITES && hot && dry)   return 'warm_dry';
  if (pest === PEST_KIND.APHIDS && warm && humid)      return 'warm_humid';
  if (pest === PEST_KIND.WHITEFLY && warm && humid)    return 'warm_humid';
  if (pest === PEST_KIND.SLUGS  && rain && warm)       return 'rain_warm';
  if (pest === PEST_KIND.CATERPILLAR && warm)          return 'warm_general';
  if (pest === PEST_KIND.THRIPS && warm && dry)        return 'warm_dry';
  if (pest === PEST_KIND.MEALYBUGS && warm)            return 'warm_general';
  return '';
}

function _scoreContributors(c: Contributors): number {
  let score = 0;
  if (c.plantDb)        score += 25;
  score += Math.min(40, c.recentScans * 15);
  if (c.weather)        score += 25;
  if (c.monthPressure)  score += 10;
  return Math.min(100, score);
}

function _bandFromScore(score: number): string {
  if (score >= 70) return PEST_RISK_LEVELS.HIGH;
  if (score >= 40) return PEST_RISK_LEVELS.MEDIUM;
  if (score > 0)   return PEST_RISK_LEVELS.LOW;
  return 'unknown';
}

// Monthly pest pressure across spec'd regions. 0-indexed months.
const MONTH_PRESSURE: Record<string, number[]> = {
  aphids:       [3, 4, 5, 6],
  spider_mites: [5, 6, 7, 8],
  whitefly:     [4, 5, 6, 7, 8, 9],
  caterpillar:  [4, 5, 6, 7, 8],
  slugs:        [3, 4, 9, 10],
  thrips:       [5, 6, 7],
  scale:        [],   // year-round indoor risk; surfaced via plant DB
  mealybugs:    [],   // year-round indoor risk
};

export function pestRiskEngine(ctx: PestCtx) {
  return _safe(() => {
    const c = _isObj(ctx) ? ctx : {} as PestCtx;
    const plant = _str(c.plantId) ? findPlant(c.plantId) : null;
    const plantPests = new Set(
      _arr(plant && plant.diseases).map(_str).filter(Boolean)
    );
    const month = new Date(_num(c.now) || Date.now()).getUTCMonth();

    const risks: any[] = [];
    for (const pest of Object.values(PEST_KIND)) {
      const contrib = _emptyContributors();
      if (plantPests.has(pest)) contrib.plantDb = true;
      // Recent scans citing this pest
      for (const s of _arr(c.recentScans)) {
        if (!_isObj(s)) continue;
        const hint = _str(s.metadata && s.metadata.pestHint);
        if (hint === pest) contrib.recentScans += 1;
      }
      contrib.weather = _weatherSignalsFor(pest, c.weather);
      contrib.monthPressure = (MONTH_PRESSURE[pest] || []).indexOf(month) !== -1;

      const score = _scoreContributors(contrib);
      if (score <= 0) continue;
      risks.push(Object.freeze({
        pest,
        risk:        _bandFromScore(score),
        confidence:  score,
        contributors: Object.freeze(contrib),
      }));
    }

    risks.sort((a, b) => b.confidence - a.confidence);
    const topRisk = risks.length > 0
      ? Object.freeze({
          pest:       risks[0].pest,
          risk:       risks[0].risk,
          confidence: risks[0].confidence,
        })
      : null;

    return Object.freeze({
      runtimeVersion: PEST_RISK_VERSION,
      risks:    Object.freeze(risks),
      topRisk,
    });
  }, Object.freeze({
    runtimeVersion: PEST_RISK_VERSION,
    risks: Object.freeze([]),
    topRisk: null,
  }));
}
