#!/usr/bin/env node
/**
 * check-notification-panel-polish.mjs — locks the NotificationBell
 * production-fix contract:
 *
 *   • Panel rendered via ReactDOM.createPortal(document.body).
 *   • Notifications mapped as a list (not a single item).
 *   • Every title/message routed through resolveTemplate so
 *     `{crop}` / `{plant}` / `{farm}` / `{task}` / `{days}` never leak.
 *   • Scroll-ready: list has overflow-y: auto + max-height.
 *   • Mark-all-read handler wired.
 *   • z-index ≥ 1000 (above bottom nav + modal layer).
 *   • Empty-state copy present.
 *   • No absolute-positioned text elements inside rows.
 *   • Mobile safe-area honored.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const fails = [];
const read = (rel) => {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { fails.push(`missing: ${rel}`); return ''; }
  return fs.readFileSync(p, 'utf8');
};

// 1. NotificationBell contract.
{
  const f = 'src/components/NotificationBell.jsx';
  const src = read(f);
  if (src) {
    if (src.indexOf("from 'react-dom'") < 0
        && src.indexOf('from "react-dom"') < 0)
      fails.push(`${f}: must import react-dom for createPortal`);
    if (src.indexOf('createPortal') < 0)
      fails.push(`${f}: must render the panel via ReactDOM.createPortal`);
    if (src.indexOf('document.body') < 0)
      fails.push(`${f}: portal must attach to document.body (not a clipped parent)`);
    if (src.indexOf("data-portal=\"notification-panel\"") < 0)
      fails.push(`${f}: panel must carry data-portal="notification-panel"`);
    if (src.indexOf('NotificationTemplateResolver') < 0)
      fails.push(`${f}: must import NotificationTemplateResolver`);
    if (src.indexOf('resolveTemplate') < 0 && src.indexOf('resolve as resolveTemplate') < 0)
      fails.push(`${f}: must call resolveTemplate on title + message`);
    if (src.indexOf('isFullyResolved') < 0)
      fails.push(`${f}: must verify isFullyResolved before render`);
    if (src.indexOf('list.map') < 0)
      fails.push(`${f}: must render notifications via list.map (not a single item)`);
    if (src.indexOf('markAllAsRead') < 0)
      fails.push(`${f}: must wire markAllAsRead handler`);
    if (src.indexOf("data-testid={`${testId}-empty`}") < 0
        && src.indexOf('notifications.empty') < 0)
      fails.push(`${f}: must render empty state`);
    if (src.indexOf("position: 'fixed'") < 0)
      fails.push(`${f}: panel must use position:fixed for portal layout`);
    if (src.indexOf('overflowY:') < 0 && src.indexOf("overflowY: 'auto'") < 0)
      fails.push(`${f}: list region must scroll (overflowY:'auto')`);
    if (src.indexOf('maxHeight:') < 0)
      fails.push(`${f}: panel must set maxHeight`);
    if (src.indexOf('zIndex: 11') < 0 && src.indexOf('zIndex: 12') < 0
        && src.indexOf('zIndex: 1000') < 0 && src.indexOf('zIndex: 1100') < 0)
      fails.push(`${f}: panel z-index must be ≥ 1000 (above bottom nav)`);
    if (src.indexOf('safe-area-inset-top') < 0)
      fails.push(`${f}: must honor env(safe-area-inset-top) on mobile`);
    if (!/_sortAndLimit|unread first|unread\s*-\s*read/i.test(src))
      fails.push(`${f}: must sort unread-first then newest-first`);
    // Forbid `position: 'absolute'` on row title/msg — was causing overlap.
    if (/rowTitle\s*:\s*\{[^}]*position\s*:\s*['"]absolute['"]/m.test(src))
      fails.push(`${f}: rowTitle must NOT use position:absolute`);
    if (/rowMsg\s*:\s*\{[^}]*position\s*:\s*['"]absolute['"]/m.test(src))
      fails.push(`${f}: rowMsg must NOT use position:absolute`);
  }
}

// 2. Diagnostic runtime contract.
{
  const f = 'src/runtime/notifications/NotificationPanelHealth.ts';
  const src = read(f);
  if (src) {
    const required = [
      '__notificationPanelHealth',
      'installNotificationPanelHealthGlobal',
      'portalRendered', 'notClipped', 'scrollReady',
      'showsAllNotifications', 'unreadFirst',
      'placeholdersResolved', 'noTextOverlap',
      'markAllReadReady', 'emptyStateReady',
      'mobileSafeAreaReady',
    ];
    for (const k of required) {
      if (src.indexOf(k) < 0) fails.push(`${f}: missing "${k}"`);
    }
  }
}

// 3. App.jsx wires the install.
{
  const f = 'src/App.jsx';
  const src = read(f);
  if (src && src.indexOf('installNotificationPanelHealthGlobal') < 0)
    fails.push(`${f}: missing installNotificationPanelHealthGlobal() install`);
}

if (fails.length) {
  console.error('[check:notification-panel-polish] FAILED');
  for (const m of fails) console.error('  - ' + m);
  process.exit(1);
}
console.log('[check:notification-panel-polish] OK');
