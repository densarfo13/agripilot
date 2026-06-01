#!/usr/bin/env node
/**
 * scripts/check-task-voice-ui.mjs — §6 voice-icon cleanup.
 *
 * Fails if:
 *   - SimpleActionCard still renders a per-card 🔊 voice button
 *   - the task voice-UI runtime envelope is missing the 4 spec flags
 *   - the page-level Listen button on SimpleHome is gone
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

// Per-card voice button must be REMOVED from SimpleActionCard.
const card = read('src/components/simpleMode/SimpleActionCard.jsx');
if (!card) F.push('SimpleActionCard.jsx: missing');
else {
  // The legacy button used data-testid="simple-action-voice" — if that
  // attribute still appears in the rendered JSX the icon is back.
  if (/data-testid=['"]simple-action-voice['"]/.test(card))
    F.push('SimpleActionCard must not render the per-card voice button (data-testid="simple-action-voice")');
  else P.push('per-card voice button removed from SimpleActionCard');
  // The handleVoice handler can stay (used by future surfaces) but no
  // rendered 🔊 inside the header JSX.
  if (/<header[\s\S]{0,300}🔊/.test(card))
    F.push('SimpleActionCard must not render the 🔊 emoji inside its <header>');
  else P.push('no 🔊 in SimpleActionCard header');
}

// SimpleHome must keep the single page-level Listen button.
const home = read('src/components/simpleMode/SimpleHome.jsx');
if (!home) F.push('SimpleHome.jsx: missing');
else {
  if (!/data-testid=['"]simple-home-listen['"]/.test(home))
    F.push('SimpleHome must keep the page-level Listen button');
  else P.push('SimpleHome Listen button retained');
}

// Voice-UI envelope (the 4 literal-true flags).
const probes = read('src/runtime/dailyAssistant/DailyAssistantProbes.ts');
if (!probes) F.push('DailyAssistantProbes.ts: missing');
else {
  for (const fl of ['cardVoiceIconsRemoved: true', 'pageListenButtonReady: true',
    'floatingMicConditional: true', 'voiceDoesNotCoverCTA: true']) {
    if (!probes.includes(fl)) F.push(`taskVoiceUIHealth envelope must declare ${fl}`);
  }
  if (!F.some((m) => /taskVoiceUIHealth envelope/.test(m))) P.push('all 4 §6 flags literal-true');
  if (!/__taskVoiceUIHealth/.test(probes))
    F.push('probes must pin window.__taskVoiceUIHealth');
  else P.push('__taskVoiceUIHealth pinned');
}

if (F.length) {
  console.error('[check:task-voice-ui] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:task-voice-ui] PASS — per-card voice icon removed; page-level Listen retained; envelope literal-true.');
for (const m of P) console.log('  ✓ ' + m);
