/**
 * diagnosisExplanation.js — composes the "Why" sentence for a
 * scan result (Phase 1, multi-signal diagnosis).
 *
 *   import { composeDiagnosisExplanation }
 *     from 'src/core/scan/diagnosisExplanation.js';
 *
 *   const why = composeDiagnosisExplanation({
 *     classifierResult, snapshot, crop: 'tomato',
 *   });
 *   // why.text     → { key, fallback, params }   localizable
 *   // why.signals  → ['circular brown lesions', 'humid weather', …]
 *   // why.method   → 'multi_signal'
 *
 * What it is — and is NOT
 * ───────────────────────
 *   A pure composer over `fastIssueClassifier`'s evidence + the
 *   intelligence snapshot. It does NOT run inference; it stitches
 *   together the signals the classifier already found and the
 *   weather/stage context the snapshot already carries.
 *
 *   The spec's §1.5 rule: diagnosis must be MULTI-SIGNAL — image
 *   evidence + crop type + growth stage + weather + region. This
 *   module produces the human-readable "why" the result card
 *   shows under the verdict.
 *
 * Strict-rule audit
 *   • Pure. Never throws. SSR-safe.
 *   • Hedged wording — "may indicate", "consistent with" — never
 *     "confirmed".
 */

const _str = (v) => String(v == null ? '' : v).toLowerCase();
const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// Map evidence keys (from fastIssueClassifier.evidence[]) to
// short, human-readable signal phrases. Each is an envelope
// with a localizable key + English fallback.
const EVIDENCE_PHRASE = Object.freeze({
  spots:           { key: 'scan.why.evidence.spots',         fallback: 'circular brown lesions' },
  yellowing:       { key: 'scan.why.evidence.yellowing',     fallback: 'yellowing leaves' },
  wilting:         { key: 'scan.why.evidence.wilting',       fallback: 'wilting' },
  holes:           { key: 'scan.why.evidence.holes',         fallback: 'leaf holes' },
  insect_visible:  { key: 'scan.why.evidence.insect',        fallback: 'visible insects' },
  mold:            { key: 'scan.why.evidence.mold',          fallback: 'mold-like coating' },
  fruit_rot:       { key: 'scan.why.evidence.fruit_rot',     fallback: 'fruit rot signs' },
  dry_soil:        { key: 'scan.why.evidence.dry_soil',      fallback: 'dry soil' },
  wet_soil:        { key: 'scan.why.evidence.wet_soil',      fallback: 'wet soil' },
  heat_stress:     { key: 'scan.why.evidence.heat',          fallback: 'heat-stress patterns' },
});

const CONTEXT_PHRASE = Object.freeze({
  humid:           { key: 'scan.why.context.humid',    fallback: 'humid weather' },
  hot:             { key: 'scan.why.context.hot',      fallback: 'hot conditions' },
  cool_wet:        { key: 'scan.why.context.cool_wet', fallback: 'cool, damp conditions' },
  long_dry_spell:  { key: 'scan.why.context.dry',      fallback: 'a long dry spell' },
  recent_rain:     { key: 'scan.why.context.rain',     fallback: 'recent rain' },
});

const STAGE_PHRASE = Object.freeze({
  flowering:        { key: 'scan.why.stage.flowering',     fallback: 'flowering-stage {crop}' },
  fruiting:         { key: 'scan.why.stage.fruiting',      fallback: 'fruiting-stage {crop}' },
  harvest_ready:    { key: 'scan.why.stage.harvest_ready', fallback: '{crop} near harvest' },
  seedling:         { key: 'scan.why.stage.seedling',      fallback: '{crop} seedlings' },
  germination:      { key: 'scan.why.stage.germination',   fallback: 'germinating {crop}' },
  vegetative_growth:{ key: 'scan.why.stage.vegetative',    fallback: 'growing {crop}' },
});

const VERDICT_OPENER = Object.freeze({
  fungal_risk:      'Consistent with possible fungal stress',
  leaf_spot:        'Consistent with possible leaf spot',
  pest_damage:      'Consistent with possible pest damage',
  fruit_rot:        'Consistent with possible fruit rot',
  water_stress:     'Consistent with possible water stress',
  overwatering:     'Consistent with possible overwatering',
  sunburn:          'Consistent with possible heat / sun stress',
  yellowing:        'Consistent with possible nutrient or watering stress',
  wilting:          'Consistent with possible water stress',
  nutrient_stress:  'Consistent with possible nutrient stress',
  unknown_needs_clearer_photo: 'Not enough detail in the photo to be sure',
});

function _resolve(template, params) {
  if (!template) return '';
  const p = params || {};
  let out = template.fallback || '';
  out = out.replace(/\{(\w+)\}/g, (_m, name) => {
    const v = p[name];
    return v == null ? '' : String(v);
  });
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Compose the "why" sentence for a scan result.
 *
 * @param {object} args
 * @param {object} [args.classifierResult]  from fastIssueClassifier.classifyScan()
 * @param {object} [args.snapshot]          from getIntelligenceSnapshot()
 * @param {string} [args.crop]
 * @returns {{ text: object, signals: string[], method: string }}
 */
export function composeDiagnosisExplanation(args) {
  try {
    const a = (args && typeof args === 'object') ? args : {};
    const result = (a.classifierResult && typeof a.classifierResult === 'object') ? a.classifierResult : {};
    const snap = (a.snapshot && typeof a.snapshot === 'object') ? a.snapshot : {};
    const crop = a.crop || snap.crop || 'the plant';

    const cat = _str(result.issueCategory);
    const opener = VERDICT_OPENER[cat] || 'Worth a closer look';

    const signals = [];

    // 1. Image evidence — pull from the classifier's evidence[].
    const evidence = Array.isArray(result.evidence) ? result.evidence : [];
    for (const e of evidence) {
      const phrase = EVIDENCE_PHRASE[_str(e)];
      if (phrase) signals.push(_resolve(phrase));
    }

    // 2. Weather context — pulled from snapshot.weather.
    const w = (snap.weather && typeof snap.weather === 'object') ? snap.weather : {};
    const humidity = _num(w.humidityPct);
    const temp = _num(w.temperatureC);
    const daysSince = _num(w.daysSinceRain);
    const rainProb = _num(w.rainProbability24hPct);
    const rainToday = _num(w.rainfallTodayMm);

    if (humidity != null && humidity >= 80) signals.push(_resolve(CONTEXT_PHRASE.humid));
    else if (temp != null && temp >= 32)    signals.push(_resolve(CONTEXT_PHRASE.hot));
    else if (humidity != null && humidity >= 75 && temp != null && temp <= 22) {
      signals.push(_resolve(CONTEXT_PHRASE.cool_wet));
    }
    if (daysSince != null && daysSince >= 7) signals.push(_resolve(CONTEXT_PHRASE.long_dry_spell));
    if ((rainProb != null && rainProb >= 70) || (rainToday != null && rainToday >= 5)) {
      signals.push(_resolve(CONTEXT_PHRASE.recent_rain));
    }

    // 3. Stage context — pulled from snapshot.cropStage.
    const stage = _str(snap.cropStage || snap.currentStage);
    const stagePhrase = STAGE_PHRASE[stage];
    if (stagePhrase) signals.push(_resolve(stagePhrase, { crop }));

    // Trim to top 4 signals so the line stays readable.
    const top = signals.slice(0, 4);

    // Build the localizable text envelope.
    const joined = top.join(' + ');
    const fallback = top.length > 0
      ? `${opener}: ${joined}.`
      : `${opener}.`;
    const text = {
      key:      `scan.why.${cat || 'generic'}`,
      fallback,
      params:   { crop },
    };

    return Object.freeze({
      text,
      signals: top,
      method: top.length >= 2 ? 'multi_signal' : 'single_signal',
    });
  } catch {
    return Object.freeze({
      text:    { key: 'scan.why.generic', fallback: 'Worth a closer look.', params: {} },
      signals: [],
      method:  'fallback',
    });
  }
}

const _module = { composeDiagnosisExplanation };
export default _module;
