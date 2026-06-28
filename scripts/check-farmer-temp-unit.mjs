/**
 * check-farmer-temp-unit.mjs — farmer-facing temperatures must render in the user's
 * resolved unit (°C/°F per preference → country → fallback), not a hardcoded °C
 * (priority #4 UI consistency / localization; CIL "measurement units").
 *
 * Bug: the home weather card + dashboard hero rendered `{value}°C`, so a US / Liberia /
 * Myanmar farmer (Fahrenheit) saw a Celsius number labelled °C every day. The fix routes
 * these through useTemperatureUnit().format(valueC), which converts + rounds + labels in
 * the resolved unit (and returns '' for null — never "NaN°C").
 *
 * Invariant for these weather screens: import useTemperatureUnit AND no hardcoded
 * `}°C` / `}°F` render pattern. (LiveIntelligenceStrip's compact bare-`°` heat chip uses a
 * different field and is tracked separately — not covered here.)
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const E = [];
const FILES = ['src/components/FarmWeatherCard.jsx', 'src/pages/FarmerDashboardPage.jsx'];
const RENDER_UNIT = /\}\s*°[CF]/;   // a JSX value brace immediately followed by a hardcoded unit

for (const rel of FILES) {
  let s = '';
  try { s = fs.readFileSync(path.join(R, rel), 'utf8'); } catch { E.push('missing: ' + rel); continue; }
  if (!s.includes('useTemperatureUnit')) {
    E.push(`${rel}: must use useTemperatureUnit() so temperature follows the farmer's unit preference`);
  }
  const m = s.match(RENDER_UNIT);
  if (m) {
    E.push(`${rel}: hardcoded unit in render ("${m[0]}") — use useTemperatureUnit().format(valueC) instead of {value}°C`);
  }
}

if (E.length) {
  console.error('[check:farmer-temp-unit] FAIL — ' + E.length + ' issue(s):');
  for (const e of E) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:farmer-temp-unit] PASS — the farmer weather card + dashboard hero render temperature via '
  + 'useTemperatureUnit().format() in the resolved unit, never a hardcoded °C.');
