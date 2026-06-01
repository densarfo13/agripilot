#!/usr/bin/env node
/**
 * scripts/check-simple-mode-action-first.mjs — §1, §2, §3.
 *
 * Fails if:
 *   - The SimpleActionCard does not surface Do this / Why / When + a
 *     primary Done button.
 *   - The Home Simple Mode section does not surface "Today's Action".
 *   - The Scan Simple Mode card does not surface Plant / Problem /
 *     Do this / Next.
 *   - Simple Mode UI renders forbidden phrases (confirmed/guaranteed/100%).
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const card = read('src/components/simpleMode/SimpleActionCard.jsx');
if (!card) F.push('SimpleActionCard.jsx: missing');
else {
  for (const key of ['simple.label.doThisNow', 'simple.label.why', 'simple.label.when', 'simple.button.done']) {
    if (!card.includes(key)) F.push(`SimpleActionCard must surface ${key}`);
  }
  if (!F.some((m) => /SimpleActionCard must/.test(m))) P.push('SimpleActionCard: Do this / Why / When / Done present');
  // The primary Done button must be present in the markup.
  if (!/data-testid=['"]simple-action-done['"]/.test(card))
    F.push('SimpleActionCard must render a Done button (data-testid=simple-action-done)');
  else P.push('Done button present');
}

const home = read('src/components/simpleMode/SimpleModeHomeSection.jsx');
if (!home) F.push('SimpleModeHomeSection.jsx: missing');
else {
  if (!/simple\.home\.eyebrow/.test(home) || !/Today's Action/.test(home))
    F.push('Home Simple Mode must surface "Today\'s Action" eyebrow');
  else P.push('Home shows Today\'s Action');
  if (!/<SimpleActionCard/.test(home))
    F.push('Home Simple Mode must render SimpleActionCard');
  else P.push('Home renders SimpleActionCard');
}

const scan = read('src/components/simpleMode/SimpleModeScanCard.jsx');
if (!scan) F.push('SimpleModeScanCard.jsx: missing');
else {
  for (const key of ['simple.scan.plant', 'simple.scan.problem', 'simple.scan.doThis', 'simple.scan.next']) {
    if (!scan.includes(key)) F.push(`SimpleModeScanCard must surface ${key}`);
  }
  if (!F.some((m) => /SimpleModeScanCard must/.test(m)))
    P.push('Scan card: Plant / Problem / Do this / Next present');
  // Save Plant + Create Task + Scan Again buttons.
  for (const t of ['simple-scan-save', 'simple-scan-task', 'simple-scan-again']) {
    if (!scan.includes(t)) F.push(`Scan card must expose ${t} button`);
  }
  if (!F.some((m) => /Scan card must expose/.test(m)))
    P.push('Scan card buttons: Save / Create Task / Scan Again');
}

// Home must render the Simple Mode section when enabled.
const homePage = read('src/pages/Home.jsx');
if (!homePage) F.push('src/pages/Home.jsx: missing');
else {
  if (!/SimpleModeHomeSection/.test(homePage))
    F.push('Home.jsx must import + render SimpleModeHomeSection');
  else P.push('Home.jsx renders SimpleModeHomeSection');
  if (!/simpleModeEnabled/.test(homePage))
    F.push('Home.jsx must branch on the Simple Mode preference');
  else P.push('Home.jsx branches on Simple Mode pref');
}

// Forbidden phrases — never appear as visible Simple Mode copy. We strip
// comments AND strip regex/string literals that explicitly REJECT these
// words (the scrubber in SimpleModeScanCard legitimately names them inside
// a regex). Match only in JSX/component file BODIES, not in i18n strings
// where the words could appear as gate-rejected fallbacks.
const FORBIDDEN = /\b(confirmed|guaranteed|100%|protocol|taxonomy|integrated disease management)\b/i;
function _stripScrubberRegex(s) {
  // Drop any regex literal that contains a leading "FORBIDDEN" / "scrub" / "reject"
  // comment marker on the previous line, plus the literal regex itself.
  return s.replace(/FORBIDDEN_RE\s*=\s*\/[^\n]+\/[gimuy]*/g, 'FORBIDDEN_RE = __SCRUB__');
}
for (const rel of [
  'src/components/simpleMode/SimpleActionCard.jsx',
  'src/components/simpleMode/SimpleModeHomeSection.jsx',
  'src/components/simpleMode/SimpleModeScanCard.jsx',
  'src/i18n/simpleModeActionTranslations.js',
]) {
  const raw = read(rel);
  if (!raw) continue;
  const src = _stripScrubberRegex(strip(raw));
  if (FORBIDDEN.test(src))
    F.push(`${rel.split('/').pop()}: forbidden phrase (confirmed / guaranteed / 100% / protocol / taxonomy / IDM)`);
}
if (!F.some((m) => /forbidden phrase/.test(m))) P.push('no forbidden phrases in Simple Mode UI');

if (F.length) {
  console.error('[check:simple-mode-action-first] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-action-first] PASS — action card, Home Today\'s Action, Scan Plant/Problem/Do this/Next, no forbidden phrases.');
for (const m of P) console.log('  ✓ ' + m);
