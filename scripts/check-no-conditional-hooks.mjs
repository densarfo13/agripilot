/**
 * check-no-conditional-hooks.mjs — permanent lock on the hook-order crash class.
 * PRODUCTION ROOT CAUSE (2026-07-04): PhotoComparisonCard's early return sat between
 * hooks; when a scan completed and scanId flipped truthy, React threw ("Rendered more
 * hooks…") → scan boundary → "Scan temporarily unavailable". Any react-hooks/
 * rules-of-hooks ERROR anywhere in src now fails the build.
 */
import { execSync } from 'node:child_process';
let out = '';
try { out = execSync('npx eslint src --format json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
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

// exhaustive-deps RATCHET — warnings may only fall (baseline committed).
import fs from 'node:fs';
const BASELINE_FILE = 'scripts/hooks-deps-baseline.json';
let deps = 0;
try { for (const f of JSON.parse(out)) for (const m of f.messages || []) if (m.ruleId === 'react-hooks/exhaustive-deps') deps++; } catch { /* counted above parse */ }
if (process.argv.includes('--update')) { fs.writeFileSync(BASELINE_FILE, JSON.stringify({ exhaustiveDeps: deps }) + '\n'); console.log('[check:no-conditional-hooks] baseline updated: exhaustive-deps=' + deps); process.exit(0); }
let baseline = null;
try { baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')).exhaustiveDeps; } catch { baseline = null; }
if (baseline == null) { console.error('[check:no-conditional-hooks] FAIL — missing ' + BASELINE_FILE + ' (run --update)'); process.exit(1); }
if (deps > baseline) { console.error('[check:no-conditional-hooks] FAIL — exhaustive-deps warnings rose ' + baseline + ' → ' + deps + ' (ratchet: can only fall)'); process.exit(1); }

// Scan-render regression — the result tree must render success/lowConf/sparse + the
// PhotoComparisonCard scanId transition without a throw (2026-07-04 crash class).
import { execSync as _x } from 'node:child_process';
try { _x('npx tsx scripts/repro-scan-render-crash.mjs --strict', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (err) { console.error('[check:no-conditional-hooks] FAIL — scan render regression:'); console.error(String(err.stdout || err.message).slice(-800)); process.exit(1); }

console.log('[check:no-conditional-hooks] PASS — rules-of-hooks=0; exhaustive-deps ' + deps + '/' + baseline + ' (ratchet); scan result tree renders success/lowConf/sparse + scanId transition clean.');
