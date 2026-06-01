#!/usr/bin/env node
/**
 * scripts/check-floating-voice-button.mjs — §8 FLOATING MIC.
 *
 * Fails if:
 *   - the diagnostic runtime is missing
 *   - the runtime envelope doesn't declare the §8 literal-true flags
 *   - the ProtectedLayout floating-mic gate doesn't read simpleMode
 *     AND a voice-assistant preference (must require at least one)
 *   - the gate doesn't list the §8 hide-by-default paths
 *     (/funding /sell /activity /my-farm /my-grow)
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rt = read('src/runtime/voiceUI/VoiceFloatingButtonHealth.ts');
if (!rt) F.push('VoiceFloatingButtonHealth.ts: missing');
else {
  for (const f of ['conditionalVisibilityReady: true', 'hiddenWhenNotNeeded: true', 'doesNotCoverCTA: true']) {
    if (!rt.includes(f)) F.push(`envelope must declare ${f}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all §8 literal-true flags present');
}

const layout = read('src/layouts/ProtectedLayout.jsx');
if (!layout) F.push('ProtectedLayout.jsx: missing');
else {
  if (!/farroway_simple_mode_enabled/.test(layout))
    F.push('floating mic gate must read farroway_simple_mode_enabled');
  else P.push('reads simpleMode pref');
  if (!/farroway_voice_assistant_enabled|farroway_voice_preferences/.test(layout))
    F.push('floating mic gate must read voice-assistant preferences');
  else P.push('reads voice-assistant pref');
  // §8 hide-by-default paths
  const HIDE = ['funding', 'sell', 'activity', 'my-farm', 'my-grow'];
  const missingPaths = HIDE.filter((p) => !new RegExp(p).test(layout));
  if (missingPaths.length)
    F.push(`floating mic gate must list hide-by-default paths: ${missingPaths.join(', ')}`);
  else P.push('all 5 hide-by-default paths listed');
  // The gate must short-circuit (return null) when neither flag is on.
  if (!/return null/.test(layout))
    F.push('floating mic gate must short-circuit (return null) when conditions unmet');
  else P.push('short-circuit return null wired');
}

if (F.length) {
  console.error('[check:floating-voice-button] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:floating-voice-button] PASS — visibility gated on simpleMode|voice; 5 paths hide-by-default.');
for (const m of P) console.log('  ✓ ' + m);
