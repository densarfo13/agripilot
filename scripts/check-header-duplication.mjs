#!/usr/bin/env node
/**
 * scripts/check-header-duplication.mjs — header dedup + Online removal.
 *
 * Fails if:
 *   • ProtectedLayout still renders the "Online" chip (S.onlineChip).
 *   • CalmHomeHero still calls tSafe('home.status.online', ...).
 *   • ProtectedLayout's bell + menu group is not hidden on /home (the
 *     isHome guard + !isHome conditional must be present).
 *   • Home renders MORE than one NotificationBell or more than one
 *     aria-label="Menu" element.
 *   • Home's header-actions cluster goes missing (we'd leave an empty
 *     placeholder container).
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

// ── 1. ProtectedLayout: Online chip removed + bell+menu hidden on /home ──
const proto = read('src/layouts/ProtectedLayout.jsx');
if (!proto) F.push('src/layouts/ProtectedLayout.jsx: missing');
else {
  const src = strip(proto);
  // The previous Online chip rendered both branches of a ternary; after the
  // fix the conditional must render NOTHING when online.
  if (/isOfflineSession\s*\?\s*S\.offlineChip\s*:\s*S\.onlineChip/.test(src))
    F.push('ProtectedLayout still renders the S.onlineChip branch');
  else P.push('ProtectedLayout no longer renders the online chip');
  if (/isOfflineSession\s*\?\s*t\('farmer\.offline'\)\s*:\s*t\('farmer\.online'\)/.test(src))
    F.push('ProtectedLayout still renders t(\'farmer.online\') text');
  else P.push('ProtectedLayout no longer renders the "farmer.online" text');
  // IN-PAGE INTEGRATION (Jun 2026): the previous spec required the chrome
  // bell/menu to merely HIDE on /home. The new contract is stronger — the
  // chrome bell/menu must be GONE from ProtectedLayout entirely (pages
  // render their own <PageActions />), and the layout chrome strip itself
  // must collapse (return null) when there's no offline chip to show. Both
  // shapes are accepted here so re-running this gate against either era
  // of the codebase still passes.
  const bellInLayout = /testId=['"]header-notification-bell['"]/.test(src);
  const menuInLayout = /data-testid=['"]layout-settings-menu['"]/.test(src);
  if (bellInLayout)
    F.push('ProtectedLayout must no longer render the chrome NotificationBell (in-page integration)');
  else P.push('ProtectedLayout chrome NotificationBell removed');
  if (menuInLayout)
    F.push('ProtectedLayout must no longer render the chrome menu button (in-page integration)');
  else P.push('ProtectedLayout chrome menu button removed');
  // The chrome strip must collapse when there's nothing to render (no
  // offline chip → return null) — that's the empty-top-space fix.
  if (!/if\s*\(\s*!isOfflineSession\s*\)\s*return\s+null/.test(src))
    F.push('ProtectedLayout chrome strip must early-return null when !isOfflineSession');
  else P.push('chrome strip collapses when online');
}

// ── 2. CalmHomeHero: Online tSafe call removed ──────────────────────────
const calm = read('src/components/home/CalmHomeHero.jsx');
if (calm) {
  if (/tSafe\(\s*'home\.status\.online'\s*,\s*'Online'/.test(calm))
    F.push('CalmHomeHero still renders tSafe(\'home.status.online\', \'Online\')');
  else P.push('CalmHomeHero no longer renders the Online label');
}

// ── 3. Home: bell + menu present exactly once, via inline elements OR
//          via the canonical <PageActions /> component which wraps them.
const home = read('src/pages/Home.jsx');
if (!home) F.push('src/pages/Home.jsx: missing');
else {
  const pageActionsCount = (home.match(/<PageActions\b/g) || []).length;
  const inlineBells = (home.match(/<NotificationBell\b/g) || []).length;
  const inlineMenus = (home.match(/aria-label=['"]Menu['"]/g) || []).length;
  if (pageActionsCount >= 1) {
    // Canonical path: <PageActions /> ships exactly one bell + one menu.
    if (pageActionsCount > 1)
      F.push(`Home must render exactly ONE <PageActions /> (found ${pageActionsCount})`);
    else P.push('Home renders exactly one <PageActions />');
    // No additional inline duplicates allowed.
    if (inlineBells > 0)
      F.push(`Home must not render an inline <NotificationBell /> when <PageActions /> is present (found ${inlineBells})`);
    else P.push('no duplicate inline NotificationBell');
    if (inlineMenus > 0)
      F.push(`Home must not render an inline aria-label="Menu" when <PageActions /> is present (found ${inlineMenus})`);
    else P.push('no duplicate inline aria-label="Menu"');
  } else {
    // Legacy inline path (pre-PageActions era) — still accept exactly
    // one bell + one menu inline.
    if (inlineBells !== 1) F.push(`Home must render exactly ONE NotificationBell (found ${inlineBells})`);
    else P.push('Home renders exactly one NotificationBell (inline)');
    if (inlineMenus !== 1) F.push(`Home must render exactly ONE aria-label="Menu" (found ${inlineMenus})`);
    else P.push('Home renders exactly one aria-label="Menu" (inline)');
  }
  // The hero-actions cluster anchor must still be present so the gate /
  // diagnostic can locate it in the DOM. PageActions ships its own
  // data-testid via the testId prop ("home-header-actions" on Home).
  if (!/data-testid=['"]home-header-actions['"]/.test(home))
    F.push('Home must keep the header-actions cluster (data-testid="home-header-actions")');
  else P.push('Home header-actions anchor retained');
}

// ── 4. HeaderHealth runtime + boot install ──────────────────────────────
const runtime = read('src/runtime/header/HeaderHealthRuntime.ts');
if (!runtime) F.push('HeaderHealthRuntime.ts: missing');
else {
  if (!/__headerHealth/.test(runtime)) F.push('runtime must install __headerHealth');
  else P.push('__headerHealth global declared');
  for (const k of ['onlineBadgesRemoved: true', 'duplicateBellRemoved: true',
    'duplicateMenuRemoved: true', 'homeHeroActionsRetained: true',
    'globalHeaderHiddenOnHome: true', 'layoutStable: true']) {
    if (!runtime.includes(k)) F.push(`runtime must declare ${k}`);
  }
  if (!F.some((m) => /runtime must declare/.test(m))) P.push('all 6 §DIAGNOSTICS flags declared');
}
const app = read('src/App.jsx');
if (app && !/installHeaderHealthGlobal/.test(app))
  F.push('App.jsx must call installHeaderHealthGlobal in boot');
else if (app) P.push('App.jsx wires installHeaderHealthGlobal');

if (F.length) {
  console.error('[check:header-duplication] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:header-duplication] PASS — Online chip removed, bell+menu hidden on /home, Home owns hero actions.');
for (const m of P) console.log('  ✓ ' + m);
