/**
 * check-i18n-distinctness.mjs — sprint #223 (pilot hardening).
 *
 * The existing check:translations gate verifies a key is NON-BLANK in each
 * required locale — but a value byte-identical to English passes it while
 * being functionally untranslated (English shown to a Twi/Hausa farmer).
 * This gate closes that blind spot with a RATCHET: it counts English-
 * identical values per locale and FAILS if the count rises above the
 * recorded baseline. Existing debt is grandfathered; NEW leakage is blocked.
 *
 * Lower the baselines as translators close the gap. Never raise them.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rd = (l) => fs.readFileSync(path.join(ROOT, 'src/i18n/columns/T-' + l + '.js'), 'utf8');
const parse = (s) => {
  const o = {};
  const re = /"([a-zA-Z0-9_.]+)":\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(s))) o[m[1]] = m[2];
  return o;
};
// A value that is the SAME in every language is not a leak: pure
// numbers/symbols/units, single tokens like "pH", "OK", brand names.
const _universal = (v) => /^[\s\d\W]*$/.test(v) || /^(pH|OK|NDVI|GPS|SMS|Farroway|km|kg|ha|°c|°f)$/i.test(v.trim());

// Baselines = the count measured the day this gate was added. Ceilings only.
// fr=317: "fruit" is the same word in English and French (a true cognate,
// not a leak) — added by the SCAN TYPE ROUTER scanType.fruit key.
// fr=318: decision.minutes "min" is the same unit abbreviation in en + fr
// (shared token, not an English leak) — added by the Decision Engine.
const BASELINE = { tw: 175, ha: 157, fr: 318, sw: 212 };

const en = parse(rd('en'));
const errors = [];
const report = [];
for (const lang of Object.keys(BASELINE)) {
  const col = parse(rd(lang));
  let n = 0;
  for (const k of Object.keys(en)) {
    const e = en[k];
    if (!e || _universal(e)) continue;
    if (col[k] === e) n++;
  }
  report.push(`${lang}=${n}/≤${BASELINE[lang]}`);
  if (n > BASELINE[lang]) {
    errors.push(`${lang}: ${n} English-identical values exceeds baseline ${BASELINE[lang]} — new untranslated keys leaked English. Translate them or they show English to a ${lang} farmer.`);
  }
}

if (errors.length) {
  console.error('[check:i18n-distinctness] FAIL — English leakage increased:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:i18n-distinctness] PASS — English-identical counts within baseline (' + report.join(' ') + '). Ratchet holds; new leakage blocked.');
