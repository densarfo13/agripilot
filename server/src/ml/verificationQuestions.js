/**
 * verificationQuestions.js — generates 2–3 yes/no checks the
 * user can run on the affected plant before we commit to a
 * specific named condition (spec §2).
 *
 *   import { verificationQuestions, scoreVerification }
 *     from './verificationQuestions.js';
 *
 *   const qs = verificationQuestions({
 *     issue:  'Possible fungal stress',
 *     crop:   'tomato',
 *     region: 'GH',
 *     weather,
 *   });
 *   // → [{ id, prompt, expected: 'yes'|'no' }, ...]
 *
 *   const { matched, mismatched, downgrade } =
 *     scoreVerification(qs, userAnswers);
 *
 * Strict rules
 *   * Pure. No I/O. Never throws.
 *   * 2–3 questions per issue (§2). Order matters: most
 *     diagnostic question first.
 *   * Each question has an `expected` answer ('yes'|'no').
 *     If the user's answer disagrees with `expected`, that
 *     question counts as a mismatch.
 *   * `downgrade` recommends a 1-step tier downgrade when ANY
 *     question is mismatched (spec §2 explicit rule).
 *   * Falls back to a generic "is this issue spreading?"
 *     check when no rules match the issue/crop combo.
 */

const NEEDS_CLOSER_INSPECTION = 'Needs closer inspection';

// Question bank keyed on the safe taxonomy from
// contextFusionEngine.js. Each entry returns 2–3 questions.
//
// Note: questions describe SYMPTOMS the user can verify with
// a flashlight + 30 seconds, NOT chemistry. The whole point
// is to confirm or refute the predicted issue safely.
const BANK = Object.freeze({
  'Possible fungal stress': [
    { id: 'fungal_powder', prompt: 'Is there a powdery or fuzzy white/grey coating on the leaves?', expected: 'yes' },
    { id: 'fungal_pattern', prompt: 'Are the spots circular with a darker outer ring?',                 expected: 'yes' },
    { id: 'fungal_humid',  prompt: 'Has the plant been wet (rain or watering on leaves) recently?',     expected: 'yes' },
  ],
  'Possible water stress': [
    { id: 'water_dry_top',     prompt: 'Is the top 2 cm of soil bone-dry to the touch?', expected: 'yes' },
    { id: 'water_recovers',    prompt: 'Do the leaves recover overnight or after watering?', expected: 'yes' },
    { id: 'water_drainage',    prompt: 'Is the pot or row standing in water?',               expected: 'no'  },
  ],
  'Possible heat stress': [
    { id: 'heat_afternoon',  prompt: 'Is the wilting worst in the hottest part of the day?', expected: 'yes' },
    { id: 'heat_recovers',   prompt: 'Does the plant look better in the morning?',           expected: 'yes' },
    { id: 'heat_dry_soil',   prompt: 'Is the soil also bone-dry?',                            expected: 'no'  },
  ],
  'Possible pest damage': [
    { id: 'pest_under_leaf', prompt: 'Are there insects (or webs / sticky residue) on the underside of the leaves?', expected: 'yes' },
    { id: 'pest_chew',       prompt: 'Are the leaf edges chewed or are there irregular holes?',                      expected: 'yes' },
    { id: 'pest_new',        prompt: 'Is the damage new (last 1–3 days)?',                                            expected: 'yes' },
  ],
  'Possible nutrient deficiency': [
    { id: 'nut_pattern',     prompt: 'Is the yellowing concentrated on older (lower) leaves?',          expected: 'yes' },
    { id: 'nut_spread',      prompt: 'Is the yellowing spread evenly across the leaf, with green veins?', expected: 'yes' },
    { id: 'nut_recent_fert', prompt: 'Have you fertilised in the last 2 weeks?',                          expected: 'no'  },
  ],
  'Possible transplant shock': [
    { id: 'shock_recent',  prompt: 'Was the plant moved or transplanted in the last 7 days?', expected: 'yes' },
    { id: 'shock_partial', prompt: 'Are some leaves still firm and green?',                   expected: 'yes' },
  ],
  'Looks healthy': [
    { id: 'healthy_color',   prompt: 'Are the leaves a steady green colour with no spots?',  expected: 'yes' },
    { id: 'healthy_growth',  prompt: 'Has the plant added new growth in the last week?',     expected: 'yes' },
  ],
  // Fallback bucket — used for NEEDS_CLOSER_INSPECTION + UNKNOWN.
  _generic: [
    { id: 'gen_spread',     prompt: 'Has the issue spread to nearby plants or rows?',        expected: 'no' },
    { id: 'gen_worse',      prompt: 'Has the issue gotten worse over the last 2 days?',       expected: 'no' },
  ],
});

/**
 * verificationQuestions({ issue, crop, region, weather })
 *   → [{ id, prompt, expected }, ...]
 *
 * Returns 2–3 questions. The crop / region / weather
 * arguments are reserved for future per-crop refinements
 * (e.g. region-specific pest names) — accepted today so the
 * shape is forward-compatible.
 */
export function verificationQuestions({ issue, crop: _crop, region: _region, weather: _weather } = {}) {
  const key = String(issue || '').trim();
  const list = BANK[key] || BANK[NEEDS_CLOSER_INSPECTION] || BANK._generic;
  // Cap at 3 — the UI surface is a small inline checklist;
  // more than 3 fatigues the user (spec §2 explicit "2–3").
  return list.slice(0, 3).map((q) => ({ ...q }));
}

/**
 * scoreVerification(questions, userAnswers) → summary
 *
 * @param {Array} questions  output of verificationQuestions()
 * @param {object} userAnswers  { [questionId]: 'yes' | 'no' | undefined }
 * @returns {{
 *   asked:      number,
 *   answered:   number,
 *   matched:    number,
 *   mismatched: number,
 *   downgrade:  boolean,    — recommend tier downgrade per §2
 *   confirmed:  boolean,    — every answered question matched
 * }}
 */
export function scoreVerification(questions, userAnswers = {}) {
  const out = {
    asked:      Array.isArray(questions) ? questions.length : 0,
    answered:   0,
    matched:    0,
    mismatched: 0,
    downgrade:  false,
    confirmed:  false,
  };
  if (!Array.isArray(questions) || questions.length === 0) return out;
  for (const q of questions) {
    if (!q || !q.id) continue;
    const a = String(userAnswers?.[q.id] || '').toLowerCase();
    if (a !== 'yes' && a !== 'no') continue;
    out.answered += 1;
    if (a === String(q.expected).toLowerCase()) out.matched += 1;
    else                                         out.mismatched += 1;
  }
  // Spec §2: any mismatch downgrades the tier by one level.
  out.downgrade = out.mismatched > 0;
  // Confirmed only when the user answered every question AND
  // every answer matched the expected value.
  out.confirmed = out.asked > 0 && out.answered === out.asked && out.mismatched === 0;
  return out;
}

export const _internal = Object.freeze({ BANK });
export default verificationQuestions;
