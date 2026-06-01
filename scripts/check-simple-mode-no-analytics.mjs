#!/usr/bin/env node
/**
 * scripts/check-simple-mode-no-analytics.mjs — Simple Mode must not show
 * analytics / charts / percentage-heavy dashboards.
 *
 * Fails if any of the Simple* renderer files contain:
 *   - imports from a charting library (recharts, chart.js, victory, d3)
 *   - <Chart…>, <BarChart…>, <LineChart…>, <PieChart…> JSX tags
 *   - hard-coded percentage strings in rendered text (e.g. "85%", "12.3%")
 *     — these are accepted only inside comments and i18n keys
 *   - the words "dashboard" / "analytics" / "metrics" in visible JSX text
 *     (whitelisted in comments / props / handlers)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const FILES = [
  'src/components/simpleMode/SimpleHome.jsx',
  'src/components/simpleMode/SimpleTasks.jsx',
  'src/components/simpleMode/SimpleScanResult.jsx',
  'src/components/simpleMode/SimpleDailyPlan.jsx',
  'src/components/simpleMode/SimplePostHarvest.jsx',
  'src/components/simpleMode/SimpleModeHomeSection.jsx',
  'src/components/simpleMode/SimpleActionCard.jsx',
  'src/components/simpleMode/SimpleModeScanCard.jsx',
];

for (const rel of FILES) {
  const raw = read(rel);
  if (!raw) { F.push(`${rel}: missing`); continue; }
  const body = strip(raw);

  // 1. Charting library imports.
  if (/from\s+['"](?:recharts|chart\.js|chartjs|victory|d3|react-chartjs|highcharts)['"]/.test(body))
    F.push(`${rel}: must not import a charting library`);

  // 2. Chart JSX tags.
  if (/<(?:Bar|Line|Pie|Area|Radar|Scatter|Bubble)?Chart\b/.test(body))
    F.push(`${rel}: must not render chart components`);

  // 3. Percentage strings in JSX text (excludes width: '100%' / height: '100%').
  //    Whitelist 100%/50%/25% used in inline style values like width/height.
  const pctMatches = body.match(/>[^<]*?\d+(?:\.\d+)?\s*%[^<]*?</g) || [];
  const realPct = pctMatches.filter((m) => !/100%|50%|25%/.test(m));
  if (realPct.length)
    F.push(`${rel}: must not render percentage values in visible text (found ${realPct.length})`);

  // 4. Forbidden words in JSX text. We only flag if they appear as
  //    rendered children (`>…dashboard…<`), not in identifiers / props.
  const txtMatches = body.match(/>[^<]+</g) || [];
  for (const word of ['dashboard', 'analytics', 'metrics']) {
    const hits = txtMatches.filter((t) => new RegExp(`\\b${word}\\b`, 'i').test(t));
    if (hits.length)
      F.push(`${rel}: visible text must not contain "${word}" (found ${hits.length})`);
  }
}
if (!F.length) P.push('no charts, no analytics, no percentage-heavy text in Simple Mode renderers');

// Runtime must assert analyticsHiddenInSimple literal-true.
const runtime = read('src/runtime/simpleMode/SimpleModeRuntime.ts');
if (!runtime) F.push('SimpleModeRuntime.ts: missing');
else if (!/analyticsHiddenInSimple:\s*true/.test(runtime))
  F.push('SimpleModeRuntime must declare analyticsHiddenInSimple:true');
else P.push('analyticsHiddenInSimple literal-true in runtime');

if (F.length) {
  console.error('[check:simple-mode-no-analytics] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-no-analytics] PASS — no charts, no analytics, no percentage-heavy dashboard text.');
for (const m of P) console.log('  ✓ ' + m);
