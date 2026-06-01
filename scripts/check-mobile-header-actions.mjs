#!/usr/bin/env node
/**
 * scripts/check-mobile-header-actions.mjs — duplicate-bell/menu guard.
 *
 * Fails if any major page renders MORE THAN ONE <NotificationBell /> or
 * MORE THAN ONE aria-label="Menu" (after collapsing the canonical
 * <PageActions /> wrapper into a single bell+menu pair).
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };

const PAGES = [
  'src/pages/Home.jsx',
  // The following pages will adopt <PageActions /> in a follow-on wave; the
  // gate only forbids duplicates, so pages that don't render bell/menu at
  // all are also allowed.
  'src/pages/AllTasksPage.jsx',
  'src/pages/Sell.jsx',
];

for (const rel of PAGES) {
  const src = read(rel);
  if (!src) continue;
  // PageActions ships exactly one bell + one menu. So treat <PageActions />
  // as one bell + one menu and count any inline <NotificationBell /> /
  // aria-label="Menu" on top of that.
  const pageActionsCount = (src.match(/<PageActions\b/g) || []).length;
  const inlineBells = (src.match(/<NotificationBell\b/g) || []).length;
  const inlineMenus = (src.match(/aria-label=['"]Menu['"]/g) || []).length;
  const totalBells = pageActionsCount + inlineBells;
  const totalMenus = pageActionsCount + inlineMenus;
  if (totalBells > 1) F.push(`${rel}: renders ${totalBells} NotificationBell sources (max 1) — duplicate bell`);
  if (totalMenus > 1) F.push(`${rel}: renders ${totalMenus} menu sources (max 1) — duplicate menu`);
}
if (!F.length) P.push('no duplicate bell/menu found in scanned pages');

// ProtectedLayout must NOT render either source.
const layout = read('src/layouts/ProtectedLayout.jsx');
if (layout) {
  const stripped = layout
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '');
  if (/testId=['"]header-notification-bell['"]/.test(stripped))
    F.push('ProtectedLayout must not render the chrome NotificationBell');
  else P.push('ProtectedLayout no chrome bell');
  if (/data-testid=['"]layout-settings-menu['"]/.test(stripped))
    F.push('ProtectedLayout must not render the chrome menu button');
  else P.push('ProtectedLayout no chrome menu');
}

if (F.length) {
  console.error('[check:mobile-header-actions] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:mobile-header-actions] PASS — one bell + one menu per page, no chrome leakage.');
for (const m of P) console.log('  ✓ ' + m);
