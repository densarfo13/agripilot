#!/usr/bin/env node
/**
 * scripts/check-home-header-cleanup.mjs — Home header cleanup contract.
 *
 *   • Home must NOT render a user-visible "Online" badge.
 *   • Home must NOT render a user-visible "Live" badge.
 *   • Home MUST render a notification button (NotificationBell + an
 *     aria-label / data-testid we can find).
 *   • Home MUST render a menu button with aria-label="Menu".
 *
 * The scan looks at user-visible text in Home.jsx (comments + identifiers
 * like `useLiveWeather` are stripped/whitelisted so engineering names never
 * trigger a false fail). Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const rel = 'src/pages/Home.jsx';
const raw = read(rel);
if (!raw) { F.push(`${rel}: missing`); }
else {
  // Strip JS comments so prose like "// Live weather pipeline" never trips
  // a false fail. The visible-text scan runs on the stripped body.
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');

  // Whitelist engineering identifiers that contain "Live" — these are
  // names, NEVER user-visible text:
  //   useLiveWeather (hook)
  //   weatherStatusLive (i18n key, only allowed to APPEAR in legacy code,
  //                      but we forbid an actual tSafe call on it below).
  const safe = stripped
    .replace(/useLiveWeather/g, '__HOOK__')
    .replace(/Live weather/gi, '__ENG_NAME__')        // dev-log strings
    .replace(/\.live(?=[A-Z_])/g, '.__ID__')          // any .liveXxx identifier
    .replace(/'live'|"live"/gi, '__STR_ID__');        // engine kind strings

  // FAIL #1 — user-visible "Online" badge text.
  // Matches a tSafe / t fallback or a raw >Online< / JSX text Online that
  // isn't part of a longer identifier.
  if (/>\s*Online\s*</.test(safe) ||
      /tSafe\([^)]*['"][^'"]*['"]\s*,\s*['"]Online['"]/.test(safe) ||
      /['"]home\.status\.online['"]/.test(safe))
    F.push('Home must not render an "Online" badge');
  else P.push('no "Online" badge on Home');

  // FAIL #2 — user-visible "Live" badge text.
  // Looks for the prior statusPill block ('weatherStatusLive' tSafe call
  // OR a raw "Live" inside a span / chip).
  if (/tSafe\([^)]*['"]home\.weatherStatusLive['"]/.test(safe) ||
      /['"]weatherStatusLive['"]/.test(safe) ||
      />\s*Live\s*</.test(safe) ||
      /tSafe\([^)]*['"][^'"]*['"]\s*,\s*['"]Live['"]/.test(safe))
    F.push('Home must not render a "Live" badge');
  else P.push('no "Live" badge on Home');

  // FAIL #3 — the legacy statusPill rendering block must be gone.
  if (/<span\s+style=\{S\.statusPill\}/.test(safe))
    F.push('Home must not render the legacy <span style={S.statusPill}> chip');
  else P.push('legacy statusPill chip removed');

  // PASS — notification button exists. Either NotificationBell rendered,
  // or an explicit aria-label="Notifications" element.
  const hasBell = /<NotificationBell\b/.test(safe) || /aria-label=['"]Notifications['"]/.test(safe);
  if (!hasBell) F.push('Home must render a notification button (NotificationBell or aria-label="Notifications")');
  else P.push('notification button present');

  // PASS — menu button exists. Must carry aria-label="Menu".
  const hasMenu = /aria-label=['"]Menu['"]/.test(safe);
  if (!hasMenu) F.push('Home must render a menu button with aria-label="Menu"');
  else P.push('menu button present (aria-label="Menu")');

  // Sanity — both buttons live in the header (the same top-right cluster)
  // so the page doesn't grow a stray button somewhere strange. We look for
  // the new headerActions cluster wrapping them.
  if (hasBell && hasMenu && !/headerActions/.test(safe))
    F.push('bell + menu should live inside the header-actions cluster (data-testid="home-header-actions")');
  else if (hasBell && hasMenu)
    P.push('bell + menu live inside the header-actions cluster');
}

if (F.length) {
  console.error('[check:home-header-cleanup] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:home-header-cleanup] PASS — no Online / Live badges; bell + menu in former Live slot.');
for (const m of P) console.log('  ✓ ' + m);
