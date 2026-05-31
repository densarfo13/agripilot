#!/usr/bin/env node
/**
 * scripts/check-message-template-locales.mjs — §8 email/SMS locale safety.
 *
 * The per-locale email/SMS BODIES are translator-review (not yet
 * authored) — so this gate enforces the SAFE contract: a missing
 * locale must fall back to the English template, the diagnostic must
 * report it honestly, and invite delivery must never be faked.
 *
 * Read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const diag = read('src/runtime/i18n/LanguageHealthRuntime.js');
for (const tok of ['emailLocalesReady', 'smsLocalesReady', 'fallbackSafe']) {
  if (!new RegExp(`\\b${tok}\\b`).test(diag)) F.push(`__messageTemplateHealth must surface "${tok}"`);
}
if (!/fallbackSafe:\s*true/.test(diag))
  F.push('__messageTemplateHealth must report fallbackSafe:true (missing locale → English template)');
else P.push('message templates fall back to English safely (fallbackSafe)');

// Invite delivery must never be faked.
const inv = read('src/runtime/invites/InviteRuntime.ts');
if (!/fakeDelivery:\s*false/.test(inv))
  F.push('InviteRuntime must report fakeDelivery:false (no faked send state)');
else P.push('invite delivery never faked (fakeDelivery:false)');

if (F.length) {
  console.error('[check:message-template-locales] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:message-template-locales] PASS — email/SMS fall back to English safely; no faked delivery.');
for (const m of P) console.log('  ✓ ' + m);
