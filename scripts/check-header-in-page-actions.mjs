#!/usr/bin/env node
/**
 * scripts/check-header-in-page-actions.mjs — in-page header integration.
 *
 * Fails if:
 *   - PageActions.jsx component is missing
 *   - ProtectedLayout still renders bell or menu inside its chrome strip
 *   - ProtectedLayout doesn't collapse the chrome strip when there's
 *     nothing to show (must early-return null when !isOfflineSession)
 *   - Home doesn't render <PageActions /> in its hero header
 *   - HeaderHealthRuntime doesn't declare the new in-page-integration flags
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');

// 1. Component exists with the expected exports + identity.
const pa = read('src/components/layout/PageActions.jsx');
if (!pa) F.push('src/components/layout/PageActions.jsx: missing');
else {
  if (!/export default function PageActions/.test(pa))
    F.push('PageActions must export default function PageActions');
  else P.push('PageActions exported');
  if (!/<NotificationBell/.test(pa))
    F.push('PageActions must render <NotificationBell />');
  else P.push('NotificationBell rendered');
  if (!/aria-label=\{tSafe\([^)]*['"]Menu['"]/.test(pa) && !/aria-label=['"]Menu['"]/.test(pa))
    F.push('PageActions menu link must carry aria-label="Menu"');
  else P.push('menu aria-label "Menu" present');
  if (!/to=\{menuTo\}/.test(pa) && !/to="\/settings"/.test(pa))
    F.push('PageActions menu link must default to /settings');
  else P.push('menu link defaults to /settings');
}

// 2. ProtectedLayout strip — no bell / menu inside it anymore.
const layout = read('src/layouts/ProtectedLayout.jsx');
if (!layout) F.push('src/layouts/ProtectedLayout.jsx: missing');
else {
  const stripped = strip(layout);
  // Bell removed from the chrome strip — the only NotificationBell
  // import / render in the file at this point should be gone.
  if (/<NotificationBell[\s\S]{0,200}testId=['"]header-notification-bell/.test(stripped))
    F.push('ProtectedLayout must no longer render <NotificationBell testId="header-notification-bell" />');
  else P.push('chrome NotificationBell removed');
  // Menu/settings button removed.
  if (/data-testid=['"]layout-settings-menu['"]/.test(stripped))
    F.push('ProtectedLayout must no longer render the chrome menu button');
  else P.push('chrome menu button removed');
  // Strip collapses when nothing to show — must return null when !isOfflineSession.
  if (!/if\s*\(\s*!isOfflineSession\s*\)\s*return\s+null/.test(stripped))
    F.push('ProtectedLayout chrome strip must early-return null when !isOfflineSession');
  else P.push('chrome strip collapses when online');
}

// 3. Home renders <PageActions />.
const home = read('src/pages/Home.jsx');
if (!home) F.push('src/pages/Home.jsx: missing');
else {
  if (!/<PageActions\b/.test(home))
    F.push('Home.jsx must render <PageActions />');
  else P.push('Home renders <PageActions />');
  if (!/import\s+PageActions\b/.test(home))
    F.push('Home.jsx must import PageActions');
  else P.push('Home imports PageActions');
}

// 4. HeaderHealthRuntime envelope has the new in-page-integration fields.
const rt = read('src/runtime/header/HeaderHealthRuntime.ts');
if (!rt) F.push('HeaderHealthRuntime.ts: missing');
else {
  for (const fld of ['liveBadgesRemoved', 'globalMobileHeaderCollapsed',
    'pageActionsInPageHeader', 'emptyTopSpaceRemoved',
    'notificationPanelAnchored', 'actionsConsistent']) {
    if (!new RegExp(`\\b${fld}\\b`).test(rt))
      F.push(`__headerHealth envelope must declare ${fld}`);
  }
  if (!F.some((m) => /envelope must declare/.test(m)))
    P.push('all 6 in-page-integration flags present');
  // The new flags must be literal-true.
  for (const fld of ['globalMobileHeaderCollapsed', 'pageActionsInPageHeader',
    'emptyTopSpaceRemoved', 'notificationPanelAnchored']) {
    if (!new RegExp(`${fld}:\\s*true`).test(rt))
      F.push(`${fld} must be literal-true in the envelope`);
  }
  if (!F.some((m) => /must be literal-true/.test(m)))
    P.push('new flags are literal-true');
}

if (F.length) {
  console.error('[check:header-in-page-actions] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:header-in-page-actions] PASS — PageActions in pages, chrome strip collapsed, no chrome bell/menu, envelope extended.');
for (const m of P) console.log('  ✓ ' + m);
