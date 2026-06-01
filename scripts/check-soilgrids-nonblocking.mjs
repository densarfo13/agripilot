#!/usr/bin/env node
/**
 * check-soilgrids-nonblocking.mjs — soil integration must NEVER block
 * Home or Daily Assistant. Locks that the SoilGrids runtime is
 * read-only from the perspective of those critical paths.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return '';
  return fs.readFileSync(p, 'utf8');
};

// SoilGridsRuntime must declare `nonBlocking: true as const`.
{
  const f = 'src/runtime/soil/SoilGridsRuntime.ts';
  const src = read(f);
  if (!src) fails.push(`missing: ${f}`);
  else {
    if (src.indexOf('nonBlocking: true as const') < 0)
      fails.push(`${f}: must declare nonBlocking: true as const`);
    if (src.indexOf('SOILGRIDS_FETCH_TIMEOUT_MS') < 0)
      fails.push(`${f}: must respect SOILGRIDS_FETCH_TIMEOUT_MS`);
  }
}

// Home (SimpleModeHomeSection) MUST NOT await fetchSoilProfile inline.
{
  const f = 'src/components/simpleMode/SimpleModeHomeSection.jsx';
  const src = read(f);
  if (src && /await\s+fetchSoilProfile/.test(src))
    fails.push(`${f}: Home must NOT await fetchSoilProfile inline (would block render)`);
}

// DailyAssistant runtimes MUST NOT import SoilGrids at all (separation).
const dailyFiles = [
  'src/runtime/dailyAssistant/DailyAssistantRuntime.ts',
  'src/runtime/dailyAssistant/TaskChainRuntime.ts',
];
for (const f of dailyFiles) {
  const src = read(f);
  if (src && /from\s+['"][^'"]*SoilGrids/i.test(src))
    fails.push(`${f}: Daily Assistant must NOT import SoilGrids runtime`);
}

if (fails.length) {
  console.error('[check:soilgrids-nonblocking] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:soilgrids-nonblocking] OK');
