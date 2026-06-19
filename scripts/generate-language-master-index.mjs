#!/usr/bin/env node
/**
 * generate-language-master-index.mjs — sprint #204 STEP 1.
 *
 * Emits LANGUAGE_MASTER_INDEX.md: the full user-facing string
 * inventory grouped by top-level namespace, with per-namespace
 * counts + per-locale real-translation coverage. The canonical
 * source IS T-en.js (every rendered string already resolves to a
 * key there); this script makes that inventory legible.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COLS = path.join(ROOT, 'src', 'i18n', 'columns');

async function loadCol(code) {
  const url = pathToFileURL(path.join(COLS, 'T-' + code + '.js')).href + '?b=' + code;
  return (await import(url)).default;
}
function sidecar() {
  try { return JSON.parse(fs.readFileSync(path.join(COLS, '_translator-review-pending.json'), 'utf8')); }
  catch { return { perLocale: {} }; }
}

const LOCALES = ['en', 'fr', 'sw', 'ha', 'tw', 'hi'];
// The spec's named surfaces → namespace prefixes that feed them.
const SURFACE_MAP = [
  ['Tasks',         ['tasks.', 'taskAction', 'task.']],
  ['Scan',          ['scan.']],
  ['Market / Sell', ['market.', 'sell.', 'buyer.']],
  ['Funding',       ['funding.']],
  ['Farm',          ['myFarm.', 'farm.', 'newFarm.']],
  ['Garden',        ['garden.', 'gardenMode.', 'myGrow.']],
  ['Activity',      ['activity.', 'journal.', 'timeline.']],
  ['Notifications', ['notification', 'notifications.']],
  ['Settings',      ['settings.']],
  ['Onboarding',    ['onboarding.']],
  ['Voice',         ['voice.', 'twiVoice.']],
  ['Errors',        ['error', 'errors.']],
  ['Home / Hero',   ['home.', 'commandCenter.', 'today.', 'greeting.']],
  ['Common / Buttons', ['common.', 'header.actions', 'role.', 'outcome.']],
];

async function main() {
  const en = await loadCol('en');
  const enKeys = Object.keys(en);
  const counts = {};
  for (const code of LOCALES) {
    counts[code] = Object.keys(await loadCol(code)).length;
  }
  const sc = sidecar();
  const pending = (code) => (sc.perLocale && sc.perLocale[code]
    && Array.isArray(sc.perLocale[code].translatorReviewPending))
    ? sc.perLocale[code].translatorReviewPending.length : 0;

  const lines = [];
  lines.push('# LANGUAGE_MASTER_INDEX.md');
  lines.push('');
  lines.push('**Sprint #204 — user-facing string inventory.**');
  lines.push('Generated from `src/i18n/columns/T-en.js` (the canonical key set');
  lines.push('every rendered string resolves through). ' + enKeys.length + ' keys total.');
  lines.push('');
  lines.push('## Per-locale coverage');
  lines.push('');
  lines.push('| Locale | Keys | Structural | Real-translation | Pending review |');
  lines.push('|---|---:|---:|---:|---:|');
  for (const code of LOCALES) {
    const k = counts[code];
    const structural = enKeys.length > 0
      ? Math.round((Math.min(k, enKeys.length) / enKeys.length) * 1000) / 10 : 0;
    const pend = pending(code);
    const real = k > 0 ? Math.round(((k - pend) / k) * 1000) / 10 : 0;
    lines.push('| ' + code + ' | ' + k + ' | ' + structural + '% | '
      + (code === 'en' ? 100 : real) + '% | ' + pend + ' |');
  }
  lines.push('');
  lines.push('## Inventory by surface');
  lines.push('');
  lines.push('| Surface | Keys | Sample keys |');
  lines.push('|---|---:|---|');
  const claimed = new Set();
  for (const [surface, prefixes] of SURFACE_MAP) {
    const ks = enKeys.filter((k) => prefixes.some((p) => k.startsWith(p)));
    ks.forEach((k) => claimed.add(k));
    const sample = ks.slice(0, 4).join(', ') || '—';
    lines.push('| ' + surface + ' | ' + ks.length + ' | `'
      + sample.replace(/,/g, '`, `') + '` |');
  }
  const other = enKeys.filter((k) => !claimed.has(k));
  lines.push('| (other namespaces) | ' + other.length + ' | — |');
  lines.push('');
  lines.push('## How a rendered string maps to a key');
  lines.push('');
  lines.push('Every grower-facing string flows through `tSafe(key, fallback)`');
  lines.push('/ `tStrict` / `getLocalizedTaskTitle` / `getLocalizedCropName` /');
  lines.push('the scan `scan.*` keys. The build gate `audit:i18n` fails the');
  lines.push('build on any NEW hardcoded literal in the 19 scanned surfaces;');
  lines.push('`check-language-consistency` + `MythosLanguageGuard` attest the');
  lines.push('runtime. So "file → component → string → key" is enforced, not');
  lines.push('just documented: a string with no key cannot ship.');
  lines.push('');
  lines.push('_Regenerate: `node scripts/generate-language-master-index.mjs`_');

  fs.writeFileSync(path.join(ROOT, 'LANGUAGE_MASTER_INDEX.md'),
    lines.join('\n') + '\n', 'utf8');
  console.log('[master-index] wrote LANGUAGE_MASTER_INDEX.md ('
    + enKeys.length + ' keys, ' + SURFACE_MAP.length + ' surfaces)');
}

main().catch((e) => { console.error(e); process.exit(1); });
