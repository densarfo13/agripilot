/**
 * check-locale-audit-v2.mjs — LOCALE_AUDIT_V2.
 *
 * Detects English leaking into Twi screens and FAILS CI when Twi
 * coverage drops below 95%. "Covered" = the Twi value is a real
 * translation (present, non-blank, and DISTINCT from the English value;
 * pure numbers/symbols/units/brand tokens are exempt because they are the
 * same in every language).
 *
 * Categorizes the leaks so the report names WHICH surfaces are English:
 *   • buttons / CTAs        (*.button, *.cta, *.action, common.*)
 *   • notifications         (notif*, *.toast, *.push)
 *   • dialogs / modals      (*.dialog, *.modal, *.confirm, *.sheet)
 *   • scan screens          (scan*, plant.*)
 *   • other
 *
 * Threshold: TW_COVERAGE_MIN = 95.0 (%). Lower only when truly justified.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TW_COVERAGE_MIN = 95.0;
const LOCALE = 'tw';

const rd = (l) => fs.readFileSync(path.join(ROOT, 'src/i18n/columns/T-' + l + '.js'), 'utf8');
const parse = (s) => {
  const o = {};
  const re = /"([a-zA-Z0-9_.]+)":\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(s))) o[m[1]] = m[2];
  return o;
};
// Same-in-every-language tokens are not leaks: numbers/symbols/units, pH,
// OK, GPS, brand names, etc.
const _universal = (v) =>
  /^[\s\d\W]*$/.test(v)
  || /^\{[a-zA-Z0-9_]+\}$/.test(v.trim()) // pure interpolation token e.g. "{task}"
  || /^(pH|OK|NDVI|GPS|SMS|API|CSV|Farroway|Kindwise|km|kg|ha|°c|°f)$/i.test(v.trim());

function _category(key) {
  const k = key.toLowerCase();
  if (/\.(button|cta|action|submit|confirmlabel)$/.test(k) || k.startsWith('common.')) return 'buttons';
  if (k.startsWith('notif') || /\.(toast|push|alert)$/.test(k) || k.includes('notification')) return 'notifications';
  if (/\.(dialog|modal|confirm|sheet|prompt)\b/.test(k) || /\.(dialog|modal|confirm|sheet)$/.test(k)) return 'dialogs';
  if (k.startsWith('scan') || k.startsWith('plant.')) return 'scan';
  return 'other';
}

const en = parse(rd('en'));
const tw = parse(rd(LOCALE));

let total = 0;
let covered = 0;
const leaks = [];
for (const key of Object.keys(en)) {
  const e = en[key];
  if (!e || _universal(e)) continue; // skip blanks + universal tokens
  total += 1;
  const t = tw[key];
  const isCovered = !!t && t.trim().length > 0 && t !== e;
  if (isCovered) covered += 1;
  else leaks.push({ key, en: e, cat: _category(key) });
}

const coverage = total ? Math.round((covered / total) * 1000) / 10 : 100;

// Group leaks by category.
const byCat = {};
for (const l of leaks) (byCat[l.cat] = byCat[l.cat] || []).push(l);
const order = ['buttons', 'notifications', 'dialogs', 'scan', 'other'];

console.log('[check:locale-audit-v2] Twi coverage: ' + coverage + '% '
  + '(' + covered + '/' + total + ' keys translated · ' + leaks.length + ' English leaks · min ' + TW_COVERAGE_MIN + '%)');
for (const cat of order) {
  const rows = byCat[cat];
  if (!rows || rows.length === 0) continue;
  console.log('  • ' + cat + ': ' + rows.length + ' English on Twi screens'
    + (rows.length <= 6 ? ' — ' + rows.map((r) => r.key).join(', ')
      : ' — e.g. ' + rows.slice(0, 6).map((r) => r.key).join(', ') + ' …'));
}

if (coverage < TW_COVERAGE_MIN) {
  console.error('[check:locale-audit-v2] FAIL — Twi coverage ' + coverage
    + '% is below the ' + TW_COVERAGE_MIN + '% minimum. Translate the leaked keys above.');
  process.exit(1);
}
console.log('[check:locale-audit-v2] PASS — Twi coverage ' + coverage + '% ≥ ' + TW_COVERAGE_MIN + '%.');
