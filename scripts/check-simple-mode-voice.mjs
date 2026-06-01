#!/usr/bin/env node
/**
 * scripts/check-simple-mode-voice.mjs — Simple Mode voice-first contract.
 *
 * Fails if:
 *   - SimpleHome lacks a Listen button (data-testid="simple-home-listen")
 *   - the voice runtime envelope doesn't declare listenButtonReady:true
 *   - the voice runtime doesn't declare fallbackVoiceSafe:true (must be
 *     literal true — voice playback is best-effort, the UI never errors)
 *   - the SimpleVoicePlayed artifact kind is missing from the OODA runtime
 *   - the SimpleHome listen handler doesn't record a SimpleVoicePlayed
 *     artifact entry
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// 1. SimpleHome listen button.
const home = read('src/components/simpleMode/SimpleHome.jsx');
if (!home) F.push('SimpleHome.jsx: missing');
else {
  if (!/data-testid=['"]simple-home-listen['"]/.test(home))
    F.push('SimpleHome must render a Listen button with data-testid="simple-home-listen"');
  else P.push('Listen button present on SimpleHome');
  if (!/aria-label=\{?[^}]*['"][^'"]*['"]/.test(home) && !/aria-label=/.test(home))
    F.push('SimpleHome Listen button must carry an aria-label');
  if (!/SimpleVoicePlayed/.test(home))
    F.push('SimpleHome listen handler must record a SimpleVoicePlayed artifact');
  else P.push('SimpleHome records SimpleVoicePlayed artifact on listen');
}

// 2. Voice runtime envelope.
const voice = read('src/runtime/simpleMode/SimpleModeVoiceRuntime.ts');
if (!voice) F.push('SimpleModeVoiceRuntime.ts: missing');
else {
  if (!/listenButtonReady:\s*true/.test(voice))
    F.push('voice runtime must declare listenButtonReady:true');
  else P.push('listenButtonReady literal-true in voice runtime');
  if (!/fallbackVoiceSafe:\s*true/.test(voice))
    F.push('voice runtime must declare fallbackVoiceSafe:true');
  else P.push('fallbackVoiceSafe literal-true in voice runtime');
  if (!/voiceCopyReady:\s*true/.test(voice))
    F.push('voice runtime must declare voiceCopyReady:true');
  else P.push('voiceCopyReady literal-true in voice runtime');
  if (!/shortPromptsReady:\s*true/.test(voice))
    F.push('voice runtime must declare shortPromptsReady:true');
  else P.push('shortPromptsReady literal-true in voice runtime');
}

// 3. OODA runtime knows about SimpleVoicePlayed.
const ooda = read('src/runtime/simpleMode/SimpleModeOODARuntime.ts');
if (!ooda) F.push('SimpleModeOODARuntime.ts: missing');
else if (!/SimpleVoicePlayed/.test(ooda))
  F.push('OODA runtime must enumerate SimpleVoicePlayed artifact kind');
else P.push('SimpleVoicePlayed kind enumerated in OODA runtime');

if (F.length) {
  console.error('[check:simple-mode-voice] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:simple-mode-voice] PASS — Listen button + listenButtonReady + fallbackVoiceSafe + SimpleVoicePlayed.');
for (const m of P) console.log('  ✓ ' + m);
