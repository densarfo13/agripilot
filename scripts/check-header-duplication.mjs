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
  // Bell + Menu must be guarded by !isHome (and the IIFE must derive isHome).
  if (!/const\s+isHome\s*=\s*path\s*===\s*['"]\/['"]\s*\|\|\s*path\s*===\s*['"]\/home['"]/.test(src))
    F.push('ProtectedLayout must derive isHome from location.pathname (/ or /home)');
  else P.push('ProtectedLayout derives isHome');
  if (!/!isHome\s*&&\s*!onboarding\s*&&\s*isSurfaceEnabled\('FEATURE_NOTIFICATIONS'\)/.test(src))
    F.push('ProtectedLayout must hide the bell when isHome');
  else P.push('ProtectedLayout hides the bell on /home');
  // The menu must also be guarded by !isHome.
  if (!/!isHome\s*&&\s*!onboarding\s*&&\s*\(/.test(src))
    F.push('ProtectedLayout must hide the menu when isHome');
  else P.push('ProtectedLayout hides the menu on /home');
  // The chrome right group must mark the hidden state for the diagnostic.
  if (!/data-hidden-on-home=\{isHome\s*\?\s*['"]true['"]\s*:\s*['"]false['"]\}/.test(proto))
    F.push('ProtectedLayout must mark data-hidden-on-home on the chrome group');
  else P.push('chrome group marks data-hidden-on-home');
}

// ── 2. CalmHomeHero: Online tSafe call removed ──────────────────────────
const calm = read('src/components/home/CalmHomeHero.jsx');
if (calm) {
  if (/tSafe\(\s*'home\.status\.online'\s*,\s*'Online'/.test(calm))
    F.push('CalmHomeHero still renders tSafe(\'home.status.online\', \'Online\')');
  else P.push('CalmHomeHero no longer renders the Online label');
}

// ── 3. Home: exactly ONE NotificationBell + ONE aria-label="Menu" ───────
const home = read('src/pages/Home.jsx');
if (!home) F.push('src/pages/Home.jsx: missing');
else {
  const bells = (home.match(/<NotificationBell\b/g) || []).length;
  if (bells !== 1) F.push(`Home must render exactly ONE NotificationBell (found ${bells})`);
  else P.push('Home renders exactly one NotificationBell');
  const menus = (home.match(/aria-label=['"]Menu['"]/g) || []).length;
  if (menus !== 1) F.push(`Home must render exactly ONE aria-label="Menu" (found ${menus})`);
  else P.push('Home renders exactly one aria-label="Menu"');
  // The hero-actions cluster must still be present (no empty container).
  if (!/data-testid=['"]home-header-actions['"]/.test(home))
    F.push('Home must keep the header-actions cluster (data-testid="home-header-actions")');
  else P.push('Home header-actions cluster retained');
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
