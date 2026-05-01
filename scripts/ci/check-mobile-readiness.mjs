#!/usr/bin/env node
/**
 * check-mobile-readiness.mjs
 *
 * Go-live guard — asserts the small set of mobile affordances
 * required for App Store submission stays in place across
 * refactors. Catches regressions like:
 *   * deleting the keyboard scroll-margin rule
 *   * removing safe-area-inset-bottom from bottom-nav padding
 *   * dropping the `<input capture="environment">` camera hook
 *   * forgetting to ship the PWA icon set
 *   * removing the service-worker registration
 *
 * Each check below reads ONE file and asserts ONE substring.
 * The script is intentionally simple so it never produces a
 * confusing "what does this mean" failure — every assertion
 * names the user-visible mobile feature it protects.
 *
 *   node scripts/ci/check-mobile-readiness.mjs
 *     → exit 0 when every check passes
 *     → exit 1 with a list of broken checks
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
  catch { return ''; }
}

function exists(rel) {
  try { return fs.existsSync(path.join(ROOT, rel)); }
  catch { return false; }
}

const checks = [
  {
    name: 'index.css ships keyboard scroll-margin rule',
    why:  'Keeps focused inputs visible above the iOS soft keyboard',
    pass: () => /scroll-margin-bottom\s*:\s*96px/.test(read('src/index.css')),
  },
  {
    name: 'BottomTabNav respects safe-area-inset-bottom',
    why:  'Prevents the iPhone home indicator from overlapping the nav',
    pass: () => /safe-area-inset-bottom/.test(read('src/components/farmer/BottomTabNav.jsx')),
  },
  {
    name: 'ScanCapture exposes capture="environment" camera input',
    why:  'iOS Safari needs this to launch the rear camera in-page',
    pass: () => /capture\s*=\s*["']environment["']/.test(read('src/components/scan/ScanCapture.jsx')),
  },
  {
    name: 'ScanCapture proactively queries camera permission',
    why:  'Lets the gallery-fallback button promote when access is denied',
    pass: () => /navigator\.permissions/.test(read('src/components/scan/ScanCapture.jsx')),
  },
  {
    name: 'main.jsx registers the service worker',
    why:  'PWA install + new-version banner depend on SW registration',
    pass: () => /registerServiceWorker/.test(read('src/main.jsx')),
  },
  {
    name: 'SWUpdateBanner is mounted in App.jsx',
    why:  'Long-running tabs need a "Reload" prompt when a new SW activates',
    pass: () => /<SWUpdateBanner\s*\/>/.test(read('src/App.jsx')),
  },
  {
    name: 'RecoveryErrorBoundary is mounted in main.jsx',
    why:  'Surfaces the 3-button recovery card on render-time exceptions',
    pass: () => /<RecoveryErrorBoundary>/.test(read('src/main.jsx')),
  },
  {
    name: 'BackyardGuard wraps /sell, /opportunities, /funding',
    why:  'Stops backyard users hitting farmer-only commerce via direct URL',
    pass: () => {
      const app = read('src/App.jsx');
      return /<BackyardGuard><Sell\s*\/><\/BackyardGuard>/.test(app)
        && /<BackyardGuard><Opportunities\s*\/><\/BackyardGuard>/.test(app)
        && /<BackyardGuard><FundingHub\s*\/><\/BackyardGuard>/.test(app);
    },
  },
  {
    name: 'PWA icon set is present',
    why:  'Manifest + iOS home-screen need the 192/512/maskable icons',
    pass: () => exists('public/icons/icon-192.png')
             && exists('public/icons/icon-512.png')
             && exists('public/icons/maskable-512.png')
             && exists('public/icons/apple-touch-icon.png'),
  },
  {
    name: 'AuthContext listens for cross-tab storage events',
    why:  'Stops "logout in tab A, refresh tab B" leaving a zombie session',
    pass: () => /addEventListener\(['"]storage['"]/.test(read('src/context/AuthContext.jsx')),
  },
  {
    name: 'marketStore exports sweepExpiredListings',
    why:  'Stale listings must auto-flip ACTIVE→EXPIRED on app boot',
    pass: () => /export function sweepExpiredListings/.test(read('src/market/marketStore.js')),
  },
  {
    name: '/help, /contact, /privacy, /terms are public (outside ProtectedLayout block)',
    why:  'App Store reviewers + footer links must reach legal pages without a session',
    pass: () => {
      const app = read('src/App.jsx');
      // The legal routes appear above the V2ProtectedLayout block opener.
      const idxLayout = app.indexOf('<Route element={<V2ProtectedLayout />}>');
      const idxHelp = app.indexOf('path="/help"');
      const idxPrivacy = app.indexOf('path="/privacy"');
      if (idxLayout < 0 || idxHelp < 0 || idxPrivacy < 0) return false;
      return idxHelp < idxLayout && idxPrivacy < idxLayout;
    },
  },
  {
    name: 'RecoveryErrorBoundary surfaces 4 buttons (Reload, Repair, Restart, Clear)',
    why:  'Spec §19 requires the full recovery menu, not 3 buttons',
    pass: () => {
      const f = read('src/components/system/RecoveryErrorBoundary.jsx');
      return /data-testid="recovery-reload"/.test(f)
          && /data-testid="recovery-repair"/.test(f)
          && /data-testid="recovery-restart"/.test(f)
          && /data-testid="recovery-clear"/.test(f);
    },
  },
  {
    name: 'marketStore exports LISTING_STATUS taxonomy with DRAFT',
    why:  'Spec §10 requires draft / active / interested / contacted / sold / expired',
    pass: () => {
      const f = read('src/market/marketStore.js');
      return /LISTING_STATUS\s*=\s*Object\.freeze/.test(f)
          && /DRAFT:\s*['"]DRAFT['"]/.test(f)
          && /INTERESTED:\s*['"]INTERESTED['"]/.test(f)
          && /CONTACTED:\s*['"]CONTACTED['"]/.test(f);
    },
  },
  {
    name: 'AllSetForTodayCard ships the empty-state',
    why:  'Spec §9 — Home must surface a friendly empty state when no priority',
    pass: () => fs.existsSync(path.join(ROOT, 'src/components/home/AllSetForTodayCard.jsx')),
  },
  {
    name: 'FarmerEntry has per-role redirect map',
    why:  'Spec §1 — buyer/admin/staff/agent each land on the right surface',
    pass: () => {
      const f = read('src/pages/FarmerEntry.jsx');
      return /role === ['"]super_admin['"]/.test(f)
          && /role === ['"]reviewer['"]/.test(f)
          && /role === ['"]agent['"]/.test(f);
    },
  },
  {
    name: 'LanguageSelector filters to supported languages',
    why:  'Spec §15 — never show a language without translations',
    pass: () => /_isLanguageSupported|REQUIRED_KEYS/.test(read('src/components/LanguageSelector.jsx')),
  },
];

const failed = [];
for (const c of checks) {
  let ok = false;
  try { ok = !!c.pass(); } catch { ok = false; }
  if (ok) {
    process.stdout.write(`\u2713 ${c.name}\n`);
  } else {
    failed.push(c);
    process.stdout.write(`\u2717 ${c.name}\n    why: ${c.why}\n`);
  }
}

if (failed.length) {
  process.stderr.write(`\nmobile-readiness: ${failed.length} check(s) failed.\n`);
  process.exit(1);
}
process.stdout.write(`\n\u2713 mobile-readiness: ${checks.length} checks passed.\n`);
