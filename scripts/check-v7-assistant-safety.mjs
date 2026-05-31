#!/usr/bin/env node
/**
 * scripts/check-v7-assistant-safety.mjs — daily assistant must be safe,
 * gentle, and bounded.
 *
 * Fails if the V7 FarmAssistantEngine:
 *   • does not hard-cap the daily actions at 3 (slice(0,3) / MAX 3)
 *   • emits unsafe treatment guidance (a hardcoded chemical dosage)
 *   • uses scary language (fatal/death/disaster/catastrophe/emergency/ruined)
 *   • does not surface voiceReady (so a missing native voice can be
 *     disclosed as a fallback)
 *   • is missing the "Decision support, not a guarantee." disclaimer
 *
 * Read-only static analyzer. Comments are stripped before the prose checks
 * so a doc comment that NAMES the banned words is not itself a violation.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v7/assistant/FarmAssistantEngine.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  // Hard cap of 3 daily actions.
  if (!/\.slice\(\s*0\s*,\s*3\s*\)/.test(src) && !/MAX_ACTIONS\s*=\s*3/.test(src))
    F.push('FarmAssistantEngine must hard-cap daily actions at 3 (slice(0,3) / MAX_ACTIONS=3)');
  else P.push('daily actions hard-capped at 3');
  // No chemical dosage / unsafe treatment guidance.
  if (/\b\d+\s?(ml|l|g|kg)\s*\/\s*(l|litre|liter|acre|ha)\b/i.test(src))
    F.push('FarmAssistantEngine must NOT emit a chemical dosage (unsafe treatment guidance)');
  else P.push('no unsafe treatment guidance (no chemical dosage)');
  // No scary language (in code, after stripping comments).
  const scary = (src.match(/\b(fatal|death|dead|disaster|catastrophe|emergency|ruined)\b/gi) || [])
    .map((w) => w.toLowerCase());
  if (scary.length) F.push(`FarmAssistantEngine uses scary language: ${[...new Set(scary)].join(', ')}`);
  else P.push('no scary language');
  // Voice fallback disclosed.
  if (!/voiceReady/.test(src))
    F.push('FarmAssistantEngine must surface voiceReady (disclose voice fallback per language)');
  else P.push('voiceReady surfaced (voice fallback disclosable)');
  // Disclaimer.
  if (!/Decision support, not a guarantee/.test(raw))
    F.push('FarmAssistantEngine must carry the "Decision support, not a guarantee." disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:v7-assistant-safety] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v7-assistant-safety] PASS — bounded, gentle, no unsafe treatment guidance, voice fallback disclosed.');
for (const m of P) console.log('  ✓ ' + m);
