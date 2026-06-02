/**
 * scanValidationMetrics.js — pure rollup over scan_validations.
 *
 * Pilot Validation framework.
 *
 *   import {
 *     computeMetrics, computeTopFailures,
 *     computeCalibration, snapshotMetrics,
 *   } from './scanValidationMetrics.js';
 *
 * All functions are async + never throw + return frozen envelopes.
 * Caller (admin routes + report generator) renders the output
 * unchanged.
 *
 * Honesty contract:
 *   - When no validation rows are labelled yet, accuracy percents
 *     return null (not 0) so the dashboard shows "Not enough data
 *     yet" instead of a fake green 0%.
 *   - confidenceInflation is the SIGNED average of (predicted
 *     confidence − actual correctness). Positive = model overclaims.
 */

const _str = (v) => (typeof v === 'string' ? v : '');
const _num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

function _normalize(s) {
  return _str(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

function _matches(predicted, actual) {
  // Lenient case-insensitive contains-match. Either direction
  // counts (the model returns "Solanum lycopersicum"; the operator
  // labels "tomato" — that's still a match).
  const p = _normalize(predicted);
  const a = _normalize(actual);
  if (!p || !a) return null;       // can't decide
  if (p === a) return true;
  if (p.includes(a) || a.includes(p)) return true;
  // Token overlap fallback (>=2 shared words ≥4 chars).
  const pTokens = p.split(' ').filter((t) => t.length >= 4);
  const aTokens = a.split(' ').filter((t) => t.length >= 4);
  const shared  = pTokens.filter((t) => aTokens.includes(t));
  return shared.length >= 2;
}

function _pct(n, d) {
  if (d === 0) return null;
  return Math.round((n / d) * 1000) / 10;   // 0..100 with 1 decimal
}

/**
 * Aggregate metrics over a sliding window.
 *
 * @param {object} prisma
 * @param {object} opts
 * @param {number} [opts.days=7]
 * @returns {Promise<object>}
 */
export async function computeMetrics(prisma, opts = {}) {
  try {
    if (!prisma || !prisma.scanValidation) {
      return _emptyMetrics('prisma_missing');
    }
    const days = Math.max(1, Math.min(_num(opts.days) || 7, 365));
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await prisma.scanValidation.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        predictedPlant: true, predictedDisease: true, predictedPest: true,
        actualPlant: true, actualDisease: true, actualPest: true,
        confidencePct: true, result: true,
      },
    });

    const total = rows.length;
    let labeled = 0;
    let plantCorrect = 0, plantLabeled = 0;
    let diseaseCorrect = 0, diseaseLabeled = 0;
    let pestCorrect = 0, pestLabeled = 0;
    let unknownCount = 0;
    let falsePositives = 0;
    let confidenceSum = 0, confidenceN = 0;
    const inflationDeltas = [];

    for (const r of rows) {
      const conf = _num(r.confidencePct);
      if (conf != null) {
        confidenceSum += conf;
        confidenceN++;
      }
      const hasAnyActual = !!(r.actualPlant || r.actualDisease || r.actualPest);
      if (!hasAnyActual) {
        unknownCount++;
        continue;
      }
      labeled++;
      // Plant
      if (r.actualPlant) {
        plantLabeled++;
        const m = _matches(r.predictedPlant, r.actualPlant);
        if (m === true) plantCorrect++;
        if (m === false && conf != null) {
          // Model predicted SOMETHING + the actual was set + they
          // disagree → false positive.
          if (r.predictedPlant) falsePositives++;
        }
        if (conf != null && m !== null) {
          // Inflation = predicted confidence (0..100) − truth (0 or 100).
          inflationDeltas.push(conf - (m ? 100 : 0));
        }
      }
      if (r.actualDisease) {
        diseaseLabeled++;
        if (_matches(r.predictedDisease, r.actualDisease) === true) diseaseCorrect++;
      }
      if (r.actualPest) {
        pestLabeled++;
        if (_matches(r.predictedPest, r.actualPest) === true) pestCorrect++;
      }
    }

    const avgConfidence = confidenceN > 0
      ? Math.round((confidenceSum / confidenceN) * 10) / 10
      : null;
    const confidenceInflation = inflationDeltas.length > 0
      ? Math.round(
          (inflationDeltas.reduce((a, b) => a + b, 0) / inflationDeltas.length) * 10
        ) / 10
      : null;

    return Object.freeze({
      ok: true,
      windowDays: days,
      totalValidations: total,
      labeledCount: labeled,
      plantAccuracyPct:   _pct(plantCorrect,   plantLabeled),
      diseaseAccuracyPct: _pct(diseaseCorrect, diseaseLabeled),
      pestAccuracyPct:    _pct(pestCorrect,    pestLabeled),
      unknownRatePct:     _pct(unknownCount,   total),
      falsePositivePct:   _pct(falsePositives, plantLabeled),
      averageConfidencePct: avgConfidence,
      confidenceInflationPct: confidenceInflation,
      // Spec target attainment booleans — null when insufficient data.
      meetsPlantTarget:   _pct(plantCorrect, plantLabeled) != null
                            ? _pct(plantCorrect, plantLabeled) > 85 : null,
      meetsDiseaseTarget: _pct(diseaseCorrect, diseaseLabeled) != null
                            ? _pct(diseaseCorrect, diseaseLabeled) > 75 : null,
      meetsUnknownTarget: _pct(unknownCount, total) != null
                            ? _pct(unknownCount, total) < 10 : null,
      meetsConfidenceTarget: avgConfidence != null ? avgConfidence > 70 : null,
      generatedAt: new Date().toISOString(),
      limitations: 'Decision support, not a guarantee.',
    });
  } catch (err) {
    return _emptyMetrics('exception', err && err.message);
  }
}

function _emptyMetrics(reason, message) {
  return Object.freeze({
    ok: false, reason, message,
    windowDays: 0, totalValidations: 0, labeledCount: 0,
    plantAccuracyPct: null, diseaseAccuracyPct: null,
    pestAccuracyPct: null, unknownRatePct: null,
    falsePositivePct: null, averageConfidencePct: null,
    confidenceInflationPct: null,
    meetsPlantTarget: null, meetsDiseaseTarget: null,
    meetsUnknownTarget: null, meetsConfidenceTarget: null,
    generatedAt: new Date().toISOString(),
    limitations: 'Decision support, not a guarantee.',
  });
}

/**
 * Top failures aggregator. Returns the misidentified predictions
 * (predicted vs actual) ranked by miss count.
 */
export async function computeTopFailures(prisma, opts = {}) {
  try {
    if (!prisma || !prisma.scanValidation) {
      return Object.freeze({ ok: false, reason: 'prisma_missing',
        plants: Object.freeze([]), diseases: Object.freeze([]),
        pests: Object.freeze([]) });
    }
    const days = Math.max(1, Math.min(_num(opts.days) || 30, 365));
    const limit = Math.max(1, Math.min(_num(opts.limit) || 10, 50));
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await prisma.scanValidation.findMany({
      where: {
        createdAt: { gte: since },
        result: 'incorrect',
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        predictedPlant: true, actualPlant: true,
        predictedDisease: true, actualDisease: true,
        predictedPest: true, actualPest: true,
      },
    });

    const tally = (predKey, actKey) => {
      const map = new Map();
      for (const r of rows) {
        const p = _normalize(r[predKey]);
        const a = _normalize(r[actKey]);
        if (!p && !a) continue;
        if (_matches(r[predKey], r[actKey]) === true) continue;
        const key = (p || '∅') + '||' + (a || '∅');
        const entry = map.get(key) || { predicted: p, actual: a, count: 0 };
        entry.count += 1;
        map.set(key, entry);
      }
      return Array.from(map.values())
        .sort((x, y) => y.count - x.count)
        .slice(0, limit)
        .map((e) => Object.freeze(e));
    };

    return Object.freeze({
      ok: true,
      windowDays: days,
      plants:   Object.freeze(tally('predictedPlant',   'actualPlant')),
      diseases: Object.freeze(tally('predictedDisease', 'actualDisease')),
      pests:    Object.freeze(tally('predictedPest',    'actualPest')),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Object.freeze({ ok: false, reason: 'exception',
      message: err && err.message,
      plants: Object.freeze([]), diseases: Object.freeze([]),
      pests: Object.freeze([]) });
  }
}

/**
 * Confidence calibration buckets. Splits validation rows into 5
 * confidence bands and reports the actual accuracy in each band.
 * Caller renders as a 5-bar chart. A well-calibrated model has
 * bar height ≈ bucket midpoint; a model with confidence inflation
 * has the high bucket sitting BELOW the midpoint.
 */
export async function computeCalibration(prisma, opts = {}) {
  try {
    if (!prisma || !prisma.scanValidation) {
      return Object.freeze({ ok: false, reason: 'prisma_missing',
        buckets: Object.freeze([]) });
    }
    const days = Math.max(1, Math.min(_num(opts.days) || 30, 365));
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    const rows = await prisma.scanValidation.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
      select: {
        confidencePct: true,
        predictedPlant: true, actualPlant: true,
      },
    });

    const BANDS = [
      { label: '0-39',   min: 0,  max: 39  },
      { label: '40-59',  min: 40, max: 59  },
      { label: '60-74',  min: 60, max: 74  },
      { label: '75-89',  min: 75, max: 89  },
      { label: '90-100', min: 90, max: 100 },
    ];

    const buckets = BANDS.map((b) => {
      let total = 0, correct = 0;
      for (const r of rows) {
        const c = _num(r.confidencePct);
        if (c == null) continue;
        if (c < b.min || c > b.max) continue;
        const m = _matches(r.predictedPlant, r.actualPlant);
        if (m === null) continue;
        total++;
        if (m === true) correct++;
      }
      const accuracyPct = _pct(correct, total);
      const expectedMidpoint = (b.min + b.max) / 2;
      const inflation = (accuracyPct != null)
        ? Math.round((expectedMidpoint - accuracyPct) * 10) / 10
        : null;
      return Object.freeze({
        band: b.label, min: b.min, max: b.max,
        n: total, accuracyPct, inflation,
      });
    });

    return Object.freeze({
      ok: true,
      windowDays: days,
      buckets: Object.freeze(buckets),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return Object.freeze({ ok: false, reason: 'exception',
      message: err && err.message, buckets: Object.freeze([]) });
  }
}

/**
 * Upsert today's snapshot row into scan_accuracies. Idempotent —
 * caller fires once per day (or on demand from the report
 * generator). Returns the persisted row.
 */
export async function snapshotMetrics(prisma) {
  try {
    if (!prisma || !prisma.scanAccuracy) {
      return { ok: false, reason: 'prisma_missing' };
    }
    const m = await computeMetrics(prisma, { days: 1 });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const data = {
      snapshotDate:           today,
      totalValidations:       m.totalValidations || 0,
      labeledCount:           m.labeledCount || 0,
      plantCorrectCount:      Math.round((m.plantAccuracyPct || 0) * (m.labeledCount || 0) / 100),
      diseaseCorrectCount:    Math.round((m.diseaseAccuracyPct || 0) * (m.labeledCount || 0) / 100),
      pestCorrectCount:       Math.round((m.pestAccuracyPct || 0) * (m.labeledCount || 0) / 100),
      unknownCount:           Math.round(((m.unknownRatePct || 0) / 100) * (m.totalValidations || 0)),
      falsePositiveCount:     Math.round(((m.falsePositivePct || 0) / 100) * (m.labeledCount || 0)),
      averageConfidencePct:   m.averageConfidencePct,
      confidenceInflationPct: m.confidenceInflationPct,
    };
    const row = await prisma.scanAccuracy.upsert({
      where: { snapshotDate: today },
      update: { ...data, computedAt: new Date() },
      create: data,
    });
    return { ok: true, id: row.id };
  } catch (err) {
    try {
      // eslint-disable-next-line no-console
      console.warn('[scan-validation] snapshot failed:', err && err.message);
    } catch { /* swallow */ }
    return { ok: false, reason: 'prisma_error', message: err && err.message };
  }
}

export const _internal = Object.freeze({
  _matches, _normalize, _pct,
});

export default computeMetrics;
