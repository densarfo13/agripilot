/**
 * check-no-conditional-hooks.mjs — permanent lock on the hook-order crash class.
 * PRODUCTION ROOT CAUSE (2026-07-04): PhotoComparisonCard's early return sat between
 * hooks; when a scan completed and scanId flipped truthy, React threw ("Rendered more
 * hooks…") → scan boundary → "Scan temporarily unavailable". Any react-hooks/
 * rules-of-hooks ERROR anywhere in src now fails the build.
 */
import { execSync } from 'node:child_process';
let out = '';
try { out = execSync('npx eslint src --format json --quiet', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (err) { out = err.stdout || ''; }
let hits = [];
try {
  for (const f of JSON.parse(out)) for (const m of f.messages || [])
    if (m.ruleId === 'react-hooks/rules-of-hooks') hits.push('src' + String(f.filePath).split('src').pop() + ':' + m.line);
} catch { console.error('[check:no-conditional-hooks] FAIL — could not parse eslint output'); process.exit(1); }
if (hits.length) {
  console.error('[check:no-conditional-hooks] FAIL — conditional/misordered React hooks (crash class):');
  hits.slice(0, 20).forEach((h) => console.error('  - src/' + h));
  process.exit(1);
}
console.log('[check:no-conditional-hooks] PASS — zero rules-of-hooks violations; the hook-order render-crash class cannot recur.');
