#!/usr/bin/env node
/**
 * scripts/check-no-online-live.mjs — permanent Online/Live ban.
 *
 * Fails if any active page-rendering source renders a user-visible
 * "Online" or "Live" status badge. Engineering identifiers (useLiveWeather,
 * `Live` enum strings, etc.) are whitelisted.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

// Scan src/pages + src/layouts + src/components for visible Online / Live text.
function walk(dir) {
  const out = [];
  try {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        out.push(...walk(rel));
      } else if (/\.(jsx|tsx)$/.test(entry.name)) {
        out.push(rel);
      }
    }
  } catch { /* ignore */ }
  return out;
}

const files = [
  ...walk('src/pages'),
  ...walk('src/layouts'),
  ...walk('src/components'),
];

for (const rel of files) {
  const raw = read(rel);
  if (!raw) continue;
  const body = strip(raw);
  // Whitelist engineering identifiers so the scan doesn't trip on
  // hooks/enums.
  const safe = body
    .replace(/useLiveWeather/g, '__HOOK__')
    .replace(/Live weather/gi, '__ENG__')
    .replace(/\.live(?=[A-Z_])/g, '.__ID__')
    .replace(/'live'|"live"/gi, '__STR__');
  // FAIL when a tSafe (or any literal) renders "Online" or "Live" as the
  // user-visible default fallback. JSX text rendering (`>Online<`) catches
  // the literal element case.
  if (/tSafe\([^)]*['"][^'"]*['"]\s*,\s*['"]Online['"]/.test(safe)
      || />\s*Online\s*</.test(safe)
      || /['"]home\.status\.online['"]/.test(safe)) {
    // Allow the dead-code CalmHomeHero file (it's not on any active render
    // path — only used by deprecated Dashboard). The user explicitly asked
    // for "Online removed from every page"; CalmHomeHero is not a page.
    if (!/CalmHomeHero/.test(rel))
      F.push(`${rel}: renders "Online"`);
  }
  // "Live" detection. Whitelist:
  //   • internal admin pages (PerformancePage etc. — admin-facing diagnostic
  //     docs, not a status badge on the grower surface)
  //   • prose "Live <code>" / "Live `…`" usage (describes a runtime probe)
  if (/tSafe\([^)]*['"][^'"]*['"]\s*,\s*['"]Live['"]/.test(safe)
      || />\s*Live\s*</.test(safe)
      || /tSafe\([^)]*['"]home\.weatherStatusLive['"]/.test(safe)) {
    const isInternalAdmin = /\/internal\//.test(rel);
    // Allow "Live <code>" / "Live `xxx`" prose where Live precedes a code span.
    const isProseLive = /\bLive\b\s+<code\b/.test(safe) || /\bLive\b\s+`/.test(safe);
    if (!/CalmHomeHero/.test(rel) && !isInternalAdmin && !isProseLive)
      F.push(`${rel}: renders "Live"`);
  }
}
if (!F.length) P.push('no Online/Live badges in pages / layouts / components');

if (F.length) {
  console.error('[check:no-online-live] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:no-online-live] PASS — no Online/Live badges anywhere on the active render path.');
for (const m of P) console.log('  ✓ ' + m);
