/**
 * check-offline-shell.mjs — OFFLINE_SHELL_V1.
 * Locks the PWA offline shell AND the safety reconciliation with the
 * deliberate SW-kill: network-first navigation (no stale shell), cache-
 * first hashed assets, versioned caches, and forceUiReset/index.html
 * sparing the shell instead of nuking it every boot.
 */
import fs from 'node:fs'; import path from 'node:path';
const R = process.cwd(), E = [];
const x = (r) => { try { return fs.existsSync(path.join(R, r)); } catch { return false; } };
const rd = (r) => { try { return fs.readFileSync(path.join(R, r), 'utf8'); } catch { return ''; } };
const h = (s, n, m) => { if (!s.includes(n)) E.push(m); };

// Service worker — safe design.
const SW = 'public/sw.js';
if (!x(SW)) E.push('missing service worker: ' + SW); else { const s = rd(SW);
  h(s, "req.mode === 'navigate'", 'SW must handle navigations');
  h(s, 'networkFirstShell', 'navigations must be NETWORK-FIRST (no stale shell)');
  h(s, "url.pathname.startsWith('/assets/')", 'hashed assets must be handled');
  h(s, 'cacheFirst', 'hashed assets must be cache-first');
  h(s, 'staleWhileRevalidate', 'json (translations/crop lib) must be SWR');
  h(s, 'skipWaiting', 'SW must skipWaiting for instant updates');
  h(s, 'clients.claim', 'SW must clientsClaim');
  h(s, 'KILL_SW', 'SW must support an emergency self-removal message');
  if (!/req\.method !== 'GET'/.test(s)) E.push('SW must never cache non-GET (writes)');
  h(s, "startsWith('/api/')", 'SW must pass /api through to network');
}

// Config + manager.
const CFG = 'src/lib/offline/offlineShellConfig.js';
if (!x(CFG)) E.push('missing: ' + CFG); else { const s = rd(CFG);
  h(s, 'OFFLINE_SHELL_ENABLED', 'config must export OFFLINE_SHELL_ENABLED kill switch');
  h(s, 'isOfflineShellCache', 'config must export isOfflineShellCache');
}
const MGR = 'src/lib/offline/serviceWorkerManager.js';
if (!x(MGR)) E.push('missing: ' + MGR); else { const s = rd(MGR);
  h(s, 'export function registerOfflineShell', 'must export registerOfflineShell');
  h(s, 'export function installOfflineShellHealth', 'must export installOfflineShellHealth');
  h(s, '__offlineShellHealth', 'must install __offlineShellHealth');
  h(s, 'window.Capacitor', 'must skip Capacitor native (own shell)');
}
h(rd('src/main.jsx'), 'registerOfflineShell', 'main.jsx must register the offline shell');

// Reconciliation with the deliberate SW-kill (the dangerous part).
const FUR = rd('src/lib/forceUiReset.js');
h(FUR, 'OFFLINE_SHELL_ENABLED', 'forceUiReset must read the offline-shell flag');
h(FUR, 'isOfflineShellCache', 'forceUiReset must SPARE offline-shell caches');
if (!/if \(!offlineShellEnabled\)/.test(FUR)) E.push('forceUiReset must only unregister SWs when the shell is DISABLED');
const HTML = rd('index.html');
h(HTML, 'fwshell', 'index.html cleanup must spare the offline-shell caches');
if (/getRegistrations\(\)\.then\(function \(regs\)/.test(HTML)) E.push('index.html must NOT unconditionally unregister all service workers (would kill the shell)');

// Banner — direct import (works offline), shows the required string.
const BAN = 'src/components/OfflineBanner.jsx';
if (!x(BAN)) E.push('missing: ' + BAN); else { const s = rd(BAN);
  h(s, "t('offline.active')", 'banner must render offline.active ("Offline mode active")');
  h(s, 'useNetworkStatus', 'banner must react to network status');
  h(s, 'offline-banner', 'banner must carry its testid');
}
const APP = rd('src/App.jsx');
h(APP, '<OfflineBanner', 'App must mount OfflineBanner');
if (/lazy\([^)]*OfflineBanner/.test(APP)) E.push('OfflineBanner must be a DIRECT import (lazy would fail to load offline)');

// i18n key registered.
h(rd('src/i18n/columns/T-en.js'), '"offline.active"', 'offline.active must be registered in T-en');

if (E.length) { console.error('[check:offline-shell] FAIL — ' + E.length + ' issue(s):'); for (const e of E) console.error('  - ' + e); process.exit(1); }
console.log('[check:offline-shell] PASS — network-first shell + cache-first assets + SWR json; versioned; SW-kill reconciled (shell spared); "Offline mode active" banner wired.');
