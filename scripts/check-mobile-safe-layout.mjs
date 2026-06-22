/**
 * check-mobile-safe-layout.mjs — sprint #213 §3/§11.
 *
 * Static guard against the mobile failures the premortem flagged:
 * content behind the bottom nav, and CTAs clipped by the iOS notch /
 * home indicator. Asserts the role-aware bottom nav respects the
 * safe-area inset, and that safe-area handling is used broadly (it is
 * the cross-cutting fix for clipped buttons on iPhone Safari).
 *
 * Layout is ultimately verified on-device; this gate prevents the
 * regression of removing safe-area handling.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const errors = [];
const _exists = (rel) => { try { return fs.existsSync(path.join(ROOT, rel)); } catch { return false; } };
const _read = (rel) => { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } };

// 1. Role-aware bottom nav must respect the safe-area inset so the
//    home indicator doesn't clip its tap targets.
const NAV = 'src/components/RoleAwareBottomNav.jsx';
if (!_exists(NAV)) {
  errors.push('missing bottom nav: ' + NAV);
} else if (!/safe-area-inset/.test(_read(NAV))) {
  errors.push('RoleAwareBottomNav must use env(safe-area-inset-*) padding (notch/home-indicator)');
}

// 2. Global stylesheet must define safe-area handling for the shell.
const CSS = 'src/index.css';
if (_exists(CSS) && !/safe-area-inset/.test(_read(CSS))) {
  errors.push('src/index.css must define safe-area-inset handling for the app shell');
}

// 3. Safe-area handling must be used broadly (regression backstop) —
//    at least 10 files (was 27 at #213).
let count = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel); }
    else if (/\.(jsx?|tsx?|css)$/.test(e.name) && /safe-area-inset/.test(_read(rel))) count++;
  }
};
try { walk('src'); } catch { /* ignore */ }
if (count < 10) {
  errors.push('safe-area-inset usage dropped to ' + count + ' files (<10) — mobile clipping regression risk');
}

// 4. The premium-mobile diagnostic gate must still ship.
if (!_exists('scripts/check-premium-mobile-ui.mjs')) {
  errors.push('premortem requires scripts/check-premium-mobile-ui.mjs');
}

if (errors.length) {
  console.error('[check:mobile-safe-layout] FAIL — ' + errors.length + ' issue(s):');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log('[check:mobile-safe-layout] PASS — bottom nav + shell respect safe-area inset; '
  + count + ' files handle the notch; premium-mobile gate ships.');
