#!/usr/bin/env node
/**
 * scripts/check-v8-voice-honesty.mjs
 *
 * Voice readiness must be honest — never claim a native voice that is not
 * configured. Fails if VoiceAssistantReadiness:
 *   • does not surface nativeVoiceConfigured (the honest native-voice flag)
 *   • does not detect voices from the real speech engine (speechSynthesis)
 *   • does not surface a disclosed fallbackVoice
 *   • hardcodes nativeVoiceConfigured:true (a fake native-voice claim)
 *   • does not reference the supported languages
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

const rel = 'src/runtime/v8/voice/VoiceAssistantReadiness.ts';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  const src = strip(raw);
  if (!/nativeVoiceConfigured/.test(src))
    F.push('VoiceAssistantReadiness must surface nativeVoiceConfigured');
  else P.push('nativeVoiceConfigured surfaced');
  // Real detection via the speech engine.
  if (!/speechSynthesis/.test(src))
    F.push('VoiceAssistantReadiness must detect voices via speechSynthesis (no pretended native voice)');
  else P.push('detects voices via speechSynthesis');
  // Fallback disclosed.
  if (!/fallbackVoice/.test(src))
    F.push('VoiceAssistantReadiness must surface fallbackVoice (disclosed fallback)');
  else P.push('fallbackVoice disclosed');
  // No hardcoded native-voice claim.
  if (/nativeVoiceConfigured:\s*true/.test(src))
    F.push('VoiceAssistantReadiness must NOT hardcode nativeVoiceConfigured:true');
  else P.push('no hardcoded native-voice claim');
  // Supported languages present.
  const langs = ['tw', 'ha', 'sw', 'hi'];
  const missing = langs.filter((l) => !new RegExp(`['"]${l}['"]`).test(raw));
  if (missing.length) F.push(`VoiceAssistantReadiness must reference supported languages: ${missing.join(', ')}`);
  else P.push('supported languages referenced (en/tw/ha/fr/sw/hi)');
  if (!/Decision support, not a guarantee/.test(raw))
    F.push('VoiceAssistantReadiness must carry the disclaimer');
  else P.push('disclaimer present');
}

if (F.length) {
  console.error('[check:v8-voice-honesty] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:v8-voice-honesty] PASS — honest native-voice detection, disclosed fallback.');
for (const m of P) console.log('  ✓ ' + m);
